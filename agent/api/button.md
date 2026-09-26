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

| 令牌                  | 默认       | 作用                           |
| --------------------- | ---------- | ------------------------------ |
| `--mc-button-fill`    | 按 `color` | `filled` 的底色                |
| `--mc-button-on-fill` | 按 `color` | `filled` 上的文字色            |
| `--mc-button-accent`  | 按 `color` | `outline` / `ghost` 的线与文字 |

**定制**：视觉全部在 `:host` 上，直接写原生 CSS 即可。

```html
<mc-button color="danger" variant="outline" size="sm">删除</mc-button>
<mc-button color="success" loading>正在保存…</mc-button>
<mc-button block style="height: 48px; border-radius: 9999px">圆角大按钮</mc-button>
<mc-button><span slot="prefix">🔍</span>搜索</mc-button>
```

---
