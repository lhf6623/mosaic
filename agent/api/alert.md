# mc-alert

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/alert/alert.html` · **已实现**

页内提示条：一块语义色的小面，带图标、标题与描述，可关。
和 `toast()` 的分工：alert 是**页内静态**的一块面（跟着内容流排版、不抢焦点、不会自己消失），
toast 是命令式浮层（自己进场、自己走，不占版面）。

| 名称       | 值                                                      | 默认      | 说明                                                                     |
| ---------- | ------------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `color`    | `primary` `info` `success` `warning` `danger` `neutral` | `primary` | 语义色，只往四个色槽里填值                                               |
| `variant`  | `subtle` `solid` `outline`                              | `subtle`  | 浅底深字 / 实心 / 描边（三档都保留 1px 边框，切换时高度不抖）            |
| `heading`  | 字符串                                                  | —         | 标题纯文本；富内容走 `title` 插槽                                        |
| `icon`     | 布尔                                                    | —         | 左侧出现该色的内置语义图形；换成自己的图标走 `icon` 插槽                 |
| `closable` | 布尔                                                    | —         | 右侧出现 × 原生按钮（`aria-label="关闭"`，命中区 32×32），点击发 `close` |

**没有 `size`**：提示条不是控件，高度由内容撑。要固定尺寸就写宿主 `style="padding: …"`
或 `--mc-alert-pad-*`。

| 名称           | 说明                                       |
| -------------- | ------------------------------------------ |
| 插槽（默认）   | 描述正文；长文本自动折行                   |
| 插槽 `title`   | 标题富内容；没给时回退到 `heading` 属性    |
| 插槽 `icon`    | 自定义图标；有内容时内置图形让位           |
| `part="base"`  | 整条：图标 / 正文 / × 那一行               |
| `part="icon"`  | 图标容器（内置图形与 `icon` 插槽都在里面） |
| `part="title"` | 标题行；没有标题时它会折掉                 |
| `part="body"`  | 描述容器；正文为空时它会折掉               |
| `part="close"` | 那个 × 按钮（32×32 的命中区）              |

| 名称    | 类型                     | 说明                                                |
| ------- | ------------------------ | --------------------------------------------------- |
| `close` | `(event: Event) => void` | 点了 ×；冒泡 + `composed`，可挂在祖先上收全部提示条 |

**标题属性叫 `heading` 不是 `title`**：原生 `title` 会弹浏览器自己的 tooltip，而且 ofa 会把声明过的
字符串属性以空值写到宿主上（[P32](../pitfalls/01-props.md)）。插槽名仍是 `title` —— 插槽名不产生属性。
和 `mc-collapse-item` 的「`header` 属性 + `header` 插槽」同构。

**空内容靠宿主上的三个钩子折掉**：`data-has-title` / `data-has-body` / `data-has-icon`
（slotchange + `heading` 的值一起判定，写宿主只能在 `attached()` 之后，[P31](../pitfalls/01-props.md)）。
没有它们时空标题会白占一行、空正文会白留一个 gap。

**图标是内置的静态 SVG**：四个语义图形 —— 信息圆（`primary` / `info` / `neutral` 共用）、对勾、
三角叹号、叉圆；装饰性、容器带 `aria-hidden`。要别的图标就写 `slot="icon"`（有内容时内置图形让位），
那时无障碍由使用者负责。

**不预设 `role`**：静态提示条不该在被渲染出来时就让屏幕阅读器播报。动态插入的报错要播报，使用者
自己在宿主上加 `role="alert"`（紧急）/ `role="status"`（礼貌）—— 组件不覆盖它。

**`closable` 只发 `close`，不删 DOM**（组件不改使用者的 DOM，同 `mc-tag` / `mc-menu` / `mc-breadcrumb`）：
自己在事件里 `el.remove()` 或改数据。× 是 32×32 命中区的原生按钮，靠 `-6px` 的上下负外边距抵消掉
超出行高的部分，所以加不加 `closable`、单行提示条都一样高（46px）。

| 令牌                      | 默认                               | 作用                                                               |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `--mc-alert-fill`         | 按 `color`                         | `solid` 的底色                                                     |
| `--mc-alert-on-fill`      | 按 `color`                         | 实心上的文字色                                                     |
| `--mc-alert-accent`       | 按 `color`                         | `subtle` 的文字与图标、`outline` 的线与文字（中性色是 `fg-muted`） |
| `--mc-alert-subtle-fill`  | 按 `color`                         | `subtle` 的浅底（中性色用 `surface-sunken`）                       |
| `--mc-alert-body-color`   | `fg-muted`（`solid` 时 `on-fill`） | 描述文字色                                                         |
| `--mc-alert-layer-color`  | `fg`（`solid` 时 `on-fill`）       | × 的 state layer 用色                                              |
| `--mc-alert-layer`        | `0.08`                             | × 的 hover 叠加强度；`active` 是它的 1.5 倍（12%）                 |
| `--mc-alert-pad-x` / `-y` | `--mc-space-4` / `--mc-space-3`    | 左右 / 上下内边距                                                  |
| `--mc-alert-gap`          | `--mc-space-3`                     | 图标、正文、× 之间的间距                                           |
| `--mc-alert-radius`       | `--mc-radius-md`                   | 圆角                                                               |

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
