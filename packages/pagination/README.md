# mc-pagination（分页）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-pagination` · 目录 `packages/pagination/`

分页。给总条数与每页条数，渲染页码条；页数多了折叠成省略号，翻页发 change。

## 单元里有什么

| 文件              | 角色                                                                          |
| ----------------- | ----------------------------------------------------------------------------- |
| `pagination.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`       | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`          | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`          | 9 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`           | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### 页码序列是纯函数算出来的，视图交给 `o-fill`

`pageItems()` 只吃「总页数 / 当前页 / `sibling-count`」三个数，吐一个页码或省略号的数组；
视图只读 `data.pages`，没有一行 JS 建 DOM。省略号是不可点的 `<span>`，其余是原生 `<button>`。

折叠规则：总页数 `<= siblingCount * 2 + 5` 时全列；否则首尾各留一个、当前页两侧各留 `sibling-count` 个，
中间填 `…`。这个阈值保证最少 7 页才可能折叠，且折叠处左右都至少还有一页 —— 不会出现「`1 … 2`」这种没有信息的省略。

### 初始值 / 运行时值 / 越界

- `default-current` 是初始页码（attribute），`current` 是运行时状态（宿主 DOM property），
  同 `mc-tabs` 的 `default-value` / `value`（规范 1.4）。
- **写 property 不发 `change`**：`change` 的语义是「使用者操作让页码变了」，程序化赋值不该被当成用户行为
  （同 `mc-select` 的 `value`）。
- 三个入口（attribute、property、翻页）都过 `currentPage()` 夹回 `[1, 总页数]`，
  所以 `default-current="99"` 落在末页而不是渲染一条空页码条。
- 总页数 = `max(1, ceil(total / page-size))`：没数据也留一条页码条（`total=0` 时只有 1，前后禁用），
  容器高度不塌。

### 事件委托 + 键盘

- `o-fill` 模板里的元素**绑不到 proto 方法**（条目作用域只有 `$data` / `$index` / `$host`），
  所以页码按钮只写 `data-page`，点击与键盘都在 `<ul>` 上委托（同 `mc-message`）。
- 键盘只加一样东西：方向键 / Home / End 在可用按钮之间移动焦点（原生 button 的 Tab、Enter、Space 照旧）。
  到边停住、不绕回；这四个键都 `preventDefault`，别让页面滚。
- 焦点环用 `--mc-color-ring` 且只在 `:focus-visible` 出现（P16）。

### 跳页输入框：原生 `<input>`，提交才跳

- 输入框是**原生** `<input type="number">`（不引 `mc-input`，省一次请求）；回车与失焦（原生 `change`）提交，
  **不做逐键跳转** —— 敲「12」会在敲到「1」时就跳走。
- 提交后清空输入框、把当前页写进 `placeholder`：既不用每次先全选旧页码，也让「现在第几页」一直看得见。
- 原生 `input` 事件是 composed，会漏到宿主上且**不带 `data`**，所以内部 `stopPropagation` 挡掉
  （组件自己的 `change` 走 `emit`，原生 `change` 穿不出 shadow，不会撞车）。
- `jumper` 关着时输入框仍在 DOM 里，只靠 `:host([jumper])` 显隐（P10）—— 加属性不用重建模板。
- `type="number"` 的原生上下箭头（spinner）关掉（`appearance: textfield` + `::-webkit-*-spin-button`）：
  它跟页码按钮抢位置，而 ±1 已经有上一页 / 下一页。
- 尺寸**比页码按钮小一号**：高度固定 sm 档（`--mc-pagination-jump-h`，28px）、字号 `--mc-text-xs`、
  宽 `2.75em`（xs 字号下 33px，量过 3 位数不被裁）—— 高度与下面的每页条数选择器共用
  `--mc-pagination-field-h`。md 下是 33×28，对按钮的 36×36。
  它只是配角 —— 做满控件高（`--mc-pagination-h`）会和页码按钮一样抢眼；三档 `size` 下输入框保持同一尺寸，
  尺子不跟着档位跳。
- 焦点态拆成两层：边框换**实色** `--mc-color-ring`（对白底 3.91:1，扛得住 WCAG 1.4.11 的 3:1），
  外面那 2px 用 **30%** 的 ring 做柔光。这个尺寸下套实心 2px 环 =「边框 + 空隙 + 环」的亮双层框。

### 每页条数用原生 `<select>`，不引 `mc-select`

`sizer` 那格是个原生 `<select>`（`appearance: none` 去掉系统箭头，换成内置图标那一枚）：

- **它只是分页的一块附属 chrome**，而 `mc-select` 本体 gzip 7.8KB、还会连带 `scroll-pin.js`（4.7KB）——
  分页本体自己才 5.6KB，为一个「每页 __ 条」翻三倍不值。想主题化下拉的用户可以走 `suffix` 插槽自己组合。
- **选项在 `syncSizer()` 里用真 `<option>` 建**，不是 `o-fill`：HTML 解析器会把 `<select>` 里的非 option 标签
  整个丢掉，`o-fill` 根本进不去。
- **候选项 = `page-sizes` ∪ 当前 `page-size`**（排序去重）：当前值不在列表里时补进去，选择器才不会显示空。
- **换条数写回 `page-size` 属性**（watch 再同步一拍），当前页保持不变、越界才夹回，然后发自己的 `change`；
  原生 `change` 穿不出 shadow，原生 `input` 是 composed，同样在里面 `stopPropagation` 挡掉。

### 图标零请求

前后两枚 chevron 直接吃 `../icon/icons.generated.css` 里的 `mc-icon-*` 类名
（同 `mc-button` / `mc-select`），不引 `mc-icon` 组件、不额外发一次请求。

## 令牌

| 令牌                         | 默认                        | 作用                                                        |
| ---------------------------- | --------------------------- | ----------------------------------------------------------- |
| `--mc-pagination-h`          | `--mc-control-h-md`         | 按钮 / 省略号的高度与最小宽度（`size` 三档的落点）          |
| `--mc-pagination-gap`        | `--mc-space-1`              | 页码之间的间距                                              |
| `--mc-pagination-radius`     | `--mc-radius-md`            | 页码按钮圆角                                                |
| `--mc-pagination-jump-w`     | `2.75em`                    | 「跳至 __ 页」输入框宽度（xs 字号下约 33px，放得下 3 位数） |
| `--mc-pagination-field-h`    | `--mc-control-h-sm`         | 两个小控件（跳页输入框 / 每页条数选择器）的高度，约 28px    |
| `--mc-pagination-sizer-w`    | `4em`                       | 「每页 __ 条」选择器宽度（xs 字号下约 48px）                |
| `--mc-pagination-fg`         | `--mc-color-fg-muted`       | 页码文字色                                                  |
| `--mc-pagination-fg-current` | `--mc-color-primary`        | 当前页文字色                                                |
| `--mc-pagination-bg-hover`   | `--mc-color-surface-sunken` | 悬停底色                                                    |
| `--mc-pagination-bg-current` | `--mc-color-primary-subtle` | 当前页底色                                                  |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

## 相邻单元

- 与 [`mc-table`](../table/) 的分工：table 只负责把**一个数据页**摆出来，「第几页、每页几条」在这里 ——
  table 不认识分页，两者靠使用者的数据源拼接（table 没有内置分页）。
- 与 [`mc-tabs`](../tabs/) / [`mc-select`](../select/) 共用同一套值约定：
  attribute 是初始值（`default-current`），DOM property 是运行时值（`current`）。
- 与 [`mc-select`](../select/) 的分工：内建 `sizer` 用原生 `<select>`（零依赖，见上面「每页条数」）；
  想要跟全库一致的主题化下拉，把 `mc-select` 放进 `suffix` 插槽、自己监听它的 `change` 去改 `page-size`。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
