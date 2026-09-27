/**
 * scroll-pin —— **定住页面的滚动条**：做「不该改变滚动位置」的原生动作时把位置钉住。
 *
 * 用在哪：浮层开合（`mc-popover`）、任何会往 top layer 里插东西、或让浏览器自己做聚焦 /
 * 布局调整的动作。判据很简单 —— **这个动作不该让页面滚动，但浏览器可能顺手滚一下**。
 *
 * ## 为什么需要它（实测，火狐 156）
 *
 * 文档站 Popover 页点一下演示的触发按钮，正文带 `.doc-main` 会从 1207 跳到 2057。
 * 二分结论：触发点是原生 `showPopover()` 这个动作**本身** ——
 *   面板整个不在 DOM：不跳；面板在 DOM 但不显示：不跳；正常显示但摘掉锚点定位：**照跳**。
 * 而浮层是 `position: fixed` + top layer，开合它**不该**改变页面滚动位置。
 *
 * 这是**上游问题的站点侧兜底**，不是我们代码的缺陷。相关的规范 / 实现记录：
 *   · [CSSWG #10999] anchor 定位的 fixed 元素首次布局应按**当前滚动偏移**算位置区（2024-10 已决议）
 *   · [Firefox Bug 2009225] 这类元素不该按**初始滚动位置**贡献 scrollable overflow ——
 *     原文「this change causes the scroller to fluctuate as the positioned element moves around」
 *     （147/148/149 已修）
 *   · 仍在推进：[#10858] 定义清楚锚点定位与滚动的交互、[#13067] scrollable containing block、
 *     [#13353] anchor-center 与可滚动容器；Firefox [D276171] 锚点定位的 scroll-linked effects
 *
 * 等目标浏览器都修完、且 Mosaic 的最低支持版本都包含修复时，这层兜底可以删掉。
 *
 * [CSSWG #10999]: https://github.com/w3c/csswg-drafts/issues/10999
 * [Firefox Bug 2009225]: https://bugzilla.mozilla.org/show_bug.cgi?id=2009225
 * [#10858]: https://github.com/w3c/csswg-drafts/issues/10858
 * [#13067]: https://github.com/w3c/csswg-drafts/issues/13067
 * [#13353]: https://github.com/w3c/csswg-drafts/issues/13353
 * [D276171]: https://phabricator.services.mozilla.com/D276171
 *
 * ## 三种形状（少覆盖一种就漏，三种都是在真机上被用户抓出来的）
 *
 * 1. **原生动作里滚**：位移可能落在同步、下一帧、或更晚的 task 里 —— 所以要按时间窗
 *    （`hold`）反复回滚，而不是只回滚一次。
 * 2. **手势之后、动作之前就被滚**：例如「外部按钮改数据 → `attr:open` → 模板重渲染 →
 *    watch → `showPopover()`」这条路，浏览器可能在重渲染那一下先滚过了。这时只有**手势那一刻**
 *    的位置能代表"用户看到的位置"，所以 `createScrollPin()` 会在 `pointerdown` / `keydown`
 *    上记一份锚点（见 `anchorOf`）。
 * 3. **浏览器自己发起的关闭**：点触发元素会让 `popover="auto"` 走 light dismiss ——
 *    **不经过组件的 `hide()`**，只能由调用方在 `beforetoggle` 记锚点、`toggle` 里 `hold()`。
 *
 * ## 边界：只拦浏览器，不拦人
 *
 * 用户自己滚（滚轮 / 触摸 / 在别处按下）时当帧就放手。所以 `hold` 的时间窗不会让页面
 * 「黏住」：开了浮层马上滚轮照样即时生效。
 *
 * ## 用法
 *
 * ```js
 * import { createScrollPin } from '../boot/scroll-pin.js';
 *
 * const pin = createScrollPin(this.ele);          // ready() 里建一次
 * pin.run(() => panel.showPopover());             // 快照 → 动作 → 钉住（同步 + 时间窗）
 * // 「浏览器自己先动」的场景（beforetoggle / toggle 这种成对钩子）：
 * pin.remember();                                 // 状态变化**之前**
 * // …浏览器把状态改掉…
 * pin.hold();                                     // 用刚记的锚点钉住
 * // detached() 里：
 * pin.dispose();
 * ```
 *
 * 也可以只用低层原语：`snapshotScroll(el)` 拿回滚函数、`holdScroll(restore, opts)` 钉住它。
 */

/** 默认盯多久（ms）：够覆盖「原生动作 + 随后的模板重渲染」，又不至于黏手 */
const HOLD_MS = 300;

/** 用户在窗口上一动就放开的事件（滚轮 / 按下 / 触摸；判定见 holdScroll） */
const RELEASE_ON = ['wheel', 'pointerdown', 'touchstart'];

/** 记手势锚点的事件 */
const GESTURES = ['pointerdown', 'keydown'];

/**
 * 记下 `el` 所在**滚动环境**的位置，返回一个「回到那个位置」的函数。
 *
 * ⚠️ 往上找容器必须**穿透 shadow root 与 `<slot>`**：文档站的正文带 `.doc-main` 住在
 * 布局页自己的 shadow root 里，而页面正文是 `<slot>` 投递进去的 —— 只走 `parentElement`
 * 会跳过它（`assignedSlot` 那一步就是为这个）。文档滚动容器（`document.scrollingElement`）
 * 也一并记上，两种都覆盖。
 *
 * @param {Element} el 从这个元素往上找（通常传组件宿主）
 * @returns {() => void} 回滚函数（幂等；位置没变就什么都不做）
 */
export function snapshotScroll(el) {
  const boxes = [];
  const add = (box) => {
    if (box && !boxes.some(([seen]) => seen === box)) {
      boxes.push([box, box.scrollLeft, box.scrollTop]);
    }
  };

  for (let node = el; node;) {
    if (
      node instanceof Element &&
      (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)
    ) {
      add(node);
    }
    /* 往上走三步：① 被 `<slot>` 投递 → 进投递它的那棵 shadow tree（`assignedSlot`）；
       ② 同一棵树里继续 `parentElement`（**这一步不能省**：正文带就住在槽与宿主之间）；
       ③ 走到 shadow tree 顶端才跨出去到宿主。 */
    node =
      node.assignedSlot ??
      node.parentElement ??
      (node.getRootNode() instanceof ShadowRoot ? node.getRootNode().host : null);
  }
  add(document.scrollingElement);

  return () => {
    for (const [box, left, top] of boxes) {
      if (box.scrollTop !== top) box.scrollTop = top;
      if (box.scrollLeft !== left) box.scrollLeft = left;
    }
  };
}

/**
 * 钉住：先把 `restore` 跑一次，再在 `hold` 毫秒内**每一帧**继续跑。
 *
 * @param {() => void} restore             `snapshotScroll()` 返回的回滚函数
 * @param {object} [options]
 * @param {number} [options.hold=300]      盯多久（ms）
 * @param {Element} [options.owner]        归属元素：按在它**里面**的 pointerdown / touchstart
 *                                         不算「用户要滚页面」（那一下往往正是开合本身）
 * @returns {() => void} 提前放手（幂等）
 */
export function holdScroll(restore, { hold = HOLD_MS, owner = null } = {}) {
  if (typeof restore !== 'function') return () => {};

  restore();

  let released = false;
  const release = (event) => {
    /* 滚轮一律算「人在滚」；按下 / 触摸只在 owner 之外才算 */
    if (event.type === 'wheel' || !(owner && (event.composedPath?.().includes(owner) ?? false))) {
      released = true;
    }
  };
  for (const type of RELEASE_ON) window.addEventListener(type, release, { passive: true });

  const until = performance.now() + hold;
  const watch = () => {
    if (!released) restore();
    if (released || performance.now() >= until) {
      for (const type of RELEASE_ON) window.removeEventListener(type, release);
      return;
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);

  return () => {
    released = true;
  };
}

/**
 * 给一个组件建一份「滚动锚点 + 钉住」的小工具（组件里用这个，不用手写上面两个原语的组合）。
 *
 * 它在 `pointerdown` / `keydown` 上自动记锚点：**手势之后、动作之前**被滚走的那种形状，
 * 只有手势那一刻的位置才准（形状 2，见文件头）。
 *
 * @param {Element} el              归属元素（通常组件宿主）：往上找滚动容器、也用于「按在里面不算」
 * @param {object} [options]
 * @param {number} [options.hold=300]  钉多久（ms）
 */
export function createScrollPin(el, { hold = HOLD_MS } = {}) {
  let anchor = null;

  const takeAnchor = () => {
    anchor = { at: performance.now(), restore: snapshotScroll(el) };
  };
  for (const type of GESTURES) {
    document.addEventListener(type, takeAnchor, { capture: true, passive: true });
  }

  /**
   * 要一份「够新的锚点」：手势刚记过就用它 —— 那份才代表"用户看到的位置"；
   * 手势离得远（或还没记过）就现在记一份。
   *
   * ⚠️ 不能无条件重记：显示浮层时 `beforetoggle` 里的 `remember()` 会跑在浏览器已经
   * 滚过页面之后（形状 2），那时重记就把准确的手势位置覆盖成"被滚过的位置"，等于没兜住。
   */
  const freshAnchor = () => {
    if (!anchor || performance.now() - anchor.at >= hold) takeAnchor();
    return anchor.restore;
  };

  return {
    /** 记一份锚点（状态变化**之前**调用；手势也自动记，且新鲜的会保留、不被覆盖） */
    remember() {
      freshAnchor();
    },

    /** 用最近的锚点钉住（没有就现场记一份） */
    hold(restore = freshAnchor()) {
      return holdScroll(restore, { hold, owner: el });
    },

    /** 快照 → 执行动作 → 钉住。返回动作的返回值 */
    run(action) {
      const restore = freshAnchor();
      const result = action();
      holdScroll(restore, { hold, owner: el });
      return result;
    },

    /** 退订手势监听（组件 detached 时调用） */
    dispose() {
      for (const type of GESTURES) {
        document.removeEventListener(type, takeAnchor, { capture: true });
      }
      anchor = null;
    },
  };
}
