# mc-progress（进度条）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-progress` · 目录 `packages/progress/`

进度条。支持不确定态。

## 单元里有什么

| 文件            | 角色                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `progress.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`     | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`        | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`        | 7 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`         | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-progress — 进度条

**宿主本身就是轨道**：底色、圆角、`overflow: hidden` 都写在 `:host` 上，内部只有一个
`part="bar"` 的填充条。这样两条定制路都不用跨 shadow 找容器 —— 外部样式写
`style="height:…"` / `--mc-progress-track`，内部样式写 `::part(bar)`。
尺寸只有两档（4 / 8px），走自己的 `--mc-progress-h`：进度条不是可交互控件，
`--mc-control-h-*` 那三档（28/36/44）是给触控目标的，套上来会变成一根柱子。

**`value` / `max` 既是 observed attribute，也是宿主 property**（同 `mc-collapse-item` 的
`open`）：`el.value = 50` 写完**立刻**重绘，不等 ofa 把属性同步回 data 的那一拍。
所以 `paint()` 读的是 **attribute**（属性的唯一真相），不是 `this.value` ——
否则同步那一瞬读到的还是旧值。

⚠️ **这里刻意不套表单控件那套 `value`（property）/ `default-value`（attribute）约定**：
进度条不是表单控件 —— 它不接受输入、不参与提交、没有 `change` 事件，它的属性就是**当前的**
进度（和 `mc-collapse-item` 的 `open` 同形）。多一个 `default-value` 只会多一份会漂移的状态。

**确定态写内联宽度，不确定态把内联宽度清掉**：两个状态共用一个 `.mc-fill`，
不确定态的宽度与位移由 `:host([indeterminate]) .mc-fill` 与 `@keyframes` 给 ——
如果脚本在不确定态下也写内联 `width`，会**盖掉**那条 CSS 规则，动画就只剩位移。
所以 `paint()` 在不确定态下走的是 `style.removeProperty('width')`。

**动效走令牌**：填充宽度的过渡用 `--mc-duration-base`，不确定态的滑动时长用
组件级的 `--mc-progress-duration`（默认 = `--mc-duration-slow` × 4）。
`shadow-base.css` 在 `prefers-reduced-motion: reduce` 下把三个 `--mc-duration-*` 压到 1ms，
这里跟着一起停下来 —— 写死秒数就会让减弱动效偏好静默失效。

**无障碍**：宿主是 `role="progressbar"` + `aria-valuemin="0"` + `aria-valuemax`；
确定态写 `aria-valuenow`，不确定态**不留** `aria-valuenow`（那是「有一个确切进度」的承诺）
并加 `aria-busy="true"`。这些宿主属性都在 `attached()` 之后写（构造期写会抛
`NotSupportedError`），首次触发落在构造期的 watch 由 `_live` / `_fill` 守卫挡掉。

**没有事件**：进度条不接受点击，也不产生值变化 —— 使用者自己知道值什么时候变。
`mc-progress` 也不消费插槽：它没有可以放内容的语义位置（要标题 / 文字，放在它旁边的容器里）。

## 令牌

| 令牌                     | 默认                                | 作用                                                              |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------- |
| `--mc-progress-h`        | `0.5rem`（sm `0.25rem`）            | 轨道高                                                            |
| `--mc-progress-radius`   | `--mc-radius-full`                  | 轨道圆角（填充条 `border-radius: inherit` 跟着走）                |
| `--mc-progress-track`    | `--mc-color-surface-sunken`         | 轨道底色（未填充部分）                                            |
| `--mc-progress-fill`     | 按 `color`                          | 填充条底色；hex 时由接线器改写它                                  |
| `--mc-progress-duration` | `calc(var(--mc-duration-slow) * 4)` | 不确定态滑一个来回的时长；减弱动效下随 `--mc-duration-*` 压到 1ms |

**`color` 也收 hex**（`<mc-progress color="#1a7f5a">`）：语义名仍走 CSS，hex 走
[`../boot/color-attr.js`](../boot/color-attr.js) —— 填 `--mc-progress-fill`。
接的是 `slots: ['fill']`：进度条只有一条填充，浅底（`subtle-fill`）这一档不存在，
所以不装主题观察器、零常驻开销（那个文件里的 `-on-fill` 会一起写出来，但这里用不到）。
只收 hex，非 hex 一条警告、不写槽。

## 相邻单元

- 与 [`mc-spinner`](../spinner/) 的分工：spinner 说不出数（不知道要多久），progress 说得出数
  （有 `value` / `max`）—— 两者不该出现在同一块 UI 上。
- 与 [`mc-alert`](../alert/) 的分工：alert 是「把一件事的结论告诉使用者」，
  progress 是「把一件事的**进展**告诉使用者」；都不抢焦点、都不会自己消失。
- 草案见 [`packages/README.md`](../README.md) 的 `mc-progress` 行：
  关键属性与 `bar` part 与实现一致，实现只多了一件事 —— `value` / `max` 的 property 访问器
  （规范 1.4 的「运行时状态走 property」在这里是硬要求，草案里没写）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
