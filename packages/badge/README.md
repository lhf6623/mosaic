# mc-badge（徽标）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-badge` · 目录 `packages/badge/`

徽标。默认浅底，比实心更不抢视线；支持纯圆点与数值上限。

## 单元里有什么

| 文件         | 角色                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `badge.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`  | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`     | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`     | 7 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`      | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-badge — 徽标

三个维度正交，和 mc-tag / mc-button 同一套分工：

- `color` 只往四个色槽里填值（`fill` / `on-fill` / `accent` / `subtle-fill`）；
- `variant` 只决定色槽贴到哪儿（subtle 默认 / solid / outline）；
- `size` 只改高度、字号与左右内边距。徽标**不是控件**，所以高度走自己的 `--mc-badge-h`，
  不借 `--mc-control-h-*`（那三档是给可交互控件的触控高度）。于是 5 色 + 3 外观 = 8 条规则。

**`size` 只开两档（`sm` / `md`）**：三档基线里的 `lg` 对徽标没有语义 —— 它贴在别的元素旁边、
高度天然跟着那一行文字走（要更大就写宿主 `style="--mc-badge-h: 1.5rem"`，定制点已经开着）。
草案也只定了两档，实现跟着走。
`mc-progress` 同样是两档，理由相同。

**没有 `neutral`**：徽标默认就是 `primary` —— 中性的「分类标记」是 mc-tag 的活。这也是草案定下的取值，
实现没有改。

**`dot` 与内容是互斥的两态，不是叠加**：打开 `dot` 就只说「有事发生」，不显示数字。
所以圆点模式把插槽内容整块 `display: none` 掉，宿主同时 `padding-inline: 0` +
`min-width: var(--mc-badge-h)` —— 整块变成正圆，而不是一个「点 + 空文本」的胶囊。
`dot` 的圆点用 `currentColor`：subtle 下跟着 accent、solid 下跟着 on-fill，三档外观都不引新色。

**`max` 只认纯数字内容**：`/^\d+$/` 命中且大于上限才换成 `${max}+`。内容里混了文字
（`v2`、`新`）说明它不是计数，截断只会给出错误信息。截断结果写在 shadow 里一个常驻的
`span` 上，显隐交给 `:host([data-overflow])` —— 运行时切状态不用 `o-if`。
判定入口只有一个（`applyMax`），`slotchange`、`max`、`dot` 三条路都走它，所以「点一下圆点
模式」和「内容被换掉」不会各算一遍。

## 令牌

| 令牌                     | 默认                                | 作用                                              |
| ------------------------ | ----------------------------------- | ------------------------------------------------- |
| `--mc-badge-h`           | `1.25rem`（sm `1rem`）              | 徽标最小高度；`dot` 模式下也是正圆的直径          |
| `--mc-badge-pad-x`       | `--mc-space-2`（sm `--mc-space-1`） | 左右内边距                                        |
| `--mc-badge-font`        | `--mc-text-xs`（sm `0.625rem`）     | 字号                                              |
| `--mc-badge-radius`      | `--mc-radius-full`                  | 圆角（要方角写 `--mc-radius-sm`）                 |
| `--mc-badge-dot`         | `0.5rem`（sm `0.375rem`）           | 圆点的直径（命中区就是圆点本身，不额外放大）      |
| `--mc-badge-fill`        | 按 `color`                          | `solid` 的底色                                    |
| `--mc-badge-on-fill`     | 按 `color`                          | `solid` 上的文字色（hex 时按 WCAG 自动给）        |
| `--mc-badge-accent`      | 按 `color`                          | `subtle` 的文字、`outline` 的线与文字、圆点的颜色 |
| `--mc-badge-subtle-fill` | 按 `color`                          | `subtle` 的浅底（hex 时按当前主题混出来）         |

**`color` 也收 hex**（`<mc-badge color="#1a7f5a">`）：五个语义名仍走 CSS，hex 走
[`../boot/color-attr.js`](../boot/color-attr.js) —— 填上面四个色槽（浅底档按当前主题混，
切主题会重算）。文字色按 WCAG 自动给；**极浅的牌子色在浅底上会读不清**（`#fff000` 1.16:1），
接线器会就此发一条 `[mosaic]` 警告。只收 hex，非 hex 一条警告、不写槽。

## 相邻单元

- 与 [`mc-tag`](../tag/) 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互），
  tag 是「内容本身」的标签 —— 它才有关闭（`closable`）与选中（`checkable`）。
  徽标因此没有 `part`、没有事件、没有 `disabled`：它唯一可点的东西都不该有。
- 与 [`mc-spinner`](../spinner/) / [`mc-progress`](../progress/) 的分工：那三个都在说「还在跑」，
  badge 说的是「这里有个状态 / 有个数」—— 静止的。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
