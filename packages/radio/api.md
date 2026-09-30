# mc-radio / mc-radio-group

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./radio.html` + `./radio-group.html` · M2 · **已实现**

单选项，**容器 + 子项**两个标签：`mc-radio-group` 管互斥、方向、尺寸与事件，`mc-radio` 只是
一格（圆圈 + 文案）。**初始值写在 `default-value` 属性上，运行时值走宿主 DOM property `value`**
（`group.value = 'b'` 立刻生效；`group.setAttribute('value', …)` 不是运行时通道）。
`default-value` **只在挂载那一刻读一次** —— 之后改属性不会回头覆盖运行时值（规范 1.4：
标签属性是初始值，运行时要改用 property；同 `mc-input` 的口径）。

```html
<mc-radio-group name="plan" default-value="b" on:change="plan = $event.data.value">
  <mc-radio value="a">月付</mc-radio>
  <mc-radio value="b">年付（省两个月）</mc-radio>
  <mc-radio value="c" disabled>企业版</mc-radio>
</mc-radio-group>
```

---

## 属性

| 名称            | 值                     | 默认  | 说明                                                                           |
| --------------- | ---------------------- | ----- | ------------------------------------------------------------------------------ |
| `default-value` | `string`               | —     | **`mc-radio-group`**：HTML 初始值，对应哪个 `mc-radio` 的 `value`              |
| `name`          | `string`               | —     | **`mc-radio-group`**：字段名，转发给每个子项内部的原生 radio                   |
| `direction`     | `'row' \| 'column'`    | `row` | **`mc-radio-group`**：横排 / 竖排                                              |
| `disabled`      | `boolean`              | —     | 组上写 = 整组不可选（转发内部原生 radio 的 `disabled`）；子项上写 = 只禁这一格 |
| `size`          | `'sm' \| 'md' \| 'lg'` | `md`  | **`mc-radio-group`**：控件高 / 内边距 / 字号，靠自定义属性继承给子项           |
| `value`         | `string`               | —     | **`mc-radio`**：这一项的值，跟组的选中值比对                                   |

> 运行时读组成员用宿主 property `group.value`（见开场白）；子项的 `checked` 是只读镜像
> （`radio.checked` 写得到，但组的选中由 `group.value` 一个口子管）。

## 事件

| 名称     | 类型                                                   | 说明                                                      |
| -------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `change` | `(event: Event & { data: { value: string } }) => void` | 选中项变化时在**组**上触发；冒泡 + `composed`，值没变不发 |

## 插槽与 part

| 名称          | 说明                                                        |
| ------------- | ----------------------------------------------------------- |
| 插槽 （默认） | 组：放若干 `mc-radio`；子项：这一格的文案                   |
| part="base"   | 组：包住所有子项的那一行 / 那一列；子项：整格（原生 label） |
| part="circle" | **`mc-radio`**：圆圈本体                                    |
| part="label"  | **`mc-radio`**：文案容器                                    |
