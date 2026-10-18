# mc-slider（滑动选择）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-slider` · 目录 `packages/slider/`

滑动选择：在一段连续区间里拖一个值；内部是原生 `<input type="range">`。

## 单元里有什么

| 文件          | 角色                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `slider.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`   | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`      | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`      | 8 个演示（页面用 `<doc-playground src>` 读**同一份文件**）                    |
| `test/`       | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**原生 `<input type="range">` 承载行为，视觉自绘。** 键盘（方向键 / Home / End / PageUp / PageDown）、
焦点、点轨道跳转、拖动惯性全部来自原生 range，组件不自己监听 pointermove；原生 input 铺满整行、
`opacity: 0`，下面才是自绘的轨道 / 填充 / 滑块。这样 `part` 能对外开放（原生 range 的
`::-webkit-slider-thumb` 这类伪元素没法给 `part`），几何也由脚本按比例算，不依赖各家浏览器
对 range 内部结构的实现差异。

**自绘位置与原生命中严格一致。** 原生 input 的 thumb 直径也写成 `--mc-slider-thumb`
（`::-webkit-slider-thumb` / `::-moz-range-thumb`），于是「点 x 位置 → value 是多少」和
自绘滑块停在哪用的是同一个公式：`left = ratio × (轨道宽 − 滑块宽)`。填充条到滑块中心
（再多半个滑块），所以 min 时滑块贴左、max 时贴右，两端都不会留出歪掉的一段。

**比例只写一个内部变量。** 脚本把 `(value − min) / (max − min)` 夹到 0～1，写进
`--mc-slider-ratio`（内部令牌，`@internal`），填充条与滑块都读它。改 `--mc-slider-thumb` /
轨道尺寸时两条规则一起跟上，不存在「改了尺寸、位移忘了改」的静默走形。

**值是表单控件那套，不是 progress 那套。** `value` 是 observed attribute + 宿主 property
（绑定通道 `:value` / `sync:value` 落在它上面，写完立刻生效），`default-value` 只作非受控初值、
挂载读一次。和 [`mc-progress`](../progress/) 的差别：progress 不接受输入、没有 `change`，
它的属性就是当前进度；slider 是**输入控件**，所以跟着 input / switch 的约定走。
什么都没写时初值落成 `min`（原生 range 的默认值是区间中点，直接留着会让
`<mc-slider>` 显示 50，和「从下限开始」的直觉相反）。

**程序化写值也按 step 归一。** 原生 range 的值归一算法会在写值时把 37 配 `step="10"` 落到 40，
组件不另做一层「保留原值」的取整 —— 拖动 / 键盘 / 属性 / property 四条通道因此落在同一档上。
归一后组件把 `value` 属性同步成实际值（`reflectValue()`），受控绑定的数据和控件状态不会差一档。

**`color` 只染填充与滑块描边**，语义名走 CSS，hex 走共享接线器
[`../boot/color-attr.js`](../boot/color-attr.js) —— 填 `--mc-slider-fill`。只接 `slots: ['fill']`：
滑块底色用 `--mc-slider-thumb-bg`（surface），跟语义色无关，所以不需要 `-on-fill` 这一档。
非 hex 一条警告、不写槽（同其它接了这个接线器的组件）。

**已知边界。** 视觉比例按从左到右算（`.mc-base` 上钉了 `direction: ltr`）—— RTL 页面不翻转，
要用 RTL 自己在外层镜像；拖拽没有额外的吸附动画，值按原生 range 的步进走。

## 令牌

| 令牌                      | 默认（按 size）                                         | 作用                                                      |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `--mc-slider-h`           | `--mc-control-h-md`（sm `-sm` / lg `-lg`）              | 控件高；数字 size 按 px 写它                              |
| `--mc-slider-track-h`     | `calc(--mc-slider-h / 6)`（md 6px；sm/lg 显式 4 / 8）   | 轨道高；数字 size 下按控件高比例算                        |
| `--mc-slider-thumb`       | `calc(--mc-slider-h * 4 / 9)`（md 16px；sm/lg 12 / 20） | 滑块直径；也决定原生 thumb 与行程；数字 size 下同比例缩放 |
| `--mc-slider-track`       | `--mc-color-surface-sunken`                             | 未填充轨道底色                                            |
| `--mc-slider-track-hover` | `--mc-color-border`                                     | hover 时未填充轨道底色                                    |
| `--mc-slider-thumb-bg`    | `--mc-color-surface`                                    | 滑块底色                                                  |
| `--mc-slider-fill`        | 按 `color`（默认 `--mc-color-primary`）                 | 填充条与滑块描边；hex 时由接线器改写它                    |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

## 相邻单元

- `mc-progress`（[`../progress/`](../progress/)）：只展示进度、不接受输入时用它；
  要使用者自己拖出一个值才用 slider。
- `mc-switch` / `mc-checkbox`（[`../switch/`](../switch/) / [`../checkbox/`](../checkbox/)）：
  离散的开 / 关或勾选；slider 是连续区间里的一个数。
- `mc-input`（[`../input/`](../input/)）：精确数字优先用输入框；slider 适合「大致位置」的调节。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
