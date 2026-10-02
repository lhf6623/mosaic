# mc-tag（标签）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-tag` · 目录 `packages/tag/`

分类 / 状态标签。语义色 × 浅底 / 实心 / 描边三个维度，可选可关（checkable / closable）。

## 单元里有什么

| 文件        | 角色                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `tag.html`  | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html` | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`    | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`    | 8 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`     | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-tag — 分类 / 状态标签

和 mc-badge 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互）；
tag 是「内容本身」的标签，可以做两件交互的事 —— 可关闭（closable）、可选中（checkable）。

三个维度正交，和 mc-button 同一套分工：

- color 只往四个色槽里填值（subtle 需要单独的浅底槽，所以比 button 多一个）；
- variant 只决定色槽贴到哪儿（subtle 默认 / solid / outline）；
- size 只改字号与左右内边距 —— **高度由字号和行高撑**，标签不是控件，不写死控件高。
  于是 6 色 + 3 外观 = 9 条规则，而不是 18 条组合规则。

交互一律落在**原生元素**上，但刻意不「包一层按钮」：checkable 是 shadow 里一个铺满宿主的
透明 <button>，内容留在它旁边的默认插槽里（mc-button 同一种做法）。
这样 closable 的关闭按钮能与它做**兄弟**而不是嵌套 —— HTML 不允许 button 里再放 button；
关闭按钮靠 z-index 压在 toggle 层上面，点它不会连带切换选中。

closable 只发 close，**不自己删 DOM** —— 组件不改使用者的 DOM（同 mc-menu / mc-breadcrumb）：
使用者自己在事件里 remove() 或改数据。

## 令牌

| 令牌                    | 默认                            | 作用                                                         |
| ----------------------- | ------------------------------- | ------------------------------------------------------------ |
| `--mc-tag-fill`         | 按 `color`                      | `solid` 与选中态的底色                                       |
| `--mc-tag-on-fill`      | 按 `color`                      | 实心上的文字色                                               |
| `--mc-tag-accent`       | 按 `color`                      | `subtle` 的文字、`outline` 的线与文字                        |
| `--mc-tag-subtle-fill`  | 按 `color`                      | `subtle` 的浅底（中性色用 surface-sunken）                   |
| `--mc-tag-pad-x` / `-y` | `--mc-space-3` / `--mc-space-1` | 左右 / 上下内边距                                            |
| `--mc-tag-gap`          | `--mc-space-1`                  | 内容与关闭图标之间的间距                                     |
| `--mc-tag-close-size`   | `1.25em`                        | 关闭图标的字号（命中区固定 24×24，不受影响）                 |
| `--mc-tag-layer`        | `0.08`                          | state layer 的 hover 叠加强度；`active` 是它的 1.5 倍（12%） |
| `--mc-tag-radius`       | `--mc-radius-md`                | 圆角（全圆角写 `--mc-radius-full`）                          |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

**`closable` 只发 `close`，不删 DOM**（组件不改使用者的 DOM，同 `mc-menu` / `mc-breadcrumb`）：
自己在事件里 `el.remove()` 或改数据。可关 + 可选同时开时，× 压在 toggle 层上面（z-index 分开），
点 × 只关不选。

**交互元素都是原生按钮**：`checkable` 是 shadow 里一个铺满宿主的透明 `<button>`，
`closable` 的 × 是 `part="close"` 的原生按钮 —— 键盘
<kbd>Space</kbd> / <kbd>Enter</kbd> 可切换，焦点环用 `--mc-color-ring`。

## 相邻单元

- 与 [`mc-badge`](../badge/) 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互），tag 是「内容本身」的标签 —— 它才有关闭与选中。

**`color` 也收 hex**（`<mc-tag color="#1a7f5a">`）：六个语义名仍走 CSS，hex 走
[`../boot/color-attr.js`](../boot/color-attr.js) —— 填 `--mc-tag-fill` / `-on-fill` / `-accent` /
`-subtle-fill`（浅底档按当前主题混，切主题会重算）。文字色按 WCAG 自动给；**极浅的牌子色在浅底上会读不清**
（`#fff000` 1.16:1），接线器会就此发一条 `[mosaic]` 警告。只收 hex，非 hex 一条警告、不写槽。
<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
