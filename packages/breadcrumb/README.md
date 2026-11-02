# mc-breadcrumb（面包屑）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-breadcrumb` · 目录 `packages/breadcrumb/`

面包屑。容器 + 每一级两个标签；一级里的链接由使用者写在插槽里，当前页写 current，组件不造链接。

## 单元里有什么

| 文件                   | 角色                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| `breadcrumb.html`      | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `breadcrumb-item.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`            | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`               | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`               | 8 个演示（页面用可编辑示例读**同一份文件**）                                  |
| `test/`                | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### `breadcrumb.html`

mc-breadcrumb — 面包屑容器

只做三件事：一行布局、分隔符、列表语义。每一级是 mc-breadcrumb-item。

**交互元素由使用者写在插槽里**（原生 <a>）—— 与 mc-menu 同一条理由：站内链接要靠 olink
补部署前缀。olink 是**编译期**指令，只作用于模板里的元素；组件运行时造出来的
<a> 拿不到（见 docs/routes.js）。纯文本的一级就是当前页，写 current。
同理，**地址来自数据时 olink 也补不了**（它只改模板里静态写死的 href）—— 那种情况自己拼 `hashOf()`
再绑 `attr:href`，或者一级干脆不给链接（`demos/data.html` 演示的就是后者的取舍）。

分隔符**全部画在级自己的 shadow 里**（`.mc-sep`），容器不画 ::slotted::before。这是被
「数据驱动」逼出来的：`o-fill` / `o-if` 渲染完都**留在 DOM 里当包裹元素**（两者都是 `display: contents`），
级于是不再是「被投影进槽的元素」，`::slotted(mc-breadcrumb-item)` 一条都选不中 —— 分隔符会整排静默消失，
等于只能把面包屑写死。搬进级之后，包几层都照样有（`packages/breadcrumb/demos/data.html` 演示的就是
「写死的一级 + o-fill 的几级」混着写）。

**两条通道，同一个位置只画一次**：文本（`separator` 属性 / `--mc-breadcrumb-sep` 令牌，画在 `.mc-sep::before`）
与内容（`slot="separator"`，图标 / 富文本，由容器克隆进 `.mc-sep` 的子节点）。文本那条靠
`.mc-sep:not(:empty)::before { content: none }` 让位 —— **级自己判**，不需要容器回写任何状态；优先级是
插槽赢，两者不叠加。

`separator` 属性在 attached() 里落到一个内部变量上（刻意不碰 --mc-breadcrumb-sep 令牌，
否则会把使用者写在 style 上的覆盖一起抹掉）；不想动属性也可以直接覆盖令牌。这个变量是**继承**过去的
（容器 :host → o-fill → 级 :host → 级 shadow），所以容器只写一次、每一级都读得到。

**「谁是第一级」由容器按文档顺序判**（`items()` = 自己这一棵里的级，按 `closest('mc-breadcrumb')` 认领，
不看直接子元素 —— 同 mc-form 的 items()）。纯 CSS 的 `:host(:first-of-type)` 只做**兜底**：父级就是容器时
它是对的，但级散在 o-fill 里时每个包裹块的第一个都是 `:first-of-type`，会凭空吞掉一个分隔符 ——
容器写的 `data-sep` 压在它后面（同特异性、靠源码顺序），以容器为准。

为什么插槽内容要「分发」而不是直接投影：一份内容只能出现在一个 shadow 树里，而分隔符要出现在 N-1 个级里 ——
只有复制一条路（`cloneNode`，同 tree-select 的行模板）。所以 `slot="separator"` 的**原节点被留在容器里
（`display: none`）**，各级拿到的是副本；副本在级的 shadow 里，页面选择器够不到，要改颜色 / 字号走
`::part(separator)` 或行内 `style`（`style` 属性会跟着克隆走）。要放好几个节点时写
`<template slot="separator">` —— 分发取的是它 `content` 里的节点（模板自身克隆出来是空的，不特殊处理会
安静地什么也不画）。

分发的**时序**由三条路互相兜底，不靠定时器：容器在 `attached` 与两个槽的 `slotchange` 上推
（`distributeSeparator`）；级在 `attached` 里调容器的 `syncSeparators()` 拉（容器与级是两个 `<l-m>`，
谁先就绪不确定，o-fill 后渲染出来的级也走这条）；级在 `detached` 里再用**存下来的容器引用**拉拉一次 ——
删掉一级之后新的第一级要让位，那时候元素已经在树外、`closest` 找不到容器了。
`setSeparator`（级侧，`null` = 你是第一级、不画）/ `syncSeparators`（容器侧）都是**挂在宿主元素上的
跨标签接口**（proto 方法外面调不到，同 mc-form-item 的 `control`）—— 不进 `api.md`，不是给使用者用的。

### `breadcrumb-item.html`

mc-breadcrumb-item — 面包屑的一级（配合 mc-breadcrumb 使用）

插槽里放一个原生 <a>（可点的一级），或者直接写纯文本（当前页）。组件只负责这一级的文字
外观与当前项状态；href / target / rel 全写在原生元素上，组件不造链接 —— 站内链接要经 ofa 的
olink 补部署前缀；olink 是编译期指令、只作用于模板里的元素（docs/routes.js）。

当前项写 `current`：字色更实、字重加重。

分隔符**两边都在这一侧**：文本那条是 `.mc-sep::before`（内容读容器继承下来的变量），内容那条是容器克隆
进来的子节点。`.mc-sep` 带 `part="separator"` 与 `aria-hidden`，间距 / 颜色两条通道共用
（`--mc-breadcrumb-gap` / `--mc-breadcrumb-sep-color`），换通道不跳版。显示与否由 `data-sep`（容器写）
决定，`:host(:first-of-type)` 只是兜底 —— 两条规则的先后顺序别调，见上面容器那节。

## 令牌

| 令牌                               | 默认                   | 作用                                     |
| ---------------------------------- | ---------------------- | ---------------------------------------- |
| `--mc-breadcrumb-font`             | `--mc-text-sm`         | 字号；**级必须读它**（不能靠继承，见下） |
| `--mc-breadcrumb-line`             | `--mc-text-sm-lh`      | 行高；同上                               |
| `--mc-breadcrumb-sep`              | `'/'`                  | 分隔符（文本通道；CSS 字符串，要带引号） |
| `--mc-breadcrumb-sep-color`        | `--mc-color-fg-subtle` | 分隔符颜色（两条通道都读它）             |
| `--mc-breadcrumb-gap`              | `--mc-space-2`         | 级间距（也是分隔符与文字的间距）         |
| `--mc-breadcrumb-item-color`       | `--mc-color-fg-muted`  | 普通一级的文字                           |
| `--mc-breadcrumb-item-color-hover` | `--mc-color-fg`        | 悬停文字                                 |
| `--mc-breadcrumb-current-color`    | `--mc-color-fg`        | 当前页文字                               |

> ⚠️ **字号 / 行高为什么要有令牌**：级被 `o-fill` / `o-if`（甚至使用者自己的组件）包一层时，
> 中间那层是**一个渲染过的组件**，它的 shadow 里带着基座样式 `:host { font-size: var(--mc-text-base) }`
> —— 继承链在那里断掉，`font: inherit` 的级会拿到 16px 而不是容器的 14px（实测：数据渲染演示字号大了一号）。
> 自定义属性不受这条影响（照常穿过），所以字号 / 行高一律走令牌；`mc-menu` / `mc-tabs` 早就是这么传的。

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

> ⚠️ `separator` 属性与 `--mc-breadcrumb-sep` 令牌走**两条通道**：属性落到宿主上一个内部变量
> （`--mc-breadcrumb-sep-attr`），级里是 `content: var(内部变量, var(--mc-breadcrumb-sep))`。
> 让属性直接写 `--mc-breadcrumb-sep` 会把使用者写在 `style` 上的令牌一起抹掉（实测踩过）。

**宿主页面对 `a` 的颜色规则压过 `::slotted(a)`**：页面里写了 `a { color: … }` 时
`--mc-breadcrumb-item-color` / `--mc-breadcrumb-item-color-hover` 都管不到链接色（悬停只剩组件加的下划线）
—— 链接色最终由页面的链接样式决定。要精确控制就写一条特异性不低于页面 `a` 规则的页面样式。

## 为什么不发事件

> 页面上**没有**这一节：按 [`packages/page-spec.md`](../page-spec.md) §一「没有内容可写的节整节省略」——
> 面包屑不 emit 任何事件（级里的链接是使用者自己的 `<a>`，点击就是原生导航）。
> 这一行留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- 与 [`mc-menu`](../menu/) 同一条理由：**交互元素由使用者写在插槽里**，组件不造链接 —— 站内链接要经 ofa 的 `olink` 带部署前缀；`olink` 是编译期指令，只作用于模板里的元素（运行时造的拿不到）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定与组件索引：[`packages/README.md`](../README.md)
- 文档页 / 演示区规范：[`packages/page-spec.md`](../page-spec.md)
