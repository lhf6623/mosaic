# mc-menu / mc-menu-item

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./menu.html` + `./menu-item.html` · **已实现**

垂直菜单，**容器 + 菜单项**两个标签。**推荐用法只有一种**：给 `options` 一个对象数组，容器
自己渲染出整棵树（分组、图标、层级缩进、二级菜单都在数据里），不用写菜单项标签。

`mc-menu-item` 的属性（内置 `<a>`）与插槽（自备控件）是**内部 / 兼容通道** —— `mc-menu` 渲染每一行
用的就是它们；只在要 `olink` 或插槽里放别的东西时才手写，**不推荐**当常规用法。
`olink` 是编译期指令，只作用于**模板里**的元素，运行时 `createElement` 造出来的拿不到
（[`docs/routes.js`](../../docs/routes.js)）—— 所以 `options` 里的 `href` 必须是**最终地址**，
部署前缀由站点自己补（文档站用 `hashOf()`）；插槽里那个 `<a>` 是使用者写在模板里的，照常吃 `olink`。

```html
<!-- 数据驱动：容器自己渲染，children 逐级缩进，父级行是开合开关 -->
<mc-menu id="nav" accordion></mc-menu>
<script type="module">
  document.querySelector('#nav').options = [
    { label: '首页', icon: 'menu', href: hashOf('packages/menu/page.html'), current: true },
    { type: 'group', label: '组件' },
    {
      label: '表单',
      icon: 'settings',
      children: [
        { label: '输入框', href: hashOf('packages/input/page.html') },
        { label: '下拉选择', href: hashOf('packages/select/page.html') },
      ],
    },
    { label: '禁用项', icon: 'lock', disabled: true },
  ];
</script>

<!-- 压缩态：项上只留 icon；有子菜单的行鼠标移入后弹出浮层子菜单 -->
<mc-menu collapsed id="nav-compact"></mc-menu>

<!-- 兼容（不推荐）：自备控件 —— 只有要 olink / 插槽里放别的东西时才写，当前项写 data-current -->
<mc-menu>
  <mc-menu-item icon="menu">
    <a href="../button/page.html" olink data-current>Button</a>
  </mc-menu-item>
  <mc-menu-item group>布局</mc-menu-item>
  <mc-menu-item icon="folder"><a href="../collapse/page.html" olink>Collapse</a></mc-menu-item>
</mc-menu>
```

`options` 的字段：`label` / `icon` / `href`（最终地址）/ `current` / `disabled` / `attrs`（附加到行上的属性：
`target` / `rel` / `title` 转给内置 `<a>`，`data-*` 留在行上给宿主钩子用），
分组用 `type: 'group'`（带 `children` 时标题 + 组内条目常显、缩进一档；不带就是一条纯标题），
子菜单用 `children`（同形状的数组，递归；层级由容器算，数据里没有 `level`）。

---

## 属性

### mc-menu（容器）

| 名称        | 值                     | 默认 | 说明                                                                                                                                                  |
| ----------- | ---------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`      | `'sm' \| 'md' \| 'lg'` | `md` | 项高 / 内边距 / 字号；靠 `--mc-menu-*` 继承给菜单项（含嵌套的子菜单）                                                                                 |
| `collapsed` | `boolean`              | —    | 压缩态：整栏收窄成方形（`--mc-menu-collapsed-w`），项只留 `icon`；有子菜单的行鼠标移入 / 键盘聚焦时弹出浮层，子菜单在浮层里继续走浮层                 |
| `accordion` | `boolean`              | —    | 手风琴：同一层只保留一个展开的子菜单（同 `mc-collapse` 的口径，嵌套层各管各的）                                                                       |
| `options`   | `string`               | —    | 数据驱动渲染：JSON 字符串（属性通道只作初始值），运行时用 property 传 `{ label, icon, href, current, disabled, children, type }[]`；`href` 是最终地址 |

### mc-menu-item（菜单项 · 内部 / 兼容通道，不推荐手写）

| 名称       | 值        | 默认 | 说明                                                                                             |
| ---------- | --------- | ---- | ------------------------------------------------------------------------------------------------ |
| `group`    | `boolean` | —    | 分组标题行：纯文字、不可交互、不缩进                                                             |
| `icon`     | `string`  | —    | 图标名，语法同 `mc-icon` 的 `name`；图标不占点击区，压缩态下只剩它可见                           |
| `label`    | `string`  | —    | **内置行**：行文字。给了它且插槽为空时，组件自己造 `<a>`（带 `data-expandable` 时造 `<button>`） |
| `href`     | `string`  | —    | **内置行**：`<a>` 的地址（最终地址）；`disabled` 时不写                                          |
| `current`  | `boolean` | —    | **内置行**：当前项，镜像成宿主 `data-current`                                                    |
| `disabled` | `boolean` | —    | **内置行**：禁用，镜像成宿主 `data-disabled`；叶子行不给 `href`、父级行的按钮 `disabled`         |

### 状态

| 状态     | 写法                                                                           | 组件做什么                                           |
| -------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 当前项   | 内置行：行上写 `current`；自备控件：插槽元素上 `<a data-current>`              | 换底色字色 + 字重加粗                                |
| 悬停     | 不用写                                                                         | 整行浅底                                             |
| 禁用     | 内置行：行上写 `disabled`；自备控件：`<button disabled>` / `<a data-disabled>` | 压暗 50% + `cursor: not-allowed`，悬停不亮           |
| 浮层打开 | 不用写（鼠标移入 / 键盘聚焦，压缩态才有）                                      | 锚点行挂 `data-open`，保持「这条分支开着」的悬停观感 |

## 插槽

| 名称     | 说明                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| （默认） | **`mc-menu`（容器）**：放菜单项；**`mc-menu-item`**：放该行的链接或按钮（纯文本亦可，分组标题就是这么写的） |

## part

| 名称   | 说明                                                 |
| ------ | ---------------------------------------------------- |
| `list` | **`mc-menu`（容器）**：内层列表容器（项间距 / 布局） |
