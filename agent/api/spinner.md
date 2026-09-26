# mc-spinner

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/spinner/spinner.html` · M1

| 名称    | 值                 | 默认      | 说明                                   |
| ------- | ------------------ | --------- | -------------------------------------- |
| `size`  | `sm` `md` `lg`     | `md`      | 1em / 1.5em / 2em，随 `font-size` 缩放 |
| `color` | `current` 或语义色 | `current` | 默认继承文字色                         |
| `label` | 字符串             | `加载中`  | 屏幕阅读器文案                         |

```html
<mc-spinner></mc-spinner> <mc-spinner size="lg" color="primary" label="正在同步"></mc-spinner>
```

---
