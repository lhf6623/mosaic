# Mosaic

基于 [ofa.js](https://ofajs.com) 的 **免安装、免构建** Web Components UI 框架。
CSS 用 UnoCSS 做原子化，配色与尺寸走三层 CSS 变量令牌，通过 jsDelivr `/gh/` 分发。

**当前状态：骨架已跑通，组件库待建。**
令牌生成（含 34 项 WCAG 自检）、UnoCSS 管线、参考组件（`mc-button` / `mc-code` / `mc-collapse`）、构建链都已验证；
运行时引导层和其余组件尚未实现 —— 见 [里程碑 M0](./agent/PLAN.md#五里程碑)。

---

## 目标 API

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/boot/mosaic.css">
<script type="module" src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/boot/mosaic.js"></script>

<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
<mc-button color="primary">提交</mc-button>
```

没有 npm，没有打包器，没有脚手架，没有配置文件。

代码展示用 `<mc-code>`：内容是标签里的纯文本，高亮按需从 CDN 懒加载 ——
**加载失败只是没有颜色**，代码、行号、折行、限高滚动都照常工作：

```html
<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/code/code.html"></l-m>
<mc-code language="javascript" line-numbers>
  const a = 1;
</mc-code>
```

代码文本有四种传法（优先级 `src` > `code` 属性 > 标签内文本）：贴标签里（短片段最好读）、
`code="…"` 属性、ofa 模板绑定 `<mc-code :code="snippet">`、
或 `src="../snippets/quick-start.html"` 指向**片段文件**（长片段 / 含 `<script>` 的片段，
文件里不用转义）。运行时 `el.code = …` 与 `setAttribute('code', …)` 等价且立刻生效。

这是唯一的"可选运行时依赖"（highlight.js，pin 版本、按需加载；配色直接用它的官方主题），
取舍见 [PLAN.md D7](./agent/PLAN.md#d7-代码高亮可选依赖--失败即降级)。

主题切换、按实例定制、结构化样式穿透，全部只用 CSS：

```html
<html data-theme="dark">
<mc-button style="height: 32px; border-radius: 8px">精确覆盖</mc-button>
```
```css
/* 换品牌色：未分层 → 必定赢过 @layer mosaic.tokens */
:root { --mc-primary-600: 16 185 129; }

/* 结构化定制 */
mc-button::part(base) { text-transform: uppercase; }
```

> ⚠️ `mosaic.js` 尚未实现（M0）。组件本体已可独立工作。

### 关于原子类

`mosaic.css` 自带一份**预编译的精选工具类子集**（当前 354 个），
覆盖布局 / 间距 / 排版 / 语义色，在你自己页面和自己的 ofa 组件里都能直接写：

```html
<div class="flex items-center gap-4 p-6 bg-surface rounded-lg border border-border">
  <span class="text-muted text-sm">已选 3 项</span>
  <mc-button size="sm">确认</mc-button>
</div>
```

**边界要提前说清楚**：这是预编译产物，只包含已知的类名。
子集之外的（`mt-7`、`bg-gradient-to-r` 之类）**不存在**，需要时请自己写 CSS。
原因见 [PLAN.md D5](./agent/PLAN.md#d5-unocss-的三层用法)。

---

## 文档

| 文档 | 内容 |
|---|---|
| [规划总纲](./agent/PLAN.md) | 定位、约束、六个关键决策（含被否决的备选及理由）、目录结构、构建分发、里程碑、风险 |
| [**设计规范**](./agent/design-spec.md) | **怎么用令牌**：间距节奏、布局、响应式与断点、排版、交互状态、动效、层级、无障碍、文案 |
| [设计令牌与配色](./agent/design-tokens.md) | **有什么值**：OKLCH 生成的 6 色族 × 11 档色板、语义令牌、WCAG 自检、换肤指南 |
| [**组件 API 规范**](./agent/component-spec.md) | **有哪些组件、各自什么接口**：四个正交维度、值读写规则、事件/插槽/part、逐组件 API 表 |
| [组件编写规范](./agent/components.md) | **怎么造组件**：目录约定、分层职责、`<style>` 五分区、交付检查清单 |
| [**ofa.js 实战踩坑清单**](./agent/ofa-pitfalls.md) | **写组件前必读**。32 条静默失效的坑，附现象、原因、正确写法 |
| [调研：UnoCSS](./agent/research/unocss.md) | preset 选型、shadow DOM 注入、体积实测数据 |
| [调研：jsDelivr 分发](./agent/research/jsdelivr.md) | 缓存策略、SRI、双载问题 |

---

## 仓库结构

```
index.html             入口：**只做引入**（CSS + ofa.js + 路由库 + o-app 挂载点），不写内容标记
app-config.js          ofa.js 应用配置（首页地址、加载态、错误兜底）
packages/
  boot/
    mosaic.js          手写：attachShadow 补丁 + 样式 adopt（唯一必需引入的 JS）
    mosaic.css         生成并提交：令牌 + 工具类（可 <link>）
    shadow-base.css    手写：只进 shadow root 的 reset（禁止 <link>）
  color/
    tokens.css         生成并提交：三层令牌
    page.html          令牌文档页
  button/
    button.html        组件本体（源 = 产物，构建不碰它）
    page.html          组件文档页        ← 文档跟着组件走
    demos/*.html       每个演示一个 ofa 组件文件（活样例与代码面板同一份）
    test/*.test.mjs    组件自己的冒烟断言
  code/
    code.html          代码展示：语法高亮（可选 CDN 依赖，失败即降级为纯文本）
    page.html          组件文档页
    demos/ test/
  collapse/
    collapse.html      折叠面板容器：外框 / 尺寸 / 互斥
    collapse-item.html 折叠面板子项：开合骑在原生 details/summary 上
    page.html          组件文档页
    demos/ test/
docs/                  站点级资源
  pages/               站点级页面模块（ofa.js <template page>）
    home.html  guide.html  components.html  specs.html
  snippets/            被 mc-code 的 src 引用的代码片段（真 HTML/JS，不用转义）
  layout.html          **布局页**（嵌套路由的父页面）：顶栏 + 正文带 + <slot>
  components.js        组件登记表：二级菜单 / 总览 / 首页卡片都由它渲染
  routes.js            路由工具（route() 归一当前路由；一级菜单在 layout.html 里）
  doc-nav.js           <doc-nav> 站点级自定义元素：页面自己的二级菜单
  shell.css            文档级样式：视口契约 + o-router/o-app/o-page 高度链
  content.css          正文样式（每个页面模块自己 <link>）+ 分栏与二级菜单
  site.js              站点脚本（行为）：页面占位渲染（组件卡片 / 色板）
  theme-boot.js        首帧主题（head 里的同步经典脚本，防闪色）
tools/
  gen-tokens.mjs       调色板生成 + WCAG 对比度自检
  build-css.mjs        CSS 构建入口（含「缺输入大声失败」守卫）
  serve.mjs            本地静态服务器（零依赖，强制禁缓存）
tests/
  smoke.mjs            冒烟测试入口：站点套件 + 登记表里每个 READY 组件的套件
  lib/harness.mjs      公共基座：浏览器 / 断言 / 穿透查询注入 / 导航工具
  site/*.mjs           跨组件的站点不变量
uno.config.ts          UnoCSS 配置（纯声明式，含精选工具类子集）
tsconfig.json          只覆盖 uno.config.ts
agent/                  规范文档（Markdown）
```

**没有 `dist/`。** `packages/**` 就是 CDN 上的东西 —— 仓库即产物。

## 文档站

仓库自带一个可运行的文档站，**它自己就是一个 ofa.js 应用**（`o-router` + `o-app` +
`<template page>` 页面模块 + 一个布局页），用 GitHub Pages 直接托管 ——
Pages 源设为 `main` 分支的仓库根即可，不需要 CI。

```bash
pnpm dev           # http://localhost:8642
```

它同时是 M0 的验收载体：首页和组件页里那些 `<mc-button>` 是**真实渲染**的，
点右上角主题按钮会整页联动 —— 这一条曾经真的坏过（见下面的红线）。

### 首页海报：数据驱动

首页那张马赛克图案（三层、鼠标视差）是**纯数据驱动**的，页面里没有一行「JS 建 DOM」：

- 方块是数据 —— `computeTiles(宽, 高, 入口块)` 是纯函数，吐 `{ key, x, y, opacity, … }`；
- 视图是模板 —— `<o-fill :value="farTiles">` 里那个 `<span>` 就是一块方块，
  位置/大小/透明度走 `:style.*`，色片颜色走 `attr:data-color` 交给 CSS；
- 视差是数据 —— 鼠标每帧只改 `farTransform / midTransform / nearTransform` 三个字段；
- 容器尺寸变化也只是重算数据（`ResizeObserver` → `relayout()`），DOM 由 ofa.js 更新。

> ⚠️ 方块是 HTML 元素而不是 SVG：`<o-fill>` 是自定义元素，**SVG 命名空间里的元素不会被
> `customElements` 升级**，放进 `<svg>` 会让 ofa.js 在模板编译期直接抛错、整页空白
> （见 [P30](./agent/ofa-pitfalls.md)）。

### 入口：`index.html` 只做引入

根目录的 `index.html` 是一个纯入口：head 里引入样式和脚本，body 里只有路由库和应用挂载点：

```html
<l-m src="…/libs/router/dist/router.min.mjs"></l-m>
<o-router>
  <o-app src="./app-config.js"></o-app>
</o-router>
```

**页面上看得见的东西全在 `docs/layout.html`**（顶栏 + 正文带 + 主题按钮）—— 它是
ofa.js「嵌套页面/路由」里的**布局页**，子页面用 `export const parent` 挂上来，
正文经它的 `<slot>` 投影（见下一节）。所以加一个一级入口、挪主题按钮，都不用碰 `index.html`。

### 客户端路由与布局页（ofa.js 嵌套路由）

文档站用 ofa.js 自己的页面组件做的：**`o-router` + `o-app` + `<template page>` 页面模块**，
切页不整页刷新。而**外壳是一个布局页**，不是拼在 HTML 里的：

```
o-app
└─ o-page  docs/layout.html        ← 父页面（布局页）：顶栏 + 正文带 + <slot>
   └─ o-page  docs/pages/guide.html  ← 子页面：正文，被 <slot> 投影进 .doc-main
```

- 子页面只要写 `export const parent = '../layout.html';`（相对**本页面文件**解析）
  就挂上外壳，`packages/<slug>/page.html` 里写 `'../../docs/layout.html'`。
- 布局页在切页时**不重建**，所以顶栏、主题按钮都不闪；顶栏高亮靠它的 `routerChange()`
  钩子 —— 只有它能在子页面切换时被通知到。
- 布局页的顶栏是 `<a olink>`，走 ofa.js 自己的应用内跳转。
  ⚠️ **olink 走 history.pushState，不触发 `hashchange`** —— 所以需要「跟着路由走」的
  脚本（`doc-nav.js` 的高亮、`site.js` 的占位渲染）都要额外听 `router-change`
  事件（o-app 每次导航冒泡它）。

> 注意 `o-app` 必须是 `o-router` 的**直接子节点**：`o-router` 的模板用 `<slot>`，
> 只投影直接子节点（`router.min.mjs` 里的 `::slotted(o-app)`），中间多套一层它就不认了。

判据写在冒烟测试里：在 `window` 上放个标记，连续切 6 个页面后它还在 —— 整页刷新会把它冲掉。
另外还守着三条：入口的响应原文里没有外壳标记、子页面确实嵌在布局页的 `o-page` 里、
每个页面模块都声明了 `parent`（漏一个那一页就掉出外壳）。

### 站点导航：一级菜单在布局页，二级菜单跟着页面走

**一级菜单就是页面本身**，五个平铺在布局页顶栏里，没有「分区」这一层：

```
顶部   Mosaic   首页   快速开始   设计令牌   规范   组件            自动
```

**二级菜单不进外壳**：哪个页面需要左栏，就自己在模板里放 `<doc-nav>`，配一层
`.doc-split` 分成左右两栏。于是

| 页面 | 二级菜单 |
|---|---|
| 首页 / 快速开始 / 设计令牌 / 规范 | 没有 → 单列铺满 |
| 组件总览 + 每个组件文档页 | `<doc-nav data-source="components">` → 总览 + 5 个分组 + 21 个组件 |

好处是外壳不必知道「分区」，也不用替每个页面维护菜单：加一个一级入口 =
`docs/layout.html` 顶栏加一条；加一个页面的二级菜单 = 在那一页里写。

> 组件文档页（`packages/<slug>/page.html`）不在顶栏里单列，它们统一点亮「组件」——
> 布局页的 `syncTopNav()` 先精确匹配五个入口，都不中时按 `packages/<slug>/page.html`
> 这个固定位置兜底。「设计令牌」也在 `packages/` 下，但它有自己的入口、精确匹配先命中。

> `<doc-nav>` 是**站点级自定义元素**（`docs/doc-nav.js`），不是 ofa.js 组件：它要
> 直接 `import` 组件登记表，而 ofa 的页面/组件代码经 eval 执行、相对 import 解析不了。
> 见下方「布局与滚动」。

### 布局与滚动

外壳只有两块，**固定一屏**：上面顶栏，下面正文带。`html` / `body` 吃满视口且
`overflow: hidden`，所以**全局不出滚动条** —— 滚动只发生在内部区域。

样式分两处（这是 shadow DOM 的硬边界，不是选择）：外壳在**布局页的 shadow root** 里，
所以它的规则在 `docs/layout.html` 的 `<style>`；`html` / `body` 和
`o-router → o-app → o-page` 的高度链在文档树里，所以在 `docs/shell.css`。

```
┌─────────────────────────────────────────────────────┐
│ Mosaic   首页  快速开始  设计令牌  规范  组件   自动 │  ← 外壳的「上」
├───────────┬─────────────────────────────────────────┤
│ 二级菜单  │ 正文                                     │  ← 页面自己分栏（可选）
│ 自己滚    │ 自己滚                                   │
└───────────┴─────────────────────────────────────────┘
```

- **上下结构**：顶栏 + 正文带。外壳对每个页面都一样。
- **带二级菜单的页面自己分成「左菜单 + 右正文」**：页面模板里 `.doc-split` 给两栏
  定高，`<doc-nav>` 和右栏各自 `overflow-y: auto`。不带的页面就单列，正文在外壳
  正文带里滚（`.doc-main`）。
- **没有全局滚动条**：换页时复位的是 `.doc-main` 的 `scrollTop`，不是 `window`
  （`window.scrollTo` 在这个外壳里是空操作）。
- **滚轮接力**：两栏各自滚时，指针停在菜单上而菜单吃不下的滚轮会转给右栏 ——
  纯 CSS 做不到（外壳不可滚，链上去是死路），由 `doc-nav.js` 显式转。
- 窄屏（≤ 52rem）左右放不下，退化成「顶栏 → 菜单（封顶 45vh，自己滚）→ 正文」，
  全局依然不滚。

外壳规则分两处：`docs/layout.html` 的 `<style>`（顶栏 + 正文带）和 `docs/shell.css`
（视口 + 高度链）；页面/分栏规则在 `docs/content.css`。冒烟测试里有对应断言守着：
顶栏贴满宽度、外壳里没有侧栏、两栏等高、`body overflow-y: hidden`、
长页面在正文栏内部滚动且滚到底后最后一块内容可见。

> ⚠️ 高度链条上任何一环加了 `overflow: hidden` 都会**静默截断长页面**：
> 裁掉之后滚动溢出不再往上传，正文带的 `scrollHeight` 会永远等于
> `clientHeight`，页面上连滚动条都看不到。ofa.js 的 `o-router` 自带
> `:host { … overflow: hidden }`，所以 `shell.css` 里显式写了
> `o-router { overflow: visible }`（外部文档树的普通声明赢过 `:host`）。
>
> ⚠️ 页面占位的渲染轮询不能以「`.doc-body` 换了」为收工条件：o-app 启动时会先加载
> `app-config.js` 里的首页，再切到 hash 指向的页面 —— 首页挂上那一刻条件就成立，
> 真正那一页的占位（组件卡片、色板）永远没人渲染。判据要落在
> 「有没有哪个 `<o-page src>` 已经是 hash 指向的页面」（嵌套路由下有两个 o-page，
> 见 `site.js` 的 `isRoutedPageMounted`）。

### 文档跟着组件走

**组件在哪，它的文档就在哪** —— 找组件时不用去别处翻：

```
packages/button/
  button.html      组件本体
  page.html        文档页（ofa.js 页面模块，含活的可交互演示）

packages/color/
  tokens.css       令牌
  page.html        令牌文档页
```

> 文件名是 `page.html` 而不是 `index.html`，因为它是 `<template page>` **页面模块**，
> 不是能直接打开的独立网页 —— 路由地址是 `#/packages/button/page.html`。

站点级的东西（首页、快速开始、组件总览、规范索引）放在 `docs/`，
跨所有组件、不属于任何单个 package。

**文档页只写用法**：一页就三块 —— API 表、演示区、注意事项。
「为什么这么分层、底层用了什么机制」这类说明写在组件文件头的注释和 `agent/` 里，
不搬进文档页。

**加一个组件要动四处**：`packages/<name>/` 下的组件本体、文档页、`demos/`（每个演示一个
组件文件）、`test/`（组件自己的断言），再加一条 `docs/components.js` 登记。
页面自带的二级菜单、总览卡片、首页的组件区块都从登记表渲染，不用手工维护。

未实现的组件也会出现在菜单里（空心圆点，`M2`/`M3` 标记），
但**不给死链**，点击直接跳到接口规范 —— 这样菜单同时是一份可见的路线图。

> 冒烟测试里有一条断言专门守这个约定：每个已实现组件的
> `packages/<slug>/page.html` 必须存在、能打开、且引用的站点资产路径没写错；
> 每个 READY 组件在 `packages/<slug>/test/` 下还得有自己的套件。

### 演示区：一个例子一个文件

组件文档页里每个演示都是「活样例 + 一份能点开的代码」，而**例子就是 `demos/` 下的一个
组件文件**：页面写它的标签，`<mc-code src>` 引用同一份文件，抽屉就是作者写的一行
`<mc-collapse>`。

```html
<section class="doc-demo">
  <h3>语义色</h3>
  <demo-button-colors></demo-button-colors>
  <mc-collapse class="doc-demo-code">
    <mc-collapse-item header="查看代码"><mc-code language="html" src="./demos/colors.html"></mc-code></mc-collapse-item>
  </mc-collapse>
  <p class="doc-hint">…</p>
</section>
```

```html
<!-- packages/button/demos/colors.html：例子本体，可单独打开、单独测 -->
<template component>
  <div class="flex flex-wrap items-center gap-3">
    <mc-button color="primary">主要</mc-button>
  </div>
  <script>
    export default async () => ({ tag: 'demo-button-colors' });
  </script>
</template>
```

- **代码面板和活样例引用同一个文件**：改例子就是改代码面板，没有第二处会漂移；
  冒烟测试会拉取那个文件，断言**逐字相同**。
- **例子是组件而不是片段**：里面的 ofa 绑定（`:code="…"`、`on:open="…"`）照常编译。
  ⚠️ ofa.js 不编译运行时注入的 HTML，所以"片段 + 注入"那条路会让绑定静默失效。
- 例子的 DOM 在自己的 shadow root 里，页面级的 `.doc-row` 够不着 —— 例子内部用工具类。
- 抽屉用的是项目自己的折叠面板；相关样式（一条分隔线、muted 标题、`::part`）在
  `content.css` 的 `.doc-demo-code` 里。

## 开发

```bash
pnpm install
pnpm tokens        # 生成令牌并自检对比度（不达标退出 1）
pnpm build         # = tokens && build:css → packages/boot/mosaic.css
pnpm dev           # 起本地服务器（零依赖，强制禁缓存，端口 8642）
pnpm test          # 真浏览器冒烟测试：站点套件 + 所有已实现组件（驱动系统 Chrome，117 项断言）
pnpm test collapse # 只跑某个组件的套件（内环快速反馈）
pnpm test:site     # 只跑跨组件的站点套件
pnpm typecheck     # tsc --noEmit（只检查 uno.config.ts）
pnpm check:drift   # 重新生成后比对 git diff，防止提交的产物与生成器漂移
```

当前实测产物：**34.3 KB raw / 7.1 KB gzip**（其中令牌 12.5 KB raw，370 个工具类）。

运行冒烟测试需要先起服务器（`pnpm dev`）。套件分两处：跨组件的站点不变量在
`tests/site/`，组件自己的断言在 `packages/<slug>/test/`（登记表里 READY 的都该有一个）。
它驱动本机 Chrome 验证 117 项断言，包括「工具类在 shadow root 内生效」
「主题切换能穿过 shadow 边界」这些只有真浏览器能回答的问题。

---

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
