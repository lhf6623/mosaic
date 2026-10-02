# mc-spinner（加载指示）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-spinner` · 目录 `packages/spinner/`

加载指示。跟随当前文字色与字号。

## 单元里有什么

| 文件           | 角色                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| `spinner.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`    | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`       | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`       | 4 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`        | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-spinner — 加载指示

**没有插槽、没有 part、没有事件、没有布尔状态**：它就是一个图形。语义只有一个 ——
「这里在等」。所以接口只剩 `size` / `color` 两个维度，视觉全在 `:host` 上。

**为什么是 CSS 画的环，不是 `mc-icon` 的 `spinner` 图标**：
`mc-icon` 是独立组件（自带 shadow root、要走本地类名探测），一个「一直在转」的指示器
放进每个按钮里都要多一层 shadow；这里用 `border` 画一个开口的环 —— 零请求、零子组件，
`currentColor` 直接就是颜色。`mc-button` 的 `.mc-loader` 用的是图标集里的 `spinner`
（按钮里已经有一个图标位），两者形状同一套描边风格，但**刻意不共享实现**：
图标是「静态图形」，这里是「动画」。

**`color` 默认 `current`（继承文字色）**：spinner 95% 的场合嵌在按钮 / 提示条 / 表头里，
强制语义色会让它跟周围的文字脱节。代价是它自己不产生颜色 —— 这正是 `colorAttr` 的
`mode: 'fg'` 分支（同 `mc-icon`）：hex 直接写宿主的 `color`，语义名交给 CSS。
`:host` 上的 `color: inherit` 是**必须的**：`shadow-base.css` 的 reset 里有
`:host { color: var(--mc-color-fg) }`，它会把继承掐断（`mc-icon` 踩过同一个坑）。

**尺寸是 `font-size`，不是宽高**：图形盒恒为 1em，`size` 只写 1em / 1.5em / 2em ——
所以它天然跟着父级字号缩放，使用者想精确控制就写宿主 `style="font-size:…"`，
不用为极端的尺寸再加档位。

**动画时长走 `--mc-duration-*`**：`shadow-base.css` 在 `prefers-reduced-motion: reduce`
下把三个时长令牌统一压到 1ms，所以这里**不能写死秒数**，否则减弱动效偏好会静默失效。
模板里没有 `<l-m>`，也没有 `data()` 样式。

## 令牌

| 令牌                     | 默认                                | 作用                                                  |
| ------------------------ | ----------------------------------- | ----------------------------------------------------- |
| `--mc-spinner-duration`  | `calc(var(--mc-duration-slow) * 3)` | 转一圈的时长；减弱动效下随 `--mc-duration-*` 压到 1ms |
| `--mc-spinner-thickness` | `0.125em`                           | 环的粗细（跟着字号缩放，所以用 em）                   |

**`color` 也收 hex**（`<mc-spinner color="#ff6b35">`）：语义名仍走 CSS，hex 走
[`../boot/color-attr.js`](../boot/color-attr.js) 的 `fg` 模式 —— 直接写宿主的 `color`，
没有色槽。只收 hex，非 hex 一条警告、什么都不写。

## 相邻单元

- 与 [`mc-progress`](../progress/) 的分工：spinner 是**不确定**的等待（不知道要多久），
  progress 是**确定**的进度（有 `value` / `max`）—— 两者不该出现在同一块 UI 上。
- 与 [`mc-button`](../button/) 的 `loading` 的分工：按钮的加载态是**按钮自己的状态**
  （禁用 + 显示指示器，宽度不变），指示器只是它的一部分；要单独放一个「在转的圈」才用 spinner。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
