# 文档站外壳：布局、顶栏与滚动

文档站（`index.html` + `docs/`）的外壳怎么搭：它锁一屏、顶栏固定、左右两栏浮动，
正文带 `.doc-main` 是页面上**唯一**的滚动容器。页面骨架与演示区规范见
[`doc-pages.md`](./doc-pages.md)。

> **读这份的场合**：改外壳、顶栏、主题切换、两栏定位、滚动接力。

---

## 一、外壳布局与滚动：一屏外壳 + 固定顶栏 + 两侧浮动栏

外壳是一个 **ofa.js 布局页**（`docs/layout.html`，「嵌套页面/路由」里的父页面），
里面就一个 `.doc-shell`（`height: 100vh` 的纵向 flex）装着顶栏与正文带：
顶栏 `flex: none`，正文带 `flex: 1 + min-height: 0 + overflow-y: auto` ——
**高度只在这一层声明**，不用从 `body` 一层层传下来；正文带的滚动条因此从顶栏下面开始，
不会像窗口滚动条那样伸进头部。

左右两栏是 `position: fixed`、**不在文档流里**（高度 100%），所以不管内容多高多矮、
切到哪一页，它们都一动不动 —— 页面高度变化也带不走它们。

```
body               height: 100% + overflow: hidden（把一屏兜住，window 永不滚）
└─ o-router        普通块（⚠️ 必须 overflow: visible，见下）
   └─ o-app/o-page  普通块，高度按内容走
      └─ o-page    **外壳** docs/layout.html
         ├─ shadow  div.doc-shell（height: 100vh，flex 纵向）
         │          ├─ .doc-top   顶栏（flex: none）+ 一级入口（来自 docs/site-map.js 的 TOPBAR）
         │          └─ .doc-main  正文带（flex: 1 + min-height: 0）= **唯一的滚动容器**
         └─ o-page  **分区布局页** docs/doc-layout.html（组件文档页都挂在它下面）
            └─ shadow  .doc-split（普通块，只当包裹）
                       ├─ <doc-nav>     左栏：fixed; left:0; top:0; height:100%; 自己滚
                       ├─ .doc-content  中栏：宽度不设上限，左右 padding 给两栏留位（下限 20rem）
                       └─ <doc-toc>     右栏：fixed; right:0; top:0; height:100%; 自己滚
               └─ o-page  **页面** packages/<slug>/page.html（被 slot 投影进中栏）
                  └─ shadow  .doc-body  正文：铺满中栏 + 内边距 / 排版（不设宽度上限）
                             <doc-crumb> 面包屑 / <doc-pager> 翻页
```

> ⚠️ **`o-router` / `o-app` / `o-page` 不能当滚动容器**。`o-router` 自带
> `:host { overflow: hidden }`：它会让「最近的滚动祖先」变成它自己，于是正文带滚不动、
> 长页面还会被静默截断。`docs/shell.css` 里显式退回 `overflow: visible`。

> ⚠️ **浮动两栏的前提是祖先链上没有 `transform` / `filter` / `perspective` /
> `contain: paint` / `will-change`** —— 有的话 fixed 的包含块就变成那个祖先，两栏会跟着内容滚
> （`docs/doc-layout.html` 的 `<style>` 里记了这条）。

> ⚠️ **两栏位置是正文的 padding**：`.doc-content` 用 `padding-inline: 15rem 15rem` 留位，
> 宽度**不设上限**（视口多宽正文就多宽），只有一条 `min-width` 兜底；
> 右栏在 `≤78rem` 收掉时，`padding-right` 也要跟着归零。
> 两栏是 fixed、不占宽度，所以「正文多宽」与「两栏多宽」互不牵连。
> 右侧那份 15rem 是**算出来的**（要放得下最长的那条目录项，见下面「右栏目录」那条）。

> ⚠️ **跨 shadow 树找滚动祖先要走扁平树**（先看 `assignedSlot`）。
> 子页面是被外壳的 `<slot>` 投影进去的，顺 `parentNode` 爬会从文档树绕过去。
> （`docs/components/toc.html` 的 `scroller()`、`packages/code/code.html` 的 `scrollableAncestor()` 都按这条写；
> 现在通常能找到外壳的 `.doc-main`；找不到才退回 `window` / `document.scrollingElement`。）
>
> 样式分两处是 shadow DOM 的硬边界，不是选择：外壳在布局页的 shadow root 里，
> 所以它的规则写在 `docs/layout.html` 的 `<style>`；`html`/`body` 与 `o-router → o-app → o-page`
> 在文档树里，所以写在 `docs/shell.css`。
>
> 页面靠 `export const parent` 挂到上一层（相对**本页面文件**解析）：
> 组件文档页写 `'../../docs/doc-layout.html'`（挂分区布局页），
> 单列页面（首页/快速开始/规范/设计令牌）写 `'../layout.html'` 或 `'../../docs/layout.html'`（直接挂外壳）。
> **两层布局页切页时都不重建**：顶栏高亮订阅 `docs/state/route.js`（唯一挂 `hashchange` + `router-change` 的地方），
> 左栏菜单与右栏目录则跨页存活
> （菜单滚动位置不再被切页清掉；实测切页后导航与目录是同一个元素）。
> 忘了写 `parent`，那一页就掉出外壳（没顶栏、没正文带）；`tests/site/10-nav-data.mjs` 会抓到。

### 顶栏与主题（都在布局页里）

- 一级入口来自 `docs/site-map.js` 的 `TOPBAR`（**加一个入口 = 树里加一行**），由布局页渲染；
  链接用 `hashOf()` 生成 —— `olink` 是编译期指令，运行时造的 `<a olink>` 不会被处理。
- 高亮只切 `aria-current`，**绝不重建 DOM**：重建会让真人点击的 mousedown / click
  落在两个不同节点上，表现为「菜单要点好几次才跳转」（实测第 1 轮点了 6 次）。
- 高亮 = 当前路由在 `NAV` 里命中哪一支（`locate(route())`）：
  组件文档页靠「是「组件」的孩子」天然归属，不需要那条 `packages/<slug>/page.html` 的正则兜底。
- ⚠️ **站内链接必须带部署前缀，两边比较前必须先归一化。**
  ofa 把 hash 当**相对域名根**的地址解析：线上（GitHub Pages 项目页在 `/<repo>/` 下）
  正确的形式是 `#/mosaic/packages/…`，手写 `#/packages/…` 会去取 `/packages/…` → 404；
  菜单高亮若两边不在同一坐标系，还会出现「打开首页空高亮、设计令牌页亮成『组件』」
  （线上实测过）。规则：
  · JS 里拼链接走 `docs/routes.js` 的 `hashOf()`；
  · 页面标记里写 `<a olink href="相对本文件的路径">`，让 ofa 自己带前缀；
  · 比较前统一用 `toRepoPath()` / `repoPathOf()`（`docs/routes.js`，页面模块也能静态 import）。
  本地复现线上：`node tools/serve.mjs --prefix /mosaic`；冒烟测试里有一条专门的子路径套件。
- 组件文档页（`packages/<slug>/page.html`）不在顶栏单列，统一点亮「组件」；
  「设计令牌」自己有入口，精确匹配先命中，所以不会被那条兜底规则误伤。
- 路由状态由 `docs/state/route.js` 直接读 `location.hash` 算出，高亮不依赖子页面何时挂载。
- 主题三态（自动 / 亮 / 暗）也在布局页；首帧由 `docs/theme-boot.js` 应用，防闪色。

**三栏由分区布局页 `docs/doc-layout.html` 提供**（它拥有 `.doc-split` / `<doc-nav>` / `<doc-toc>`）。
页面只写正文，并声明挂到它下面：

```html
<template page>
  <link rel="stylesheet" href="../../docs/content.css" />
  <div class="doc-body">… 正文 …</div>
  <script>
    // 相对**本页面文件**解析
    export const parent = '../../docs/doc-layout.html';
  </script>
</template>
```

`docs/pages/` 下的页面写 `'../doc-layout.html'`；单列页面（首页 / 快速开始 / 规范索引、
`packages/color/page.html`）直接挂外壳 `docs/layout.html`，正文同样只写 `.doc-body`。

- **样式的归属**：只有一个使用者的样式写进**那个**页面 / 组件的 `<style>` ——
  首页海报在 `docs/pages/home.html`、两栏与中栏留位在 `docs/doc-layout.html`、
  组件内部在各自组件里；`content.css` 只留**多个页面共用**的正文块（标题 / 段落 / 提示条 /
  演示区 / 卡片 / 表格 / 徽标 / `<l-m>` 占位）。页面模块的 `<style>` 与它的 `<link>`
  同处一个 shadow root，作用域一样，搬过去不损失什么，但改一处只需看一个文件。
- **滚动只有 `.doc-main` 一条**（顶栏下面那一带）：`.doc-split`、`.doc-content` 都不滚，
  左右两栏是 `position: fixed; height: 100%`，内容超一屏时各自内部滚。
- 页面**不想要**侧栏就挂外壳 `docs/layout.html`（不挂分区布局页），正文直接在外壳正文带里滚（`.doc-main`）。
- 左栏菜单（`docs/components/nav.html`）是**站点级 ofa 组件模板**：结构 = `docs/site-map.js` 的树，
  由 `o-fill` 逐条铺出来，自己只管「渲染哪一支 + 谁是当前页」。条目样式写在它自己的
  `<style>` 里（组件自带 shadow root，`content.css` 够不到内部节点）。
- 右栏目录（`docs/components/toc.html`）扫页面自己的 `h2/h3` 生成，用 `mc-menu` 渲染。
  **大纲两条规则**：① 一条不漏 —— 目录是正文大纲的镜像，「例子」也是页面上真实的一节，
  滤掉它只会把它的子项（每个演示）顶到与小节平级；② 两级 —— h2 = 节（不缩进、正常前景色），
  h3 = 子项（缩进一档、颜色弱一档），节与节之间留一道空。
  ⚠️ 目录条目是**单行 + `overflow: hidden`**（`mc-menu-item` 的固有行为，右栏够不着它的 shadow），
  所以缩进会实打实吃掉可点宽度：`doc-layout.html` 的 15rem 与 space-4 内边距是按「最长那条
  （menu 页的「卡片外观（variant="surface"）」）也放得下」反算的；09 号套件有一条
  「任何一项都不被省略号截断」的断言 —— 改宽度、改缩进、给演示起更长的名字都会顶到它。
  **点击是程序化滚动，不是 `#id` 锚点** —— 地址栏 hash 归 ofa 路由器所有，
  页面正文又在 shadow root 里、URL fragment 也进不去。
- 窄屏：≤ 78rem 收起右栏（退回两栏）；≤ 52rem 退化成「菜单在上（封顶 45vh）、正文在下」。

因此换页复位与滚轮接力都写在外壳 `docs/layout.html` 里（正文带是它自己 shadow root 里的元素，不用穿透查）。

> ⚠️ 顶栏的 `<a olink>` 走 `history.pushState`，**不触发 `hashchange`**。
> 凡是要「跟着路由走」的脚本都得同时听 o-app 冒泡的 `router-change` 事件
> （`docs/layout.html` 的顶栏高亮 + 换页复位、`docs/components/nav.html` 的左栏高亮都是这么接的）。

> 页面里的占位现在是**组件**（`<doc-cards>` / `<doc-palette>`，见 `docs/components/cards.html`、
> `docs/components/palette.html`）：挂载即渲染，不再需要轮询等页面到齐。
> **留下的历史教训**（将来再引入「运行时按需渲染页面内容」时会再踩）：
> 收工条件必须是「**某个** `<o-page src>` 已经是 hash 指向的页面」（嵌套路由下有两个 o-page），
> 不能是「`.doc-body` 换了」—— o-app 启动会先加载首页再切到 hash 页，后者会在首页挂上那一刻
> 就成立，真正那一页的占位永远没人渲染（冷启动时卡片区空白）。右栏目录也吃这条：
> 标题晚到就靠 `MutationObserver` 重扫（`docs/components/toc.html`）。

---

## 二、想让页面内容撑满可视区

**不要在自己的页面里算 `100vh - 顶栏 - 内边距`。** 外壳不再提供「一屏高」的高度链条
（外壳锁一屏、正文带在它里面滚），所以想撑满的页面**自己声明一屏**，一处定义：

```css
/* docs/pages/home.html 里首页海报的做法 */
.doc-poster {
  min-height: calc(100vh - var(--doc-topbar, 3.5rem));
}
```

`--doc-topbar` 定义在外壳的 `:host` 上，会顺着 shadow 树继承下来（页面里也能用）。
页面**不需要**再减自己的内边距 —— 用 `min-height` 而不是固定 `height`，内容多一点也只是页面长高，
不会冒出那条「多算 32px」的滚动条。

```css
/* 想分左右两栏的页面（docs/doc-layout.html）：两栏是 fixed，正文用 padding 留位；宽度不设上限。
   右侧 15rem 与左栏对称，但来由不同 —— 它要放得下最长的目录项（见「右栏目录」那条） */
.doc-split > .doc-content {
  min-width: 20rem;
  padding-inline: 15rem 15rem;
}
```

> ⚠️ 链条上任何一环加了 `overflow: hidden` 都会**静默截断长页面**：它会成为「最近的滚动祖先」，
> 正文带滚不动、长页面被切掉且看不到滚动条。ofa.js 的 `o-router` 自带
> `:host { overflow: hidden }`，所以 `shell.css` 里显式写了 `o-router, o-app, o-page { overflow: visible }`
> （外部文档树的普通声明赢过 `:host`）。冒烟测试里「滚到底后最后一块内容可见」守这条。

---

## 三、页面模块的两条硬约束

文档页是 ofa.js 页面模块，它的 `<script>` 会被 ofa.js **抽出来当模块代码执行**
（`drawUrl` 里取模板内第一个 `script`）。两条约束由此而来，违反的后果是**页面直接空白**：

| 约束                                                | 原因                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`<script>` 必须放在 `<template page>` 的最前面**  | ofa.js 取的是**第一个** `<script>`。任何排在它前面的脚本都会被当成页面代码                                                                                                                                                                |
| **注释里不要出现 body / svg / head 结束标签的原文** | 静态服务器（VS Code Live Server 就是）会按「第一个 body→svg→head 结束标签」往 HTML 里注入自己的脚本。注释里出现这些字符串会把注入点引到文件顶部，而注入内容自带 HTML 注释、会**把我们的注释提前闭合**，那段脚本于是变成真实元素并排到前面 |

这两条合起来的效果：无论服务器往哪注入，都抢不走第一个 `<script>` 的位置。
冒烟测试里有一条 `--inject` 服务器专门跑这条路径（照抄 live-server 的注入规则），
改模板结构或注释时如果破坏了它，测试会直接变红。

> ⚠️ **还有一条关于「挂到布局页」的**：页面模块必须在脚本里声明父页面
> （`export const parent = …`，相对**本页面文件**解析）—— 组件文档页写
> `'../../docs/doc-layout.html'`（挂分区布局页），单列页面写 `'../../docs/layout.html'`（直接挂外壳）。
> 漏了它，那一页就掉出布局页：顶栏、正文带、主题按钮全没有，看起来像"样式丢了"。
> 冒烟测试里有一条断言逐个页面模块检查这条声明。

> ⚠️ `uno.config.ts` 扫描工具类时**排除 `packages/*/page.html`** ——
> 那是文档页不是组件模板。不排除的话，文档排版用到的工具类会混进框架产物，
> 让「精选子集」的体积跟着文档写作风格浮动。实测验证过这条排除生效。

---
