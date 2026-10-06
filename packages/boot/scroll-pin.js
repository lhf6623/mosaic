/**
 * scroll-pin —— 定住页面的滚动条：做「不该改变滚动位置」的原生动作（浮层开合、往 top layer
 * 插东西、浏览器自己做聚焦 / 布局调整）时把位置钉住。
 *
 * 为什么需要（实测，火狐 156）：原生 `showPopover()` 这个动作本身就会把正文带 `.doc-main`
 * 从 1207 跳到 2057，而 fixed + top layer 的浮层开合不该改变页面滚动位置。二分结论 ——
 * 面板整个不在 DOM / 在 DOM 但不显示都不跳，正常显示但摘掉锚点定位**照跳**。
 * 这是上游问题的站点侧兜底，不是我们的缺陷；等最低支持版本都含修复后可以删掉：
 *   · [CSSWG #10999] 已决议（fixed 元素首次布局按当前滚动偏移算位置区）
 *   · [Firefox Bug 2009225] 147–149 已修；仍在推进 [#10858] / [#13067] / [#13353]
 *
 * 三种形状（少覆盖一种就漏，都是在真机上被用户抓出来的）：
 *   ① 位移可能落在同步 / 下一帧 / 更晚的 task → 按时间窗（`hold`）反复回滚，不能只回滚一次；
 *   ② 手势之后、动作之前就被滚（「外部按钮改数据 → `attr:open` → 重渲染 → `showPopover()`」）→
 *      只有手势那一刻的位置代表"用户看到的位置"，`createScrollPin()` 在 pointerdown / keydown 记锚点；
 *   ③ 浏览器自己发起的关闭（light dismiss / Esc 不走组件的 `hide()`）→ 调用方在 `beforetoggle`
 *      记锚点、`toggle` 里 `hold()`（`attachFloatingScrollGuard()` 已接好这两处）。
 *
 * 边界：只拦浏览器、不拦人 —— 用户自己滚（滚轮 / 触摸 / 在别处按下）当帧放手，不会黏住。
 * 用法：浮层组件用 `attachFloatingScrollGuard(host, panel)`；其余见 `createScrollPin` 的 JSDoc。
 *
 * [CSSWG #10999]: https://github.com/w3c/csswg-drafts/issues/10999
 * [Firefox Bug 2009225]: https://bugzilla.mozilla.org/show_bug.cgi?id=2009225
 * [#10858]: https://github.com/w3c/csswg-drafts/issues/10858
 * [#13067]: https://github.com/w3c/csswg-drafts/issues/13067
 * [#13353]: https://github.com/w3c/csswg-drafts/issues/13353
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
  /** @type {[Element, number, number][]} */
  const boxes = [];
  /** @param {Element | null} box */
  const add = (box) => {
    if (box && !boxes.some(([seen]) => seen === box)) {
      boxes.push([box, box.scrollLeft, box.scrollTop]);
    }
  };

  /** @type {Element | null} */
  let node = el;
  while (node) {
    if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) {
      add(node);
    }
    /* 往上走三步：`assignedSlot` 进投递它的 shadow tree → 树内 `parentElement`（不能省，
       正文带就住在槽与宿主之间）→ 走到树顶才跨出去到宿主 */
    const root = node.getRootNode();
    node =
      node.assignedSlot ?? node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
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
 * @param {Element | null} [options.owner] 归属元素：按在它**里面**的 pointerdown / touchstart
 *                                         不算「用户要滚页面」（那一下往往正是开合本身）
 * @param {(() => void) | null} [options.onEnd] 收尾时叫一次（幂等停止之后）
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

  /** @param {Event} event */
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
  /** 记录的滚动锚点：手势那一刻的位置 + 回滚函数 @type {{ at: number, restore: () => void } | null} */
  let anchor = null;
  /** 在跑着的 hold：dispose 必须把它们一起掐掉，否则时间窗内还会 restore（见 holdScroll 的注释） */
  const holds = new Map();
  let holdSeq = 0;

  /** @param {() => void} restore @returns {() => void} */
  const startHold = (restore) => {
    const id = (holdSeq += 1);
    const release = holdScroll(restore, { hold, owner: el, onEnd: () => holds.delete(id) });
    holds.set(id, release);
    return release;
  };

  /** @returns {{ at: number, restore: () => void }} */
  const takeAnchor = () => {
    anchor = { at: performance.now(), restore: snapshotScroll(el) };
    return anchor;
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
    const fresh = anchor && performance.now() - anchor.at < hold ? anchor : takeAnchor();
    return fresh.restore;
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

    /**
     * 快照 → 执行动作 → 钉住。返回动作的返回值
     * @template T
     * @param {() => T} action
     * @returns {T}
     */
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
 * @param {{ hold?: number }} [options] 透传给 `createScrollPin`
 */
export function attachFloatingScrollGuard(host, panel, options) {
  const pin = createScrollPin(host, options);
  const remember = () => pin.remember();
  const hold = () => pin.hold();

  /* beforetoggle 在状态变化之前触发，浏览器的 light dismiss / Esc 也会发它 ——
     那一刻才拿得到"原来的位置"，等 toggle 已经晚了 */
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
