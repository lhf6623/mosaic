/**
 * mc-image 的预览浮层 —— 文档级单例，不是标签、不进 api.md。
 *
 * 为什么单例：一个页面可能有很多张图，每张各带一层会叠成迷宫；而「上一张 / 下一张」
 * 必须只有**一个**游标。所以浮层只在第一次打开时建一次，打开时把「列表 + 起点」交给它：
 * mc-image 给单张，图片组里的 mc-image 给整组成员（见 image.html 的 previewItems）。
 *
 * 为什么挂在 document.body 而不是组件的 shadow root 里：top layer 里的浮层不该被宿主
 * 的 overflow / transform 裁切 —— 挂在 shadow 里就得处理宿主祖先的裁切与层叠上下文。
 */

/**
 * 浮层的当前状态：列表 + 游标 + 关闭后要还焦点 / 回调的那两个。
 * @typedef {object} PreviewState
 * @property {Element[]} items 这次可切换的图片元素（按显示顺序）
 * @property {number} index 当前第几张（0 起）
 * @property {boolean} loop 到头是否绕回第一张
 * @property {HTMLElement | null} opener 触发元素：关闭时焦点还给它
 * @property {(() => void) | null} onClose 关闭后的回调（组件拿它发 close 事件）
 */

/**
 * 单例里要动的节点。
 * @typedef {object} PreviewView
 * @property {HTMLElement} root
 * @property {HTMLElement} stage
 * @property {HTMLImageElement} img
 * @property {HTMLElement} fallback
 * @property {HTMLElement} count
 * @property {HTMLButtonElement} prev
 * @property {HTMLButtonElement} next
 * @property {HTMLButtonElement} close
 * @property {PreviewState | null} state
 * @property {boolean} popoverOk 浏览器支不支持 popover API
 */

/**
 * @typedef {object} PreviewOptions
 * @property {Element[]} [items] 图片元素列表（按显示顺序，读写它们的 src / alt）
 * @property {number} [index] 从第几张开始
 * @property {boolean} [loop] 到头绕回第一张
 * @property {HTMLElement | null} [opener] 触发元素：关闭时焦点还给它
 * @property {(() => void) | null} [onClose] 关闭后回调
 */

const STYLE = `
.mc-image-preview {
  position: fixed;
  inset: 0;
  width: auto;
  height: auto;
  margin: 0;
  padding: 0;
  border: 0;
  overflow: hidden;
  overscroll-behavior: contain;
  background-color: rgb(0 0 0 / 0.9);
  color: #fff;
  font-family: var(--mc-font-sans, system-ui, sans-serif);
  /* ⚠️ display 不能写在基类上：作者样式压得过 UA 的 [popover]:not(:popover-open){display:none}，
     写了就等于「一打开就常驻」。这里只给 :popover-open 与降级用的 [data-show]。 */
}
.mc-image-preview:popover-open,
.mc-image-preview[data-show] {
  display: flex;
  align-items: center;
  justify-content: center;
}
.mc-image-preview[data-show] {
  z-index: 2147483000;
}

.mcp-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 56px 80px;
}
.mcp-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}
.mcp-fallback {
  display: none;
  max-width: 32rem;
  color: rgb(255 255 255 / 0.72);
  font-size: var(--mc-text-sm, 14px);
  line-height: var(--mc-text-sm-lh, 1.5);
  text-align: center;
  overflow-wrap: anywhere;
}
.mc-image-preview[data-error] .mcp-img {
  display: none;
}
.mc-image-preview[data-error] .mcp-fallback {
  display: block;
}

.mcp-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: var(--mc-radius-full, 999px);
  background-color: rgb(255 255 255 / 0.14);
  color: #fff;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.mcp-btn:hover {
  background-color: rgb(255 255 255 / 0.26);
}
.mcp-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.mcp-btn:disabled {
  opacity: 0.32;
  cursor: default;
}
.mcp-btn:disabled:hover {
  background-color: rgb(255 255 255 / 0.14);
}
.mcp-btn svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.mcp-prev {
  top: 50%;
  left: 16px;
  transform: translateY(-50%);
}
.mcp-next {
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
}
.mcp-close {
  top: 16px;
  right: 16px;
}

.mcp-count {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgb(255 255 255 / 0.8);
  font-size: var(--mc-text-xs, 12px);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
/* 只有一张时：导航与页码都没有意义，藏掉而不是禁用 */
.mc-image-preview[data-single] .mcp-prev,
.mc-image-preview[data-single] .mcp-next,
.mc-image-preview[data-single] .mcp-count {
  display: none;
}

@media (max-width: 640px) {
  .mcp-stage {
    padding: 48px 12px;
  }
  .mcp-btn {
    width: 36px;
    height: 36px;
  }
  .mcp-prev {
    left: 8px;
  }
  .mcp-next {
    right: 8px;
  }
}

@keyframes mcp-fade-in {
  from {
    opacity: 0;
  }
}
.mc-image-preview:popover-open {
  animation: mcp-fade-in 0.16s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .mc-image-preview:popover-open {
    animation: none;
  }
}
`;

const ICON = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

/** 单例；null = 还没建过 @type {PreviewView | null} */
let view = null;

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/**
 * 图片元素里要显示的东西：地址取 src（相对本页解析），说明取 alt。
 * @param {Element} el
 * @returns {{ src: string, alt: string }}
 */
const readItem = (el) => ({
  src: el.getAttribute('src') ?? '',
  alt: el.getAttribute('alt') ?? '',
});

/** @returns {PreviewView} */
function ensureViewer() {
  if (view) return view;

  const style = document.createElement('style');
  style.setAttribute('data-mc-image-preview-style', '');
  style.textContent = STYLE;
  document.head.append(style);

  const root = document.createElement('div');
  root.className = 'mc-image-preview';
  root.setAttribute('popover', 'manual');
  root.setAttribute('data-mc-image-preview', '');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '图片预览');
  root.innerHTML =
    '<div class="mcp-stage">' +
    '<img class="mcp-img" alt="" />' +
    '<p class="mcp-fallback"></p>' +
    '</div>' +
    `<button class="mcp-btn mcp-prev" type="button" aria-label="上一张">${ICON.prev}</button>` +
    `<button class="mcp-btn mcp-next" type="button" aria-label="下一张">${ICON.next}</button>` +
    `<button class="mcp-btn mcp-close" type="button" aria-label="关闭">${ICON.close}</button>` +
    '<p class="mcp-count" aria-live="polite"></p>';
  document.body.append(root);

  /** @type {PreviewView} */
  const v = {
    root,
    stage: /** @type {HTMLElement} */ (root.querySelector('.mcp-stage')),
    img: /** @type {HTMLImageElement} */ (root.querySelector('.mcp-img')),
    fallback: /** @type {HTMLElement} */ (root.querySelector('.mcp-fallback')),
    count: /** @type {HTMLElement} */ (root.querySelector('.mcp-count')),
    prev: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-prev')),
    next: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-next')),
    close: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-close')),
    state: null,
    popoverOk: typeof root.showPopover === 'function',
  };
  view = v;

  // 地址坏掉时把说明顶上来（不然只是一块黑）
  v.img.addEventListener('load', () => {
    if (v.state) root.removeAttribute('data-error');
  });
  v.img.addEventListener('error', () => {
    if (v.state) root.setAttribute('data-error', '');
  });

  root.addEventListener('click', (event) => {
    // 点图片本体不算关闭；点遮罩 / 图片外的留白才算
    if (event.target === root || event.target === v.stage) closePreview();
  });
  root.addEventListener('keydown', onKeydown);
  // 浏览器自带的 Esc 也会关 popover —— 统一在 toggle 里收尾，别让两条路径各清一次状态
  root.addEventListener('toggle', (event) => {
    const next = /** @type {any} */ (event).newState;
    if (next === 'closed') finish();
  });

  v.prev.addEventListener('click', () => step(-1));
  v.next.addEventListener('click', () => step(1));
  v.close.addEventListener('click', () => closePreview());
  return v;
}

/** @param {KeyboardEvent} event */
function onKeydown(event) {
  if (!view?.state) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closePreview();
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    step(-1);
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    step(1);
  }
}

/** 落到第 index 张：改地址 + 说明 + 页码 + 两端的禁用态 @param {number} index */
function paint(index) {
  const v = view;
  const state = v?.state;
  if (!v || !state) return;

  const { items, loop } = state;
  const last = items.length - 1;
  const i = loop ? (index + items.length) % items.length : clamp(index, 0, last);
  state.index = i;

  const { src, alt } = readItem(items[i]);
  v.root.removeAttribute('data-error');
  v.img.setAttribute('src', src);
  v.img.alt = alt;
  v.fallback.textContent = alt || '图片打不开';
  v.count.textContent = items.length > 1 ? `${i + 1} / ${items.length}` : '';
  v.root.toggleAttribute('data-single', items.length < 2);
  v.prev.disabled = !loop && i === 0;
  v.next.disabled = !loop && i === last;
}

/** @param {number} delta */
function step(delta) {
  const state = view?.state;
  if (!state) return;
  const next = state.index + delta;
  if (!state.loop && (next < 0 || next >= state.items.length)) return;
  paint(next);
}

/** 收尾（幂等）：清状态、还焦点、回调 —— 三条关闭路径（× / Esc / 点遮罩）都汇到这里 */
function finish() {
  const v = view;
  const state = v?.state;
  if (!v || !state) return;

  v.state = null;
  v.root.removeAttribute('data-show');
  v.root.removeAttribute('data-error');
  v.img.removeAttribute('src');

  const { opener, onClose } = state;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  onClose?.();
}

/**
 * 打开预览。
 * @param {PreviewOptions} [options]
 */
export function openPreview(options = {}) {
  const { items = [], index = 0, loop = false, opener = null, onClose = null } = options;
  const list = items.filter((el) => el?.getAttribute('src'));
  if (!list.length) return;

  const v = ensureViewer();
  v.state = { items: list, index, loop: !!loop, opener, onClose };
  paint(index);

  if (v.popoverOk) {
    if (!v.root.matches(':popover-open')) v.root.showPopover();
  } else {
    v.root.setAttribute('data-show', '');
  }
  v.close.focus({ preventScroll: true });
}

/** 关闭预览；没打开时什么也不做 */
export function closePreview() {
  const v = view;
  if (!v?.state) return;
  if (v.popoverOk && v.root.matches(':popover-open')) v.root.hidePopover();
  else {
    v.root.removeAttribute('data-show');
    finish();
  }
}
