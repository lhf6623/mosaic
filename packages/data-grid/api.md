# mc-data-grid

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./data-grid.html` · **已实现（v0）**

数据网格：列定义与行数据都是对象数组，真 `<table>` 语义，表头吸顶、固定高度滚动、复选与排序。
**对象 / 数组一律走 property**（`columns` / `data` / `selected`）——属性通道只做 JSON 初始值。

```html
<mc-data-grid id="grid" style="height: 420px" sortable selectable></mc-data-grid>
<script type="module">
  const grid = document.querySelector('#grid');
  grid.columns = [
    { key: 'no', title: '编号', width: '120px', sortable: true },
    { key: 'customer', title: '客户' },
    { key: 'amount', title: '金额', align: 'right' },
    { key: 'ops', title: '操作' },
  ];
  grid.data = [
    {
      id: 1,
      no: 'IMP-0001',
      customer: '华东金属',
      amount: '¥12,800.00',
      /* 单元格要放按钮 / 标签时，给行一个 cells：列 key → 原始 HTML 字符串（转义责任在调用方） */
      cells: { ops: '<button type="button" data-action="edit">编辑</button>' },
    },
  ];
  grid.addEventListener('cell-action', (event) => console.log(event.detail.action));
</script>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/data-grid/data-grid.html"></l-m>

<mc-data-grid id="demo"></mc-data-grid>

<script type="module">
  await customElements.whenDefined('mc-data-grid');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/data-grid/data-grid.html"></l-m>

<mc-data-grid></mc-data-grid>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

> `data` 与 `selected` 是**纯 property 通道**（对象 / 数组经宿主属性会丢类型）：`el.data = rows`、
> `el.selected = ['1', '2']`。`selected` 读回来是行 key 的字符串数组，写它不会发事件（受控语义）。

## 属性

| 名称            | 值                     | 默认       | 说明                                                                                                                   |
| --------------- | ---------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `summary`       | `string`               | —          | 合计行 JSON 文本（属性通道只作初始值）；运行时用 property 传 `{ [列 key]: 展示字符串 }`，非空时渲染表内 `tfoot` 合计行 |
| `summary-label` | `string`               | `合计`     | 合计行首列标签文案                                                                                                     |
| `columns`       | `string`               | —          | 列定义 JSON 文本（属性通道只作初始值）；运行时用 property 传 `{ key, title, width, align, sortable, fixed }[]`         |
| `row-key`       | `string`               | `id`       | 行主键字段名：没有 `id` 的表用别的字段做选中 / 展开 / 滚动的锚点                                                       |
| `sortable`      | `boolean`              | —          | 打开表头排序：列上还要写 `sortable: true`，三态循环 asc → desc → 不排序，只发事件不自己排序                            |
| `selectable`    | `boolean`              | —          | 左侧出现复选列（含表头全选 / 半选）                                                                                    |
| `striped`       | `boolean`              | —          | 斑马纹：偶数行换底色                                                                                                   |
| `bordered`      | `boolean`              | —          | 外边框：整块一圈描边 + 圆角（单元格横线不变）                                                                          |
| `size`          | `'sm' \| 'md' \| 'lg'` | `md`       | 密度三档：字号 + 单元格内边距                                                                                          |
| `loading`       | `boolean`              | —          | 加载中：表格下面一行加载态（`loading` 插槽可换内容）                                                                   |
| `empty-text`    | `string`               | `暂无数据` | 没有数据时的兜底文案（`empty` 插槽给了就顶掉它）                                                                       |
| `height`        | `string`               | —          | 滚动容器高度：给固定值（如 `420px`）时表头吸顶、表格内部滚动                                                           |
| `max-height`    | `string`               | —          | 只给上限：内容不够高时按内容长，超出才滚动                                                                             |

## 事件

| 名称            | 类型                                                                                                                                  | 说明                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `select-change` | `(event: Event & { data: { selected: string[] } }) => void`                                                                           | 勾选 / 全选 / `clearSelection()` 后触发；`data.selected` 是最新的行 key 数组        |
| `sort-change`   | `(event: Event & { data: { key: string, order: 'asc' \| 'desc' \| null } }) => void`                                                  | 表头排序态变化；`order` 为 `null` 表示取消排序；**组件不重排数据**，排序在数据层做  |
| `cell-click`    | `(event: CustomEvent<{ rowKey: string, columnKey: string, row: object, column: object, event: MouseEvent }>) => void`                 | 点数据单元格触发（点复选框不触发）；`event` 是原始鼠标事件                          |
| `cell-dblclick` | `(event: CustomEvent<{ rowKey: string, columnKey: string, row: object, column: object, event: MouseEvent }>) => void`                 | 双击数据单元格触发                                                                  |
| `cell-action`   | `(event: CustomEvent<{ rowKey: string, columnKey: string, action: string, row: object, column: object, event: MouseEvent }>) => void` | 点带 `data-action` 的元素触发：`action` 是那个属性的值（如 `edit`），行内按钮走这条 |

## 方法

| 名称                  | 签名                          | 说明                                          |
| --------------------- | ----------------------------- | --------------------------------------------- |
| `clearSelection()`    | `() => void`                  | 清空选中（会发 `select-change`）              |
| `selectAll(checked?)` | `(checked?: boolean) => void` | 全选 / 清空（默认全选），会发 `select-change` |
| `scrollTo(rowKey)`    | `(rowKey: string) => void`    | 把某一行滚进可视区（固定高度表格里用）        |
| `reload()`            | `() => void`                  | 按最近一次 columns / data 重新渲染            |

## 插槽

| 名称      | 说明                              |
| --------- | --------------------------------- |
| `empty`   | 空态内容；给了就顶掉 `empty-text` |
| `loading` | 加载态内容；不给则显示「加载中…」 |
