# mc-textarea

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./textarea.html` · **已实现**

多行输入框。和 [`mc-input`](../input/api.md) 的分工：高度由 `rows` 与内容决定（另有自动增高与字数
统计），单行那套定高、横向滚动的行为归 input。

**值怎么读写**：非受控的初值走属性 `default-value`；受控就把控件绑到你的数据上 ——
ofa 的 `:value="form.memo"`（单向）/ `sync:value="form.memo"`（双向）写的就是 `value` 属性
（内部原生 textarea 的真相没变，读写仍走宿主 property `el.value`）。

```html
<mc-textarea placeholder="说点什么" rows="4"></mc-textarea>
<mc-textarea default-value="初始文案" name="remark" auto-resize maxlength="200"></mc-textarea>
```

```js
const el = document.querySelector('mc-textarea');
el.value = '第一行\n第二行';
el.addEventListener('input', (e) => console.log(e.data.value));
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/textarea/textarea.html"></l-m>

<mc-textarea id="demo"></mc-textarea>

<script type="module">
  await customElements.whenDefined('mc-textarea');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/textarea/textarea.html"></l-m>

<mc-textarea></mc-textarea>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称            | 值                     | 默认 | 说明                                                                                                |
| --------------- | ---------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| `value`         | `string`               | —    | 值：绑定写这里 —— `sync:value="form.memo"` 双向、`:value` 单向；写它铺进内部 textarea，输入会写回它 |
| `default-value` | `string`               | —    | **非受控初值**；之后改它**不会**覆盖当前值                                                          |
| `placeholder`   | `string`               | —    | 占位符                                                                                              |
| `name`          | `string`               | —    | 表单字段名，转发给内部原生 `<textarea>`                                                             |
| `size`          | `'sm' \| 'md' \| 'lg'` | `md` | 尺寸：`min-height` 取 `--mc-control-h-*`，字号随档位                                                |
| `rows`          | `number`               | `3`  | 行数，转发给内部原生 `<textarea>` 的 `rows`                                                         |
| `auto-resize`   | `boolean`              | —    | 输入时把高度设成内容高度（`scrollHeight`），关掉即恢复                                              |
| `maxlength`     | `number`               | —    | 最大长度；**给了它才显示**右下角的 `当前/上限` 字数统计                                             |
| `disabled`      | `boolean`              | —    | 禁用，转发给内部原生 `<textarea>` 的 `disabled`                                                     |
| `readonly`      | `boolean`              | —    | 只读，转发给内部原生 `<textarea>` 的 `readonly`                                                     |
| `invalid`       | `boolean`              | —    | 校验失败：边框取 `--mc-color-danger`                                                                |

## 事件

| 名称     | 类型                                                   | 说明                                                                   |
| -------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `input`  | `(event: Event & { data: { value: string } }) => void` | 每次输入；`$event.data.value` 是当前值，`$event.target.value` 也读得到 |
| `change` | `(event: Event & { data: { value: string } }) => void` | 值确定变化时触发（失焦 / 回车），冒泡 + `composed`                     |

## 插槽

| 名称     | 说明                             |
| -------- | -------------------------------- |
| `prefix` | 第一行左侧的附加物；空着时不占位 |
| `suffix` | 第一行右侧的附加物；空着时不占位 |

## part

| 名称       | 说明                                            |
| ---------- | ----------------------------------------------- |
| `base`     | 行盒子：前后缀与输入区那一行                    |
| `textarea` | 内部原生 `<textarea>` 本身                      |
| `prefix`   | `prefix` 插槽的容器（颜色从这里继承给插槽内容） |
| `suffix`   | `suffix` 插槽的容器（颜色从这里继承给插槽内容） |
| `counter`  | 字数统计那一行；没有 `maxlength` 时不占位       |
