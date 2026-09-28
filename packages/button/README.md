# mc-button（按钮）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M1 · 标签 `mc-button` · 目录 `packages/button/`

按钮。语义色 × 外观样式两个正交维度，6 色 × 3 外观 = 18 种组合。

## 单元里有什么

| 文件          | 角色                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `button.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`   | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`      | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`      | 7 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`       | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-button — Mosaic 参考组件实现

写新组件请照抄它的结构与分层，三条主线：

1. 视觉全部定义在 :host 上 —— 外部 style="…" 优先级最高，能直接覆盖；
2. color（语义色）× variant（外观样式）是两个正交维度，不是一维枚举；
3. 交互语义交给内部透明的原生 <button>，宿主只管"长什么样"。
   hover / active 用 state layer（currentColor + 半透明），不引 hover 色令牌。

## 令牌

| 令牌                    | 默认       | 作用                           |
| ----------------------- | ---------- | ------------------------------ |
| `--mc-button-fill`      | 按 `color` | `filled` 的底色                |
| `--mc-button-on-fill`   | 按 `color` | `filled` 上的文字色            |
| `--mc-button-accent`    | 按 `color` | `outline` / `ghost` 的线与文字 |
| `--mc-button-icon-size` | `1.25em`   | 按钮里图标的字号（见下）       |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单七节），将来由主题编辑器展示—— 依据 [`doc-render.md`](../../agent/doc-render.md) §三。

**槽里的图标有一层特调**（`::slotted(mc-icon)`，只作用于按钮内部，不动图标集）：

- **尺寸比文字大一档**：按钮文字是 14px + `font-weight: 500`，同尺寸的描边型图标看着比文字轻
  （24px 画布 2px 描边缩到 14px 只剩 1.17px）。按钮这层把图标放到 `1.25em`（14px 文字 → 17.5px 图标）
  来补光学重量。想再调就覆盖 `--mc-button-icon-size`；`loading` 的那个 spinner 用同一个值。
- **颜色必须跟按钮文字色**：`filled` 取 `--mc-button-on-fill`、`outline` / `ghost` 取 `--mc-button-accent`，
  由 `color: inherit` 绑定。在按钮里 **`mc-icon` 自己的 `color` 属性会被压掉** —— 按钮的标签是整体，
  里面不该出现第二种颜色。按钮外的图标不受影响。

**定制**：视觉全部在 `:host` 上，直接写原生 CSS 即可。

```html
<mc-button block style="height: 48px; border-radius: 9999px">圆角大按钮</mc-button>
```

## 为什么不发事件

| 名称    | 类型                          | 说明                                         |
| ------- | ----------------------------- | -------------------------------------------- |
| `click` | `(event: MouseEvent) => void` | 原生事件，直接 `on:click` 监听，无自定义事件 |

> 页面上**没有**这一节：按 [`doc-pages.md`](../../agent/doc-pages.md) §一「有事件才写这一节；一个都没有就整节省略」——
> `click` 是原生事件（[`api/README.md`](../../agent/api/README.md) §1.5：点击类交互不定义自定义事件），所以省略。
> 这张表留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- 消费 [`mc-icon`](../icon/)：槽里的图标字号走 `--mc-button-icon-size`（比按钮文字大一档）、颜色强制跟随按钮文字色 —— 按钮内部的 `mc-icon` **自己的 `color` 属性会被压掉**。

<!-- hand:end -->

## 改这个单元之前

- 造组件 / 改样式：[`authoring.md`](../../agent/authoring.md) · [`authoring-style.md`](../../agent/authoring-style.md)
- 写组件前必读的踩坑清单：[`pitfalls/README.md`](../../agent/pitfalls/README.md)
- 跨组件约定与组件索引：[`api/README.md`](../../agent/api/README.md)
- 文档页怎么排：[`doc-pages.md`](../../agent/doc-pages.md)
