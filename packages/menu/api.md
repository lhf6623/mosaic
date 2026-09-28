# mc-menu / mc-menu-item

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](../../agent/api/README.md)；踩坑见 [`../pitfalls/`](../../agent/pitfalls/README.md)。
> 源码 `./menu.html` + `./menu-item.html` · **已实现**

垂直菜单，**容器 + 菜单项**两个标签，够撑起文档站那种侧栏导航。

**交互元素由使用者写在插槽里**（原生 `<a>` / `<button>`），组件不造链接、也不改使用者的
DOM：站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板（light DOM）里的
元素，shadow root 里造的 `<a>` 用不上（[P28](../../agent/pitfalls/07-layout.md)、[`docs/routes.js`](../../docs/routes.js)）。
代价是**状态也必须写在使用者的元素上**，组件只按属性给外观。

```html
<mc-menu>
  <mc-menu-item><a href="#/packages/button/page.html" aria-current="page">Button</a></mc-menu-item>
  <mc-menu-item><a href="#/packages/code/page.html">Code</a></mc-menu-item>
  <mc-menu-item group>布局</mc-menu-item>
  <mc-menu-item><a href="#/packages/collapse/page.html">Collapse</a></mc-menu-item>
</mc-menu>
```

---

## 属性

### mc-menu（容器）

| 名称      | 值                | 默认    | 说明                                                |
| --------- | ----------------- | ------- | --------------------------------------------------- |
| `size`    | `sm` `md` `lg`    | `md`    | 项高 / 内边距 / 字号；靠 `--mc-menu-*` 继承给菜单项 |
| `variant` | `plain` `surface` | `plain` | `surface` 加边框底色，当卡片用；`plain` 无外框      |

列表语义在容器上：`.mc-list` 是 `role="list"`，菜单项的 `role="listitem"` 由
**菜单项自己**补（`attached()` 里写，[P31](../../agent/pitfalls/01-props.md) 不允许在构造期往宿主写属性）；
使用者自己给 `mc-menu-item` 写了 `role` 就不覆盖。

### mc-menu-item（菜单项）

| 名称    | 值   | 默认 | 说明                                       |
| ------- | ---- | ---- | ------------------------------------------ |
| `group` | 布尔 | —    | 分组标题行：纯文字、不可交互、不进列表语义 |

**没有 `disabled` 属性**：链接原生就没有 disabled，组件又不改使用者的 DOM，
与其半吊子地「视觉禁用但键盘仍能激活」，不如把禁用写在原生元素上（`disabled` /
去掉 `href`）。同理**没有 `part`**：行盒子就在 `mc-menu-item` 自己身上。

### 状态写在插槽元素上

| 状态   | 写法                                                          | 组件做什么                                 |
| ------ | ------------------------------------------------------------- | ------------------------------------------ |
| 当前项 | 插槽元素上 `<a aria-current="page">`                          | 换底色字色 + 字重加粗（`false` 等于没写）  |
| 悬停   | 不用写                                                        | 整行浅底                                   |
| 禁用   | `<button disabled>`；`<a aria-disabled="true">` 并去掉 `href` | 压暗 50% + `cursor: not-allowed`，悬停不亮 |

组件把插槽元素的两个状态读出来、镜像成宿主属性，**这两个钩子可以直接拿来写外部样式**：

| 宿主钩子          | 什么时候有                                     | 用途                            |
| ----------------- | ---------------------------------------------- | ------------------------------- |
| `[data-current]`  | 插槽元素上 `aria-current` 不是 `false`         | 在外层 CSS 里给「当前项」写样式 |
| `[data-disabled]` | 插槽元素 `disabled`，或 `aria-disabled="true"` | 同上，禁用态                    |

## 插槽

两个标签共用默认插槽：容器的默认插槽放菜单项 `mc-menu-item`，
菜单项的默认插槽放该行的链接或按钮（纯文本亦可，分组标题就是这么写的）。

| 名称     | 说明                           |
| -------- | ------------------------------ |
| （默认） | 见上面这段（两处都是默认插槽） |

## part

| 名称   | 说明                          |
| ------ | ----------------------------- |
| `list` | 内层列表容器（项间距 / 布局） |
