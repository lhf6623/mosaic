# mc-switch

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./switch.html` · **已实现**

开关：只有开 / 关两态，**改完立刻生效**（没有「保存」这一步）。
和 `mc-checkbox` 的分工：checkbox 是表单里勾若干项（可以有半选、提交时才生效），
switch 是一个即时生效的状态位（设置项、启用 / 停用）。

```html
<mc-switch checked on:change="enabled = $event.data.checked">开启通知</mc-switch>
<mc-switch size="sm">紧凑开关</mc-switch>
<!-- 自定义值：开着给 "1"、关着给 "0"（表单收集时就是这两个值，不再是布尔） -->
<mc-switch name="enabled" checked-value="1" unchecked-value="0"></mc-switch>
```

`checked` **既是初始值也是运行时状态**：HTML 里写属性，JS 里读写同一个 DOM property
（`el.checked = true` 写完立刻生效，不必等属性反射那一拍）。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/switch/switch.html"></l-m>

<mc-switch id="demo"></mc-switch>

<script type="module">
  await customElements.whenDefined('mc-switch');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/switch/switch.html"></l-m>

<mc-switch></mc-switch>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称              | 值                     | 默认 | 说明                                                                                                                                     |
| ----------------- | ---------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `checked-value`   | `string`               | —    | 自定义值：开着时给的值。**写了它**，`mc-form` 收集时就给「`checked-value` / 关着给 `unchecked-value`」，不写则给布尔（`true` / `false`） |
| `unchecked-value` | `string`               | —    | 自定义值：关着时给的值；`checked-value` 为空时不参与                                                                                     |
| `default-checked` | `boolean`              | —    | **非受控初值**（同 `mc-input` 的 `default-value`）：只在挂载时读一次，之后改它不再生效；受控用法写 `checked`，别两个都写                 |
| `checked`         | `boolean`              | —    | 打开（受控 / 运行时状态：宿主属性就是唯一真相，点了就跟着变）                                                                            |
| `disabled`        | `boolean`              | —    | 禁用，转发给内部原生 input（键盘可感知）                                                                                                 |
| `size`            | `'sm' \| 'md' \| 'lg'` | `md` | 控件高 / 内边距 / 字号 / 轨道三件套；也可用宿主 `style="…"` 覆盖                                                                         |

## 事件

| 名称     | 类型                                                      | 说明                                              |
| -------- | --------------------------------------------------------- | ------------------------------------------------- |
| `change` | `(event: Event & { data: { checked: boolean } }) => void` | 开关状态变化；冒泡 + `composed`，挂在祖先上也能收 |

## 插槽

| 名称     | 说明                             |
| -------- | -------------------------------- |
| （默认） | 文案；点它跟点轨道一样会切换开关 |

## part

| 名称    | 说明                                                             |
| ------- | ---------------------------------------------------------------- |
| `base`  | 整行（内部那个原生 `<label>`，高度 / 内边距 / 命中区都在它上面） |
| `track` | 轨道本体；`::part(track)` 可改长宽 / 圆角 / 底色                 |
| `thumb` | 滑块；`::part(thumb)` 可改尺寸 / 颜色                            |
