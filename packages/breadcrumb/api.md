# mc-breadcrumb / mc-breadcrumb-item

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
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

## 插槽

| 名称     | 说明                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| （默认） | **`mc-breadcrumb`（容器）**：放每一级；**`mc-breadcrumb-item`**：放该级的链接或纯文本 |

## part

| 名称   | 说明                                      |
| ------ | ----------------------------------------- |
| `base` | **`mc-breadcrumb`（容器）**：内层 `<nav>` |
| `list` | **`mc-breadcrumb`（容器）**：内层 `<ol>`  |
