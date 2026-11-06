const HERE = new URL('.', import.meta.url);

const SHEETS = ['../packages/boot/mosaic.css', '../packages/boot/shadow-base.css'].map(
  (f) => new URL(f, HERE).href,
);

/**
 * @type {CSSStyleSheet[] | null}
 */
let loaded = null;

/**
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
  loaded = await Promise.all(SHEETS.map(loadSheet));
} catch (err) {
  console.error(
    '[mosaic] 样式表加载失败，组件将退化为"有颜色无排布"：\n' +
      '        文档站的工具类不会生效，请检查 docs/adopt-styles.js 与 packages/boot/mosaic.css 的路径。',
    err,
  );
}

if (loaded) {
  for (const root of pending) adopt(root);
  pending.clear();

  /** @param {Element | ShadowRoot} node */
  const walk = (node) => {
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
