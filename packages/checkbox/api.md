# mc-checkbox

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./checkbox.html` · **已实现**

复选框：一行方框 + 文案，选中 / 半选 / 禁用 / 校验失败四个正交状态。
和 `mc-switch` 的分工：checkbox 是**表单里勾选若干项**（有一个中性态、有半选），
switch 是**立刻生效的开关**（只有开 / 关，没有半选）。

```html
<mc-checkbox checked>同意用户协议</mc-checkbox>
<mc-checkbox value="email" invalid>邮箱通知</mc-checkbox>
<mc-checkbox indeterminate>全选（已选 2 / 5）</mc-checkbox>
<!-- 自定义值：勾上给 "1"、没勾给 "0"（表单收集时就是这两个值，不再是布尔） -->
<mc-checkbox name="agree" checked-value="1" unchecked-value="0">同意</mc-checkbox>
```

`checked` / `indeterminate` **既是初始值也是运行时状态**：HTML 里写属性，JS 里读写同一个
DOM property（`el.checked = true` / `el.indeterminate = true` 写完立刻生效，不必等属性反射那一拍）。
`indeterminate` 是纯视觉状态 —— 原生没有这个 HTML 属性，它只在内部原生 input 的
`.indeterminate` 上，提交表单时按 `false` 算。

> `disabled` / `invalid` 是状态布尔，改它们走 `setAttribute` / `removeAttribute`
> （[`packages/README.md`](../README.md) §1.4）。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/checkbox/checkbox.html"></l-m>

<mc-checkbox id="demo"></mc-checkbox>

<script type="module">
  await customElements.whenDefined('mc-checkbox');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/checkbox/checkbox.html"></l-m>

<mc-checkbox></mc-checkbox>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称              | 值                     | 默认 | 说明                                                                                                                                             |
| ----------------- | ---------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`           | `string`               | —    | 本项的值：**只在同名一组里**当身份值报出去（组外的单个控件不用它，给了也还是布尔）                                                               |
| `checked-value`   | `string`               | —    | 自定义值：勾上时给的值。**写了它**，`mc-form` 收集单个控件时就给「`checked-value` / 没勾给 `unchecked-value`」，不写则给布尔（`true` / `false`） |
| `unchecked-value` | `string`               | —    | 自定义值：没勾上时给的值；`checked-value` 为空时不参与                                                                                           |
| `default-checked` | `boolean`              | —    | **非受控初值**（同 `mc-input` 的 `default-value`）：只在挂载时读一次，之后改它不再生效；受控用法写 `checked`，别两个都写                         |
| `checked`         | `boolean`              | —    | 选中（受控 / 运行时状态：宿主属性就是唯一真相，点了就跟着变）                                                                                    |
| `indeterminate`   | `boolean`              | —    | 半选（横杠），优先于 `checked` 显示                                                                                                              |
| `disabled`        | `boolean`              | —    | 禁用，转发给内部原生 input（<kbd>Tab</kbd> 会跳过）                                                                                              |
| `invalid`         | `boolean`              | —    | 校验失败，把方框换成危险色                                                                                                                       |
| `size`            | `'sm' \| 'md' \| 'lg'` | `md` | 控件高 / 内边距 / 字号；三档之外用宿主 `style="…"` 覆盖                                                                                          |

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
