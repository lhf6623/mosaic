# mc-icon（图标）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M1 · 标签 `mc-icon` · 目录 `packages/icon/`

图标。先查内置、查不到再远程取一次；颜色继承 currentColor、尺寸跟随 font-size，取不到也只留一个不跳版的空位。

## 单元里有什么

| 文件                 | 角色                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| `icon.html`          | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`          | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`             | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`             | 12 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）              |
| `test/`              | 组件自己的冒烟套件（1 个文件）                                                |
| `icons.generated.ts` | 构建产物 / 附属文件                                                           |
| `icons.license.txt`  | 构建产物 / 附属文件                                                           |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-icon — 图标

三种来源，一个入口，优先级从高到低：

1. 默认插槽有内容 → 使用者自己放（元素即内容）
2. src="URL" → 任意 SVG 文件（自托管 / 品牌多色图）
3. name="…" → 先查本地，查不到再取远程

「本地」= mosaic.css 里有没有对应那条图标类规则（内置集由 `tools/gen-icons.mjs` 编译成
data-URI mask，零请求、零 JS、首屏就有）。判定方式不是抄一份名单，而是直接问 CSS：
给图形槽挂上类名，再看 getComputedStyle().maskImage 是不是 none —— 于是「本地」的定义
就是「你发出去的那份样式表里有什么」，扩了内置集自动生效。

远程只在这两种写法下发生：name 本地查不到，或显式给了 src。所以「没用到的图标一个请求都不发」。
· name="mdi:home" 有冒号 → 冒号前是图标集
· name="circle-check-big" 没冒号 → 用内置来源集（lucide）
URL 形状：{icon-base}{集名}/{图标名}.svg，默认 <https://api.iconify.design/>；icon-base 一个属性
就能换自托管。取回来直接内联成 <svg>，**不用 <use> + symbol**（实测：跨域 <use> 被 Chrome 与
WebKit 一致拒绝，shadow root 里引用文档级 #id 也不成立，而且 WebKit 不会重新解析后到的 symbol）。

改颜色只有两个控制点，都是原生 CSS：
· 颜色 = currentColor。默认继承周围文字色；color="primary|info|success|warning|danger|neutral"
给语义色；style="color:…" / 父元素继承 / class="text-primary" 一律有效。
· 尺寸 = font-size。盒子恒为 1em，size="sm|md|lg" 只是 0.875 / 1 / 1.25em，
所以 style="font-size:20px" 也直接管用。
这是对 API 规范 1.3（size = 控件高）的**显式例外**：图标不是控件，跟随字号才符合预期。

⚠️ 文件里不写任何内联 SVG 标记（Live Server 的注入点会抢走模块 script，见 mc-alert 文件头）；
远程图标是运行时用 DOMParser 解析后灌进 shadow root 的，源码里没有它们的形状。

## 令牌

> **没有 `--mc-icon-*` 令牌**：颜色走 `currentColor`、尺寸走 `font-size`，两个控制点都是原生
> CSS —— 按实例改样式直接写宿主 `style="…"`，要进内部就用 `::part(glyph)`。

**「本地」的定义是「你发出去的那份样式表里有什么」**：内置集由构建期 presetIcons 编译成
data-URI 的 `mask-image` 规则（`.mc-icon-<名字>`），组件给图形槽挂上类名、问
`getComputedStyle().maskImage` 判定命中 —— 不是抄一份名单，扩了内置集自动生效。
`lucide:search`（集名等于内置来源集）会退化成裸名再查一次本地，命中就零请求；
`mdi:home` 本地没有 → 取 `{icon-base}mdi/home.svg`；`circle-check-big`（无冒号）→ 按
`icon-set` 拼。

**取不到图标 = 空盒子 + 一条警告**：占住 1em、不跳版、不抛错，控制台只留一条 `[mosaic]`
警告；同一个图标（含取失败的名字）全页只请求一次。

**不用 `<use> + symbol` sprite**：跨域 `<use>` 被 Chrome 与 WebKit 一致拒绝，shadow root 里
引用文档级 `#id` 也不成立；
组件把取回的 SVG 直接内联。**内置图标是 mask 单色渲染，改不了描边粗细**，品牌多色图用
`src` 或默认插槽。

**框架内部怎么用这套图标**（写组件时的约定）：

- **静态**图标直接用类名：`<span class="mc-loader mc-icon-spinner" aria-hidden="true"></span>`
  —— 类规则已经在 `mosaic.css` 里、也被 adopt 进每个 shadow root，所以**零请求、零额外依赖**
  （`mc-button` 的 loading 指示器、`mc-collapse-item` 的折叠箭头都是这么写的）。
- **动态**换名 / 需要 `src` / 需要插槽时才用 `<mc-icon>` 组件：`mc-alert` 的左侧图形跟着
  `color` 变，所以它 `await load('../icon/icon.html')` —— 只引 `mc-alert` 的使用者会多取一次
  `icon.html`（约 5.7 KB gzip）。**能不引就不引**，静态图标没理由付这个钱。
- `mc-icon-` 前缀归图标集专用：组件内部类不要叫这个名字。`tools/gen-icons.mjs` 会守两头——
  组件里引用的 `mc-icon-x` 必须真的存在，组件 `<style>` 里的 `.mc-icon-x` 选择器不许和图标同名。

**在按钮里会被按钮接管两件事**（见 [button.md](../button/api.md)）：字号走 `--mc-button-icon-size`
（默认 `1.25em`，比按钮文字大一档），颜色强制跟随按钮文字色 —— 所以 **`color` 属性在按钮内部不生效**。
这是按钮层的特调，图标集本身（描边、尺寸比例）保持与上游一致。

## 为什么不发事件

> 页面上**没有**这一节：图标是纯展示元素，不用 `on:` 监听任何东西；
> 无障碍只看 `label`（有值才是有语义的图标，否则整块对读屏隐藏）。
> 这一行留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- 被 [`mc-alert`](../alert/) 与 [`message()`](../message/) 在运行时 `load()`，被 `mc-button` 在模板里消费；`mc-icon-*` 类名也被 `mc-button` 的 loading 指示器、`mc-collapse-item` 的折叠箭头**直接当类名用**（零请求）。

**`color` 也收 hex**（`<mc-icon color="#ff6b35">`）：图标没有色槽，`color` 本身就是前景色，
所以走 [`../boot/color-attr.js`](../boot/color-attr.js) 的 fg 模式 —— 直接写宿主 `color`；
`current` 与六个语义名照旧交给 CSS。只收 hex，非 hex 一条警告、不写内联色。
<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
