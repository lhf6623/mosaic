/**
 * mosaic.js — Mosaic 运行时引导
 *
 * 唯一的职责：把两份样式表 adopt 进每一个 shadow root，这样组件模板里写的工具类
 * （`class="flex gap-2"`）才生效 —— 文档级 `<link>` 的规则进不去 shadow root。
 *
 * 令牌（`--mc-*`）是自定义属性，天然跨 shadow 边界继承，所以令牌不需要本文件做任何事；
 * 这里 adopt 的另一份 shadow-base.css 是只能进 shadow root 的元素级 reset。
 * 由此有个降级性质：本文件失效时组件的颜色 / 尺寸照常，只有排布退化。
 *
 * 打 attachShadow 补丁的时机是关键：必须在任何组件实例化之前装好（本模块顶层即执行），
 * 所以文档里要把它放在 ofa.js **之后**。机制与取舍见 agent/plan/decisions.md 的 D3。
 */

const HERE = new URL('.', import.meta.url);

/**
 * 两份表的顺序有讲究：
 *   mosaic.css        令牌 + 工具类；它顶部的 @layer 层序声明钉死整个层顺序
 *   shadow-base.css   元素级 reset + 减弱动效；绝不能 <link> 到宿主页面
 */
const SHEETS = ['mosaic.css', 'shadow-base.css'].map((f) => new URL(f, HERE).href);

/** 已加载的样式表；null 表示还在路上或加载失败 */
let loaded = null;

/** 样式表就绪之前创建的 shadow root，先收着，稍后补 adopt */
const pending = new Set();

const nativeAttach = Element.prototype.attachShadow;

Element.prototype.attachShadow = function (init) {
  const root = nativeAttach.call(this, init);
  if (!init || init.mode !== 'open') return root;
  if (loaded) adopt(root);
  else pending.add(root);
  return root;
};

function adopt(root) {
  if (root.adoptedStyleSheets.includes(loaded[0])) return;
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...loaded];
}

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
      '        组件内部依赖的工具类不会生效，请检查 mosaic.js 与 mosaic.css 是否同目录。',
    err,
  );
}

if (loaded) {
  for (const root of pending) adopt(root);
  pending.clear();

  // 补扫：补丁装上之前就创建好的 shadow root。querySelectorAll 不跨边界，只能递归
  const walk = (node) => {
    const sr = node.shadowRoot;
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
