# mc-menu（菜单）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-menu` · 目录 `packages/menu/`

垂直菜单。容器 + 菜单项两个标签，交互元素由使用者写在插槽里 —— 组件不造链接、也不改使用者的 DOM。

## 单元里有什么

| 文件             | 角色                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `menu.html`      | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `menu-item.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`      | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`         | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`         | 7 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`          | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### `menu.html`

mc-menu — 垂直菜单容器

只做两件事：尺寸通道、外框（variant）。菜单项是 mc-menu-item。

**交互元素由使用者写在插槽里**（原生 <a> / <button>），组件既不造链接也不碰使用者的 DOM：
站内链接要靠 ofa 的 olink 指令补部署前缀，而 olink 只作用于页面模板（light DOM）里的元素，
组件在 shadow root 里造出来的 <a> 用不上（见 `docs/routes.js`）。

尺寸/颜色走 CSS 变量继承：子项在另一个 shadow root 里，容器选择器够不到它，
只能像 mc-collapse 那样在 :host 上开一条通道，子项用 var() 带兜底值消费。

### `menu-item.html`

mc-menu-item — 菜单项（配合 mc-menu 使用）

插槽里放一个原生 <a> 或 <button>，它承载全部语义与交互：href、键盘、焦点环、
data-current、disabled / data-disabled 都是使用者写的，组件只读它、不改它。
链接为什么必须由使用者写：站内链接要经 ofa 的 olink 补部署前缀，而 olink 只作用于
页面模板里的元素 —— 组件在 shadow root 里造的 <a> 用不上（docs/routes.js）。

⚠️ 行的视觉全在**宿主**上，插槽元素只当铺满整行的交互层（正常流 + `width/height: 100%`）。
原因是一条实测出来的层叠规则：插槽元素同时是**祖先 shadow 树**里的普通元素，而每一层
shadow root 里都有一份 shadow-base.css（组件的由自己的 `<link>` 带进来、文档站的由
docs/adopt-styles.js 注入）—— 那里面对 button 的 `padding: 0 / background: none /
cursor: pointer` 是「直接命中」，优先级压过本组件 shadow root 里的 `::slotted(button)`
（封装上下文排在层叠顺序前面）。
所以底色 / 颜色一律写在宿主上、缩进走宿主继承的 `text-indent`，插槽元素只负责铺满整行：

· 左侧缩进 → 宿主 text-indent（继承属性，能穿 shadow 边界；插槽元素上显式写一遍压住 UA）
· 右侧留白 → 宿主 padding-inline-end（插槽元素铺的是内容盒，宽度写成 `calc(100% + pad-x)`
把这一层也铺上，整行才是可点区；它同时计入固有宽度 —— 面板按内容自适应时才左右对称，
只靠 text-indent 的话右边没有留白，看着就是「左有右无」）
· 垂直居中 → 宿主 line-height = 行高（同上）
· 底色 → 宿主 :host(:hover) / :host([data-current])

⚠️ 插槽元素**不能绝对定位**（原来是 `position:absolute; inset:0`）：绝对定位不参与固有宽度
计算，宿主外面那个容器（`mc-dropdown` 的面板）就永远量不到标签有多宽 —— 面板宽度没法跟着
内容走。改成正常流之后，宿主**左侧**不能有内边距（会和 `text-indent` 叠成双份缩进），
**右侧**那层则要保留、并让插槽元素的宽度补上它（见上）。

状态同样从插槽元素读，但镜像到宿主上的 data-current / data-disabled —— 宿主没法用
`:has()` 看孩子（ofa 的样式作用域不支持 :host() 里嵌函数式伪类）。

## 令牌

| 令牌                           | 默认                        | 作用                |
| ------------------------------ | --------------------------- | ------------------- |
| `--mc-menu-item-h`             | `--mc-control-h-md`         | 项高（`size` 改它） |
| `--mc-menu-pad-x`              | `--mc-space-4`              | 左右缩进            |
| `--mc-menu-font`               | `--mc-text-sm`              | 字号                |
| `--mc-menu-gap`                | `--mc-space-1`              | 项间距              |
| `--mc-menu-radius`             | `--mc-radius-md`            | 行圆角              |
| `--mc-menu-item-color`         | `--mc-color-fg-muted`       | 普通项文字          |
| `--mc-menu-item-color-hover`   | `--mc-color-fg`             | 悬停文字            |
| `--mc-menu-item-color-current` | `--mc-color-primary`        | 当前项文字          |
| `--mc-menu-item-bg-hover`      | `--mc-color-surface-sunken` | 悬停底色            |
| `--mc-menu-item-bg-current`    | `--mc-color-primary-subtle` | 当前项底色          |
| `--mc-menu-group-color`        | `--mc-color-fg-subtle`      | 分组标题文字        |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

> ⚠️ 菜单项同样**不能**给 `--mc-menu-*` 写默认值，否则会盖掉容器继承来的通道
> （和 `mc-collapse-item` 同一条坑），消费侧一律 `var(--mc-menu-x, 兜底)`。

> ⚠️ **行盒子（高度 / 内边距 / 底色 / 缩进）为什么在宿主上、不在插槽元素上**：
> 插槽元素同时是外层 shadow 树里的普通元素，`shadow-base.css` 对 `button` 的
> `padding` / `background` / `cursor` reset 是「直接命中」，按封装上下文压过组件内的
> `::slotted(button)`；`:host(:has(...))` 在 ofa.js 里又不生效，宿主「看不到孩子」。
> 所以视觉留宿主、插槽元素只当铺满整行的交互层、状态靠 JS 镜像 —— 实现见 `packages/menu/menu-item.html` 的样式段。
> 副作用：禁用项若用 `<button>`，光标可能仍是手型（reset 那一条压不过），用 `<a>` 正常。

## 为什么不发事件

> 页面上**没有**这一节：菜单不 emit 任何事件 —— 点击就是插槽里那个原生 `<a>` / `<button>`
> 的原生点击，组件不转发、也不改使用者的 DOM。
> 这一行留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- 与 [`mc-breadcrumb`](../breadcrumb/) 同一条理由：**交互元素由使用者写在插槽里**，组件不造链接、也不改使用者的 DOM；状态（当前项 / 禁用）写在使用者的元素上，组件只按属性给外观。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
