# mc-alert

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./alert.html` · **已实现**

页内提示条：一块语义色的小面，带图标、标题与描述，可关。
和 `message()` 的分工：alert 是**页内静态**的一块面（跟着内容流排版、不抢焦点、不会自己消失），
message 是命令式浮层（自己进场、自己走，不占版面）。

```html
<mc-alert heading="保存失败" color="danger" icon>磁盘已满，清理后重试。</mc-alert>
<mc-alert color="warning" variant="outline" icon closable on:close="el.remove()">
  这条不会自己消失，关掉由使用者决定。
</mc-alert>
<mc-alert color="info">
  <strong slot="title">富标题</strong>
  正文写在标签里，落进默认插槽。
</mc-alert>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/alert/alert.html"></l-m>

<mc-alert id="demo"></mc-alert>

<script type="module">
  await customElements.whenDefined('mc-alert');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/alert/alert.html"></l-m>

<mc-alert></mc-alert>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称       | 值                                                                       | 默认      | 说明                                                                                                 |
| ---------- | ------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `color`    | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `primary` | 语义色，只往四个色槽里填值；也可以是 hex（`#fff000` / `#fc0`），浅底按主题派生、文字色按对比度自动给 |
| `variant`  | `'subtle' \| 'solid' \| 'outline'`                                       | `subtle`  | 浅底深字 / 实心 / 描边（三档都保留 1px 边框，切换时高度不抖）                                        |
| `heading`  | `string`                                                                 | —         | 标题纯文本；富内容走 `title` 插槽                                                                    |
| `icon`     | `boolean`                                                                | —         | 左侧出现该色的内置语义图形；换成自己的图标走 `icon` 插槽                                             |
| `closable` | `boolean`                                                                | —         | 右侧出现 × 原生按钮（命中区 32×32），点击发 `close`                                                  |

## 事件

| 名称    | 类型                     | 说明                                                |
| ------- | ------------------------ | --------------------------------------------------- |
| `close` | `(event: Event) => void` | 点了 ×；冒泡 + `composed`，可挂在祖先上收全部提示条 |

## 插槽

| 名称     | 说明                                    |
| -------- | --------------------------------------- |
| （默认） | 描述正文；长文本自动折行                |
| `title`  | 标题富内容；没给时回退到 `heading` 属性 |
| `icon`   | 自定义图标；有内容时内置图形让位        |

## part

| 名称    | 说明                                       |
| ------- | ------------------------------------------ |
| `base`  | 整条：图标 / 正文 / × 那一行               |
| `icon`  | 图标容器（内置图形与 `icon` 插槽都在里面） |
| `title` | 标题行；没有标题时它会折掉                 |
| `body`  | 描述容器；正文为空时它会折掉               |
| `close` | 那个 × 按钮（32×32 的命中区）              |
