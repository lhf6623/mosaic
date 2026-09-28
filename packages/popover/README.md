# mc-popover（浮层）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M3 · 标签 `mc-popover` · 目录 `packages/popover/`

通用浮层：锚在触发元素上，原生 popover + CSS 锚点定位，贴边自动翻转。

## 单元里有什么

| 文件           | 角色                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| `popover.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`    | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`       | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`       | 6 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`        | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-popover — 通用浮层（点击/悬停/手动触发，锚在触发元素上）

与 mc-dropdown / mc-tooltip 的分工：popover 是**通用容器**（内容由使用者给），
dropdown / tooltip 将来只是在它上面固定住内容形态的预设；三者共用同一套定位与层级。

⚠️ **定位与层叠全部交给浏览器原生能力，这是本组件最核心的决定**（设计规范第七节要求
M3 浮层开工前先验图层）：面板用 `popover="auto"` 进 top layer，位置用 CSS 锚点定位，
贴边翻转白拿 —— 别再退回 JS 读 rect 算坐标。这也回答了 roadmap 里
「是否改用 popover API」那个问题 —— 答案是**用**。

这套决定落地时踩出来的**六条坑不写在这里**，见下面「实现约束」（改这个组件前逐条看）。

⚠️ 依赖 `packages/boot/scroll-pin.js`（定住滚动条的工具）：开合原生浮层时浏览器可能顺手
滚一下页面（实测火狐 156，二分结论与上游链接写在该文件头），那是**运行时的兜底**，
不是定位逻辑 —— 别把它当作可以省掉的装饰。

⚠️ **受控与非受控是两条互斥的路，混用是「点了没反应 / 面板不弹」的最常见来源**：
`trigger="click"` / `hover` 时开合由组件自己管，它顺手把状态写回 `open` 属性；要自己管状态就用
`trigger="manual"` + `open` 属性 —— 组件同样会增删这个属性（把浏览器发起的关闭同步回来，
两个方向才都收敛），外部只改属性、只听 `close`。两条路一起用：点触发元素走的是组件自己的
`toggle()`，会和外部那份 state 抢着写同一个属性。

## 令牌

写在宿主 `style="…"` 上按实例覆盖：

| 令牌                           | 默认                        | 作用                                                                                                |
| ------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `--mc-popover-offset`          | `--mc-space-2`              | 面板到触发元素的距离（四个方向同一档）                                                              |
| `--mc-popover-panel-bg`        | `--mc-color-surface-raised` | 面板底色                                                                                            |
| `--mc-popover-panel-border`    | `--mc-color-border-strong`  | **轮廓色**：面板不画 `border`，一圈描边是 drop-shadow 跟「面板 + 三角」整体轮廓做的，三角共用这一条 |
| `--mc-popover-panel-radius`    | `--mc-radius-lg`            | 面板圆角                                                                                            |
| `--mc-popover-panel-pad`       | `--mc-space-4`              | 面板内边距                                                                                          |
| `--mc-popover-panel-min-width` | `0`                         | 最小宽度：菜单类面板太窄会显得挤，也避免贴边翻转后宽度抖动                                          |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单七节），将来由主题编辑器展示—— 依据 [`doc-render.md`](../../agent/doc-render.md) §三。

## 实现约束（改这个组件前必须知道）

浮层的定位与层级**全部交给浏览器原生能力**，这是这个组件最核心的决定。六条实测出来的坑：

1. **不能退回 `position: fixed` + `z-index`**：shadow root 里的 fixed 会被宿主页面的
   `transform` / `filter` / `contain` 困住（实测同一个盒子 y 从 10 变成 1404）。
   原生 `popover="auto"` 进 top layer，不受层叠上下文影响，还白送 Esc 与点空白关闭 ——
   所以 `--mc-z-*` 这套层级令牌在浮层上**用不上**（top layer 天然在最上）。
2. **锚点必须设在 shadow 内的元素上**：把 `anchor-name` 设在 light DOM 的 slot 元素上无效
   （跨 shadow 边界不成立，面板会掉到 UA 默认位置）。所以触发元素外面套了一层 `.mc-anchor`。
3. **必须清掉 UA 给 popover 的 `inset: 0; margin: auto`**：那两个 auto 外边距会把
   `left: anchor(left)` 挤掉（面板水平居中而不是对齐）。组件里写的是 `inset: auto; margin: 0`，
   靠 `margin-top/bottom/left/right` 单独给间距。
4. **锚点容器必须是 `inline-flex`**：`inline-block` 会带上行盒的基线缝隙（实测锚点盒子比
   触发元素高 3px），而锚点的几何就是面板的定位基准 —— `top` / `right-start` / `left-start`
   这些方向会整体偏 3px。
5. **面板必须显式写 `border: 0`**：UA 给 `[popover]` 的是 `border: solid` —— 只写了 style，
   宽度取 medium（**3px**）、颜色取 currentColor，不写就得到一圈跟着文字颜色走的边框
   （实测亮色下 rgb(60 67 77)、暗色下接近白）。面板的描边现在由 `filter: drop-shadow` 跟
   「面板 + 三角」的**整体轮廓**做，所以这条必须显式归零；顺手也解释了为什么**面板不写
   `border`**：边框只长在矩形上，三角没有，轮廓会在三角那条边上断掉、显得三角是塌的。
6. **显示 / 收起原生浮层时，浏览器可能顺手把页面滚一下 —— 必须把滚动位置钉住**。
   实测火狐 156：在文档站的 Popover 页点一下触发元素，正文带 `.doc-main` 会跳一段
   （用户描述是「点一下页面往上蹿」）。二分结论：触发点是原生 `showPopover()` 这个动作
   （面板留在 DOM 里但不显示时完全不跳；把 `position-anchor` / `position-try-fallbacks`
   摘掉也照跳），与锚点定位、面板样式都无关。而浮层是 `fixed` + top layer，开合它**不该**
   改变页面滚动位置，所以在原生动作前后把位置钉住 —— 用 `packages/boot/scroll-pin.js`
   （跨组件共用的工具，别的浮层/组件也要兜这件事时直接 `import` 它即可）。
   三种形状都要覆盖，少一种就漏：**① 显示动作里的同步 / 下一帧 / 更晚 task**；
   **② 手势之后、显示之前就被滚**（`attr:open` → 模板重渲染可能先滚，等 `showPopover()`
   再记快照就晚了 —— 所以用手势时刻的位置当锚点）；**③ 浏览器自己发起的关闭**
   （light dismiss / Esc 不走 `hide()`，只有 `beforetoggle` 快照 + `toggle` 回滚能兜住）。
   往上找滚动容器必须穿透 shadow root 与 `<slot>`（正文带住在槽与宿主之间）。
   用户自己滚（滚轮 / 触摸 / 在别处按下）当帧放手：只拦浏览器顺手带出来的位移，不拦人。
   `packages/popover/test/popover.test.mjs` 对这三种形状各有一条断言 + 一条工具契约断言
   （都用「模拟浏览器滚页面」的方式，浏览器里不跳也能守住）。

另外四条：**`right` / `left` 的居中变体要单独写**（`anchor(center)` + `translate: 0 -50%`，
第一版和 `-start` 合并在一个选择器里，交叉轴贴的是顶边）；**`close` 事件只有一个出口**
（`show()` / `hide()` 都不直接发，统一由原生 `toggle` 派发，两处都发会重复）；
**「这一下点击是开还是关」要按 pointerdown 那一刻判**（`onAnchorPointerDown`）——
`popover="auto"` 的 light dismiss 就发生在 pointerdown 上，等 click 到达时面板已经被浏览器
关掉了，这时再 `toggle()` 会把它**重新开回来**（表现是「点第二次关不掉」，面板一直开着）。
所以 `trigger="click"` 的判定是「按下去时是否开着」，而且这条只有**真机指针**验得出来：
合成 `click` 不触发 light dismiss，套件里专门有一条走 `page.mouse` 的断言守着；
**「默认就显示」的开关（`arrow`）要把默认态留在基类规则里**，属性只表达非默认那一档
（`arrow="none"` 关掉）—— ofa 里 `:host()` 嵌 `:not()` 静默失效（P14），默认态一旦挂到属性
选择器上就会整体失效（同 `mc-card` 的 `divider="none"`）。

## 刻意不做的

- **不做进场 / 退场动画**：连续操作时动效拖慢手感，且 top layer 里 `transform` 受限、
  能做的效果有限。要动画的使用者自己在 `::part(panel)` 上加，或者用 `open` / `close`
  事件自己驱动。

## 相邻单元

- 与将来那批浮层（`mc-dialog` / `mc-dropdown` / `mc-tooltip`，草案见 [`planned.md`](../../agent/api/planned.md)）的分工：popover 是**通用容器**，那几个只是在它上面固定住内容形态与交互的预设 —— 共用同一套定位与层级。

- 图层问题的结论在这里定型：**一律用原生 `popover` 进 top layer**，不挂 `document.body`、不用 `z-index` 令牌；开合时浏览器顺手滚页面那一下由 `packages/boot/scroll-pin.js` 钉住。

<!-- hand:end -->

## 改这个单元之前

- 造组件 / 改样式：[`authoring.md`](../../agent/authoring.md) · [`authoring-style.md`](../../agent/authoring-style.md)
- 写组件前必读的踩坑清单：[`pitfalls/README.md`](../../agent/pitfalls/README.md)
- 跨组件约定与组件索引：[`api/README.md`](../../agent/api/README.md)
- 文档页怎么排：[`doc-pages.md`](../../agent/doc-pages.md)
