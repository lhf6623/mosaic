# Mosaic

基于 [ofa.js](https://ofajs.com) 的 **免安装、免构建** Web Components UI 框架。
CSS 用 UnoCSS 做原子化，配色与尺寸走三层 CSS 变量令牌，通过 jsDelivr `/gh/` 分发。

**当前状态（M1 进行中）**：`mc-button` / `mc-code` / `mc-collapse` / `mc-menu` / `mc-breadcrumb`
已实现，各自带文档页、可交互演示和冒烟测试；令牌生成（含 34 项 WCAG 自检）、UnoCSS 管线、
运行时引导层都已验证。其余组件的接口已经定稿，进度见 [PLAN.md 的里程碑](./agent/PLAN.md#五里程碑)。

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

三条引入缺一不可：`mosaic.css` 给**你的页面**工具类与令牌，`mosaic.js` 把工具类注入每个
shadow root，`<l-m>` 按需拉组件本体。没有 npm、打包器、脚手架、配置文件。

## 组件

| 组件                           | 标签                                   | 状态      |
| ------------------------------ | -------------------------------------- | --------- |
| Button                         | `mc-button`                            | ✅ 已实现 |
| Code                           | `mc-code`                              | ✅ 已实现 |
| Collapse                       | `mc-collapse` / `mc-collapse-item`     | ✅ 已实现 |
| Menu                           | `mc-menu` / `mc-menu-item`             | ✅ 已实现 |
| Breadcrumb                     | `mc-breadcrumb` / `mc-breadcrumb-item` | ✅ 已实现 |
| Icon / Card / Badge / Spinner  | —                                      | M1 待建   |
| 表单、反馈、浮层、布局共 15 个 | —                                      | M2 / M3   |

完整清单与逐组件 API 见 [component-spec.md](./agent/component-spec.md) —— 那是唯一真相源，
文档站的左栏菜单、右栏目录、总览卡片、面包屑与翻页都由 `docs/site-map.js` 与页面标题派生，不用手工维护。

## 用法要点

**代码展示**：`<mc-code>` 的内容就是标签里的纯文本，高亮按需从 CDN 懒加载 —— 加载失败
只是没有颜色，代码、行号、折行、限高滚动照常。文本有四种传法（优先级 `src` > `code` 属性 >
标签内文本）：贴在标签里、`code="…"`、ofa 绑定 `<mc-code :code="snippet">`、
或 `src="…"` 指向片段文件（长片段 / 含 `<script>` 的，文件里不用转义）。

**定制只用 CSS**：主题切换是 `<html data-theme="dark">`，按实例精确覆盖用内联样式，
结构化定制用 `::part()`：

```html
<mc-button style="height: 32px; border-radius: 8px">精确覆盖</mc-button>
```

```css
:root {
  --mc-primary-600: 16 185 129; /* 未分层 → 必定赢过 @layer mosaic.tokens */
}
mc-button::part(base) {
  text-transform: uppercase;
}
```

**原子类是一份预编译的精选子集**（当前 370 个），覆盖布局 / 间距 / 排版 / 语义色，在你自己
的页面与组件里都能直接写。子集之外的类名（`mt-7`、`bg-gradient-to-r` 之类）**不存在**，
需要时自己写 CSS —— 原因见 [PLAN.md D5](./agent/PLAN.md#d5-unocss-的三层用法)。

## 文档

| 文档                                                | 内容                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [规划总纲](./agent/PLAN.md)                         | 定位、约束、六个关键决策（含被否决的备选及理由）、目录结构、构建分发、里程碑、风险        |
| [**设计规范**](./agent/design-spec.md)              | **怎么用令牌**：间距节奏、布局、响应式与断点、排版、交互状态、动效、层级、无障碍、文案    |
| [设计令牌与配色](./agent/design-tokens.md)          | **有什么值**：OKLCH 生成的 6 色族 × 11 档色板、语义令牌、WCAG 自检、换肤指南              |
| [**组件 API 规范**](./agent/component-spec.md)      | **有哪些组件、各自什么接口**：四个正交维度、值读写规则、事件/插槽/part、逐组件 API 表     |
| [组件编写规范](./agent/components.md)               | **怎么造组件**：目录约定、分层职责、`<style>` 五分区、文档站约定、交付检查清单            |
| [**ofa.js 实战踩坑清单**](./agent/ofa-pitfalls.md)  | **写组件前必读**。39 条静默失效的坑，附现象、原因、正确写法                               |
| [文档站重构设计](./agent/docs-refactor.md)          | 已完成：class 组件改 ofa 组件模板 + `$.stanz` 抽路由状态 + `dom.js` 删除（含阶段 0 实测） |
| [调研：UnoCSS](./agent/research/unocss.md)          | preset 选型、shadow DOM 注入、体积实测数据                                                |
| [调研：jsDelivr 分发](./agent/research/jsdelivr.md) | 缓存策略、SRI、双载问题                                                                   |
| [调研：ofa 状态管理](./agent/research/state.md)     | `$.stanz` / `o-provider` 在 shadow DOM 下的实测记录（P35–P37 的来源）                     |

## 仓库结构

```
index.html            入口：只做引入（CSS + ofa.js + 路由库 + o-app 挂载点）
app-config.js         ofa.js 应用配置（首页、加载态、错误兜底）
packages/
  boot/               mosaic.css（生成：令牌 + 工具类）、mosaic.js（attachShadow 补丁 + adopt）、shadow-base.css
  color/              tokens.css（生成：三层令牌）+ 令牌文档页
  <name>/             {name}.html 组件本体、page.html 文档页、demos/*.html 例子、test/*.test.mjs
docs/                 文档站的站点级资源：pages/ layout.html doc-layout.html content.css site-map.js routes.js state/route.js doc-nav.html doc-crumb.html doc-pager.html doc-toc.html doc-cards.html doc-palette.html shell.css site.js
tools/                gen-tokens.mjs（调色板 + 对比度自检）、build-css.mjs、serve.mjs
tests/                smoke.mjs 入口 + lib/harness.mjs + site/*.mjs（跨组件不变量）
agent/                规范文档（见上表）
```

**没有 `dist/`。** `packages/**` 就是 CDN 上的东西 —— 仓库即产物。

## 开发

```bash
pnpm install
pnpm tokens        # 生成令牌并自检对比度（不达标退出 1）
pnpm build         # = tokens && build:css → packages/boot/mosaic.css
pnpm dev           # 本地服务器：http://localhost:8642（零依赖，强制禁缓存）
pnpm test          # 真浏览器冒烟测试（驱动本机 Chrome）：10 个站点套件 + 每个已实现组件的套件
pnpm test <slug>   # 只跑某个组件的套件（如 pnpm test menu）
pnpm test:site     # 只跑站点套件；pnpm test:site nav 只跑名字/标签里匹配 nav 的那几条
pnpm typecheck     # tsc --noEmit（只检查 uno.config.ts）
pnpm check:drift   # 重新生成后比对 git diff，防止产物与生成器漂移
pnpm format        # prettier 格式化（pnpm format:check 只检查）
```

冒烟测试需要先起服务器；套件分两处：跨组件的站点不变量在 `tests/site/`，组件自己的断言在
`packages/<slug>/test/`（数据里 READY 的都该有一个）。`pnpm format` 不碰测试代码、
生成产物、`packages/*/demos/*.html`（逐字展示的例子）与 `agent/research/`；文档页里内联的
`<mc-code>` 要加 `<!-- prettier-ignore -->`，详见 [.prettierignore](./.prettierignore)。
**测试只跑命中的那部分**（`pnpm test <slug>` / `pnpm test:site <关键词>`），全量 `pnpm test`
留到收尾验收跑一次 —— 中途重复全量既慢，又会掩盖「这次改动影响了什么」。

当前实测产物：**34.8 KB raw / 7.7 KB gzip**（其中令牌 14.0 KB raw，370 个工具类）。

## 文档站

仓库自带一个可运行的文档站，**它自己就是一个 ofa.js 应用**（`o-router` + `o-app` +
`<template page>` 页面模块 + 一个布局页），用 GitHub Pages 直接托管 —— Pages 源设为 `main`
分支的仓库根即可，不需要 CI。它同时是 M0 的验收载体：页面里那些 `<mc-button>` 是真实渲染的。

```bash
pnpm dev                                 # http://localhost:8642
node tools/serve.mjs --prefix /mosaic    # 模拟 Pages 子路径（/mosaic/）
```

两条站内约定（实现细节见 [components.md](./agent/components.md)）：

- **文档跟着组件走**：组件在 `packages/<slug>/`，文档页就是同目录的 `page.html`（API 表 +
  演示 + 注意事项），路由地址 `#/packages/<slug>/page.html`。
- **演示区一个例子一个文件**：例子是 `demos/*.html`（ofa 组件，可单独打开、单独测），
  页面里写它的标签 + 一行 `mc-collapse` 抽屉，代码面板 `<mc-code src>` 引用同一份文件。

## 五条不可谈判的约束

1. **使用者侧零工具链** —— 任何"请先安装 X"的方案直接否决
2. **组件不过打包器** —— `packages/**.html` 源 = 产物。ofa.js 的组件就是一个 `.html`，不该变成 JS bundle
3. **组件不依赖宿主页面的任何 CSS** —— 宿主可能没有 reset，也可能有很激进的 reset
4. **定制点只用原生 CSS** —— `style="..."` + 令牌 + `::part()`，不用 JS 配置对象
5. **只有一个运行时依赖 ofa.js**，且 pin 在验证过的版本

技术选型上的硬性红线（都有实测依据，理由见 [PLAN.md](./agent/PLAN.md)）：

- 用 **`presetWind3`**，不用 `presetWind4` —— 后者的 theme 色不支持 `<alpha-value>`，会产出非法 CSS 且静默失效
- **必须开 `outputToCssLayers`** —— `adoptedStyleSheets` 在 shadow root 内的优先级**高于**组件自身 `<style>`
- **组件里禁止 `dark:` 变体** —— shadow root 内的选择器匹配不到 `<html data-theme>` 这个跨边界祖先，是静默失效
- **组件只消费语义令牌**，不碰原始色阶 —— 原始色阶不随主题切换
- **构建缺输入必须大声失败** —— 实测 UnoCSS 会静默跳过缺失文件，退出码 0，产出没有令牌的坏 CSS
- **颜色令牌全链路存通道三元组**（`114 70 237`），存不包 `rgb()`、用必须包 —— 混着来会产出 `rgb(rgb(...))` 非法 CSS 并静默失效
- **令牌只定义在 `:root`，刻意不带 `:host`** —— 写了 `:host` 会让 shadow root 内的宿主元素重新赋亮色值，盖掉继承来的暗色值，切主题时组件纹丝不动
