# 一、属性与响应式（最高频，先看这节）（P1 / P2 / P3 / P4 / P5 / P6 / P7 / P31 / P32 / P39）

> 索引见 [`README.md`](./README.md)。

---

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

ofa.js 版本升级时会把更多方法名收为保留（`refresh` / `sync` 已被 `$.fn` 占用）。
避开：`get` / `set` / `text` / `html` / `data` / `watch` / `on` / `emit` / `class` /
`style` / `remove` / `refresh` / `sync` 等。

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
