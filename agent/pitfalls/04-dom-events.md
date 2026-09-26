# 四、DOM 与事件（P17 / P18 / P19 / P20 / P21 / P22 / P34）

> 索引见 [`README.md`](./README.md)。

---

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

> 现在两栏浮动、正文带 `.doc-main` 在外壳里滚（见 `docs/layout.html` 的 `<style>` 注释），
> 但这条规则对**任何**跨 shadow 往上找祖先的场景都成立，别删。

**正确写法**：每一步先看 `assignedSlot`（被投影的节点，扁平树里的父是那个 slot）：

```js
el = el.assignedSlot ?? el.parentNode ?? el.getRootNode()?.host ?? null;
```

`docs/components/toc.html` 的 `scroller()` 与 `packages/code/code.html` 的 `scrollableAncestor()`
都是按这条改的；同一条推论也适用于「找最近的宿主 / 找最近的容器」这类往上爬的代码。

**同一族的另一条**：`position: sticky` 的滑动区间 = **它所在 grid 行的高度**。
把分栏容器按一屏定高（`flex: 1 1 auto` + `grid-template-rows: minmax(0, 1fr)`），
行就塌成一屏，sticky 的侧栏一滚动就跟着走（看起来跟没写 sticky 一样）。
让容器按内容长高（`height: auto` + `flex: 0 0 auto` + `align-items: start`）即可 ——
详见 [`doc-site.md` 的「外壳布局与滚动」一节](../doc-site.md)。

---
