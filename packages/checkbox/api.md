# mc-checkbox

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./checkbox.html` · **已实现**

复选框：一行方框 + 文案，选中 / 半选 / 禁用 / 校验失败四个正交状态。
和 `mc-switch` 的分工：checkbox 是**表单里勾选若干项**（有一个中性态、有半选），
switch 是**立刻生效的开关**（只有开 / 关，没有半选）。

```html
<mc-checkbox checked>同意用户协议</mc-checkbox>
<mc-checkbox value="email" required invalid>邮箱通知</mc-checkbox>
<mc-checkbox indeterminate>全选（已选 2 / 5）</mc-checkbox>
```

`checked` / `indeterminate` **既是初始值也是运行时状态**：HTML 里写属性，JS 里读写同一个
DOM property（`el.checked = true` / `el.indeterminate = true` 写完立刻生效，不必等属性反射那一拍）。
`indeterminate` 是纯视觉状态 —— 原生没有这个 HTML 属性，它只在内部原生 input 的
`.indeterminate` 上，提交表单时按 `false` 算。

> `disabled` / `required` / `invalid` 是状态布尔，改它们走 `setAttribute` / `removeAttribute`
> （[`packages/README.md`](../README.md) §1.4）。

---

## 属性

| 名称            | 值                     | 默认 | 说明                                                    |
| --------------- | ---------------------- | ---- | ------------------------------------------------------- |
| `value`         | `string`               | —    | 表单值；跟原生 checkbox 的 `value` 一个意思             |
| `checked`       | `boolean`              | —    | 选中                                                    |
| `indeterminate` | `boolean`              | —    | 半选（横杠），优先于 `checked` 显示                     |
| `disabled`      | `boolean`              | —    | 禁用，转发给内部原生 input（读屏 / 键盘可感知）         |
| `required`      | `boolean`              | —    | 必填，转发成内部原生 input 的 `aria-required`           |
| `invalid`       | `boolean`              | —    | 校验失败，转发成 `aria-invalid` 并把方框换成危险色      |
| `size`          | `'sm' \| 'md' \| 'lg'` | `md` | 控件高 / 内边距 / 字号；三档之外用宿主 `style="…"` 覆盖 |

## 事件

| 名称     | 类型                                                                     | 说明                                                  |
| -------- | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| `change` | `(event: Event & { data: { checked: boolean; value: string } }) => void` | 勾选状态确定变化；冒泡 + `composed`，挂在祖先上也能收 |

## 插槽

| 名称     | 说明                             |
| -------- | -------------------------------- |
| （默认） | 文案；点它跟点方框一样会切换选中 |

## part

| 名称    | 说明                                                             |
| ------- | ---------------------------------------------------------------- |
| `base`  | 整行（内部那个原生 `<label>`，高度 / 内边距 / 命中区都在它上面） |
| `box`   | 方框本体；`::part(box)` 可改尺寸 / 圆角 / 边框                   |
| `label` | 文案容器                                                         |
