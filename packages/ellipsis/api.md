# mc-ellipsis

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./ellipsis.html` · **已实现**

长文本单行省略；截断时浮出完整内容，浮层里的文字**可选中、可复制**（带复制按钮）。

和 [`mc-tooltip`](../tooltip/api.md) 的分工：tooltip 是一句话提示，浮层不可交互、不抢焦点；
ellipsis 的文字本身就是内容，浮层需要被阅读 / 选中 / 复制，所以用可交互面板。

需要原生 `popover` 与 CSS 锚点定位（Chrome 125+ / Safari 17+ / Firefox 125+）；
没有这些能力时退回原生 `title`，文字仍可看到（但不可选中）。

```html
<l-m src="./packages/ellipsis/ellipsis.html"></l-m>

<div style="width: 160px">
  <mc-ellipsis>深圳美高创新科技股份有限公司（华东区）</mc-ellipsis>
</div>
<mc-ellipsis text="完整文本也可以走 text 属性" placement="top-start"></mc-ellipsis>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property。

**ofa 模板**：在 template page / template component 里可以写绑定。

---

## 属性

| 名称        | 值                                                   | 默认           | 说明                                                                   |
| ----------- | ---------------------------------------------------- | -------------- | ---------------------------------------------------------------------- |
| `text`      | `string`                                             | —              | 完整文本；不传就读默认插槽的文本（推荐用插槽，文本里的 HTML 会被忽略） |
| `placement` | `'bottom-start' \| 'bottom' \| 'top-start' \| 'top'` | `bottom-start` | 浮层相对触发文本的方位；空间不够自动翻转                               |
| `always`    | `boolean`                                            | —              | 文本没有截断也允许浮层（默认只在截断时弹）                             |

## 事件

| 名称   | 类型                                                  | 说明                                     |
| ------ | ----------------------------------------------------- | ---------------------------------------- |
| `copy` | `(event: Event & { data: { text: string } }) => void` | 复制按钮成功写入剪贴板后冒泡（composed） |

## 插槽

| 名称     | 说明                       |
| -------- | -------------------------- |
| （默认） | 被省略的完整文本（纯文本） |

## part

| 名称    | 说明                                 |
| ------- | ------------------------------------ |
| `text`  | 触发区（省略号所在的那一行，可聚焦） |
| `panel` | 浮层面板（可选中文本、含复制按钮）   |
| `full`  | 面板内的完整文本                     |
| `copy`  | 复制按钮                             |
