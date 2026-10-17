# mc-skeleton

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./skeleton.html` · **已实现**

骨架屏：加载时先把内容的位置占住，形状、尺寸与配色都能直接配。

```html
<mc-skeleton></mc-skeleton>
<mc-skeleton size="lg" width="10rem"></mc-skeleton>
<mc-skeleton variant="text" width="60%"></mc-skeleton>
<mc-skeleton variant="circle" size="md"></mc-skeleton>
<mc-skeleton no-animation></mc-skeleton>
```

---

## 属性

| 名称           | 值                             | 默认   | 说明                                                                                                     |
| -------------- | ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------- |
| `variant`      | `'rect' \| 'text' \| 'circle'` | `rect` | 形状：矩形 / 文本行（小圆角）/ 圆形                                                                      |
| `size`         | `'sm' \| 'md' \| 'lg'`         | `md`   | 盒子形状的高度档：与 button / input 同一套控件高（28 / 36 / 44px）；`text` 按一行字高 `1em`，不认 `size` |
| `width`        | `string`                       | —      | 宽度，CSS 长度；不写就是 `100%`（圆形不写时取高度当宽度，正圆）                                          |
| `height`       | `string`                       | —      | 高度，CSS 长度；不写就按 `size`（`text` 为 `1em`）                                                       |
| `no-animation` | `boolean`                      | —      | 关掉扫光，只留静态占位（存在即真；`prefers-reduced-motion: reduce` 下本来也会关）                        |
