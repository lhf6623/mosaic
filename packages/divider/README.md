# mc-divider（分割线）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-divider` · 目录 `packages/divider/`

分割线。水平 / 竖直两个方向，线上可放一段文字（位置可调）；线型、留白与线色都能配。

## 单元里有什么

| 文件           | 角色                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| `divider.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`    | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`       | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`       | 7 个演示（页面用 `<doc-playground src>` 读**同一份文件**）                    |
| `test/`        | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**三段式 flex：线 + 内容 + 线。** 宿主本身不画线，而是把两条 `.mc-line` 和中间的
`.mc-content` 排成一行（竖线时排成一列）：**空内容时两段线自然接上**，等价于一条通长的
`<hr>`；有内容时只有中间那块占宽度，两侧线各分一半。这样不需要知道页面底色（不是「用
背景色盖住线段」那套），放在卡片 / 条纹底上也成立。

**有没有内容是脚本镜像出来的宿主属性。** `slot` 分到节点时 `.mc-content` 才让出文字间距；
CSS 看不见「插槽空不空」（`slot` 元素本身没有子节点），所以 `slotchange` → 宿主
`data-has-content`（P32）。挂载后再补一次判定，不依赖首次 `slotchange` 的时机。

**`align` 只动短的那一侧。** `center` 两侧等长；`start` / `end` 把靠近文字的那段线缩到
**5%**（Ant 同款比例，窄容器里也不会缩没），另一侧 `flex: 1` 撑满。它只在水平线且线上有
内容时生效 —— 竖线没有「左右」可对齐，写成 `align` 也不该被当成无效输入报错。

**线型用「只改一条边的 style」实现。** 线段是一个高 0（竖线是宽 0）的 flex item，只靠一条
边框显形：水平线是 `border-block-start`，竖线是 `border-inline-start`。改成 `dashed` /
`dotted` 时**不能**写 `border-style` 简写：它会把另外三边的 style 从 `none` 改成 `dashed`，
而边框宽度的初始值是 `medium`（3px），于是上下各冒出一条 3px 的假线（实测：线高从 1px 变
4px）。所以另一条候选边显式写 0 宽，`variant` 只改 `border-block-start-style` /
`border-inline-start-style` 两条边。

**`direction` 与 `spacing` 是同一个间距的两种方向。** 水平线留 `margin-block`、竖线留
`margin-inline`，值都是 `spacing`：三档映射 `--mc-space-2/4/6`，纯数字（px）由 JS 写进宿主
的 `--mc-divider-spacing`；非法值（`12px` / `0.75rem`）删掉变量落回 `md`（与 `mc-space` /
`mc-grid` 的 `gap` 同一条处理）。写宿主 style 必须在 `attached()` 之后（P31）。

**竖线不写死高度。** 宿主 `align-self: stretch`：放进 flex 行里就拉满整行（行高由最高的
那一项决定），不在 flex 上下文里退化成 `min-height: 1em` 的一小段。要固定长度直接写宿主
`style="height: …"`，不额外加 `height` 属性。

**刻意不做：** 没有 `size`（线的粗细是 `--mc-divider-width` 令牌，不是控件尺寸轴）、没有
`color` 语义维度（分隔线是弱元素，颜色只跟主题的边框令牌走，要强调就在宿主上覆盖令牌）、
没有任何事件 / 状态（纯装饰）、没有 `role` / `aria-*`（不冒充 `separator` 语义，读屏会把它
当无意义内容跳过）。

## 令牌

| 令牌                    | 默认                | 作用                                                                          |
| ----------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `--mc-divider-color`    | `--mc-color-border` | 线段颜色（RGB 三元组）                                                        |
| `--mc-divider-width`    | `1px`               | 线段粗细；竖线是边框宽度，水平线是边框高度                                    |
| `--mc-divider-text-gap` | `--mc-space-3`      | 中间内容与两侧线段的间距（水平线是左右、竖线是上下）                          |
| `--mc-divider-spacing`  | `--mc-space-4`      | 分割线外侧留白的落点（`/* @internal */`：JS 按数字 `spacing` 写，不是覆盖点） |

> 前三个是**可覆盖的组件令牌**（写在宿主 `style` 上即可）；`--mc-divider-spacing` 是数字
> `spacing` 的内部通道 —— 调留白用属性，不要单独覆盖它。

## 相邻单元

- 与 [`mc-space`](../space/) 的分工：space 只排「子项之间的距离」、不画线（它的 README 里
  那条「刻意不做 `split`」说的就是这里）；要在两块内容之间画一条线，用 divider。
- 与 [`mc-card`](../card/) 的分工：card 的头尾分隔线是卡片结构的一部分（`divider` 属性只管
  那条线透不透明），不引 `mc-divider`；divider 是页面内容里的独立一条线。
- 与 [`mc-breadcrumb`](../breadcrumb/) 的分工：面包屑的分隔符是品牌化排版的一部分（可换
  separator），跟内容分区用的分割线不是一件事。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
