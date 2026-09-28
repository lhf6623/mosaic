# message（消息条）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M2 · 标签 `message` · 目录 `packages/message/`

命令式消息条：从顶部落下来一条，几秒后自己走；同 key 更新不叠加。

## 单元里有什么

| 文件 | 角色 |
| --- | --- |
| `message.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它） |
| `page.html` | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md` | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区 |
| `demos/` | 4 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**） |
| `test/` | 组件自己的冒烟套件（1 个文件） |
| `message.js` | 构建产物 / 附属文件 |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->
## 设计取舍

mc-message — 命令式消息条（容器）

⚠️ **这个组件不直接使用**：使用者只写 `message.success('已保存')`，由
`packages/message/message.js` 负责「懒注册 + 挂到 document.body + 往这个组件的 rows 里推数据」。
为什么做成两个文件：

ofa.js 是 MVVM，**模板只在组件定义期编译**；运行时 `innerHTML` 塞进去的 `{{ }}` / `o-fill` 全是死的。
所以命令式 API 的正确形态只能是「函数只碰数据，视图永远由声明期模板渲染」：
  1. 首次调用 → `<l-m src="message.html">` 把本组件注册上（实测运行时追加 l-m 可用）；
  2. `document.createElement('mc-message')` 挂到 body 末尾（**必须挂 body**：shadow root 里的
     position:fixed 会被宿主页面的 transform / filter / contain 困住，见 design-spec 第七节）；
  3. 之后一律 `$('mc-message')` 拿实例、原地改 `rows` —— 实测**从外部整体替换数组不会渲染**
     （`inst.rows = 外部数组` 之后 o-fill 一行动都不动），只能 push / splice。

为什么挂到 body 上也拿得到设计令牌：mosaic.js 给每个 shadow root adopt 两份表，
而令牌是自定义属性、从 :root 一路继承下来 —— 实测宿主上 `--mc-z-toast` 解析为 1500。

与 mc-alert 的分工：alert 是**页内静态**的一块面（在文档流里、不抢焦点、不会自己消失）；
message 是**命令式浮层**（自己进场自己走、不占版面）。两者都要「把状态告诉使用者」，
但一个在文档流里、一个在层级最上面，所以不是一个组件。

关闭方式只有一种：**右侧一个明确的 ×**（原生 <button>，32×32 命中区）。
要不要它由 `closable` 显式决定（默认 true）——**不跟 duration 推导**：
「关不关得掉」和「多久自己走」是两件事，混在一起读者从调用上看不出来。
**整条消息不可点** —— 它是给人读的，点一下就没不该是默认行为。

⚠️ 组件只负责把行从 rows 里摘掉；**队列删除、定时器、onClose 都在 message.js 的 drop() 里**。
宿主上那个 close 监听必须调 drop() —— 只清一半会让队列静默泄漏、onClose 永不触发（踩过）。

⚠️ 两个 ofa 的坑（都实测踩过，注释留在原地免得后人再踩）：
- `o-fill` 的模板只允许**一个**根子元素 —— 所以里面套了一层 `display: contents` 的 div
  来同时挂「显隐 + 退场动画 + popover 语义」三件事（P42 的成对写法）。
- 条目识别用 `$index`：`o-fill` 内**不能用 `attr:data-*` 绑 `$data`**（`data` 是保留字，
  见 P39 一族），所以 DOM → 数据只能靠位置反查，而 `$index` 实测可用。

## 令牌

> 消息条没有自己的 `--mc-message-*` 令牌：它复用 `mc-alert` 的四个色槽（同一套语义色 × 三档外观），
> 层级走 `--mc-z-toast`（能从 `:root` 继承进 shadow root，实测宿主上能解析出 `1500`）。

## 实现约束（改这个组件前必须知道）

1. **命令式的形态是三件事分开**：函数（队列 / 配置 / 懒挂载，无视图）→ 容器组件（声明期写好
   `o-fill` 列表，唯一有视图的地方）→ 两者只传数据。ofa 的模板**只在组件定义期编译**，
   运行时 `innerHTML` 塞进去的 `{{ }}` / `o-fill` 是死的 —— 所以"函数里拼 HTML 再挂上去"这条路不通。
2. **容器必须挂 `document.body`**：`position: fixed` 在 shadow root 里会被宿主页面上的
   `transform` / `filter` / `contain` 困住（新的层叠上下文）。
3. **外部只能原地改数组**：`$('mc-message').rows.push(...)` / `splice(...)` 有效；
   `inst.rows = 外部数组` 之后 `o-fill` **一行动都不渲染**（不报错，只是不更新）。
4. **`o-fill` 的条目里绑不到 proto 方法**：`on:click="activate"` 报「function not found」，
   `activate($event)` / `activate($index)` 报「Error evaluating element expression」并且
   **中断整块模板**。所以点击走**容器上的事件委托**，索引由 `attr:data-index="$index"` 带出来。
5. **`closable` 保持显式属性（默认 `true`），不要再做成「跟 `duration` 推导」**：
   试过一版「自己会走的不给 ×、`duration: 0` 才给」，结果是读者从调用上看不出关不关得掉；
   而且默认值一旦写成 `null` / `true`，`??` 链会把推导吃掉（踩过两回）。
   「关不关得掉」和「多久自己走」是两件事，让作者显式写 `closable`。

6. **proto / 生命周期里的 `this` 是 ofa 实例**：元素 API 要走 `this.ele`（`this.shadowRoot` 是 `undefined`）。
7. **组件把行摘掉之后，宿主必须在 `close` 事件里调 `drop()`** —— 不能只清定时器 / key 映射：
   否则队列里那条永远留着，静默泄漏、白占 `limit` 名额，`onClose` 也永远不触发
   （「同 key 更新」演示"关不掉"就是这个半截）。
8. **`onClose` 是在 `drop()` 里回调的，且先撤 key 再回调**：回调里很可能立刻用同一个 key
   推下一条（更新语义），留着旧映射会让新消息去替换一条已经不在队列里的旧项。

## 刻意不做的

- **不做 `loading` 类型**：转圈需要一直挂到被替换，语义上更接近"带 spinner 的常驻提示"，
  等有真实需求再加（加的时候只需在 `TYPES` 里补一条）。
- **不做四角位置**：现在只有顶部居中。要四角就得每角一个容器、每容器一份 `o-fill` 队列，
  成本翻倍，等有人真的用得着再说。
- **不做退场动画**：节点是被移除的，动画来不及播。要退场就得先标记、等 `transitionend` 再删，
  会让 `close()` 变成异步 —— 先按"立刻消失"落地。

## 为什么不发事件

> 页面上**没有**这一节：它是**配置里的 `onClose` 回调**，不是 DOM 事件 ——
> 调用方传函数进去，比在浮层容器上挂监听自然得多（容器是模块自己挂到 `document.body` 的）。
> 这一行留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- 与 [`mc-alert`](../alert/) 的分工：alert 是页内静态的一块面，message 是命令式浮层；**没有标签入口** —— 容器由模块自己挂到 `document.body` 末尾，图层问题（`position: fixed` 会被宿主页面的 `transform` / `filter` / `contain` 困住）就是在这里验的。

- 内部 `await load('../icon/icon.html')`：类型图标跟着 `type` 走。

<!-- hand:end -->

## 改这个单元之前

- 造组件 / 改样式：[`authoring.md`](../../agent/authoring.md) · [`authoring-style.md`](../../agent/authoring-style.md)
- 写组件前必读的踩坑清单：[`pitfalls/README.md`](../../agent/pitfalls/README.md)
- 跨组件约定与组件索引：[`api/README.md`](../../agent/api/README.md)
- 文档页怎么排：[`doc-pages.md`](../../agent/doc-pages.md)
