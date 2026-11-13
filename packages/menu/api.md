# mc-menu / mc-menu-item

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./menu.html` + `./menu-item.html` · **已实现**

垂直菜单，**容器 + 菜单项**两个标签。用法只有一种：给 `options` 一个对象数组，容器自己渲染出
整棵树（分组、图标、层级缩进、二级菜单都在数据里）。`mc-menu-item` 也可以单独写（dropdown /
popover 的面板行），行内容一律由属性给，**没有插槽**：`label` / `href` / `icon` / `group` /
`current` / `disabled`。

`href` **照普通链接的写法写**：相对路径按 `document.baseURI` 解析，绝对路径 / 完整 URL 原样。
跳转方式由组件探测环境决定，使用者不写任何属性：行最近祖先（含跨 shadow）有 `o-app` 时，站内链接
自动渲染成 `olink` 形态（SPA 切换、地址栏 hash、前进后退与手写 `<a olink>` 完全一致，新标签页 /
复制链接也指向正确的路由地址）；不在 `o-app` 里就原样输出 `href`、浏览器原生跳转。
页内锚点（`#` 开头）与跨域链接恒走原生行为。
点击时派发可取消的 `navigate` 事件（`event.detail: { href, resolved, key, meta }`）：`key` 是这一行的
标识，`meta` 是数据里原样带过来的业务数据，`resolved` 是解析后的地址（站内 / 外链为绝对地址，页内锚点保持原值）；
宿主 `preventDefault()` 即可接管跳转。没有 `href` 的叶子行渲染成 `<button>`（按钮型用法）：
键盘可达、点击只发 `navigate` 事件不跳转，动作由宿主接。

```html
<!-- 数据驱动：容器自己渲染，children 逐级缩进，父级行是开合开关；当前项写在容器上 -->
<mc-menu id="nav" accordion current="home"></mc-menu>
<script type="module">
  document.querySelector('#nav').options = [
    { key: 'home', label: '首页', icon: 'menu', href: 'packages/menu/page.html' },
    { key: 'group-components', type: 'group', label: '组件' },
    {
      key: 'form',
      label: '表单',
      icon: 'settings',
      children: [
        { key: 'form/input', label: '输入框', href: 'packages/input/page.html' },
        { key: 'form/select', label: '下拉选择', href: 'packages/select/page.html' },
      ],
    },
    { key: 'disabled', label: '禁用项', icon: 'lock', disabled: true },
  ];
</script>

<!-- 压缩态：项上只留 icon；有子菜单的行鼠标移入后弹出浮层子菜单 -->
<mc-menu collapsed id="nav-compact"></mc-menu>
```

`options` 的字段见「属性」一节的 **`options` 的字段** 表，**每一项都必须写 `key`**（整棵树唯一、
值稳定；缺 / 重复直接报错），**业务数据放 `meta`**（组件不解释、不写进 DOM，随 `navigate` 事件原样带回）。
**当前项与展开状态都不在数据里** —— 写容器上的 `current`（= 命中行的 key）/ `expanded`，
路由切换只改这两个属性，行按 `key` 原地复用、不重建。
所有行与行内控件都在 `mc-menu` / `mc-menu-item` 的 shadow root 里；从外部查它们要穿 shadowRoot。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/menu/menu.html"></l-m>

<mc-menu id="demo"></mc-menu>

<script type="module">
  await customElements.whenDefined('mc-menu');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/menu/menu.html"></l-m>

<mc-menu></mc-menu>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

### mc-menu

| 名称        | 值                     | 默认 | 说明                                                                                                                                                                                                                                                                 |
| ----------- | ---------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`   | `string`               | —    | 菜单树数据（字段见下方「options 的字段」表）：JS property / `:options` 绑定传对象数组，整棵树由容器渲染，`href` 照普通链接的写法写（按 `document.baseURI` 解析）                                                                                                     |
| `size`      | `'sm' \| 'md' \| 'lg'` | `md` | 项高 / 内边距 / 字号；靠 `--mc-menu-*` 继承给菜单项（含嵌套的子菜单）                                                                                                                                                                                                |
| `current`   | `string`               | —    | 当前项：写命中行的 `key`。命中的行换底色 + 字重加粗，**它所在的分支自动展开**；换当前项只补开这一支，已经摊开的分支不收（`accordion` 下才收同层其它的，并优先留这一支）；对不上就是没有当前项。key 整棵树唯一，所以**只亮一行**，嵌套子菜单直接收同一个 key 自己命中 |
| `expanded`  | `boolean`              | —    | 默认展开：每个父级行开场就是展开的，并传给嵌套子菜单；`accordion` 下同层只留一个（`current` 那一支优先）                                                                                                                                                             |
| `collapsed` | `boolean`              | —    | 压缩态：整栏收窄成方形（`--mc-menu-collapsed-w`），项只留 `icon`；有子菜单的行鼠标移入 / 键盘聚焦时弹出浮层，子菜单在浮层里继续走浮层                                                                                                                                |
| `accordion` | `boolean`              | —    | 手风琴：同一层只保留一个展开的子菜单（同 `mc-collapse` 的口径，嵌套层各管各的）                                                                                                                                                                                      |

### mc-menu-item

| 名称       | 值        | 默认 | 说明                                                                                                                                               |
| ---------- | --------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `group`    | `boolean` | —    | 分组标题行：纯文字、不可交互、不缩进                                                                                                               |
| `icon`     | `string`  | —    | 图标名，语法同 `mc-icon` 的 `name`；图标不占点击区，压缩态下只剩它可见。在 `mc-menu` 里按整层判断留位（同层有任一行带 `icon`，本行也留出图标位）   |
| `label`    | `string`  | —    | 行文字（分组标题、父级、叶子都用它）。组件按它在 shadow 里造 `<a>` / `<button>` / 分组纯文字；不写就没有内容                                       |
| `href`     | `string`  | —    | `<a>` 的地址（照普通链接的写法写；在 `o-app` 里站内链接自动渲染成 olink 形态）；`disabled` 时不写。没有 `href` 的叶子行渲染成 `<button>`（按钮型） |
| `current`  | `boolean` | —    | 当前项（换底色 + 字重加粗），镜像成宿主 `data-current`；由 `mc-menu` 按容器的 `current` 算出哪一行                                                 |
| `disabled` | `boolean` | —    | 禁用（压暗 50% + `not-allowed`、悬停不亮），镜像成宿主 `data-disabled`；叶子行不给 `href`、父级行的按钮 `disabled`                                 |

### options 的字段

| 字段       | 类型       | 说明                                                                                                                                                                                                                |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`    | `string`   | 行文字（分组标题、父级行、叶子行都用它）；不给就是空行                                                                                                                                                              |
| `icon`     | `string`   | 图标名，语法同 `mc-icon` 的 `name`；只画在非分组行，压缩态下只剩它。同一层里有任一行带 `icon` 时，这一层没写的行也留出同样的图标位（文字与同层对齐）                                                                |
| `href`     | `string`   | 叶子行的地址：相对当前文档（`document.baseURI`）的路径、绝对路径或完整 URL；在 `o-app` 里站内链接走 ofa 路由，否则浏览器原生跳转；父级行与 `disabled` 行不给 `<a>`。没有 `href` 的叶子行渲染成 `<button>`（按钮型） |
| `disabled` | `boolean`  | 禁用：压暗 50% + `cursor: not-allowed`、悬停不亮，不给 `href`、也进不了焦点顺序                                                                                                                                     |
| `key`      | `string`   | **必填**：整棵树唯一、值稳定不随数据变化的标识。重新赋 `options` 时同一 key 的行原地复用（属性只更新、节点不重建），展开态也按它保留；`current` 也用它定位。缺 / 重复直接抛错，不做推导兜底                         |
| `type`     | `'group'`  | 分组标题行：不可交互、不缩进；带 `children` 时标题 + 组内条目**常显**并缩进一档，不带就是一条纯标题                                                                                                                 |
| `children` | `object[]` | 子菜单：父级行变成开合开关（压缩态换成浮层），数组里是同形状的对象、递归。层级由容器算，数据里不写 `level`                                                                                                          |
| `attrs`    | `object`   | 附加到行上的 HTML 属性：`target` / `rel` / `title` 转给内置 `<a>`，`style` 等留在行上。业务数据一律放 `meta`，不要塞 `data-*`                                                                                       |
| `meta`     | `unknown`  | 使用者放业务数据的地方：组件不解释、不写进 DOM，原样随 `navigate` 事件的 `detail.meta` 带回（路由节点 / 权限 / 埋点字段都放这里）                                                                                   |

## 事件

| 名称       | 类型                                                                                           | 说明                                                                                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigate` | `(event: CustomEvent<{ href: string, resolved: string, key: string, meta: unknown }>) => void` | 行被点击时在**行上**触发（冒泡 + `composed`，挂在容器上收全部行）：`href` 原值、`resolved` 解析后的地址（站内 / 外链为绝对地址，页内锚点保持原值）、`key` 行标识、`meta` 业务数据；没有 `href` 的行也发（按钮型用法）。**可取消**：`preventDefault()` 后跳转不再发生（ofa / 原生都掐掉） |

## part

| 名称   | 说明                                                 |
| ------ | ---------------------------------------------------- |
| `list` | **`mc-menu`（容器）**：内层列表容器（项间距 / 布局） |
