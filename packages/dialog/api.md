# mc-dialog

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./dialog.html` · **已实现**

模态对话框：遮罩 + 居中面板，打开时焦点进面板、<kbd>Tab</kbd> 在面板内循环，
<kbd>Esc</kbd> / 点遮罩 / × 关闭后焦点归还打开它的元素。

与 [`mc-popover`](../popover/api.md) / [`mc-tooltip`](../tooltip/api.md) 的分工：那两者是**非模态**浮层
（锚在触发元素上、不抢焦点、点空白就消失）；dialog 是**模态**的 —— 自带遮罩、抢焦点、Tab 出不去。

```html
<mc-dialog heading="确认删除" closable mask-closable>
  <p>删除后无法恢复。</p>
  <mc-button slot="footer" on:click="remove()">删除</mc-button>
</mc-dialog>
```

需要原生 `popover`（Chrome 125+ / Safari 17+ / Firefox 125+）。
没有这个能力的浏览器面板不会出现 —— 组件不报错，但也没有替代路径。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/dialog/dialog.html"></l-m>

<mc-dialog id="demo"></mc-dialog>

<script type="module">
  await customElements.whenDefined('mc-dialog');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/dialog/dialog.html"></l-m>

<mc-dialog></mc-dialog>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称            | 值                     | 默认 | 说明                                                                     |
| --------------- | ---------------------- | ---- | ------------------------------------------------------------------------ |
| `open`          | `boolean`              | —    | 打开状态：属性在就开、移除就关；`dialog.open = true`（property）同样生效 |
| `heading`       | `string`               | —    | 标题纯文本；富标题走 `header` 插槽                                       |
| `closable`      | `boolean`              | —    | 头部右侧出现 × 原生按钮（`aria-label="关闭"`），点击即关                 |
| `mask-closable` | `boolean`              | —    | 点遮罩也关；不写时只有 <kbd>Esc</kbd> 与 × 两条关闭路径                  |
| `size`          | `'sm' \| 'md' \| 'lg'` | `md` | 面板宽度三档（22 / 32 / 44rem）                                          |

## 事件

| 名称    | 类型                     | 说明                                              |
| ------- | ------------------------ | ------------------------------------------------- |
| `open`  | `(event: Event) => void` | 面板已打开（冒泡 + `composed`）                   |
| `close` | `(event: Event) => void` | 面板已关闭，三条关闭路径都发（冒泡 + `composed`） |

## 插槽

| 名称     | 说明                                |
| -------- | ----------------------------------- |
| （默认） | 正文                                |
| `header` | 富标题；没给时回退到 `heading` 属性 |
| `footer` | 底部操作区；没有内容时整行不占位    |

## part

| 名称      | 说明                                       |
| --------- | ------------------------------------------ |
| `overlay` | 遮罩层                                     |
| `panel`   | 对话框面板（圆角 / 底色 / 宽度都在它身上） |
| `header`  | 头部行（标题 + ×）                         |
| `body`    | 正文容器                                   |
| `footer`  | 底部行                                     |
