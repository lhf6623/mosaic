# mc-progress

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](../../agent/api/README.md)；踩坑见 [`../pitfalls/`](../../agent/pitfalls/README.md)。
> 源码 `./progress.html` · M2 · **已实现**

进度条：一条轨道 + 一条填充。确定态用 `value` / `max` 表示跑到哪了，不确定态只说「还在跑」。
和 `mc-spinner` 的分工：spinner 是**不知道要多久**，progress 是**知道进度**；
两者都是「把状态告诉使用者」，但一个说不出数、一个说得出。

```html
<mc-progress value="40"></mc-progress>
<mc-progress value="150" max="200" color="success"></mc-progress>
<mc-progress indeterminate></mc-progress>
```

---

## 属性

| 名称            | 值                                                          | 默认      | 说明                                                                  |
| --------------- | ----------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `value`         | `number`                                                    | —         | 当前值。运行时也可以走 property（`el.value = 50`，当次就重绘）        |
| `max`           | `number`                                                    | `100`     | 上限，比例 = `value / max`（超出会被夹到 100%）；同样有 property      |
| `indeterminate` | `boolean`                                                   | —         | 不确定态：填充条自己滑，不写 `aria-valuenow`，改用 `aria-busy="true"` |
| `color`         | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | `primary` | 语义色，只往填充色槽里填值；也可以是 hex（`#1a7f5a`）                 |
| `size`          | `'sm' \| 'md'`                                              | `md`      | 轨道高 4 / 8px（进度条不是控件，不借 `--mc-control-h-*`）             |

## part

| 名称       | 说明                                     |
| ---------- | ---------------------------------------- |
| part="bar" | 内部填充条；换色 / 换形状 / 加条纹都改它 |
