# mc-loading-bar

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./loading-bar.html` · M3 · **已实现**

全局加载条：钉在视口顶部的一条细线，`active` 时出现并一路缓慢爬升（**永远到不了 100%**，
所以看着不像卡住），关掉时滑满 → 淡出 → 复位。

和 `mc-progress` 的分工：progress 是**内容里**的状态展示（「这一块跑到哪了」，有 `value` / `max`），
loading-bar 是**全局**的「整页 / 整路由在忙」—— 它铺满视口宽度、浮在所有内容之上，
通常由路由切换或一次全局请求驱动，一个页面同时只有一个。

```html
<mc-loading-bar active></mc-loading-bar>
<mc-loading-bar active color="success" size="sm" label="正在保存"></mc-loading-bar>
<mc-loading-bar active color="#ff6b35"></mc-loading-bar>

<!-- 放进容器：就在它所在的那一块里当一条细线（卡片 / 面板的「这一块在刷新」） -->
<mc-loading-bar active position="static" label="正在刷新列表"></mc-loading-bar>

<!-- 出错：转成 error 色（默认 danger）并停在满格，直到你清掉 error —— 重试时记得清 -->
<mc-loading-bar error label="加载失败"></mc-loading-bar>
```

---

## 属性

| 名称       | 值                                                          | 默认      | 说明                                                                                                                             |
| ---------- | ----------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `active`   | `boolean`                                                   | —         | 正在加载。`true` 出现并爬升；`false` 滑满 → 淡出 → 复位（再 `true` 从 0 重来）                                                   |
| `color`    | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | `primary` | 语义色，只往填充色槽里填值；也可以是 hex（`#ff6b35`）**出错时被 `error` 压过**                                                   |
| `size`     | `'sm' \| 'md'`                                              | `md`      | 条高 2 / 4px（它不是控件，不借 `--mc-control-h-*`，同 `mc-progress`）                                                            |
| `position` | `'fixed' \| 'static'`                                       | `fixed`   | 钉在哪儿：`fixed` = 视口顶部（全局在忙）；`static` = 就在它所在的容器里，占自己那 2 / 4px 高、通宽                               |
| `label`    | `string`                                                    | `加载中`  | 只给屏幕阅读器的文案：在跑时宿主是 `role="progressbar"` + `aria-busy` + 这个名字，不显示在界面上                                 |
| `error`    | `boolean`                                                   | —         | 出错态：填充换成 `--mc-loading-bar-error`（默认 danger），滑到满格后**停在那儿**（不淡出），直到清掉它。压过 `color` 与 `active` |

## part

| 名称       | 说明                            |
| ---------- | ------------------------------- |
| part="bar" | 内部填充条；换色 / 换形状都改它 |

> **无障碍**：在跑时宿主是 `role="progressbar"` + `aria-busy="true"` + `aria-label`（取 `label`），
> 不确定态**不写** `aria-valuenow`（和 `mc-progress` 的不确定态一个口径）；
> 没在跑时三个属性一起撤掉，不留语义痕迹。图形本身 `aria-hidden="true"`。
>
> **出错态是「粘住」的**：`error` 在的时候条子停在满格不淡出、也不会自己复位 ——
> 清掉它（`bar.error = false`）之后才按当时的 `active` 回到正常状态机（还在跑就重新爬，
> 否则红着滑满淡出）。一闪而过的错误提示等于没提示。出错时 `aria-busy` 会被撤掉
> （不再「在忙」），请把 `label` 换成能说明失败的话（如「加载失败」）。
>
> **容器里怎么放**：`position="static"` 只是把定位交回文档流（块级、通宽、占 2 / 4px），
> 组件**不去猜容器** —— 不套 `absolute`、也不要求容器 `position: relative`。要让它盖在容器
> 上沿，自己写 `style="position: absolute; inset-inline: 0; top: 0"`（内联优先级更高）。
>
> **`pointer-events: none` 写在宿主上，不是默认值而是定义**：默认那一种横跨整个视口顶部，
> 若默认能接收指针，顶栏 / 弹层 / 按钮在那 2~4px 高度上的点击会被整条吞掉 ——
> 而且这种坏法在视觉上完全看不出来。要改请显式覆盖。
