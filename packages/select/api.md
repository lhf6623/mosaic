# mc-select / mc-option

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](../../agent/api/README.md)；踩坑见 [`../pitfalls/`](../../agent/pitfalls/README.md)。
> 源码 `./select.html` + `./option.html` · M2 · **已实现**

下拉选择，**表单控件 + 选项**两个标签：`mc-select` 管触发框与面板，`mc-option` 只声明一个个选项。

**初始值写 `default-value` 属性，运行时值读写宿主 DOM property `value`**（规范 §1.4）：

```js
select.setAttribute('default-value', 'bj'); // 初始值（HTML 里就这么写）
select.value; // 读：单选是 string、multiple 时是 string[]
select.value = 'sh'; // 写：立刻生效，不需要也不应该去改属性
```

`multiple` 时 `default-value` 仍是**逗号分隔的字符串**（`default-value="bj,sh"`），
而 property 是 `string[]` —— 属性是 HTML 侧的初始值、property 是 JS 侧的运行时值，两者形状不同。

与 `mc-popover` / `mc-dropdown` 的分工：popover 是**通用容器**（内容由使用者给）、
dropdown 是**菜单**（触发元素 + 菜单项）；select 是**表单控件** —— 选项、选中态、键盘导航
都由它自己管，`value` 是它的对外状态。

```html
<mc-select placeholder="选择城市" default-value="bj">
  <mc-option value="bj">北京</mc-option>
  <mc-option value="sh">上海</mc-option>
</mc-select>
```

---

## 属性

### mc-select

| 名称            | 值                     | 默认     | 说明                                                                     |
| --------------- | ---------------------- | -------- | ------------------------------------------------------------------------ |
| `default-value` | `string`               | `''`     | HTML 初始值；`multiple` 时是逗号分隔的多个值（`"bj,sh"`）                |
| `name`          | `string`               | `''`     | 字段名；同时当面板与选项的 `id` 前缀（`aria-activedescendant` 按 id 指） |
| `placeholder`   | `string`               | `请选择` | 没有选中项时显示的文案                                                   |
| `multiple`      | `boolean`              | —        | 多选：`value` property 变 `string[]`，面板不自己收起                     |
| `clearable`     | `boolean`              | —        | 有值时右端出现 ×；点它清空并发 `clear`                                   |
| `disabled`      | `boolean`              | —        | 禁用：不进焦点、不弹面板                                                 |
| `readonly`      | `boolean`              | —        | 只读：可聚焦、`aria-readonly` 转发，但不弹面板                           |
| `required`      | `boolean`              | —        | 只转发 `aria-required`（校验由使用者做）                                 |
| `invalid`       | `boolean`              | —        | 校验失败：边框换成 `--mc-color-danger`，并转发 `aria-invalid`            |
| `size`          | `'sm' \| 'md' \| 'lg'` | `md`     | 控件高度 / 字号 / 行高（对外只动宿主高度，`style="height:…"` 也压得住）  |

### mc-option

| 名称       | 值        | 默认 | 说明                                        |
| ---------- | --------- | ---- | ------------------------------------------- |
| `value`    | `string`  | `''` | 选项值：选中它时 `mc-select.value` 就是这个 |
| `disabled` | `boolean` | —    | 禁用项：点不动、键盘高亮跳过、读屏可感知    |

选项的显示文案是它**默认插槽的内容**；`mc-option` 自己不占版面 —— 面板里那些能点的行
由 `mc-select` 渲染（见下面的 part）。

### 宿主钩子

组件按运行时状态在宿主上镜像几个钩子，可以直接拿去写外部样式：

| 宿主钩子        | 什么时候有                 | 用途                              |
| --------------- | -------------------------- | --------------------------------- |
| `[data-open]`   | 面板正在显示               | 给触发框 / 宿主写「展开中」的样式 |
| `[data-filled]` | 至少选中了一项             | 同上，也可以自己画一层标签        |
| `[data-empty]`  | 一项都没选中（显示占位符） | 给占位态写样式                    |

## 事件

| 名称     | 类型                                                               | 说明                                           |
| -------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `change` | `(event: Event & { data: { value: string \| string[] } }) => void` | 值确定变化（选中 / 取消选中 / 清除后各发一次） |
| `clear`  | `(event: Event) => void`                                           | 点了 × 清空（在 `change` **之前**发）          |
| `open`   | `(event: Event) => void`                                           | 面板已显示                                     |
| `close`  | `(event: Event) => void`                                           | 面板已关闭（Esc / 点外部 / 选中后自动收）      |

四个事件都冒泡 + `composed`，挂在祖先（`form` / 容器）上就能收全部实例。

## 插槽与 part

| 名称          | 说明                                                   |
| ------------- | ------------------------------------------------------ |
| 插槽 （默认） | 选项 `mc-option`；`o-fill` 渲染出来的也会被收集（P12） |
| part="base"   | 触发框（内部那个原生 `<button>`）                      |
| part="panel"  | 面板本体（原生 popover，进 top layer）                 |
| part="option" | 面板里每一行选项                                       |
