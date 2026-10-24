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

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/skeleton/skeleton.html"></l-m>

<mc-skeleton id="demo"></mc-skeleton>

<script type="module">
  await customElements.whenDefined('mc-skeleton');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/skeleton/skeleton.html"></l-m>

<mc-skeleton></mc-skeleton>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称           | 值                               | 默认   | 说明                                                                                                                                                                         |
| -------------- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`      | `'rect' \| 'text' \| 'circle'`   | `rect` | 形状：矩形 / 文本行（小圆角）/ 圆形                                                                                                                                          |
| `size`         | `'sm' \| 'md' \| 'lg' \| number` | `md`   | 盒子形状的高度档：与 button / input 同一套控件高（28 / 36 / 44px）；纯数字按 px 设占位块高（`size="24"` → 24px）；`text` 按一行字高 `1em`，不认 `size`，显式 `height` 仍优先 |
| `width`        | `string`                         | —      | 宽度，CSS 长度；不写就是 `100%`（圆形不写时取高度当宽度，正圆）                                                                                                              |
| `height`       | `string`                         | —      | 高度，CSS 长度；不写就按 `size`（`text` 为 `1em`）                                                                                                                           |
| `no-animation` | `boolean`                        | —      | 关掉扫光，只留静态占位（存在即真；`prefers-reduced-motion: reduce` 下本来也会关）                                                                                            |
