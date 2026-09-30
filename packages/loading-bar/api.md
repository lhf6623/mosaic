# mc-loading-bar

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./loading-bar.html` · M3 · **已实现**

全局顶部加载条：钉在视口顶部的一条细线，`active` 时出现并一路缓慢爬升（**永远到不了 100%**，
所以看着不像卡住），关掉时滑满 → 淡出 → 复位。

和 `mc-progress` 的分工：progress 是**内容里**的状态展示（「这一块跑到哪了」，有 `value` / `max`），
loading-bar 是**全局**的「整页 / 整路由在忙」—— 它铺满视口宽度、浮在所有内容之上，
通常由路由切换或一次全局请求驱动，一个页面同时只有一个。

```html
<mc-loading-bar active></mc-loading-bar>
<mc-loading-bar active color="success" size="sm" label="正在保存"></mc-loading-bar>
<mc-loading-bar active color="#ff6b35"></mc-loading-bar>
```

---

## 属性

| 名称     | 值                                                          | 默认      | 说明                                                                                             |
| -------- | ----------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `active` | `boolean`                                                   | —         | 正在加载。`true` 出现并爬升；`false` 滑满 → 淡出 → 复位（再 `true` 从 0 重来）                   |
| `color`  | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | `primary` | 语义色，只往填充色槽里填值；也可以是 hex（`#ff6b35`）                                            |
| `size`   | `'sm' \| 'md'`                                              | `md`      | 条高 2 / 4px（它不是控件，不借 `--mc-control-h-*`，同 `mc-progress`）                            |
| `label`  | `string`                                                    | `加载中`  | 只给屏幕阅读器的文案：在跑时宿主是 `role="progressbar"` + `aria-busy` + 这个名字，不显示在界面上 |

## part

| 名称       | 说明                            |
| ---------- | ------------------------------- |
| part="bar" | 内部填充条；换色 / 换形状都改它 |

> **无障碍**：在跑时宿主是 `role="progressbar"` + `aria-busy="true"` + `aria-label`（取 `label`），
> 不确定态**不写** `aria-valuenow`（和 `mc-progress` 的不确定态一个口径）；
> 没在跑时三个属性一起撤掉，不留语义痕迹。图形本身 `aria-hidden="true"`。
>
> **`pointer-events: none` 写在宿主上，不是默认值而是定义**：它横跨整个视口顶部，
> 若默认能接收指针，顶栏 / 弹层 / 按钮在那 2~4px 高度上的点击会被整条吞掉 ——
> 而且这种坏法在视觉上完全看不出来。要改请显式覆盖。
