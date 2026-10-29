# mc-badge（徽标）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-badge` · 目录 `packages/badge/`

徽标。挂在容器（按钮、头像…）的角上，也支持独立使用；圆点与数值上限都有。

## 单元里有什么

| 文件         | 角色                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `badge.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`  | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`     | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`     | 9 个演示（页面用 `<doc-playground src>` 读**同一份文件**）                    |
| `test/`      | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-badge — 徽标

**宿主是定位包装器，徽标块搬进了 shadow。** 挂载模式里宿主 `position: relative` + `display: inline-flex`，
宿主盒的尺寸就是容器（默认插槽里那个元素）的尺寸；徽标块是 shadow 里的 `.mc-badge`（`part="indicator"`），
绝对定位到四个角之一。没有容器时宿主里只剩徽标块，退化成一块独立徽标 —— 两种形态同一个组件，
模式由「默认插槽里有没有元素」判定（`slotchange` + `assignedElements()` 镜像到宿主 `data-anchored`）。

**为什么不用 popover / CSS 锚点定位。** 徽标是常驻的静态标记，不是浮层：它该跟着容器一起滚动、
一起被祖先裁切，也不该抢焦点或进 top layer。tooltip / popover 那套 `anchor-name` + `popover` 会把
基础组件的浏览器门槛抬到 Chrome 125+，为一块静态色片不值。代价是祖先 `overflow: hidden` 会裁掉
外挂的一半 —— 需要完整露出就自己给容器留 padding。

**四角 + `--mc-badge-overlap`。** `placement` 只有 `top-end`（默认）/ `top-start` / `bottom-end` /
`bottom-start`；字符串取 tooltip / popover 的子集，但**不是贴边留距**：徽标块中心压在角上
（`translate: 50% -50%`），所以角上一半挂在外面的。挂多少由 `--mc-badge-overlap` 控制：
`50%`（默认）中心压角、`0` 完全贴在内侧、`100%` 完全挂在外侧。挂载模式下徽标块 `pointer-events: none`，
盖住的那半个容器照样点得到。

**内容走 `content` 属性，空内容不渲染。** 默认插槽让给了容器，徽标文字只能走属性；`content` 为空
（且没开 `dot`）时脚本给宿主镜像 `data-empty`，整块不渲染 —— 模板里写 `{{count}}` 时 count 为 0
不会在角上挂一个空气泡。`max` 仍只认纯数字内容（超过上限才显示 `max+`），结果写进常驻的
`.mc-text`（P17），显隐交给 `:host([dot])`。`dot` 与内容是互斥的两态：打开 `dot` 就只说
「有事发生」，不显示数字。

**`invisible` 是显式开关。** 空内容默认不渲染；`invisible` 用来在内容非空时临时关掉徽标块
（容器照常保留）。ofa 的布尔绑定会把 false 写成 `invisible="false"`，所以挂载时先规范化一遍
（同 `mc-skeleton` 的 `no-animation`），CSS 的 `:host([invisible])` 才判得准。`dot` 也一起规范化。

**`color` / `variant` / `size` 三个维度仍然正交**，和 mc-tag / mc-button 同一套分工：
color 只填四个色槽（fill / on-fill / accent / subtle-fill），variant 只决定色槽贴到哪儿
（subtle 默认 / solid / outline），size 只改高度、字号与左右内边距。徽标不是控件，高度走自己的
`--mc-badge-h`。**没有 `neutral`**（中性标记交给 mc-tag）；**`size` 只有两档**（lg 对徽标没有语义，
要更大就覆盖 `--mc-badge-h`）。

**`part="indicator"` 是这次改动补的出口。** 视觉从 `:host` 搬进 shadow 之后，宿主 `style` 不再
直接刷底色 / 边框；常规定制走令牌，令牌没覆盖到的（比如给徽标加一圈 `box-shadow` 挖边）用
`::part(indicator)`。

**已知边界。** 宿主是 `inline-flex`、shrink-to-fit：块级容器（整卡、整行）放进挂载模式后不会自动
撑满，需要整宽就写宿主 `style="display: flex"` 或自己包一层；容器自带的 `margin` 会算进宿主盒，
角点以包装盒为准。RTL 暂不支持：`inset` 用的是逻辑属性，但 `translate` 是物理量，`:dir(rtl)` 下
`start` / `end` 的外挂方向要翻符号 —— 仓库目前没有 RTL 需求，将来要支持时在这里补。

## 令牌

| 令牌                     | 默认                                | 作用                                                   |
| ------------------------ | ----------------------------------- | ------------------------------------------------------ |
| `--mc-badge-h`           | `1.25rem`（sm `1rem`）              | 徽标最小高度；`dot` 模式下也是正圆的直径               |
| `--mc-badge-pad-x`       | `--mc-space-2`（sm `--mc-space-1`） | 左右内边距                                             |
| `--mc-badge-font`        | `--mc-text-xs`（sm `0.625rem`）     | 字号                                                   |
| `--mc-badge-radius`      | `--mc-radius-full`                  | 圆角（要方角写 `--mc-radius-sm`）                      |
| `--mc-badge-dot`         | `0.5rem`（sm `0.375rem`）           | 圆点的直径（命中区就是圆点本身，不额外放大）           |
| `--mc-badge-overlap`     | `50%`                               | 挂载模式下徽标块中心相对角点的外挂比例（按自身尺寸算） |
| `--mc-badge-fill`        | 按 `color`                          | `solid` 的底色                                         |
| `--mc-badge-on-fill`     | 按 `color`                          | `solid` 上的文字色（hex 时按 WCAG 自动给）             |
| `--mc-badge-accent`      | 按 `color`                          | `subtle` 的文字、`outline` 的线与文字、圆点的颜色      |
| `--mc-badge-subtle-fill` | 按 `color`                          | `subtle` 的浅底（hex 时按当前主题混出来）              |

**`color` 也收 hex**（`<mc-badge color="#1a7f5a">`）：五个语义名仍走 CSS，hex 走
[`../boot/color-attr.js`](../boot/color-attr.js) —— 填上面四个色槽（浅底档按当前主题混，
切主题会重算）。文字色按 WCAG 自动给；**极浅的牌子色在浅底上会读不清**（`#fff000` 1.16:1），
接线器会就此发一条 `[mosaic]` 警告。只收 hex，非 hex 一条警告、不写槽。

## 相邻单元

- 与 [`mc-tag`](../tag/) 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互），
  tag 是「内容本身」的标签 —— 它才有关闭（`closable`）与选中（`checkable`）。
  徽标因此没有事件、没有 `disabled`：它唯一可点的东西都不该有 —— 挂载模式下徽标块
  `pointer-events: none`，点击穿透给容器。
- 与 [`mc-spinner`](../spinner/) / [`mc-progress`](../progress/) 的分工：那三个都在说「还在跑」，
  badge 说的是「这里有个状态 / 有个数」—— 静止的。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
