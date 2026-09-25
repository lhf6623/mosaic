# Mosaic 组件编写规范

> **本文讲「怎么造组件」。** 有哪些组件、各自 API 是什么，见 [`component-spec.md`](./component-spec.md)。
> 设计规则见 [`design-spec.md`](./design-spec.md)，令牌值见 [`design-tokens.md`](./design-tokens.md)。
>
> 参考实现见 [`packages/button/button.html`](../packages/button/button.html)；
> 带**可选异步依赖 + 降级路径**的例子见 [`packages/code/code.html`](../packages/code/code.html)。
> **动手前先读 [`ofa-pitfalls.md`](./ofa-pitfalls.md)** —— 那里的坑全是静默失效，
> 表象是「绑定不生效 / 点了没反应」，反查成本极高。
> 写完对照本文末尾的[交付检查清单](#九写新组件的交付检查清单)逐条过。

---

## 〇、目录与命名约定

```
packages/{name}/
  {name}.html      组件本体 —— 源 = 产物，构建不碰它
  page.html        文档页 —— ofa.js 页面模块（<template page>）
  demos/*.html     每个演示一个 ofa 组件文件：文档页里的活样例，代码面板引用同一份
  test/*.test.mjs  组件自己的断言（`node tests/smoke.mjs <name>` 单飞）

docs/site-map.js
                 站点唯一数据源（**结构即菜单**）—— 有哪些页面 / 组件、它们的层级与顺序；
                 加组件 / 加页面都在这里加一个节点
tests/
  smoke.mjs       冒烟测试入口：站点套件 + 数据里每个 READY 组件的套件（一个套件一页，默认并行 4）
  lib/harness.mjs 公共基座：浏览器 / 断言 / 穿透查询注入 / 导航工具 / 「碰过哪些文件」采集
  lib/suites.mjs  套件清单的唯一真相源（站点套件定序 + READY 组件套件）
  select.mjs      选测中间层：改动 → 该跑哪些套件（依赖地图 + 兜底策略，`pnpm test:changed`）
  suite-map.json  生成并提交：每个套件碰过的仓库文件，`pnpm test:record` 重录
  site/*.mjs      跨组件的站点不变量（外壳、路由、D3、色板、注入免疫、选测中间层……）
```

**改完只跑命中的范围**：`pnpm test:changed`（= `node tests/smoke.mjs --changed [ref]`；想看判定过程用
`node tests/select.mjs <文件…>`）。它拿 git 改动查 `tests/suite-map.json` —— 那是录制下来的
「每个套件实际请求过哪些仓库文件」，所以「改 `docs/layout.html` 会影响谁」由数据回答，
不需要谁手工维护一张 glob 表。地图管不到的部分走兜底策略：测试基座 / 构建配置 / 文档站外壳 → 全部，
`packages/<slug>/` 下的新文件 → 该组件的套件 + 地图里碰过这个目录的套件，纯文档 → 不跑，
**未知路径 → 保守全量**；地图缺失、套件不在图里也一律跑（**宁可多跑，不可漏跑**）。
加了 / 删了 / 挪了套件、或套件开始加载新文件时，`pnpm test:record` 重录一次地图
（`tests/site/12-affected.mjs` 会盯着「地图有没有漏掉某个套件」）。全量 `pnpm test` 留到收尾验收跑一次。

> 文档页是 **ofa.js 页面模块**，不是独立网页：它由 `o-router` 按 hash 路由加载，
> 地址形如 `#/packages/button/page.html`。直接双击打开只会看到空白
> —— 因为它没有 `<html>`/`<body>`，只有一个 `<template page>`。
> 冒烟测试里那条「文档跟着组件走」就是经由路由打开它来验证的。

**文档跟着组件走**：组件在 `packages/{name}/`，它的文档页就是同目录下的 `page.html`。
找组件时不用去别处翻文档。

**加一个组件要动四处**：`packages/{name}/` 下的组件本体、文档页、`demos/`、`test/`，
再在 `docs/site-map.js` 那棵树里加一个节点：先找到它所属的分组（`基础` / `表单`…），
在 `children` 里按 `order` 的位置插一条 —— `label` 显示名、`path` 文档页路由、
`tagName` 元素标签、`stage` 里程碑、`summary` 一句话说明。左栏菜单、组件总览、首页卡片、
面包屑与翻页都从这棵树派生，不用手工维护 —— 显示顺序靠 `order`，不靠数组位置
（数组也按 `order` 写，测试会对账）。还没建页的组件**不写 `path`**：左栏指向规范文档、
卡片显示 `stage` 徽标，不会被当成死链。

站点级页面（首页 / 快速开始 / 组件总览 / 规范索引）放在 `docs/` ——
它们跨所有组件、不属于任何单个 package。

**目录名 / 文件名用语义名（`button`），标签名 = `mc-` + 语义名（`mc-button`）。**
一条规则，避免出现「目录叫 A、文件叫 B、标签叫 C」的三方不一致。

一个目录可以放多个同族组件（主标签去掉 `mc-` 前缀就是目录名，同族的其余标签也放这里）。

### 外壳布局与滚动：一屏外壳 + 固定顶栏 + 两侧浮动栏

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

> ⚠️ **两栏位置是正文的 padding**：`.doc-content` 用 `padding-inline: 15rem 14rem` 留位，
> 宽度**不设上限**（视口多宽正文就多宽），只有一条 `min-width` 兜底；
> 右栏在 `≤78rem` 收掉时，`padding-right` 也要跟着归零。
> 两栏是 fixed、不占宽度，所以「正文多宽」与「两栏多宽」互不牵连。

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

#### 顶栏与主题（都在布局页里）

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
- 右栏目录（`docs/components/toc.html`）扫页面自己的 `h2/h3` 生成，用 `mc-menu` 渲染；
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

#### 页面骨架：例子 → API → 插槽 → 定制 → 注意事项

**文档页只写用法。** 每一页都按这个顺序、用这几个固定标题，读的人不用在几种排法之间找：

| 顺序 | `<h2>`                     | 放什么                                                                                   |
| ---- | -------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | `例子`                     | 全部 `<section class="doc-demo">`（每个演示一个 `<h3>` + 例子 + 抽屉 + hint）            |
| 2    | `API`                      | 属性表（含状态、事件）；一个组件多个标签时用 `<h3>mc-xxx</h3>` 分节                      |
| 3    | `插槽 / part`              | 插槽表 + `part` 表（一个组件多个标签时同样按标签分节；只暴露 part 的组件就只放 part 表） |
| 4    | `定制：L3 令牌 + ::part()` | 令牌表（没有 L3 令牌的组件不要这一节）                                                   |
| 5    | `注意事项`                 | 使用者会踩的坑（相对路径怎么算、哪些属性有副作用、降级行为）                             |

- 标题后面的 `<doc-crumb>` / 正文最前面的 `<doc-pager>` 不变；`<l-m>` 注册照旧写在正文最前。
- 页首只留 `<h1>` + 一句 `doc-lead` + `doc-badges`，**不要把 API 表写在例子前面**：
  先看能做什么（例子），再查怎么配（API / 插槽）。
- 实现说明（为什么这么分层、底层用了什么机制）不进文档页 —— 留在组件文件头与 `agent/`。
- 每个演示的标题与 `.doc-hint` 留在 `<section>` 里；演示之间不插 API 表。
- 页面里**内联的 `<mc-code>` 文本是逐字展示的**，前面必须加 `<!-- prettier-ignore -->`
  （否则 `pnpm format` 会把它的换行重排掉）；长片段改用 `src="…"` 就没这个问题。

组件文档页里的每个演示都是 `<section class="doc-demo">`：
**例子是一个独立的 ofa 组件文件**（`demos/*.html`），`<mc-code src>` 引用同一份文件，
抽屉用作者写的一行 `<mc-collapse>`。标题与 `.doc-hint` 留在外面：

```html
<section class="doc-demo">
  <h3>语义色</h3>
  <demo-button-colors></demo-button-colors>
  <mc-collapse class="doc-demo-code">
    <mc-collapse-item header="查看代码"
      ><mc-code language="html" src="./demos/colors.html"></mc-code
    ></mc-collapse-item>
  </mc-collapse>
  <p class="doc-hint">…</p>
</section>
```

**例子住在 `packages/{name}/demos/*.html`，一个演示一个文件**，文件本身就是
ofa.js 组件（`<template component>` + 一行 `tag`），页面用 `<l-m>` 引进来再写标签：

```html
<!-- demos/colors.html -->
<template component>
  <div class="flex flex-wrap items-center gap-3">
    <mc-button color="primary">主要</mc-button>
  </div>
  <script>
    export default async () => ({ tag: 'demo-button-colors' });
  </script>
</template>
```

- **演示文件不参与 `pnpm format`**（在 `.prettierignore` 里）：里面的 `mc-code`
  文本是逐字展示的样例代码，prettier 会把它的换行压掉（实测 JSON 被压成两行、
  bash 丢了所有换行）。它本身就是要展示的内容，照旧手写。
- **一个演示文件只讲一件事。** 同一件事的多个变体可以放一起（六种颜色、三档尺寸），
  但**两个不同的 API / 特性要拆成两个文件、两节**（`max-height` 与 `soft-wrap`、
  `code` 属性与 `:code` 绑定）—— 一个文件里塞两件事，"查看代码"给出的就不是一个
  能直接抄的例子了。
- **代码面板与活样例引用同一个文件**：`<mc-code src="./demos/colors.html">` 读的就是
  上面那份文件（`mc-code` 的 `src` 早就有这能力）。所以"演示的代码"只有一份，
  改例子 = 改代码面板，**没有第二处会漂移**。
- **例子是组件，不是片段**，所以它里面的 ofa 绑定照常编译（`:code="boundSnippet"`、
  `on:open="…"`），而且**可以单独打开、单独测**。
  ⚠️ 反过来不成立：ofa.js **不编译运行时注入的 HTML**（`innerHTML` 塞进去的
  `{{ }}` / `:prop` 全是死的），所以"纯片段 + 注入"那条路会让演示里的绑定静默失效。
- 例子的 DOM 在自己的 shadow root 里，**页面级的 `.doc-row` 这类样式够不着** ——
  例子内部一律用工具类（`flex flex-wrap items-center gap-3`，精选子集里有）。
- 抽屉就是**项目自己的折叠面板**，作者直接写在页面里（`content.css` 里那几条把容器
  的卡片外观压成一条分隔线，头部/内容区走 `::part()`）。它是站点级依赖，
  和 `mc-code` / `mc-collapse` 一起在 `docs/layout.html` 注册一次。
- **代码的路径按写它的那个文件解析**（和 `<link href>` 一样），所以例子里的相对
  `src` 要从 `demos/` 往上数；`<mc-code src="./demos/x.html">` 则相对文档页。
- 冒烟测试逐页守这条约定：每个 `.doc-demo` 都有一个 `demo-*` 例子组件 + 一个抽屉、
  代码面板里的文本**逐字等于**它 `src` 指向的文件、每块代码都提到它在演示的标签
  （Button 页全是 `<mc-button>`、Code 页全是 `<mc-code>`、Collapse 页全是 `<mc-collapse>`），
  且文件里是作者写的原样标记（没有 ofa 反射出来的默认属性）。

### 首页海报：数据驱动 + 响应式（`docs/pages/home.html`）

- 页面里**没有一行 JS 建 DOM**：`computeTiles(宽, 高, 入口块)` 是纯函数，吐
  `{ key, x, y, opacity, … }`；视图由 `<o-fill>` 加 `:style.*` / `attr:data-color` 渲染；
  鼠标视差只改 `farTransform / midTransform / nearTransform` 三个字段。
  容器尺寸变化也只是 `ResizeObserver → relayout()` 重算数据。
- 方块是 **HTML 元素、不是 SVG**：`<o-fill>` 是自定义元素，SVG 命名空间里的元素不会被
  `customElements` 升级，放进 `<svg>` 会让 ofa.js 在模板编译期直接抛错（[P30](./ofa-pitfalls.md)）。
- **边长是响应式的**（容器宽度 / 16，夹在 `TILE_MIN`…`TILE_BASE`），其余参数全写成比例
  （间距 / 抖动 / 颗粒 / 色片都按边长推）—— 只有一个数会动，比例关系不会散。
- 尺寸经 `--art-*` 变量从 JS **广播给 CSS**：两边用同一个数，避免
  「CSS 里写死 22.3px、边长改了它不跟」那种静默走形。
- 色片排除区要算三样：入口块的**实际中心**（它不在容器正中）、色片自身半宽、
  近景层的**视差位移上限**。少算一个，窄屏 + 鼠标推到极值时色片就会滑到按钮底下。
- 格子 seed 用固定 stride（而不是 `cols`），否则窗口宽度每跨一格，整幅图案会重掷一副。
- 两个入口直接用项目自己的 `<mc-button>`（用 `<l-m>` 在本页引入），点击走 `openPage()`
  改 hash 导航 —— 文档站首页自己就是组件的活样例。

### 想让页面内容撑满可视区

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
/* 想分左右两栏的页面（docs/doc-layout.html）：两栏是 fixed，正文用 padding 留位；宽度不设上限 */
.doc-split > .doc-content {
  min-width: 20rem;
  padding-inline: 15rem 14rem;
}
```

> ⚠️ 链条上任何一环加了 `overflow: hidden` 都会**静默截断长页面**：它会成为「最近的滚动祖先」，
> 正文带滚不动、长页面被切掉且看不到滚动条。ofa.js 的 `o-router` 自带
> `:host { overflow: hidden }`，所以 `shell.css` 里显式写了 `o-router, o-app, o-page { overflow: visible }`
> （外部文档树的普通声明赢过 `:host`）。冒烟测试里「滚到底后最后一块内容可见」守这条。

### 页面模块的两条硬约束

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

## 一、组件的单一职责：只负责"布局与结构"，不负责"颜色"

这是整套规范里最重要的一条分工：

| 层                 | 负责                                                             | 写在哪                                       |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------------- |
| **令牌**           | 颜色、圆角、尺寸、动效                                           | `:host` / `:host([attr])` 里的 `--mc-*` 变量 |
| **工具类**         | `display` / `flex` / `gap` / 对齐 / 定位                         | 模板的 `class="..."`                         |
| **组件 `<style>`** | 工具类表达不了的（`height: var(--mc-control-h-md)`、过渡、伪类） | `.mc-*` 类                                   |

**颜色永远不出现在工具类里。** 一个组件模板里不应该出现 `bg-primary`、`text-muted`。
颜色一律通过令牌间接表达 —— 这样才可能做到"改 3 个变量换掉整个主题"，
也才能让使用者按实例覆盖。

```html
<!-- ✅ 正确：颜色走令牌 -->
<style>
  :host {
    --mc-button-fill: var(--mc-color-primary);
  } /* 存：裸三元组 */
  .mc-btn {
    background-color: rgb(var(--mc-button-fill));
  } /* 用：包 rgb() */
</style>
<button class="mc-btn inline-flex items-center gap-2">
  <!-- ❌ 错误：颜色写死在工具类里，使用者只能靠 !important 覆盖 -->
  <button class="mc-btn inline-flex items-center gap-2 bg-primary text-primary-fg"></button>
</button>
```

---

## 二、变体一律属性驱动，且四个维度必须正交

```html
<mc-button color="danger" variant="outline" size="sm" block>删除</mc-button>
```

**`color`（语义色）和 `variant`（外观样式）是两个独立维度，绝不能混成一维枚举。**
混了之后 `variant="danger"` 就没法再表达"描边样式的危险按钮"，
而且 CSS 会退化成组合爆炸。正确做法是让两者只通过色槽交汇：

```css
/* color 只负责往色槽里填值（这里是三个） */
:host([color='danger']) {
  --mc-button-fill: var(--mc-color-danger);
  --mc-button-on-fill: var(--mc-color-danger-fg);
  --mc-button-accent: var(--mc-color-danger);
}

/* variant 只负责把色槽贴到哪儿 */
:host([variant='outline']) {
  background-color: transparent;
  color: rgb(var(--mc-button-fill));
  border-color: rgb(var(--mc-button-fill));
}
```

于是 6 种颜色 + 3 种外观 = **9 条规则**，而不是 18 条组合规则。
hover / active 用 state layer（`currentColor` + 半透明）解决，连 hover 色槽都不用加。

完整定义见 [`component-spec.md` 1.2](./component-spec.md#12-属性四个正交维度)。

**为什么不做 `class:mc-btn--primary="color === 'primary'"`**：

1. HTML 更干净，使用者的心智负担更低
2. **UnoCSS 不需要 safelist** —— 工具类在模板里是字面量，能静态扫到。
   这从根上避开了 UnoCSS 最大的坑：动态拼接的类名会被**静默丢弃**，
   产物里少几条规则、退出码仍然是 0
3. CSS 体积不随变体数膨胀 —— 变体只改变量值，不新增选择器

**约束**：一个组件最多 4 个维度（`color` / `variant` / `size` / 状态布尔）。
再多就说明这个组件该拆了。

⚠️ 默认外观**直接写在 `:host` 上**，不要写 `:host(:not([variant]))` ——
ofa.js 的样式作用域不支持 `:host()` 内嵌 `:not()`，会静默失效（[P14](./ofa-pitfalls.md)）。

---

## 三、ofa.js 组件骨架

### 为什么只有这一种写法：`<template component>`，不手写 class

ofa.js 是 **MVVM** 框架（官方自述 _"No-build MVVM front-end framework, Progressive micro front-end
framework."_），而它的 MVVM 单位是 **Web Component**：一个 `.html` 文件 = 一个 tag，
视图编译进自己的 shadow root。

| MVVM          | ofa.js 里的东西                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Model**     | 组件的 `data`（响应式）+ 跨组件共享的 `$.stanz(...)` store                                                                  |
| **View**      | `<template component>` 编译出来的 shadow DOM                                                                                |
| **ViewModel** | 组件实例：`data` 状态 / `proto` 命令（计算属性用 getter-setter）/ `attrs` 把宿主属性接成被观察数据 / `watch` / 四个生命周期 |

与「经典 MVVM」有四处差别，前两条直接决定了 Mosaic 怎么写组件：

1. **绑定是细粒度、直接改真 DOM，没有虚拟 DOM**：改 `data` 里某一项的某个字段，只动对应节点、
   节点被复用（实测见 [`docs-refactor.md` §6](./docs-refactor.md)）—— 所以「改数据」可以放心用在
   滚动高亮这类高频更新上。
2. **双向不是默认的**，要显式 `sync:value="…"`。**Mosaic 一律不用**：对外只走「属性进（`attrs`）、
   事件出（`on:change`）」，这是 C4「定制点只用原生 CSS」的必然要求。
3. **响应式内核是独立库 Stanz**（`$.stanz` / `$.Stanz`），不是框架自研的那一套。
4. `o-app` / `o-router` / `o-page` / 布局页嵌套路由属于「渐进式微前端」，超出 MVVM 描述的范围。

**结论：一个 UI 组件只能是 `<template component>`。** 手写 `class X extends HTMLElement` 不是
「另一种风格」，而是把框架已经给你的东西全部重做一遍，而且做得更差 —— 这是把 `docs/` 下四个手写元素
（`doc-nav` / `doc-crumb` / `doc-pager` / `doc-toc`）全部迁完之后确认的：

| 框架给的                                    | 手写 class 得自己实现                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| 数据 → DOM：`{{ }}` / `attr:` / `:style.x`  | `document.createElement` + `textContent` + `setAttribute`（还要自己抽 `el()` 这类助手） |
| 列表复用与点击稳定：`o-fill` + `fill-key`   | 自己做「内容没变就别重建 DOM」的签名守卫（`doc-toc` 原来就有一段）                      |
| 声明式控制流：`o-if` / `o-else`             | 自己管显隐与增删                                                                        |
| 生命周期：`ready` / `attached` / `detached` | `connectedCallback` / `disconnectedCallback`（还得自己记住摘监听）                      |
| 注册与按需加载：`tag` + `<l-m src>`         | 自己 `customElements.define`，自己安排加载顺序                                          |
| 初值形状由 `data` 决定                      | 构造期拼 `innerHTML`，首帧读不到数据就得自己补                                          |

代价只有一条，而且是被 P33 / P38 反复提醒过的那条：**模板必然带 shadow root**，内部样式要写进组件
自己的 `<style>`，外面（页面级 CSS）够不到。这是「换来不再漏样式、不被页面 reset 打破」的等价交换，
不是可以绕开的缺陷。

> **边界**：不是所有东西都该塞进组件。跨 shadow 的**页面级行为**（滚轮接力、换页复位）写成普通模块
> 就好 —— 现在它们住在外壳 `docs/layout.html` 里，没有视图、也就没有理由造一个组件。
>
> **守卫**：`tests/site/11-no-class-components.mjs`（node-only）扫 `docs/` 与 `packages/`，
> 出现 `class … extends HTMLElement` 直接红。迁移配方（class 写法 ↔ 模板写法）见
> [`docs-refactor.md` §4.0](./docs-refactor.md)。

```html
<template component>
  <style>
    /* 见第四节 */
  </style>

  <!-- 结构：工具类只负责布局 -->
  <div part="base" class="mc-x inline-flex items-center gap-2">
    <slot></slot>
  </div>

  <script>
    export default async ({ load }) => {
      // 需要其他组件时：await load('./mc-icon.html');
      return {
        tag: 'mc-x',

        // 声明为 observed attribute，HTML 中写 kebab-case，这里写 camelCase。
        // ofa.js 自动建立「属性 <-> 数据」双向同步，不需要手写 attributeChangedCallback。
        attrs: {
          variant: 'primary',
          size: 'md',
          disabled: false,
        },

        data: {
          // 内部状态。不要在这里放 attrs 里已声明的字段
        },

        proto: {
          // 方法。计算属性用 getter/setter 写在这里
          someMethod() {},
        },

        watch: {
          // 侦听器。注意 ofa.js 在初始化时也会立即调用一次（带空 opts）
          disabled(val, { watchers }) {},
        },

        ready() {}, // DOM 已创建（shadow root 内），适合初始化
        attached() {}, // 已挂载，适合定时器/全局监听
        loaded() {}, // 子组件全部加载完成
        detached() {}, // 清理。定时器和全局监听必须在这里移除
      };
    };
  </script>
</template>
```

### 属性命名

| HTML（kebab-case）  | `attrs` 里（camelCase） | 类型             |
| ------------------- | ----------------------- | ---------------- |
| `color="danger"`    | `color`                 | 枚举（语义色）   |
| `variant="outline"` | `variant`               | 枚举（外观样式） |
| `size="lg"`         | `size`                  | 枚举             |
| `disabled`          | `disabled`              | 布尔             |
| `label-width="120"` | `labelWidth`            | 数字/字符串      |

布尔属性在 HTML 里**写存在即真**（`<mc-button disabled>`），不要写 `disabled="true"`。

---

## 四、`<style>` 的五个分区

按固定顺序写，便于 review。下面就是从 [`packages/button/button.html`](../packages/button/button.html) 里摘的结构：

```css
/* 1. 宿主盒模型 + 色槽默认值
      尺寸直接写在这里（不绕一层 --mc-button-h），使用者的 style="height:32px" 才压得住 */
:host {
  display: inline-flex;
  position: relative; /* 内部绝对定位元素的包含块，不能省（P21） */
  height: var(--mc-control-h-md);
  border-radius: var(--mc-radius-md);

  --mc-button-fill: var(--mc-color-primary); /* 三个色槽：填充 / 填充上的文字 / 强调色 */
  --mc-button-on-fill: var(--mc-color-primary-fg);
  --mc-button-accent: var(--mc-color-primary);

  background-color: rgb(var(--mc-button-fill)); /* filled 是默认外观，直接写在这 */
  color: rgb(var(--mc-button-on-fill));
}

/* 2. 维度一 color：只往色槽里填值 */
:host([color='danger']) {
  --mc-button-fill: var(--mc-color-danger);
  --mc-button-on-fill: var(--mc-color-danger-fg);
  --mc-button-accent: var(--mc-color-danger);
}

/* 3. 维度二 variant：只决定色槽贴到哪儿 */
:host([variant='outline']) {
  background-color: transparent;
  color: rgb(var(--mc-button-fill));
  border-color: rgb(var(--mc-button-fill));
}

/* 4. 尺寸与状态 */
:host([size='sm']) {
  height: var(--mc-control-h-sm);
}
:host([disabled]) {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 5. 内部元素：只放工具类表达不了的 */
.mc-layer {
  /* hover/active 的 state layer */
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background-color: currentColor; /* 不引新令牌，自动适配任意 color 与主题 */
  opacity: 0;
  pointer-events: none;
}
:host(:hover) .mc-layer {
  opacity: 0.08;
}
:host(:active) .mc-layer {
  opacity: 0.12;
}
:host([disabled]) .mc-layer {
  opacity: 0;
} /* 正向覆盖，不用 :not()（P14） */
```

**第 5 区要克制**：能用工具类表达的就放模板 `class` 里，别在这里重复。

**注意 `:host([disabled]) { pointer-events: none }` 不要写在宿主上** ——
那会连 `cursor: not-allowed` 一起失效（指针事件都没了，光标样式不会生效）。
用 `cursor` + state layer 归零 + 内部原生元素的 `:disabled` 三件套。

### `data(key)` 的使用限制

ofa.js 支持在 `<style>` 里用 `data(key)` 绑定组件数据，但**它会替换整个 `<style>` 的内容**。
所以规范要求：**含 `data()` 的样式必须单独放一个 `<style>` 标签**，其余样式放另一个。

Mosaic 组件原则上**不使用 `data()`** —— 能用 CSS 变量表达的就不要引入 JS 参与样式计算。

---

## 五、事件

| 场景             | 做法                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| 点击等原生交互   | **不定义自定义事件**。原生 `click` 自带 `composed: true`，会穿透 shadow 边界冒泡 |
| 值变化（表单类） | `this.emit('change', { data: { value } })`                                       |
| 需要跨层级冒泡   | `this.emit('x', { data, bubbles: true, composed: true })`                        |

```html
<!-- 使用者侧：直接监听原生事件即可 -->
<mc-button on:click="handleSubmit">提交</mc-button>
<mc-input on:change="value = $event.data.value"></mc-input>
```

事件名**不加 `mc-` 前缀**（`change` 而不是 `mc-change`）。理由是与原生语义一致，
使用者不需要记两套命名。

---

## 六、插槽与定制点

定制点分两级，**优先用第一级**：

**① `:host`（首选）** —— 把对外可见的视觉（尺寸、内边距、圆角、颜色）全部定义在 `:host` 上。
这样使用者用原生 CSS 就能精确覆盖，连 `part` 都不需要：

```html
<mc-button style="height: 32px; border-radius: 8px">提交</mc-button>
```

**原理**：外部内联样式的优先级高于 shadow root 里的任何规则（包括 `:host([size])`）。
所以「属性给默认值、`style` 给精确值」这套两级 API 是天然成立的，不用额外机制。

**② `part`（内部子元素才需要）** —— 组件内部有**结构性**子元素且使用者确实需要定制时，
给它们加 `part`，配合 `::part()` 穿透：

```html
<mc-dialog>
  <!-- 内部：<div part="panel"><div part="header">…</div><div part="body">…</div></div> -->
</mc-dialog>
```

```css
mc-dialog::part(panel) {
  border-radius: 0;
}
```

| 组件        | 插槽                               | part                                                 |
| ----------- | ---------------------------------- | ---------------------------------------------------- |
| `mc-button` | 默认（文案）、`prefix`、`suffix`   | 无（全靠 `:host`，见 `packages/button/button.html`） |
| `mc-card`   | 默认、`header`、`footer`、`suffix` | `base`、`header`、`body`、`footer`                   |
| `mc-input`  | —                                  | `base`、`input`、`prefix`、`suffix`                  |
| `mc-dialog` | 默认、`header`、`footer`           | `overlay`、`panel`、`header`、`body`、`footer`       |

⚠️ **给插槽内容设样式，优先用 `::slotted()`**，不要用 `<inject-host>`。
`<inject-host>` 会把样式注入到宿主元素所在的整个作用域（顶层时直接进 `document.head`），
有明确的样式污染风险，而且会触发宿主样式重注入导致重排（见 [P13/P14](./ofa-pitfalls.md)）。
只在 `::slotted()` 无法满足时使用。

⚠️ **但 `::slotted()` 只压得住「同一个封装上下文」里的规则**：插槽元素同时是外层 shadow 树里的
普通元素，`shadow-base.css` 对 `button` 的 reset（`padding` / `background` / `cursor`）会压过组件的
`::slotted(button)`。所以**行盒子级别的视觉一律写在宿主上**，插槽元素只当「铺满整行的交互层」
（完整的推演与两种写法对比见 [P33](./ofa-pitfalls.md)）。

⚠️ **模板里用了 `<l-m>` 就必须同时写 `l-m { display: none }`**，
否则它会作为 flex item 参与 `gap` 布局，造成间距不对称（[P13](./ofa-pitfalls.md)）。

---

## 七、组件清单

**组件清单和各自的 API 定义在 [`component-spec.md`](./component-spec.md)，本文不重复。**
那里是唯一真相源；改了组件 API 请改那一份。

里程碑分批：

| 批次   | 内容                                                                                                                                                | 备注                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **M1** | `mc-button`（已实现）/ `mc-code`（已实现）/ `mc-collapse`（已实现）/ `mc-card`（已实现）/ `mc-tag`（已实现）/ `mc-icon` / `mc-badge` / `mc-spinner` | 产出可发布的 0.1.0                                   |
| **M2** | 表单与反馈 9 个                                                                                                                                     | 会大量撞上 [P6 / P18 / P19 / P20](./ofa-pitfalls.md) |
| **M3** | 浮层与布局 6 个                                                                                                                                     | 开工前必须先验证图层问题（见下）                     |

> ⚠️ **M3 开头必须先验证图层问题**：宿主页面上的 `transform` / `filter` / `contain`
> 会创建新的层叠上下文，可能把 shadow root 里的 `position: fixed` 困住。
> 验证后再决定继续用 `position: fixed`、改用 popover API，还是挂载到 `document.body`。
> 详见 [`design-spec.md` 第七节](./design-spec.md#七层级)。

---

## 八、尺寸与无障碍基线

### 尺寸

| 尺寸         | 控件高                        | 内边距         | 字号             |
| ------------ | ----------------------------- | -------------- | ---------------- |
| `sm`         | `--mc-control-h-sm` (1.75rem) | `--mc-space-3` | `--mc-text-xs`   |
| `md`（默认） | `--mc-control-h-md` (2.25rem) | `--mc-space-4` | `--mc-text-sm`   |
| `lg`         | `--mc-control-h-lg` (2.75rem) | `--mc-space-5` | `--mc-text-base` |

所有组件的 `size` 都必须只支持这三个值（`sm` / `md` / `lg`），
新增尺寸要先加 `--mc-control-h-*` 令牌，**不允许在组件里写死像素值**。

### 无障碍

| 要求     | 落地                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------ |
| 键盘可达 | 可交互元素必须是原生 `<button>` / `<input>` / `<a>`，不要用 `<div on:click>`                           |
| 焦点可见 | 必须有焦点样式。统一用 `focus-visible:ring-2 ring-ring`                                                |
| 对比度   | 令牌层已保证（见 [design-tokens.md](./design-tokens.md#四对比度自检)），组件**不得绕过令牌直接写颜色** |
| 禁用态   | 用 `disabled` 属性而非仅 `opacity`，保证屏幕阅读器可感知                                               |
| 动效     | 尊重 `prefers-reduced-motion`，已在 `shadow-base.css` 里统一把 `--mc-duration-*` 压到 1ms              |
| 图标按钮 | 必须有 `aria-label`；纯装饰 SVG 加 `aria-hidden="true"`                                                |

---

## 九、写新组件的交付检查清单

> 「ofa.js 正确性」这一节的每一条都对应 [`ofa-pitfalls.md`](./ofa-pitfalls.md) 里的一个坑，
> 踩中的代价是**静默失效**（不报错、表象像"没生效"），所以不要跳。

```
目录与命名
[ ] packages/{name}/{name}.html 组件本体 + page.html 文档页
[ ] 文档页以 <template page> 开头，并 <link> 了 ../../docs/content.css
[ ] 每个演示一个 demos/*.html（ofa 组件），页面里是标签 + 一行 mc-collapse 抽屉
[ ] 组件自己的断言在 test/*.test.mjs，`node tests/smoke.mjs <name>` 能单飞
[ ] 文档页只写用法（API 表 / 演示 / 注意事项），实现说明留在组件文件头与 agent/
[ ] 注释只写「为什么」：不显然的取舍、坑的编号（P1…）、必须知道的前提；
      成段的原理 / 历史 / 与 agent/ 重复的长篇不抄进代码，需要就指一句过去
[ ] 文档页里的站点资产相对路径正确（../boot/...、../../docs/...）
[ ] 已在 docs/site-map.js 的树里加了一个节点（label / order / path / tagName / stage / summary），
      左栏菜单 / 总览 / 首页 / 面包屑翻页都会自动带上
[ ] 标签名 = mc- + 目录名，三方一致

结构
[ ] 用 <template component> 写，**不手写 class 扩展 HTMLElement**（站点级元素也一样；
      tests/site/11-no-class-components.mjs 会拦）
[ ] <style> 按五个分区顺序书写
[ ] 视觉定义在 :host 上，外部 style="height:32px" 能直接覆盖
[ ] 颜色全部走 L3 组件令牌，模板 class 里没有任何颜色工具类
[ ] 变体全部用 :host([attr]) 驱动，没有拼接类名
[ ] 每个组件至少暴露一个 part，或用 :host 直接可定制
[ ] 使用 ::slotted() 而不是 <inject-host>
[ ] P33 有插槽交互元素时，行盒子（尺寸/内边距/底色/颜色）写在宿主上，
      ::slotted() 只放祖先 shadow 树里没声明过的属性；插槽里 <a> 与 <button> 外观一致

ofa.js 正确性  ← 逐条对照 ofa-pitfalls.md
[ ] P1  布尔属性默认值写成 null，不是 false
[ ] P1  所有对外属性都进了 attrs（没声明就不是 observed attribute）
[ ] P2  转发给内部原生元素用 :disabled，不用 attr:disabled
[ ] P3  外部改状态走 setAttribute / removeAttribute
[ ] P5  watch 里跳过初始化时的首次触发
[ ] P8  {{...}} 只用在文本节点，属性一律用指令
[ ] P9  attr: 的值是 JS 表达式 —— 静态中文文案绝不能用 attr:
        （代价：抛 ReferenceError 并中断整个 render，表象像"绑定不生效"）
[ ] P10 运行时会切换的显隐用 :host([attr]) + 常驻 DOM，不用 o-if
[ ] P11 用了 o-fill 时内部只能写 $data / $index / $host
[ ] P13 模板里用了 <l-m> 就同时写 l-m { display: none }
[ ] P14 没有使用 :host(:not([attr]))
[ ] P17 动态插节点走 this.ele.shadowRoot.appendChild
[ ] P19 内部原生 change 事件已转发为 composed: true
[ ] P20 判断点击外部用了 composedPath()，不是 contains()
[ ] P21 内部透明交互层有 z-index，且宿主是 position: relative
[ ] detached() 里清理了所有定时器和全局监听
[ ] 含 data() 的样式单独放在一个 <style> 里
[ ] proto 方法名避开了 $.fn 上的通用名（get/set/text/html/data/watch/on/emit/class/style/remove/refresh/sync）
[ ] attrs 的键也不撞保留名（已知 wrap 会让 createElement 直接坏，见 P31）
[ ] ready() / 构造期没有往宿主元素写属性（style 也算），要写就写 shadow root 内部元素（P31）

质量
[ ] 键盘可完成全部操作，焦点环可见且用的是 ring 令牌不是 currentColor（P16）
[ ] 亮色 + 暗色都肉眼过一遍
[ ] 禁用态用 :disabled 而非只有 opacity（屏幕阅读器可感知）
[ ] sr-only 文案齐全（图标按钮、纯图标状态）
[ ] 在"没有任何 reset 的脏宿主页面"里渲染正常（C3 约束）

工程
[ ] pnpm build 通过，产物体积没有异常增长
[ ] 新增的令牌已加进 tools/gen-tokens.mjs（如果涉及色板）
[ ] 新增的公共工具类已加进 uno.config.ts 的精选子集（如果使用者会用到）
[ ] pnpm dev 验收页确认无误（`tools/serve.mjs`，零依赖、`no-store`；不要用别的静态服务器，见 P24）
[ ] 测试只跑本次改动命中的范围：`pnpm test:changed`（选测中间层；加 / 挪了套件先 `pnpm test:record`），
      或按标签挑 `node tests/smoke.mjs <slug> / --site <关键词>`；全量只在收尾验收跑一次
      —— 中途重复全量既慢，又会掩盖「这次改动影响了什么」
```
