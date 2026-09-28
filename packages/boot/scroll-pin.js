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
 * **浮层组件（推荐：一行接线）** —— 做 `mc-dropdown` / `mc-tooltip` / `mc-dialog` 这类组件时照抄：
 *
 * ```js
 * import { attachFloatingScrollGuard } from '../boot/scroll-pin.js';
 *
 * ready()    { this._scrollGuard = attachFloatingScrollGuard(this.ele, this.panel); }
 * detached() { this._scrollGuard.dispose(); }
 * ```
 *
 * 它自己监听面板的 `beforetoggle` / `toggle`（浏览器 light dismiss / Esc 也会发这两个事件），
 * 所以不用在模板里为守卫加绑定。唯一要额外包一层的是**显式显示 / 收起那一行**：
 *
 * ```js
 * this._scrollGuard.run(() => this.panel.showPopover());   // 同步动作里的位移要立刻回滚
 * ```
 *
 * 因为 `toggle` 事件是排队发的（晚一拍），只靠它挡不住同步那一瞬。
 *
 * **任意场景（手动接线）**：
 *
 * ```js
 * import { createScrollPin } from '../boot/scroll-pin.js';
 *
 * const pin = createScrollPin(el);
 * pin.run(() => doSomethingNative());   // 快照 → 动作 → 钉住
 * pin.remember();                       // 状态变化**之前**记锚点
 * pin.hold();                           // 状态变完钉回去
 * pin.dispose();
 * ```
 *
 * 再底层就用 `snapshotScroll(el)` 拿回滚函数、`holdScroll(restore, opts)` 钉住它。
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
export function holdScroll(restore, { hold = HOLD_MS, owner = null, onEnd = null } = {}) {
  if (typeof restore !== 'function') return () => {};

  restore();

  let released = false;
  let ended = false;
  let frame = 0;

  /** 收尾：摘监听、掐掉还没跑的那一帧、通知调用方（幂等） */
  const stop = () => {
    if (ended) return;
    ended = true;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    for (const type of RELEASE_ON) window.removeEventListener(type, release);
    onEnd?.();
  };

  const release = (event) => {
    /* 滚轮一律算「人在滚」；按下 / 触摸只在 owner 之外才算 */
    if (event.type === 'wheel' || !(owner && (event.composedPath?.().includes(owner) ?? false))) {
      released = true;
      stop();
    }
  };
  for (const type of RELEASE_ON) window.addEventListener(type, release, { passive: true });

  const until = performance.now() + hold;
  const watch = () => {
    frame = 0;
    /* ⚠️ 顺序：先判「结束」再 restore。rAF 被节流时（headless Chrome / 后台标签页）下一帧可能
       远迟于 until，按原来的顺序会在这时**又 restore 一次**（拿的是过期快照）—— 实测它会把
       dispose() 之后刚设的位置盖回去（CI 上就是这么红的）。 */
    if (released || performance.now() >= until) {
      stop();
      return;
    }
    restore();
    frame = requestAnimationFrame(watch);
  };
  frame = requestAnimationFrame(watch);

  return () => {
    released = true;
    stop();
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
  /** 在跑着的 hold：dispose 必须把它们一起掐掉，否则时间窗内还会 restore（见 holdScroll 的注释） */
  const holds = new Map();
  let holdSeq = 0;

  const startHold = (restore) => {
    const id = (holdSeq += 1);
    const release = holdScroll(restore, { hold, owner: el, onEnd: () => holds.delete(id) });
    holds.set(id, release);
    return release;
  };

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
      return startHold(restore);
    },

    /** 快照 → 执行动作 → 钉住。返回动作的返回值 */
    run(action) {
      const restore = freshAnchor();
      const result = action();
      startHold(restore);
      return result;
    },

    /** 退订手势监听 + 掐掉挂起的 hold（组件 detached 时调用） */
    dispose() {
      for (const type of GESTURES) {
        document.removeEventListener(type, takeAnchor, { capture: true });
      }
      for (const release of [...holds.values()]) release();
      holds.clear();
      anchor = null;
    },
  };
}

/**
 * 给**浮层组件**自动接好滚动守卫：自己监听面板的 `beforetoggle` / `toggle`。
 *
 * 浮层组件（`mc-dropdown` / `mc-tooltip` / `mc-dialog` 这类）只要两处：
 *
 * ```js
 * ready()    { this._scrollGuard = attachFloatingScrollGuard(this.ele, this.panel); }
 * detached() { this._scrollGuard.dispose(); }
 * ```
 *
 * 另外**显式显示 / 收起那一行再包一层 `run()`** —— `toggle` 事件是排队发的，
 * 挡不住同步动作那一瞬的位移：
 *
 * ```js
 * this._scrollGuard.run(() => this.panel.showPopover());
 * ```
 *
 * @param {Element} host  组件宿主（往上找滚动容器、也用于「按在里面不算用户滚动」）
 * @param {Element} panel 浮层面板（`popover` 元素；浏览器自己关闭时也会在它上面发 toggle）
 */
export function attachFloatingScrollGuard(host, panel, options) {
  const pin = createScrollPin(host, options);
  const remember = () => pin.remember();
  const hold = () => pin.hold();

  /* beforetoggle 在状态**变化之前**触发，且浏览器的 light dismiss / Esc 也会发它 ——
     关闭时的焦点归还、显示时的 top layer 插入都可能让浏览器顺手滚一下，
     而那一刻已经从 toggle 里拿不到"原来的位置"了。 */
  panel.addEventListener('beforetoggle', remember);
  panel.addEventListener('toggle', hold);

  return {
    run: pin.run,
    remember: pin.remember,
    hold: pin.hold,
    dispose() {
      panel.removeEventListener('beforetoggle', remember);
      panel.removeEventListener('toggle', hold);
      pin.dispose();
    },
  };
}
