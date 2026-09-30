# mc-loading-bar

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./loading-bar.html` · M3 · **已实现**

加载条。默认钉在视口顶部，也可以在容器里。**状态只有一个入口 `state`**：
`idle` 不出现、`loading` 出现并一路缓慢爬升（**永远到不了 100%**，所以看着不像卡住）、
`done` / `error` 是收尾 —— 先滑到 100%，再淡出消失，两者只差填充色。

和 `mc-progress` 的分工：progress 是**内容里**的状态展示（「这一块跑到哪了」，有 `value` / `max`），
loading-bar 是**整页 / 整路由在忙**（默认那种）或**某一整块在忙**（`position="static"`）——
它只有一个状态入口，没有数值。

```html
<mc-loading-bar state="loading"></mc-loading-bar>
<mc-loading-bar state="loading" size="sm" label="正在保存"></mc-loading-bar>

<!-- 收尾：成功与出错走同一条路（先滑到 100% 再淡出），只差一个填充色 -->
<mc-loading-bar state="done"></mc-loading-bar>
<mc-loading-bar state="error"></mc-loading-bar>

<!-- 放进容器：就在它所在的那一块里当一条细线 -->
<mc-loading-bar state="loading" position="static" label="正在刷新列表"></mc-loading-bar>
```

整页在忙那一根多半由 JS 驱动，所以同一个单元还有一个**函数入口**（懒挂载一条钉在视口顶部的
条子；函数与状态 1:1）：

```js
import loadingBar from '../../loading-bar/loading-bar.js';

loadingBar.start({ label: '正在保存' });
loadingBar.done(); // 成功收尾；出错走 loadingBar.error()

// 某一整块在忙：给它容器，条子落在那一块的最上沿（句柄是收它的入口）
const task = loadingBar.start({ target: '#list', label: '正在刷新列表' });
task.done();
```

---

## 属性

| 名称       | 值                                         | 默认     | 说明                                                                                                   |
| ---------- | ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------ |
| `state`    | `'idle' \| 'loading' \| 'done' \| 'error'` | `idle`   | 状态：`idle` 不出现；`loading` 在跑（爬升）；`done` / `error` 收尾（先滑到 100% 再淡出）。**唯一入口** |
| `size`     | `'sm' \| 'md'`                             | `md`     | 条高 2 / 4px（它不是控件，不借 `--mc-control-h-*`，同 `mc-progress`）                                  |
| `position` | `'fixed' \| 'static'`                      | `fixed`  | 钉在哪儿：`fixed` = 视口顶部（全局在忙）；`static` = 就在它所在的容器里，占自己那 2 / 4px 高、通宽     |
| `label`    | `string`                                   | `加载中` | 只给屏幕阅读器的文案：`loading` 时宿主是 `role="progressbar"` + `aria-busy` + 这个名字                 |

## 方法

| 名称                                                             | 说明                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `loadingBar.start(config?)`                                      | 开始：条子出现并缓慢爬升，返回**这一条**的句柄。`config` = `{ target?, label? }`；也可以直接给字符串（= `label`） |
| `handle.done()` / `handle.error()` / `handle.idle()`             | 收掉 `start({ target })` 那一条：`done` 滑满再淡出、`error` 同上只是换成 danger、`idle` 立刻收掉（不播收尾）      |
| `loadingBar.done()` / `loadingBar.error()` / `loadingBar.idle()` | 收掉**默认那条**（挂 `document.body`、钉在视口顶部）；它还没出现过就什么都不做                                    |

> `target` 收元素或选择器：给了它，条子就落在那个容器的**最上沿**、`position="static"`
> （占自己那 2 / 4px、通宽），与标签那一种同义；不给就用默认那条（视口顶部）。
> 「盖在容器上沿、不占布局」得给条子写内联 `position: absolute` —— 那是使用者给元素写样式的活，
> 走标签入口（模块没法替人写内联样式）。

## part

| 名称       | 说明                            |
| ---------- | ------------------------------- |
| part="bar" | 内部填充条；换色 / 换形状都改它 |

> **没有单独的「出错」属性**：出错和成功走的是**同一条收尾**（先滑到 100%，再淡出消失），
> 差别只有填充色 —— 所以它由 `state="error"` 表达，不需要第二个布尔属性。
> 它**一闪而过**，所以请把 `label` 写成能说明失败的话（如「加载失败」），
> 而真正需要留在屏幕上的失败提示交给页面自己的 `mc-message` / `mc-alert`。
>
> **容器里怎么放**：`position="static"` 只是把定位交回文档流（块级、通宽、占 2 / 4px），
> 组件**不去猜容器** —— 不套 `absolute`、也不要求容器 `position: relative`。要让它盖在容器
> 上沿，自己写 `style="position: absolute; inset-inline: 0; top: 0"`（内联优先级更高）。
>
> **`pointer-events: none` 写在宿主上，不是默认值而是定义**：默认那一种横跨整个视口顶部，
> 若默认能接收指针，顶栏 / 弹层 / 按钮在那 2~4px 高度上的点击会被整条吞掉 ——
> 而且这种坏法在视觉上完全看不出来。要改请显式覆盖。
