# 文档站重构设计：数据抽离（`$.stanz`）+ 组件模板化

> **目标**：`docs/` 里不再有手写 `class Xxx extends HTMLElement`，运行时状态收进 store 模块。
> **范围**：只动文档站（`docs/` + 两个引用占位的文档页）；`packages/` 组件的对外 API 不变。
> **状态**：**阶段 0、阶段 1 已落地**（见 §5）。实测依据见 [`research/state.md`](./research/state.md)，
> 相关坑见 [`ofa-pitfalls.md`](./ofa-pitfalls.md) 的 P35–P38。
> 标记：**【实测】** = 本机跑过；**【推论】** = 还没验（阶段 0 已把四条都验了，结论在 §6）。

---

## 0. TL;DR

1. **两件事合成一批做，按「垂直切片」推进**：每个切片 = 一个组件模板化 + 它消费的那个 store。
   因为它们动的是同一批文件（`doc-trail.js` / `doc-toc.js`），分两轮改等于把回归窗口开两次。
2. **数据分两层**：静态数据保持纯模块（零 `$`、零 DOM，Node 套件要 import）；运行时状态进
   `$.stanz`（懒创建，避免赌 ofa 加载顺序）。
3. **三个 store**：`route`（收益最大）/ `theme`（首帧不动）/ `palette`。
4. **三个 class 组件**：`doc-trail.js` 里两个（→ `doc-crumb.html` / `doc-pager.html`，纯视图，**最值得改**）、
   `doc-toc.js` 一个（→ `doc-toc.html`，**半混合**：模板管结构，扫描/滚动/滚动高亮仍靠 JS）。
5. **先例已经在了**：`docs/doc-nav.html` 就是从手写元素改过来的，它头部注释记了当时的收益
   （「以前得手写 `_append` 递归、`_link` 建 DOM、`syncActive` 切高亮……现在结构与数据同形」）。
6. **四条假设已验**（§6）：store 引用怎么挂、`o-fill` 局部更新不换节点、
   模板能表达布尔属性但**不能**用 `:style.<自定义属性>`、proto 里的 `this` 不是元素。
7. 迁移必然带来一个副作用：**组件模板一定带 shadow root**，`content.css` 只能作用到宿主标签，
   内部结构样式要搬进组件的 `<style>`（doc-nav 踩过，`content.css:597` 留了注释）。
8. **另一条实测出来的硬约束**：`o-fill` / `o-if` 的内容在它们自己的 light DOM 里，
   容器的 `::slotted()` 够不到 —— 组件内部用控制流渲染条目时，别指望容器画分隔符 / 位置样式
   （阶段 1 的 `doc-crumb` 就因此丢过分隔符，见 [P38](./ofa-pitfalls.md)）。

---

## 1. 现状盘点

### 1.1 数据

| 数据                      | 现在住在哪                                     | 谁读                                                                                              | 能不能进 store          |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------- |
| 导航树 + 派生查询         | [`site-map.js`](./../docs/site-map.js)         | `layout.html:8`、`doc-nav.html:63`、`doc-trail.js:21`、`site.js:7`、**测试入口 + 4 个 Node 套件** | ❌ 必须保持纯模块（§2） |
| 当前路由                  | `routes.js:36` 每次从 `location.hash` 重算     | 同上 + `site.js:176`                                                                              | ✅ `route` store        |
| 主题（三态 + 持久化）     | `theme-boot.js:8`（首帧）、`layout.html:66-83` | 外壳按钮；所有组件经令牌                                                                          | ⚠️ 只有运行时部分       |
| 色板（解析 `tokens.css`） | `site.js:28-92`                                | 设计令牌页的 `[data-palette]`                                                                     | ✅ `palette` store      |
| 右栏目录 active           | `doc-toc.js`（滚动位置算）                     | 只有它自己                                                                                        | ❌ 纯局部状态           |
| 占位渲染                  | `site.js:94-213`                               | 组件总览卡片 / 色板 / ~~计数~~                                                                    | ➡️ 改成组件（§4.3）     |

### 1.2 「跟着路由走」原来挂了 5 处（**阶段 1 已收口**）

| 位置（改造前）     | 怎么接                         | 干什么                | 现在                           |
| ------------------ | ------------------------------ | --------------------- | ------------------------------ |
| `layout.html:32`   | ofa 生命周期 `routerChange()`  | 顶栏高亮              | 订阅 store（钩子与轮询都删了） |
| `doc-nav.html:110` | `hashchange` + `router-change` | 左栏行重算            | 订阅 store                     |
| `doc-trail.js:33`  | 同上（`DocCrumb`）             | 面包屑                | 文件删除 → `doc-crumb.html`    |
| `doc-trail.js:72`  | 同上（`DocPager`）             | 翻页                  | 文件删除 → `doc-pager.html`    |
| `site.js:261`      | 同上                           | 换页复位 + 占位重渲染 | 订阅 store                     |

→ 原来 8 个监听 + 1 个钩子，现在**只剩 `docs/state/route.js` 里一处**
（`hashchange` + `router-change`），P28 只需记在那一个文件里。

### 1.3 还在手写 class 的组件（**阶段 1 已迁完两个**）

| 文件           | 类                      | 行数 | 职责                                                                  | 状态                                          |
| -------------- | ----------------------- | ---- | --------------------------------------------------------------------- | --------------------------------------------- |
| `doc-trail.js` | `DocCrumb` / `DocPager` | 120  | 从导航数据派生面包屑 / 翻页，`el()` 建 DOM                            | ✅ 已删 → `doc-crumb.html` / `doc-pager.html` |
| `doc-toc.js`   | `DocToc`                | 212  | 扫标题建目录、扁平树找滚动容器（P34）、滚动高亮、点击程序化滚动、防抖 | ⏳ 阶段 2                                     |

---

## 2. 目标架构

```
docs/
├── site-map.js    静态数据 + 纯查询（零 $、零 DOM）—— Node 套件直接 import
├── routes.js      纯转换（hashOf / repoPathOf / toRepoPath）
├── theme-boot.js  首帧同步脚本（不动，P25）
├── state/         $.stanz store（懒创建）
│   ├── route.js   ✅ 已落地：唯一的导航信号源（+ onRouteChange 订阅表）
│   ├── theme.js   ⏳ 阶段 3
│   └── palette.js ⏳ 阶段 3
├── doc-nav.html   组件模板（已迁完）
├── doc-crumb.html / doc-pager.html                    ✅ 已落地
├── doc-toc.html / doc-palette.html / doc-cards.html   ⏳ 阶段 2 / 3
├── doc-layout.html / layout.html   布局页（页面模块，本来就带 <template page>）
├── content.css    只留宿主级样式（每页 <link>）
└── site.js        瘦成「滚轮接力 + 引导」，或彻底消失（阶段 3 再动）
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
  普通脚本（site.js）用 `watch()` 退回订阅。
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
| `content.css` 里的标签选择器                    | 宿主级留在 `content.css`，**内部结构样式搬进组件 `<style>`**         | 组件模板必然带 shadow root（`content.css:597` 已记过）                     |

### 4.1 切片一：`doc-trail.js` → `doc-crumb.html` + `doc-pager.html`

一个文件两个 class → ofa 一个文件一个 `tag`，所以拆两个文件：

```html
<!-- docs/doc-crumb.html（示意） -->
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
     `<l-m src="./doc-crumb.html">`（与 `doc-nav` 同一处，`layout.html:217`）。
     ⚠️ 页面模板里的 `<doc-crumb>` 可能比注册早一步挂上 —— 元素会延后升级，但
     **它自己渲染出来的东西这时还不存在**；doc-trail 注释里那条「挂载那一刻 hash 未必落」
     的教训要一起考虑（延后升级 = 更晚拿到数据，方向是安全的）。
  3. **样式搬迁**：`content.css:391-405` 的 `doc-pager` / `.doc-pager-prev` / `.doc-pager-next`
     搬进 `doc-pager.html` 的 `<style>`（宿主 `:host` 上）。`doc-crumb`（`content.css:356`）
     只剩一条 margin，留外面没问题。
- **顺带删掉**：两个 class 里的 `hashchange` / `router-change` 监听与 `_route` 签名守卫
  （数据变化由 store 驱动，不需要自己比对路由）。

**✅ 实际落地（阶段 1）**：`doc-trail.js` 已删，两个组件在 `layout.html` 用 `<l-m>` 注册，
`content.css` 的翻页样式搬进了组件；顶栏（`layout.html`）、左栏（`doc-nav.html`）、
`site.js` 三处也都改成订阅 `state/route.js`。**踩到一条新坑**：`doc-crumb` 一开始用
`o-fill` 逐级铺 `mc-breadcrumb-item`，而 `mc-breadcrumb` 的分隔符走 `::slotted()` ——
条目被 `o-fill` 包了一层，`::slotted()` 就匹配不到，分隔符**静默消失**
（`o-fill` 是 `display: contents`，布局看着完全正常）。改成「两级直接写开 + 属性钩子控制整块显隐」
才修好，并收成 [P38](./ofa-pitfalls.md) + 一条断言（`docCrumb.before` 必须是 `['none', '"/"']`）。

### 4.2 切片二：`doc-toc.js` → `doc-toc.html`（半混合，风险最高）

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
`bindContent()`（slotchange + MutationObserver）、`render()` 的**签名守卫**（标题没变不碰 DOM）、
`scroller()` 的**扁平树遍历**（P34）、`syncActive()`、防抖、`resize` 监听。

**两条高亮路线，阶段 0 判定**：

| 路线     | 做法                                                                    | 风险                                                                              |
| -------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A 纯声明 | 改 `entries[i].aria`，靠 `o-fill` 就地更新一个属性                      | 滚动时高频改数据；若 `o-fill` 换节点，点击会落在不同节点上（04 套件防的就是这个） |
| B 混合   | 结构交给模板，`syncActive()` 仍用 `setCurrent()` 直接切锚点属性（现状） | 保留 `dom.js` 依赖，但零行为变化                                                  |

默认 **B**（先不改行为）。阶段 0 已验：`o-fill` 在数据**局部变化**时复用节点（也支持整体换数组，
只要 `fill-key` 相同），所以 A 在「不毁节点」这条上是成立的；阶段 2 可以试 A，
但要在 `doc-toc.html` 注释里记下依据，并跑 04 / 09 两条套件。

**h3 缩进**：现在是 `item.style.setProperty('--mc-menu-pad-x', …)`（`doc-toc.js:151`）。
`:style.<自定义属性>` 经实测**不可用**（静默失效），所以走已验证的替代写法：
模板里给条目挂数据属性（`attr:data-level="$data.level"`），组件自己的 `<style>` 发自定义属性 ——

```css
mc-menu-item[data-level='3'] {
  --mc-menu-pad-x: calc(var(--mc-space-3) * 2);
}
```

（`doc-nav.html` 的 `a[data-status='planned']` 就是同款做法；组件 `<style>` 能命中 `o-fill`
渲染出来的条目，因为它们在同一个 shadow 树里。）

**⚠️ `this` 语义**：`contentRoot()` 里的 `this.getRootNode()` 迁过去会直接坏
（ofa 实例上没有 `getRootNode`），要写成 `this.ele.getRootNode()`。这条是整份配方里最容易踩的。

### 4.3 切片三（可选）：占位 → `doc-palette.html` / `doc-cards.html`

- 两个消费者：`docs/pages/components.html:34` 的 `[data-component-cards="all"]`、
  `packages/color/page.html:56` 的 `[data-palette]`，各换成一个组件标签。
- 收益：`site.js` 的**轮询机制**（`RENDER_POLL_*` / `scheduleRender` / `isRoutedPageMounted`，
  `site.js:168-213`）随之可以删掉大头 —— 异步性交给组件自己的生命周期。
- **顺手清死代码**：`[data-component-count]`（`site.js:157`）在全仓没有任何生产者。
- 验收：`--site 01 03 06`。

### 4.4 切片四（可选）：`layout.html` 顶栏模板化

`renderTopNav()` + `syncTopNav()`（`layout.html:45-60`）改成 `o-fill` + `attr:aria-current`，
与 doc-nav 同构。硬约束不变：**只切 `aria-current`、绝不重建 DOM**（真人点击的 mousedown/click
必须落在同一节点上）—— 这正是 doc-nav 用 `o-fill` + `fill-key` 做到的，验收跑 `--site 04`。

### 4.5 不改的

`theme-boot.js`（首帧）、`site-map.js` / `routes.js` 的纯函数部分、`doc-nav.html`（已是模板）。

---

## 5. 顺序：垂直切片（每片 = 一个组件 + 它消费的 store）

| 阶段 | 内容                                                                  | 验收（套件范围）                             | 状态 |
| ---- | --------------------------------------------------------------------- | -------------------------------------------- | ---- |
| 0    | 验 §6 的四条假设（一次性探针，不入库）                                | 探针结果补进 `research/state.md`             | ✅   |
| 1    | `state/route.js` + `doc-crumb.html` / `doc-pager.html`（一次改完）    | `--site 01 02 04 05 08 09` + Breadcrumb 套件 | ✅   |
| 2    | `doc-toc.html` 模板化（高亮按阶段 0 结论走 A / B）                    | `--site 04 09`                               | ⏳   |
| 3    | `state/theme.js` + `state/palette.js` + 两个占位组件 + `site.js` 瘦身 | `--site 01 03 06`                            | ⏳   |
| 4    | `layout.html` 顶栏（可选）+ 清理注释 / README / `dom.js` 去留         | 收尾**全量一次**                             | ⏳   |

每片都能单独回滚（新文件删掉 + 还原 1–2 个文件），不要跨片混提交。

**阶段 1 的结果**：`--site 01 02 04 05 08 09` 64/64 + Breadcrumb 套件 20/20。
验收面扩大了一条（原计划只 02/04/08）：改动落在 `layout.html` / `doc-nav.html` / `site.js`
三个「全站共用」文件上，外壳与文档页也在影响半径里。

---

## 6. 阶段 0：四条假设的实测结论（**已验**）

| #   | 假设                                                    | 结论                                                                                                |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | ofa `data` 里挂 **store 引用**能跟随，挂原始值快照不能  | ✅ 成立：引用随 store 变，快照停在原值 → 消费方**挂引用**，不要拷贝原始值                           |
| 2   | `o-fill` 数据**局部变化**是否复用节点                   | ✅ **不换节点**（整体换数组、`fill-key` 相同也复用）→ 滚动高亮可以走声明式（A）                     |
| 3   | 模板能表达 `attr:布尔` 与 `:style.<自定义属性>`         | ⚠️ 布尔 ✅（`''` 写 / `null` 不写）；**`:style.<自定义属性>` ❌ 静默失效**；标准属性只认 kebab-case |
| 4   | proto 里 `this` 是 ofa 实例，元素 API 必须走 `this.ele` | ✅ 成立（`this.getRootNode` 是 `undefined`）→ 配方里所有元素 API 显式走 `this.ele`                  |

> 完整记录（含复现步骤）见 [`research/state.md` §6](./research/state.md)。
> 另外顺带验出 [P37](./ofa-pitfalls.md)（初值形状 → 首帧报错）与
> [P38](./ofa-pitfalls.md)（控制流元素挡住 `::slotted()`，阶段 1 真的踩了）。

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
| 滚动高亮高频写数据                    | 目录项频繁重建、点击丢失                                | 默认走 B（命令式切 `aria-current`），A 需阶段 0 证明节点复用                   |
| 切页重建组件导致监听重复挂            | 重复渲染 / 泄漏                                         | `startRouteTracking()` 幂等；组件侧 `watch` 退订、`detached()` 清理            |
| 首帧主题被 store 拖成异步             | 闪色（P25）                                             | `theme-boot.js` 不动                                                           |
| `$.stanz({})` 是数组内核（P36）       | `Array.isArray(store)` 误判                             | 不用它判分支；store 只当数据容器                                               |
| 改造顺手改了测试断言「让它绿」        | 护栏失效                                                | 既有断言（04/09/06 等）只允许因**行为约定变化**而改，并在提交信息里说明        |

---

## 8. 验收清单

- [x] `grep -rn "extends HTMLElement" docs/` **归零**（阶段 1 后只剩 `doc-toc.js` 一个类，阶段 2 清）。
- [x] `content.css` 里不再有组件内部结构的样式（翻页那几条已搬进 `doc-pager.html`）。
- [ ] `tests/site/10-nav-data.mjs` 仍能**不启浏览器**跑通（改 `site-map.js` 时必查）。
- [ ] 每阶段绑定套件绿；收尾全量一次绿（阶段 1 已绿；2/3/4 未做）。
- [ ] `dom.js` 的去留明确：若 `el` / `attr` 无人使用就删掉（`setCurrent` 若走路线 B 仍有人用）。
- [ ] `agent/` 里同步：本文件、`research/state.md` 的【实测】结论、README 索引（阶段 1 已更新）。

---

## 9. 需要你定的事

> 阶段 1 已按「垂直切片」做完（§5），下面 1、4 事实上已经按默认答案执行；
> 2、3 还等定，其中 2 的依据在 §6（`o-fill` 局部更新不换节点，A 路线可行）。

1. **顺序**：按我这个「垂直切片」（每个组件和它消费的 store 一次改完），还是先全量抽 store 再统一迁组件？
2. **`doc-toc` 高亮**：默认走 B（混合、零行为变化），还是要求阶段 0 验通后直接上 A（纯声明）？
3. **切片 3 / 4（占位组件、顶栏模板化）** 进不进这次范围？不进的话 `site.js` 与 `dom.js` 只做最小清理。
4. **命名**：store 放 `docs/state/`（现在 `docs/` 是平铺的）、本设计文档叫 `docs-refactor.md`，是否接受。
