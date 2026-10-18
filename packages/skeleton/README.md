# mc-skeleton（骨架屏）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-skeleton` · 目录 `packages/skeleton/`

骨架屏：加载时先把内容的位置占住。矩形 / 文本行 / 圆形三档形状，宽高、底色与扫光都可配；减弱动效下自动关掉扫光。

## 单元里有什么

| 文件            | 角色                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `skeleton.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`     | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`        | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`        | 4 个演示（页面用 `<doc-playground src>` 读**同一份文件**）                    |
| `test/`         | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**一个占位块，不内置版式。** 骨架屏长什么样取决于真实内容：头像 + 两行字、卡片、列表行……在组件里内置
`avatar` / `paragraph` 预设，会把「某种版式」固化成 API；让使用者用几个 `<mc-skeleton>` +
`mc-space` 自己摆，组合更自由，组件也更小。

**尺寸先走统一的 `size` 三档，宽高再精确覆盖。** `size` 与 button / input 同一套控件高
（`sm` 28 / `md` 36 / `lg` 44，映射 `--mc-control-h-*`），默认 `md`；`width` / `height` 收 CSS 长度
（`12rem` / `60%` / `100px`），运行时由 JS 写成宿主**内联宽高**，显式值盖过 `size`——与 `mc-grid` 的
`cols`、`mc-space` 的 `gap` 同属「值来自运行时」的处理。

**`text` 不认 `size`。** 一行文字的高度由排版决定（`1em`），不是控件高；要更粗 / 更细的行用 `height` 覆盖。
**`circle` 不写 `width` 时自动取高度**，所以 `<mc-skeleton variant="circle" size="lg">` 就是 44×44 正圆；
宽高都写死时以属性为准（不强制相等，组件不替使用者推断）。

**形状只有 rect / text / circle 三档。** 三档只改圆角：`rect` = `--mc-radius-md`、
`text` = `--mc-radius-sm`（一行字的观感）、`circle` = `--mc-radius-full`。

**扫光用 CSS 动画，减弱动效下直接关掉。** 不写 JS 分支，一条 `@media (prefers-reduced-motion: reduce)`
就够；底色与扫光亮色都是令牌，暗色主题自动跟着令牌走。要静态占位就写 `no-animation`（布尔属性，
存在即关；绑定写法 `no-animation="false"` 会在挂载后归一化掉，CSS 的 `:host([no-animation])` 才判得准）。

**刻意不做：** 没有插槽（占位块里不该有内容）、没有 `part`（要改视觉就覆盖令牌）、
没有 `role` / `aria-*`（骨架屏是纯装饰，读屏应该等真内容）。

## 令牌

| 令牌                   | 默认                        | 作用                                                                |
| ---------------------- | --------------------------- | ------------------------------------------------------------------- |
| `--mc-skeleton-h`      | `--mc-control-h-md`         | 盒子形状的高度；数字 size 按 px 写它（text 不认、显式 height 优先） |
| `--mc-skeleton-bg`     | `--mc-color-surface-sunken` | 占位底色（RGB 三元组）                                              |
| `--mc-skeleton-shine`  | `--mc-color-surface-raised` | 扫光亮色，按 60% 透明度扫过底色（RGB 三元组）                       |
| `--mc-skeleton-radius` | `--mc-radius-md`            | 圆角；`text` → `--mc-radius-sm`、`circle` → `--mc-radius-full`      |

> 三个都是**可覆盖的组件令牌**（不是 JS 写的内部变量）：改形状用 `variant`，要别的圆角直接覆盖
> `--mc-skeleton-radius`。

## 相邻单元

- 与 [`mc-spinner`](../spinner/) 的分工：spinner 说「在转，但不知道要多久」，skeleton 说「内容的位置在这儿，
  先占住」——已知版式用 skeleton，未知用 spinner。
- 与 [`mc-empty`](../empty/) 的分工：empty 是「确实没有数据」的终态，skeleton 是加载中的临时态；
  两者不该同时出现。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
