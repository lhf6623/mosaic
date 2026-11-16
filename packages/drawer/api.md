# mc-drawer

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./drawer.html` · **已实现**

侧滑抽屉：遮罩 + 贴着视口一侧的面板，打开时焦点进面板、<kbd>Tab</kbd> 在面板内循环，
<kbd>Esc</kbd> / 点遮罩 / × 关闭后焦点归还打开它的元素。

与 [`mc-dialog`](../dialog/api.md) 的分工：dialog 是**居中模态对话框**（短、需要用户立刻决策）；
drawer 是**贴边的长容器**（宽高比更纵向，适合详情 / 编辑表单 / 多标签内容）。两者都是模态、都抢焦点。

```html
<mc-drawer heading="委托单详情" size="lg" closable mask-closable>
  <p>正文</p>
  <mc-button slot="footer" variant="outline" on:click="close()">关闭</mc-button>
</mc-drawer>
```

需要原生 `popover`（Chrome 125+ / Safari 17+ / Firefox 125+）。
没有这个能力的浏览器面板不会出现 —— 组件不报错，但也没有替代路径。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/drawer/drawer.html"></l-m>

<mc-drawer id="demo"></mc-drawer>

<script type="module">
  await customElements.whenDefined('mc-drawer');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/drawer/drawer.html"></l-m>

<mc-drawer></mc-drawer>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称            | 值                     | 默认    | 说明                                                                     |
| --------------- | ---------------------- | ------- | ------------------------------------------------------------------------ |
| `open`          | `boolean`              | —       | 打开状态：属性在就开、移除就关；`drawer.open = true`（property）同样生效 |
| `heading`       | `string`               | —       | 标题纯文本；富标题走 `header` 插槽                                       |
| `placement`     | `'right' \| 'left'`    | `right` | 面板贴哪一侧                                                             |
| `closable`      | `boolean`              | —       | 头部右侧出现 × 原生按钮（`aria-label="关闭"`），点击即关                 |
| `mask-closable` | `boolean`              | —       | 点遮罩也关；不写时只有 <kbd>Esc</kbd> 与 × 两条关闭路径                  |
| `size`          | `'sm' \| 'md' \| 'lg'` | `md`    | 面板宽度三档（20 / 26 / 34rem）                                          |

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

| 名称      | 说明                                     |
| --------- | ---------------------------------------- |
| `overlay` | 遮罩层                                   |
| `panel`   | 抽屉面板（贴边 / 高度 / 底色都在它身上） |
| `header`  | 头部行（标题 + ×）                       |
| `body`    | 正文容器                                 |
| `footer`  | 底部行                                   |
