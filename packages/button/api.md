# mc-button

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `packages/button/button.html` · M1 · **已实现**

```html
<mc-button color="danger" variant="outline">删除</mc-button>
<mc-button color="success" loading>正在保存…</mc-button>
<mc-button><mc-icon slot="prefix" name="search"></mc-icon>搜索</mc-button>
```

---

## 属性

| 名称       | 值                                                                       | 默认      | 说明                                                                 |
| ---------- | ------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------- |
| `color`    | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `primary` | 语义色；也可以是 hex（`#fff000` / `#fc0`），此时文字色按对比度自动给 |
| `variant`  | `'filled' \| 'outline' \| 'ghost'`                                       | `filled`  | 外观样式                                                             |
| `size`     | `'sm' \| 'md' \| 'lg'`                                                   | `md`      | 尺寸                                                                 |
| `type`     | `'button' \| 'submit' \| 'reset'`                                        | `button`  | 转发给内部原生 button                                                |
| `disabled` | `boolean`                                                                | —         | 禁用                                                                 |
| `loading`  | `boolean`                                                                | —         | 加载中，显示 spinner 且不可点                                        |
| `block`    | `boolean`                                                                | —         | 撑满父容器宽度                                                       |
| `inline`   | `boolean`                                                                | —         | **行内文字按钮**形态：盒子交给文字，`size` 只选文字档位（见下）      |

> **`inline` 是「形态」，不是 `variant` 的第四个取值。** `variant` 只管三个色槽贴到哪儿，
> 盒子（控制高度 / 左右内边距）本来归 `size`；文字按钮要的是「盒子交给文字、`size` 只选字号」，
> 与外观正交，所以单开一个面（公共约定见 [`packages/README.md`](../README.md) §1.2）。
>
> - 推荐组合 `variant="ghost" inline`：只有文字色，无底无框，跟着正文基线走；
> - `size` 仍选三档，但只影响 `font-size`（+ 配对行高），三档盒子一样高；
> - 命中区 = 行高 + 上下透明内边距 = 24px（WCAG 2.5.8 最小目标）；`filled` / `outline`
>   会把底色 / 描边一起撑到 24 高（这两种组合按「贴字的胶囊」理解）；
> - 悬停走按钮本来那套 state layer（8% 当前色，左右各外扩一点）—— **不是下划线**，它是按钮不是链接；
> - 别和 `block` 一起用：一个要贴字、一个要撑满父容器。

## 插槽

| 名称     | 说明     |
| -------- | -------- |
| （默认） | 按钮文案 |
| `prefix` | 前置图标 |
| `suffix` | 后置图标 |
