# M2 / M3 组件：接口已定与草案

- **M2**：接口已定，实现待做（表单控件与反馈类）；
- **M3**：接口草案（浮层与布局）。

> 共用约定见 [`README.md`](./README.md)。

---

## 四、M2 组件（接口已定，实现待做）

> 这一批会大量撞上 [踩坑清单](../pitfalls/README.md) 的 P6 / P18 / P19 / P20
> （值的反射、`change` 事件穿透、点击外部判定）。开工前先把那四条读一遍。

### 表单控件共用约定

| 名称            | 说明                     |
| --------------- | ------------------------ |
| `name`          | 表单字段名               |
| `value`         | 运行时值（property）     |
| `default-value` | HTML 初始值（attribute） |
| `disabled`      | 状态布尔：禁用           |
| `readonly`      | 状态布尔：只读           |
| `required`      | 状态布尔：必填           |
| `invalid`       | 状态布尔：校验失败       |
| `size`          | `sm` `md` `lg`           |
| `placeholder`   | 占位符                   |

| 名称     | 类型                                                   | 说明                                                                                                        |
| -------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `input`  | `(event: Event & { data: { value: string } }) => void` | 每次输入，payload 是 `{ value }`                                                                            |
| `change` | `(event: Event & { data: { value: string } }) => void` | 值确定变化（**组件内部已把原生 `change` 转发为 `composed: true`**，见 [P19](../pitfalls/04-dom-events.md)） |
| `focus`  | `(event: Event) => void`                               | 原生事件，已穿透                                                                                            |
| `blur`   | `(event: Event) => void`                               | 原生事件，已穿透                                                                                            |

**校验态不用独立的错误色板**，用 `invalid` 布尔 + `--mc-color-danger`。

### 各组件要点

| 组件                          | 关键属性                                                                             | 关键插槽与 part                             |
| ----------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| `mc-input`                    | `type` `clearable` `maxlength` `prefix`/`suffix` 文本                                | `prefix` `suffix` 插槽；`input` part        |
| `mc-textarea`                 | 同 input + `rows` `auto-resize` `maxlength` + 字数统计                               | 同 input                                    |
| `mc-checkbox`                 | `checked` / `default-checked` `indeterminate` `value`                                | 默认插槽为标签文案                          |
| `mc-radio` + `mc-radio-group` | group 上用 `value` `default-value` `name` `direction`；radio 上用 `value` `disabled` | 默认插槽为标签文案                          |
| `mc-switch`                   | `checked` / `default-checked` `disabled` `size`                                      | —                                           |
| `mc-select` + `mc-option`     | select 上 `value` `multiple` `placeholder` `clearable`；option 上 `value` `disabled` | `option` part；弹层 `panel` part            |
| `mc-progress`                 | `value` `max` `indeterminate` `color` `size`                                         | `bar` part；`aria-valuenow` 齐全            |
| `toast()`                     | 命令式函数，返回 `{ close }`，对齐原生语义                                           | `toast(msg, { color, duration, position })` |

> `mc-alert` **已实现**，接口见 [`alert.md`](./alert.md) —— 与上面的草案有两处出入（都是踩坑后的结论）：
> 标题属性定为 `heading` 而不是 `title`（原生 `title` 会弹浏览器 tooltip，[P32](../pitfalls/01-props.md)），
> 插槽是「默认（描述正文）+ `title` + `icon`」，没有单独的 `description` 插槽。

`mc-select` 是 M2 里最复杂的一个：它要处理浮层定位、点击外部关闭（**必须用 `composedPath()`**，
[P20](../pitfalls/04-dom-events.md)）、键盘导航、以及消费 `o-fill` 渲染出来的 option
（[P12](../pitfalls/02-template.md)）。建议留出充足的实现时间。

---

---

## 五、M3 组件（接口草案）

> ⚠️ **M3 开工前必须先验证图层问题**：shadow DOM 里的 `position: fixed` + `z-index`
> 与宿主页面层叠上下文的关系。宿主页面上的 `transform` / `filter` / `contain`
> 会创建新的层叠上下文，可能把 shadow root 内的浮层困住。
> 验证后再决定是继续用 `position: fixed`，还是改用 popover API，还是挂载到 `document.body`。
> 详见 [`design-spec.md` 第七节](../design-spec.md#七层级)。

| 组件                           | 关键属性                                                                                                        | 关键插槽                        | 关键 part                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------ |
| `mc-dialog`                    | `open` / `default-open` `title` `closable` `mask-closable` `size`                                               | `header` `footer`（默认为主体） | `overlay` `panel` `header` `body` `footer` |
| `mc-dropdown` + `mc-menu-item` | dropdown 上 `open` `placement` `trigger`；item 上 `value` `disabled` `danger`                                   | `trigger` 插槽                  | `panel`                                    |
| `mc-tooltip`                   | `content` `placement` `trigger` `delay`                                                                         | 默认插槽为触发元素              | `panel`                                    |
| `mc-tabs` + `mc-tab`           | tabs 上 `value` `default-value`；tab 上 `value` `disabled`                                                      | tab 的默认插槽为标签文案        | `list` `panel` `indicator`                 |
| `mc-table`                     | `columns` `data`（JSON property，见 [P6](../pitfalls/01-props.md)）`striped` `hoverable` `loading` `empty-text` | `empty` `loading`               | `table` `row` `cell`                       |
| `mc-grid` + `mc-grid-item`     | grid 上 `cols` `gap` `min-item-width`；item 上 `span`                                                           | —                               | —                                          |

`mc-table` 的 `columns` / `data` 是**对象**，必须通过 property 传，
不能写成标签属性（会被 JSON 序列化，[P6](../pitfalls/01-props.md)）：

```html
<mc-table id="t"></mc-table>
<script type="module">
  document.querySelector('#t').columns = [{ key: 'name', title: '姓名' }];
  document.querySelector('#t').data = [{ name: '张三' }];
</script>
```
