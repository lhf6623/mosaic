# mc-slider

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./slider.html` · **已实现**

滑动选择：在一段连续区间里拖一个值。内部是原生 `<input type="range">` —— 键盘、焦点、命中区
都来自它；外观自绘成轨道 + 填充 + 滑块。

和 [`mc-progress`](../progress/api.md) 的分工：progress 只**展示**进度、不接受输入；
slider 接受拖动与键盘，会发 `input` / `change`。

```html
<mc-slider value="30"></mc-slider>
<mc-slider default-value="60" min="0" max="100" step="10"></mc-slider>
<mc-slider color="success" size="lg" on:change="v = $event.data.value"></mc-slider>
```

`value` 既是绑定通道、也是运行时状态：HTML 里写是初始 / 受控值，JS 里读写宿主 property
（`el.value = 50`，当次就读得到）。只想给**非受控初值**就写 `default-value`（挂载读一次）。

---

## 属性

| 名称            | 值                                                          | 默认      | 说明                                                                                                                                    |
| --------------- | ----------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `value`         | `number`                                                    | —         | 当前值：绑定通道（`:value` / `sync:value`）与运行时状态；写属性或 property 都立刻生效（超出区间会夹紧，不落在步进上会被归一到最近一档） |
| `default-value` | `number`                                                    | —         | 非受控初值：只在挂载时读一次，之后改它不再生效；受控用法写 `value`，别两个都写                                                          |
| `min`           | `number`                                                    | `0`       | 区间下限                                                                                                                                |
| `max`           | `number`                                                    | `100`     | 区间上限                                                                                                                                |
| `step`          | `number`                                                    | `1`       | 步长：键盘方向键 / PageUp / PageDown 与拖动按它取整                                                                                     |
| `disabled`      | `boolean`                                                   | —         | 禁用，转发给内部原生 input（键盘可感知）                                                                                                |
| `size`          | `'sm' \| 'md' \| 'lg'`                                      | `md`      | 控件高 / 轨道高 / 滑块直径三件套一起变                                                                                                  |
| `color`         | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | `primary` | 填充与滑块描边的语义色；也收 hex（`#1a7f5a`）                                                                                           |

## 事件

| 名称     | 类型                                                   | 说明                                                         |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `input`  | `(event: Event & { data: { value: number } }) => void` | 拖动 / 键盘每改变一次就发；`$event.data.value` 是当前值      |
| `change` | `(event: Event & { data: { value: number } }) => void` | 一次交互结束时发一次（松开指针 / 键盘调整），冒泡 + composed |

## part

| 名称    | 说明                                                  |
| ------- | ----------------------------------------------------- |
| `base`  | 整行（命中区；透明铺在上面的原生 input 就住在这一层） |
| `track` | 未填充的轨道                                          |
| `fill`  | 已填充部分（宽度跟到滑块中心）                        |
| `thumb` | 滑块本体；换尺寸 / 圆角 / 颜色都改它                  |
