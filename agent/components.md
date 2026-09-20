# Mosaic 组件编写规范

> **本文讲「怎么造组件」。** 有哪些组件、各自 API 是什么，见 [`component-spec.md`](./component-spec.md)。
> 设计规则见 [`design-spec.md`](./design-spec.md)，令牌值见 [`design-tokens.md`](./design-tokens.md)。
>
> 参考实现见 [`packages/button/button.html`](../packages/button/button.html)。
> **动手前先读 [`ofa-pitfalls.md`](./ofa-pitfalls.md)** —— 那里的坑全是静默失效，
> 表象是「绑定不生效 / 点了没反应」，反查成本极高。
> 写完对照本文末尾的[交付检查清单](#九写新组件的交付检查清单)逐条过。

---

## 〇、目录与命名约定

```
packages/{name}/
  {name}.html    组件本体 —— 源 = 产物，构建不碰它
  page.html      文档页 —— ofa.js 页面模块（<template page>），带活的可交互演示

docs/components.js
                 组件登记表 —— 加组件时在这里加一条
```

> 文档页是 **ofa.js 页面模块**，不是独立网页：它由 `o-router` 按 hash 路由加载，
> 地址形如 `#/packages/button/page.html`。直接双击打开只会看到空白
> —— 因为它没有 `<html>`/`<body>`，只有一个 `<template page>`。
> 冒烟测试里那条「文档跟着组件走」就是经由路由打开它来验证的。

**文档跟着组件走**：组件在 `packages/{name}/`，它的文档页就是同目录下的 `index.html`。
找组件时不用去别处翻文档。

**加一个组件要动两处**：`packages/{name}/` 下的组件本体与文档页，
再加一条 `docs/components.js` 登记。页面自带的二级菜单、组件总览、首页的组件区块
都从登记表渲染，不用手工维护。

站点级页面（首页 / 快速开始 / 组件总览 / 规范索引）放在 `docs/` ——
它们跨所有组件、不属于任何单个 package。

**目录名 / 文件名用语义名（`button`），标签名 = `mc-` + 语义名（`mc-button`）。**
一条规则，避免出现「目录叫 A、文件叫 B、标签叫 C」的三方不一致。

一个目录可以放多个同族组件（`packages/button/` 下可再有 `icon-button.html`）。

### 外壳布局与滚动：上 + 正文带，没有全局滚动条

外壳是一个 **ofa.js 布局页**（`docs/layout.html`，「嵌套页面/路由」里的父页面）：
只有两块，并且**固定一屏** —— `html` / `body` 吃满视口且 `overflow: hidden`，
所以**全局不出滚动条**，滚动一律收敛在内部区域。

```
body               纵向 flex，height: 100% + overflow: hidden（钉死一屏）
└─ o-router        flex: 1（overflow: visible，见下面那条 ⚠️）
   └─ o-app        flex: 1 1 auto + min-height: 0
      └─ o-page    布局页 docs/layout.html
         ├─ shadow  .doc-top  顶栏（「上」）+ 五个一级菜单
         │          .doc-main 正文带，flex: 1 + min-height: 0 + overflow-y: auto
         └─ o-page  当前子页面（被 <slot> 投影进 .doc-main）
```

> 样式分两处是 shadow DOM 的硬边界，不是选择：外壳在布局页的 shadow root 里，
> 所以它的规则写在 `docs/layout.html` 的 `<style>`；`html`/`body` 和
> `o-router → o-app → o-page` 的高度链在文档树里，所以写在 `docs/shell.css`。
>
> 子页面挂上外壳只写一行：`export const parent = '../layout.html';`
> （相对**本页面文件**解析；`packages/<slug>/page.html` 里是 `'../../docs/layout.html'`）。
> 布局页切页时**不重建**，顶栏高亮靠它的 `routerChange()` 钩子。

#### 顶栏与主题（都在布局页里）

- 一级菜单就是布局页顶栏里的五个 `<a olink>`；**加一个入口 = 在那里加一条**。
- 高亮只切 `aria-current`，**绝不重建 DOM**：重建会让真人点击的 mousedown / click
  落在两个不同节点上，表现为「菜单要点好几次才跳转」（实测第 1 轮点了 6 次）。
- 匹配路径要同时吃下两种形式：`olink` 的 href 被 ofa.js 改写成
  `…/index.html#/docs/pages/home.html`（hash 形式），而页面 `src` 是文件形式
  （站点还可能挂在子路径下）—— 所以统一归一成「相对仓库根的路径」再比。
- 组件文档页（`packages/<slug>/page.html`）不在顶栏单列，统一点亮「组件」；
  「设计令牌」自己有入口，精确匹配先命中，所以不会被那条兜底规则误伤。
- 冷启动直接带 hash 时，子页面可能比布局页晚一拍挂上 → 高亮补几拍（自限，有子页面就停）。
- 主题三态（自动 / 亮 / 暗）也在布局页；首帧由 `docs/theme-boot.js` 应用，防闪色。

**二级菜单不在外壳里**。哪个页面需要左栏，就在自己的模板里放 `<doc-nav>`
（站点级自定义元素，见 `docs/doc-nav.js`），外面套一层 `.doc-split`：

```html
<template page>
  <link rel="stylesheet" href="../content.css" />
  <div class="doc-split">
    <doc-nav data-source="components"></doc-nav>   <!-- 菜单项来自组件登记表 -->
    <div class="doc-body"> … 正文 … </div>
  </div>
  …
</template>
```

- `.doc-split` 给两栏定高：`<doc-nav>` 和右栏 `.doc-body` 各自 `overflow-y: auto`。
  于是分栏页里正文带内容正好一屏高、不滚，滚动落在两栏内部。
- 页面**不想要**左栏就不写 `.doc-split`，正文直接在外壳正文带里滚（`.doc-main`）。
- 菜单项也可以由页面自己写：
  `<doc-nav><a href="#/docs/pages/guide.html">快速开始</a></doc-nav>`。
- 窄屏（≤ 52rem）左右放不下，退化成「菜单在上（封顶 45vh，自己滚）、正文在下」，
  全局依然不滚。

因此换页复位要打在布局页的 `.doc-main` 上（`docs/site.js` 里做，且 `.doc-main`
在 shadow root 里，要穿透查），`window.scrollTo` 在这个外壳里是空操作。

> ⚠️ 顶栏的 `<a olink>` 走 `history.pushState`，**不触发 `hashchange`**。
> 凡是要「跟着路由走」的脚本都得同时听 o-app 冒泡的 `router-change` 事件
> （`docs/site.js` 的换页处理、`docs/doc-nav.js` 的高亮都是这么接的）。

> ⚠️ 页面里的占位（`[data-component-cards]` / `[data-palette]`）由 `site.js`
> 轮询渲染。收工条件必须是「**某个** `<o-page src>` 已经是 hash 指向的页面」
> （嵌套路由下有两个 o-page），不能是「`.doc-body` 换了」——
> o-app 启动会先加载首页再切到 hash 页，后者会在首页挂上那一刻就成立，
> 真正那一页的占位永远没人渲染（冷启动时卡片区空白）。

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

**不要在自己的页面里算 `100vh - 顶栏 - 内边距`。** 那样等于每个想撑满的页面各算一遍，
而且内边距一改就会冒出滚动条（踩过：漏了底部内边距，正好多 32px）。

高度链条由外壳负责，一处定义（视口与 o-page 链在 `docs/shell.css`，
`.doc-main` 在 `docs/layout.html`）：

```
.doc-main（布局页 shadow）  →  slot  →  o-page  →  o-page（子页面）  →  页面内容
  overflow-y: auto                    flex: 1 1 auto; min-height: 0
  min-height: 0
```

页面侧只声明意图：

```css
/* content.css 里首页海报的做法（方块位置由数据给，这里只管长相） */
.doc-poster {
  flex: 1 1 auto;
  min-height: 0;
}

/* 想分左右两栏的页面（content.css） */
.doc-split {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
}
```

`body` 是纵向 flex，布局页的 `.doc-main` 用 `flex: 1 + min-height: 0` 吃掉顶栏之外的
高度，再经 `<slot>` 传给子页面 —— 整条链上没有一处 `calc`。**内边距也在页面这一层**
（`.doc-body` 的 `padding`），因为分栏页要让左栏贴到外壳边缘。

> ⚠️ 链条上任何一环加了 `overflow: hidden` 都会**静默截断长页面**：裁掉之后滚动溢出
> 不再往上传，正文带的 `scrollHeight` 会永远等于 `clientHeight`，长页面被切掉、
> 页面上连滚动条都看不到。ofa.js 的 `o-router` 自带 `:host { … overflow: hidden }`，
> 所以 `shell.css` 里显式写了 `o-router { overflow: visible }`
> （外部文档树的普通声明赢过 `:host`）。冒烟测试里「滚到底后最后一块内容可见」守这条。

> ⚠️ 给 `body` 加 flex 之后，`.doc-main` 上的 `margin-inline: auto` 就变成了
> **交叉轴上的 auto margin**，会吃掉全部自由空间、让元素不再拉伸到满宽。
> 所以 `.doc-main` 必须显式写 `width: 100%`，否则整条宽度链会塌
> （实测正文从 1040px 缩到 455px，首页背景图案跟着缩成中间一条）。

### 页面模块的两条硬约束

文档页是 ofa.js 页面模块，它的 `<script>` 会被 ofa.js **抽出来当模块代码执行**
（`drawUrl` 里取模板内第一个 `script`）。两条约束由此而来，违反的后果是**页面直接空白**：

| 约束 | 原因 |
|---|---|
| **`<script>` 必须放在 `<template page>` 的最前面** | ofa.js 取的是**第一个** `<script>`。任何排在它前面的脚本都会被当成页面代码 |
| **注释里不要出现 body / svg / head 结束标签的原文** | 静态服务器（VS Code Live Server 就是）会按「第一个 body→svg→head 结束标签」往 HTML 里注入自己的脚本。注释里出现这些字符串会把注入点引到文件顶部，而注入内容自带 HTML 注释、会**把我们的注释提前闭合**，那段脚本于是变成真实元素并排到前面 |

这两条合起来的效果：无论服务器往哪注入，都抢不走第一个 `<script>` 的位置。
冒烟测试里有一条 `--inject` 服务器专门跑这条路径（照抄 live-server 的注入规则），
改模板结构或注释时如果破坏了它，测试会直接变红。

> ⚠️ **还有一条关于「挂到外壳」的**：页面模块必须在脚本里声明父页面 ——
> `export const parent = '../layout.html';`（相对**本页面文件**解析，
> `packages/<slug>/page.html` 里是 `'../../docs/layout.html'`）。
> 漏了它，那一页就掉出布局页：顶栏、正文带、主题按钮全没有，看起来像"样式丢了"。
> 冒烟测试里有一条断言逐个页面模块检查这条声明。

> ⚠️ `uno.config.ts` 扫描工具类时**排除 `packages/*/page.html`** ——
> 那是文档页不是组件模板。不排除的话，文档排版用到的工具类会混进框架产物，
> 让「精选子集」的体积跟着文档写作风格浮动。实测验证过这条排除生效。

---

## 一、组件的单一职责：只负责"布局与结构"，不负责"颜色"

这是整套规范里最重要的一条分工：

| 层 | 负责 | 写在哪 |
|---|---|---|
| **令牌** | 颜色、圆角、尺寸、动效 | `:host` / `:host([attr])` 里的 `--mc-*` 变量 |
| **工具类** | `display` / `flex` / `gap` / 对齐 / 定位 | 模板的 `class="..."` |
| **组件 `<style>`** | 工具类表达不了的（`height: var(--mc-control-h-md)`、过渡、伪类） | `.mc-*` 类 |

**颜色永远不出现在工具类里。** 一个组件模板里不应该出现 `bg-primary`、`text-muted`。
颜色一律通过令牌间接表达 —— 这样才可能做到"改 3 个变量换掉整个主题"，
也才能让使用者按实例覆盖。

```html
<!-- ✅ 正确：颜色走令牌 -->
<style>
  :host { --mc-btn-fill: var(--mc-color-primary); }        /* 存：裸三元组 */
  .mc-btn { background-color: rgb(var(--mc-btn-fill)); }   /* 用：包 rgb() */
</style>
<button class="mc-btn inline-flex items-center gap-2">

<!-- ❌ 错误：颜色写死在工具类里，使用者只能靠 !important 覆盖 -->
<button class="mc-btn inline-flex items-center gap-2 bg-primary text-primary-fg">
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
/* color 只负责往两个色槽里填值 */
:host([color="danger"]) {
  --mc-btn-fill: var(--mc-color-danger);
  --mc-btn-on-fill: var(--mc-color-danger-fg);
  --mc-btn-accent: var(--mc-color-danger);
}

/* variant 只负责把色槽贴到哪儿 */
:host([variant="outline"]) {
  background-color: transparent;
  color: rgb(var(--mc-btn-fill));
  border-color: rgb(var(--mc-btn-fill));
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

```html
<template component>
  <style>/* 见第四节 */</style>

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

        ready() {},     // DOM 已创建（shadow root 内），适合初始化
        attached() {},  // 已挂载，适合定时器/全局监听
        loaded() {},    // 子组件全部加载完成
        detached() {},  // 清理。定时器和全局监听必须在这里移除
      };
    };
  </script>
</template>
```

### 属性命名

| HTML（kebab-case） | `attrs` 里（camelCase） | 类型 |
|---|---|---|
| `color="danger"` | `color` | 枚举（语义色） |
| `variant="outline"` | `variant` | 枚举（外观样式） |
| `size="lg"` | `size` | 枚举 |
| `disabled` | `disabled` | 布尔 |
| `label-width="120"` | `labelWidth` | 数字/字符串 |

布尔属性在 HTML 里**写存在即真**（`<mc-button disabled>`），不要写 `disabled="true"`。

---

## 四、`<style>` 的五个分区

按固定顺序写，便于 review。下面就是从 [`packages/button/button.html`](../packages/button/button.html) 里摘的结构：

```css
/* 1. 宿主盒模型 + 色槽默认值
      尺寸直接写在这里（不绕一层 --mc-btn-h），使用者的 style="height:32px" 才压得住 */
:host {
  display: inline-flex;
  position: relative;                 /* 内部绝对定位元素的包含块，不能省（P21） */
  height: var(--mc-control-h-md);
  border-radius: var(--mc-radius-md);

  --mc-btn-fill: var(--mc-color-primary);        /* 三个色槽：填充 / 填充上的文字 / 强调色 */
  --mc-btn-on-fill: var(--mc-color-primary-fg);
  --mc-btn-accent: var(--mc-color-primary);

  background-color: rgb(var(--mc-btn-fill));      /* filled 是默认外观，直接写在这 */
  color: rgb(var(--mc-btn-on-fill));
}

/* 2. 维度一 color：只往色槽里填值 */
:host([color="danger"]) {
  --mc-btn-fill: var(--mc-color-danger);
  --mc-btn-on-fill: var(--mc-color-danger-fg);
  --mc-btn-accent: var(--mc-color-danger);
}

/* 3. 维度二 variant：只决定色槽贴到哪儿 */
:host([variant="outline"]) {
  background-color: transparent;
  color: rgb(var(--mc-btn-fill));
  border-color: rgb(var(--mc-btn-fill));
}

/* 4. 尺寸与状态 */
:host([size="sm"])  { height: var(--mc-control-h-sm); }
:host([disabled])   { opacity: .5; cursor: not-allowed; }

/* 5. 内部元素：只放工具类表达不了的 */
.mc-layer {                          /* hover/active 的 state layer */
  position: absolute; inset: 0; z-index: 1;
  border-radius: inherit;
  background-color: currentColor;    /* 不引新令牌，自动适配任意 color 与主题 */
  opacity: 0; pointer-events: none;
}
:host(:hover)  .mc-layer { opacity: .08; }
:host(:active) .mc-layer { opacity: .12; }
:host([disabled]) .mc-layer { opacity: 0; }      /* 正向覆盖，不用 :not()（P14） */
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

| 场景 | 做法 |
|---|---|
| 点击等原生交互 | **不定义自定义事件**。原生 `click` 自带 `composed: true`，会穿透 shadow 边界冒泡 |
| 值变化（表单类） | `this.emit('change', { data: { value } })` |
| 需要跨层级冒泡 | `this.emit('x', { data, bubbles: true, composed: true })` |

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
mc-dialog::part(panel) { border-radius: 0; }
```

| 组件 | 插槽 | part |
|---|---|---|
| `mc-button` | 默认（文案）、`prefix`、`suffix` | 无（全靠 `:host`，见 `packages/button/button.html`） |
| `mc-card` | 默认、`header`、`footer` | `base`、`header`、`body`、`footer` |
| `mc-input` | — | `base`、`input`、`prefix`、`suffix` |
| `mc-dialog` | 默认、`header`、`footer` | `overlay`、`panel`、`header`、`body`、`footer` |

⚠️ **给插槽内容设样式，优先用 `::slotted()`**，不要用 `<inject-host>`。
`<inject-host>` 会把样式注入到宿主元素所在的整个作用域（顶层时直接进 `document.head`），
有明确的样式污染风险，而且会触发宿主样式重注入导致重排（见 [P13/P14](./ofa-pitfalls.md)）。
只在 `::slotted()` 无法满足时使用。

⚠️ **模板里用了 `<l-m>` 就必须同时写 `l-m { display: none }`**，
否则它会作为 flex item 参与 `gap` 布局，造成间距不对称（[P13](./ofa-pitfalls.md)）。

---

## 七、组件清单

**组件清单和各自的 API 定义在 [`component-spec.md`](./component-spec.md)，本文不重复。**
那里是唯一真相源；改了组件 API 请改那一份。

里程碑分批：

| 批次 | 内容 | 备注 |
|---|---|---|
| **M1** | `mc-button`（已实现）/ `mc-icon` / `mc-card` / `mc-badge` / `mc-spinner` | 产出可发布的 0.1.0 |
| **M2** | 表单与反馈 9 个 | 会大量撞上 [P6 / P18 / P19 / P20](./ofa-pitfalls.md) |
| **M3** | 浮层与布局 6 个 | 开工前必须先验证图层问题（见下） |

> ⚠️ **M3 开头必须先验证图层问题**：宿主页面上的 `transform` / `filter` / `contain`
> 会创建新的层叠上下文，可能把 shadow root 里的 `position: fixed` 困住。
> 验证后再决定继续用 `position: fixed`、改用 popover API，还是挂载到 `document.body`。
> 详见 [`design-spec.md` 第七节](./design-spec.md#七层级)。

---

## 八、尺寸与无障碍基线

### 尺寸

| 尺寸 | 控件高 | 内边距 | 字号 |
|---|---|---|---|
| `sm` | `--mc-control-h-sm` (1.75rem) | `--mc-space-3` | `--mc-text-xs` |
| `md`（默认） | `--mc-control-h-md` (2.25rem) | `--mc-space-4` | `--mc-text-sm` |
| `lg` | `--mc-control-h-lg` (2.75rem) | `--mc-space-5` | `--mc-text-base` |

所有组件的 `size` 都必须只支持这三个值（`sm` / `md` / `lg`），
新增尺寸要先加 `--mc-control-h-*` 令牌，**不允许在组件里写死像素值**。

### 无障碍

| 要求 | 落地 |
|---|---|
| 键盘可达 | 可交互元素必须是原生 `<button>` / `<input>` / `<a>`，不要用 `<div on:click>` |
| 焦点可见 | 必须有焦点样式。统一用 `focus-visible:ring-2 ring-ring` |
| 对比度 | 令牌层已保证（见 [design-tokens.md](./design-tokens.md#四对比度自检)），组件**不得绕过令牌直接写颜色** |
| 禁用态 | 用 `disabled` 属性而非仅 `opacity`，保证屏幕阅读器可感知 |
| 动效 | 尊重 `prefers-reduced-motion`，已在 `shadow-base.css` 里统一把 `--mc-duration-*` 压到 1ms |
| 图标按钮 | 必须有 `aria-label`；纯装饰 SVG 加 `aria-hidden="true"` |

---

## 九、写新组件的交付检查清单

> 「ofa.js 正确性」这一节的每一条都对应 [`ofa-pitfalls.md`](./ofa-pitfalls.md) 里的一个坑，
> 踩中的代价是**静默失效**（不报错、表象像"没生效"），所以不要跳。

```
目录与命名
[ ] packages/{name}/{name}.html 组件本体 + page.html 文档页
[ ] 文档页以 <template page> 开头，并 <link> 了 ../../docs/content.css
[ ] 文档页里的站点资产相对路径正确（../boot/...、../../docs/...）
[ ] 已在 docs/components.js 登记（二级菜单 / 总览 / 首页都会自动带上）
[ ] 标签名 = mc- + 目录名，三方一致

结构
[ ] <style> 按五个分区顺序书写
[ ] 视觉定义在 :host 上，外部 style="height:32px" 能直接覆盖
[ ] 颜色全部走 L3 组件令牌，模板 class 里没有任何颜色工具类
[ ] 变体全部用 :host([attr]) 驱动，没有拼接类名
[ ] 每个组件至少暴露一个 part，或用 :host 直接可定制
[ ] 使用 ::slotted() 而不是 <inject-host>

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
[ ] proto 方法名避开了 $.fn 上的通用名（get/set/text/html/data/watch/on/emit/class/style/remove/refresh）

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
[ ] pnpm dev 验收页确认无误（禁缓存的 http-server，不要用别的静态服务器，见 P24）
```
