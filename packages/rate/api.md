# mc-rate

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./rate.html` · **已实现**

评分：一排星，点第几颗就是几分；`allow-half` 打开后可以点半颗（0.5 分）。
和 [`mc-slider`](../slider/api.md) 的分工：slider 是连续区间里的一个位置，rate 是**离散档次**的
打分，星星本身就是可选项。

```html
<mc-rate value="3"></mc-rate>
<mc-rate default-value="4" max="10"></mc-rate>
<mc-rate allow-half value="3.5" on:change="score = $event.data.value"></mc-rate>
<mc-rate color="danger" size="lg"></mc-rate>
```

`value` 既是绑定通道、也是运行时状态：0 表示未评分，HTML 里写是初始 / 受控值，JS 里读写宿主
property（`el.value = 4`，当次就读得到）。只想给**非受控初值**就写 `default-value`（挂载读一次）。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/rate/rate.html"></l-m>

<mc-rate id="demo"></mc-rate>

<script type="module">
  await customElements.whenDefined('mc-rate');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/rate/rate.html"></l-m>

<mc-rate></mc-rate>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称            | 值                                                          | 默认      | 说明                                                                                                                                 |
| --------------- | ----------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `value`         | `number`                                                    | —         | 当前分值：0 = 未评分；写属性或 property 都立刻生效（夹紧到区间，并按步进归一到最近一档）                                             |
| `default-value` | `number`                                                    | —         | 非受控初值：只在挂载时读一次，之后改它不再生效；受控用法写 `value`，别两个都写                                                       |
| `max`           | `number`                                                    | `5`       | 星星颗数（正整数）；改它会重建星条，超出新上限的分值被夹回                                                                           |
| `allow-half`    | `boolean`                                                   | —         | 允许半星：步进变 0.5，点击 / 悬停按每颗星的左右半边取分，键盘方向键也按 0.5 走                                                       |
| `clearable`     | `boolean`                                                   | —         | 快速取消：再点一次**当前分值所在的星**就清回 0（未评分）；清空同样发 `input` / `change`，载荷 0                                      |
| `disabled`      | `boolean`                                                   | —         | 禁用，转发给内部原生 range（键盘可感知）                                                                                             |
| `size`          | `'sm' \| 'md' \| 'lg' \| number`                            | `md`      | 控件高 28 / 36 / 44px、星标直径 16 / 20 / 24px 一起变；纯数字按 px 设**星标直径**，行高取 `max(36px, 星标)`（`size="40"` → 星 40px） |
| `color`         | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | `warning` | 实心星的颜色（空星描边走 `--mc-rate-empty`）；也收 hex（`#1a7f5a`）                                                                  |

## 事件

| 名称     | 类型                                                   | 说明                                                         |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `input`  | `(event: Event & { data: { value: number } }) => void` | 分值每改变一次就发（拖动 / 点星 / 键盘），载荷当前分值       |
| `change` | `(event: Event & { data: { value: number } }) => void` | 一次交互结束时发一次（松开指针 / 键盘调整），冒泡 + composed |

## part

| 名称   | 说明                                                            |
| ------ | --------------------------------------------------------------- |
| `base` | 整行（命中区；透明铺在上面的原生 range 就住在这一层）           |
| `item` | 单颗星；尺寸、间距、空星颜色都改它（实心色走 `--mc-rate-fill`） |
