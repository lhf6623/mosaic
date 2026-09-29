# mc-grid / mc-grid-item

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](../../agent/api/README.md)；踩坑见 [`../pitfalls/`](../../agent/pitfalls/README.md)。
> 源码 `./grid.html` + `./grid-item.html` · M3 · **已实现**

栅格，**容器 + 子项**两个标签：容器只决定列与间距（`display: grid`），子项决定自己跨几列。

```html
<mc-grid cols="3" gap="md">
  <mc-grid-item>一列</mc-grid-item>
  <mc-grid-item span="2">两列</mc-grid-item>
</mc-grid>
```

---

## 属性

### mc-grid（容器）

| 名称             | 值                     | 默认 | 说明                                                                                                   |
| ---------------- | ---------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| `cols`           | `number`               | —    | 列数；不写就是 1 列                                                                                    |
| `gap`            | `'sm' \| 'md' \| 'lg'` | `md` | 子项间距，映射到 `--mc-space-2` / `--mc-space-4` / `--mc-space-6`                                      |
| `min-item-width` | `string`               | —    | 子项最小宽度（如 `12rem`）：列数改由 `repeat(auto-fill, minmax(<它>, 1fr))` 自动决定，此时 `cols` 让位 |

### mc-grid-item（子项）

| 名称   | 值       | 默认 | 说明                            |
| ------ | -------- | ---- | ------------------------------- |
| `span` | `number` | `1`  | 跨几列（`grid-column: span n`） |

## 插槽

| 名称     | 说明                                                    |
| -------- | ------------------------------------------------------- |
| （默认） | 栅格子项，通常是一组 `mc-grid-item`（也可以是任意元素） |
