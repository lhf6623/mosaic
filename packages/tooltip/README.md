# mc-tooltip（提示气泡）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M3 · 标签 `mc-tooltip` · 目录 `packages/tooltip/`

提示气泡。

## 单元里有什么

| 文件           | 角色                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| `tooltip.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`    | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`       | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`       | 5 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`        | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**浮层形态照 [`mc-popover`](../popover/README.md) 的结论**：面板是 `popover="manual"`，进 top layer，
位置用 CSS 锚点定位（`anchor-name` / `position-anchor` / `position-try-fallbacks`），
贴边自动翻转是白拿的 —— **不挂 `document.body`、不用 `z-index` 令牌**，也不受宿主页面
`transform` / `filter` / `contain` 影响。用 `manual` 是因为气泡的显隐完全由 `trigger` / `delay` 决定，
浏览器那套 light dismiss 只会添乱。开合时浏览器可能顺手滚页面，接的是同一个
[`scroll-pin`](../boot/scroll-pin.js) 守卫（`attachFloatingScrollGuard` + 显式显示那一行包 `run()`）。

**内容只有 `content` 一句纯文本**（不是 `title`）：声明 `title` 会让宿主自己弹出浏览器原生 tooltip，两套气泡会同时出现。

**不给使用者的触发元素写任何属性**（不加 `aria-describedby`、不改 `tabindex`）：插槽里的 DOM 归使用者。
键盘可达因此靠**聚焦触发** —— `trigger="hover"` 时 `focusin` / `focusout` 与鼠标一视同仁，
所以「悬停能看到」的元素用 <kbd>Tab</kbd> 走到时也能看到。`focusin` 是 `composed` 的，
`mc-button` 内部那个原生按钮拿到焦点时也会冒到锚点容器上。

落地时踩出来的四条，改这个组件前逐条看：

1. **锚点必须设在 shadow 内的元素上**：把 `anchor-name` 设在 light DOM 的 slot 元素上无效
   （跨 shadow 边界不成立，面板会掉到 UA 默认位置）。所以触发元素外面套了一层 `.mc-anchor`，
   并且它得是 `inline-flex` —— `inline-block` 会带上行盒基线缝隙（实测锚点盒比触发元素高 3px），
   而锚点的几何就是面板的定位基准。
2. **必须清掉 UA 给 `[popover]` 的 `inset: auto` / `border: solid`**：前者的 auto 外边距会吃掉
   `left: anchor(left)`；后者只写了 style（宽度取 medium = 3px、颜色取 currentColor），
   不显式 `border: 0` 就得到一圈跟着文字颜色走的 3px 边框。面板的轮廓改由两层 `drop-shadow`
   跟整体轮廓做（同 `mc-popover`）。
3. **面板不写 `display`**：关着靠 UA 的 `[popover]:not(:popover-open){display:none}` 收起来；
   作者一写 `display` 就压过它，关着的面板会一直挂在页面上。
4. **`trigger="click"` 的「点外部」必须走 `composedPath()`**：
   composed 事件冒泡到 document 时 `e.target` 已被重定向成宿主，`contains(e.target)` 必然误判。

另外：`delay` 用一个 `setTimeout` 实现，`detached()` 里必须清掉 —— 组件被摘掉之后回调还跑，
会对着已经不在文档里的面板调 `showPopover()`。

## 令牌

写在宿主 `style="…"` 上按实例覆盖：

| 令牌                        | 默认                          | 作用                                                   |
| --------------------------- | ----------------------------- | ------------------------------------------------------ |
| `--mc-tooltip-offset`       | `--mc-space-2`                | 气泡到触发元素的距离（四个方向同一档）                 |
| `--mc-tooltip-panel-bg`     | `--mc-color-surface-raised`   | 气泡底色                                               |
| `--mc-tooltip-panel-border` | `--mc-color-border-strong`    | **轮廓色**：不画 `border`，一圈描边是 drop-shadow 做的 |
| `--mc-tooltip-panel-radius` | `--mc-radius-md`              | 气泡圆角                                               |
| `--mc-tooltip-panel-pad`    | `--mc-space-2` `--mc-space-3` | 气泡内边距（上下 / 左右）                              |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单七节），将来由主题编辑器展示。

## 刻意不做的

- **不发事件**：气泡的显隐是交互的副产品，没有 Second-party 需要知道的时刻；
  `mc-popover` 的 `open` / `close` 是给受控开合用的，tooltip 没有受控开合这一档。
- **不做富内容 / 交互内容**：气泡里放按钮、链接一律推荐换 `mc-popover` —— 非模态浮层里
  做焦点管理是另一个组件的事。
- **不做 `arrow`**：一句话的气泡加小三角收益很小，`::part(panel)` 想加自己加。

## 相邻单元

- 形态与坑的源头是 [`mc-popover`](../popover/)：同一个 `popover` + top layer 结论、同一份
  锚点定位数学、同一个 [`scroll-pin`](../boot/scroll-pin.js) 滚动守卫。
- [`mc-dialog`](../dialog/) 是同一批浮层里的另一个：它**模态**、抢焦点、自带遮罩，两者正好互补。
- 演示里的触发元素用 [`mc-button`](../button/)（页面自己 `<l-m>` 注册）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
