/**
 * mosaic.js — Mosaic 运行时引导
 *
 * 唯一的职责：把两份样式表 adopt 进每一个 shadow root。
 * 这样组件模板里写的工具类（`class="flex gap-2"`）才能生效。
 *
 * ── 为什么需要它 ────────────────────────────────────────────────────────
 *
 * ofa.js 的组件渲染是（packages/xhear/register.mjs:42）：
 *
 *     const root = ele.attachShadow({ mode: "open" });
 *     root.innerHTML = template.innerHTML;
 *
 * 也就是说**组件必定有 shadow root**，而文档级 `<link>` 的规则进不去。
 * 所以「在 `<head>` 挂一份 UnoCSS 产物」对组件内部完全无效。
 *
 * ── 为什么只需要处理工具类，不需要处理令牌 ──────────────────────────────
 *
 * 令牌（`--mc-*`）是自定义属性，**天然跨 shadow 边界继承** —— 只要文档里有
 * 一份 `:root { --mc-color-* }`，所有 shadow root 内部就能读到，零机制。
 *
 * 工具类是普通规则，进不去，这才需要本文件。
 *
 * 由此得到一个很有用的降级性质：**本文件失效时，组件的颜色、圆角、尺寸全部正常，
 * 只有工具类提供的排布会退化**。故障是分级的，不是全有全无。
 *
 * ── 为什么可以打 attachShadow 补丁 ─────────────────────────────────────
 *
 * ofa.js 是在组件构造器里同步调 `ele.attachShadow({mode:"open"})` 的，
 * 所以只要在**任何组件实例化之前**把补丁装好，之后创建的每个 shadow root
 * 都会在内容填充之前拿到样式表（adopted 表先于 innerHTML 里的 <style> 生效顺序
 * 由 @layer 统一，见 packages/color/tokens.css 顶部的层序声明）。
 *
 * 本模块是 ES module，顶层代码在模块求值时就执行 —— 把补丁放在顶部即可。
 * 文档里请把它放在 ofa.js **之后**（模块按文档顺序执行），确保 ofa.js 已注册。
 */

const HERE = new URL('.', import.meta.url);

/**
 * 只进 shadow root 的两份表。顺序有讲究：
 *
 *   mosaic.css        令牌 + 工具类。第一份，它顶部的 @layer 层序声明会把
 *                     整个层顺序钉死（层顺序由「首次出现」决定，后写的挪不动）。
 *   shadow-base.css   元素级 reset + 减弱动效。**绝不能 <link> 到宿主页面**，
 *                     里面的 `*{box-sizing}` / `button{cursor}` 会重置使用者的整页样式。
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
  // fetch 命中页面里 <link href="mosaic.css"> 已经建立的 HTTP 缓存，不会产生第二次下载
  loaded = await Promise.all(SHEETS.map(loadSheet));
} catch (err) {
  // 刻意不 rethrow：样式加载失败不该让整页崩掉。
  // 组件仍有正确的颜色和尺寸（令牌靠继承），只是失去工具类提供的排布。
  console.error(
    '[mosaic] 样式表加载失败，组件将退化为"有颜色无排布"：\n' +
      '        组件内部依赖的工具类不会生效，请检查 mosaic.js 与 mosaic.css 是否同目录。',
    err,
  );
}

if (loaded) {
  for (const root of pending) adopt(root);
  pending.clear();

  // 补扫：补丁装上之前（即本模块求值之前）就已经创建好的 shadow root。
  // querySelectorAll 不跨 shadow 边界，所以要递归。
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
