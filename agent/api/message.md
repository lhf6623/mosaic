# message()

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/message/message.js`（入口）+ `packages/message/message.html`（视图） · **已实现**

浮层消息条：从屏幕顶部中间落下来一条，几秒后自己走。**没有标签入口** —— 它由 JS 调用，
容器由模块自己挂到 `document.body` 末尾。

和 `mc-alert` 的分工：alert 是**页内静态**的一块面（跟着内容流排版、不抢焦点、不会自己消失）；
message 是**命令式浮层**（自己进场、自己走、不占版面）。

```js
import message from '../../message/message.js';

message('已保存');
message.success('上传完成', { duration: 5000 });
const m = message({ text: '保存中…', key: 'save', duration: 0 });
m.close();
```

## 方法

| 名称                                                                | 说明                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `message(text, config?)`                                            | 弹一条，返回 `{ close, id }`                                             |
| `message.neutral / info / success / warning / error(text, config?)` | 类型简写，等价于带上 `type`                                              |
| `message.close(keyOrId)`                                            | 按 `key` 或返回的 `id` 收掉一条                                          |
| `message.closeAll()`                                                | 全收掉                                                                   |
| `message.config(options)`                                           | 改默认值（`duration` / `limit` / `closable` / `icon`），只影响之后创建的 |

## 配置

| 名称       | 值                                           | 默认      | 说明                                                                                     |
| ---------- | -------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `type`     | `neutral` `info` `success` `warning` `error` | `neutral` | 语义色 + 图标；`error` 是紧急播报（`role="alert"`）                                      |
| `duration` | 毫秒                                         | `3000`    | `0` = 不自动关                                                                           |
| `key`      | 字符串                                       | —         | 同 key 只留一条，后一条**换掉**前一条（位置保持）                                        |
| `closable` | 布尔                                         | `true`    | 右侧要不要 ×（**显式属性，不跟 `duration` 推导**）。`false` = 任务归组件管、不给用户打断 |
| `icon`     | 布尔                                         | 按 `type` | `neutral` 默认没有图标；其余四种各用同名内置语义图形                                     |
| `limit`    | 数字（走 `message.config()`，不能逐条给）    | `5`       | 同屏最多几条，超出从最旧的顶掉                                                           |
| `onClose`  | 函数                                         | —         | 这条消失时回调一次（点 × / 到点 / `close()` / `closeAll()` 都算）；让生产端停掉定时器    |

## 什么时候写 `closable: false`

**任务还没结束**的时候。典型是「保存中」这类由代码驱动、完成前不该被用户打断的提示：

```js
message('保存中…', { key: 'save', type: 'info', duration: 0, closable: false });
// …任务完成，用同一个 key 换成结果（这条默认带 ×），3 秒后自己走
message('已保存', { key: 'save', type: 'success', duration: 3000 });
```

如果这条允许点掉，用户会以为保存被取消了，而任务其实还在跑 —— 所以关不关得掉要由
**谁拥有这个任务**来决定，不是由时长。反过来，纯告知的提示（「已复制」）不需要交互，
写 `closable: false` 只是少一个按钮，别用 `duration: 0`（那会变成关不掉的孤儿消息）。

## 无障碍

容器是 `aria-live` 区域：`role="log"` + `aria-live="polite"`；队列里出现 `error` 时整块切到
`assertive` + `role="alert"`（立刻播报），`error` 收掉后回到 `polite`。
类型图标是装饰性的（`mc-icon` 不给 label 即 `aria-hidden`），含义由文案承担。

关闭方式只有一种：**右侧的 × 按钮**（`closable` 默认 `true`；写 `false` 就没有按钮）（原生 `<button>`，`aria-label="关闭提示：<正文>"`）。
整条消息**不可点** —— 消息是要读的，点一下就没不该是默认行为。另外 `message()`
返回的 `{ close }` 句柄可以从代码里关。

## 实现约束（改这个组件前必须知道）

1. **命令式的形态是三件事分开**：函数（队列 / 配置 / 懒挂载，无视图）→ 容器组件（声明期写好
   `o-fill` 列表，唯一有视图的地方）→ 两者只传数据。ofa 的模板**只在组件定义期编译**，
   运行时 `innerHTML` 塞进去的 `{{ }}` / `o-fill` 是死的 —— 所以"函数里拼 HTML 再挂上去"这条路不通。
2. **容器必须挂 `document.body`**：`position: fixed` 在 shadow root 里会被宿主页面上的
   `transform` / `filter` / `contain` 困住（新的层叠上下文）。层级走 `--mc-z-toast`，
   令牌能从 `:root` 继承进 shadow root（实测宿主上能解析出 `1500`）。
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
