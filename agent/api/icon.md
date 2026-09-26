# mc-icon

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/icon/icon.html` · M1

**图标方案：内联 SVG sprite，不用 `@unocss/preset-icons`。**
理由：preset-icons 把每个图标转成 data-URI 的 CSS，**gzip 后每个仍占 120–440 B**，
200 个图标就是 25–80 KB 纯 CSS，而且无法 tree-shake。
sprite 方案下一个图标约 200 B，且能按需加载。

| 名称    | 值             | 默认      | 说明                                                                 |
| ------- | -------------- | --------- | -------------------------------------------------------------------- |
| `name`  | 图标名         | —         | 必填，对应 sprite 里的 symbol id                                     |
| `size`  | `sm` `md` `lg` | `md`      | 映射到 `1em` / `1.25em` / `1.5em`，随 `font-size` 缩放               |
| `color` | 同 button      | `current` | `current` 表示继承文字色                                             |
| `label` | 字符串         | —         | 有值时视为有语义图标，设 `aria-label`；无值时加 `aria-hidden="true"` |

| 名称     | 说明                        |
| -------- | --------------------------- |
| （默认） | 覆盖 `name`，直接放内联 SVG |

```html
<mc-icon name="search"></mc-icon> <mc-icon name="trash" label="删除" color="danger"></mc-icon>
```

---
