# mc-popover

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/popover/popover.html` · **已实现**

通用浮层：面板锚在触发元素上，点空白或按 Esc 关掉。内容由使用者给 —— 菜单、表单、说明都行。

与 `mc-dropdown` / `mc-tooltip` 的分工：popover 是**通用容器**；那两个将来只是在它上面
固定住内容形态与交互的预设，共用同一套定位与层级。

```html
<mc-popover placement="bottom-start" arrow>
  <mc-button variant="outline">打开菜单</mc-button>
  <div slot="panel"><mc-menu>…</mc-menu></div>
</mc-popover>
```

## 属性

| 名称        | 值                                                       | 默认     | 说明                                     |
| ----------- | -------------------------------------------------------- | -------- | ---------------------------------------- |
| `placement` | `top` `bottom` `left` `right` × `-start` / 居中 / `-end` | `bottom` | 面板相对触发元素的方向；空间不够自动翻转 |
| `trigger`   | `click` `hover` `manual`                                 | `click`  | 怎么开；`manual` 只认 `open` 与 `show()` |
| `open`      | 布尔                                                     | —        | 受控开合：属性在就开、移除就关           |
| `arrow`     | 布尔                                                     | —        | 面板上一个小三角，方向跟着 `placement`   |

组件令牌（写在宿主 `style="…"` 上按实例覆盖）：
`--mc-popover-offset`（面板到触发元素的距离）、`--mc-popover-panel-bg`、
`--mc-popover-panel-border`（**轮廓色**，默认 `--mc-color-border-strong`：面板不画 `border`，
一圈描边是 drop-shadow 跟「面板 + 三角」整体轮廓做的，三角共用这一条）、
`--mc-popover-panel-radius`、`--mc-popover-panel-pad`、`--mc-popover-panel-min-width`。

## 方法

| 名称       | 说明                                                       |
| ---------- | ---------------------------------------------------------- |
| `show()`   | 打开；可被 `before-open` 拦掉（返回 `false` 表示这次没开） |
| `hide()`   | 关闭                                                       |
| `toggle()` | 开合互换                                                   |

## 事件

| 名称          | 类型                                            | 说明                                             |
| ------------- | ----------------------------------------------- | ------------------------------------------------ |
| `before-open` | `(event: Event & { data: { reason } }) => void` | 打开前；`preventDefault()` 可拦掉                |
| `open`        | `(event: Event & { data: { reason } }) => void` | 已打开                                           |
| `close`       | `(event: Event & { data: { reason } }) => void` | 已关闭；`reason` = `trigger` / `api` / `dismiss` |

## 插槽与 part

| 名称           | 说明                                             |
| -------------- | ------------------------------------------------ |
| 插槽（默认）   | 触发元素（**只放一个**；面板锚在它所在的容器上） |
| 插槽 `panel`   | 面板内容                                         |
| `part="panel"` | 面板本体                                         |
| `part="arrow"` | 小三角；没写 `arrow` 时不渲染                    |

## 实现约束（改这个组件前必须知道）

浮层的定位与层级**全部交给浏览器原生能力**，这是这个组件最核心的决定。六条实测出来的坑：

1. **不能退回 `position: fixed` + `z-index`**：shadow root 里的 fixed 会被宿主页面的
   `transform` / `filter` / `contain` 困住（实测同一个盒子 y 从 10 变成 1404）。
   原生 `popover="auto"` 进 top layer，不受层叠上下文影响，还白送 Esc 与点空白关闭 ——
   所以 `--mc-z-*` 这套层级令牌在浮层上**用不上**（top layer 天然在最上）。
2. **锚点必须设在 shadow 内的元素上**：把 `anchor-name` 设在 light DOM 的 slot 元素上无效
   （跨 shadow 边界不成立，面板会掉到 UA 默认位置）。所以触发元素外面套了一层 `.mc-anchor`。
3. **必须清掉 UA 给 popover 的 `inset: 0; margin: auto`**：那两个 auto 外边距会把
   `left: anchor(left)` 挤掉（面板水平居中而不是对齐）。组件里写的是 `inset: auto; margin: 0`，
   靠 `margin-top/bottom/left/right` 单独给间距。
4. **锚点容器必须是 `inline-flex`**：`inline-block` 会带上行盒的基线缝隙（实测锚点盒子比
   触发元素高 3px），而锚点的几何就是面板的定位基准 —— `top` / `right-start` / `left-start`
   这些方向会整体偏 3px。
5. **面板必须显式写 `border: 0`**：UA 给 `[popover]` 的是 `border: solid` —— 只写了 style，
   宽度取 medium（**3px**）、颜色取 currentColor，不写就得到一圈跟着文字颜色走的边框
   （实测亮色下 rgb(60 67 77)、暗色下接近白）。面板的描边现在由 `filter: drop-shadow` 跟
   「面板 + 三角」的**整体轮廓**做，所以这条必须显式归零；顺手也解释了为什么**面板不写
   `border`**：边框只长在矩形上，三角没有，轮廓会在三角那条边上断掉、显得三角是塌的。
6. **显示 / 收起原生浮层时，浏览器可能顺手把页面滚一下 —— 必须把滚动位置钉住**。
   实测火狐 156：在文档站的 Popover 页点一下触发元素，正文带 `.doc-main` 会跳一段
   （用户描述是「点一下页面往上蹿」）。二分结论：触发点是原生 `showPopover()` 这个动作
   （面板留在 DOM 里但不显示时完全不跳；把 `position-anchor` / `position-try-fallbacks`
   摘掉也照跳），与锚点定位、面板样式都无关。而浮层是 `fixed` + top layer，开合它**不该**
   改变页面滚动位置，所以在原生动作前后把位置钉住 —— 用 `packages/boot/scroll-pin.js`
   （跨组件共用的工具，别的浮层/组件也要兜这件事时直接 `import` 它即可）。
   三种形状都要覆盖，少一种就漏：**① 显示动作里的同步 / 下一帧 / 更晚 task**；
   **② 手势之后、显示之前就被滚**（`attr:open` → 模板重渲染可能先滚，等 `showPopover()`
   再记快照就晚了 —— 所以用手势时刻的位置当锚点）；**③ 浏览器自己发起的关闭**
   （light dismiss / Esc 不走 `hide()`，只有 `beforetoggle` 快照 + `toggle` 回滚能兜住）。
   往上找滚动容器必须穿透 shadow root 与 `<slot>`（正文带住在槽与宿主之间）。
   用户自己滚（滚轮 / 触摸 / 在别处按下）当帧放手：只拦浏览器顺手带出来的位移，不拦人。
   `packages/popover/test/popover.test.mjs` 对这三种形状各有一条断言 + 一条工具契约断言
   （都用「模拟浏览器滚页面」的方式，浏览器里不跳也能守住）。

另外两条：**`right` / `left` 的居中变体要单独写**（`anchor(center)` + `translate: 0 -50%`，
第一版和 `-start` 合并在一个选择器里，交叉轴贴的是顶边）；**`close` 事件只有一个出口**
（`show()` / `hide()` 都不直接发，统一由原生 `toggle` 派发，两处都发会重复）。

## 刻意不做的

- **不做进场 / 退场动画**：连续操作时动效拖慢手感，且 top layer 里 `transform` 受限、
  能做的效果有限。要动画的使用者自己在 `::part(panel)` 上加，或者用 `open` / `close`
  事件自己驱动。

## 浏览器要求

需要原生 `popover` 与 CSS 锚点定位（Chrome 125+ / Safari 17+ / Firefox 125+）。
没有这些能力的浏览器面板不会弹出 —— 组件不报错，但也没有替代路径。
