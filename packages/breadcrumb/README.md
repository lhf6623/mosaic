# mc-breadcrumb（面包屑）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M1 · 标签 `mc-breadcrumb` · 目录 `packages/breadcrumb/`

面包屑。容器 + 每一级两个标签；一级里的链接由使用者写在插槽里，当前页写 current，组件不造链接。

## 单元里有什么

| 文件                   | 角色                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| `breadcrumb.html`      | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `breadcrumb-item.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`            | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`               | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`               | 6 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`                | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### `breadcrumb.html`

mc-breadcrumb — 面包屑容器

只做三件事：一行布局、分隔符、列表语义。每一级是 mc-breadcrumb-item。

**交互元素由使用者写在插槽里**（原生 <a>）—— 与 mc-menu 同一条理由：站内链接要靠 olink
补部署前缀，而 olink 是编译期指令、只作用于页面模板里的元素，组件在 shadow root 里造的
<a> 用不上（见 docs/routes.js）。纯文本的一级就是当前页，写 current。

分隔符画在每一项自己的 ::before 上（第一项除外），间距只有一个来源：.mc-list 的 gap。
separator 属性在 attached() 里落到一个内部变量上（刻意不碰 --mc-breadcrumb-sep 令牌，
否则会把使用者写在 style 上的覆盖一起抹掉）；不想动属性也可以直接覆盖令牌。

### `breadcrumb-item.html`

mc-breadcrumb-item — 面包屑的一级（配合 mc-breadcrumb 使用）

插槽里放一个原生 <a>（可点的一级），或者直接写纯文本（当前页）。组件只负责这一级的文字
外观与当前项状态；href / target / rel 全写在原生元素上，组件不造链接 —— 站内链接要经 ofa 的
olink 补部署前缀，而 olink 只作用于页面模板里的元素（docs/routes.js）。

当前项写 `current`：宿主带上 aria-current="page"，字色更实、字重加重。
列表语义（role=listitem）由组件自己补，使用者写了 role 就不覆盖（同 mc-menu-item）。

## 令牌

| 令牌                               | 默认                   | 作用                             |
| ---------------------------------- | ---------------------- | -------------------------------- |
| `--mc-breadcrumb-sep`              | `'/'`                  | 分隔符（CSS 字符串，要带引号）   |
| `--mc-breadcrumb-sep-color`        | `--mc-color-fg-subtle` | 分隔符颜色                       |
| `--mc-breadcrumb-gap`              | `--mc-space-2`         | 级间距（也是分隔符与文字的间距） |
| `--mc-breadcrumb-item-color`       | `--mc-color-fg-muted`  | 普通一级的文字                   |
| `--mc-breadcrumb-item-color-hover` | `--mc-color-fg`        | 悬停文字                         |
| `--mc-breadcrumb-current-color`    | `--mc-color-fg`        | 当前页文字                       |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

> ⚠️ `separator` 属性与 `--mc-breadcrumb-sep` 令牌走**两条通道**：属性落到宿主上一个内部变量
> （`--mc-breadcrumb-sep-attr`），CSS 里是 `content: var(内部变量, var(--mc-breadcrumb-sep))`。
> 让属性直接写 `--mc-breadcrumb-sep` 会把使用者写在 `style` 上的令牌一起抹掉（实测踩过）。

**宿主页面对 `a` 的颜色规则压过 `::slotted(a)`**：页面里写了 `a { color: … }` 时
`--mc-breadcrumb-item-color` / `--mc-breadcrumb-item-color-hover` 都管不到链接色（悬停只剩组件加的下划线）
—— 链接色最终由页面的链接样式决定。要精确控制就写一条特异性不低于页面 `a` 规则的页面样式。

## 为什么不发事件

> 页面上**没有**这一节：按 [`packages/README.md`](../README.md) §一「有事件才写这一节」——
> 面包屑不 emit 任何事件（级里的链接是使用者自己的 `<a>`，点击就是原生导航）。
> 这一行留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- 与 [`mc-menu`](../menu/) 同一条理由：**交互元素由使用者写在插槽里**，组件不造链接 —— 站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板（light DOM）里的元素。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
