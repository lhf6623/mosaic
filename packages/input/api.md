# mc-input

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./input.html` · M2 · **已实现**

单行输入框。和 [`mc-textarea`](../textarea/api.md) 的分工：这一份永远是**单行**（高度由 `size` 定死、
内容横向滚动），多行与自动增高归 textarea。

**值怎么读写**：HTML 里的初始值走属性 `default-value`，运行时值走宿主 DOM property `value`
（`el.value = '张三'` / `el.value`）—— `value` 不是属性，标签上写 `value="…"` 不生效。

```html
<mc-input placeholder="搜索" clearable></mc-input>
<mc-input default-value="张三" name="username" maxlength="20"></mc-input>
<mc-input>
  <span slot="prefix">¥</span>
  <span slot="suffix">元</span>
</mc-input>
```

```js
const el = document.querySelector('mc-input');
el.value = '李四';
el.addEventListener('change', (e) => console.log(e.data.value));
```

---

## 属性

| 名称            | 值                                                                          | 默认   | 说明                                                        |
| --------------- | --------------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `type`          | `'text' \| 'password' \| 'email' \| 'number' \| 'search' \| 'tel' \| 'url'` | `text` | 转发给内部原生 `<input>` 的 `type`                          |
| `default-value` | `string`                                                                    | —      | HTML 里的初始值；之后改它**不会**覆盖当前值                 |
| `placeholder`   | `string`                                                                    | —      | 占位符                                                      |
| `name`          | `string`                                                                    | —      | 表单字段名，转发给内部原生 `<input>`                        |
| `size`          | `'sm' \| 'md' \| 'lg'`                                                      | `md`   | 尺寸；高度取 `--mc-control-h-*`                             |
| `maxlength`     | `number`                                                                    | —      | 最大长度，转发给内部原生 `<input>`                          |
| `clearable`     | `boolean`                                                                   | —      | 有内容时右侧出现 × 原生按钮（`aria-label="清除"`）          |
| `disabled`      | `boolean`                                                                   | —      | 禁用，转发给内部原生 `<input>` 的 `disabled`                |
| `readonly`      | `boolean`                                                                   | —      | 只读，转发给内部原生 `<input>` 的 `readonly`                |
| `required`      | `boolean`                                                                   | —      | 必填，内部原生 `<input>` 上镜像成 `aria-required`           |
| `invalid`       | `boolean`                                                                   | —      | 校验失败：边框取 `--mc-color-danger`，镜像成 `aria-invalid` |

## 事件

| 名称     | 类型                                                   | 说明                                                                      |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `input`  | `(event: Event & { data: { value: string } }) => void` | 每次输入；`$event.data.value` 是当前值，`$event.target.value` 也读得到    |
| `change` | `(event: Event & { data: { value: string } }) => void` | 值确定变化（失焦 / 回车）；原生 `change` 穿不出 shadow，由组件转发（P19） |
| `clear`  | `(event: Event) => void`                               | 点了 ×；同一个动作还会补发 `input` 与 `change`                            |

## 插槽与 part

| 名称          | 说明                                            |
| ------------- | ----------------------------------------------- |
| 插槽 `prefix` | 输入框左侧附加物（单位、图标）；空着时不占位    |
| 插槽 `suffix` | 输入框右侧附加物；空着时不占位                  |
| part="base"   | 行盒子：前后缀、输入区、× 那一行                |
| part="input"  | 内部原生 `<input>` 本身                         |
| part="prefix" | `prefix` 插槽的容器（颜色从这里继承给插槽内容） |
| part="suffix" | `suffix` 插槽的容器（颜色从这里继承给插槽内容） |
