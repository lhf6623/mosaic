# mc-grid（栅格）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-grid` · 目录 `packages/grid/`

栅格。

## 单元里有什么

| 文件             | 角色                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `grid.html`      | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `grid-item.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`      | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`         | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`         | 5 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`          | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### 宿主是 grid 容器，子项直接是使用者的 light DOM

`:host { display: grid }` + 一个默认插槽：被投影的子项就是栅格项，组件不包裹、不搬动它们
（所以子项上的 `class` / `style` 照常生效，`span` 也只是给宿主写一个变量）。

### 列数与最小宽度：JS 写宿主上的内部变量

`grid-template-columns` 要吃的是**运行时的数字 / 长度**，所以 `cols` 与 `min-item-width`
在 `attached()` 与 `watch` 里换算成宿主 style 上的两个内部变量：

```css
:host {
  grid-template-columns: repeat(var(--mc-grid-cols, 1), minmax(0, 1fr)); /* @internal */
}
:host([min-item-width]) {
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--mc-grid-min-w, 12rem), 1fr)
  ); /* @internal */
}
```

- **只能在 `attached()` 之后写宿主**：`ready()` 还在构造期，往宿主写 style 会抛
  `NotSupportedError`，所以 `watch` 一律先过 `_mounted` 守卫
  （顺带把首次触发也挡掉）。
- 回到默认值（`cols` 删掉、`min-item-width` 空）时**删掉变量**而不是写兜底值：
  写同一个变量会把使用者写在 `style` 上的覆盖抹掉。
- `min-item-width` 的开关走属性选择器（`[min-item-width]`）—— 否定选择器在 `:host` 里会静默失效；它是 `null` 默认的字符串属性，
  没写就**不会**被 ofa 反射出来（那条规则只对非空默认值成立）。

### `span` 同样只是一条 CSS 变量

`mc-grid-item` 的 `span` 写到自己的 `--mc-grid-span`（`span=1` 时删掉，交回 CSS 兜底
`span 1`）。跨列是纯布局，不需要 JS 参与测量。

### 没有 `part`，没有 `size`

容器只有"列 + 间距"两件事，视觉都在 `:host` 上：直接 `style="gap: 10px"` 或覆盖
`--mc-space-*` 就够，不必再开一层 `part`。尺寸同理 —— 每个栅格项的样子由使用者的内容决定。

## 令牌

| 令牌              | 默认    | 作用                                                         |
| ----------------- | ------- | ------------------------------------------------------------ |
| `--mc-grid-cols`  | `1`     | 列数（`/* @internal */`：JS 按 `cols` 写，不是覆盖点）       |
| `--mc-grid-min-w` | `12rem` | 最小子项宽度（`/* @internal */`：JS 按 `min-item-width` 写） |
| `--mc-grid-span`  | `1`     | 跨列数（`/* @internal */`：JS 按 `span` 写）                 |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

> 三条都是**内部变量**：值是 JS 按属性算出来的，使用者要改列 / 间距应该改属性，
> 而不是直接覆盖它们（`api.md` 的属性表才是接口面）。

## 相邻单元

- 与 [`mc-table`](../table/) 的分工：grid 只摆位置、不管内容形状；table 有列语义与状态（空 / 加载）。
- 本体不依赖任何其它组件（零 `load()`）：栅格项里放什么由使用者决定。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
