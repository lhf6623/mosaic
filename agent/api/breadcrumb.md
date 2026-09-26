# mc-breadcrumb / mc-breadcrumb-item

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

```html
<mc-breadcrumb separator="/" label="面包屑">
  <mc-breadcrumb-item><a href="/components">组件</a></mc-breadcrumb-item>
  <mc-breadcrumb-item><a href="/components/base">基础</a></mc-breadcrumb-item>
  <mc-breadcrumb-item current>Button</mc-breadcrumb-item>
</mc-breadcrumb>
```

**mc-breadcrumb（容器）**

| 名称        | 值     | 默认     | 说明                                                                   |
| ----------- | ------ | -------- | ---------------------------------------------------------------------- |
| `separator` | 字符串 | `/`      | 级与级之间的分隔符；非默认值优先于 `--mc-breadcrumb-sep`（空值按默认） |
| `label`     | 字符串 | `面包屑` | `<nav>` 的无障碍名（英文站写 `label="Breadcrumb"`）                    |

| 名称          | 说明                        |
| ------------- | --------------------------- |
| 插槽（默认）  | 每一级 `mc-breadcrumb-item` |
| `part="base"` | 内层 `<nav>`                |
| `part="list"` | 内层 `<ol>`                 |

**mc-breadcrumb-item（一级）**

| 名称      | 值   | 默认 | 说明                                                                    |
| --------- | ---- | ---- | ----------------------------------------------------------------------- |
| `current` | 布尔 | —    | 当前页（最后一级）：字色更实 + 字重加重，并自动补 `aria-current="page"` |

**每一级的交互元素由使用者写在插槽里**（原生 `<a>`），组件不造链接 —— 与 `mc-menu`
同一条理由：站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板里的元素。
当前页写纯文本 + `current`。列表语义：容器渲染 `<nav>` + `<ol role="list">`，
每一级的 `role="listitem"` 由组件补（使用者自己写了 `role` 就不覆盖）。

**没有 `size` / `variant`**：面包屑是一行文字导航，这两档不成立；改字号直接覆盖容器的
`font-size`。**不承诺插槽里放 `<button>`** —— 页面 reset 对 `button` 的优先级压过组件内的
`::slotted()`（[P33](../pitfalls/03-style-scope.md)），要可点的级就用 `<a>`。
同理，**宿主页面对 `a` 的颜色规则也压过 `::slotted(a)`**：页面里写了 `a { color: … }` 时
`--mc-breadcrumb-item-color` / `--mc-breadcrumb-item-color-hover` 都管不到链接色（悬停只剩组件加的下划线）
—— 链接色最终由页面的链接样式决定。要精确控制就写一条特异性不低于页面 `a` 规则的页面样式。

| 令牌                               | 默认                   | 作用                             |
| ---------------------------------- | ---------------------- | -------------------------------- |
| `--mc-breadcrumb-sep`              | `'/'`                  | 分隔符（CSS 字符串，要带引号）   |
| `--mc-breadcrumb-sep-color`        | `--mc-color-fg-subtle` | 分隔符颜色                       |
| `--mc-breadcrumb-gap`              | `--mc-space-2`         | 级间距（也是分隔符与文字的间距） |
| `--mc-breadcrumb-item-color`       | `--mc-color-fg-muted`  | 普通一级的文字                   |
| `--mc-breadcrumb-item-color-hover` | `--mc-color-fg`        | 悬停文字                         |
| `--mc-breadcrumb-current-color`    | `--mc-color-fg`        | 当前页文字                       |

> ⚠️ `separator` 属性与 `--mc-breadcrumb-sep` 令牌走**两条通道**：属性落到宿主上一个内部变量
> （`--mc-breadcrumb-sep-attr`），CSS 里是 `content: var(内部变量, var(--mc-breadcrumb-sep))`。
> 让属性直接写 `--mc-breadcrumb-sep` 会把使用者写在 `style` 上的令牌一起抹掉（实测踩过）。

---
