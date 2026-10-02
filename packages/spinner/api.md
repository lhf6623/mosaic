# mc-spinner

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./spinner.html` · **已实现**

加载中指示器：一个开口的环，跟着周围的文字色与字号走。
和 `mc-progress` 的分工：spinner 说「还在跑，不知道要多久」，progress 说「跑到哪了」；
`mc-button` 的 `loading` 是「按钮自己进入加载态」，它内部画的是图标集里同一套描边风格的 spinner。

```html
<mc-spinner></mc-spinner>
<mc-spinner size="lg" color="primary"></mc-spinner>
<mc-spinner color="#ff6b35"></mc-spinner>
```

---

## 属性

| 名称    | 值                                                                                    | 默认      | 说明                                                                  |
| ------- | ------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `size`  | `'sm' \| 'md' \| 'lg'`                                                                | `md`      | 1em / 1.5em / 2em，随**继承来的**字号缩放（图形盒恒为 1em）           |
| `color` | `'current' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `current` | 默认继承周围的文字色；也可以是 hex（`#ff6b35`）。文字色就是图形的颜色 |
