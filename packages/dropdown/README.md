# mc-dropdown（下拉菜单）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M3 · 标签 `mc-dropdown` · 目录 `packages/dropdown/`

下拉菜单。

## 单元里有什么

| 文件            | 角色                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `dropdown.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`     | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`        | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`        | 5 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`         | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-dropdown — 下拉菜单（触发元素 + 面板）

与 `mc-popover` / `mc-select` 的分工：popover 是**通用容器**（触发方式与内容都由使用者给）、
select 是**表单控件**（选项与 `value` 归它管），dropdown 是**菜单**：形态与交互固定成
「一个触发元素 + 一块菜单面板」。三者共用同一套浮层形态与层级。

⚠️ **浮层形态照 `mc-popover` 的四条结论**（定位与层级全交给浏览器原生能力）：

1. **面板是原生 `popover` 进 top layer**，不挂 `document.body`、不用 `--mc-z-*` 令牌 ——
   shadow root 里的 `position: fixed` 会被宿主页面的 `transform` / `filter` / `contain` 困住。
2. **锚点（`anchor-name`）设在 shadow 内的 `.mc-anchor` 容器上**，不能设在 light DOM 的
   触发元素上（跨 shadow 边界不成立，面板会掉到 UA 默认位置）—— 所以触发元素外面包了一层。
3. **必须清掉 UA 给 `[popover]` 的 `inset: 0; margin: auto` 与 `border: solid`**，
   否则那对 auto 外边距会吃掉锚点定位、3px 的 currentColor 边框会自己长出来。
4. **开合浮层时浏览器可能顺手把页面滚一下**（实测火狐，Chrome 复现不出来）——
   滚动守卫必须在 `ready()` 里接、`detached()` 里 `dispose()`，显式 `showPopover()` /
   `hidePopover()` 那两行包成 `guard.run(() => …)`；工具与上游依据见
   [`../boot/scroll-pin.js`](../boot/scroll-pin.js)。

另外**四条这个单元特有的决定**：

- **面板用 `popover="manual"`，开合自己管**。`popover="auto"` 的 light dismiss 发生在
  **pointerdown** 上，等 click 到达时面板已经被浏览器关掉，再开合会把它**重新开回来**
  （表现是「点第二次关不掉」）；而点外部判定又必须走 `e.composedPath()`（`contains(e.target)` 在 shadow 边界上拿到的是
  被重定向后的宿主，必然误判成外部）。所以外部点击由 `document` 上的 `pointerdown` +
  `composedPath` 判定，Esc 由宿主上的 `keydown` 处理（顺手 `preventDefault`，避免和原生
  close-watcher 抢），关闭后把焦点还给触发元素里第一个能聚焦的元素。
- **`open` 是唯一真相，属性与 property 两个方向都收敛到原生 popover 状态**。事件与 UI 状态
  从 `syncOpenUI()` 这一个出口发（`open` / `close` 各一次）：显式开合**同步**走它，
  原生 `toggle` 只当兜底 —— 排队发的 `toggle` 在「刚关就又开」的连招里会丢事件
  （实测：Esc 后立刻再开，`open` 事件收不到）。首触发照例跳过，构造期不碰 popover。
- **面板内容不自己收起**。面板里可能是表单、多级内容或不希望关的说明 —— 关不关由使用者决定
  （在菜单项上写 `on:click="open = false"`）。这条也写在文档页「基本用法」的导语里。
- **复用 `mc-menu-item` 而不是自己造一套菜单项**：行盒子、当前项 / 禁用态的镜像都在那个
  单元里，这里只
  `await load('../menu/menu-item.html')` 把它带进来，**不改 menu 目录**。
  `--mc-menu-*` 通道没有 `mc-menu` 容器时走各自的兜底值，所以单放菜单项也是完整的行。

## 令牌

写在宿主 `style="…"` 上按实例覆盖：

| 令牌                            | 默认                        | 作用                                                                   |
| ------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| `--mc-dropdown-offset`          | `--mc-space-2`              | 面板到触发元素的距离（四个方向同一档）                                 |
| `--mc-dropdown-panel-bg`        | `--mc-color-surface-raised` | 面板底色                                                               |
| `--mc-dropdown-panel-border`    | `--mc-color-border-strong`  | 面板**轮廓色**（drop-shadow 画的，不是真边框）                         |
| `--mc-dropdown-panel-radius`    | `--mc-radius-lg`            | 面板圆角                                                               |
| `--mc-dropdown-panel-pad`       | `--mc-space-2`              | 面板内边距                                                             |
| `--mc-dropdown-panel-min-width` | `0px`                       | 面板最小宽度的**下限**（默认 0：宽度跟着内容；面板始终不窄于触发元素） |

**面板宽度跟着内容**（`width: max-content`）：菜单项会把标签的宽度贡献上来（它的插槽元素
走正常流，见 `../menu/README.md` 的「行盒子」），所以三个两字标签就是三个两字标签的宽，
长菜单项也不会被裁。面板同时不窄于触发元素（`min-width: anchor-size(width)`）；
要额外的固定下限就覆盖 `--mc-dropdown-panel-min-width`（**必须带单位**，`0px` 这类）。

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。
> 还有一个 `--mc-dropdown-anchor`（锚点标识）：它是组件内部的接线，不是使用者的覆盖点，在代码里标了 `@internal`。

## 相邻单元

- 复用 [`mc-menu-item`](../menu/menu-item.html)：面板里那些行的外观与状态归它，dropdown 只提供锚点、面板与开合。
- 复用 [`../boot/scroll-pin.js`](../boot/scroll-pin.js)：浮层开合的滚动守卫（浮层组件一行接线）。
- 与 [`mc-popover`](../popover/) / [`mc-select`](../select/) 共用同一套浮层形态（原生 popover + CSS 锚点定位），分工见上。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
