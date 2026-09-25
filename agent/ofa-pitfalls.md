# ofa.js 实战踩坑清单

> **来源**：绝大部分条目来自 ofa.js 官方 UI 库 [senti-ui](https://github.com/ofajs/senti-ui) 的
> `CONTEXT.md`「ofa.js 已知坑」章节（MIT/Apache-2.0 项目，作者 Yao），是它 24 个组件族
> 实战沉淀下来的。本文做了重新分类和精简，并按 Mosaic 的场景做了补充。
>
> **用法**：写/改 Mosaic 组件前扫一遍。这些坑的共同特征是**不报错、静默失效**，
> 表象常常是「绑定不生效」「点了没反应」「改了没生效」，极难反查。

---

## 一、属性与响应式（最高频，先看这节）

### P1 · 布尔属性的默认值必须是 `null`，不能是 `false`

```js
// ❌ <mc-button disabled> 完全失效
attrs: {
  disabled: false;
}

// ✅
attrs: {
  disabled: null;
}
```

**原因**：ofa.js 在初始化时用声明的默认值覆盖数据。默认 `false` 会把裸属性
`<mc-button disabled>`（`getAttribute` 返回 `""`）冲掉，属性看起来"设了但没生效"。

**推论**：判断布尔属性用 `this.disabled !== null`，不要用真值判断（`""` 是 falsy，
但 `""` 恰恰代表"属性存在"）。这也是为什么 `<mc-button disabled>` 里 `disabled` 必须
**出现在 `attrs` 里** —— 没声明就不是 observed attribute，`attributeChangedCallback`
根本不会触发。

### P2 · 把布尔属性转发给内部原生元素，用 `:prop`，不要用 `attr:`

```html
<!-- ❌ 永远处于禁用态 -->
<button attr:disabled="disabled !== null">
  <!-- ✅ -->
  <button :disabled="disabled !== null"></button>
</button>
```

**原因**：`attr:` 会把 `false` 序列化成字符串 `"false"`；而对于布尔属性，
**属性存在即生效**，所以 `disabled="false"` 依然是禁用。

### P3 · 用 JS 改组件状态必须走 `setAttribute` / `removeAttribute`

```js
el.disabled = true; // ❌ 不触发模板更新
el.setAttribute('disabled', ''); // ✅
el.removeAttribute('disabled'); // ✅
```

**原因**：直接写 property 绕过了 ofa.js 的属性观察链路。
（注意：组件**内部**读写自己的 data 是正常的，这条说的是从外部操作宿主元素。）

### P4 · `setAttribute` 触发更新是**异步**的

`setAttribute` 之后**同步**去读计算样式或 ofa data，拿到的是旧值，极易误判成"改了没生效"。

```js
el.setAttribute('variant', 'danger');
await new Promise((r) => setTimeout(r, 100)); // 再断言
```

自动化测试里尤其容易踩。

### P5 · 组件初始化时 `watch` 会以默认值触发一次

ofa.js 在 attach 之后会把每个 attr 的 watch 都调一遍，**即使值从未变过**。

**后果**：watch 里"值变为 X 时执行副作用"的分支会在加载瞬间误执行
（例：dialog 被 "关闭" 分支加上 closing 属性，画面闪一下）。

**写法**：watch 分支加状态守卫。

```js
watch: {
  open(val) {
    if (this._wasOpen === undefined) { this._wasOpen = val; return; }  // 跳过首次
    this._wasOpen = val;
    // ... 真正的副作用
  },
}
```

### P6 · `:prop` 绑定到 attr 声明的键时，对象会被 JSON 序列化

组件侧 watch 收到的是 JSON 字符串，不能当数组/对象直接用。

**写法**：在 watch 里 `JSON.parse` 后规范化存到内部字段（如 `this._items`），
**不要写回 ofa data**（会再次序列化）。另外，`:prop` 绑定到**未声明**的键完全不生效。

### P7 · proto 方法名要避开 `$.fn` 上的通用名

ofa.js 版本升级时会把更多方法名收为保留（`refresh` 已被 `$.fn` 占用）。
避开：`get` / `set` / `text` / `html` / `data` / `watch` / `on` / `emit` / `class` /
`style` / `remove` / `refresh` 等。

### P31 · `attrs` 的键也不能撞保留名；组件构造期不能往宿主写属性

两条都是实测出来的，**共同表现是 `document.createElement('mc-code')` 拿到的元素没有
shadow root**，控制台只有一条 `NotSupportedError: The result must not have attributes`；
而用标记写的 `<mc-code>…</mc-code>` 完全正常 —— 所以很容易漏过去。

```js
// ❌ attrs 里出现保留名（实测 wrap）
attrs: {
  wrap: null;
}

// ✅ 换个名字，属性写成 soft-wrap
attrs: {
  softWrap: null;
}
```

```js
// ❌ ready() 里往宿主元素写属性（style 也算属性）
ready() {
  this.ele.style.setProperty('--mc-code-max-h', '120px');
}

// ✅ 写到 shadow root 内部元素上 —— 它们不受这条限制
ready() {
  this.ele.shadowRoot.querySelector('.mc-view').style.setProperty('--mc-code-max-h', '120px');
}
```

**原因**：自定义元素规范要求构造期（`document.createElement` / 升级）结束时宿主元素
**不能带属性**，否则抛 `NotSupportedError`；而 ofa.js 的 `ready()` 正是在构造期跑的。
保留名那头同理：撞上 `$.fn` 已占用的名字，ofa.js 只打一条 warning 就跳过，行为不可预期。

**已知保留名**：proto 侧 `refresh` / `sync`（配合 [P7](#p7--proto-方法名要避开-fn-上的通用名) 的清单），
attrs 侧已知 `wrap`。**写法上的推论**：组件自己的运行时状态优先写到 shadow root 内部的
元素上；确实要写宿主时放到 `attached()` 里。

**为什么难查**：报错不指向组件文件（栈顶是调用 `createElement` 的那行），
页面上标记写的实例照常工作，只有"动态创建组件"这条路径坏掉。

### P32 · ofa.js 会把声明过的**字符串**属性以空值写到宿主上

**现象**：组件声明了 `attrs: { hljsBase: '', maxHeight: '' }`，页面上写的是裸的
`<mc-code language="js">`，但宿主元素的实际属性列表是：

```html
<mc-code language="js" hljs-base="" max-height=""></mc-code>
```

**后果**：`el.hasAttribute('max-height')` 对所有实例都返回 `true`（值为 `""`）。
用它来区分"使用者显式给了这个属性"会全部误判。

```js
// ❌ 每个实例都命中
if (el.hasAttribute('max-height')) …

// ✅ 看值
if ((el.getAttribute('max-height') || '').trim() !== '') …
```

**推论**：`attrs` 里布尔属性默认值写 `null`（[P1](#p1-布尔属性的默认值必须是-null不能是-false)）
时不会被写成属性，所以 `:host([soft-wrap])` 这类布尔选择器是安全的；
但**字符串**属性（哪怕默认是空串）会被反射，别把 `:host([max-height])` 当条件用。
写完新组件，去 devtools 里看一眼宿主的属性列表最快。

### P39 · `data` 的键也有保留名（实测 `entries`）：整个组件不渲染，报错却不说键名

```js
// ❌ 组件完全不渲染：customElements.get('doc-toc') 有定义，但宿主**没有 shadow root**
export default () => ({ tag: 'doc-toc', data: { entries: [] } });
// 控制台只有一条：Error: Failed to render the tag 'doc-toc'

// ✅ 换个名字（实测 rows / 嵌套对象 / 数组本身都没问题）
data: { rows: [] },
```

**实测边界**：`data: { entries: [] }`、`{ entries: [{…}] }`、`{ entries: ['a'] }`、
异步 `export default async () => …` —— **全炸**；同一模板换成 `{ rows: [] }` 或 `{ a: { b: 1 } }`
一律正常。跟模板里有没有引用它无关。

**原因**：与 [P31](#p31--attrs-的键也不能撞保留名组件构造期不能往宿主写属性) 同一族 ——
ofa 的数据层/实例占了 `entries` 这个名字，声明它会让整棵组件渲染流程抛错并被包成一句
「Failed to render the tag 'X'」。

**怎么定位**（这条的价值所在）：报错不指向键名，删模板、删 `<style>`、换子元素**都试不出来**。
最快的路径是**二分 `data` 的键**：先把 `data` 缩成 `{}`，再逐个加回来。
本次就是先怀疑模板、绕了三轮，最后才收敛到一行 `data` —— **先怀疑键名，再怀疑模板。**

**已知保留名**：`attrs` 侧 `wrap`（[P31](#p31--attrs-的键也不能撞保留名组件构造期不能往宿主写属性)）；
`data` 侧 `entries`。新组件起字段名时避开这些，报错信息给不了提示。

---

## 二、模板语法

### P8 · `{{...}}` 只能用在文本节点

属性值一律用 `attr:` / `:prop` / `:style.` 指令。
另外 **`<code>` 标签内的 `{{...}}` 不会被编译**（静默跳过，字面显示）——
需要等宽样式时用 `<span class="code">` + `font-family: ui-monospace` 模拟。

### P9 · `attr:` 的值是 JS 表达式，不是字符串字面量

```html
<!-- ❌ 被当标识符求值 → ReferenceError，并且中断整个组件 render -->
<button attr:title="点这里选择">
  <!-- ✅ 静态文案直接写普通属性 -->
  <button title="点这里选择">
    <!-- ✅ 确实要动态时再包成字符串表达式 -->
    <button attr:title="locked ? '已锁定' : ''"></button>
  </button>
</button>
```

**这条最坑的地方**：异常会**中断 render**。模板 HTML 已经挂进 shadowRoot，但
`ready()` 不执行、后面的 `o-if` / `o-fill` 不展开、数据恒为空 ——
表象像「绑定不生效 / 接口没返回」，极易误诊。

### P10 · 条件渲染不要依赖 `x-if` / `o-if` 响应运行时属性变化

改用**常驻 DOM + `:host([attr])` CSS 选择器**控制显隐。
`o-if` 适合渲染期就确定的条件，不适合跟随属性切换的开关。

### P11 · `o-fill` 内部只能用 `$data` / `$index` / `$host`

不能自定义变量名（`item`、`row`、`element` 都会静默失效）。

```html
<o-fill :value="items" fill-key="id">
  <div>{{$data.name}}</div>
  <!-- ✅ -->
</o-fill>
```

`fill-key` 建议始终填写，否则增删/排序时列表项复用会错乱。

### P12 · `o-fill` 把条目渲染在自己的 light DOM（innerHTML）里

所以要消费 `o-fill` 产生的条目时，`slot.assignedElements()` 只能看到 `o-fill` 容器本身，
需要深入查询：`el.querySelectorAll(...)`（light DOM）+
`el.shadowRoot?.querySelectorAll(...)`（shadow）双路收集并去重。

### P30 · `o-fill` / `o-if` 不能用在 **SVG** 里（编译期直接抛错）

**现象**：把 `<o-fill>` 放进 `<svg>`，整页空白，控制台一条：

```
TypeError: Cannot read properties of undefined (reading 'querySelectorAll')
    at hr (ofa.min.mjs)      ← 模板编译阶段
```

**原因**：`o-fill` / `o-if` / `o-else-if` / `o-else` 都是**自定义元素**（`$.register` 注册），
而 SVG 命名空间里的元素**不会被 `customElements` 升级** —— 编译器按 HTML 元素去处理它，
拿不到预期的 template，于是编译期就炸。不是「不生效」，是**整个页面渲染不出来**。

**正确写法**：列表渲染放在 HTML 里，元素用普通标签；SVG 里只能用静态标记，
或者给 `<g :html="markup">` 绑一段字符串。

Mosaic 首页的马赛克图案就是这么落地的：方块从「SVG `<rect>` + `createElementNS`」
改成 HTML 元素 + `o-fill`（`docs/pages/home.html`），位置/透明度走 `:style.*`、
颜色走 `attr:data-color` 交给 CSS。

> 顺带一条：`:style="someObject"`（不带属性名）**不被支持**，而且同样是**静默中断整个
> render** —— 模板 HTML 已经插进去了，但绑定全不生效、`ready()` 不执行，看起来像
> 「数据没绑定上」。要绑多个样式就逐个写 `:style.left` / `:style.top`。

---

## 三、样式作用域

### P13 · shadow 内的 `<l-m>` 加载占位是 flex item

组件模板里用 `<l-m>` 引入子组件时，**必须同时写**：

```css
l-m {
  display: none;
}
```

否则它会在内容一侧多占一个 gap，造成左右间距不对称。

### P14 · `:host(:not([attr]))` 不生效

ofa.js 的样式作用域处理不支持 `:host()` 内嵌 `:not()` —— **静默失效，无报错**。

**写法**：反向逻辑，默认隐藏，用正向选择器启用。

```css
.mc-panel {
  display: none;
}
:host([open]) .mc-panel {
  display: block;
}
```

### P15 · JS 写的内联样式会压过 `:host([attr])` 的 CSS 规则

组件用 JS 应用语义色时，若无条件 `style.background = ...`，
会把 `outlined` / `text` 这类靠属性选择器实现的变体**强制覆盖成填充样式**。

**写法**：先读当前 variant 再分派。

```js
if (this.variant === 'outline') {
  s.background = '';
  s.color = main;
  s.borderColor = main;
} else {
  s.background = main;
  s.color = on;
  s.borderColor = '';
}
```

**反过来这也是 Mosaic 的定制 API**：使用者写
`<mc-button style="height:32px">` 能覆盖 `:host([size])`，正是因为内联样式优先级最高。

### P16 · 焦点环等画在组件外部的指示色，不要用 `currentColor`

它跟随文字色 —— filled 按钮文字是白的，白圈画在浅色页面上完全不可见。
应该用与页面背景有对比的令牌（如 `--mc-color-ring` / `on-surface`），深色浅色都成立。

### P33 · `::slotted()` 压不过**祖先 shadow 树**里的元素规则

**现象**：插槽里放 `<button>` 时，组件写给插槽元素的行样式（内边距、底色、光标）全不生效 ——
文字贴边、禁用项还是手型光标；换成 `<a>` 一切正常。

**原因**：插槽元素同时是**祖先 shadow 树**里的普通元素。`mosaic.js` 把 `shadow-base.css`
adopt 进了每一层 shadow root，那句 `button { padding: 0; background: none; cursor: pointer }`
对本组件而言住在**外层** shadow 树里，是「直接命中」；组件的 `::slotted(button)` 住在**内层**
shadow 树里。CSS 层叠的排序里**封装上下文排在「层」前面**，所以外层声明赢 —— 哪怕它是
`@layer mosaic.base` 里的分层声明，而 `::slotted()` 是未分层的。**mc-menu 就是这么踩上的**
（`packages/menu/menu-item.html` 的注释留了完整推演）。

**正确写法**：行盒子（尺寸、内边距、底色、颜色）留在**宿主**上，插槽元素只做两件事 ——
铺满整行当交互层（`position: absolute; inset: 0`）、承载语义（`href` / `aria-*` / `disabled`）。
缩进与垂直居中走宿主的 `text-indent` / `line-height`（**继承**属性，能穿 shadow 边界）。
状态（`aria-current` / `disabled`）由组件读插槽元素、镜像成宿主上的 `data-*`，CSS 再从宿主上选。

**同一族的两个小坑**：

- UA 样式表给 `<button>` / `<input>` 写死了 `text-indent: 0`，**继承压不过它**（有声明就赢过继承）。
  插槽元素上的缩进必须显式写一遍（作者声明能压过 UA），`<a>` 则正常继承。
- `:host(:has(...))` 在 ofa.js 里不生效（同 [P14](#p14--hostnotattr-不生效)），宿主「看不到孩子」。
  要在宿主上表达「孩子是什么状态」，只有 JS 镜像一条路（`MutationObserver` 盯属性 + `slotchange` 重绑）。

**怎么验证**：带插槽的组件，插槽里分别放 `<a>` 和 `<button>` 各跑一遍；两者外观不一致就是踩了。

---

## 四、DOM 与事件

### P17 · 向组件自身插入动态节点必须走 `shadowRoot`

```js
this.ele.shadowRoot.appendChild(node); // ✅
this.ele.appendChild(node); // ❌ 落入 light DOM，无 slot 时完全不可见
```

### P18 · 自定义组件的事件处理器里读 `e.target.value` 是 `undefined`

ofa.js 的 attr 数据不在宿主原生 property 上，事件冒泡到宿主时 target 已被重定向。

**写法**：组件在 `ready()` 里把 value 反射到宿主 DOM property。

```js
ready() {
  Object.defineProperty(this.ele, "value", {
    get: () => innerInput.value,
    set: (v) => { innerInput.value = v; this.ele.setAttribute("value", v); },
  });
}
```

### P19 · 原生 `change` 事件穿不出 shadow DOM

`input` 事件是 `composed: true`，可以在宿主直接监听；但 **`change` 是
`bubbles: true, composed: false`**，只到 shadow 边界为止。

**写法**：组件内部转发。

```js
innerInput.addEventListener('change', () =>
  this.ele.dispatchEvent(new Event('change', { bubbles: true, composed: true })),
);
```

### P20 · 判断「点击组件外部」必须用 `composedPath()`

```js
document.addEventListener('pointerdown', (e) => {
  const inside = e.composedPath().includes(this.ele); // ✅
  // const inside = this.ele.contains(e.target);        // ❌ 必然误判为外部
});
```

**原因**：composed 事件冒泡到 document 时，`target` 已被沿途每层 shadow 边界
重定向为最外层宿主。弹层会因此被提前关闭、选项点击落空（表现为"选了没反应"）。

### P21 · 内部透明交互层要盖住 positioned 兄弟，必须给 `z-index`

`.mc-native`（`position:absolute; inset:0`）若后面的兄弟也是 positioned，
后者按 DOM 顺序画在上面，点击就落不到它身上。

另外注意**包含块**：宿主必须 `position: relative`，否则 `inset: 0` 会以最近的
positioned 祖先为基准，铺满整个祖先。

### P22 · 合成事件跨 shadow 边界冒泡必须带 `{ composed: true }`

测试时 `dispatchEvent(new PointerEvent(...))` 不加 `composed`，
监听在宿主上的处理器收不到，会误判为组件不工作。
真实用户点击天然是 composed，无此问题。

### P34 · 跨 shadow 树往上找祖先，要走**扁平树**（`assignedSlot`）

**现象**：`mc-code` 的滚轮接力在块内滚到底后什么都没发生（滚轮像被吞了）；
`doc-toc` 的滚动高亮永远不亮。两处都在「往上找滚动祖先」，两处都找不到。

**原因**：`parentNode` 走的是**节点树**。子页面是被外壳的 `<slot>` 投影进去的，
顺着 `parentNode` 爬是：`.doc-body → 页面 shadow root → host(o-page) → 布局页 o-page →
o-app → …` —— **直接跳过了布局页的 shadow root**，而当时的滚动容器 `.doc-main` 正住在那里。

> 现在两栏浮动 + 窗口滚，页面上暂时没有「跨 shadow 的滚动容器」了（见 `docs/content.css` 的分栏注释），
> 但这条规则对**任何**跨 shadow 往上找祖先的场景都成立，别删。

**正确写法**：每一步先看 `assignedSlot`（被投影的节点，扁平树里的父是那个 slot）：

```js
el = el.assignedSlot ?? el.parentNode ?? el.getRootNode()?.host ?? null;
```

`docs/doc-toc.html` 的 `scroller()` 与 `packages/code/code.html` 的 `scrollableAncestor()`
都是按这条改的；同一条推论也适用于「找最近的宿主 / 找最近的容器」这类往上爬的代码。

**同一族的另一条**：`position: sticky` 的滑动区间 = **它所在 grid 行的高度**。
把分栏容器按一屏定高（`flex: 1 1 auto` + `grid-template-rows: minmax(0, 1fr)`），
行就塌成一屏，sticky 的侧栏一滚动就跟着走（看起来跟没写 sticky 一样）。
让容器按内容长高（`height: auto` + `flex: 0 0 auto` + `align-items: start`）即可 ——
详见 [`components.md` 的外壳布局一节](./components.md#外壳布局与滚动上--正文带整页只有一条滚动条)。

---

## 五、页面模块与静态服务器

> 这一节的两条来自同一个真实事故：文档站首页在 VS Code Live Server 下**页面空白、
> 不报错**。用 `pnpm dev`（项目自带服务器）没事，换成别人的静态服务器就挂。

### P26 · 页面模块的 `<script>` 必须放在 `<template page>` 最前面

ofa.js 把页面模块的 `<script>` 抽出来当模块代码执行 —— `drawUrl` 里取的是模板内
**第一个** `script`。任何排在它前面的脚本都会被当成页面代码，包括**静态服务器注入的脚本**。

### P27 · 页面模块的注释里不要写 body / svg / head 的结束标签原文

VS Code Live Server 会往 HTML 响应里注入 live-reload 脚本，注入点依次找
「第一个 body 结束标签 → svg 结束标签 → head 结束标签」。

注释里一旦出现这些字符串，注入点就被引到文件顶部；而注入内容**自带一个 HTML 注释**，
会把你那条注释提前闭合 —— 后面的 `<script>` 随之变成真实元素，且排在你的脚本前面。
P26 于是被触发，页面空白。

**两条合起来**：无论服务器往哪注入，都抢不走第一个 `<script>` 的位置。

**为什么难查**：页面不报错，只是什么都不渲染。控制台里唯一线索是服务器自己打的
`Live reload enabled.` —— 看起来一切正常。

冒烟测试里有一条 `--inject` 服务器专门跑这条路径（照抄 live-server 的注入规则），
改模板结构或注释时如果破坏了它，测试会直接变红。

---

## 六、平台与环境

### P23 · ofa.js 的 CDN 不锁版本

官方示例用的是 `https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs`（无版本号），
会自动升级，历史上从 4.5 漂到 4.7+，并曾因新版把 `refresh` 收进 `$.fn` 而破坏组件。
但**锁死旧版本同样有风险**（锁 4.5.0 时 `o-fill` 的内嵌 `$data` 模板直接不可用）。

**Mosaic 的立场**：自己 pin 一个**验证过的** ofa.js 版本并写进文档，
同时用 `peerDependencies: "ofa.js": ">=4.7 <5"` 声明兼容区间；
每次升 ofa.js 必须跑一遍冒烟测试。

### P24 · 本地验证必须禁缓存

用 `pnpm dev`（`http-server -c-1`）。
用默认缓存的静态服务器会导致「改完 `page.html` / `m3-theme.js` 浏览器继续用旧模块」，
表现为"改了没生效"或诡异报错，排查极耗时。

### P25 · 动态生成主题必然有 FOUC，治理 = 同步引导 + 双兜底

ES module 天生 defer，模块在首帧渲染之后才执行 → 页面先无色再变色。

已知可行的方案（senti-ui 的 `st-boot.js` 思路）：

1. 主题生成后把 CSS 文本缓存进 `localStorage`
2. 配一个**经典同步脚本**放在 `<head>`，刷新时同步注入缓存
   （同步注入必须用经典 script，module 做不到）
3. 首次访问无缓存时，同步 `<link>` 一份静态兜底 CSS
4. 动态注入的 `<style>` 在 head 更靠后，同特异性自然覆盖兜底

---

## 七、布局页（嵌套页面/路由）

> Mosaic 文档站的外壳就是一个布局页（`docs/layout.html`）：子页面用 `export const parent`
> 挂上去，正文经父页面的 `<slot>` 投影。这一节是搭它时实测出来的。

### P28 · `<a olink>` 导航**不触发** `hashchange`

**现象**：从顶栏（用 `olink` 的应用内链接）点进一个页面后，靠 `hashchange` 驱动的
东西全都停在原地 —— 二级菜单不高亮、页面里的占位（卡片/色板）不渲染。
刷新一下又好了，所以极难反查。

**原因**：`olink` 走的是 `history.pushState`。规范里 pushState **不会派发 `hashchange`**，
也不会派发 `popstate`；地址栏 hash 变了，但监听器一次都不响。
（页面里的普通 `<a href="#/…">` 会触发 hashchange，所以两条路径表现不一致。）

**正确写法**：再听一个 o-app 的 `router-change` 事件 —— 每次导航都会冒泡
（实测 `bubbles: true`，从 `o-app` 一路冒到 `document`）：

```js
window.addEventListener('hashchange', sync); // 普通 hash 链接
document.addEventListener('router-change', sync); // olink / 前进后退
```

Mosaic 里 `docs/site.js`（换页复位 + 占位渲染）、`docs/doc-nav.html`（二级菜单高亮，
`ready()` 里挂、`detached()` 里摘）与 `docs/doc-toc.html` 都这么接。

> 顺带一条同类坑：`parentNode` / `getRootNode().host` 走的是**节点树**，而滚动与投影按
> **扁平树**。现在两栏浮动 + 窗口滚（见 `docs/content.css` 的分栏注释），
> 页面上已经没有「外壳里的滚动容器」这回事了；但 `docs/doc-toc.html` 的 `scroller()` 与
> `packages/code/code.html` 的 `scrollableAncestor()` 仍然按扁平树走 —— 页面将来若重新引入
> 内部滚动区，只有扁平树能找到它。

### P29 · 嵌套路由（布局页）的四条约定

**现象**：页面"掉出外壳"（没有顶栏、没有正文带，看起来像样式丢了）；或者父页面
写好了却什么都不显示。四条都**不报错**：

| 约定                                               | 踩错的表现                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 子页面必须 `export const parent = '…'`             | 那一页不会被布局页包住，顶栏/正文带全没有。路径相对**子页面文件**解析：`docs/pages/x.html` 写 `'../layout.html'`，`packages/<slug>/page.html` 写 `'../../docs/layout.html'` |
| 父页面（布局页）必须有 `<slot></slot>`             | 子页面内容无处投影，页面一片空白（父页面自己正常）                                                                                                                          |
| 顶栏高亮要用 `routerChange()`，不能只靠 `ready()`  | 父页面在切页时**不重建**，`ready()` 只在首次跑一次 → 只有第一页亮，之后一直不更新                                                                                           |
| 冷启动直接带 hash 时，子页面可能比父页面晚一步挂上 | `ready()` 那一刻查不到子页面 → 首屏高亮空着。补几拍（自限）即可，Mosaic 的 `syncTopNav` 就是这么做的                                                                        |

**样式边界值得记一笔**：父页面的 `<style>` 在**它自己的 shadow root** 里，文档级 CSS
进不去（和普通组件一样）；但子页面的 `o-page` 在**文档树**里（它是父页面那个 `o-page`
的 light DOM 子节点），所以 `o-router → o-app → o-page` 的高度链可以、也只能写在
文档级样式表里（Mosaic 是 `docs/shell.css`）。

---

## 八、状态管理（`$.stanz` / `o-provider`）

> ofa.js 有两套状态管理，都在**核心 dist** 里（零新依赖、不用构建）：
> 共享状态 `$.stanz({...})`，上下文状态 `<o-provider>` / `<o-consumer>` / `<o-root-provider>`。
> 三条都是**在 pin 的 ofa.js 4.7.5 上实测**出来的，完整记录见 [`research/state.md`](./research/state.md)。

### P35 · 上下文状态的运行时更新**只能走 ofa 的数据层**，裸元素属性 / `setAttribute` 静默无效

```js
// ❌ 两种写法属性都"写上了"（getAttribute 读得到），但 consumer 一动不动
const p = document.querySelector('o-root-provider');
p.customColor = 'blue';
p.setAttribute('custom-color', 'blue');

// ✅ 走 $() 包装，或拿 provider 实例
$('o-root-provider').customColor = 'blue';
$('#host').getProvider('ctx').customColor = 'blue';
$.getRootProvider('ctx').customColor = 'blue';
```

**原因**：provider 的共享数据挂在 ofa 的数据层上，`$()` 包装转发的是组件实例的属性；
`document.querySelector()` 拿到的是裸 DOM 元素，给它写 expando / 属性不经过响应链路。

**为什么难查**：DOM 上完全正常（属性确实变了），只有消费方的数据不刷新 —— 看结构看不出问题。

**怎么验证**：改根 provider 的值，读 shadow root 里 consumer 绑定的那个字段。

### P36 · `$.stanz({...})` 返回的是**数组内核**的代理：`Array.isArray()` 为 `true`

```js
const store = $.stanz({ count: 0 });
Array.isArray(store); // true（！对象 store 也是）
Object.prototype.toString.call(store); // "[object Array]"
// 但常规用法都正常：
Object.keys(store); // ['count']
JSON.stringify(store); // '{"count":0}'
const copy = { ...store };
```

**后果**：拿 store 去走 `Array.isArray(x) ? … : …` 这类分支会误判成数组。
`typeof store` 仍是 `'object'`，用 `typeof` 判断不受影响。

**写法**：判断"是不是 store"不要用 `Array.isArray`；需要普通对象就先浅拷贝一层。

### P37 · 共享状态在 `attached()` 挂载时，`data` 的初始值要给**同形状**

```js
// ❌ data 给空对象，模板读嵌套路径 → 首帧 console: Error evaluating text expression
data: { store: {} },
// 模板里：{{store.nested.name}}

// ✅ 给同形状的初值；或者模板只读浅层路径（读 undefined 不抛）
data: { store: { nested: { name: '' } } },
attached() { this.store = store; },
detached() { this.store = {}; }, // 文档推荐的清理，照写
```

**现象**：页面照常渲染、功能正常，只有控制台里一条 `Error evaluating text expression: 'store.nested.name'`
（发生在 `attached()` 之前的那一帧）。**半静默**：不看控制台就发现不了。

**顺带一条**（测试 / 外部编排常踩）：proto 方法只有 `$('#host').method()` 能调，
`document.querySelector('#host').method` 是 `undefined`。

---

## 九、模板控制流与插槽

### P38 · `o-fill` / `o-if` 的内容在**它们自己的 light DOM** 里，容器的 `::slotted()` 够不到

```html
<!-- ❌ 分隔符 / 间距静默消失：mc-breadcrumb 的 ::slotted(mc-breadcrumb-item) 匹配不到 -->

<mc-breadcrumb>
  <o-fill :value="levels" fill-key="path">
    <mc-breadcrumb-item>…</mc-breadcrumb-item>
  </o-fill>
</mc-breadcrumb>

<!-- ✅ 每一级是直接子元素；整块显隐用属性钩子 -->
<mc-breadcrumb attr:data-hidden="visible ? null : ''">
  <mc-breadcrumb-item>…</mc-breadcrumb-item>
  <mc-breadcrumb-item current>…</mc-breadcrumb-item>
</mc-breadcrumb>
```

**现象**：页面照常渲染、控制台零报错，**只是容器的 `::slotted()` 规则（分隔符、间距、对齐）
全部不生效**。实测：`mc-breadcrumb` 的 `directChildren` 是 `['o-fill']`，
每一级的 `parentElement` 是 `o-else` / `o-if`，`::before` 的 `content` 是 `none`（本该是 `"/"`）。

**原因**：`o-fill` / `o-if` / `o-else` 都是自定义元素，条目渲染进的是**它们的** light DOM
（见 [P12](#p12--o-fill-把条目渲染在自己的-light-domiinnerhtml里)）。
`::slotted()` 只按「宿主元素的**被分配节点**」匹配，于是它看到的是 `o-fill`，不是里面的条目。

**为什么难查**：`o-fill` 是 `display: contents`，条目在**布局上**照旧参与父容器（flex 间距、
对齐都正常），只有 `::slotted()` 这一条路断掉 —— 看起来像「样式只丢了一半」。

**写法**：

- 组件内部用控制流渲染的条目，别指望容器用 `::slotted()` 去画东西；要么把条目直接写开，
  要么把视觉放在条目**自己的** shadow root / `:host` 上（`mc-menu-item` 就是后者）。
- 需要「第一项不画分隔符」这类**位置相关**的样式时尤其注意：`o-fill` 一旦包一层，
  `:first-child` 也会跟着变成对 `o-fill` 判断，位置语义就没了。
- 容器侧的选择器（`> .child`、`slot[name]` 之外的组合器）同理够不到嵌套条目，
  排查时先 `console.log([...host.children].map(e => e.tagName))` 看一眼真实子元素。

---

## 附：Mosaic 参考组件曾踩中的条目

`packages/button/button.html` 的第一版（照文档写的）踩了 **P1 / P2 / P10** 三条：
`disabled` 默认值写成 `false` 且没进 `attrs`、转发用了 `attr:disabled`、
loading 指示器用了 `<o-if>`。三条已修。这份清单的存在意义就是别再犯第二次。
