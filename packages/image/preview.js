/**
 * 预览浮层 —— 文档级单例，不是标签、不进 api.md。
 *
 * 谁打开它：`mc-image` 点击（单张 / 组内整组）、`mc-image-preview` 的 `open()` 与 `trigger`。
 * 所以这里只收「要显示的列表 + 起点」，「从哪儿来」它不关心：成员既可以是 DOM 元素
 * （读 src / alt 属性），也可以是 `{ src, alt }` 字面量（无渲染的 mc-image-preview 用这种）。
 *
 * 为什么单例：一个页面可能有很多张图，每张各带一层会叠成迷宫；而「上一张 / 下一张」
 * 必须只有**一个**游标。所以浮层只在第一次打开时建一次，打开时把「列表 + 起点」交给它：
 * mc-image 给单张，图片组里的 mc-image 给整组成员（见 image.html 的 previewItems）。
 *
 * 为什么挂在 document.body 而不是组件的 shadow root 里：top layer 里的浮层不该被宿主
 * 的 overflow / transform 裁切 —— 挂在 shadow 里就得处理宿主祖先的裁切与层叠上下文。
 *
 * 工具条全在底部一条：导航（组才有）、缩放、旋转、还原、下载、关闭。四个角不放按钮 ——
 * 一个浮层只给一套控制面，位置固定，闭着眼睛也能摸到同一排。
 * 图放大到超出框之后可以按住拖动（pointer 事件 + 指针捕获，位移夹在「框不露黑边」的范围里）。
 */

/**
 * 浮层的当前状态：列表 + 游标 + 关闭后要还焦点 / 回调的那两个。
 * @typedef {object} PreviewItem
 * @property {string} src 图片地址（相对本页解析）
 * @property {string} alt 说明文字；打不开时也用它当兜底
 *
 * @typedef {object} PreviewState
 * @property {PreviewItem[]} items 这次可切换的图片（按显示顺序，已归一成 {src, alt}）
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
 * @property {HTMLElement} frame 图片的定位框（换约束时量它，而不是量带内边距的 stage）
 * @property {HTMLImageElement} img
 * @property {HTMLElement} fallback
 * @property {HTMLElement} count
 * @property {HTMLElement} zoomValue
 * @property {HTMLButtonElement} prev
 * @property {HTMLButtonElement} next
 * @property {HTMLButtonElement} zoomIn
 * @property {HTMLButtonElement} zoomOut
 * @property {HTMLButtonElement} rotateLeft
 * @property {HTMLButtonElement} rotateRight
 * @property {HTMLButtonElement} reset
 * @property {HTMLButtonElement} download
 * @property {HTMLButtonElement} close
 * @property {number} zoom 缩放档位（ZOOM_STEPS 的下标，不是倍数）
 * @property {number} angle 旋转角度（0 / 90 / 180 / 270）
 * @property {{ x: number, y: number }} pan 拖动位移（框的坐标系，已夹在可拖范围内）
 * @property {{ id: number, x: number, y: number, from: { x: number, y: number }, bounds: { x: number, y: number }, moved: boolean } | null} drag
 *   正在进行的拖动（指针 id + 起点 + 起始位移 + 当次可拖范围）
 * @property {number} dragEndedAt 上一次「真的拖动了」的时间戳：用来吃掉紧跟其后那次 click
 * @property {PreviewState | null} state
 * @property {boolean} popoverOk 浏览器支不支持 popover API
 */

/**
 * @typedef {object} PreviewOptions
 * @property {(Element | PreviewItem)[]} [items] 图片列表：元素读 src / alt 属性，字面量直接用
 * @property {number} [index] 从第几张开始：越界夹到两端，非数字当 0（归一在 openPreview 里做一次）
 * @property {boolean} [loop] 到头绕回第一张
 * @property {HTMLElement | null} [opener] 触发元素：关闭时焦点还给它
 * @property {(() => void) | null} [onClose] 关闭后回调
 */

/** 缩放档位：1 是「按框大小」的原样，两端各留余量 */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4];
/** 还原之后回到的档位（1 倍） */
const ZOOM_HOME = ZOOM_STEPS.indexOf(1);

/**
 * 角度折回 (-180, 180]：与传入值**视觉等价**，只用来回答「现在是不是正的」。
 * 旋转本身不取模 —— 见 rotateBy 的注释。
 * @param {number} deg
 */
const foldDeg = (deg) => (((deg % 360) + 540) % 360) - 180;

/**
 * 布尔属性看「在不在」，`="false"` 不算真（同 README 1.4 的 boolAttr）：
 * ofa 的布尔绑定把 `false` 写成 `attr="false"`，不这样读，`:x="false"` 就会反过来生效。
 * @param {Element} el
 * @param {string} name 属性名（带连字符的照写）
 */
export const boolAttr = (el, name) => {
  const raw = el.getAttribute(name);
  return raw !== null && raw !== 'false';
};

/**
 * 组里能进相册的成员：组内的 `mc-image`，且没写 `preview-disabled`，按 DOM 顺序。
 * 组自己（`mc-image-group`）不存这个名单 —— 谁问都现算，成员增删不用同步。
 * @param {Element | null | undefined} group
 * @returns {Element[]}
 */
export function groupImages(group) {
  if (!group) return [];
  return [...group.querySelectorAll('mc-image')].filter((el) => !boolAttr(el, 'preview-disabled'));
}

/**
 * 当前焦点元素；body / html 不算（那等于「没有」）。
 * 一路钻进 shadow：点 `<mc-button>` 这类组件时 `document.activeElement` 是宿主，
 * 真正能接收焦点的往往是里面那个 `button`。
 * @returns {Element | null}
 */
export function focusedElement() {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el && el !== document.body && el !== document.documentElement ? el : null;
}

const STYLE = `
.mc-image-viewer {
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
.mc-image-viewer:popover-open,
.mc-image-viewer[data-show] {
  display: flex;
  align-items: center;
  justify-content: center;
}
.mc-image-viewer[data-show] {
  z-index: 2147483000;
}

/* 舞台：上下留出工具条的高度，图片永远压在工具条之上不会挡住它 */
.mcp-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 48px 24px 104px;
}
.mcp-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.mcp-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  transform-origin: center center;
  transition: transform 0.18s ease;
  will-change: transform;
}
/* 折算角度 / 换图归位时临时关掉过渡：这是「把数值换成等价值」，不该演成一次旋转 */
.mcp-img.mcp-no-anim {
  transition: none;
}
/* 拖动中：过渡先停 —— 开着 0.18s ease 的话图永远慢半拍，像在追指针 */
.mc-image-viewer.mcp-dragging .mcp-img {
  transition: none;
}
/* 只有「图比框大」才有得拖：给抓取光标，并把触摸手势吃掉，否则手机上拖动会先把底下的页面滚一下 */
.mc-image-viewer[data-pannable] .mcp-frame {
  cursor: grab;
  touch-action: none;
}
.mc-image-viewer.mcp-dragging .mcp-frame {
  cursor: grabbing;
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
.mc-image-viewer[data-error] .mcp-img {
  display: none;
}
.mc-image-viewer[data-error] .mcp-fallback {
  display: block;
}

/* 底部工具条：一条，圆角胶囊，浮在遮罩上 */
.mcp-bar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px;
  box-sizing: border-box;
  max-width: calc(100vw - 24px);
  padding: 6px 8px;
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: var(--mc-radius-full, 999px);
  background-color: rgb(28 28 30 / 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transform: translateX(-50%);
}
.mcp-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}
.mcp-sep {
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background-color: rgb(255 255 255 / 0.16);
}
.mcp-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: var(--mc-radius-full, 999px);
  background-color: transparent;
  color: #fff;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    opacity 0.15s ease;
}
.mcp-btn:hover:not(:disabled) {
  background-color: rgb(255 255 255 / 0.16);
}
.mcp-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.mcp-btn:disabled {
  opacity: 0.32;
  cursor: default;
}
.mcp-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mcp-count {
  min-width: 46px;
  color: rgb(255 255 255 / 0.8);
  font-size: var(--mc-text-xs, 12px);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  text-align: center;
}
.mcp-zoom-value {
  min-width: 44px;
  color: rgb(255 255 255 / 0.8);
  font-size: var(--mc-text-xs, 12px);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

/* 只有一张时：导航与页码都没有意义，藏掉而不是禁用 */
.mc-image-viewer[data-single] .mcp-nav,
.mc-image-viewer[data-single] .mcp-sep-nav {
  display: none;
}

@media (max-width: 640px) {
  .mcp-stage {
    padding: 40px 8px 112px;
  }
  .mcp-bar {
    bottom: 12px;
    padding: 5px 6px;
    gap: 0;
  }
  .mcp-btn {
    width: 32px;
    height: 32px;
  }
  .mcp-sep {
    margin: 0 3px;
  }
}

@keyframes mcp-fade-in {
  from {
    opacity: 0;
  }
}
.mc-image-viewer:popover-open {
  animation: mcp-fade-in 0.16s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .mc-image-viewer:popover-open {
    animation: none;
  }
  .mcp-img {
    transition: none;
  }
}
`;

const ICON = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  zoomOut:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/><path d="M8 11h6"/></svg>',
  zoomIn:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/><path d="M8 11h6"/><path d="M11 8v6"/></svg>',
  rotateLeft:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4v5h5"/></svg>',
  rotateRight:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/></svg>',
  reset:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5"/><path d="M15 4h5v5"/><path d="M15 20h5v-5"/><path d="M9 20H4v-5"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

/** 下载时按 MIME 定后缀；拿不到 blob 就退回看地址 @type {Record<string, string>} */
const EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
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
 * 归一成 {src, alt}：DOM 元素读属性（mc-image / 图片组），字面量直接用
 * （不渲染的 mc-image-preview 给的就是字面量）。
 * @param {Element | PreviewItem} item
 * @returns {PreviewItem}
 */
const toItem = (item) => {
  if (!item) return { src: '', alt: '' };
  if (item instanceof Element)
    return { src: item.getAttribute('src') ?? '', alt: item.getAttribute('alt') ?? '' };
  return { src: item.src ?? '', alt: item.alt ?? '' };
};

/**
 * 下载文件名：拿 alt 当前缀（换成连字符，去掉路径非法字符），后缀按 blob 的 MIME 补齐。
 * @param {string} src
 * @param {string} alt
 * @param {string} [type]
 * @returns {string}
 */
function fileName(src, alt, type) {
  const stem =
    (alt || '图片')
      .replace(/[\\/:*?"<>|\s]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || '图片';
  const fromUrl = (
    src
      .split('?')[0]
      .split('#')[0]
      .match(/\.([a-z0-9]+)$/i)?.[1] ?? ''
  ).toLowerCase();
  const ext = EXT[type ?? ''] ?? (fromUrl || 'jpg');
  return `${stem}.${ext}`;
}

/** @returns {PreviewView} */
function ensureViewer() {
  if (view) return view;

  const style = document.createElement('style');
  style.setAttribute('data-mc-image-viewer-style', '');
  style.textContent = STYLE;
  document.head.append(style);

  const root = document.createElement('div');
  root.className = 'mc-image-viewer';
  root.setAttribute('popover', 'manual');
  root.setAttribute('data-mc-image-viewer', '');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '图片预览');
  root.innerHTML =
    '<div class="mcp-stage">' +
    '<div class="mcp-frame"><img class="mcp-img" alt="" draggable="false" /></div>' +
    '<p class="mcp-fallback"></p>' +
    '</div>' +
    '<div class="mcp-bar" role="toolbar" aria-label="预览工具">' +
    '<div class="mcp-nav">' +
    `<button class="mcp-btn mcp-prev" type="button" aria-label="上一张" title="上一张（←）">${ICON.prev}</button>` +
    '<span class="mcp-count" aria-live="polite"></span>' +
    `<button class="mcp-btn mcp-next" type="button" aria-label="下一张" title="下一张（→）">${ICON.next}</button>` +
    '</div>' +
    '<span class="mcp-sep mcp-sep-nav" aria-hidden="true"></span>' +
    `<button class="mcp-btn mcp-zoom-out" type="button" aria-label="缩小" title="缩小（-）">${ICON.zoomOut}</button>` +
    '<span class="mcp-zoom-value" aria-live="polite">100%</span>' +
    `<button class="mcp-btn mcp-zoom-in" type="button" aria-label="放大" title="放大（+）">${ICON.zoomIn}</button>` +
    '<span class="mcp-sep" aria-hidden="true"></span>' +
    `<button class="mcp-btn mcp-rotate-left" type="button" aria-label="向左旋转" title="向左旋转">${ICON.rotateLeft}</button>` +
    `<button class="mcp-btn mcp-rotate-right" type="button" aria-label="向右旋转" title="向右旋转（R）">${ICON.rotateRight}</button>` +
    `<button class="mcp-btn mcp-reset" type="button" aria-label="还原图像大小" title="还原（0）">${ICON.reset}</button>` +
    '<span class="mcp-sep" aria-hidden="true"></span>' +
    `<button class="mcp-btn mcp-download" type="button" aria-label="下载" title="下载">${ICON.download}</button>` +
    `<button class="mcp-btn mcp-close" type="button" aria-label="关闭预览" title="关闭（Esc）">${ICON.close}</button>` +
    '</div>';
  document.body.append(root);

  /** @type {PreviewView} */
  const v = {
    root,
    stage: /** @type {HTMLElement} */ (root.querySelector('.mcp-stage')),
    frame: /** @type {HTMLElement} */ (root.querySelector('.mcp-frame')),
    img: /** @type {HTMLImageElement} */ (root.querySelector('.mcp-img')),
    fallback: /** @type {HTMLElement} */ (root.querySelector('.mcp-fallback')),
    count: /** @type {HTMLElement} */ (root.querySelector('.mcp-count')),
    zoomValue: /** @type {HTMLElement} */ (root.querySelector('.mcp-zoom-value')),
    prev: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-prev')),
    next: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-next')),
    zoomIn: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-zoom-in')),
    zoomOut: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-zoom-out')),
    rotateLeft: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-rotate-left')),
    rotateRight: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-rotate-right')),
    reset: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-reset')),
    download: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-download')),
    close: /** @type {HTMLButtonElement} */ (root.querySelector('.mcp-close')),
    zoom: ZOOM_HOME,
    angle: 0,
    pan: { x: 0, y: 0 },
    drag: null,
    dragEndedAt: 0,
    state: null,
    popoverOk: typeof root.showPopover === 'function',
  };
  view = v;

  // 地址坏掉时把说明顶上来（不然只是一块黑），工具也跟着停用
  v.img.addEventListener('load', () => {
    if (!v.state) return;
    root.removeAttribute('data-error');
    applyTransform();
  });
  v.img.addEventListener('error', () => {
    if (!v.state) return;
    root.setAttribute('data-error', '');
    syncTools();
  });

  root.addEventListener('click', (event) => {
    /* 拖动结束会紧跟一次 click：落在框上就会把浮层关掉。刚真的拖过（250ms 内）就吃掉这一次 ——
       判断放在关闭之前，且判完立刻清零，免得后续一次正常点击也被连累。 */
    const dragged = v.dragEndedAt > 0 && performance.now() - v.dragEndedAt < 250;
    v.dragEndedAt = 0;
    if (dragged) return;

    // 点图片本体不算关闭；点遮罩 / 框里的留白才算
    const target = event.target;
    if (target === root || target === v.stage || target === v.frame) closePreview();
  });
  // 拖动平移：按下 / 移动 / 松开都在框上（捕获之后事件只来这儿，拖出框也不断）
  v.frame.addEventListener('pointerdown', onDragStart);
  v.frame.addEventListener('pointermove', onDragMove);
  v.frame.addEventListener('pointerup', onDragEnd);
  v.frame.addEventListener('pointercancel', onDragEnd);
  // 捕获被系统收走（切窗口 / 指针消失）时也要收尾，否则光标会一直停在「捏住」
  v.frame.addEventListener('lostpointercapture', onDragEnd);
  root.addEventListener('keydown', onKeydown);
  root.addEventListener('wheel', onWheel, { passive: false });
  v.frame.addEventListener('dblclick', (event) => {
    if (event.target !== v.img || !v.state) return;
    event.preventDefault();
    v.zoom = v.zoom === ZOOM_HOME ? ZOOM_STEPS.indexOf(2) : ZOOM_HOME;
    applyTransform();
  });
  // 浏览器自带的 Esc 也会关 popover —— 统一在 toggle 里收尾，别让两条路径各清一次状态
  root.addEventListener('toggle', (event) => {
    const next = /** @type {any} */ (event).newState;
    if (next === 'closed') finish();
  });
  // 窗口尺寸变了，旋转 90° 的约束得重算
  window.addEventListener('resize', () => {
    if (v.state) applyTransform();
  });

  v.prev.addEventListener('click', () => step(-1));
  v.next.addEventListener('click', () => step(1));
  v.zoomIn.addEventListener('click', () => zoomBy(1));
  v.zoomOut.addEventListener('click', () => zoomBy(-1));
  v.rotateLeft.addEventListener('click', () => rotateBy(-90));
  v.rotateRight.addEventListener('click', () => rotateBy(90));
  v.reset.addEventListener('click', () => resetView());
  v.download.addEventListener('click', () => downloadImage());
  v.close.addEventListener('click', () => closePreview());
  return v;
}

/** @param {KeyboardEvent} event */
function onKeydown(event) {
  if (!view?.state) return;
  const key = event.key;
  if (key === 'Escape') {
    event.preventDefault();
    closePreview();
    return;
  }
  if (key === 'ArrowLeft') {
    event.preventDefault();
    step(-1);
    return;
  }
  if (key === 'ArrowRight') {
    event.preventDefault();
    step(1);
    return;
  }
  // 下面几个是工具：+ / - / 0 还原 / R 旋转（Shift+R 反向）
  if (key === '+' || key === '=') {
    event.preventDefault();
    zoomBy(1);
    return;
  }
  if (key === '-' || key === '_') {
    event.preventDefault();
    zoomBy(-1);
    return;
  }
  if (key === '0') {
    event.preventDefault();
    resetView();
    return;
  }
  if (key === 'r' || key === 'R') {
    event.preventDefault();
    rotateBy(event.shiftKey ? -90 : 90);
  }
}

/** 滚轮缩放；浮层里没有别的东西可滚，直接吃掉滚轮 @param {WheelEvent} event */
function onWheel(event) {
  if (!view?.state) return;
  event.preventDefault();
  zoomBy(event.deltaY < 0 ? 1 : -1);
}

/** @param {number} delta 档位增量 */
function zoomBy(delta) {
  const v = view;
  if (!v?.state || v.root.hasAttribute('data-error')) return;
  const next = clamp(v.zoom + delta, 0, ZOOM_STEPS.length - 1);
  if (next === v.zoom) return;
  v.zoom = next;
  applyTransform();
}

/** @param {number} deg 旋转增量（±90） */
function rotateBy(deg) {
  const v = view;
  if (!v?.state || v.root.hasAttribute('data-error')) return;
  /* 角度要**累加**，不能取模。transform 的过渡按数值插值：从 `rotate(0deg)` 到
     `rotate(270deg)` 浏览器会顺时针转 3/4 圈 —— 看着就像「按左转却右转了好几圈」。
     累加则每步只差 ±90，方向永远和按钮一致；数值攒大了由 resetView 折回等价值。 */
  v.angle += deg;
  applyTransform();
}

/** 还原：缩放回 1 倍、角度归零 */
function resetView() {
  const v = view;
  if (!v) return;
  /* 连点几次左转后 angle 可能是 -450：直接写 0 会逆时针转一圈多。
     先把数值折回等价值（画面不变、关掉过渡瞬移），动画就从 -90 起步，只转 90°。 */
  const folded = foldDeg(v.angle);
  if (folded !== v.angle) {
    v.img.classList.add('mcp-no-anim');
    v.angle = folded;
    applyTransform();
    void v.img.offsetWidth; // 强制落一帧，折算才在动画起点生效
    v.img.classList.remove('mcp-no-anim');
  }
  v.zoom = ZOOM_HOME;
  v.angle = 0;
  v.pan.x = 0;
  v.pan.y = 0;
  applyTransform();
}

/**
 * 把当前位移 / 缩放 / 旋转拼成一条 transform。
 * 顺序有讲究：`translate3d` 写在**最左边**，它就是「在框的坐标系里挪」；写在右边会被
 * 旋转与缩放一起放大 —— 转 90° 之后横向拖动会变成上下动。
 * @param {PreviewView} v
 */
const transformOf = (v) =>
  `translate3d(${v.pan.x}px, ${v.pan.y}px, 0) rotate(${v.angle}deg) scale(${ZOOM_STEPS[v.zoom]})`;

/**
 * 可拖的余量：图片（旋转 + 缩放后）的外接框超出框的部分，各轴各一半（居中时位移是 0）。
 * 图比框小的那个轴恒为 0 —— 否则一张正好尺寸的图能被拖进黑边里，越拖越歪。
 * 外接框按旋转后的宽高算：`w·|cos| + h·|sin|`，转 90° 就等于把宽高对调。
 * @returns {{ x: number, y: number }}
 */
function panBounds() {
  const v = view;
  if (!v) return { x: 0, y: 0 };
  const scale = ZOOM_STEPS[v.zoom];
  const rad = (v.angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // offsetWidth / Height 是**布局**尺寸（不含 transform），正好当未变换的宽高用
  const w = v.img.offsetWidth;
  const h = v.img.offsetHeight;
  const box = v.frame.getBoundingClientRect();
  return {
    x: Math.max(0, ((w * cos + h * sin) * scale - box.width) / 2),
    y: Math.max(0, ((w * sin + h * cos) * scale - box.height) / 2),
  };
}

/**
 * 按住拖动平移。用 pointer 事件 + 指针捕获：鼠标 / 手指 / 触控笔一套代码，
 * 拖出框外、拖到工具条上也不会断（捕获之后事件只来这一处）。
 * 图没超出框时直接放行 —— 这时拖不出任何内容，那次点击该留给「点遮罩关闭」。
 * @param {PointerEvent} event
 */
function onDragStart(event) {
  const v = view;
  if (!v?.state || v.root.hasAttribute('data-error')) return;
  if (!event.isPrimary || event.button !== 0) return;
  const bounds = panBounds();
  if (!bounds.x && !bounds.y) return;

  v.drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    from: { ...v.pan },
    bounds, // 拖动期间范围不会变，量一次就够（省掉每个 pointermove 一次强制布局）
    moved: false,
  };
  v.root.classList.add('mcp-dragging');
  event.preventDefault();
  try {
    v.frame.setPointerCapture(event.pointerId);
  } catch {
    // 指针已经抬起来了（合成事件 / 极快的点击）：不捕获也能拖，只是拖出框会断
  }
}

/** @param {PointerEvent} event */
function onDragMove(event) {
  const v = view;
  const d = v?.drag;
  if (!v || !d || event.pointerId !== d.id) return;
  const dx = event.clientX - d.x;
  const dy = event.clientY - d.y;
  if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
  v.pan.x = clamp(d.from.x + dx, -d.bounds.x, d.bounds.x);
  v.pan.y = clamp(d.from.y + dy, -d.bounds.y, d.bounds.y);
  // 拖动中只写 transform：不走 applyTransform（那会再量一次布局、刷一遍按钮态）
  v.img.style.transform = transformOf(v);
}

/** @param {PointerEvent} [event] */
function onDragEnd(event) {
  const v = view;
  const d = v?.drag;
  if (!v || !d || (event && event.pointerId !== d.id)) return;
  v.drag = null;
  v.root.classList.remove('mcp-dragging');
  /* 拖完紧跟一次 click，落在框上就会把浮层关掉 —— 记下时间戳，让那次点击失效。
     没真挪动（只是点了一下）就不记，遮罩点击照常关闭。 */
  if (d.moved) v.dragEndedAt = performance.now();
  applyTransform();
}

/**
 * 把当前缩放 / 旋转 / 位移落到 img 上。
 * 转 90 / 270 时画面横竖换了，`max-*` 约束得跟着换，否则长边会顶出框。
 */
function applyTransform() {
  const v = view;
  if (!v) return;

  const turned = foldDeg(v.angle) % 180 !== 0;
  const rect = v.frame.getBoundingClientRect();
  if (rect.width && rect.height) {
    v.img.style.maxWidth = turned ? `${rect.height}px` : '';
    v.img.style.maxHeight = turned ? `${rect.width}px` : '';
  }

  /* 缩放 / 旋转 / 换图都会改可拖的余量：先把位移夹回新范围（缩小后自动回到中间），
     再落变换 —— 顺序反了会先画到框外再弹回来。 */
  const bounds = panBounds();
  v.pan.x = clamp(v.pan.x, -bounds.x, bounds.x);
  v.pan.y = clamp(v.pan.y, -bounds.y, bounds.y);
  v.root.toggleAttribute('data-pannable', bounds.x > 0 || bounds.y > 0);

  v.img.style.transform = transformOf(v);
  syncTools();
}

/** 工具按钮的禁用态与百分比回显 */
function syncTools() {
  const v = view;
  if (!v) return;
  const broken = v.root.hasAttribute('data-error');
  const scale = ZOOM_STEPS[v.zoom];
  v.zoomValue.textContent = `${Math.round(scale * 100)}%`;
  v.zoomIn.disabled = broken || v.zoom >= ZOOM_STEPS.length - 1;
  v.zoomOut.disabled = broken || v.zoom <= 0;
  v.rotateLeft.disabled = broken;
  v.rotateRight.disabled = broken;
  v.reset.disabled =
    broken || (v.zoom === ZOOM_HOME && foldDeg(v.angle) === 0 && !v.pan.x && !v.pan.y);
  v.download.disabled = broken;
}

/**
 * 落到第 index 张：改地址 + 说明 + 页码 + 两端的禁用态（换图时缩放与角度归位）
 * @param {number} index
 */
function paint(index) {
  const v = view;
  const state = v?.state;
  if (!v || !state) return;

  const { items, loop } = state;
  const last = items.length - 1;
  const i = loop ? (index + items.length) % items.length : clamp(index, 0, last);
  state.index = i;

  const { src, alt } = items[i];
  v.root.removeAttribute('data-error');
  v.img.setAttribute('src', src);
  v.img.alt = alt;
  v.fallback.textContent = alt || '图片打不开';
  v.count.textContent = items.length > 1 ? `${i + 1} / ${items.length}` : '';
  v.root.toggleAttribute('data-single', items.length < 2);
  v.prev.disabled = !loop && i === 0;
  v.next.disabled = !loop && i === last;

  // 换图时缩放 / 角度 / 位移一起归位：上一张的放大和拖到哪儿，带到下一张毫无道理
  v.img.classList.add('mcp-no-anim');
  v.zoom = ZOOM_HOME;
  v.angle = 0;
  v.pan.x = 0;
  v.pan.y = 0;
  applyTransform();
  void v.img.offsetWidth;
  v.img.classList.remove('mcp-no-anim');
}

/** @param {number} delta */
function step(delta) {
  const state = view?.state;
  if (!state) return;
  const next = state.index + delta;
  if (!state.loop && (next < 0 || next >= state.items.length)) return;
  paint(next);
}

/**
 * 下载当前这张：先 fetch 成 blob 再存（`download` 属性只对同源地址生效，跨域直接点会变成跳转）。
 * 拿不到 blob（跨域没开 CORS / 离线）就退回新标签页打开，别让按钮变成哑巴。
 */
async function downloadImage() {
  const v = view;
  const state = v?.state;
  if (!v || !state) return;
  const { src, alt } = state.items[state.index];
  if (!src) return;

  /** @param {string} href @param {string} name */
  const save = (href, name) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
  };

  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    save(url, fileName(src, alt, blob.type));
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName(src, alt);
    a.target = '_blank';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
  }
}

/** 收尾（幂等）：清状态、还焦点、回调 —— 四条关闭路径（按钮 / Esc / 点遮罩 / 浏览器关 popover）都汇到这里 */
function finish() {
  const v = view;
  const state = v?.state;
  if (!v || !state) return;

  v.state = null;
  v.drag = null;
  v.root.removeAttribute('data-show');
  v.root.removeAttribute('data-error');
  v.root.removeAttribute('data-pannable');
  v.root.classList.remove('mcp-dragging');
  v.img.removeAttribute('src');
  v.img.style.transform = '';
  v.img.style.maxWidth = '';
  v.img.style.maxHeight = '';
  v.zoom = ZOOM_HOME;
  v.angle = 0;
  v.pan.x = 0;
  v.pan.y = 0;
  v.dragEndedAt = 0;

  const { opener, onClose } = state;
  /* 还焦点：popover 隐藏后浏览器自己那趟焦点清理在下一帧才落定，同步 focus 会被它盖掉。
     所以排一帧再还；这中间要是已经开了另一张，就别抢人家的焦点。setTimeout 那句是给
     「文档不可见 → rAF 不跑」留的兜底，重复 focus 同一元素没有副作用。 */
  if (opener?.isConnected) {
    const giveBack = () => {
      if (!view?.state && opener.isConnected) opener.focus({ preventScroll: true });
    };
    requestAnimationFrame(giveBack);
    setTimeout(giveBack, 0);
  }
  onClose?.();
}

/**
 * 打开预览。
 *
 * `open` 事件的载荷 `{ src, index, total }` **只在这里生成**：滤掉空 src、夹取起点之后
 * 外面已经算不准最终是第几张（列表可能被过滤、index 可能越界），所以把归一结果交回去，
 * 两个入口（mc-image、mc-image-preview）直接拿它发事件，不各自再拼一遍。
 * @param {PreviewOptions} [options]
 * @returns {{ src: string, index: number, total: number } | null} 归一后的起点；一张图都没有时为 null
 */
export function openPreview(options = {}) {
  const { items = [], index = 0, loop = false, opener = null, onClose = null } = options;
  const list = items.map(toItem).filter((item) => item.src.trim());
  if (!list.length) return null;

  // 起点归一：越界夹到两端、小数取整、非数字当 0 —— 调用点不用各夹一遍
  const start = clamp(Math.trunc(Number(index)) || 0, 0, list.length - 1);

  const v = ensureViewer();
  v.state = { items: list, index: start, loop: !!loop, opener, onClose };
  paint(start);

  if (v.popoverOk) {
    if (!v.root.matches(':popover-open')) v.root.showPopover();
  } else {
    v.root.setAttribute('data-show', '');
  }
  // 浮层刚可见时 frame 才量得到尺寸（旋转过的图要靠它算约束），这里补一次
  applyTransform();
  v.close.focus({ preventScroll: true });

  // paint 之后以 state.index 为准：loop 下 paint 还会再折一次（起点已在范围内，这里只是不假设）
  const at = v.state.index;
  return { src: list[at].src, index: at, total: list.length };
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
