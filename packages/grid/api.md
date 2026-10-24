# mc-grid / mc-grid-item

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./grid.html` + `./grid-item.html` · **已实现**

栅格，**容器 + 子项**两个标签：容器只决定列与间距（`display: grid`），子项决定自己跨几列。

```html
<mc-grid cols="3" gap="md">
  <mc-grid-item>一列</mc-grid-item>
  <mc-grid-item span="2">两列</mc-grid-item>
</mc-grid>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/grid/grid.html"></l-m>

<mc-grid id="demo"></mc-grid>

<script type="module">
  await customElements.whenDefined('mc-grid');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/grid/grid.html"></l-m>

<mc-grid></mc-grid>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

### mc-grid

| 名称             | 值                               | 默认 | 说明                                                                                         |
| ---------------- | -------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| `cols`           | `number`                         | —    | 列数；不写就是 1 列                                                                          |
| `gap`            | `'sm' \| 'md' \| 'lg' \| number` | `md` | 子项间距：三档映射 `--mc-space-2` / `-4` / `-6`，数字按 px（如 `gap="10"`）；非法值落回 `md` |
| `min-item-width` | `string`                         | —    | 子项最小宽度（如 `12rem`）：写它就按宽度自动折行，`cols` 让位                                |

### mc-grid-item

| 名称   | 值       | 默认 | 说明                            |
| ------ | -------- | ---- | ------------------------------- |
| `span` | `number` | `1`  | 跨几列（`grid-column: span n`） |

## 插槽

| 名称     | 说明                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------- |
| （默认） | **`mc-grid`（容器）**：放一组 `mc-grid-item`（也可以是任意元素）；**`mc-grid-item`**：这一格的内容 |
