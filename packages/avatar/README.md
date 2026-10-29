# mc-avatar（头像）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-avatar` · 目录 `packages/avatar/`

头像。有图显示图，没图 / 加载失败落到首字母或自定义兜底；尺寸、圆角与兜底色可配。

## 单元里有什么

| 文件          | 角色                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `avatar.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                                          |
| `page.html`   | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)）                       |
| `api.md`      | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                                        |
| `demos/`      | 6 个演示（页面用 `<doc-playground src>` 读**同一份文件**） + `demos/avatar.svg`（演示读的样例文件） |
| `test/`       | 组件自己的冒烟套件（1 个文件）                                                                      |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-avatar — 头像

**图片优先，兜底垫在下面。** `<img>` 与兜底块是同一格里的两层：`src` 为空、加载中、加载失败都显示兜底，
`load` 之后宿主 `data-has-image` 把兜底整块换成图片，`error` 时撤掉。兜底内容先看默认插槽
（文字 / emoji / 图标），没有就看 `name`：非拉丁名取第一个字，拉丁名取前两个词的首字母（最多两个字符）。
两条状态都由脚本镜像成宿主属性（P32），CSS 只认 `data-has-image` / `data-has-fallback`。

**头像不是控件，尺寸走自己的令牌。** 三档 24 / 32 / 40 走 `--mc-avatar-size`；`size` 也收纯数字，
按 px 写进宿主内联变量（`size="48"` → `--mc-avatar-size: 48px`，和 `mc-space` / `mc-grid` 的 `gap`
同一条通道），非法值交回 CSS。只删自己写过的那次 —— 使用者手写的 `--mc-avatar-size` 不会被默认的
`size="md"` 抹掉。首字母字号 `--mc-avatar-font` 是 `calc(size * 0.4)`，会跟着缩放。不借
`--mc-control-h-*` —— 那三档是触控控件的高度。`shape` 只换圆角：`circle` = `--mc-radius-full`、
`square` = `--mc-radius-md`，覆盖 `--mc-avatar-radius` 可再改。

**`color` 只染兜底，不碰图片。** 语义色只往 `--mc-avatar-subtle-fill` / `--mc-avatar-accent`
两个色槽里填值（neutral 默认 = `surface-sunken` + `fg-muted`）；图片就绪后整块盖住，所以给了 `color`
也不影响图片头像。`color` 也收 hex（走共享接线器，浅底按当前主题混），hex 与语义名填同一套槽。

**不引图标组件。** 默认兜底是首字母，不内置用户剪影图标 —— 引 `mc-icon` 会为一块头像连带下载整套
图标 CSS（`icon.html` 会 link `icons.generated.css`）。要图标就写进默认插槽，由使用者按需引入：
`<mc-avatar name="张三"><mc-icon name="user"></mc-icon></mc-avatar>`。

**已知边界。** `src` 的相对地址按页面解析（同原生 `img`，不在组件文件旁）；同一个失败地址不会自动重试，
换地址（或清空再写）才会重新加载。没有 `part`：视觉全在 `:host` 上，外部 `style` 与令牌够用。

## 令牌

| 令牌                      | 默认                                                       | 作用                                         |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `--mc-avatar-size`        | `2rem`（sm `1.5rem` / lg `2.5rem`；`size="48"` 写 `48px`） | 头像边长（圆形时是直径），也决定兜底文字字号 |
| `--mc-avatar-radius`      | `--mc-radius-full`（square `--mc-radius-md`）              | 圆角                                         |
| `--mc-avatar-font`        | `calc(var(--mc-avatar-size) * 0.4)`                        | 兜底文字 / 首字母字号                        |
| `--mc-avatar-subtle-fill` | 按 `color`（neutral = surface-sunken）                     | 兜底底色                                     |
| `--mc-avatar-accent`      | 按 `color`（neutral = fg-muted）                           | 兜底文字 / 首字母颜色                        |

## 相邻单元

- 与 [`mc-badge`](../badge/) 的分工：badge 是挂在头像角上的状态标记（在线、未读数），
  avatar 只负责显示身份 —— 两者各管一块，不互相嵌套内置。
- 与 [`mc-skeleton`](../skeleton/) 的分工：加载中的圆形占位是 skeleton 的活（`variant="circle"` +
  宽高），avatar 不内置 loading 态 —— 真实头像到了再换成 avatar 即可。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
