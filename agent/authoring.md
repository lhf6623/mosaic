# 组件编写：命名、职责、四维正交、ofa 骨架

怎么**造**一个新的 `mc-*` 组件：目录与命名、单一职责边界、四个正交维度、
`<template component>` 骨架（以及为什么只有这一种写法）。样式分区 / 事件 / 插槽见
[`authoring-style.md`](./authoring-style.md)，交付前过一遍 [`checklist.md`](./checklist.md)，
逐组件接口以 [组件 API 规范](api/README.md) 为准。

> **读这份的场合**：新建组件、改组件骨架、判断某个能力该不该由组件承担。

**指路**：设计规则（间距 / 排版 / 动效 / 层级）见 [`design-spec.md`](./design-spec.md)，
令牌值见 [`design-tokens.md`](./design-tokens.md)；参考实现是
[`packages/button/button.html`](../packages/button/button.html)，带**可选异步依赖 + 降级路径**的
例子是 [`packages/code/code.html`](../packages/code/code.html)。

> ⚠️ **动手前先读 [踩坑清单](pitfalls/README.md)** —— 那里的坑全是静默失效，
> 表象是「绑定不生效 / 点了没反应」，反查成本极高；写完再过一遍
> [`checklist.md`](./checklist.md)。

---

## 一、目录与命名约定

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
`packages/<slug>/` 下的新文件 → 该组件的套件 + 地图里碰过这个目录的套件，纯文档 → 不跑
（扫全仓的 node-only 守卫除外，见 `select.mjs` 的 ALWAYS_RUN），**未知路径 → 保守全量**；地图缺失、套件不在图里也一律跑（**宁可多跑，不可漏跑**）。
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

---

## 二、组件的单一职责：只负责"布局与结构"，不负责"颜色"

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

---

## 三、变体一律属性驱动，且四个维度必须正交

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

完整定义见 [组件 API 规范 1.2](api/README.md#12-属性四个正交维度)。

**为什么不做 `class:mc-btn--primary="color === 'primary'"`**：

1. HTML 更干净，使用者的心智负担更低
2. **UnoCSS 不需要 safelist** —— 工具类在模板里是字面量，能静态扫到。
   这从根上避开了 UnoCSS 最大的坑：动态拼接的类名会被**静默丢弃**，
   产物里少几条规则、退出码仍然是 0
3. CSS 体积不随变体数膨胀 —— 变体只改变量值，不新增选择器

**约束**：一个组件最多 4 个维度（`color` / `variant` / `size` / 状态布尔）。
再多就说明这个组件该拆了。

⚠️ 默认外观**直接写在 `:host` 上**，不要写 `:host(:not([variant]))` ——
ofa.js 的样式作用域不支持 `:host()` 内嵌 `:not()`，会静默失效（[P14](pitfalls/03-style-scope.md)）。

---

---

## 四、ofa.js 组件骨架

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
