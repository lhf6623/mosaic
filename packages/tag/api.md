# mc-tag

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](../../agent/api/README.md)；踩坑见 [`../pitfalls/`](../../agent/pitfalls/README.md)。
> 源码 `./tag.html` · **已实现**

分类 / 状态标签。和 `mc-badge` 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互），
tag 是「内容本身」的标签 —— 它才有关闭与选中。

```html
<mc-tag color="success">已发布</mc-tag>
<mc-tag color="warning" variant="outline" size="sm">待审核</mc-tag>
<mc-tag closable on:close="onTagClose($event)">设计</mc-tag>
<mc-tag checkable selected color="primary" on:change="picked = $event.data.selected">已实现</mc-tag>
```

---

## 属性

| 名称        | 值                                                                       | 默认      | 说明                                                                                                                       |
| ----------- | ------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `color`     | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `neutral` | 语义色。默认中性 —— 标签是分类标记，语义色是强调；也可以是 hex（`#fff000` / `#fc0`），浅底按主题派生、文字色按对比度自动给 |
| `variant`   | `'subtle' \| 'solid' \| 'outline'`                                       | `subtle`  | 浅底深字 / 实心 / 描边（三档都保留 1px 边框，切换时高度不抖）                                                              |
| `size`      | `'sm' \| 'md' \| 'lg'`                                                   | `md`      | 只改字号与左右内边距；高度 = 行高 + 上下内边距 + 边框 = 26 / 30 / 34px                                                     |
| `closable`  | `boolean`                                                                | —         | 右侧出现 × 按钮（`aria-label="移除"`，命中区 24×24）                                                                       |
| `checkable` | `boolean`                                                                | —         | 整块可点，点击切换选中态                                                                                                   |
| `selected`  | `boolean`                                                                | —         | 选中态（配合 `checkable`）；运行时 `el.selected = true` 立刻生效                                                           |
| `disabled`  | `boolean`                                                                | —         | 压暗 50%，不可选也不可关                                                                                                   |

**`selected` 覆盖 `variant`**：选中态统一用该色的实心（`--mc-tag-fill` / `--mc-tag-on-fill`）。
所以可切换的标签用默认 `subtle` 才看得出变化；写死 `variant="solid"` 时选中前后一个样。

## 事件

| 名称     | 类型                                                       | 说明                                                                |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `change` | `(event: Event & { data: { selected: boolean } }) => void` | `checkable` 的选中态变化；冒泡 + `composed`，可挂在祖先上收全部标签 |
| `close`  | `(event: Event) => void`                                   | 点了 ×；冒泡 + `composed`，可挂在祖先上收全部标签                   |

## 插槽与 part

| 名称          | 说明                                               |
| ------------- | -------------------------------------------------- |
| 插槽 （默认） | 标签内容；`checkable` 时它同时是那个按钮的无障碍名 |
| part="close"  | 关闭按钮（×），单独换色 / 换形状用它               |
