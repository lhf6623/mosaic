# mc-tree-select

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./tree-select.html` · **已实现**

树型选择：触发框 + 面板里的一棵树，从层级数据里选一个节点。**数据驱动**，不配子标签 ——
给 `options` 一个对象数组，容器自己递归渲染。

和 [`mc-select`](../select/api.md) 的分工：select 是平铺选项；tree-select 是**带父子层级的单选**。
和 [`mc-menu`](../menu/api.md) 的分工：menu 是导航（行是链接 / 按钮、没有值）；tree-select 是表单控件
（有 `value` / `default-value` / `change`，并接入 `mc-form`）。

```html
<mc-tree-select placeholder="选择城市"></mc-tree-select>
<script type="module">
  const el = document.querySelector('mc-tree-select');
  el.options = [
    {
      value: 'zj',
      label: '浙江',
      children: [
        { value: 'hz', label: '杭州' },
        { value: 'nb', label: '宁波', disabled: true },
      ],
    },
    { value: 'js', label: '江苏', children: [{ value: 'nj', label: '南京' }] },
  ];
  el.value = 'hz';
  el.addEventListener('change', (event) => console.log(event.data.value));
</script>
```

`value` 是绑定通道（`:value` / `sync:value`）与运行时状态；非受控初值写 `default-value`。
节点字段：`value` / `label` / `children` / `disabled` / `expanded` / `lazy`。`options` 用 property 传数组，
属性通道只作 JSON 初始值（同 `mc-menu` / `mc-table`）。

**异步加载**用组件级 property `load`，不写进 `options`（JSON 装不下函数，分开也更方便复用）：

```html
<mc-tree-select id="city"></mc-tree-select>
<script type="module">
  const el = document.querySelector('#city');
  /* lazy: true 标记「子节点要异步取」；返回的数组就是它的 children */
  el.options = [
    { value: 'zj', label: '浙江', lazy: true },
    { value: 'sh', label: '上海' },
  ];
  el.load = async (node) => (await fetch('/children?parent=' + node.value)).json();
</script>
```

没有 `children`、且标了 `lazy: true` 的节点才是懒父级（第一次展开才调用 `load(原始节点)`）；
从 `load` 返回的节点默认是叶子，要再往下异步就继续给它们标 `lazy: true`。

**行模板插槽**用 light DOM 里的 `<template slot="option">`（行正文）/ `<template slot="icon">`（行首展开、收起图标）：组件逐行克隆，元素上的 `data-field="字段名"` 填文本、`data-field-attr="属性名:字段名"` 填属性；不给 `option` 就落回 `label` 文本，不给 `icon` 就用内置右箭头。

---

## 属性

### mc-tree-select

| 名称            | 值                               | 默认       | 说明                                                                                             |
| --------------- | -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `options`       | `string`                         | —          | 树数据：property 传对象数组（字段见下「options 字段」）；属性通道只作 JSON 初始值，property 优先 |
| `value`         | `string`                         | —          | 当前值（节点 `value`）：绑定通道与运行时状态；写属性或 property 都立刻生效                       |
| `default-value` | `string`                         | `''`       | 非受控初值：只在挂载时读一次，之后改它不再生效                                                   |
| `placeholder`   | `string`                         | `请选择`   | 没有选中节点时的文案                                                                             |
| `empty-text`    | `string`                         | `暂无数据` | `options` 为空时面板里的文案                                                                     |
| `clearable`     | `boolean`                        | —          | 有值时右端出现 ×；点它清空并发 `clear`                                                           |
| `disabled`      | `boolean`                        | —          | 禁用：不进焦点、不弹面板                                                                         |
| `readonly`      | `boolean`                        | —          | 只读：可聚焦，但不弹面板                                                                         |
| `invalid`       | `boolean`                        | —          | 校验失败：边框换成 `--mc-color-danger`                                                           |
| `size`          | `'sm' \| 'md' \| 'lg' \| number` | `md`       | 控件高 / 字号；纯数字按 px 设控件高                                                              |

### options 字段

| 字段       | 值         | 默认 | 说明                                                                                                                                         |
| ---------- | ---------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`    | `string`   | —    | 节点的身份值：`value` 比较、`mc-form` 收集都用它；同一棵树里不要重复                                                                         |
| `label`    | `string`   | —    | 触发框与行里显示的文字                                                                                                                       |
| `children` | `object[]` | —    | 子节点数组（同形状、递归）；没有就是叶子                                                                                                     |
| `disabled` | `boolean`  | —    | 禁用：该节点不可选，**子孙继承禁用**；但父级仍可展开 / 收起                                                                                  |
| `expanded` | `boolean`  | —    | 初始展开（只读初值）；展开 / 收起的结果不回写数据                                                                                            |
| `lazy`     | `boolean`  | —    | 懒父级标记：没有 `children` 且 `lazy: true`、组件又给了 `load` 时，第一次展开才调用 `load(原始节点)` 取子节点；失败发 `load-error`、再点重试 |

## 事件

| 名称         | 类型                                                                   | 说明                                                                  |
| ------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `change`     | `(event: Event & { data: { value: string } }) => void`                 | 值确定变化（选中 / 清除后各发一次）；冒泡 + `composed`                |
| `clear`      | `(event: Event) => void`                                               | 点了 × 清空（在 `change` **之前**发）                                 |
| `open`       | `(event: Event) => void`                                               | 面板已显示                                                            |
| `close`      | `(event: Event) => void`                                               | 面板已关闭（Esc / 点外部 / 选中后收起 / 再点触发框）                  |
| `load-error` | `(event: Event & { data: { value: string; error: unknown } }) => void` | 懒加载失败：载荷是节点 `value` 与错误对象；箭头会变危险色，再点可重试 |

## 插槽

| 名称      | 说明                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prefix`  | 触发框左侧附加物（图标 / 单位）；空着时不占位                                                                                                                |
| `chevron` | 触发框右端箭头；不给就落回内置下箭头，展开时容器整体转 180°                                                                                                  |
| `empty`   | `options` 为空时面板里的内容；给了就顶掉 `empty-text`                                                                                                        |
| `option`  | 行正文模板（`<template slot="option">`）：按行克隆，`data-field="label"` 填文本、`data-field-attr="class:iconClass"` 填属性                                  |
| `icon`    | 行首展开 / 收起图标模板（`<template slot="icon">`）：按行克隆，支持 `data-field` / `data-field-attr`；不给就用内置右箭头（展开时容器旋转），加载中仍显示转圈 |

## part

| 名称      | 说明                                                 |
| --------- | ---------------------------------------------------- |
| `base`    | 触发框（内部那个原生 `<button>`）                    |
| `panel`   | 面板本体（原生 popover，进 top layer）               |
| `option`  | 树里每一行（层级缩进走行上的 `--mc-tree-row-level`） |
| `expand`  | 行首的展开箭头（叶子行是一个等宽空位，用来对齐）     |
| `prefix`  | `prefix` 插槽的容器（颜色从这里继承给插槽内容）      |
| `chevron` | 触发框右端的箭头容器（展开旋转作用在这一层）         |
