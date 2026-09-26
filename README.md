# Mosaic

基于 [ofa.js](https://ofajs.com) 的 **免安装、免构建** Web Components UI 框架。
CSS 用 UnoCSS 做原子化，配色与尺寸走三层 CSS 变量令牌，通过 jsDelivr `/gh/` 分发。

在 HTML 里加一个 `<link>` 和一个 `<script type="module">`，就能用 `<mc-button>` ——
没有 npm、没有打包器、没有脚手架、没有配置文件。

**文档站**：<https://lhf6623.github.io/mosaic/> —— 组件清单、每个组件的例子与 API、
设计令牌色板都在那里，站点自己就是用这套组件渲染的。

## 快速开始

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/boot/mosaic.css"
/>
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/boot/mosaic.js"
></script>

<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
<mc-button color="primary">提交</mc-button>
```

三条引入各管一段，缺一不可：

| 引入         | 作用                                                       |
| ------------ | ---------------------------------------------------------- |
| `mosaic.css` | 令牌（颜色 / 间距 / 字号）与工具类，给**你的页面**用       |
| `mosaic.js`  | 把工具类注入每个 shadow root（组件的样式靠它，令牌靠继承） |
| `<l-m src>`  | 按需拉取并注册组件本体，一个组件一条                       |

> 示例里的 `0.1.0` 是计划中的 M1 版本；仓库当前还没有 tag，首次发布前这些 URL 会 404。

## 用法要点

**按需引入**：一个组件一条 `<l-m>`（见上面的快速开始），同族组件共用一个目录
—— 目录 `tag/` 对应标签 `mc-tag`。

**定制只用 CSS**：主题切换是 `<html data-theme="dark">`，按实例精确覆盖用内联样式，
结构化定制用 `::part()` —— 不需要记任何 JS 配置对象：

```html
<mc-button style="height: 32px; border-radius: 8px">精确覆盖</mc-button>
```

```css
:root {
  --mc-primary-600: 16 185 129; /* 换主色：改一个通道三元组 */
}
mc-button::part(base) {
  text-transform: uppercase;
}
```

**工具类是一份预编译的精选子集**（当前 370 个），覆盖布局 / 间距 / 排版 / 语义色，
在你自己页面的 HTML 里可以直接写。子集之外的类名（`mt-7`、`bg-gradient-to-r` 之类）
**不存在**，需要时自己写 CSS。

**代码展示**：`<mc-code>` 的内容就是标签里的纯文本，高亮按需从 CDN 懒加载 —— 加载失败
只是没有颜色，代码、行号、折行、限高滚动照常：

```html
<mc-code language="javascript"> const a = 1; </mc-code>
```

## 本地运行

```bash
pnpm install
pnpm build   # 生成令牌与工具类 CSS（产物提交进仓库）
pnpm dev     # 打开文档站：http://localhost:8642
pnpm test    # 浏览器冒烟测试（另开一个终端先 pnpm dev）
```

组件本体**不需要构建**：`packages/**` 源即产物，`pnpm build` 只产出共享 CSS
（`packages/color/tokens.css` 与 `packages/boot/mosaic.css`）。

## 仓库结构

```
index.html            入口：只做引入（CSS + ofa.js + 路由库 + o-app 挂载点）
app-config.js         ofa.js 应用配置（首页、加载态、错误兜底）
packages/
  boot/               mosaic.css（生成：令牌 + 工具类）、mosaic.js（attachShadow 补丁 + adopt）、shadow-base.css
  color/              tokens.css（生成：三层令牌）+ 令牌文档页
  <name>/             {name}.html 组件本体、page.html 文档页、demos/*.html 例子、test/*.test.mjs
docs/                 文档站：pages/、两层布局页、site-map.js（菜单与页面的唯一数据源）、components/（站点自己的 doc-* 组件）
tools/                gen-tokens.mjs（调色板生成 + 对比度自检）、build-css.mjs、serve.mjs
tests/                浏览器冒烟测试：站点不变量 + 每个组件的套件
agent/                规范与设计文档（见下表）
```

**没有 `dist/`。** `packages/**` 就是 CDN 上的东西 —— 仓库即产物。

## 文档

| 文档                                              | 内容                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [**agent/ 导航**](./agent/README.md)              | **先读这份**：按任务挑模块 —— 造组件 / 写文档页 / 踩坑清单 / 设计与令牌，不从头读           |
| [组件 API 规范](./agent/api/README.md)            | **有哪些组件、各自什么接口**：四个正交维度、值读写、属性 / 事件 / 插槽与 part（逐组件一份） |
| [ofa.js 实战踩坑清单](./agent/pitfalls/README.md) | **写组件前必读**。42 条静默失效的坑，附现象、原因、正确写法                                 |
| [**设计规范**](./agent/design-spec.md)            | **怎么用令牌**：间距节奏、布局、响应式与断点、排版、交互状态、动效、层级、无障碍、文案      |
| [设计令牌与配色](./agent/design-tokens.md)        | **有什么值**：OKLCH 生成的 6 色族 × 11 档色板、语义令牌、WCAG 自检、换肤指南                |
| [规划总纲](./agent/plan/README.md)                | 定位与约束、关键决策（含被否决的备选及理由）、目录结构、构建分发、里程碑、风险              |

## 文档站

**在线**：<https://lhf6623.github.io/mosaic/>（GitHub Pages，源设为 `main` 分支的仓库根，不需要 CI）。

站点源码就在 `docs/`：**它自己就是一个 ofa.js 应用**（`o-router` + `o-app` +
`<template page>` 页面模块 + 两层布局页），改文档与改组件一样，推上去就是新的。

```bash
pnpm dev                                 # http://localhost:8642
node tools/serve.mjs --prefix /mosaic    # 模拟 Pages 子路径（/mosaic/）
```

两条站内约定：

- **文档跟着组件走**：组件在 `packages/<名字>/`，文档页就是同目录的 `page.html`
  （例子 + API + 插槽 + 定制 + 注意事项），路由地址 `#/packages/<名字>/page.html`。
- **演示区一个例子一个文件**：例子是 `demos/*.html`（ofa 组件，可单独打开），
  页面里写它的标签 + 一行折叠抽屉，代码面板 `<mc-code src>` 引用同一份文件。

## 五条不可谈判的约束

1. **使用者侧零工具链** —— 任何「请先安装 X」的方案直接否决
2. **组件不过打包器** —— `packages/**.html` 源 = 产物，ofa.js 的组件就是一个 `.html`
3. **组件不依赖宿主页面的任何 CSS** —— 宿主可能没有 reset，也可能有很激进的 reset
4. **定制点只用原生 CSS** —— `style="..."` + 令牌 + `::part()`，不用 JS 配置对象
5. **只有一个运行时依赖 ofa.js**，且 pin 在验证过的版本

技术选型上的硬性红线（`presetWind3`、必须开 `outputToCssLayers`、组件里禁止 `dark:`、
只消费语义令牌、颜色令牌存通道三元组……）都有实测依据，理由见
[规划总纲](./agent/plan/decisions.md) 的「关键决策」一节。
