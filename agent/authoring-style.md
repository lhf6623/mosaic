# 组件样式与对外接口：`<style>` 五分区、事件、插槽与定制点

组件内部怎么组织样式（五分区）、事件怎么发、对外留哪些定制点（`:host` 优先、`part` 次之）。
造组件的第一层约定见 [`authoring.md`](./authoring.md)。

> **读这份的场合**：写组件的 `<style>`、定义事件、决定暴露哪些插槽 / part。

---

## 一、`<style>` 的五个分区

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

---

## 二、事件

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

---

## 三、插槽与定制点

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
有明确的样式污染风险，而且会触发宿主样式重注入导致重排（见 [P13/P14](pitfalls/03-style-scope.md)）。
只在 `::slotted()` 无法满足时使用。

⚠️ **但 `::slotted()` 只压得住「同一个封装上下文」里的规则**：插槽元素同时是外层 shadow 树里的
普通元素，`shadow-base.css` 对 `button` 的 reset（`padding` / `background` / `cursor`）会压过组件的
`::slotted(button)`。所以**行盒子级别的视觉一律写在宿主上**，插槽元素只当「铺满整行的交互层」
（完整的推演与两种写法对比见 [P33](pitfalls/03-style-scope.md)）。

⚠️ **模板里用了 `<l-m>` 就必须同时写 `l-m { display: none }`**，
否则它会作为 flex item 参与 `gap` 布局，造成间距不对称（[P13](pitfalls/03-style-scope.md)）。

---
