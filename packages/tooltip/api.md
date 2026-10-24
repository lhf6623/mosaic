# mc-tooltip

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./tooltip.html` · **已实现**

提示气泡：鼠标悬停或键盘聚焦时，在触发元素旁弹出一句纯文本 —— 非模态、不抢焦点、不拦交互。

与 [`mc-popover`](../popover/api.md) 的分工：popover 是通用容器（内容与交互都由使用者给），
tooltip 是「一句话」的预设，共用同一套锚点定位与层级；
与 [`mc-dialog`](../dialog/api.md) 的分工：dialog 是模态的（遮罩 + 焦点陷阱），tooltip 从不抢焦点。

```html
<mc-tooltip content="删除后无法恢复">
  <mc-button color="danger">删除</mc-button>
</mc-tooltip>
```

需要原生 `popover` 与 CSS 锚点定位（Chrome 125+ / Safari 17+ / Firefox 125+）。
没有这些能力的浏览器气泡不会弹 —— 组件不报错，但也没有替代路径。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/tooltip/tooltip.html"></l-m>

<mc-tooltip id="demo"></mc-tooltip>

<script type="module">
  await customElements.whenDefined('mc-tooltip');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/tooltip/tooltip.html"></l-m>

<mc-tooltip></mc-tooltip>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称        | 值                                                                                                                                                                   | 默认    | 说明                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| `content`   | `string`                                                                                                                                                             | —       | 气泡里的纯文本；要富内容就换 `mc-popover`                   |
| `placement` | `'top' \| 'top-start' \| 'top-end' \| 'bottom' \| 'bottom-start' \| 'bottom-end' \| 'left' \| 'left-start' \| 'left-end' \| 'right' \| 'right-start' \| 'right-end'` | `top`   | 气泡相对触发元素的方向（不写后缀 = 居中）；空间不够自动翻转 |
| `trigger`   | `'hover' \| 'focus' \| 'click'`                                                                                                                                      | `hover` | 怎么触发；`hover` 时悬停与聚焦**都**算（键盘可达靠聚焦）    |
| `delay`     | `number`                                                                                                                                                             | `100`   | 显示 / 隐藏的延迟（ms）；`0` 就是立刻                       |

## 插槽

| 名称     | 说明                                     |
| -------- | ---------------------------------------- |
| （默认） | 触发元素（写一个；组件不给它加任何属性） |

## part

| 名称    | 说明                                                  |
| ------- | ----------------------------------------------------- |
| `panel` | 气泡本体（底色 / 圆角 / 内边距 / 距离都可以从外面改） |
