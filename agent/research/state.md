# ofa.js 状态管理（`$.stanz` / `o-provider`）调研：能不能用在 Mosaic 上

> 验证环境：ofa.js **4.7.5**（仓库 pin 的版本，`https://cdn.jsdelivr.net/gh/ofajs/ofa.js@4.7.5/dist/ofa.min.mjs`）、
> 本机 Chrome（playwright-core 驱动）、`node tools/serve.mjs`。**文中结论全部是本机实跑**，不是读文档推测。
> 官方文档（文档站是 SPA，直接抓只有壳，下面给的是仓库里的 md 源）：
> [状态管理 `$.stanz`](https://github.com/ofajs/ofa.js/blob/main/tutorial/cn/documentation/state-management.md)、
> [上下文状态 `o-provider`](https://github.com/ofajs/ofa.js/blob/main/tutorial/cn/documentation/context-state.md)。
> 标记约定：**【实测】** = 本机跑出来的；**【文档】** = 官方文档明确写的；**【推论】** = 由前两者推导。

---

## 0. TL;DR

| 问题                                      | 结论                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| 要不要额外依赖 / 构建                     | **不要**。`$.stanz` 与 `o-provider` / `o-consumer` / `o-root-provider` 都在核心 dist 里【实测】 |
| consumer 在组件 **shadow root** 里能用吗  | 能：找得到文档树上的 provider 与 root-provider，且**最近的同名 provider 优先**【实测】        |
| provider 的运行时更新                    | **只有走 ofa 数据层才生效**：`$('#p').customColor = x` / `getProvider(name).customX = x`【实测】 |
| 裸元素 `p.customColor = x` / `setAttribute` | **静默无效**（属性写上了，consumer 不动）【实测】                                              |
| `$.stanz` 是否深响应 / 跨实例共享          | 是。嵌套对象、数组 `push` / 索引写都跟；同模块的两个实例共享一份【实测】                        |
| `$.stanz` 的返回形状                      | **数组内核代理**：`Array.isArray(store) === true`、`[object Array]`（对象 store 也是）【实测】  |
| Mosaic 现在需要它吗                       | 不需要 —— 仓库里此前 0 处使用；先当「可用且有坑」记着【推论】                                   |

与此对应的坑已收进 [`../ofa-pitfalls.md`](../ofa-pitfalls.md) 的 **P35 / P36 / P37**。

---

## 1. 两套机制

|                  | 共享状态                             | 上下文状态                                                   |
| ---------------- | ------------------------------------ | ------------------------------------------------------------ |
| API              | `$.stanz({...})`（核心导出 `$.Stanz`） | `<o-provider name="x">` / `<o-root-provider name="x">` + `<o-consumer name="x" watch:custom-y="z">` |
| 作用域           | 模块级：谁 import 谁共享             | DOM 层级：向上找**最近的**同名 provider，找不到退到 root-provider |
| 组件里怎么用     | `attached()` 里 `this.store = store`，`detached()` 里清 | 组件模板里放 `<o-consumer>`，`watch:custom-y="字段"` 绑到 data |
| 不用模板的读法   | 直接读 store 属性                     | `$('#host').getProvider('x')` / `$.getRootProvider('x')`      |
| 变化通知         | `store.watch((e) => ...)`（`e.type` 是 `'set'` 之类）【实测】 | provider `dispatch('evt', { data })` → consumer 上 `on:evt` 收 |

```js
// 共享状态：模块级一份，所有引用的组件一起更新
export const cart = $.stanz({ total: 0, items: [], user: { name: '' } });
cart.total++;            // 组件里 this.cart.total++ 同理
cart.items.push({ id: 1 });
cart.user.name = '张三';  // 深响应，不需要整体替换

// 上下文状态：提供方在 DOM 上，消费方就近取值
// <o-root-provider name="cfg" custom-theme="dark"></o-root-provider>
// <o-consumer name="cfg" watch:custom-theme="theme"></o-consumer>
$('o-root-provider').customTheme = 'light'; // ✅ 改值只能这样（见 P35）
```

---

## 2. 实测记录

探针结构：一个 ofa 组件（`shadow root` 里放 `<o-consumer name="ctx" watch:custom-color="color">`，
并挂一份模块级 `$.stanz`），页面上摆一个 `o-root-provider(custom-color="red")`、
一个内层 `o-provider(custom-color="green")`、两个组件实例。

| 探针动作                                                        | 观测结果                                                        | 判定 |
| --------------------------------------------------------------- | --------------------------------------------------------------- | ---- |
| shadow root 里的 consumer 读文档树的 `o-root-provider`           | `red`                                                           | ✅   |
| 同一 consumer 在内层 `o-provider` 里                            | `green`（最近优先）                                             | ✅   |
| `$('#far').bump()`（组件 proto 改 store）→ 两个实例都读同一份    | 两个实例的 shadow DOM 都从 `0` 变 `1`                            | ✅   |
| 外部直接 `store.count = 40` / `store.nested.name = '外部改的'`    | 两个实例的文本都变                                              | ✅   |
| `store.list.push(...)` / `store.list[0].v = 99`                  | 模板里 `list.length` 跟着变                                     | ✅   |
| `$('o-root-provider').customColor = 'gold'`                      | consumer 从 `cyan` → `gold`                                     | ✅   |
| `$.getRootProvider('ctx').customColor = 'silver'`                | consumer → `silver`                                             | ✅   |
| `document.querySelector('o-root-provider').customColor = 'blue'` | consumer 仍是 `red`（`getAttribute` 读得到 blue）                | ❌ 静默 |
| `…setAttribute('custom-color', 'magenta')`                       | consumer 仍是 `cyan`（属性是 magenta）                           | ❌ 静默 |
| 移除 consumer 后再改 provider                                    | 不再更新（消费方没了，符合预期）                                | ✅   |
| `Array.isArray($.stanz({ a: 1 }))`                               | `true`；`Object.prototype.toString` → `[object Array]`           | ⚠️ 形状 |
| `Object.keys` / `JSON.stringify` / `{ ...store }`                | `['a']` / `'{"a":1}'` / `{ a: 1 }`，常规用法正常                 | ✅   |
| `data.store = {}` 而模板读 `{{store.nested.name}}`               | 首帧 `console: Error evaluating text expression`（页面照常渲染） | ⚠️ 半静默 |
| 从外部调 proto 方法                                              | `$('#host').bump()` 可用；`document.querySelector('#host').bump` 是 `undefined` | ⚠️ 写法 |

> 「属性写上了但 consumer 不动」是最值得记的一条：看 DOM 一切正常，只有消费方的数据不刷新，
> 反查成本高 —— 正是 [`../ofa-pitfalls.md`](../ofa-pitfalls.md) 收的那类。

---

## 3. 对 Mosaic 的适用性

**兼容的部分**【实测 + 推论】：

- **不破 C1/C5**：不引入新依赖、不用 npm、不用构建；核心 dist 一个 `<script>` 就够。
- **能穿 shadow 边界**：Mosaic 组件全是 shadow DOM，consumer 放组件模板里可以拿到页面上的 provider。
- **懒加载友好**：`o-provider` / `o-consumer` 是核心注册的元素，不需要额外 `<l-m>`。

**要留神的部分**：

- **接入点是 JS**，与 **C4「定制点只用原生 CSS」** 的定位不同。所以状态管理只能当**组件内部实现**，
  或者使用者本来就写 JS 的场景（全局配置、购物车、跨页缓存）；**不能**成为"想换主题就得先配一个 provider"。
- **降级路径**：组件读不到 provider 时必须仍可用（`getProvider()` 可能返回 null），
  和 `mc-code` 的高亮降级、外壳的工具类降级是同一套思路。
- **文档推荐的挂载姿势有副作用**：`attached()` 挂载意味着首帧 data 里没有数据，
  模板读嵌套路径会报错（P37）。

**还没测的**【推论】：

- **provider 放在 shadow root 里、consumer 在外层**（即「组件对外提供上下文」）——
  本次只验了反方向。若将来要让 `mc-*` 组件当 provider，先补这一条实测。
- `dispatch` / `o-consumer` 的 `on:xxx` 在 Mosaic 的 shadow DOM 组件之间的穿透细节。

**当前是否需要它**：不需要。文档站的数据是静态模块（`docs/site-map.js`），
组件之间靠属性 / 事件 / 令牌通信，仓库里 0 处使用状态管理。
将来最可能用上的地方是**命令式组件**（如 `mc-toast` 的队列）或**跨页共享的全局配置**。

---

## 4. 怎么复现

1. `pnpm dev`（或 `node tools/serve.mjs`），页面里引核心 dist：
   `https://cdn.jsdelivr.net/gh/ofajs/ofa.js@4.7.5/dist/ofa.min.mjs`
2. 页面上放 `<o-root-provider name="ctx" custom-color="red">`，组件模板里放
   `<o-consumer name="ctx" watch:custom-color="color">` + `{{color}}`。
3. 在控制台里对比三种改法：

```js
document.querySelector('o-root-provider').customColor = 'blue'; // ❌ 消费方不动
document.querySelector('o-root-provider').setAttribute('custom-color', 'blue'); // ❌ 同上
$('o-root-provider').customColor = 'blue'; // ✅
$.getRootProvider('ctx').customColor = 'blue'; // ✅
```

4. 共享状态：`const s = $.stanz({ n: { v: 1 }, list: [] })`，
   组件 `attached()` 里 `this.s = s`，然后从外部 `s.n.v++` / `s.list.push(1)`，
   看组件 shadow DOM 是否跟着变；顺带 `Array.isArray(s)` 验形状。

---

## 5. 官方文档没写、但会踩到的几点

| 点                                             | 文档                                  | 实测                        |
| ---------------------------------------------- | ------------------------------------- | --------------------------- |
| provider 改值必须走 ofa 数据层                 | 只给 `provider.customName = …` 的写法 | 裸元素属性 / `setAttribute` 无效 |
| consumer 放 shadow root 里的行为               | 未提跨 shadow 边界                    | 初始解析可以穿，最近优先    |
| `$.stanz` 返回值的形状                         | 未提                                  | 数组内核，`Array.isArray` 为 true |
| `data` 初始值形状与首帧表达式错误的关系        | 未提                                  | 嵌套路径 + 空对象 → 首帧报错 |
| proto 方法从外部调用要走 `$()`                 | 示例都在模板里写 `on:click`           | 裸元素上没有这个方法        |
