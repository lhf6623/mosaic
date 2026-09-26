# 八、状态管理（`$.stanz` / `o-provider`）（P35 / P36 / P37）

> 索引见 [`README.md`](./README.md)。

---

> ofa.js 有两套状态管理，都在**核心 dist** 里（零新依赖、不用构建）：
> 共享状态 `$.stanz({...})`，上下文状态 `<o-provider>` / `<o-consumer>` / `<o-root-provider>`。
> 三条都是**在 pin 的 ofa.js 4.7.5 上实测**出来的，完整记录见 [`research/state.md`](../research/state.md)。

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
