# mc-table（表格）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M3 · 标签 `mc-table` · 目录 `packages/table/`

数据表格。columns / data 通过 property 传入（对象不能走标签属性）。

## 单元里有什么

| 文件         | 角色                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `table.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`  | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`     | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`     | 7 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`      | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### `<tr>` 不能写在 `o-fill` 里 —— 表格里放不了自定义元素

HTML 解析器有 **foster parenting**：`<table>` 里出现非表格元素（`o-fill` 是自定义元素）时，
它会被**搬到表格外面**。实测 `<tr><o-fill …></o-fill></tr>` 解析完，`o-fill` 是表格的**前一个兄弟**，
行根本不在表格里；而 `<template>` 里的 `<tr>` 反而活得好好的（那里没有表格上下文）。

所以本组件的结构是三段式：

1. 行 / 表头模板写在**具名 `<template name="mc-table-row|head">`** 里（模板内容不参与布局）；
2. `<o-fill name="…">` 仍然按正常位置写在 `<table>` 里让 ofa 编译，`attached()` 里再把它
   **挪回** `thead tr` / `tbody`（DOM 移动不重新解析，所以生成的就是真 `<tr>`）；
3. 单元格数量由 `columns` 动态决定，逐格写模板做不到，行模板用 `:html="$host.cellsHtml($data)"`
   填 —— 单元格文本在 `cellsHtml()` 里**自己转义**（`:html` 是 HTML 通道，不能直接拼原文）。

### 数据链路

`columns` / `data` 的运行时入口是宿主 property，规范化结果写进 `data.cols` / `data.rows`
（**非 attrs 键**），模板只读这两个字段：

```text
el.columns = [...]  ─┐
columns 属性(JSON)  ─┼─→ applyColumns() ─→ this.cols ─→ <o-fill :value="cols"> 表头
                     │
el.data = [...]     ─┤
data 属性(JSON)     ─┴─→ applyData()    ─→ this.rows ─→ <o-fill :value="rows" fill-key="rowKey"> 行
                                                            └→ $host.cellsHtml($data) 逐格
```

- `watch.columns` 收到的是 **JSON 字符串**，`toArray()` 负责 `JSON.parse`；
- 规范化后的值**绝不写回 attrs 声明的键**（写回去会被 ofa 再次序列化）；`rows` / `cols` 这类
  非 attrs 键才是渲染源，所以不存在"对象 → 字符串 → 对象"的来回丢失；
- 每行补一个 `rowKey`（优先 `rowKey` / `id`，否则下标）当 `fill-key`，增删时行节点才能正确复用。

### `data` 不能进 `attrs`

`data` 是 ofa.js **元素代理上的保留名**（`$.fn.data`）。把它声明进 `attrs` 之后，每次属性同步都会
往代理写一次 `data`，抛 `TypeError: 'set' on proxy: trap returned falsish`，
整个组件渲染不出来（连 shadow root 都没有）—— 与 `wrap` 同一族。所以：

- `data` 只做**宿主 property** + 组件自己听的属性观察（`MutationObserver`，属性写法只作初始值兼容）；
- `api.md` 的属性表里因此没有 `data`，它单独列在「宿主 property」表里 —— 那张表就是这件事的事实源。

### 空态 / 加载态常驻 DOM

`empty` / `loading` 两个插槽的内容常驻，靠**内部容器上的 `data-empty`** 与宿主 `[loading]`
切显隐。`data-empty` 写在 `.mc-wrap` 上而不是宿主上：
构造期（`ready()`）不能往宿主写属性。

### 表格不合并边框

CSS 里只写 `border-spacing: 0`，靠 `border-collapse` 的初始值 `separate`：单元格只画一条下边线，
视觉上就是单线表格。刻意不写"把相邻边框合成一条"的那条声明 —— 那几条声明本来也不需要，
手写工具类之后也不会再有人把它的关键字当类名扫走。

## 令牌

| 令牌                      | 默认                        | 作用                   |
| ------------------------- | --------------------------- | ---------------------- |
| `--mc-table-font`         | `--mc-text-sm`              | 表格字号               |
| `--mc-table-fg`           | `--mc-color-fg`             | 单元格文字色           |
| `--mc-table-border`       | `--mc-color-border`         | 单元格下边线           |
| `--mc-table-head-bg`      | `--mc-color-surface-sunken` | 表头底色               |
| `--mc-table-head-fg`      | `--mc-color-fg-muted`       | 表头文字色             |
| `--mc-table-stripe-bg`    | `--mc-color-surface-sunken` | `striped` 的偶数行底色 |
| `--mc-table-row-hover-bg` | `--mc-color-surface-sunken` | `hoverable` 的悬停底色 |
| `--mc-table-cell-pad-x`   | `--mc-space-4`              | 单元格左右内边距       |
| `--mc-table-cell-pad-y`   | `--mc-space-2`              | 单元格上下内边距       |
| `--mc-table-state-fg`     | `--mc-color-fg-subtle`      | 空态 / 加载态的文字色  |
| `--mc-table-state-pad`    | `--mc-space-8`              | 空态 / 加载态的内边距  |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

## 相邻单元

- 演示里用站点级的 [`mc-code`](../code/) 展示 `columns` / `data` 的 JSON；组件本体不依赖任何其它组件
  （零 `load()`）。
- 与 [`mc-grid`](../grid/) 的分工：grid 只摆位置、不管内容形状；table 有列语义与状态（空 / 加载）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
