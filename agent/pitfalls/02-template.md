# 二、模板语法（P8 / P9 / P10 / P11 / P12 / P30）

> 索引见 [`README.md`](./README.md)。

---

### P8 · `{{...}}` 只能用在文本节点

属性值一律用 `attr:` / `:prop` / `:style.` 指令。
另外 **`<code>` 标签内的 `{{...}}` 不会被编译**（静默跳过，字面显示）——
需要等宽样式时用 `<span class="code">` + `font-family: ui-monospace` 模拟。

> ⚠️ **把运行时建 DOM 改成模板时最容易踩这条**：`el('code', { textContent: x })` 没问题
> （赋值走的是 DOM API），改成 `<code>{{x}}</code>` 就变成页面上显示字面量 `{{x}}` ——
> 不报错、只是"没渲染"。Mosaic 的 `docs/components/cards.html` 就这么中过一次
> （`<code class="doc-comp-card-tag">{{$data.tagName}}</code>`，24 张卡片全显示字面量）。
> 改法：换成 `<span class="…">`，等宽字体在组件 `<style>` 里补 `font-family: var(--mc-font-mono)`。

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
