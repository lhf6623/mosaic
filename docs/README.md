# 文档站写法规范（docs/）

文档站是**免构建**的 ofa.js 站点：`index.html` 只做引入，外壳在 `docs/layout.html`，分区布局在
`docs/doc-layout.html`，页面模块自己 `<link>` 一份 `docs/content.css`。这份文件是站点写法的唯一
真相源；组件文档页（`packages/<slug>/page.html`）的骨架与演示区约定在
[`packages/README.md`](../packages/README.md)。

## 一、三层布局：谁写布局

| 层       | 文件                                  | 负责                                                                         |
| -------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| 站点外壳 | `docs/layout.html` + `docs/shell.css` | 顶栏、一屏高滚动模型（`.doc-main` 是唯一滚动容器）、窄屏菜单浮层             |
| 分区布局 | `docs/doc-layout.html`                | 三栏（左菜单 / 正文 / 右目录）、左右栏 `position: fixed`、中栏留位与两条断点 |
| 页面     | `docs/pages/*.html`                   | 只写正文内容                                                                 |

- 页面里**不写** `position: fixed`、侧栏宽度与 `@media` 断点 —— 那是布局页的事。
- `docs/pages/` 下只有首页挂 `layout.html`（单栏），其余站点页都挂 `doc-layout.html`（三栏）。
- 页面清单与分组**不在本文档里抄第二份** —— 唯一来源是 `docs/site-map.js`。
- 换页的加载条是 `mc-loading-bar`，接线在 `app-config.js`：ofa 每次导航开始都会调 `loading`
  （olink 的 pushState 导航**不发 hashchange**，接在别处会漏掉它），结束信号是 `router-change`；
  慢过一小会儿才露（阈值就在 `app-config.js` 里），快导航不闪。

## 二、样式归属：一句话一条规则

| 样式                 | 住哪                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| 只被一个页面用       | 那个页面的 `<style>`（例：首页的 `.hero` / `.hero-band`）                   |
| 被两个及以上页面共用 | `docs/content.css`                                                          |
| 站点组件内部结构     | 组件自己的 `<style>`（shadow root），对外只暴露 CSS 变量与 `::part()`       |
| 组件宿主的定位与尺寸 | 它所在的布局页（例：`doc-nav` / `doc-toc` 的定位在 `docs/doc-layout.html`） |

- 加规则前先问一句：**是不是只有一个页面在用？** 是就写回那个页面。
- `docs/content.css` 是给「站点页 + 组件文档页」共用的正文样式准备的；`.doc-demo` /
  `.doc-demo-code` 只服务组件文档页，等组件页改版时随演示组件一起迁走。

## 三、行内样式：只有三类例外

1. **运行期才算得出的值**：色板每个色块的
   `background-color` —— 值来自 JS，类名表达不了。
2. **首帧兜底 UI**：`app-config.js` 的 `loading` / `fail` —— 它们落在 `o-app` 的 shadow root，
   而且发生在样式表就位之前，只能内联（见文件里的注释）。
3. **演示里正在展示的宿主覆盖**（`style="--mc-*"`）：那本身就是被演示的 API，属组件页范围。

其余静态样式一律写 class 或 `<style>`。

## 四、单一来源

| 事实                    | 唯一来源                                              |
| ----------------------- | ----------------------------------------------------- |
| hash 地址（含部署前缀） | `docs/routes.js` 的 `hashOf()` / `route()`            |
| 导航树、顶栏入口、分区  | `docs/site-map.js`                                    |
| 原始色阶色值            | 运行时读 `packages/color/tokens.css`（`doc-palette`） |
| 组件参考表              | 各单元的 `api.md`（`doc-spec` 渲染，页面不手抄）      |

## 五、站点组件

| 标签          | 文件                           | 干什么                                               |
| ------------- | ------------------------------ | ---------------------------------------------------- |
| `doc-nav`     | `docs/components/nav.html`     | 左栏 / 窄屏浮层菜单                                  |
| `doc-toc`     | `docs/components/toc.html`     | 右栏本页目录（扫页面 shadow 里的 `h2` / `h3`）       |
| `doc-spec`    | `docs/components/spec.html`    | 渲染 `api.md` 的参考区（进 light DOM，目录才收得到） |
| `doc-palette` | `docs/components/palette.html` | 「色彩」页的原始色阶色板                             |

- 站点组件一律 `<template component>` + 显式 `tag: 'doc-*'`；宿主定位住在布局页，内部样式住在
  组件自己的 `<style>`。
- 站点级组件在 `docs/layout.html` 注册一次；只被一页用的由那一页自己 `<l-m>` 引入
  （现在没有这样的站点组件 —— 首页的零件带是页面自己的标记，不是组件）。

## 六、文件一览

```text
index.html              站点入口：只做引入（外壳在 docs/layout.html）
app-config.js           o-app 配置：首页、导航加载条、加载 / 失败兜底
docs/
  README.md             本文件
  layout.html           站点外壳（顶栏 + 正文带）
  doc-layout.html       分区布局（三栏）
  shell.css             文档级样式：视口契约 + 高度链
  content.css           站点页 / 组件文档页共用的正文样式
  theme-boot.js         首帧主题（head 里的同步脚本）
  adopt-styles.js       样式注入补丁（把工具类与令牌 adopt 进 shadow root）
  routes.js             hash 地址 ↔ 仓库相对路径
  site-map.js           导航数据（顶栏 / 左栏 / 状态）
  state/route.js        路由状态 store（唯一挂监听的地方）
  components/           站点组件（见上一节）
  pages/                站点页（清单与分组见 site-map.js）
  snippets/             可复制的片段（quick-start.html 等）
  lib/                  站点内部工具（md-spec 渲染器）
```

## 七、最少代码：抽组件的阈值

- 同一段标记、样式或脚本重复 **≥3 次**才抽组件或模块；不足 3 次不抽 —— 注册、`tag`、生命周期
  都是成本。
- 抽出来的组件必须自带样式（shadow root）与清理（`detached()` 里摘监听）。
- **注释从简**：只在非显然的地方写一句「为什么」，其余不写；站点约定只认这份文件。

## 八、键盘基线

只保证**键盘可达**：不做读屏支持（没有 `role` / `aria-*` / 文字替代），
**组件层口径见 [`packages/README.md`](../packages/README.md) §1.8**，页面层只补：

- 视图（页面）切换后焦点归位到主标题或主内容。
- 每页只有一个 `<h1>`；`h2` 分节、`h3` 是节内子项 —— 右栏目录直接扫它们，层级别乱。
- 「当前项 / 选中 / 禁用」等状态一律用 `data-*`（如 `data-current`），不写 `aria-*`。

验证：拔掉鼠标，只用 Tab 走一遍「顶栏入口 → 左栏菜单 → 主题下拉 → 窄屏浮层 → 正文」。
对比度不在本条线里 —— 令牌层由 `pnpm tokens` 的 WCAG 自检守住。

## 九、构建与令牌红线（原站内「规范」页搬来）

- **组件只消费语义令牌，不碰原始色阶** —— 原始色阶不随主题切换，直接用它必然在某个主题下读不清。
- **组件里禁止 `dark:` 变体** —— 它只会跟随系统偏好，跟不了页面上的主题切换；暗色差异一律在令牌上换值。
- **样式注入靠层序压住** —— `adoptedStyleSheets` 的优先级高于组件自身的 `<style>`，所以
  `packages/boot/mosaic.css` 顶部先钉死 `@layer` 层序，工具类才不会反过来盖住组件样式。
- **构建缺输入必须大声失败** —— 拼少一份输入会产出「没有令牌的坏 CSS」、退出码却还是 0；
  `tools/build-css.mjs` 因此先查输入存在、装配后再验图标齐全。
