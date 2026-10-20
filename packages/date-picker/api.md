# mc-date-picker

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./date-picker.html` · **已实现**

日期选择，**表单控件 + 浮层**。两个正交维度：

- **`type`**：`day`（默认）/ `week` / `month` / `year`，以后可加 `quarter`；
- **选择模式**：单选（默认）/ `multiple` 多选 / `range` 范围。`multiple` 与 `range` 互斥，同时写时 `range` 生效。

值的形状跟着模式走；`multiple` / `range` 的 property 是 `string[]`，同名属性是逗号分隔的初始值：

| `type`  | 单选值（默认格式） | `multiple` / `range` |
| ------- | ------------------ | -------------------- |
| `day`   | `2026-10-19`       | `['2026-10-19', …]`  |
| `week`  | `2026-W43`         | `['2026-W43', …]`    |
| `month` | `2026-10`          | `['2026-10', …]`     |
| `year`  | `2026`             | `['2026', …]`        |

`range` 的数组是 `[起, 止]`；第一次点击只是起点（显示 `起 ~ …`），第二次点击才提交并关面板；
中途 Esc / 点外部会丢掉这次未完成的起点，回到原值。多选 / 范围的**属性通道用逗号分隔**，
这两个模式下别让 `output-format` 里出现逗号；property 是数组，不受影响。

**格式化分三段，各一个属性**：`input-format` 解析从外部进入组件的字符串
（`default-value` / `value` / `min` / `max`），`format` 决定触发框里显示成什么，
`output-format` 决定 `change` 载荷、`value` property 读取与回写 `value` 属性的格式。
三段默认值随 `type`：`day` = `YYYY-MM-DD`、`week` = `YYYY-[W]WW`、`month` = `YYYY-MM`、`year` = `YYYY`。
占位符除 `YYYY` / `YY` / `MM` / `M` / `DD` / `D` 外，`week` 另有 `WW` / `W`（ISO 周号，周一开始）；
`[...]` 里是字面量（`YYYY-[W]WW` 的 W）。进值按 input → output → 该 type 的默认格式依次尝试，先命中的赢。

**非受控的初始值写 `default-value`；受控就给控件绑 `:value="form.day"` / `sync:value="form.day"`**（写的就是 `value` 属性）；
运行时值本身读写宿主 DOM property `value`（规范 §1.4）：

```js
picker.setAttribute('default-value', '19/10/2026'); // 按 input-format 解析
picker.value; // 读：按 output-format，例如 '20261019'；multiple / range 是数组
picker.value = '2026-11-01'; // 写：input-format 解析不了时回退 output / 默认格式
picker.type = 'month'; // type 变了会按新类型重新读 initial，旧值解析不了就当空
```

键盘与鼠标走同一套状态：打开后 `←` / `→` / `↑` / `↓` 逐日 / 逐周（`month` / `year` 是逐月 / 逐年），
`PageUp` / `PageDown` 换月 / 换年，`Home` / `End` 到首尾，`Enter` / 空格选中，`Esc` 关闭。
面板里的按钮都不进 Tab 序列（`tabindex="-1"`），焦点始终留在触发框上。

```html
<mc-date-picker placeholder="选择日期" default-value="2026-10-19"></mc-date-picker>
<mc-date-picker type="month" range default-value="2026-02,2026-05"></mc-date-picker>
<mc-date-picker type="week" multiple default-value="2026-W43,2026-W45"></mc-date-picker>
```

---

## 属性

| 名称            | 值                                     | 默认  | 说明                                                                                                    |
| --------------- | -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| `type`          | `'day' \| 'week' \| 'month' \| 'year'` | `day` | 选择粒度：日 / ISO 周（周一开始）/ 月 / 年                                                              |
| `multiple`      | `boolean`                              | —     | 多选：`value` 是 `string[]`，点一项切换、面板不收起                                                     |
| `range`         | `boolean`                              | —     | 范围：`value` 是 `[起, 止]`，两次点击提交；与 `multiple` 同时写时以本项为准                             |
| `default-value` | `string`                               | `''`  | HTML 初始值（按 `input-format` 解析）；多选 / 范围用逗号分隔；只读一次                                  |
| `value`         | `string`                               | —     | 值：绑定写这里 —— `sync:value` 双向、`:value` 单向；默认 `null`，不给就是非受控；读取按 `output-format` |
| `input-format`  | `string`                               | —     | 进组件：解析 `default-value` / `value` / `min` / `max`；默认随 `type`（见上）                           |
| `format`        | `string`                               | —     | 组件中：触发框显示格式；默认随 `type`（见上），面板标题不跟它走                                         |
| `output-format` | `string`                               | —     | 出组件：`change` 载荷、`value` property 读取、回写 `value` 属性；默认随 `type`（见上）                  |
| `min`           | `string`                               | `''`  | 可选的最早一项（含，按 `input-format` 解析，写法随 `type`）；空 = 不限                                  |
| `max`           | `string`                               | `''`  | 可选的最晚一项（含，按 `input-format` 解析，写法随 `type`）；空 = 不限                                  |
| `placeholder`   | `string`                               | —     | 没有选中项时的文案；空 = 按 `type`（请选择日期 / 周 / 月份 / 年份）                                     |
| `clearable`     | `boolean`                              | —     | 有值时右端出现 ×；点它清空（多选 / 范围清空全部）并发 `clear`                                           |
| `disabled`      | `boolean`                              | —     | 禁用：不进焦点、不弹面板                                                                                |
| `readonly`      | `boolean`                              | —     | 只读：可聚焦，但不弹面板                                                                                |
| `invalid`       | `boolean`                              | —     | 校验失败：边框换成 `--mc-color-danger`                                                                  |
| `size`          | `'sm' \| 'md' \| 'lg'`                 | `md`  | 控件高度 / 字号 / 行高（对外只动宿主高度，`style="height:…"` 也压得住）                                 |

## 事件

| 名称     | 类型                                                               | 说明                                                                                |
| -------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `change` | `(event: Event & { data: { value: string \| string[] } }) => void` | 值确定变化（单选取到值 / 多选增删 / 范围提交 / 清除后各发一次）；按 `output-format` |
| `clear`  | `(event: Event) => void`                                           | 点了 × 清空（在 `change` **之前**发）                                               |
| `open`   | `(event: Event) => void`                                           | 面板已显示                                                                          |
| `close`  | `(event: Event) => void`                                           | 面板已关闭（Esc / 点外部 / 单选或范围提交后自动收）                                 |

## part

| 名称     | 说明                                            |
| -------- | ----------------------------------------------- |
| `base`   | 触发框（内部那个原生 `<button>`）               |
| `panel`  | 面板本体（原生 popover，进 top layer）          |
| `header` | 面板顶栏：上一页 / 当前年月或年段 / 下一页      |
| `grid`   | 网格容器（日 / 周是 7 列，月 / 年是 3 列）      |
| `day`    | 日 / 周视图里的一格（周视图里整行是同一个星期） |
| `cell`   | 月 / 年视图里的一格（月份或年份）               |
