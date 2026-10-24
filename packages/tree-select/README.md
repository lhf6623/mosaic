# mc-tree-select（树型选择）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-tree-select` · 目录 `packages/tree-select/`

树型选择：触发框 + 面板里的一棵树，从层级数据里选一个节点。

## 单元里有什么

| 文件               | 角色                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `tree-select.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`        | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`           | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`           | 12 个演示（页面用 `<doc-playground src>` 读**同一份文件**）                   |
| `test/`            | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**数据驱动，不配子标签。** 树节点天生是数据：`options` 用 property 传对象数组（同 `mc-menu` /
`mc-table`），属性通道只作 JSON 初始值。行**渲染在自己的 shadow 里**（`part="option"`），不像
`mc-select` 那样收 `mc-option` 子标签 —— 递归数据配子标签会让层级和 `part` 都更绕。
层级缩进由容器按 `level` 算，行上写 `--mc-tree-row-level`，数据里没有 `level`。

**骨架抄 `mc-select`，树的部分抄 `mc-menu`。** 触发框 / 面板 / 键盘 / 取值 / 表单集成是 select 的
一套：原生 `<button>` 触发框、`popover="manual"` 面板、shadow 内 `anchor-name`、`composedPath`
点外部判定、Esc 与焦点归还。树来自 menu 的思路：`createNodes` 式递归、逐级缩进、`expanded` 状态、
打开时滚到当前项。menu 本体不能直接嵌 —— 它的行是链接 / 按钮、没有 `value`、没有 `change`，
也不是表单控件。

**渲染是模板的事，脚本只算数据。** `options` → 节点树 → 平铺成行模型 `data.rows`，模板用
`<o-fill fill-key="key">` 渲染每一行：`part="option"`、层级缩进（`--mc-tree-row-level`）、
`data-selected` / `data-disabled` / `data-expanded` / `data-active` / `data-loading` /
`data-load-error` / `hidden` 全是 `attr:` 绑定；触发框文案与空态（`displayText` / `emptyLabel` /
`emptyHidden`）同样在模板里。脚本里没有 `createElement` 造行。
⚠️ **行模板插槽是唯一例外**：`<template slot="option|icon">` 是使用者给的 DOM 模板，每行要一份
独立实例，只能 `cloneNode`（`syncRowContent()`；行外壳、状态与布局仍由模板渲染），且要等 o-fill
把行铺完（宏任务）才能补进去。加载中的小转圈走 `o-if`，它也是宏任务渲染 —— 两者都比模板绑定晚一拍。

**禁用是「整支不可选、但仍可展开」。** 节点 `disabled` 后本身不可选，**子孙继承禁用**（不可选）；
但展开箭头仍然可用，方便看结构。否则禁用一个父级就等于把整棵子树藏起来，排查数据时很别扭。

**展开状态存在容器里，不写回数据。** 节点 key 是「数据路径」（`0.1.2`），展开集合是容器内的
`Set`；`options` 重新赋值时按 key 恢复。选中节点的祖先会自动展开，所以外部改 `value` 也能看到
定位；数据里写 `expanded: true` 可让某个父级开场就展开。

**异步加载器是组件级 property（`el.load`），不写进 `options`。** 数据里只留一个 `lazy: true` 标记：
没有 `children`、又标了 `lazy` 的节点是懒父级，第一次展开才调用 `load(原始节点)`，等待期间箭头换成
小转圈（`data-loading`），成功后返回的数组成为子节点、自动展开；失败把箭头染成危险色
（`data-load-error`）并发 `load-error`，再点一次箭头就是重试。`load` 只能是函数，所以只挂在
宿主 property 上（属性通道是 JSON，装不下函数）。返回的节点默认是叶子，要继续懒加载就继续标
`lazy: true`；已加载的子节点留在容器里，重新赋 `options` 会按新数据重建。

**插槽分两类：触发框上的普通插槽，和行里的模板插槽。**

- 触发框：`prefix`（左侧附加物，空着不占位）与 `chevron`（右端箭头，不给就落回内置下箭头、
  展开时容器转 180°）；`empty` 是面板空态内容，给了就顶掉 `empty-text`。
- 行模板：`option` 是行正文（`<template slot="option">`），`icon` 是行首**展开 / 收起图标**
  （`<template slot="icon">`）；组件逐行克隆 —— 行仍然是数据驱动的，展开 / 选中 / 键盘 /
  异步加载都不受影响。模板里的元素写 `data-field="label"` 填文本、
  `data-field-attr="title:desc"` 把节点字段写进属性；不给 `option` 就落回 `label` 文本，
  不给 `icon` 就用内置右箭头（展开时容器旋转；加载中一律显示转圈）。
  两个 `<template>` 被 shadow 里隐藏的声明槽接住，增删由 `slotchange` 触发重建，
  同名多个只认第一个。

**单选先做，多选 / 搜索留到下一版。** 第一版只做「选一个节点 + 展开/收起 + 键盘 + 浮层」；
多选（`multiple` + 级联 + `check-strictly`）、`filterable` 搜索、`show-path` 路径显示都不在
这一版里 —— 它们会各自带来一套状态与键盘分支，混在一起会把第一版拖成第二个 select 的两倍大。

**`size` 只有三档。** `sm / md / lg` 交给 CSS，只动宿主高度与字号，树行跟宿主同高。树型选择
没有「按 px 微调高度」的明确场景（触发框和面板行要一起变），所以不像 slider / rate 那样收数字。

**宽度不跟选中项走。** 触发框默认给一个最小宽（`--mc-tree-select-min-w` = `10rem`），容器更宽时
自动撑满、更窄时被 `max-width: 100%` 收住；短标签（「浙江」/「上海」）之间切换宽度不变，长标签
由 `text-overflow: ellipsis` 截断。要固定成别的宽度写宿主 `style="width: …"` / 覆盖这个令牌。

**被裁掉的长标签有完整文案提示。** `.mc-value` 出现 `scrollWidth > clientWidth` 时，hover / focus
会在下方弹一个 top layer 的小浮层显示完整标签；面板打开时自动收起。提示来自共享的
[`../boot/overflow-tip.js`](../boot/overflow-tip.js)，宿主上同步 `[data-overflow]`。

**滚动条复用 `mc-scroll-bar`，不用原生条。** 原生滚动条在圆角面板里不只又白又厚，它还会
占住右侧那一条、把面板**右侧的上下圆角切成方角** —— 树一长出面板，右边就变成两个直角。
现在面板自己 `overflow: visible`，列表装在 `mc-scroll-bar` 里：覆盖式滑块、悬停才淡入、
不占内容宽，四个圆角都保留，展开 / 收起也不会横跳。

**已知边界。** `value` 以节点 `value` 为身份 —— 同一棵树里不要出现重复值；绑定到当前
`options` 里不存在的值时，触发框按「未选」显示（placeholder），但 `value` property 仍保留原值。

## 令牌

| 令牌                                     | 默认                        | 作用                                        |
| ---------------------------------------- | --------------------------- | ------------------------------------------- |
| `--mc-tree-select-h`                     | `--mc-control-h-md`         | 控件高（行也用它）                          |
| `--mc-tree-select-min-w`                 | `10rem`                     | 触发框最小宽（不跟选中项文字变）            |
| `--mc-tree-select-control-bg`            | `--mc-color-surface`        | 触发框底色                                  |
| `--mc-tree-select-control-border`        | `--mc-color-border`         | 触发框边框色（`invalid` 时换危险色）        |
| `--mc-tree-select-control-radius`        | `--mc-radius-md`            | 触发框圆角                                  |
| `--mc-tree-select-control-pad-x`         | `--mc-space-4`              | 触发框左右内边距                            |
| `--mc-tree-select-offset`                | `--mc-space-2`              | 面板到触发框的距离                          |
| `--mc-tree-select-panel-bg`              | `--mc-color-surface-raised` | 面板底色                                    |
| `--mc-tree-select-panel-border`          | `--mc-color-border-strong`  | 面板轮廓色                                  |
| `--mc-tree-select-panel-radius`          | `--mc-radius-lg`            | 面板圆角                                    |
| `--mc-tree-select-panel-pad`             | `--mc-space-2`              | 面板内边距                                  |
| `--mc-tree-select-panel-max-h`           | `16rem`                     | 树内容区的最大高（超出由 mc-scroll-bar 滚） |
| `--mc-tree-select-scrollbar-w`           | `6px`                       | 滚动条粗细（接到 mc-scroll-bar 上）         |
| `--mc-tree-select-scroll-thumb`          | `--mc-color-border-strong`  | 滚动条滑块颜色                              |
| `--mc-tree-select-scroll-thumb-hover`    | `--mc-color-fg-muted`       | 悬停在滑块上的颜色                          |
| `--mc-tree-select-indent-step`           | `--mc-space-4`              | 每深一级的缩进量                            |
| `--mc-tree-select-option-pad-x`          | `--mc-space-3`              | 行的基础左右内边距（缩进在它之上叠加）      |
| `--mc-tree-select-option-color`          | `--mc-color-fg`             | 行文字色                                    |
| `--mc-tree-select-option-bg-hover`       | `--mc-color-surface-sunken` | 悬停 / 键盘高亮的底色                       |
| `--mc-tree-select-option-bg-selected`    | `--mc-color-primary-subtle` | 已选行底色                                  |
| `--mc-tree-select-option-color-selected` | `--mc-color-primary`        | 已选行文字色                                |
| `--mc-tree-select-placeholder-color`     | `--mc-color-fg-subtle`      | 占位文案 / 空态文案的颜色                   |
| `--mc-tree-select-icon-color`            | `--mc-color-fg-subtle`      | 展开箭头 / 触发框箭头的颜色                 |
| `--mc-tree-select-clear-color`           | `--mc-color-fg-muted`       | × 按钮颜色                                  |
| `--mc-tree-select-clear-bg-hover`        | `--mc-color-surface-sunken` | × 按钮悬停底色                              |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。
> 还有一个 `--mc-tree-select-anchor`（锚点标识）：组件内部接线，不是使用者的覆盖点，代码里标了 `@internal`。

## 相邻单元

- `mc-select`（[`../select/`](../select/)）：平铺选项用 select；层级数据用 tree-select。
- `mc-menu`（[`../menu/`](../menu/)）：导航用 menu（行是链接 / 按钮、没有值）；从数据里**选一个值**
  用 tree-select。
- 复用 [`../boot/scroll-pin.js`](../boot/scroll-pin.js)：浮层开合的滚动守卫。
- 复用 [`../boot/overflow-tip.js`](../boot/overflow-tip.js)：长标签被 ellipsis 裁掉时的完整文案提示。
- 复用 [`mc-scroll-bar`](../scroll-bar/)：面板里的覆盖式滚动条（不占内容宽、不切圆角）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
