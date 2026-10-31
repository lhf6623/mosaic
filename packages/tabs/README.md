# mc-tabs（标签页）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-tabs` · 目录 `packages/tabs/`

标签页。

## 单元里有什么

| 文件        | 角色                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `tabs.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `tab.html`  | 同族子标签，随本体一起引入                                                    |
| `page.html` | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`    | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`    | 6 个演示（页面用可编辑示例读**同一份文件**）                                  |
| `test/`     | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### 标签用 name，面板内容写在 mc-tab 里

`mc-tab` 只渲染一颗按钮：文案取 `name` 属性；面板内容写进它的**默认插槽**（不再有平级的
`slot="panel"` 子元素）。容器同步状态时给每个 `mc-tab` 造一个 `<div slot="panel" value="…">`
包装节点、把它的子节点整段搬进去 —— 面板区在容器的 shadow 里，只有容器的 direct child
才投影得过去。所以：

- 面板内容**仍是 light DOM**（搬到包装节点里，不是搬进 shadow），页面样式照样生效；
- 面板仍用 `hidden` 常驻 DOM，不用 `o-if` / `o-fill`，切回来内容与滚动位置都在；
- 代价是容器**会造节点、会搬节点** —— 这条 API（2026-10 起）和原来「一个节点都不造」不同，
  记在这里，免得以后把它当成 bug 修掉。

`no-panel` 是给「只要一颗分段切换器」的页面：面板区 `hidden`、面板内容不搬也不显示 ——
`docs/components/example.html` 的视图切换器就是一例。

容器只认**直接子项**：嵌套的 `mc-tabs` 各自算各自的，不会互相误伤（同 `mc-collapse` 的容器策略）。

### 值：初始值属性、运行时 property

`default-value` 只决定首屏（`attrs` 里声明，所以它是 observed attribute）；运行时读写宿主
property `value` —— 它在 `ready()` 里挂访问器，不是 `attrs` 键、也不反射成属性
（规范 1.4）。`el.value = 'b'` 是同步生效的，
且**不发 `change`**：事件只表示"使用者改了它"。

指向禁用项、或指向一个不存在的 `value` 时都退到第一个可用项 —— 面板与标签因此不会同时空着。

### 键盘

- 可交互元素是 `mc-tab` 内部那颗**原生 `<button>`**（`part="base"`），禁用直接走
  `:disabled`：指针、键盘两条路一起堵住。
- roving tabindex 写在这颗 button 上：只有激活项 `tabindex="0"`，其余 `-1`；方向键 /
  <kbd>Home</kbd> / <kbd>End</kbd> 移动**并激活**（焦点也跟着走），跳过禁用项、到头绕回。
- 指示条（`part="indicator"`）由 JS 按激活标签**内部 button** 的位置写宽度与位移 ——
  line 档扣掉按钮左右内边距，贴**文字**实际宽度（下划线不横贯整个标签格）；
  segmented 档浮块则盖满整颗按钮。位移写在**内容系**上（补偿 `scrollLeft`），
  指示条作为滚动容器里的绝对定位层跟内容一起滚，滚到哪都跟得准。
  `ResizeObserver` 盯着标签条与每个标签：字体、文案、容器宽度变了都跟着重摆，
  `mc-tab` 比容器晚升级也能补上。
- **子项总宽超出容器**：标签条自己横向滚动兜底（`overflow-x: auto`，滚动条收起），
  布局不被撑破。激活项在点击 / 键盘 / 外部改 `value` 三条路上都会自动滚进可视区
  （在 `placeIndicator` 里手写滚动量，不用 `scrollIntoView` —— 它会把页面级祖先一起滚）。
  y 向 `clip` 防止内容伸出产生纵向滚动，指示条因此不再压住下边线（`bottom: 0`）。
- **左右滚动导航**：溢出时标签条两侧出现导航（`prefix` / `suffix` 两个插槽 + 同名 part），
  默认内容是内置箭头按钮（内联 SVG，本体保持零依赖），点击滚一屏的 80%；页面塞了同名插槽
  内容就整体替换默认箭头，点击仍由外壳接管触发滚动（想完全自定义行为就 `stopPropagation`）。
  不溢出时两侧 `display: none`；滚到头的那一侧退成 `visibility: hidden` —— 占位但不响应，
  导航显隐不会引起标签条宽度抖动。显隐由 `syncNav()` 算（`placeIndicator` 与 scroll 监听都会调），
  滚动条隐藏了它就是唯一的可视滚动入口。

### 外观：line / segmented

`variant` 只换标签条的样子，不换行为。`line`（默认）是下划线标签；`segmented` 是分段切换器：
浅底轨道 + **会滑动的选中浮块**（指示条复用为滑块，`placeIndicator` 量宽写位移，
transition 让它连续滑过去），正好装「编辑 / 预览」这类**模式切换** ——
样式是从 `docs/components/example.html` 里那颗 ofa.js / 普通例子切换器抽出来的。
选中项的底色 / 投影因此画在**容器的指示条**上，`mc-tab` 自己只换文字色 ——
各标签自画底色是切换前的旧做法（没有动画），别再加回去。
滑块是定位元素会盖住标签文字，容器用 `::slotted(mc-tab) { position: relative; z-index: 1 }` 抬一层。
轨道默认**收缩到内容宽**（`flex: 0 1 auto`）—— 分段切换器就该是一条贴着标签的小胶囊，
不是横贯整行的灰带；`flex: 1` 只属于 line 档（下边线要通栏）。想让它铺满整行由页面自己覆盖：
`::part(list) { display: flex; flex: 1 }` + 子项 `flex: 1`（`docs/components/example.html` 的
模式切换器就是这么做的，两边标签平分）。
档位差异全落在 `--mc-tabs-*` 令牌上（容器 → 子项继承），`mc-tab` 的 shadow 里不需要认识
`variant`，新档位不会在子项里长出第二套属性选择器。

### 悬停：只换文字色，不铺底色

悬停时文字变主题色（`--mc-tabs-fg-hover`，默认 `--mc-color-primary`），标签底色不动。
不铺灰底是刻意的：悬停块会跟下划线指示条抢视觉，segmented 档的轨道本身已是浅灰底、
再叠一层更脏。想加底色由页面接管 —— `::part(base):hover { background-color: … }`，
组件不留一个没人消费的 `--mc-tabs-bg-hover` 旋钮。

### 光标：可点区只有标签按钮

标签条 `.mc-list` 显式写 `cursor: default`：子项之间的 `gap` 属于这一层，而 `cursor` 是
**继承属性** —— `mc-tabs` 放进可点击卡片 / 文档示例壳时，缝隙会跟着继承到 `pointer`，
看上去像"缝也能点"。可点区只有 `mc-tab` 内部那颗 `<button>`，它自己带 `pointer`，
所以手型停在标签上、缝隙里是箭头。要整条可点请自己覆盖 `::part(list) { cursor: pointer }`。

## 令牌

| 令牌                        | 默认                                | 作用                                                                                        |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `--mc-tabs-tab-h`           | `--mc-control-h-md`                 | 标签高度（只写在容器上，继承进 `mc-tab`）                                                   |
| `--mc-tabs-pad-x`           | `--mc-space-3`                      | 标签左右内边距                                                                              |
| `--mc-tabs-font`            | `--mc-text-sm`                      | 标签字号                                                                                    |
| `--mc-tabs-gap`             | `--mc-space-1`                      | 标签之间的间距                                                                              |
| `--mc-tabs-panel-pad`       | `--mc-space-4`                      | 面板容器上下内边距（`no-panel` 时不生效）                                                   |
| `--mc-tabs-fg`              | `--mc-color-fg-muted`               | 未选中标签的文字色                                                                          |
| `--mc-tabs-fg-hover`        | `--mc-color-primary`                | 悬停时的文字色（悬停不铺底色，见「设计取舍」）                                              |
| `--mc-tabs-fg-selected`     | `--mc-color-primary`                | 选中标签的文字色                                                                            |
| `--mc-tabs-border`          | `--mc-color-border`                 | 标签条那根下边线                                                                            |
| `--mc-tabs-indicator`       | `--mc-color-primary`                | 指示条颜色                                                                                  |
| `--mc-tabs-indicator-h`     | `2px`                               | 指示条粗细                                                                                  |
| `--mc-tabs-bg-selected`     | `transparent`                       | 选中项的底色：line 档没人消费；segmented 档由滑动指示条（浮块）消费，= `--mc-color-surface` |
| `--mc-tabs-shadow-selected` | `none`                              | 选中项的投影：同上，segmented 档是浮块那层浮起阴影                                          |
| `--mc-tabs-tab-radius`      | `--mc-radius-md --mc-radius-md 0 0` | 标签按钮圆角（segmented 档换成 `--mc-radius-sm`）                                           |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

> ⚠️ `mc-tab` 侧一律写成 `var(--mc-tabs-x, 兜底)`：在子项 `:host` 上写默认值会盖掉容器继承来的值，
> 容器的尺寸通道就永远不生效（同 `mc-collapse-item` 那条）。

## 相邻单元

- 与 [`mc-collapse`](../collapse/) / [`mc-menu`](../menu/) 同族：**容器 + 子项**两个标签，容器管外框与尺寸
  （靠 `--mc-tabs-*` 继承给子项），子项管自己那一格。
- 本体不依赖任何其它组件（零 `load()`）：标签文案是 `name`（纯文本），没有 label 插槽。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定与组件索引：[`packages/README.md`](../README.md)
- 文档页 / 演示区规范：[`packages/page-spec.md`](../page-spec.md)
