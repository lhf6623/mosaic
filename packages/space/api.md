# mc-space

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./space.html` · **已实现**

一维间距容器：把一组元素排成一行或一列，相邻元素之间留同一档间距。

```html
<mc-space gap="sm">
  <mc-button variant="ghost">取消</mc-button>
  <mc-button color="primary">保存</mc-button>
</mc-space>

<mc-space direction="vertical" align="stretch">
  <mc-input placeholder="第一行"></mc-input>
  <mc-input placeholder="第二行"></mc-input>
</mc-space>
```

---

## 属性

| 名称            | 值                                                                  | 默认         | 说明                                                        |
| --------------- | ------------------------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| `direction`     | `'horizontal' \| 'vertical'`                                        | `horizontal` | 排列方向；纵向时宿主变成一列                                |
| `gap`           | `'sm' \| 'md' \| 'lg' \| number`                                    | `md`         | 子项间距：`sm` / `md` / `lg` 三档，或数字（单位 px）        |
| `justify`       | `'start' \| 'center' \| 'end' \| 'between' \| 'around' \| 'evenly'` | `start`      | 主轴分布（justify-content）；`start` / `end` 跟着主轴方向走 |
| `align`         | `'start' \| 'center' \| 'end' \| 'baseline' \| 'stretch'`           | —            | 交叉轴对齐；不写时横向居中、纵向拉伸                        |
| `reverse-order` | `boolean`                                                           | —            | 翻转主轴方向：横向 row-reverse、纵向 column-reverse         |
| `wrap-items`    | `boolean`                                                           | —            | 允许换行（行距与列距共用同一个 `gap`）                      |
| `block`         | `boolean`                                                           | —            | 撑满父容器宽度（`display: flex`）；默认是行内 `inline-flex` |

## 插槽

| 名称     | 说明                                 |
| -------- | ------------------------------------ |
| （默认） | 被排列的一组元素；直接子节点各算一项 |
