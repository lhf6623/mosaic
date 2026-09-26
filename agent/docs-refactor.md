# 文档站重构设计：数据抽离（`$.stanz`）+ 组件模板化

> **目标**：`docs/` 里不再有手写 `class Xxx extends HTMLElement`，运行时状态收进 store 模块。
> **范围**：只动文档站（`docs/` + 两个引用占位的文档页）；`packages/` 组件的对外 API 不变。
> **状态**：**阶段 0 / 1 / 2 / 3 / 4 都已落地**（见 §5）——`docs/` 里没有手写 class 组件，
> `docs/dom.js` 已删除。剩下可选的只有 `theme` store（§9-1）。实测依据见 [`research/state.md`](./research/state.md)，
> 相关坑见 [踩坑清单](pitfalls/README.md) 的 P35–P38。
> 标记：**【实测】** = 本机跑过；**【推论】** = 还没验（阶段 0 已把四条都验了，结论在 §6）。

---

## 0. TL;DR

1. **两件事合成一批做，按「垂直切片」推进**：每个切片 = 一个组件模板化 + 它消费的那个 store。
   因为它们动的是同一批文件（`doc-trail.js` / `doc-toc.js`），分两轮改等于把回归窗口开两次。
2. **数据分两层**：静态数据保持纯模块（零 `$`、零 DOM，Node 套件要 import）；运行时状态进
   `$.stanz`（懒创建，避免赌 ofa 加载顺序）。
3. **三个 store**：`route`（收益最大）/ `theme`（首帧不动）/ `palette`。
4. **三个 class 组件**：`doc-trail.js` 里两个（→ `components/crumb.html` / `components/pager.html`，纯视图，**最值得改**）、
   `doc-toc.js` 一个（→ `components/toc.html`，**半混合**：模板管结构，扫描/滚动/滚动高亮仍靠 JS）。
5. **先例已经在了**：`docs/components/nav.html` 就是从手写元素改过来的，它头部注释记了当时的收益
   （「以前得手写 `_append` 递归、`_link` 建 DOM、`syncActive` 切高亮……现在结构与数据同形」）。
6. **四条假设已验**（§6）：store 引用怎么挂、`o-fill` 局部更新不换节点、
   模板能表达布尔属性但**不能**用 `:style.<自定义属性>`、proto 里的 `this` 不是元素。
7. 迁移必然带来一个副作用：**组件模板一定带 shadow root**，`content.css` 只能作用到宿主标签，
   内部结构样式要搬进组件的 `<style>`（`docs/content.css` 的指路注释，见 :213-222 / :264-269）。
8. **另一条实测出来的硬约束**：`o-fill` / `o-if` 的内容在它们自己的 light DOM 里，
   容器的 `::slotted()` 够不到 —— 组件内部用控制流渲染条目时，别指望容器画分隔符 / 位置样式
   （阶段 1 的 `doc-crumb` 就因此丢过分隔符，见 [P38](pitfalls/09-control-flow.md)）。

---

## 1. 现状盘点

### 1.1 数据（下表是**改造前的现状**）

> `site.js` / `doc-toc.js` / `dom.js` 都已删除：右栏目录现在是 `components/toc.html`，
> 占位渲染是 `components/{cards,palette}.html`，导航订阅收在 `state/route.js`。

| 数据                      | 现在住在哪                                     | 谁读                                                                                    | 能不能进 store                |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------- |
| 导航树 + 派生查询         | [`site-map.js`](./../docs/site-map.js)         | `layout.html`、`components/{nav,crumb,pager,cards}.html`、**测试入口 + 4 个 Node 套件** | ❌ 必须保持纯模块（§2）       |
| 当前路由                  | `routes.js:36` 每次从 `location.hash` 重算     | 同上 + `site.js:176`                                                                    | ✅ `route` store              |
| 主题（三态 + 持久化）     | `theme-boot.js:8`（首帧）、`layout.html:66-83` | 外壳按钮；所有组件经令牌                                                                | ⚠️ 只有运行时部分             |
| 色板（解析 `tokens.css`） | `docs/components/palette.html`                 | 设计令牌页的 `<doc-palette>`                                                            | ✅ 组件内自包含（不做 store） |
| 右栏目录 active           | `doc-toc.js`（滚动位置算）                     | 只有它自己                                                                              | ❌ 纯局部状态                 |
| 占位渲染                  | `site.js:94-213`                               | 组件总览卡片 / 色板 / ~~计数~~                                                          | ➡️ 改成组件（§4.3）           |

### 1.2 「跟着路由走」原来挂了 5 处（**阶段 1 已收口**）

| 位置（改造前）                             | 怎么接                         | 干什么                | 现在                               |
| ------------------------------------------ | ------------------------------ | --------------------- | ---------------------------------- |
| `layout.html:32`                           | ofa 生命周期 `routerChange()`  | 顶栏高亮              | 订阅 store（钩子与轮询都删了）     |
| `components/nav.html`（原 `doc-nav.html`） | `hashchange` + `router-change` | 左栏行重算            | 订阅 store                         |
| `doc-trail.js:33`                          | 同上（`DocCrumb`）             | 面包屑                | 文件删除 → `components/crumb.html` |
| `doc-trail.js:72`                          | 同上（`DocPager`）             | 翻页                  | 文件删除 → `components/pager.html` |
| `site.js:261`                              | 同上                           | 换页复位 + 占位重渲染 | 订阅 store                         |

→ 原来 8 个监听 + 1 个钩子，现在**只剩 `docs/state/route.js` 里一处**
（`hashchange` + `router-change`），P28 只需记在那一个文件里。

### 1.3 还在手写 class 的组件（**阶段 1 已迁完两个**）

| 文件           | 类                      | 行数 | 职责                                                                  | 状态                                                        |
| -------------- | ----------------------- | ---- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| `doc-trail.js` | `DocCrumb` / `DocPager` | 120  | 从导航数据派生面包屑 / 翻页，`el()` 建 DOM                            | ✅ 已删 → `components/crumb.html` / `components/pager.html` |
| `doc-toc.js`   | `DocToc`                | 212  | 扫标题建目录、扁平树找滚动容器（P34）、滚动高亮、点击程序化滚动、防抖 | ✅ 已删 → `components/toc.html`（结构进模板，逻辑留 JS）    |

---

## 2. 目标架构

```
docs/
├── site-map.js    静态数据 + 纯查询（零 $、零 DOM）—— Node 套件直接 import
├── routes.js      纯转换（hashOf / repoPathOf / toRepoPath）
├── theme-boot.js  首帧同步脚本（不动，P25）
├── state/         $.stanz store（懒创建）
│   ├── route.js   ✅ 已落地：唯一的导航信号源（+ onRouteChange 订阅表）
│   └── theme.js   ⏳ 可选（现在主题还在 layout.html + theme-boot.js 里，够用）
├── components/    文档站自己的组件：**文件名 + `doc-` 前缀 = 标签名**（与 packages/ 的 mc- 同一条规则）
│   ├── nav.html    ✅ doc-nav：左栏二级菜单
│   ├── toc.html    ✅ doc-toc：右栏本页目录（结构进模板，扫描/滚动/高亮留 JS）
│   ├── crumb.html  ✅ doc-crumb：页头面包屑
│   ├── pager.html  ✅ doc-pager：页尾翻页
│   ├── cards.html  ✅ doc-cards：组件总览的卡片墙
│   └── palette.html ✅ doc-palette：设计令牌页的色板
├── doc-layout.html / layout.html   布局页（页面模块，本来就带 <template page>）
├── content.css    只留宿主级样式（每页 <link>）
└── （docs/site.js 已删除：滚轮接力 + 换页复位并入外壳 docs/layout.html；
                    docs/dom.js 也删了 —— 三个使用者分别改成模板 / 数据 / 组件）
```

三条边界：

1. **Node 套件是硬约束**：`tests/smoke.mjs:19`、`tests/site/10-nav-data.mjs:17`（还有 `02/05/06`）
   直接 import `site-map.js`；`10-nav-data.mjs` 完全不启浏览器。
   → 静态导出签名不能变，模块里不能出现 `$`。
2. **`routes.js` 顶层就摸 DOM**（`routes.js:7` 读 `document.baseURI`），别让 `site-map.js` 去 import 它。
3. **store 懒创建**（`$.stanz` 放在 `start()` / 首次取用里），模块本身任何环境可 import。

---

## 3. 数据抽离：三个 store

### 3.1 `docs/state/route.js`（先做）

```js
// store 形状
{ path: '', entry: null, node: null, hidden: false }

export function routeState()          // 首次调用时创建（懒）
export function startRouteTracking() // 挂 hashchange + router-change，幂等，只挂一次
```

- **唯一写入口**：`track()` 里 `route()` → `locate()` → 写一次；其余只读。
- **消费方**：ofa 组件（layout 顶栏 / doc-nav / 新 doc-crumb / doc-pager）把 **store 引用**挂进 `data`；
  没有视图的脚本用 `onRouteChange()` 订阅。
- **换页复位**（`site.js:255` 的滚回顶部）算路由的副作用，收进订阅侧。

### 3.2 `docs/state/theme.js`

```js
{ mode: 'auto' | 'light' | 'dark' }
export function themeState()
export function cycleTheme()  // auto → light → dark：写 store + documentElement + localStorage
export function startTheme()  // 从 localStorage 读初值（规则与 theme-boot.js 一致）
```

`theme-boot.js` **一行不动**（head 里的同步经典脚本，防首帧闪色）；两处共用同一个键与
「非法值 → 跟随系统」规则，注释里互相指认。

### 3.3 `docs/state/palette.js`

```js
{ rows: [], status: 'idle' | 'loading' | 'ready' | 'error' }
export function paletteState()
export function loadPalette()   // 懒加载 + 缓存；多消费方共享一次解析
export const relativeLuminance  // 纯函数，可被 Node 测试（可选）
```

### 3.4 不抽

- `site-map.js` 的树与查询；`routes.js` 的纯转换；`doc-toc` 的滚动 active；`theme-boot.js`。

### 3.5 什么时候才值得抽 store（为什么只落了 `route` 一个）

设计稿列了三个 store，最后只落了 `route` —— 这不是漏做，是同一个门槛筛下来的结果：

| 候选      | 消费方                                                       | 写入口                  | 结论      |
| --------- | ------------------------------------------------------------ | ----------------------- | --------- |
| `route`   | 5 个（顶栏 / 左栏 / 面包屑 / 翻页 / 站点脚本）               | 浏览器地址栏（唯一）    | ✅ 抽     |
| `theme`   | JS 侧只有外壳按钮 1 个；组件侧靠 `data-theme` + CSS 变量继承 | 外壳按钮 + localStorage | ❌ 暂不抽 |
| `palette` | 1 个（设计令牌页的 `<doc-palette>`）                         | 无（纯派生）            | ❌ 不抽   |

**门槛**：多消费方 **且** 单一写入口 **且** 每个消费方都得自己重复解决同一个坑。

- `route` 三条都占：抽之前 5 处各自挂 `hashchange` + `router-change`（每处都要记得 P28），
  抽之后监听只在一处、消费方只订阅。
- `theme` 不占第一条：主题的对外契约是 **DOM 属性 + CSS 变量**（任何宿主页面都成立），
  组件必须能脱离文档站工作 —— `mc-code` 就是直接观察 `document.documentElement` 的 `data-theme`
  （`packages/code/code.html` 的 MutationObserver + `matchMedia`），**不可能**去 import
  `docs/state/theme.js`。于是 docs 侧的 store 只会被一个按钮用，还要把 `theme-boot.js`
  （首帧同步脚本，P25 不能动）已经实现过的 localStorage 规则再实现一遍。
- `palette` 第一条、第三条都不占：一个消费方、无写入，留在消费方自己那里最省。

**抽 store 不是免费的**：模块要懒创建（不能赌 ofa 的加载顺序）、要自己维护订阅与退订
（`$.stanz` 的 `watch` 退订语义没有官方说明，`route` 因此自建了订阅表）、多一个模块边界与
「谁写」的约定，还要多防一次 P36（数组内核）/ P39（保留名）那类形状坑 —— 只有一个读者时全是开销。

**将来什么时候该抽 `theme`**：出现第二个 JS 写入方（页面内主题预览、按页覆盖主题），
或需要把「三态 + 解析后的实际主题」派发给多个组件时。届时 `theme-boot.js` 仍然保持同步脚本不动，
只把「读 localStorage + 应用」这条规则抽成共享函数、两处注释互指（别破坏 P25 的防闪色）。

---

## 4. 组件模板化：怎么改

### 4.0 迁移配方（class 写法 → ofa 组件模板）

| class 写法                                      | 组件模板写法                                                         | 注意                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `connectedCallback()`                           | `ready()`（shadow 建好）/ `attached()`（适合挂全局监听）/ `loaded()` | 构造期不能写宿主属性（P31）→ 全局监听放 `attached()`                       |
| `disconnectedCallback()`                        | `detached()`                                                         | 必须摘监听（同 doc-nav 的教训）                                            |
| `this.replaceChildren(...)` + `el()` / `attr()` | 模板 + `o-fill` / `o-if` / `attr:` / `:style.`                       | `o-fill` 一定写 `fill-key`；内部只能用 `$data/$index/$host`（P11）         |
| `menu.addEventListener('click', …)`             | 模板里 `on:click="方法"`                                             | 也可保留 shadowRoot 上的委托（见 §4.2）                                    |
| `this.querySelector()` / `this.getRootNode()`   | **`this.ele.xxx`**                                                   | proto 里的 `this` 是 **ofa 实例**，元素 API 全要走 `this.ele`（阶段 0 验） |
| 箭头函数字段保存监听引用                        | `attached()` 里 `this._onScroll = () => …` 再 add/remove             | add / remove 必须是同一个引用                                              |
| `customElements.define(tag, Class)`             | 外壳里一行 `<l-m src="./x.html">`                                    | 注册点决定升级时机（见 §4.1 注意）                                         |
| `content.css` 里的标签选择器                    | 宿主级留在 `content.css`，**内部结构样式搬进组件 `<style>`**         | 组件模板必然带 shadow root（`docs/content.css` 的指路注释已记过）          |

### 4.1 切片一：`doc-trail.js` → `components/crumb.html` + `components/pager.html`

一个文件两个 class → ofa 一个文件一个 `tag`，所以拆两个文件：

```html
<!-- docs/components/crumb.html（示意） -->
<template component>
  <mc-breadcrumb>
    <o-fill :value="levels" fill-key="path">
      <mc-breadcrumb-item attr:current="$data.current ? '' : null">
        <a attr:href="$data.href" attr:aria-current="$data.current ? 'page' : null"
          >{{$data.label}}</a
        >
      </mc-breadcrumb-item>
    </o-fill>
  </mc-breadcrumb>
  <script>
    import { routeState } from './state/route.js';
    export default () => ({
      tag: 'doc-crumb',
      data: { levels: [] },
      attached() {
        this.unwatch = routeState().watch(() => this.renderLevels());
      },
      detached() {
        this.unwatch?.();
      },
      proto: {
        renderLevels() {
          /* nodes/hidden → levels */
        },
      },
    });
  </script>
</template>
```

- **要盯的三件小事**：
  1. **布尔属性绑定**：`attr:current="… ? '' : null"`（null 不写属性）—— doc-nav 的
     `attr:aria-current="$data.aria"` 已是同款写法（非当前项为 `null`），照抄。
  2. **注册点**：现在 `site.js:251` 调 `defineDocTrail()`；改成外壳 `docs/layout.html` 里
     `<l-m src="./components/crumb.html">`（与 `doc-nav` 同一处，`layout.html:267`）。
     ⚠️ 页面模板里的 `<doc-crumb>` 可能比注册早一步挂上 —— 元素会延后升级，但
     **它自己渲染出来的东西这时还不存在**；doc-trail 注释里那条「挂载那一刻 hash 未必落」
     的教训要一起考虑（延后升级 = 更晚拿到数据，方向是安全的）。
  3. **样式搬迁**：`doc-pager` / `.doc-pager-prev` / `.doc-pager-next` 已搬进
     `docs/components/pager.html:13-31` 的 `<style>`；`doc-crumb` 只剩一条 margin，
     留在 `docs/components/crumb.html:18-21`。
- **顺带删掉**：两个 class 里的 `hashchange` / `router-change` 监听与 `_route` 签名守卫
  （数据变化由 store 驱动，不需要自己比对路由）。

**✅ 实际落地（阶段 1）**：`doc-trail.js` 已删，两个组件在 `layout.html` 用 `<l-m>` 注册。
**踩到一条新坑**：`doc-crumb` 一开始用 `o-fill` 逐级铺 `mc-breadcrumb-item`，而 `mc-breadcrumb`
的分隔符走 `::slotted()` —— 条目被 `o-fill` 包了一层就匹配不到，分隔符**静默消失**
（`o-fill` 是 `display: contents`，布局看着完全正常）。改成「两级直接写开 + 属性钩子控制整块显隐」
才修好，并收成 [P38](pitfalls/09-control-flow.md) + 一条断言（`docCrumb.before` 必须是 `['none', '"/"']`）。

### 4.2 切片二：`doc-toc.js` → `components/toc.html`（半混合，风险最高）

模板只接 DOM 构建那一段，硬逻辑原样留在模块里：

```html
<template component>
  <mc-menu size="sm">
    <mc-menu-item group>本页目录</mc-menu-item>
    <o-fill :value="entries" fill-key="id">
      <mc-menu-item>
        <a
          attr:href="'#' + $data.id"
          attr:data-toc-id="$data.id"
          attr:aria-current="$data.aria"
          on:click="onItemClick"
          >{{$data.label}}</a
        >
      </mc-menu-item>
    </o-fill>
  </mc-menu>
</template>
```

**留在 JS 的部分（一行都不能少）**：`contentRoot()`（slot → `O-PAGE` → shadowRoot）、
`bindContent()`（slotchange + MutationObserver）、`rebuild()` 的**签名守卫**（`this._signature`
没变不碰 DOM）、`scroller()` 的**扁平树遍历**（P34）、`syncActive()`、防抖、`resize` 监听。

**两条高亮路线，阶段 0 判定**：

| 路线     | 做法                                                                             | 风险                                                                              |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A 纯声明 | 改 `entries[i].aria`，靠 `o-fill` 就地更新一个属性                               | 滚动时高频改数据；若 `o-fill` 换节点，点击会落在不同节点上（04 套件防的就是这个） |
| B 混合   | 结构交给模板，`syncActive()` 仍用 `setCurrent()` 直接切锚点属性（阶段 1 的现状） | 保留 `dom.js` 依赖，但零行为变化                                                  |

默认 **B**（先不改行为）落地；阶段 2 删 `dom.js` 时已切成 **A**（见 §9-2 与 §5 阶段 2 行）——
阶段 0 已验 `o-fill` 在数据**局部变化**时复用节点，所以 A 在「不毁节点」这条上成立，
依据记在 `components/toc.html` 注释里，护栏是 04 / 09 两条套件。

**h3 缩进**：原来是 `item.style.setProperty('--mc-menu-pad-x', …)`（`doc-toc.js:151`）。
`:style.<自定义属性>` 经实测**不可用**（静默失效），所以走已验证的替代写法：
模板里给条目挂数据属性（`attr:data-level="$data.deep ? 'deep' : null"`），组件自己的 `<style>` 发自定义属性 ——

```css
mc-menu-item[data-level='deep'] {
  --mc-menu-pad-x: calc(var(--mc-space-3) * 2);
}
```

（`components/nav.html` 的 `a[data-status='planned']` 就是同款做法；组件 `<style>` 能命中 `o-fill`
渲染出来的条目，因为它们在同一个 shadow 树里。）

**⚠️ `this` 语义**：`contentRoot()` 里的 `this.getRootNode()` 迁过去会直接坏
（ofa 实例上没有 `getRootNode`），要写成 `this.ele.getRootNode()`。这条是整份配方里最容易踩的。

### 4.3 切片三：占位 → `components/palette.html` / `components/cards.html`（✅ 已落地）

- 两个消费者：`docs/pages/components.html:34` 的 `[data-component-cards="all"]`、
  `packages/color/page.html:56` 的 `[data-palette]`，各换成一个组件标签。
- 收益：`site.js` 的**轮询机制**（`RENDER_POLL_*` / `scheduleRender` / `isRoutedPageMounted`，
  `site.js:168-213`）随之可以删掉大头 —— 异步性交给组件自己的生命周期。
- **顺手清死代码**：`[data-component-count]`（`site.js:157`）在全仓没有任何生产者。
- 验收：`--site 01 03 06`。
- **实际落地**：两个组件都落地，占位机制（`[data-palette]` / `[data-component-cards]` 标记、
  `dataset.rendered` 幂等、`RENDER_POLL_*` 轮询、`isRoutedPageMounted()`）整段删掉，
  `[data-component-count]` 那个全仓没有生产者的死分支也一并清掉。
  **没有做 `state/palette.js`**：色板只有设计令牌页一个消费方，放进组件自包含更简单
  （将来真有第二个消费方再抽 store 不迟）。两块样式（`.doc-palette*` / `.doc-swatch`、
  `.doc-comp-*`）从 `content.css` 搬进了各自的 `<style>`（组件自带 shadow root，外面够不到）。

### 4.4 切片四：`layout.html` 顶栏模板化（✅ 已落地）

`renderTopNav()` + `syncTopNav()`（`layout.html:45-60`）改成 `o-fill` + `attr:aria-current`，
与 doc-nav 同构。硬约束不变：**只切 `aria-current`、绝不重建 DOM**（真人点击的 mousedown/click
必须落在同一节点上）—— 这正是 doc-nav 用 `o-fill` + `fill-key` 做到的，验收跑 `--site 04`。
**实际落地**：`renderTopNav()` 没了，入口在 `ready()` 里拼成 `data.links`；`syncTopNav()`
只改 `links[i].aria` 这一个字段（阶段 0 已证 o-fill 局部改数据复用节点），`el()` / `setCurrent()`
随之从 layout 里消失。`data.links` 这个键名实测安全（`entries` 才是保留名，见 P39）。

### 4.5 不改的

`theme-boot.js`（首帧）、`site-map.js` / `routes.js` 的纯函数部分、`components/nav.html`（已是模板）。

---

## 5. 顺序：垂直切片（每片 = 一个组件 + 它消费的 store）

| 阶段 | 内容                                                                             | 验收（套件范围）                             | 状态 |
| ---- | -------------------------------------------------------------------------------- | -------------------------------------------- | ---- |
| 0    | 验 §6 的四条假设（一次性探针，不入库）                                           | 探针结果补进 `research/state.md`             | ✅   |
| 1    | `state/route.js` + `components/crumb.html` / `components/pager.html`（一次改完） | `--site 01 02 04 05 08 09` + Breadcrumb 套件 | ✅   |
| 2    | `components/toc.html` 模板化（高亮走 A：数据驱动，改 `rows[i].aria`）            | `--site 04 09`                               | ✅   |
| 3    | 两个占位组件 + `site.js` 瘦身（两个 store 都没抽，理由见 §3.5）；                |

       收尾把 site.js 并入外壳后删除 | `--site 01 03 06`                            | ✅   |

| 4 | `layout.html` 顶栏 + 清理注释 / README / `dom.js` 删除 | 收尾**全量一次** | ✅ |

每片都能单独回滚（新文件删掉 + 还原 1–2 个文件），不要跨片混提交。

**阶段 1 的结果**：`--site 01 02 04 05 08 09` 64/64 + Breadcrumb 套件 20/20。
验收面扩大了一条（原计划只 02/04/08）：改动落在 `layout.html` / `components/nav.html` / `site.js`
三个「全站共用」文件上，外壳与文档页也在影响半径里。

**阶段 3 / 4 的结果**（与 `dom.js` 删除同批）：`--site 01 02 04 05 06 08 09` + breadcrumb 全绿
（见提交信息里的实测数字）。一个**行为变化要记住**：`doc-cards` 组件化后，卡片墙的分组标题住进了
它的 shadow root，**右栏目录不再收录它们**（目录只扫页面自己的 h2/h3），组件总览页目录从 12 项
变成 7 项 —— 这是「组件自带 shadow root」的必然代价，接受。同时给 `doc-toc` 补了**点击固定**：
点目录项后先点亮该项、暂时不参与 scroll-spy，用户自己滚（滚轮 / 触摸 / 按键）再交还
（判定带 240px，否则点短小节时下一节会把高亮抢走）。

**阶段 2 的结果**：`--site 04 09` 17/17。两个坑值得记：
① **[P39](pitfalls/01-props.md)**：`data: { entries: … }` 是保留键，整个组件不渲染，
报错只有 `Failed to render the tag 'doc-toc'` —— 我先怀疑模板绕了三轮，最后靠二分 `data` 的键收敛；
② 模板渲染是异步的，高亮必须在条目出现后再切 —— `$.nextTick()` 不够（首次 rebuild 时
`mc-menu` 还没升级完），最终给**子页面**的 shadow root（`contentRoot()` 的返回值）挂 `childList`
观察者，与「签名没变就提前返回」的 settle 重试解耦。

---

## 6. 阶段 0：四条假设的实测结论（**已验**）

| #   | 假设                                                    | 结论                                                                                                |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | ofa `data` 里挂 **store 引用**能跟随，挂原始值快照不能  | ✅ 成立：引用随 store 变，快照停在原值 → 消费方**挂引用**，不要拷贝原始值                           |
| 2   | `o-fill` 数据**局部变化**是否复用节点                   | ✅ **不换节点**（整体换数组、`fill-key` 相同也复用）→ 滚动高亮可以走声明式（A）                     |
| 3   | 模板能表达 `attr:布尔` 与 `:style.<自定义属性>`         | ⚠️ 布尔 ✅（`''` 写 / `null` 不写）；**`:style.<自定义属性>` ❌ 静默失效**；标准属性只认 kebab-case |
| 4   | proto 里 `this` 是 ofa 实例，元素 API 必须走 `this.ele` | ✅ 成立（`this.getRootNode` 是 `undefined`）→ 配方里所有元素 API 显式走 `this.ele`                  |

> 完整记录（含复现步骤）见 [`research/state.md` §6](./research/state.md)。
> 另外顺带验出 [P37](pitfalls/08-state.md)（初值形状 → 首帧报错）与
> [P38](pitfalls/09-control-flow.md)（控制流元素挡住 `::slotted()`，阶段 1 真的踩了）。

---

## 7. 风险与对策

| 风险                                  | 后果                                                    | 对策                                                                           |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Node 套件 import 到带 `$` 的模块      | `smoke.mjs` / `10-nav-data.mjs` 起不来                  | 静态数据保持纯模块；store 懒创建                                               |
| `attached()` 挂载时 data 初值形状不对 | 首帧 `Error evaluating text expression`（P37，半静默）  | `data: { levels: [] }` 这类同形状初值；模板只在有值时读                        |
| 组件模板带 shadow root                | `content.css` 够不到内部结构，样式静默失效              | 内部样式搬进组件 `<style>`；宿主级才留 `content.css`（doc-nav 先例）           |
| `o-fill` 换节点                       | 真人点击 mousedown/click 落到两个节点（「要点好几次」） | 一定给 `fill-key`；`--site 04` 是护栏；阶段 0 已验「局部改数据不换节点」       |
| 控制流元素挡住容器的 `::slotted()`    | 分隔符 / 间距 / 位置样式**静默消失**（布局却正常，P38） | 组件的条目直接写开；位置相关的视觉放条目自己身上；断言 `::before` 的 `content` |
| 注册点从 `site.js` 挪到外壳 `<l-m>`   | 升级时机变化 → 首屏短暂空白 / 拿到旧路由                | 保持「数据从 store 来」；必要时保留「没数据就不渲染」的守卫                    |
| 滚动高亮高频写数据                    | 目录项频繁重建、点击丢失                                | 走 A（数据驱动 `rows[i].aria`）；阶段 0 已证节点复用，`--site 04` 是护栏       |
| 切页重建组件导致监听重复挂            | 重复渲染 / 泄漏                                         | `startRouteTracking()` 幂等；组件侧 `watch` 退订、`detached()` 清理            |
| 首帧主题被 store 拖成异步             | 闪色（P25）                                             | `theme-boot.js` 不动                                                           |
| `$.stanz({})` 是数组内核（P36）       | `Array.isArray(store)` 误判                             | 不用它判分支；store 只当数据容器                                               |
| 改造顺手改了测试断言「让它绿」        | 护栏失效                                                | 既有断言（04/09/06 等）只允许因**行为约定变化**而改，并在提交信息里说明        |

---

## 8. 验收清单

- [x] `grep -rn "extends HTMLElement" docs/ packages/` **归零**，并做成守卫：
      `tests/site/11-no-class-components.mjs`（node-only，违反即红）。
- [x] `content.css` 里不再有组件内部结构的样式（翻页那几条已搬进 `components/pager.html`）。
- [ ] `tests/site/10-nav-data.mjs` 仍能**不启浏览器**跑通（改 `site-map.js` 时必查）。
- [x] 每阶段绑定套件绿；收尾全量一次绿（阶段 1–4 全部落地，收尾全量已绿）。
- [x] **`docs/dom.js` 已删除**：三个使用者分别改成 模板（layout 顶栏）/ 数据（doc-toc 高亮）/ 组件（色板与卡片）。
- [x] 写法约定写进 [`authoring.md` §四](./authoring.md)：ofa 的 MVVM 面（M/V/VM 对照 + 与经典 MVVM 的四处差别）+ 「手写 class 要自己重做哪些东西」的逐条对照 + 边界（页面级行为写普通模块）。
- [x] `agent/` 里同步：本文件、`research/state.md` 的【实测】结论、README 索引。

---

## 9. 已定的选择与唯一剩项

> 1–4 都已有定论，留在这里只做记录。

1. **顺序**：按「垂直切片」推进（每个组件和它消费的 store 一次改完）—— 阶段 1–4 都是这么做的。
2. **`doc-toc` 高亮**：先按路线 B（命令式）落地；删除 `dom.js` 时改成**数据驱动**
   （`rows[i].aria`，阶段 0 已证 o-fill 复用节点），并补了「点击固定」。
3. **切片 3 / 4**：都做了（占位组件 + 顶栏模板化 + `site.js` 瘦身 + `dom.js` 删除）。
4. **命名**：`docs/state/`、`agent/docs-refactor.md` 已按此落地。

**唯一剩项（可选）**：`state/theme.js`。JS 侧的**写入方**只有外壳按钮一个（组件侧读的是
`document.documentElement[data-theme]`，不可能依赖文档站模块）；抽 store 的触发条件与取舍见 §3.5。
