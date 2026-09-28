# mc-popover

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](../../agent/api/README.md)；踩坑见 [`../pitfalls/`](../../agent/pitfalls/README.md)。
> 源码 `./popover.html` · **已实现**

通用浮层：面板锚在触发元素上，点空白或按 Esc 关掉。内容由使用者给 —— 菜单、表单、说明都行。

与 `mc-dropdown` / `mc-tooltip` 的分工：popover 是**通用容器**；那两个将来只是在它上面
固定住内容形态与交互的预设，共用同一套定位与层级。

```html
<mc-popover placement="bottom-start" arrow>
  <mc-button variant="outline">打开菜单</mc-button>
  <div slot="panel"><mc-menu>…</mc-menu></div>
</mc-popover>
```

需要原生 `popover` 与 CSS 锚点定位（Chrome 125+ / Safari 17+ / Firefox 125+）。
没有这些能力的浏览器面板不会弹出 —— 组件不报错，但也没有替代路径。

---

## 属性

| 名称        | 值                                                       | 默认     | 说明                                     |
| ----------- | -------------------------------------------------------- | -------- | ---------------------------------------- |
| `placement` | `top` `bottom` `left` `right` × `-start` / 居中 / `-end` | `bottom` | 面板相对触发元素的方向；空间不够自动翻转 |
| `trigger`   | `click` `hover` `manual`                                 | `click`  | 怎么开；`manual` 只认 `open` 与 `show()` |
| `open`      | 布尔                                                     | —        | 受控开合：属性在就开、移除就关           |
| `arrow`     | 布尔                                                     | —        | 面板上一个小三角，方向跟着 `placement`   |

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

## 插槽

| 名称     | 说明                                             |
| -------- | ------------------------------------------------ |
| （默认） | 触发元素（**只放一个**；面板锚在它所在的容器上） |
| `panel`  | 面板内容                                         |

## part

| 名称    | 说明                          |
| ------- | ----------------------------- |
| `panel` | 面板本体                      |
| `arrow` | 小三角；没写 `arrow` 时不渲染 |
