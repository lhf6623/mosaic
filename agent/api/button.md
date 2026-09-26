# mc-button

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/button/button.html` · **已实现**

| 名称       | 值                                                      | 默认      | 说明                          |
| ---------- | ------------------------------------------------------- | --------- | ----------------------------- |
| `color`    | `primary` `info` `success` `warning` `danger` `neutral` | `primary` | 语义色                        |
| `variant`  | `filled` `outline` `ghost`                              | `filled`  | 外观样式                      |
| `size`     | `sm` `md` `lg`                                          | `md`      | 尺寸                          |
| `type`     | `button` `submit` `reset`                               | `button`  | 转发给内部原生 button         |
| `disabled` | 布尔                                                    | —         | 禁用                          |
| `loading`  | 布尔                                                    | —         | 加载中，显示 spinner 且不可点 |
| `block`    | 布尔                                                    | —         | 撑满父容器宽度                |

| 名称     | 说明     |
| -------- | -------- |
| （默认） | 按钮文案 |
| `prefix` | 前置图标 |
| `suffix` | 后置图标 |

| 名称    | 类型                          | 说明                                         |
| ------- | ----------------------------- | -------------------------------------------- |
| `click` | `(event: MouseEvent) => void` | 原生事件，直接 `on:click` 监听，无自定义事件 |

| 令牌                    | 默认       | 作用                           |
| ----------------------- | ---------- | ------------------------------ |
| `--mc-button-fill`      | 按 `color` | `filled` 的底色                |
| `--mc-button-on-fill`   | 按 `color` | `filled` 上的文字色            |
| `--mc-button-accent`    | 按 `color` | `outline` / `ghost` 的线与文字 |
| `--mc-button-icon-size` | `1.25em`   | 按钮里图标的字号（见下）       |

**槽里的图标有一层特调**（`::slotted(mc-icon)`，只作用于按钮内部，不动图标集）：

- **尺寸比文字大一档**：按钮文字是 14px + `font-weight: 500`，同尺寸的描边型图标看着比文字轻
  （24px 画布 2px 描边缩到 14px 只剩 1.17px）。按钮这层把图标放到 `1.25em`（14px 文字 → 17.5px 图标）
  来补光学重量。想再调就覆盖 `--mc-button-icon-size`；`loading` 的那个 spinner 用同一个值。
- **颜色必须跟按钮文字色**：`filled` 取 `--mc-button-on-fill`、`outline` / `ghost` 取 `--mc-button-accent`，
  由 `color: inherit` 绑定。在按钮里 **`mc-icon` 自己的 `color` 属性会被压掉** —— 按钮的标签是整体，
  里面不该出现第二种颜色。按钮外的图标不受影响。

**定制**：视觉全部在 `:host` 上，直接写原生 CSS 即可。

```html
<mc-button color="danger" variant="outline" size="sm">删除</mc-button>
<mc-button color="success" loading>正在保存…</mc-button>
<mc-button block style="height: 48px; border-radius: 9999px">圆角大按钮</mc-button>
<mc-button><mc-icon slot="prefix" name="search"></mc-icon>搜索</mc-button>
```

---
