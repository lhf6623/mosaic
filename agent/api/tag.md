# mc-tag

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/tag/tag.html` · **已实现**

分类 / 状态标签。和 `mc-badge` 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互），
tag 是「内容本身」的标签 —— 它才有关闭与选中。

| 名称        | 值                                                      | 默认      | 说明                                                                   |
| ----------- | ------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `color`     | `primary` `info` `success` `warning` `danger` `neutral` | `neutral` | 语义色。默认中性 —— 标签是分类标记，语义色是强调                       |
| `variant`   | `subtle` `solid` `outline`                              | `subtle`  | 浅底深字 / 实心 / 描边（三档都保留 1px 边框，切换时高度不抖）          |
| `size`      | `sm` `md` `lg`                                          | `md`      | 只改字号与左右内边距；高度 = 行高 + 上下内边距 + 边框 = 26 / 30 / 34px |
| `closable`  | 布尔                                                    | —         | 右侧出现 × 按钮（`aria-label="移除"`，命中区 24×24）                   |
| `checkable` | 布尔                                                    | —         | 整块可点，点击切换选中态                                               |
| `selected`  | 布尔                                                    | —         | 选中态（配合 `checkable`）；运行时 `el.selected = true` 立刻生效       |
| `disabled`  | 布尔                                                    | —         | 压暗 50%，不可选也不可关                                               |

| 名称           | 说明                                               |
| -------------- | -------------------------------------------------- |
| 插槽（默认）   | 标签内容；`checkable` 时它同时是那个按钮的无障碍名 |
| `part="close"` | 关闭按钮（×），单独换色 / 换形状用它               |

| 名称     | 类型                                                       | 说明                                                                |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `change` | `(event: Event & { data: { selected: boolean } }) => void` | `checkable` 的选中态变化；冒泡 + `composed`，可挂在祖先上收全部标签 |
| `close`  | `(event: Event) => void`                                   | 点了 ×；冒泡 + `composed`，可挂在祖先上收全部标签                   |

**`selected` 覆盖 `variant`**：选中态统一用该色的实心（`--mc-tag-fill` / `--mc-tag-on-fill`）。
所以可切换的标签用默认 `subtle` 才看得出变化；写死 `variant="solid"` 时选中前后一个样。

**`closable` 只发 `close`，不删 DOM**（组件不改使用者的 DOM，同 `mc-menu` / `mc-breadcrumb`）：
自己在事件里 `el.remove()` 或改数据。可关 + 可选同时开时，× 压在 toggle 层上面（z-index 分开），
点 × 只关不选。

**交互元素都是原生按钮**：`checkable` 是 shadow 里一个铺满宿主的透明 `<button aria-pressed>`
（名字从插槽文本镜像过来），`closable` 的 × 是 `part="close"` 的原生按钮 —— 键盘
<kbd>Space</kbd> / <kbd>Enter</kbd> 可切换，焦点环用 `--mc-color-ring`。

| 令牌                    | 默认                            | 作用                                         |
| ----------------------- | ------------------------------- | -------------------------------------------- |
| `--mc-tag-fill`         | 按 `color`                      | `solid` 与选中态的底色                       |
| `--mc-tag-on-fill`      | 按 `color`                      | 实心上的文字色                               |
| `--mc-tag-accent`       | 按 `color`                      | `subtle` 的文字、`outline` 的线与文字        |
| `--mc-tag-subtle-fill`  | 按 `color`                      | `subtle` 的浅底（中性色用 surface-sunken）   |
| `--mc-tag-pad-x` / `-y` | `--mc-space-3` / `--mc-space-1` | 左右 / 上下内边距                            |
| `--mc-tag-gap`          | `--mc-space-1`                  | 内容与关闭图标之间的间距                     |
| `--mc-tag-close-size`   | `1.25em`                        | 关闭图标的字号（命中区固定 24×24，不受影响） |
| `--mc-tag-radius`       | `--mc-radius-md`                | 圆角（全圆角写 `--mc-radius-full`）          |

```html
<mc-tag color="success">已发布</mc-tag>
<mc-tag color="warning" variant="outline" size="sm">待审核</mc-tag>
<mc-tag closable on:close="onTagClose($event)">设计</mc-tag>
<mc-tag checkable selected color="primary" on:change="picked = $event.data.selected">已实现</mc-tag>
```

---
