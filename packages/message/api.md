# message()

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./message.js`（入口）+ `./message.html`（视图） · **已实现**

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

---

## 属性

| 名称       | 值                                                         | 默认      | 说明                                                                                     |
| ---------- | ---------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `type`     | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'error'` | `neutral` | 语义色 + 图标；`error` 是紧急播报（`role="alert"`）                                      |
| `duration` | `number`                                                   | `3000`    | 毫秒；`0` = 不自动关                                                                     |
| `key`      | `string`                                                   | —         | 同 key 只留一条，后一条**换掉**前一条（位置保持）                                        |
| `closable` | `boolean`                                                  | `true`    | 右侧要不要 ×（**显式属性，不跟 `duration` 推导**）。`false` = 任务归组件管、不给用户打断 |
| `icon`     | `boolean`                                                  | 按 `type` | `neutral` 默认没有图标；其余四种各用同名内置语义图形                                     |
| `limit`    | `number`                                                   | `5`       | 同屏最多几条，超出从最旧的顶掉（走 `message.config()`，不能逐条给）。                    |
| `onClose`  | `() => void`                                               | —         | 这条消失时回调一次（点 × / 到点 / `close()` / `closeAll()` 都算）；让生产端停掉定时器    |

## 事件

| 名称                                                                | 类型                                                                   | 说明                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `message(text, config?)`                                            | `(text: string, config?: Config) => { close: () => void; id: string }` | 弹一条，返回 `{ close, id }`                                             |
| `message.neutral / info / success / warning / error(text, config?)` | `(text: string, config?: Config) => { close: () => void; id: string }` | 类型简写，等价于带上 `type`                                              |
| `message.close(keyOrId)`                                            | `(keyOrId?: string \| number) => void`                                 | 按 `key` 或返回的 `id` 收掉一条                                          |
| `message.closeAll()`                                                | `() => void`                                                           | 全收掉                                                                   |
| `message.config(options)`                                           | `(options: Config) => void`                                            | 改默认值（`duration` / `limit` / `closable` / `icon`），只影响之后创建的 |
