# mc-data-grid（数据网格）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 插槽）的唯一手写源是
> [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「目录里有什么、为什么这么设计、刻意不做什么」。

**状态**：已实现 v0 · 标签 `mc-data-grid` · 目录 `packages/data-grid/`

ERP 列表页的数据网格：固定高度 + 表头吸顶、复选 / 全选、三态排序（只发事件）、行内动作
（`data-action` 委托）。单元格内容支持"文本"与"原始 HTML 字符串"两档。

## 单元里有什么

| 文件             | 角色                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `data-grid.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`      | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`         | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`         | 6 个演示（页面用可编辑示例读**同一份文件**）                                  |
| `test/`          | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

## 设计取舍

**为什么叫 data-grid 而不是 grid**：`mc-grid` 已经是布局栅格（[`../grid/`](../grid/)）的标签。
数据网格只能换 slug / tag；`mc-data-grid` 是本仓的取法。

**为什么不用 `mc-table` 扩展**：table 的定位是"轻量展示表格"，298 个列表页要的选择 / 排序 /
固定表头 / 行内动作是另一类能力，硬塞进去会把 table 的契约撑爆。两者共存：
简单展示用 table，ERP 列表用 data-grid。

**单元格为什么只收 HTML 字符串、不收函数**：探针工程实测，函数对象经 ofa 的数据通道
（页面 `data` / 组件 property）在 `<o-page>` 上下文会触发框架内部异常；同理，组件上下文里给子组件赋
「行对象键数 ≥ 4」的数组也会炸（`mc-table` 原版同样复现）。本组件因此只收 JSON 兼容数据：
文本列直接取值、要自定义 HTML 的行给 `cells`（列 key → 字符串），且行 / 表头整段走 HTML 字符串渲染，
**组件不碰函数、也不让行数组进 ofa 响应式数据**。

**为什么排序只发事件**：数据排序是业务层的事（服务端排序、稳定排序、联动筛选都在那边）。
组件只维护"表头当前是哪一列、什么方向"的展示态，发 `sort-change` 后由使用者回填
`data` 与 `columns` 的排序态，避免组件与数据源各排一遍。

**选中为什么是受控的**：`selected` property 是唯一真相；勾选 / 全选只更新它并发事件，
写回 `selected` 不会发事件（受控语义）。DOM 复选框只在选中集变化时同步（`syncSelection()`），
不重算整行 HTML —— 500 行下勾一下不卡。

**表头吸顶 / 行模板为什么在脚本里**：`<o-fill>` 写进 `<tr>` / `<tbody>` 会被 HTML 解析器
foster-parent 搬到表格外（`mc-table` 同一条）。所以 o-fill 先写在表格里、`attached()` 挪回原位，
行内容用 `:html` 填 `<td>` 串——这是本单元唯一在脚本里产出可见结构的例外。

**刻意不做（v0）**：虚拟滚动、展开行、固定列、列宽拖拽 / 列设置持久化、合并单元格、行内编辑。
这些先由业务切片验证需求，再决定进不进组件（列设置归 `erp-page`，不进类库）。

## 令牌

| 令牌                          | 默认                            | 作用                      |
| ----------------------------- | ------------------------------- | ------------------------- |
| `--mc-data-grid-font`         | `--mc-text-sm`                  | 正文字号（size 三档会改） |
| `--mc-data-grid-border`       | `--mc-color-border`             | 单元格横线与外框          |
| `--mc-data-grid-head-bg`      | `--mc-color-surface-sunken`     | 吸顶表头底色              |
| `--mc-data-grid-head-fg`      | `--mc-color-fg-muted`           | 表头文字                  |
| `--mc-data-grid-stripe-bg`    | `--mc-color-surface-sunken`     | 斑马纹底色                |
| `--mc-data-grid-hover-bg`     | `--mc-color-surface-sunken`     | 行悬停底色                |
| `--mc-data-grid-pad-x` / `-y` | `--mc-space-4` / `--mc-space-2` | 单元格左右 / 上下内边距   |

## 相邻单元

- [`mc-table`](../table/)：轻量展示表格（无选择 / 排序）；需要 ERP 列表能力用 data-grid。
- [`mc-pagination`](../pagination/)：列表页底部分页，与 data-grid 同属"列表页三件套"（另两件是 `erp-page` 与搜索区）。

## 改这个单元之前

- 跨组件约定与组件索引：[packages/README.md](../README.md)
- 文档页 / 演示区规范：[packages/page-spec.md](../page-spec.md)
