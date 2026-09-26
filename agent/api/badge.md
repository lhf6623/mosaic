# mc-badge

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/badge/badge.html` · M1

| 名称      | 值                         | 默认      | 说明                                |
| --------- | -------------------------- | --------- | ----------------------------------- |
| `color`   | 同 button（无 `neutral`）  | `primary` | 语义色                              |
| `variant` | `solid` `subtle` `outline` | `subtle`  | 徽标默认用浅底，比 solid 更不抢视线 |
| `size`    | `sm` `md`                  | `md`      | 徽标只有两档                        |
| `dot`     | 布尔                       | —         | 只显示一个圆点，不显示内容          |
| `max`     | 数字                       | —         | 数值超过时显示 `max+`               |

```html
<mc-badge>新</mc-badge>
<mc-badge color="danger" variant="solid" :max="99">{{count}}</mc-badge>
<mc-badge dot color="success"></mc-badge>
```

---
