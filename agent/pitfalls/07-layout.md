# 七、布局页（嵌套页面/路由）（P28 / P29）

> 索引见 [`README.md`](./README.md)。

---

> Mosaic 文档站的外壳就是一个布局页（`docs/layout.html`）：子页面用 `export const parent`
> 挂上去，正文经父页面的 `<slot>` 投影。这一节是搭它时实测出来的。

### P28 · `<a olink>` 导航**不触发** `hashchange`

**现象**：从顶栏（用 `olink` 的应用内链接）点进一个页面后，靠 `hashchange` 驱动的
东西全都停在原地 —— 二级菜单不高亮、页面里的占位（卡片/色板）不渲染。
刷新一下又好了，所以极难反查。

**原因**：`olink` 走的是 `history.pushState`。规范里 pushState **不会派发 `hashchange`**，
也不会派发 `popstate`；地址栏 hash 变了，但监听器一次都不响。
（页面里的普通 `<a href="#/…">` 会触发 hashchange，所以两条路径表现不一致。）

**正确写法**：再听一个 o-app 的 `router-change` 事件 —— 每次导航都会冒泡
（实测 `bubbles: true`，从 `o-app` 一路冒到 `document`）：

```js
window.addEventListener('hashchange', sync); // 普通 hash 链接
document.addEventListener('router-change', sync); // olink / 前进后退
```

Mosaic 里这件事现在收在一处：`docs/state/route.js` 同时挂 `hashchange` 与 `router-change`，
消费方（顶栏 / 左栏 / 面包屑 / 翻页 / 站点脚本）只订阅它。

> 顺带一条同类坑：`parentNode` / `getRootNode().host` 走的是**节点树**，而滚动与投影按
> **扁平树**。两栏浮动，滚的是外壳的正文带 `.doc-main`（页面上唯一的滚动容器，见
> `docs/layout.html` 的 `<style>` 注释），扁平树仍能找到它 —— 完整推演与写法见 P34。

### P29 · 嵌套路由（布局页）的四条约定

**现象**：页面"掉出外壳"（没有顶栏、没有正文带，看起来像样式丢了）；或者父页面
写好了却什么都不显示。四条都**不报错**：

| 约定                                                              | 踩错的表现                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 子页面必须 `export const parent = '…'`                            | 那一页不会被布局页包住，顶栏/正文带全没有。路径相对**子页面文件**解析；`docs/pages/x.html` → `'../layout.html'`（分区布局页在 `docs/pages/` 下则写 `'../doc-layout.html'`）；`packages/<slug>/page.html` → `'../../docs/doc-layout.html'`（单列页如 `packages/color/page.html` → `'../../docs/layout.html'`） |
| 父页面（布局页）必须有 `<slot></slot>`                            | 子页面内容无处投影，页面一片空白（父页面自己正常）                                                                                                                                                                                                                                                            |
| 顶栏高亮要订阅 `docs/state/route.js`，不能只在 `ready()` 里算一次 | 父页面在切页时**不重建**，`ready()` 只在首次跑一次 → 只有第一页亮，之后一直不更新                                                                                                                                                                                                                             |
| 冷启动直接带 hash 时，子页面可能比父页面晚一步挂上                | 路由状态直接读 `location.hash`，因此顶栏高亮不依赖子页面挂载时机（无需轮询重试）                                                                                                                                                                                                                              |

**样式边界值得记一笔**：父页面的 `<style>` 在**它自己的 shadow root** 里，文档级 CSS
进不去（和普通组件一样）；但子页面的 `o-page` 在**文档树**里（它是父页面那个 `o-page`
的 light DOM 子节点），所以 `o-router → o-app → o-page` 的高度链可以、也只能写在
文档级样式表里（Mosaic 是 `docs/shell.css`）。

---
