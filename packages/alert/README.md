# mc-alert（提示条）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-alert` · 目录 `packages/alert/`

页内提示条。可关闭，带标题与描述。

## 单元里有什么

| 文件         | 角色                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `alert.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`  | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`     | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`     | 9 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`      | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-alert — 页内提示条

和 message() 的分工：alert 是**页内静态**的一块面（跟着内容流排版、不抢焦点、不会自己消失）；
message 是命令式浮层（自己进场、自己走，不占版面）。两者都要「把状态告诉使用者」，但
一个在文档流里、一个在层级最上面，所以不是一个组件。

两个正交维度 + 两个状态布尔，和 mc-tag / mc-button 同一套分工：

- color 只往四个色槽里填值（subtle 要单独的浅底槽）；
- variant 只决定色槽贴到哪儿（subtle 默认 / solid / outline）；
- 状态：icon（左侧内置图形）、closable（右侧关闭图标）。
  **没有 size** —— 提示条不是控件，高度由内容撑；要改就 style="padding:…" 或 --mc-alert-pad-*。
  于是 6 色 + 3 外观 = 9 条规则，而不是 18 条组合规则。

标题属性叫 heading 不叫 title：title 是原生属性，挂上去浏览器会弹自己的 tooltip，而且
ofa 会把声明过的字符串属性以空值写到宿主上，"有没有给标题"只能看值、不能看属性在不在。
插槽名照旧叫 title（插槽名不产生属性）—— 和 mc-collapse-item 的 header 属性 + header 插槽同构。

标题/正文的显隐只从宿主上的 data-has-title / data-has-body 选（同 mc-card 的 data-has-header）：
空的标题块会白占一行、正文空了 gap 也还在。宿主属性只能在 attached() 之后写，
所以 ready() 里只做查询，判定统一走 applyState()。

图标直接消费 **mc-icon**（4 个语义图形住在内置图标集里：info / success / warning / error），
`:name` 跟着 color 走 —— 常驻 DOM、不用 o-if。要给自己的图标就写 slot="icon"，
有内容时内置图形让位。

⚠️ **这个文件里没有任何 SVG 形状**（图标数据在 mc-icon 那边，构建期编译进 mosaic.css）。
这条约束值得留着：Live Server 会往 HTML 里注入热重载 script，注入点是「body / svg / head 的
结束标签」里的第一个，而它是**纯文本替换、不看上下文** —— 内联 svg 一旦出现在组件模块 script
之前，注入的 script 就变成 ofa 眼里的「第一个 script」，组件直接报「加载组件模块出错」（实测：
VS Code Live Server 5500 端口）。仓库自带 tools/serve.mjs --inject 复现同一规则，
tests/site/07 守这条不变量：组件文件里任何一个注入点都必须排在模块 script 之后。
（同理，图标数据放 `packages/icon/icons.generated.js` —— 生成物，只有 tools/gen-icons.mjs 写它。）

closable 只发 close，**不自己删 DOM** —— 组件不改使用者的 DOM：使用者自己在事件里 remove() 或改数据。
关闭按钮是 32×32 命中区的原生按钮（Mosaic 对小控件的下限），用负外边距抵消掉超出行高的那 6px，
所以单行提示条不会因为它变高；焦点环用 --mc-color-ring（不用 currentColor）。

## 令牌

| 令牌                      | 默认                               | 作用                                                               |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `--mc-alert-fill`         | 按 `color`                         | `solid` 的底色                                                     |
| `--mc-alert-on-fill`      | 按 `color`                         | 实心上的文字色                                                     |
| `--mc-alert-accent`       | 按 `color`                         | `subtle` 的文字与图标、`outline` 的线与文字（中性色是 `fg-muted`） |
| `--mc-alert-subtle-fill`  | 按 `color`                         | `subtle` 的浅底（中性色用 `surface-sunken`）                       |
| `--mc-alert-body-color`   | `fg-muted`（`solid` 时 `on-fill`） | 描述文字色                                                         |
| `--mc-alert-layer-color`  | `fg`（`solid` 时 `on-fill`）       | × 的 state layer 用色                                              |
| `--mc-alert-layer`        | `0.08`                             | × 的 hover 叠加强度；`active` 是它的 1.5 倍（12%）                 |
| `--mc-alert-pad-x` / `-y` | `--mc-space-4` / `--mc-space-3`    | 左右 / 上下内边距                                                  |
| `--mc-alert-gap`          | `--mc-space-3`                     | 图标、正文、× 之间的间距                                           |
| `--mc-alert-radius`       | `--mc-radius-md`                   | 圆角                                                               |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

**标题属性叫 `heading` 不是 `title`**：原生 `title` 会弹浏览器自己的 tooltip，而且 ofa 会把声明过的
字符串属性以空值写到宿主上。插槽名仍是 `title` —— 插槽名不产生属性。
和 `mc-collapse-item` 的「`header` 属性 + `header` 插槽」同构。

**空内容靠宿主上的三个钩子折掉**：`data-has-title` / `data-has-body` / `data-has-icon`
（slotchange + `heading` 的值一起判定，写宿主只能在 `attached()` 之后）。
没有它们时空标题会白占一行、空正文会白留一个 gap。

**图标来自 [mc-icon](../icon/api.md)**：按自己的 `color` 取内置图标集里的四个语义图形 —— 信息圆
（`primary` / `info` / `neutral` 共用）、对勾（`success`）、三角叹号（`warning`）、叉圆（`danger`）。
`mc-alert` 的内部有 `await load('../icon/icon.html')`，所以只引 `mc-alert` 的使用者会连带取一次
`icon.html`。要别的图标就写 `slot="icon"`（有内容时内置图形让位）。

**`closable` 只发 `close`，不删 DOM**（组件不改使用者的 DOM，同 `mc-tag` / `mc-menu` / `mc-breadcrumb`）：
自己在事件里 `el.remove()` 或改数据。× 是 32×32 命中区的原生按钮，靠 `-6px` 的上下负外边距抵消掉
超出行高的部分，所以加不加 `closable`、单行提示条都一样高（46px）。

## 相邻单元

- 与 [`message()`](../message/) 的分工：alert 是**页内静态**的一块面（跟着内容流排版、不抢焦点、不会自己消失），message 是**命令式浮层**（自己进场、自己走、不占版面）—— 两者都要「把状态告诉使用者」，但一个在文档流里、一个在层级最上面。

- 内部 `await load('../icon/icon.html')`：左侧图形跟着 `color` 变，所以只引 `mc-alert` 的使用者会连带取一次 `icon.html`。

**`color` 也收 hex**（`<mc-alert color="#1a7f5a">`）：六个语义名仍走 CSS，hex 走
[`../boot/color-attr.js`](../boot/color-attr.js) —— 填 `--mc-alert-fill` / `-on-fill` / `-accent` /
`-subtle-fill`（浅底档按当前主题混，切主题会重算）。文字色按 WCAG 自动给；**极浅的牌子色在浅底上会读不清**
（`#fff000` 1.16:1），接线器会就此发一条 `[mosaic]` 警告。只收 hex，非 hex 一条警告、不写槽。
<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
