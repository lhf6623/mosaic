/* 文档站共用的 DOM 小工具：site.js / doc-toc.html 都要建 DOM，
 * 抽一份免得各抄一遍（抄三份的下场是每次修坑都得改三处）。
 * <doc-nav> / <doc-crumb> / <doc-pager> 不走这里 —— 它们是 ofa 组件模板，结构由 o-fill 铺出来。 */

/**
 * 建 DOM。⚠️ props 只赋 **property**：
 *   · `dataset` / `style` 是只读 getter，Object.assign 会抛，且是在渲染途中抛（整块空白）；
 *   · 自定义元素上的**自定义属性**（`size` / `group`…）这样赋只是 expando，不会变成属性 ——
 *     那些必须用 attr()，`node.group = ''` 写不出 `<mc-menu-item group>`。
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset' || key === 'style') Object.assign(node[key], value);
    else node[key] = value;
  }
  node.append(...children);
  return node;
}

/** 写自定义属性（el() 覆盖不到的那部分）：`attr(el('mc-menu'), { size: 'sm' })` */
export function attr(node, attrs) {
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

/**
 * 只切 `aria-current`，**绝不重建 DOM**：重建会让真人点击的 mousedown / click 落在两个
 * 不同节点上，表现为「菜单要点好几次才跳转」（实测第 1 轮点了 6 次）。
 * `value`：页面级菜单用 `page`，页内目录用 `location`（ARIA 里页内位置的正确取值）。
 */
export function setCurrent(node, on, value = 'page') {
  if (on && node.getAttribute('aria-current') !== value) node.setAttribute('aria-current', value);
  else if (!on && node.hasAttribute('aria-current')) node.removeAttribute('aria-current');
}
