# M2 / M3 组件：接口草案与实现对照

> **状态：M2 / M3 全部已实现。** 接口事实的唯一手写源是**各单元的 `packages/<slug>/api.md`** ——
> 这份不再重复属性表（抄第二份必然漂移）。留在这里的是两样东西：① M2 表单控件的**跨组件共用约定**；
> ② 实现相对草案的**出入清单**（对账用，含理由）。
>
> 共用约定见 [`README.md`](./README.md)（四个正交维度 / 值读写 / 事件 / 插槽与 part），
> 浮层结论见 [`packages/popover/api.md`](../../packages/popover/api.md)。

---

## 一、表单控件共用约定（M2 定型，其余照抄）

| 名称            | 说明                                       |
| --------------- | ------------------------------------------ |
| `name`          | 表单字段名                                 |
| `default-value` | HTML 初始值（attribute，只在挂载时读一次） |
| `value`         | 运行时值（宿主 DOM property，见 P18）      |
| `disabled`      | 状态布尔：禁用                             |
| `readonly`      | 状态布尔：只读                             |
| `required`      | 状态布尔：必填                             |
| `invalid`       | 状态布尔：校验失败                         |
| `size`          | `sm` `md` `lg`                             |
| `placeholder`   | 占位符                                     |

| 名称             | 类型                                                   | 说明                                          |
| ---------------- | ------------------------------------------------------ | --------------------------------------------- |
| `input`          | `(event: Event & { data: { value: string } }) => void` | 每次输入，载荷 `{ value }`                    |
| `change`         | `(event: Event & { data: { value: string } }) => void` | 值确定变化（组件已转发为 composed，见 P19）   |
| `clear`          | `(event: Event) => void`                               | 可清除输入被清空（input / textarea / select） |
| `focus` / `blur` | `(event: Event) => void`                               | 原生事件，已穿透                              |

两条实现要点（在 `mc-input` 里定型，其它表单单元照抄）：

1. **初始值不能读 ofa 数据**：`ready()` 那一刻 attrs 还没铺进 `this`，要读
   `this.ele.getAttribute('default-value')`；`ready()` + `attached()` 各接一次、记账保证只生效一次。
2. **原生 `input` 先 `stopPropagation()` 再转发**：它是 composed，不拦的话宿主上会先到一条**没有 `data`**
   的原生事件，使用者按文档写 `$event.data.value` 会先抛一次；`change` 穿不出 shadow（P19），只由组件转发。
3. **转发给内部原生元素用 `attr:`**（`disabled` 除外）：实测 `:placeholder` / `:rows`（textarea）与
   `:maxlength` / `:readonly` 不生效（IDL 名是 `maxLength` / `readOnly`）。

**校验态不用独立的错误色板**，用 `invalid` 布尔 + `--mc-color-danger`。

---

## 二、实现与草案的出入（对账用）

| 单元                        | 出入与理由                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mc-progress`               | 不套表单那套 `default-value` / `value` 约定：进度条不接受输入、不参与提交、没有 `change`，它的属性就是**当前**进度（同 `mc-collapse-item` 的 `open`）；`value` / `max` 另给宿主 property 访问器。                    |
| `mc-input` / `mc-textarea`  | 转发内部原生元素用 `attr:` 而不是 `:prop`（见上）；原生 `input` 转发前先 `stopPropagation()`。                                                                                                                       |
| `mc-checkbox` / `mc-switch` | 布尔态是**单一** observed 属性（`checked`）而不是 `checked` + `default-checked`：两个属性必然漂移，`mc-collapse-item` 已是先例。                                                                                     |
| `mc-radio`                  | 原生「同 name 成组」跨 shadow 不成立，所以唯一真相是子项宿主上的 `checked`、由组维护；`mc-radio` 的 `checked` 是镜像 property，不进 api.md 属性表。                                                                  |
| `mc-select`                 | `name` 不做原生 formAssociated（没有表单提交语义），只当字段名与内部 aria id 前缀；`multiple` 时 property 是 `string[]`、`default-value` 是逗号分隔字符串。                                                          |
| `mc-dialog`                 | `title` → **`heading`**（声明 `title` 会弹原生 tooltip，P32）；`open` + `default-open` → **单一 `open`**；`popover="manual"` + 自绘遮罩（`auto` 的 light dismiss 在 pointerdown 就关，模态要自己决定点遮罩关不关）。 |
| `mc-dropdown`               | `placement` 沿用 `mc-popover` 的取值集合；`open` 同样是单一属性 + 宿主 property 访问器。                                                                                                                             |
| `mc-tooltip`                | `trigger="hover"` 时 **hover 与 focus 都触发**（键盘可达）；不 emit 事件（气泡是纯展示）。                                                                                                                           |
| `mc-tabs`                   | 草案没定面板怎么给：实现是「默认插槽放 `mc-tab` 标签 + `slot="panel"` 且带 `value` 的子元素当面板」，非激活面板挂 `hidden` 常驻 DOM。                                                                                |
| `mc-table`                  | `data` 撞 ofa 元素代理的保留名、**不能进 `attrs`**（见 P31）：只做宿主 property + 组件自己听属性；行模板放具名 `<template>` —— HTML 解析器会把 `tr` 里的自定义元素搬出去。                                           |
| `mc-grid`                   | 草案写「无插槽无 part」，但容器必须有真实 `<slot>` 才能投影子项，所以 api.md 有「插槽」一节。                                                                                                                        |
| `mc-badge` / `mc-spinner`   | 属性名 / 取值 / 默认值与草案逐字一致；只多了实现层的组件令牌（登记在各自 README 的令牌表）。                                                                                                                         |

---

## 三、逐组件接口

以各单元的 `packages/<slug>/api.md` 为准；标签与目录的对应见 [`README.md`](./README.md) 的组件索引。
