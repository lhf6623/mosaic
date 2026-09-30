# mc-textarea

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./textarea.html` · M2 · **已实现**

多行输入框。和 [`mc-input`](../input/api.md) 的分工：高度由 `rows` 与内容决定（另有自动增高与字数
统计），单行那套定高、横向滚动的行为归 input。

**值怎么读写**：HTML 里的初始值走属性 `default-value`，运行时值走宿主 DOM property `value`
（`el.value = '第一行\n第二行'` / `el.value`）—— `value` 不是属性，标签上写 `value="…"` 不生效。

```html
<mc-textarea placeholder="说点什么" rows="4"></mc-textarea>
<mc-textarea default-value="初始文案" name="remark" auto-resize maxlength="200"></mc-textarea>
```

```js
const el = document.querySelector('mc-textarea');
el.value = '第一行\n第二行';
el.addEventListener('input', (e) => console.log(e.data.value));
```

---

## 属性

| 名称            | 值                     | 默认 | 说明                                                        |
| --------------- | ---------------------- | ---- | ----------------------------------------------------------- |
| `default-value` | `string`               | —    | HTML 里的初始值；之后改它**不会**覆盖当前值                 |
| `placeholder`   | `string`               | —    | 占位符                                                      |
| `name`          | `string`               | —    | 表单字段名，转发给内部原生 `<textarea>`                     |
| `size`          | `'sm' \| 'md' \| 'lg'` | `md` | 尺寸：`min-height` 取 `--mc-control-h-*`，字号随档位        |
| `rows`          | `number`               | `3`  | 行数，转发给内部原生 `<textarea>` 的 `rows`                 |
| `auto-resize`   | `boolean`              | —    | 输入时把高度设成内容高度（`scrollHeight`），关掉即恢复      |
| `maxlength`     | `number`               | —    | 最大长度；**给了它才显示**右下角的 `当前/上限` 字数统计     |
| `disabled`      | `boolean`              | —    | 禁用，转发给内部原生 `<textarea>` 的 `disabled`             |
| `readonly`      | `boolean`              | —    | 只读，转发给内部原生 `<textarea>` 的 `readonly`             |
| `required`      | `boolean`              | —    | 必填，内部原生 `<textarea>` 上镜像成 `aria-required`        |
| `invalid`       | `boolean`              | —    | 校验失败：边框取 `--mc-color-danger`，镜像成 `aria-invalid` |

## 事件

| 名称     | 类型                                                   | 说明                                                                   |
| -------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `input`  | `(event: Event & { data: { value: string } }) => void` | 每次输入；`$event.data.value` 是当前值，`$event.target.value` 也读得到 |
| `change` | `(event: Event & { data: { value: string } }) => void` | 值确定变化（失焦 / 回车）；原生 `change` 穿不出 shadow，由组件转发     |

## 插槽与 part

| 名称            | 说明                                            |
| --------------- | ----------------------------------------------- |
| 插槽 `prefix`   | 第一行左侧的附加物；空着时不占位                |
| 插槽 `suffix`   | 第一行右侧的附加物；空着时不占位                |
| part="base"     | 行盒子：前后缀与输入区那一行                    |
| part="textarea" | 内部原生 `<textarea>` 本身                      |
| part="prefix"   | `prefix` 插槽的容器（颜色从这里继承给插槽内容） |
| part="suffix"   | `suffix` 插槽的容器（颜色从这里继承给插槽内容） |
| part="counter"  | 字数统计那一行；没有 `maxlength` 时不占位       |
