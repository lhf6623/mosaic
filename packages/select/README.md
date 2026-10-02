# mc-select（下拉选择）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-select` · 目录 `packages/select/`

下拉选择。最复杂的一个：浮层定位 + 键盘导航 + 点击外部判定。

## 单元里有什么

| 文件          | 角色                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `select.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `option.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`   | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`      | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`      | 7 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`       | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-select — 下拉选择（表单控件 + 浮层）

与 `mc-popover` / `mc-dropdown` 的分工：popover 是**通用容器**（内容由使用者给）、
dropdown 是**菜单**（触发元素 + 菜单项），select 是**表单控件** —— 选项、选中态、键盘导航、
`value` 都由它自己管。三者共用同一套浮层形态与层级。

⚠️ **浮层形态照 `mc-popover` 的四条结论**（定位与层级全交给浏览器原生能力）：

1. **面板是原生 `popover` 进 top layer**，不挂 `document.body`、不用 `--mc-z-*` 令牌 ——
   shadow root 里的 `position: fixed` 会被宿主页面的 `transform` / `filter` / `contain` 困住。
2. **锚点（`anchor-name`）必须设在 shadow 内的元素上** —— 这里就是触发框 `.mc-control`
   自己（它天然是 shadow 里的元素，所以不需要 popover 那层 `.mc-anchor` 包一层）。
3. **必须清掉 UA 给 `[popover]` 的 `inset: 0; margin: auto` 与 `border: solid`**，
   否则那对 auto 外边距会吃掉锚点定位、3px 的 currentColor 边框会自己长出来。
4. **开合浮层时浏览器可能顺手把页面滚一下**（实测火狐，Chrome 复现不出来）——
   滚动守卫必须在 `ready()` 里接、`detached()` 里 `dispose()`，显式 `showPopover()`
   那一行包成 `guard.run(() => …)`；工具与上游依据见 [`../boot/scroll-pin.js`](../boot/scroll-pin.js)。

另外**两条这个单元特有的决定**：

- **面板用 `popover="manual"`，开合自己管**。`popover="auto"` 的 light dismiss 发生在
  **pointerdown** 上，等 click 到达时面板已经被浏览器关掉，再 `toggle()` 会把它**重新开回来**
  （表现是「点第二次关不掉」）；而点外部判定又必须走 `e.composedPath()`（`contains(e.target)` 在 shadow 边界上拿到的是
  被重定向后的宿主，必然误判成外部）。所以这里选「自己管」这一条路：外部点击由
  `document` 上的 `pointerdown` + `composedPath` 判定，Esc 由触发框的 `keydown` 处理
  （顺手 `preventDefault`，避免和原生 close-watcher 抢），关闭后把焦点还给触发框。
- **`mc-option` 只是数据，面板里的行由 `mc-select` 渲染**。渲染出的每一行才有
  `part="option"`（`::part()` 够不到插槽里的 light DOM 元素），行也才能跟着 `aria-selected` /
  `data-active` 走样式。代价是 `mc-option` 的默认插槽只被读文案、不直接显示 ——
  它自己 `:host { display: none }`。选项用 `o-fill` 生成时也能收到
  （条目住在 `o-fill` 自己的 light DOM 里，
  所以按宿主 `querySelectorAll('mc-option')` 收集，而不是只看 `slot.assignedElements()`）。

**多选的不对称是有意的**：`default-value` 属性是逗号分隔字符串、`value` property 是
`string[]`。属性是 HTML 里的**初始值**（HTML 没有数组），property 是 JS 的**运行时值**
（数组才装得下多个值、也不怕值里带逗号）；两者各自贴合自己那一侧的用法，
代价是同一个字段两种形状 —— 文档页与 `api.md` 开场白都点明了。

**状态写成宿主钩子**：`data-open`（面板正在显示）/ `data-filled`（至少选中一项）/
`data-empty`（一项没选）挂在宿主上。组件自己的 shadow CSS 靠它们换样式
（`:host([data-empty]) .mc-value`、`:host([data-open]) .mc-chevron`、
`:host([clearable][data-filled]) .mc-clear`），**外层也拿它按状态写样式** ——
`mc-select[data-filled] { … }`，或配 `::part()`：`mc-select[data-open]::part(base) { … }`
（文档页的「外部样式」「内部样式」两条演示）。

## 令牌

写在宿主 `style="…"` 上按实例覆盖：

| 令牌                                | 默认                        | 作用                                           |
| ----------------------------------- | --------------------------- | ---------------------------------------------- |
| `--mc-select-control-bg`            | `--mc-color-surface`        | 触发框底色                                     |
| `--mc-select-control-border`        | `--mc-color-border`         | 触发框边框色（`invalid` 时被换成危险色）       |
| `--mc-select-control-radius`        | `--mc-radius-md`            | 触发框圆角                                     |
| `--mc-select-control-pad-x`         | `--mc-space-4`              | 触发框左右内边距                               |
| `--mc-select-offset`                | `--mc-space-2`              | 面板到触发框的距离                             |
| `--mc-select-panel-bg`              | `--mc-color-surface-raised` | 面板底色                                       |
| `--mc-select-panel-border`          | `--mc-color-border-strong`  | 面板**轮廓色**（drop-shadow 画的，不是真边框） |
| `--mc-select-panel-radius`          | `--mc-radius-lg`            | 面板圆角                                       |
| `--mc-select-panel-pad`             | `--mc-space-2`              | 面板内边距                                     |
| `--mc-select-option-color`          | `--mc-color-fg`             | 选项文字色                                     |
| `--mc-select-option-bg-highlight`   | `--mc-color-surface-sunken` | 悬停 / 键盘高亮的底色                          |
| `--mc-select-option-bg-selected`    | `--mc-color-primary-subtle` | 已选项底色                                     |
| `--mc-select-option-color-selected` | `--mc-color-primary`        | 已选项文字色                                   |
| `--mc-select-placeholder-color`     | `--mc-color-fg-subtle`      | 占位文案（没有选中项时）的颜色                 |
| `--mc-select-icon-color`            | `--mc-color-fg-subtle`      | 右端箭头（chevron）的颜色                      |
| `--mc-select-clear-color`           | `--mc-color-fg-muted`       | × 按钮的颜色                                   |
| `--mc-select-clear-bg-hover`        | `--mc-color-surface-sunken` | × 按钮悬停底色                                 |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。
> 还有一个 `--mc-select-anchor`（锚点标识）：它是组件内部的接线，不是使用者的覆盖点，在代码里标了 `@internal`。

## 相邻单元

- 复用 [`../boot/scroll-pin.js`](../boot/scroll-pin.js)：浮层开合的滚动守卫（浮层组件一行接线）。
- 与 [`mc-popover`](../popover/) / [`mc-dropdown`](../dropdown/) 共用同一套浮层形态（原生 popover + CSS 锚点定位），分工见上。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
