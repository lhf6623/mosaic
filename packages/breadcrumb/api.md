# mc-breadcrumb / mc-breadcrumb-item

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./breadcrumb.html` + `./breadcrumb-item.html` · **已实现**

```html
<mc-breadcrumb separator="/" label="面包屑">
  <mc-breadcrumb-item><a href="/components">组件</a></mc-breadcrumb-item>
  <mc-breadcrumb-item><a href="/components/base">基础</a></mc-breadcrumb-item>
  <mc-breadcrumb-item current>Button</mc-breadcrumb-item>
</mc-breadcrumb>
```

---

## 属性

### mc-breadcrumb（容器）

| 名称        | 值       | 默认     | 说明                                                                   |
| ----------- | -------- | -------- | ---------------------------------------------------------------------- |
| `separator` | `string` | `/`      | 级与级之间的分隔符；非默认值优先于 `--mc-breadcrumb-sep`（空值按默认） |
| `label`     | `string` | `面包屑` | `<nav>` 的无障碍名（英文站写 `label="Breadcrumb"`）                    |

### mc-breadcrumb-item（一级）

| 名称      | 值        | 默认 | 说明                                                                    |
| --------- | --------- | ---- | ----------------------------------------------------------------------- |
| `current` | `boolean` | —    | 当前页（最后一级）：字色更实 + 字重加重，并自动补 `aria-current="page"` |

**每一级的交互元素由使用者写在插槽里**（原生 `<a>`），组件不造链接 —— 与 `mc-menu`
同一条理由：站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板里的元素。
当前页写纯文本 + `current`。列表语义：容器渲染 `<nav>` + `<ol role="list">`，
每一级的 `role="listitem"` 由组件补（使用者自己写了 `role` 就不覆盖）。

**没有 `size` / `variant`**：面包屑是一行文字导航，这两档不成立；改字号直接覆盖容器的
`font-size`。**不承诺插槽里放 `<button>`** —— 页面 reset 对 `button` 的优先级压过组件内的
`::slotted()`，要可点的级就用 `<a>`。

## 插槽与 part

两个标签共用默认插槽：容器的默认插槽放每一级 `mc-breadcrumb-item`，
一级的默认插槽放该级的链接或纯文本。

| 名称          | 说明                           |
| ------------- | ------------------------------ |
| 插槽 （默认） | 见上面这段（两处都是默认插槽） |
| part="base"   | 内层 `<nav>`                   |
| part="list"   | 内层 `<ol>`                    |
