# mc-grid 契约草案（P0 评审稿）

> 依据：`docs/plan-probe.md` §5.3 的草案 + P0 三个 spike 的实测结论（`mosaic-admin/spikes/`，
> 跑法 `pnpm spike:admin`）。**这是评审稿，不是实现**：P1 按此先写 `packages/grid/api.md` 再写组件。
> 结论先行：`columns[].cell` 的**函数对象**不能进 ofa 的数据通道（详见 §2），契约只收**字符串 / 名字**。

## 1. 三个 spike 的实测结论（2026-11-16，本机 Chrome + 8642 本地服务）

| spike              | 结论                                                                                                         | 关键数据                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · cell 函数通道  | 函数对象走 ofa 的组件 property / 页面 data **不可行**；可行通道 = 页面模块作用域里的 cell 函数 + HTML 字符串 | 500 行 × 6 列 HTML 字符串渲染 **65ms**；函数进页面 data → **整页渲染失败**；把含函数的 columns 赋给组件 property → o-page 上下文触发 ofa 内部 `设置属性值 rows 出错` |
| B · 500 行 sticky  | `<table>` + sticky thead 与 div grid 都成立，性能同级；建议先 `<table>`（语义 + DOM 少）                     | table 500 行 **73ms** / div **69ms**；两者表头都正确吸顶；程序化滚动均无 >50ms 长帧（无头环境 30fps 是 compositor 限制，不代表真机）                                 |
| C · 标签页状态保持 | 常驻 `<o-page>` + 只切显隐即可保住 DOM 输入值与组件 data；成本很低                                           | 10 页常驻堆增量 **1.06MB（0.11MB/页）**；显隐切换后状态全保；同步切换（只改 `data-active`）**< 5ms**                                                                 |

**A 的细节（为什么改契约）**：

1. 页面 `data` 里放函数 → ofa 初始化整页渲染失败（页面模板绑定 / `o-fill` 都起不来）。
2. 把 `mc-table` 拷出来只加"函数型 cell"，在普通 HTML 宿主里能跑；但同一套
   `el.columns = [...含函数]; el.data = rows` 搬进 `<o-page>` 页面上下文后，
   `applyData` 期间触发 ofa 内部异常（`设置属性值 rows / 0 出错`），**mc-table 原版在同样上下文里正常**。
   判断是 ofa 4.7.5 对"组件实例 / 数据通道里出现函数"的处理缺陷，不是探针代码能绕过的。
3. 因此 mc-grid **不承诺**"columns[].cell 收函数"这条属性通道。单元格内容按 plan §5 的既有范式：
   cell 渲染函数住在业务模块（`shared/modules/<m>/cell.js`），返回 HTML 字符串；组件只消费字符串。

> 后续若库层修掉 ofa 这个缺陷，可再放开函数通道；在那之前不写进 `api.md`。

### 补充实测（2026-11-16 晚，实现 mc-data-grid v0 时）

- 探针里又撞到同一条 ofa 缺陷的**通用形态**：在**组件上下文**（ofa 组件的 ready / 嵌套 shadow）里
  给子组件赋**行对象键数 ≥ 4** 的数组，就会抛 `设置属性值 rows 出错` —— **mc-table 原版同样复现**，
  与 data-grid 的实现无关（表格 demo 历史上都是 ≤3 键的行，所以一直没暴露）。
- `mc-data-grid` 的规避方式：行 / 表头都不进 ofa 响应式数据，**整段 HTML 字符串**走 `:html`
  （原始值通道），plain 字段保存 `_rows` / `_cols`。代价是换行 / 换列时重算整段 HTML（500 行约 45–140ms），
  收益是彻底绕开 stanz 包装，页面 / 组件上下文都稳。
- 结论不变：**不要**把函数或"多键对象数组"经 property 交给组件（除非组件自己像 data-grid 这样用字符串兜住）。

## 2. 契约草案（v0.1）

### property

| 名称                               | 值                         | 说明                                                                                                    |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `columns`                          | `object[]`（JSON 兼容）    | 列定义：`key` / `title` / `width` / `align` / `fixed` / `sortable` / `cell`（**字符串名字**，不是函数） |
| `data`                             | `object[]`                 | 行数据；组件内部补稳定 `rowKey`（优先 `rowKey` / `id`）                                                 |
| `rowKey`                           | `string`                   | 行主键字段名，默认 `id`                                                                                 |
| `cells`                            | `Record<string, string>`？ | **先不做**：cell 名字 → HTML 的映射由页面用自己的模块函数产出字符串（避免把函数交给 ofa）               |
| `selectable`                       | `boolean`                  | 复选列                                                                                                  |
| `selected`                         | `string[]`                 | 选中行 key；受控（运行时走 property）                                                                   |
| `expanded`                         | `string[]`                 | 展开行 key                                                                                              |
| `height` / `maxHeight`             | `string`                   | 滚动容器高度（固定表头的边界）                                                                          |
| `virtual`                          | `boolean`                  | 虚拟滚动；**P1 先不做**（等真实 500 行切片跑出来再定，见 §3）                                           |
| `striped` / `bordered` / `loading` | `boolean`                  | 五维正交里的状态布尔                                                                                    |
| `size`                             | `'sm' \| 'md' \| 'lg'`     | 密度三档                                                                                                |
| `emptyText`                        | `string`                   | 空态文案                                                                                                |
| `sortable`                         | `boolean`                  | 表头排序开关                                                                                            |

### 事件

| 名称                           | 载荷                                              | 说明                                               |
| ------------------------------ | ------------------------------------------------- | -------------------------------------------------- |
| `select-change`                | `{ selected: string[] }`                          | 选中集变化                                         |
| `sort-change`                  | `{ key: string, order: 'asc' \| 'desc' \| null }` | 排序变化                                           |
| `cell-click` / `cell-dblclick` | `{ row, column, event }`                          | 单元格点击                                         |
| `cell-action`                  | `{ row, column, action }`                         | 行内动作（cell HTML 里用 `data-action`，容器委托） |

### 方法

- `clearSelection()`
- `scrollTo(rowKey)`
- `refresh()`

### 插槽 / part

- 插槽：`empty` / `loading` / `footer`（无参，沿用现有约定）。
- part：`grid` / `head` / `row` / `cell` / `selection`。

## 3. 实现建议与未决点

1. **结构**：先 `<table>` + `position: sticky` 表头（spike B 同级性能、语义更好）。
   `<tr>` / `<tbody>` 里放不了自定义元素（foster parenting），行模板必须走具名 `<template>` + `:html`，
   与 `mc-table.cellsHtml()` 同一条既有范式。
2. **单元格 HTML 通道**：`cell` 名字由业务 `cell.js` 解析成 HTML 字符串；值必须转义（`:html` 不转义）。
   这条通道跨 Vue / ofa 都成立（`v-html` / `:html`）。
3. **虚拟滚动 + 展开行**：P1 先不做虚拟滚动；500 行实测渲染 < 100ms、滚动无长帧，普通渲染够用。
   等真实接口 / 真实数据量（含行内按钮、合并单元格）出来再评估。
4. **列设置持久化 / 列筛选 / 拖拽列序 / 标签页标题**：归 `erp-page`，不进 mc-grid。
5. **选中 / 展开状态**：受控（property）+ 事件回传；不做组件内持久化。

## 4. 落地状态（2026-11-16）

mc-data-grid v0 已进库：`packages/data-grid/`（api.md / README / page.html / 6 demos / 冒烟套件），
站点导航挂在「数据展示 › 数据网格」。admin 里已有两个真实调用点：

- 简单列表：`pages/risk/list.html`
- 重列表：`pages/import-order/list.html`（500 行 × 8 列 / 复选 / 排序 / 行内动作）

v0 刻意不做：虚拟滚动、展开行、固定列、列设置持久化（等切片验证后再定）。

## 5. 对后续切片的影响

- 重列表（import-order）切片直接用"名字 + HTML 字符串"通道，不需要等 ofa 缺陷修复。
- 外壳多标签页按 spike C 的结论做：常驻 `<o-page>` 只切显隐；**不要**用 o-app 的 leaf 导航换页
  （o-app 只复用同 src 的父页面，leaf 会被销毁，状态必丢）。
- P0 的 `shell/layout.html` 现在是单视图 + slot；多标签页在 G2 加，届时把内容区换成常驻页容器。
