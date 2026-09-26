# mc-menu / mc-menu-item

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/menu/menu.html` + `packages/menu/menu-item.html` · **已实现**

垂直菜单，**容器 + 菜单项**两个标签，够撑起文档站那种侧栏导航。

**交互元素由使用者写在插槽里**（原生 `<a>` / `<button>`），组件不造链接、也不改使用者的
DOM：站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板（light DOM）里的
元素，shadow root 里造的 `<a>` 用不上（[P28](../pitfalls/07-layout.md)、[`docs/routes.js`](../../docs/routes.js)）。
代价是**状态也必须写在使用者的元素上**，组件只按属性给外观：

```html
<mc-menu>
  <mc-menu-item><a href="#/packages/button/page.html" aria-current="page">Button</a></mc-menu-item>
  <mc-menu-item><a href="#/packages/code/page.html">Code</a></mc-menu-item>
  <mc-menu-item group>布局</mc-menu-item>
  <mc-menu-item><a href="#/packages/collapse/page.html">Collapse</a></mc-menu-item>
</mc-menu>
```

**mc-menu（容器）**

| 名称      | 值                | 默认    | 说明                                                |
| --------- | ----------------- | ------- | --------------------------------------------------- |
| `size`    | `sm` `md` `lg`    | `md`    | 项高 / 内边距 / 字号；靠 `--mc-menu-*` 继承给菜单项 |
| `variant` | `plain` `surface` | `plain` | `surface` 加边框底色，当卡片用；`plain` 无外框      |

| 名称          | 说明                          |
| ------------- | ----------------------------- |
| 插槽（默认）  | 菜单项 `mc-menu-item`         |
| `part="list"` | 内层列表容器（项间距 / 布局） |

列表语义在容器上：`.mc-list` 是 `role="list"`，菜单项的 `role="listitem"` 由
**菜单项自己**补（`attached()` 里写，[P31](../pitfalls/01-props.md) 不允许在构造期往宿主写属性）；
使用者自己给 `mc-menu-item` 写了 `role` 就不覆盖。

**mc-menu-item（菜单项）**

| 名称    | 值   | 默认 | 说明                                       |
| ------- | ---- | ---- | ------------------------------------------ |
| `group` | 布尔 | —    | 分组标题行：纯文字、不可交互、不进列表语义 |

| 状态   | 写法                                                          | 组件做什么                                 |
| ------ | ------------------------------------------------------------- | ------------------------------------------ |
| 当前项 | 插槽元素上 `<a aria-current="page">`                          | 换底色字色 + 字重加粗（`false` 等于没写）  |
| 悬停   | 不用写                                                        | 整行浅底                                   |
| 禁用   | `<button disabled>`；`<a aria-disabled="true">` 并去掉 `href` | 压暗 50% + `cursor: not-allowed`，悬停不亮 |

**没有 `disabled` 属性**：链接原生就没有 disabled，组件又不改使用者的 DOM，
与其半吊子地「视觉禁用但键盘仍能激活」，不如把禁用写在原生元素上（`disabled` /
去掉 `href`）。同理**没有 `part`**：行盒子就在 `mc-menu-item` 自己身上。

组件把插槽元素的两个状态读出来、镜像成宿主属性，**这两个钩子可以直接拿来写外部样式**：

| 宿主钩子          | 什么时候有                                     | 用途                            |
| ----------------- | ---------------------------------------------- | ------------------------------- |
| `[data-current]`  | 插槽元素上 `aria-current` 不是 `false`         | 在外层 CSS 里给「当前项」写样式 |
| `[data-disabled]` | 插槽元素 `disabled`，或 `aria-disabled="true"` | 同上，禁用态                    |

> ⚠️ **行盒子（高度 / 内边距 / 底色 / 缩进）为什么在宿主上、不在插槽元素上**：
> 插槽元素同时是外层 shadow 树里的普通元素，`shadow-base.css` 对 `button` 的
> `padding` / `background` / `cursor` reset 是「直接命中」，按封装上下文压过组件内的
> `::slotted(button)`；`:host(:has(...))` 在 ofa.js 里又不生效，宿主「看不到孩子」。
> 所以视觉留宿主、插槽元素只当铺满整行的交互层、状态靠 JS 镜像 —— 完整推演见
> [P33](../pitfalls/03-style-scope.md)，实现见 `packages/menu/menu-item.html` 头部注释。
> 副作用：禁用项若用 `<button>`，光标可能仍是手型（reset 那一条压不过），用 `<a>` 正常。

| 令牌                           | 默认                        | 作用                |
| ------------------------------ | --------------------------- | ------------------- |
| `--mc-menu-item-h`             | `--mc-control-h-md`         | 项高（`size` 改它） |
| `--mc-menu-pad-x`              | `--mc-space-4`              | 左右内边距          |
| `--mc-menu-font`               | `--mc-text-sm`              | 字号                |
| `--mc-menu-gap`                | `--mc-space-1`              | 项间距              |
| `--mc-menu-radius`             | `--mc-radius-md`            | 行圆角              |
| `--mc-menu-item-color`         | `--mc-color-fg-muted`       | 普通项文字          |
| `--mc-menu-item-color-hover`   | `--mc-color-fg`             | 悬停文字            |
| `--mc-menu-item-color-current` | `--mc-color-primary`        | 当前项文字          |
| `--mc-menu-item-bg-hover`      | `--mc-color-surface-sunken` | 悬停底色            |
| `--mc-menu-item-bg-current`    | `--mc-color-primary-subtle` | 当前项底色          |
| `--mc-menu-group-color`        | `--mc-color-fg-subtle`      | 分组标题文字        |

> ⚠️ 菜单项同样**不能**给 `--mc-menu-*` 写默认值，否则会盖掉容器继承来的通道
> （和 `mc-collapse-item` 同一条坑），消费侧一律 `var(--mc-menu-x, 兜底)`。
