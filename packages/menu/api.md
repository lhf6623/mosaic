# mc-menu / mc-menu-item

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./menu.html` + `./menu-item.html` · **已实现**

垂直菜单，**容器 + 菜单项**两个标签，够撑起文档站那种侧栏导航。

**交互元素由使用者写在插槽里**（原生 `<a>` / `<button>`），组件不造链接、也不改使用者的
DOM：站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板（light DOM）里的
元素，shadow root 里造的 `<a>` 用不上（[`docs/routes.js`](../../docs/routes.js)）。
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

| 名称      | 值                     | 默认    | 说明                                                |
| --------- | ---------------------- | ------- | --------------------------------------------------- |
| `size`    | `'sm' \| 'md' \| 'lg'` | `md`    | 项高 / 内边距 / 字号；靠 `--mc-menu-*` 继承给菜单项 |
| `variant` | `'plain' \| 'surface'` | `plain` | `surface` 加边框底色，当卡片用；`plain` 无外框      |

### mc-menu-item（菜单项）

| 名称    | 值        | 默认 | 说明                                       |
| ------- | --------- | ---- | ------------------------------------------ |
| `group` | `boolean` | —    | 分组标题行：纯文字、不可交互、不进列表语义 |

### 状态与宿主钩子

| 状态   | 写法                                                          | 组件做什么                                 |
| ------ | ------------------------------------------------------------- | ------------------------------------------ |
| 当前项 | 插槽元素上 `<a aria-current="page">`                          | 换底色字色 + 字重加粗（`false` 等于没写）  |
| 悬停   | 不用写                                                        | 整行浅底                                   |
| 禁用   | `<button disabled>`；`<a aria-disabled="true">` 并去掉 `href` | 压暗 50% + `cursor: not-allowed`，悬停不亮 |

| 宿主钩子          | 什么时候有                                     | 能做什么（怎么写）                                                          |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `[data-current]`  | 插槽元素上 `aria-current` 不是 `false`         | `mc-menu-item[data-current] { … }`：外层给当前项加记号（演示里那条竖条）    |
| `[data-disabled]` | 插槽元素 `disabled`，或 `aria-disabled="true"` | `mc-menu-item[data-disabled] { … }`：外层给禁用项加样式（演示里那个虚线框） |

## 插槽

| 名称     | 说明                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- |
| （默认） | 容器里放菜单项 `mc-menu-item`；菜单项里放该行的链接或按钮（纯文本亦可，分组标题就是这么写的） |

## part

| 名称   | 说明                          |
| ------ | ----------------------------- |
| `list` | 内层列表容器（项间距 / 布局） |
