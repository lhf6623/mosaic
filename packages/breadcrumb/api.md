# mc-breadcrumb / mc-breadcrumb-item

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./breadcrumb.html` + `./breadcrumb-item.html` · **已实现**

```html
<mc-breadcrumb separator="/">
  <mc-breadcrumb-item><a href="/components">组件</a></mc-breadcrumb-item>
  <mc-breadcrumb-item><a href="/components/base">基础</a></mc-breadcrumb-item>
  <mc-breadcrumb-item current>Button</mc-breadcrumb-item>
</mc-breadcrumb>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/breadcrumb/breadcrumb.html"></l-m>

<mc-breadcrumb id="demo"></mc-breadcrumb>

<script type="module">
  await customElements.whenDefined('mc-breadcrumb');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/breadcrumb/breadcrumb.html"></l-m>

<mc-breadcrumb></mc-breadcrumb>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

### mc-breadcrumb

| 名称        | 值       | 默认 | 说明                                                                   |
| ----------- | -------- | ---- | ---------------------------------------------------------------------- |
| `separator` | `string` | `/`  | 级与级之间的分隔符；非默认值优先于 `--mc-breadcrumb-sep`（空值按默认） |

### mc-breadcrumb-item

| 名称      | 值        | 默认 | 说明                                    |
| --------- | --------- | ---- | --------------------------------------- |
| `current` | `boolean` | —    | 当前页（最后一级）：字色更实 + 字重加重 |

## 插槽

| 名称     | 说明                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| （默认） | **`mc-breadcrumb`（容器）**：放每一级；**`mc-breadcrumb-item`**：放该级的链接或纯文本 |

## part

| 名称   | 说明                                      |
| ------ | ----------------------------------------- |
| `base` | **`mc-breadcrumb`（容器）**：内层 `<nav>` |
| `list` | **`mc-breadcrumb`（容器）**：内层 `<ol>`  |
