# 三、样式作用域（P13 / P14 / P15 / P16 / P33）

> 索引见 [`README.md`](./README.md)。

---

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
