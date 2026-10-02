# mc-checkbox（复选框）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-checkbox` · 目录 `packages/checkbox/`

复选框。支持半选态。

## 单元里有什么

| 文件            | 角色                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `checkbox.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`     | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`        | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`        | 6 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`         | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**语义在原生 input，视觉在宿主。** 内部那个 `<input type="checkbox">` 不做任何样式
（`clip-path: inset(50%)` 的视觉隐藏，而不是 `display:none` —— 后者会连焦点与键盘一起拿掉），
方框、勾、横杠都是组件自己画的。换来的是：<kbd>Space</kbd> 切换、读屏的「复选框，已选中」、
表单语义全部白拿，组件只管「长什么样」。

**为什么不用「透明 overlay 铺满宿主」那套**（`mc-button` / `mc-tag` 用的）：checkbox 的文案是
插槽内容，使用者会往里塞链接（`同意 <a href="/terms">条款</a>`）。铺满整行的透明层会把链接
一起吞掉；而原生 `<label>` 的激活只作用于「非交互后代」，点链接照常跳转，点文案才切换选中。

**`checked` 是属性 + property 双通道，`indeterminate` 只有前者是属性。** `checked` 进 `attrs`
（ofa 的观察通道，`:host([checked])` 才有得选）；宿主 DOM property 的 setter 额外立刻同步一次
内部原生 input，不等 ofa 那一拍。
`indeterminate` 在原生里根本没有 HTML 属性，所以它只是「宿主属性 → `.indeterminate` → CSS」的单向转发，
点击后由组件把两边一起清掉 —— 这正是原生 checkbox 的行为。两个状态都开了同形宿主访问器
（`el.checked = true` / `el.indeterminate = true`），读写方式跟原生元素一致。

**刻意不做**：`default-checked`（`checked` 本来就既是初始值也是运行时状态，多一个名字只会漂移）；
自定义勾形（内置图标集里的 `check` / `minus` 直接吃类名，零请求、和其余图标同一套描边）。

## 令牌

| 令牌                      | 默认                  | 作用                             |
| ------------------------- | --------------------- | -------------------------------- |
| `--mc-checkbox-gap`       | `var(--mc-space-2)`   | 方框与文案的间距（`sm` 收窄）    |
| `--mc-checkbox-pad-x`     | `var(--mc-space-3)`   | 行盒子左右内边距（三档尺寸改它） |
| `--mc-checkbox-box-size`  | `1.15em`              | 方框边长，跟宿主字号走           |
| `--mc-checkbox-mark-size` | `0.75em`              | 勾 / 横杠的字号                  |
| `--mc-checkbox-radius`    | `var(--mc-radius-sm)` | 方框圆角                         |

## 相邻单元

- `mc-radio` + `mc-radio-group`（[`../radio/`](../radio/)）：选项互斥时用它们，
  一组里永远只有一个选中；checkbox 允许同时勾多个。
- `mc-switch`（[`../switch/`](../switch/)）：只有「开 / 关」两态、改完立刻生效时用它。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
