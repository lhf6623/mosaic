# mc-empty（空态）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-empty` · 目录 `packages/empty/`

空态。没有内容可显示时的一块占位：内置图形 + 一行文案 + 可选操作区，三档尺寸。

## 单元里有什么

| 文件         | 角色                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `empty.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`  | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`     | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`     | 6 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`      | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**内置图形不引 `mc-icon`，用图标类名。** 空态的图形是静态的（永远是那一张），所以走
[`packages/icon/README.md`](../icon/README.md) 里那条「静态图标直接用类名」的路：
`<span class="mc-image mc-icon-empty">` —— 零 JS、零 `load()`，不把 `mc-icon` 那套（含远程回退）
拖进来；代价是本体多一条 `<link rel="stylesheet" href="../icon/icons.generated.css">`
（与 `mc-button` / `mc-collapse-item` 同一份，浏览器缓存共享）。`empty` 这个内置名映射到
`lucide:inbox`，清单见 [`tools/icon-manifest.mjs`](../../tools/icon-manifest.mjs)。

**文案的兜底写在插槽里**（`<slot>{{description}}</slot>`）：默认插槽有内容就整块顶掉
`description` 的纯文本 —— 与 `mc-table` 的 `empty` 插槽同一条口径（兜底文案 + 命名插槽接管），
使用者不用记两种写法。

**操作区常驻 DOM，靠宿主 `data-has-footer` 切显隐**（`display: none` ↔ `block`，不用 `o-if`，P10）。
判定只走 `slotchange`（往操作区元素内部加东西不算「有内容」，不盯子树）；宿主属性在
`attached()` 里写 —— `ready()` 那一刻还不能往宿主写属性（P31），与 `mc-card` 的头尾同法。

**刻意不做的**：

- 不吃 `name` / `src` / `image`：空态不挑图；要换颜色 / 尺寸走令牌与 `::part(image)`。
- 不发事件、不写 `role` / `aria-*` —— 纯展示元素，自己不可交互。
- 不自作主张 `o-if` 级的自隐藏：「有没有内容、要不要出现」是使用者的渲染条件，不是组件该猜的。

## 令牌

| 令牌                           | 默认                   | 作用                             |
| ------------------------------ | ---------------------- | -------------------------------- |
| `--mc-empty-image-size`        | `2.5em`                | 内置图形的字号（图形盒恒为 1em） |
| `--mc-empty-image-color`       | `--mc-color-fg-subtle` | 图形颜色                         |
| `--mc-empty-description-color` | `--mc-color-fg-muted`  | 文案颜色                         |
| `--mc-empty-font`              | `--mc-text-sm`         | 文案字号                         |
| `--mc-empty-line-height`       | `--mc-text-sm-lh`      | 文案行高                         |
| `--mc-empty-gap`               | `--mc-space-3`         | 图形 / 文案 / 操作区之间的间距   |
| `--mc-empty-pad`               | `--mc-space-8`         | 整体内边距                       |

`size` 只动其中三条：`sm` = 1.75em + `--mc-text-xs`、`lg` = 3.5em + `--mc-text-base`。

## 相邻单元

- [`mc-table`](../table/) 是本单元目前唯一的使用者：它的兜底空态**就是 `mc-empty`**
  （`load('../empty/empty.html')` —— 表格本体因此不再是零 `load()`），`empty-text` 只是绑到
  这个组件的 `description` 上；要在表格里换掉整块，仍然把 `<div slot="empty">` 交给它 ——
  插槽赢过兜底。
- 与 [`mc-spinner`](../spinner/) / [`mc-loading-bar`](../loading-bar/) 的分工：那两个说「还在跑」，
  empty 说「确实没有」；加载中不该用空态占位（`mc-table` 的 `loading` 让位就是这条）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
