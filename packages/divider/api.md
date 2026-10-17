# mc-divider

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./divider.html` · **已实现**

分割线：一条线把内容分开，水平 / 竖直两个方向；线上可以放一段文字，线型与留白都能配。

```html
<p>上一段</p>
<mc-divider></mc-divider>
<p>下一段</p>

<mc-divider>或</mc-divider>
<mc-divider align="start">分组标题</mc-divider>
<mc-divider variant="dashed" spacing="sm"></mc-divider>

<mc-space align="stretch">
  <span>左</span>
  <mc-divider direction="vertical"></mc-divider>
  <span>右</span>
</mc-space>
```

---

## 属性

| 名称        | 值                                | 默认         | 说明                                                                                |
| ----------- | --------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `direction` | `'horizontal' \| 'vertical'`      | `horizontal` | 方向：水平线（默认，上下留白）/ 竖线（左右留白，高度跟父级交叉轴走）                |
| `variant`   | `'solid' \| 'dashed' \| 'dotted'` | `solid`      | 线型：实线 / 虚线 / 点线                                                            |
| `spacing`   | `'sm' \| 'md' \| 'lg' \| number`  | `md`         | 线两侧的留白：三档映射 `--mc-space-2` / `-4` / `-6`，数字按 px（如 `spacing="10"`） |
| `align`     | `'start' \| 'center' \| 'end'`    | `center`     | 中间内容的位置：两侧等长 / 偏左 / 偏右；只在水平线且线上有内容时生效                |

## 插槽

| 名称     | 说明                                                              |
| -------- | ----------------------------------------------------------------- |
| （默认） | 分割线中间的内容（文字 / 图标）；不写就是一条通长的线，两侧不留空 |

## part

| 名称   | 说明               |
| ------ | ------------------ |
| `line` | 中间内容两侧的线段 |
