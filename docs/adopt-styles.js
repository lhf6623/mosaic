/**
 * adopt-styles.js —— 文档站自己的样式注入器（站点资产，不随组件发布）：库里的组件自带 component-base.css，但文档站自己的 shadow 组件吃的是页面级 mosaic.css，而文档级 <link> 进不去 shadow root。
 * ⚠️ 补丁必须在任何 shadow root 建起来之前装好（本模块顶层即执行），所以 index.html 里要排在 ofa.js 之后。
 */

const HERE = new URL('.', import.meta.url);

/** 顺序有讲究：mosaic.css 顶部的 @layer 层序声明钉死整个层顺序；shadow-base.css 绝不能 <link> 到宿主页面。 */
const SHEETS = ['../packages/boot/mosaic.css', '../packages/boot/shadow-base.css'].map(
  (f) => new URL(f, HERE).href,
);

/**
 * 已加载的样式表；null 表示还在路上或加载失败
 * @type {CSSStyleSheet[] | null}
 */
let loaded = null;

/**
 * 样式表就绪之前创建的 shadow root，先收着，稍后补 adopt
 * @type {Set<ShadowRoot>}
 */
const pending = new Set();

const nativeAttach = Element.prototype.attachShadow;

/** @param {ShadowRootInit} init */
Element.prototype.attachShadow = function (init) {
  const root = nativeAttach.call(this, init);
  if (!init || init.mode !== 'open') return root;
  if (loaded) adopt(root);
  else pending.add(root);
  return root;
};

/** @param {ShadowRoot} root */
function adopt(root) {
  if (!loaded) return;
  if (root.adoptedStyleSheets.includes(loaded[0])) return;
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...loaded];
}

/**
 * @param {string} url
 * @returns {Promise<CSSStyleSheet>}
 */
async function loadSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`取 ${url} 失败：HTTP ${res.status}`);
  const sheet = new CSSStyleSheet();
  await sheet.replace(await res.text());
  return sheet;
}

try {
  // 命中页面里 <link href="mosaic.css"> 建立的 HTTP 缓存，不会第二次下载
  loaded = await Promise.all(SHEETS.map(loadSheet));
} catch (err) {
  // 刻意不 rethrow：样式加载失败不该让整页崩掉，只是退化为"有颜色无排布"
  console.error(
    '[mosaic] 样式表加载失败，组件将退化为"有颜色无排布"：\n' +
      '        文档站的工具类不会生效，请检查 docs/adopt-styles.js 与 packages/boot/mosaic.css 的路径。',
    err,
  );
}

if (loaded) {
  for (const root of pending) adopt(root);
  pending.clear();

  // 补扫：补丁装上之前就创建好的 shadow root。querySelectorAll 不跨边界，只能递归
  /** @param {Element | ShadowRoot} node */
  const walk = (node) => {
    // ShadowRoot 自己没有 shadowRoot —— 只有 Element 那条路要看它
    const sr = node instanceof ShadowRoot ? null : node.shadowRoot;
    if (sr) {
      adopt(sr);
      walk(sr);
    }
    for (const el of node.querySelectorAll('*')) {
      if (el.shadowRoot) {
        adopt(el.shadowRoot);
        walk(el.shadowRoot);
      }
    }
  };
  walk(document.documentElement);
}
