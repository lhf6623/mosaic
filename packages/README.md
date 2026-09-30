# 组件单元总纲：页面规范 · 共用约定 · 组件索引

`packages/` 下**一个组件 = 一个单元**：本体 `<slug>.html` + `api.md`（接口事实）+ `page.html`（文档页）

- `demos/`（例子）+ `test/`（冒烟套件）住在一起。**对外只有两个入口**：本体（使用者 CDN 引入）与
  `page.html`（文档站加载），其余是单元内部资产 —— 所以规范跟着单元走，不另建一处。

这份是全目录共用的三件事：**① 文档页怎么排**（一～四）· **② 接口共用约定**（五）· **③ 有哪些单元**（六）。
逐组件接口住各自单元的 [`api.md`](./button/api.md)；令牌体系住 [`color/README.md`](./color/README.md)。

> **读这份的场合**：接一个组件、查接口、改组件 API、写或改任何组件文档页、加一个新组件页。

---

组件文档页（`packages/<slug>/page.html`）怎么写：固定的 `<h2>` 骨架、演示区的四段结构、
参考区（属性 / 事件 / 插槽与 part）的表格口径。组件接口本身以各单元的 [`api.md`](./button/api.md) 为准。

> **读这份的场合**：写或改任何组件文档页、加一个新组件页、调整演示区结构。

---

## 一、页面骨架：开场白 →（可选）注意事项 → 例子 → 参考区（由 `api.md` 渲染）

**文档页只写用法。** 每一页都按下面的顺序排，读的人不用在几种排法之间找。
**页面源码里只有一个 `<h2>`：`例子`** —— `属性` / `事件` / `插槽与 part` 三个参考节由本单元的
[`api.md`](./button/api.md) 经 `<doc-spec>` 运行时渲染，**页面里不手抄一张表**
**没有内容可写的节整节省略** —— 尤其别为了凑一节
写一句「用户自己看得见」的废话：`mc-button` 就没有「注意事项」。

| 顺序 | 块                                | 放什么 / 从哪来                                                                                                                                                                         |
| ---- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 开场白                            | `<h1>Xxx <code>mc-xxx</code></h1>` + 一句 `.doc-lead`                                                                                                                                   |
| 2    | **注意事项**（可选，不是 `<h2>`） | 页面顶部 `<mc-alert class="doc-notes" color="warning" icon heading="注意事项">`，不进右栏目录。只写使用者会踩的坑，每页 2～3 条；没有就整块省略（`mc-button` 没有）                     |
| 3    | `例子`                            | 全部 `<section class="doc-demo">`（每个演示：标题 →（可选）说明 → 组件 → 代码）—— 页面源码里唯一的 `<h2>`                                                                               |
| 4    | **参考区**（`<doc-spec>` 渲染）   | 页面尾部 `<doc-spec src="./api.md"></doc-spec>`：md 白名单七节（`属性` / `方法` / `事件` / `配置` / `插槽与 part` / `插槽` / `part`）渲染成同名的 `<h2>` / `<h3>`，只放表（口径见 §三） |

⚠️ **注意事项只写在 `page.html`，不进 `api.md`** —— 它没有第二个副本。用 `<mc-alert>` 而不是 `<h2>`
是有意的：右栏目录里没有「注意事项」入口，读者在页首就看到了，不用滚下去再跳回来。

⚠️ **没有「定制」节了**（2026-09 去掉的）：L3 令牌清单**不进文档页、也不进 `api.md`** ——
它住在单元 [`README.md`](./button/README.md) 的令牌表里（`unit-tokens` 面对账），
将来由主题编辑器展示。页面上的用法由「外部样式」（宿主 `style` / 令牌）与
「内部样式」（`::part()`）两条演示承担。**别再往文档页里加令牌表** —— 那一节原来叫
`定制：L3 令牌 + ::part()`，标题与演示重复，表格又和规范里那份重复。

⚠️ **参考表的第一栏一律叫「名称」**：表头别复述节标题（原来属性表的第一栏就叫「属性」、事件表叫「事件」），
`名称` 说明的是「这一格填的是接口名」，放在哪一节都成立：属性表 / 事件表 / 插槽与 part 表
第一栏都是 `名称`。（`令牌` 是数据字段名，不进这些表 —— 见上面那条。）

⚠️ **为什么事件要单开一节**：它原来混在属性表那一节里、连 `<h2>` 都没有（collapse 的事件表挂在
`mc-collapse-item` 属性表下面），右栏目录里根本看不到它 —— 而「怎么监听」恰恰是最常查的东西之一。

- 正文最前是 `<l-m>` 注册（本组件 + 所有 `demos/*.html` + 页面用到而外壳没注册的组件，尤其 `mc-alert`）；
  之后依次是 `<h1>` / `.doc-lead`、注意事项（可选）、`<h2>例子</h2>`、
  `<doc-spec src="./api.md">`。
- 页首只留 `<h1>` + 一句 `doc-lead`（+ 可选的注意事项），**不要把参考表写在例子前面**：
  先看能做什么（例子），再查怎么配（参考区）。
  ⚠️ **页首没有徽标了**（2026-09 去掉的 `doc-badges`）：那三个胶囊是
  「已实现 / 里程碑 M1 / `packages/xxx/`」，前两个每个组件页都写死同一份、
  且与导航数据（[`site-map.js`](../docs/site-map.js) 的 `stage`、`path`）重复，
  第三个读者从 URL 就知道 —— 里程碑与状态统一以导航数据为唯一源
  （左栏就开在它上面），文档页不再单独抄一遍。
- 实现说明（为什么这么分层、底层用了什么机制）不进文档页 —— 留在组件文件头与同单元 `README.md` 的「设计取舍」节。
- 每个演示的标题与 `.doc-hint` 留在 `<section>` 里；演示之间不插属性表。
- 页面里**内联的 `<mc-code>` 文本是逐字展示的**，前面必须加 `<!-- prettier-ignore -->`
  （否则 `pnpm format` 会把它的换行重排掉）；长片段改用 `src="…"` 就没这个问题。

## 二、演示区四段：标题 → 说明 → 组件 → 组件代码

顺序固定，读的人不用在几种排法之间找（05 号套件按顺序指纹盯着）：

```html
<section class="doc-demo">
  <h3>语义色</h3>
  <!-- ① 标题：中文名，尽量短，不带英文（英文去属性表里查） -->
  <p class="doc-hint">六个语义色，颜色是按钮唯一决定「语气」的维度。</p>
  <!-- ② 说明：可选。是导语不是脚注，写「在看之前该知道什么」 -->
  <demo-button-colors></demo-button-colors>
  <!-- ③ 组件：活样例（独立的 demos/*.html 组件） -->
  <mc-collapse class="doc-demo-code">
    <mc-collapse-item header="查看代码"
      ><mc-code language="html" src="./demos/colors.html"></mc-code
    ></mc-collapse-item>
  </mc-collapse>
  <!-- ④ 组件代码：默认收起的抽屉，内容就是 ③ 那份文件 -->
</section>
```

- **① 标题 = API 名的中文，尽量短**：一个演示讲一个属性 / 插槽 / 事件时，标题就是它的中文名
  （`尺寸`、`禁用`、`手风琴`、`自定义头部`）。英文属性名不进标题 —— 那是属性表的事，
  标题写全了只会把右边的目录撑长。
  只有这几类允许不是「单个 API 的中文名」：`基本用法`、样式类、结构 / 组合用法（如 `嵌套`）。
  样式类的名字要**一看就知道改哪儿**，且不跟别的词混：`外部样式`（宿主 `style="…"`）/
  `内部样式`（`::part()`）—— ~~`定制样式`~~ 看不出改什么，~~`定制外框`~~ 容易被读成「边框」。
  ⚠️ 一条演示只讲一种机制，别把两者并成一条：并了之后导语必然承诺演示没做的事
  （原来 collapse 那条叫 `定制样式`、导语写着 `::part()`，可演示文件里只有 `style="…"`）。
  ⚠️ 标题同时是**右栏目录的文案**（`doc-toc` 扫 h3），改成又长又绕的词会连带影响那条宽度预算。
- **② 说明是导语，而且可选**：它在组件**之前**，写「这个例子在演示什么、该看哪儿」。
  **一眼就看得明白的例子不要写**（三档尺寸、两种外观这种），写了反而是噪声；
  反过来，「看不出来」的信息必须写在这里（键盘怎么操作、禁用之后焦点会怎样、
  `$event.data` 里有什么）—— 演示区里没地方放这些。
  会踩的坑归**页面顶部**的「注意事项」（`<mc-alert>` 那一块），别和导语重复。
  ⚠️ 概念解释**全页只写一遍**，放在读者**第一次遇到那个词**的地方。例子区在参考区前面，
  所以术语的定义落在导语里：`part` 是什么写在「内部样式」的导语中，
  「插槽与 part」节**只放表**（参考区不写解释句，读者从例子过来时已经懂了）。
  ⚠️ 另一种「看起来有用」的重复：别把演示展开后已经写着的句子再抄一遍
  （导语与演示正文撞车＝同一条信息两遍）。
  它在演示区里的间距由 `content.css` 的 `.doc-demo > .doc-hint` 给。
- **③ 例子是一个独立的 ofa 组件文件**（`demos/*.html`）：可单独打开、单独测，
  一个演示一个文件，代码面板引用同一份（见下）。
- **④ 组件代码**：`<mc-code src>` 读的就是 ③ 那份文件的**原文**（含 `<template component>`
  外壳与注册用的 `<script>`）—— 刻意不另写片段，只有一份源、不会漂移；默认收起。

> **迁移状态**：26 个组件文档页已全部按这个顺序排过（开场白 →（可选）注意事项 → 例子 →
> `<doc-spec>` 参考区 → 页脚）。05 号套件盯所有页的演示区段落顺序指纹
> （`h3|demo|code` / `h3|hint|demo|code`）——说明可以在、可以不在，但**绝不许落在组件之后**；
> 参考区渲染出来的节与 `api.md` 逐条对账。

⚠️ **覆盖线**：组件代码里有的**属性** / **命名插槽** / **part**，都至少要有一个演示真的用到它 ——
属性直接写、插槽写 `slot="x"`、part 用 `::part()` 改（就是这一页的「内部样式」），`demo-covers-api` 守着。
它**不是**「一条演示只讲一个属性」：同一维度的变体（三档尺寸、六个颜色）合一条照样算覆盖；
反过来，加了属性 / 插槽 / part 却没演示，这里就红。

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
  例子内部一律用工具类（`flex flex-wrap items-center gap-3`，工具类子集里有）。
- 抽屉就是**项目自己的折叠面板**，作者直接写在页面里（`content.css` 里那几条把容器
  的卡片外观压成一条分隔线，头部/内容区走 `::part()`）。它是站点级依赖，
  和 `mc-code` / `mc-collapse` 一起在 `docs/layout.html` 注册一次。
- ⚠️ **演示里用到的组件，只要不在站点级那批里，就要本页注册**：外壳注册的只有
  `mc-code` / `mc-icon` / `mc-collapse(-item)` / `mc-menu(-item)` / `mc-breadcrumb(-item)` /
  `mc-card` 那一批，**不含 `mc-button`**。漏了的话 ofa 的 `*:not(:defined){display:none}`
  会把没注册的标签连同文字一起藏掉 —— 不报错，只是演示区里那排按钮整个消失；而且
  同一个页面**两种表现**：从首页点进来正常，深链打开再刷新就空白（首页碰巧注册过
  `mc-button`，深链 + 刷新时不保证渲染 —— message / popover 两页就这么炸过）。
  写法照 `packages/card/page.html`，正文最前面一行：

  ```html
  <l-m src="../button/button.html"></l-m>
  ```

  11 号套件逐页对账这条（站点外壳 ∪ 本页 `<l-m>` ∪ 演示自己的 `load()` 必须盖住演示里用到的每个项目组件）。

- **代码的路径按写它的那个文件解析**（和 `<link href>` 一样），所以例子里的相对
  `src` 要从 `demos/` 往上数；`<mc-code src="./demos/x.html">` 则相对文档页。
- 冒烟测试逐页守这条约定：每个 `.doc-demo` 都有一个 `demo-*` 例子组件 + 一个抽屉、
  代码面板里的文本**逐字等于**它 `src` 指向的文件、每块代码都提到它在演示的标签
  （Button 页全是 `<mc-button>`、Code 页全是 `<mc-code>`、Collapse 页全是 `<mc-collapse>`），
  且文件里是作者写的原样标记（没有 ofa 反射出来的默认属性）。

## 三、参考区（属性 / 事件 / 插槽与 part）：写进 `api.md`，只放表

参考区**由 `<doc-spec src="./api.md">` 运行时渲染**，所以下面这些表和口径都写在
`packages/<slug>/api.md`（**纯渲染源**：开场白 + 白名单七节），页面里一个字都不抄。
三个参考节**只有表**，一句解释都不写。文档页只回答「叫什么、填什么、值是什么」；
「为什么这么设计」「底层用了什么机制」一律留在这里、组件 API 规范 与组件文件头。

**表格四件事：**

| 规则                    | 说明                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **第一栏一律叫 `名称`** | 属性表 / 事件表 / 插槽与 part 表都是 —— 表头别复述节标题（原来的「属性」栏、「事件」栏、「插槽」栏都只是在复述）                                                                              |
| **一行一个名字**        | `插槽 header / footer` 要拆成两行，说明各自写全（哪一条线、什么时候占位），别写「同上」；`part="a" / "b" / "c"` 同理                                                                          |
| **混合表用前缀标种类**  | 一张表里既有插槽又有 part（节标题就是 `插槽与 part`）时，名称写成 `插槽 header` / `part="header"`；整节只有一种时（节标题就叫 `插槽` 或 `part`）直接写裸名字（`prefix`、`body`）              |
| **节名说实话**          | 代码里两种都有 → 一节 `插槽与 part`（上面那张混合表）；只有插槽 → `插槽`；只有 part → `part`；都没有就整节省略。`api-slot-part-title` 守卫盯着这条                                            |
| **值列写 TS 类型**      | `boolean` / `string` / `number` / 字面量联合 `'sm' \| 'md'`；**默认列仍是字面值**（守卫拿它跟代码逐字比）。联合的竖线按 GFM 转义；别再写「布尔 / 字符串 / 数字」。`api-value-ts` 守卫盯着这条 |

**事件表的「类型」写 TS 函数签名**：`(event: Event & { data: { name: string } }) => void`。
ofa 的 `emit(type, { data })` 交过来的是**原生 `Event` 加一个 `data`**（不是 `CustomEvent`，
实测 `ctor === Event`、`isCustomEvent === false`），没有 `data` 就写 `(event: Event) => void`；
字段类型按组件真实的 payload 写。

**落笔前问三句**（2026-09 全站清理用的就是这三刀）：

1. 这句是**机制**还是**事实**？机制 → 删（回这里或组件文件头）；
2. 是**事实**？→ 转成一张表（`data-current` 这类宿主钩子、`code` 的传值优先级，都这么处理）；
3. 已经在**演示里**（或演示正文里）说过？→ 直接删 —— 导语与演示正文撞车＝同一条信息两遍。

> ✅ 这三条现在有自动守卫了：`pnpm check:docs`（`tools/doc-drift/` + `tools/doc-drift.config.mjs`）
> 会对账 `api.md` 的**表头口径**、插槽 / part 的**节名**（`api-slot-part-title`）与每张表跟
> 组件代码（属性 / 事件 / 插槽 / part，含默认值），以及页面骨架与 `<doc-spec>` 接线。
> 它管不到的是**解释句**：一节里混进的机制说明、
> 导语与演示重复 —— 那是判断，落笔时按上面的清单自查。

## 四、首页海报：数据驱动 + 响应式（`docs/pages/home.html`）

- 页面里**没有一行 JS 建 DOM**：`computeTiles(宽, 高, 入口块)` 是纯函数，吐
  `{ key, x, y, opacity, … }`；视图由 `<o-fill>` 加 `:style.*` / `attr:data-color` 渲染；
  鼠标视差只改 `farTransform / midTransform / nearTransform` 三个字段。
  容器尺寸变化也只是 `ResizeObserver → relayout()` 重算数据。
- 方块是 **HTML 元素、不是 SVG**：`<o-fill>` 是自定义元素，SVG 命名空间里的元素不会被
  `customElements` 升级，放进 `<svg>` 会让 ofa.js 在模板编译期直接抛错。
- **边长是响应式的**（容器宽度 / 16，夹在 `TILE_MIN`…`TILE_BASE`），其余参数全写成比例
  （间距 / 抖动 / 颗粒 / 色片都按边长推）—— 只有一个数会动，比例关系不会散。
- 尺寸经 `--art-*` 变量从 JS **广播给 CSS**：两边用同一个数，避免
  「CSS 里写死 22.3px、边长改了它不跟」那种静默走形。
- 色片排除区要算三样：入口块的**实际中心**（它不在容器正中）、色片自身半宽、
  近景层的**视差位移上限**。少算一个，窄屏 + 鼠标推到极值时色片就会滑到按钮底下。
- 格子 seed 用固定 stride（而不是 `cols`），否则窗口宽度每跨一格，整幅图案会重掷一副。
- 两个入口直接用项目自己的 `<mc-button>`（用 `<l-m>` 在本页引入），点击走 `openPage()`
  改 hash 导航 —— 文档站首页自己就是组件的活样例。

---

## 五、共用约定（属性 / 事件 / 插槽 / part / 无障碍）

> 子节编号沿用原「组件 API 规范」的 **1.x** —— 外部有多处按 1.2 / 1.4 / 1.5 / 1.7 引用，别重编号。

这一节是硬约束 —— 所有组件的 API 都必须落在这个框架里，
不允许某个组件"因为情况特殊"另起一套。

### 1.1 引入方式

**按需引入，一个组件一条 `<l-m>`：**

```html
<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
```

标签名 = `mc-` + 目录名。同一个族的组件共用一个目录（目录名 = 主标签去掉 `mc-` 前缀）。

### 1.2 属性：五个正交维度

**不要把这些混成一维枚举。** 混了就没法组合（`variant="danger"` 之后
就没法再表达"我要描边样式的危险按钮"），而且 CSS 会退化成组合爆炸。

| 维度         | 属性                                                         | 取值                                                              | 默认      |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- | --------- |
| **语义色**   | `color`                                                      | `primary` / `info` / `success` / `warning` / `danger` / `neutral` | `primary` |
| **外观样式** | `variant`                                                    | 约定：`filled` / `outline` / `ghost`（部分组件另有 `subtle`）     | `filled`  |
| **尺寸**     | `size`                                                       | `sm` / `md` / `lg`                                                | `md`      |
| **形态**     | `inline`                                                     | 缺省 = 控件盒 / `inline` = 行内文字（盒子交给文字）               | 缺省      |
| **状态**     | `disabled` / `loading` / `readonly` / `invalid` / `selected` | 布尔，存在即真                                                    | 无        |

组件**只声明它真正支持的维度**（`mc-card` 没有 `color`，`mc-spinner` 没有 `variant`）。
**形态**目前只有 `mc-button` 声明（`inline`）：它跟 `variant` 分开，是因为文字按钮要动的是**盒子**
（那是 `size` 的地盘），塞进 `variant` 会让 `size` 在那一档只剩半个轴。
不支持的属性不要写进 `attrs` —— 写了就是承诺。

`variant` 的取值是**约定**而不是全局枚举：每个组件只声明自己实际支持的取值，
上表列出的是各组件通用的一套（`mc-menu` 用的是 `plain`（默认）/ `surface`）。

**实现方式**：`color` 只往组件自己的色槽（`--mc-<comp>-*`）里填值，`variant` 只决定这些槽
贴到 `background` / `color` / `border-color` 上，两者不直接相乘。槽的个数按需要定：
`mc-button` 用三个 —— `--mc-button-fill` / `--mc-button-on-fill` / `--mc-button-accent`，
因为中性色需要一个单独的强调色。规则数量级因此是「颜色数 + 外观数」，不是两者相乘。

**`color` 除语义名外还收 hex**（`color="#fff000"`，只收 `#fff000` / `#fc0` 这种写法）：
语义名照旧走 CSS（也只有它们随主题翻转），hex 走**共享接线器**
[`packages/boot/color-attr.js`](./boot/color-attr.js) —— 组件里 `attached()` +
`watch.color` 各一行，填的还是上面那些槽，所以 `variant` 的组合关系一个字没变；文字色按 WCAG 自动算。
已接：`button` / `tag` / `icon` / `alert`（四个声明了 `color` 的组件）。声明了 `color` 的组件漏接会被
[`tests/site/11-no-class-components.mjs`](../tests/site/11-no-class-components.mjs) 拦下。

### 1.3 尺寸：只有三档

| `size`       | 控件高                     | 用途                                                                       |
| ------------ | -------------------------- | -------------------------------------------------------------------------- |
| `sm`         | `--mc-control-h-sm` (28px) | 密集界面（表格行内、工具条）。**低于 32px 触控下限，不要用在移动端主操作** |
| `md`（默认） | `--mc-control-h-md` (36px) | 常规                                                                       |
| `lg`         | `--mc-control-h-lg` (44px) | 移动端主操作、突出操作                                                     |

**没有 `xs` / `xl`。** 需要更极端的尺寸时用 `style="height: …"` 精确覆盖，
不要往组件里加尺寸档位 —— 三档之外的需求都是个案。

### 1.4 值的读写（最容易踩的地方）

**标签属性是"初始值"，DOM property 是"运行时状态"。** 这条规则对所有带值的组件生效。

```html
<!-- HTML 里设初始值：用 default-* -->
<mc-input default-value="张三"></mc-input>
<mc-dialog default-open></mc-dialog>
```

```js
// JS 里读写运行时状态：用 property
input.value = '李四'; // ✅
input.setAttribute('value', '李四'); // ❌ 无效
dialog.open = true; // ✅
```

**布尔属性推荐走 `setAttribute` / `removeAttribute`** —— 属性是 ofa 观察的通道
（少数直接改不触发更新的 property 例外）。
组件**可以**为布尔属性提供一个立即同步的 property 访问器 —— `mc-collapse-item` 的 `open` 就是
（`el.open = true` 写完立刻生效，不必等属性反射那一拍）。

```js
btn.setAttribute('disabled', '');
btn.removeAttribute('disabled');

item.open = true; // 组件提供了访问器时同样可以
```

**值的反射**：`value` / `checked` / `open` 等会反射到宿主元素的原生 DOM property，
所以 `e.target.value` 能读到值（这里的历史坑已由组件内部处理，使用者无感）。

### 1.5 事件

**不加 `mc-` 前缀**，用原生语义名，使用者不需要记两套命名。

| 名称     | 类型                                                                  | 说明                           |
| -------- | --------------------------------------------------------------------- | ------------------------------ |
| `change` | `(event: Event & { data: { value: string } }) => void`                | 值确定变化（失焦、选中、确认） |
| `input`  | `(event: Event & { data: { value: string } }) => void`                | 实时输入（每次按键）           |
| `open`   | `(event: Event) => void`                                              | 弹层打开                       |
| `close`  | `(event: Event) => void`                                              | 弹层关闭                       |
| `select` | `(event: Event & { data: { value: string; item: unknown } }) => void` | 选项被选中                     |
| `clear`  | `(event: Event) => void`                                              | 可清除输入被清空               |

```html
<mc-input on:change="value = $event.data.value"></mc-input>
```

**点击类交互不定义自定义事件** —— 原生 `click` 自带 `composed: true`，会穿透 shadow 边界冒泡。

### 1.6 插槽命名

| 名字                    | 用途                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| （无 `name`）           | 主内容                                                                           |
| `prefix` / `suffix`     | 输入框、按钮内部的前后附加物；容器类组件的「头部行尾」也用 `suffix`（`mc-card`） |
| `header` / `footer`     | 容器类组件的头尾                                                                 |
| `title` / `description` | 有明确语义的标题与描述                                                           |

**用 `prefix` / `suffix`，不用 `leading` / `trailing`** —— 和 CSS 逻辑属性（`padding-inline-start`）对齐。

### 1.7 `part` 命名

只在**内部有结构性子元素**且使用者确实需要定制时才暴露 `part`。
视觉在 `:host` 上的组件（如 `mc-button`）不需要 —— 外部 `style="…"` 已经够用。

通用词汇：`base` / `panel` / `overlay` / `header` / `body` / `footer` / `label` / `input` / `error`。
已开出的额外名字必须登记在这里：`list`（`mc-menu` / `mc-breadcrumb`）、
`pre` / `code` / `line`（`mc-code`）。

### 1.8 无障碍基线（每个组件都要满足）

- 可交互元素必须是**原生元素**（`<button>` / `<input>` / `<a>`），不是 `<div on:click>`
- 键盘可完成全部操作；弹层必须支持 `Esc` 关闭、打开时焦点进弹层、关闭后焦点归还
- 焦点环用 `--mc-color-ring`，不用 `currentColor`
- 图标按钮必须有 `aria-label`；装饰性 SVG 加 `aria-hidden="true"`

---

## 六、组件索引

逐一列出全部单元：标签、目录、里程碑、状态。**标签名 = `mc-` + 目录名**；
改了组件 API 先改该单元的 `api.md`，再改文档页。

| 组件                                  | 标签                                   | 目录          | 里程碑 | 状态      |
| ------------------------------------- | -------------------------------------- | ------------- | ------ | --------- |
| [Button](./button/api.md)             | `mc-button`                            | `button/`     | M1     | ✅ 已实现 |
| [Code](./code/api.md)                 | `mc-code`                              | `code/`       | M1     | ✅ 已实现 |
| [Collapse](./collapse/api.md)         | `mc-collapse` / `mc-collapse-item`     | `collapse/`   | M1     | ✅ 已实现 |
| [Menu](./menu/api.md)                 | `mc-menu` / `mc-menu-item`             | `menu/`       | M1     | ✅ 已实现 |
| [Breadcrumb](./breadcrumb/api.md)     | `mc-breadcrumb` / `mc-breadcrumb-item` | `breadcrumb/` | M1     | ✅ 已实现 |
| [Icon](./icon/api.md)                 | `mc-icon`                              | `icon/`       | M1     | ✅ 已实现 |
| [Card](./card/api.md)                 | `mc-card`                              | `card/`       | M1     | ✅ 已实现 |
| [Tag](./tag/api.md)                   | `mc-tag`                               | `tag/`        | M1     | ✅ 已实现 |
| [Badge](./badge/api.md)               | `mc-badge`                             | `badge/`      | M1     | ✅ 已实现 |
| [Spinner](./spinner/api.md)           | `mc-spinner`                           | `spinner/`    | M1     | ✅ 已实现 |
| [Input](./input/api.md)               | `mc-input`                             | `input/`      | M2     | ✅ 已实现 |
| [Textarea](./textarea/api.md)         | `mc-textarea`                          | `textarea/`   | M2     | ✅ 已实现 |
| [Checkbox](./checkbox/api.md)         | `mc-checkbox`                          | `checkbox/`   | M2     | ✅ 已实现 |
| [Radio](./radio/api.md)               | `mc-radio` / `mc-radio-group`          | `radio/`      | M2     | ✅ 已实现 |
| [Switch](./switch/api.md)             | `mc-switch`                            | `switch/`     | M2     | ✅ 已实现 |
| [Select](./select/api.md)             | `mc-select` / `mc-option`              | `select/`     | M2     | ✅ 已实现 |
| [Alert](./alert/api.md)               | `mc-alert`                             | `alert/`      | M2     | ✅ 已实现 |
| [Progress](./progress/api.md)         | `mc-progress`                          | `progress/`   | M2     | ✅ 已实现 |
| [Message](./message/api.md)（命令式） | `message()`                            | `message/`    | M2     | ✅ 已实现 |
| [Popover](./popover/api.md)           | `mc-popover`                           | `popover/`    | M3     | ✅ 已实现 |
| [Dialog](./dialog/api.md)             | `mc-dialog`                            | `dialog/`     | M3     | ✅ 已实现 |
| [Dropdown](./dropdown/api.md)         | `mc-dropdown` / `mc-menu-item`         | `dropdown/`   | M3     | ✅ 已实现 |
| [Tooltip](./tooltip/api.md)           | `mc-tooltip`                           | `tooltip/`    | M3     | ✅ 已实现 |
| [Tabs](./tabs/api.md)                 | `mc-tabs` / `mc-tab`                   | `tabs/`       | M3     | ✅ 已实现 |
| [Table](./table/api.md)               | `mc-table`                             | `table/`      | M3     | ✅ 已实现 |
| [Grid](./grid/api.md)                 | `mc-grid` / `mc-grid-item`             | `grid/`       | M3     | ✅ 已实现 |

---

## 七、表单控件共用约定（M2 定型，其余照抄）

> M2 / M3 全部已实现。接口事实的唯一手写源是各单元的 `packages/<slug>/api.md` —— 这里只留两样东西：
> ① 表单控件的**跨组件共用约定**（本节）② 实现相对草案的**出入清单**（第八节，对账用、含理由）。
> 共用约定见上面第五节；浮层结论见 [`popover/api.md`](./popover/api.md)。

| 名称            | 说明                                       |
| --------------- | ------------------------------------------ |
| `name`          | 表单字段名                                 |
| `default-value` | HTML 初始值（attribute，只在挂载时读一次） |
| `value`         | 运行时值（宿主 DOM property）              |
| `disabled`      | 状态布尔：禁用                             |
| `readonly`      | 状态布尔：只读                             |
| `required`      | 状态布尔：必填                             |
| `invalid`       | 状态布尔：校验失败                         |
| `size`          | `sm` `md` `lg`                             |
| `placeholder`   | 占位符                                     |

| 名称             | 类型                                                   | 说明                                          |
| ---------------- | ------------------------------------------------------ | --------------------------------------------- |
| `input`          | `(event: Event & { data: { value: string } }) => void` | 每次输入，载荷 `{ value }`                    |
| `change`         | `(event: Event & { data: { value: string } }) => void` | 值确定变化（组件已转发为 composed）           |
| `clear`          | `(event: Event) => void`                               | 可清除输入被清空（input / textarea / select） |
| `focus` / `blur` | `(event: Event) => void`                               | 原生事件，已穿透                              |

两条实现要点（在 `mc-input` 里定型，其它表单单元照抄）：

1. **初始值不能读 ofa 数据**：`ready()` 那一刻 attrs 还没铺进 `this`，要读
   `this.ele.getAttribute('default-value')`；`ready()` + `attached()` 各接一次、记账保证只生效一次。
2. **原生 `input` 先 `stopPropagation()` 再转发**：它是 composed，不拦的话宿主上会先到一条**没有 `data`**
   的原生事件，使用者按文档写 `$event.data.value` 会先抛一次；`change` 穿不出 shadow，只由组件转发。
3. **转发给内部原生元素用 `attr:`**（`disabled` 除外）：实测 `:placeholder` / `:rows`（textarea）与
   `:maxlength` / `:readonly` 不生效（IDL 名是 `maxLength` / `readOnly`）。

**校验态不用独立的错误色板**，用 `invalid` 布尔 + `--mc-color-danger`。

---

## 八、实现与草案的出入（对账用）

| 单元                        | 出入与理由                                                                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mc-progress`               | 不套表单那套 `default-value` / `value` 约定：进度条不接受输入、不参与提交、没有 `change`，它的属性就是**当前**进度（同 `mc-collapse-item` 的 `open`）；`value` / `max` 另给宿主 property 访问器。               |
| `mc-input` / `mc-textarea`  | 转发内部原生元素用 `attr:` 而不是 `:prop`（见上）；原生 `input` 转发前先 `stopPropagation()`。                                                                                                                  |
| `mc-checkbox` / `mc-switch` | 布尔态是**单一** observed 属性（`checked`）而不是 `checked` + `default-checked`：两个属性必然漂移，`mc-collapse-item` 已是先例。                                                                                |
| `mc-radio`                  | 原生「同 name 成组」跨 shadow 不成立，所以唯一真相是子项宿主上的 `checked`、由组维护；`mc-radio` 的 `checked` 是镜像 property，不进 api.md 属性表。                                                             |
| `mc-select`                 | `name` 不做原生 formAssociated（没有表单提交语义），只当字段名与内部 aria id 前缀；`multiple` 时 property 是 `string[]`、`default-value` 是逗号分隔字符串。                                                     |
| `mc-dialog`                 | `title` → **`heading`**（声明 `title` 会弹原生 tooltip）；`open` + `default-open` → **单一 `open`**；`popover="manual"` + 自绘遮罩（`auto` 的 light dismiss 在 pointerdown 就关，模态要自己决定点遮罩关不关）。 |
| `mc-dropdown`               | `placement` 沿用 `mc-popover` 的取值集合；`open` 同样是单一属性 + 宿主 property 访问器。                                                                                                                        |
| `mc-tooltip`                | `trigger="hover"` 时 **hover 与 focus 都触发**（键盘可达）；不 emit 事件（气泡是纯展示）。                                                                                                                      |
| `mc-tabs`                   | 草案没定面板怎么给：实现是「默认插槽放 `mc-tab` 标签 + `slot="panel"` 且带 `value` 的子元素当面板」，非激活面板挂 `hidden` 常驻 DOM。                                                                           |
| `mc-table`                  | `data` 撞 ofa 元素代理的保留名、**不能进 `attrs`**：只做宿主 property + 组件自己听属性；行模板放具名 `<template>` —— HTML 解析器会把 `tr` 里的自定义元素搬出去。                                                |
| `mc-grid`                   | 草案写「无插槽无 part」，但容器必须有真实 `<slot>` 才能投影子项，所以 api.md 有「插槽」一节。                                                                                                                   |
| `mc-badge` / `mc-spinner`   | 属性名 / 取值 / 默认值与草案逐字一致；只多了实现层的组件令牌（登记在各自 README 的令牌表）。                                                                                                                    |

---

## 九、逐组件接口

以各单元的 `packages/<slug>/api.md` 为准；标签与目录的对应见 [`README.md`](./README.md) 的组件索引。
