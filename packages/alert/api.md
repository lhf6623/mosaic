# mc-alert

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](../../agent/api/README.md)；踩坑见 [`../pitfalls/`](../../agent/pitfalls/README.md)。
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

---

## 属性

| 名称       | 值                                                                       | 默认      | 说明                                                                                                 |
| ---------- | ------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `color`    | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `primary` | 语义色，只往四个色槽里填值；也可以是 hex（`#fff000` / `#fc0`），浅底按主题派生、文字色按对比度自动给 |
| `variant`  | `'subtle' \| 'solid' \| 'outline'`                                       | `subtle`  | 浅底深字 / 实心 / 描边（三档都保留 1px 边框，切换时高度不抖）                                        |
| `heading`  | `string`                                                                 | —         | 标题纯文本；富内容走 `title` 插槽                                                                    |
| `icon`     | `boolean`                                                                | —         | 左侧出现该色的内置语义图形；换成自己的图标走 `icon` 插槽                                             |
| `closable` | `boolean`                                                                | —         | 右侧出现 × 原生按钮（`aria-label="关闭"`，命中区 32×32），点击发 `close`                             |

**没有 `size`**：提示条不是控件，高度由内容撑。要固定尺寸就写宿主 `style="padding: …"`
或 `--mc-alert-pad-*`。

## 事件

| 名称    | 类型                     | 说明                                                |
| ------- | ------------------------ | --------------------------------------------------- |
| `close` | `(event: Event) => void` | 点了 ×；冒泡 + `composed`，可挂在祖先上收全部提示条 |

## 插槽与 part

| 名称          | 说明                                       |
| ------------- | ------------------------------------------ |
| 插槽 （默认） | 描述正文；长文本自动折行                   |
| 插槽 `title`  | 标题富内容；没给时回退到 `heading` 属性    |
| 插槽 `icon`   | 自定义图标；有内容时内置图形让位           |
| part="base"   | 整条：图标 / 正文 / × 那一行               |
| part="icon"   | 图标容器（内置图形与 `icon` 插槽都在里面） |
| part="title"  | 标题行；没有标题时它会折掉                 |
| part="body"   | 描述容器；正文为空时它会折掉               |
| part="close"  | 那个 × 按钮（32×32 的命中区）              |
