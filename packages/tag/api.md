# mc-tag

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./tag.html` · **已实现**

分类 / 状态标签。和 `mc-badge` 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互），
tag 是「内容本身」的标签 —— 它才有关闭与选中。

```html
<mc-tag color="success">已发布</mc-tag>
<mc-tag color="warning" variant="outline" size="sm">待审核</mc-tag>
<mc-tag closable on:close="onTagClose($event)">设计</mc-tag>
<mc-tag checkable selected color="primary" on:change="picked = $event.data.selected">已实现</mc-tag>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/tag/tag.html"></l-m>

<mc-tag id="demo"></mc-tag>

<script type="module">
  await customElements.whenDefined('mc-tag');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/tag/tag.html"></l-m>

<mc-tag></mc-tag>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称        | 值                                                                       | 默认      | 说明                                                                                                                       |
| ----------- | ------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `color`     | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `neutral` | 语义色。默认中性 —— 标签是分类标记，语义色是强调；也可以是 hex（`#fff000` / `#fc0`），浅底按主题派生、文字色按对比度自动给 |
| `variant`   | `'subtle' \| 'solid' \| 'outline'`                                       | `subtle`  | 浅底深字 / 实心 / 描边（三档都保留 1px 边框，切换时高度不抖）                                                              |
| `size`      | `'sm' \| 'md' \| 'lg'`                                                   | `md`      | 只改字号与左右内边距；高度 = 行高 + 上下内边距 + 边框 = 26 / 30 / 34px                                                     |
| `closable`  | `boolean`                                                                | —         | 右侧出现 × 按钮（命中区 24×24）                                                                                            |
| `checkable` | `boolean`                                                                | —         | 整块可点，点击切换选中态                                                                                                   |
| `selected`  | `boolean`                                                                | —         | 选中态（配合 `checkable`）；运行时 `el.selected = true` 立刻生效                                                           |
| `disabled`  | `boolean`                                                                | —         | 压暗 50%，不可选也不可关                                                                                                   |

## 事件

| 名称     | 类型                                                       | 说明                                                                |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `change` | `(event: Event & { data: { selected: boolean } }) => void` | `checkable` 的选中态变化；冒泡 + `composed`，可挂在祖先上收全部标签 |
| `close`  | `(event: Event) => void`                                   | 点了 ×；冒泡 + `composed`，可挂在祖先上收全部标签                   |

## 插槽

| 名称     | 说明     |
| -------- | -------- |
| （默认） | 标签内容 |

## part

| 名称    | 说明                                 |
| ------- | ------------------------------------ |
| `close` | 关闭按钮（×），单独换色 / 换形状用它 |
