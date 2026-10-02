# mc-radio（单选按钮）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-radio` · 目录 `packages/radio/`

单选按钮组。

## 单元里有什么

| 文件               | 角色                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `radio.html`       | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `radio-group.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`        | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`           | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`           | 6 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`            | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**为什么互斥必须由组自己做（而不是靠原生 radio 的 name）。** 原生 radio 的「同 `name` 成一组」
有两条硬条件：同一个 form owner、**同一棵树**。每个 `mc-radio` 有自己的 shadow root，
它们的原生 radio 分居不同树 —— 浏览器根本不认它们是一组：点一个不会取消另一个，
<kbd>方向键</kbd>也不会走。所以组把这三件事全接过来：

| 能力     | 谁做                       | 怎么做到                                                                        |
| -------- | -------------------------- | ------------------------------------------------------------------------------- |
| 互斥     | `mc-radio-group`           | 点谁选谁：组在 `click` 里改所有子项的 `checked` 属性（`composedPath()` 认成员） |
| 方向键   | `mc-radio-group`           | `keydown`（composed，从子项 shadow 里冒上来）里算下一格、选中、把焦点交过去     |
| 键鼠可达 | 内部原生 input + `<label>` | <kbd>Space</kbd> 选中、<kbd>Tab</kbd> 聚焦，键盘操作全白拿                      |

**组 ↔ 子项是单向的两个宿主方法，组不伸手进子项的 shadow root**：
`radio.syncGroupState()`（重读组状态：`name` / 禁用 → 内部原生 input）与
`radio.focusNative()`（把焦点交给内部原生 radio）。两个都是定义在宿主元素上的 DOM 方法，
**不是 attrs** —— 组禁用不该写进子项自己的属性表。这个方向是刻意的：子项不反向读组的内部状态，
组的真相（选中值）只从子项的 `checked` 属性投影出来。

**`value` 是 property，`default-value` 是属性**（规范 1.4）：
`default-value` 只在挂载那一刻读一次，之后 `group.value = 'c'` 立刻更新选中项并把
宿主 `value` 属性同步成运行时值（`getAttribute('value')` 不会停在陈值上）。
子项的 `checked` 是同一个状态的镜像，写它只影响这一格 —— 要改选中请走组。

**尺寸靠自定义属性继承**（同 `mc-collapse`）：子项在另一个 shadow root 里，组的选择器够不到它，
所以组把 `--mc-radio-font` / `-line` / `-height` / `-pad-x` 写在**自己宿主**上让子项继承。
⚠️ 因此 `radio.html` 的 `:host` **不能**给这几个变量写默认值 —— 写了就会盖掉继承来的值，
组的 `size` 永远不生效（`mc-collapse-item` 那条注释讲的是同一件事）。

**刻意不做**：`mc-radio` 自己发 `change`（两次事件会从组里穿出去 —— 组已经发了一个带着
同一个 `value` 的）；`indeterminate`（单选没有半选，那是 checkbox 的事）。

## 令牌

| 令牌                   | 默认                     | 作用                                   |
| ---------------------- | ------------------------ | -------------------------------------- |
| `--mc-radio-font`      | `var(--mc-text-sm)`      | 子项字号；组按 `size` 写下来，子项继承 |
| `--mc-radio-line`      | `var(--mc-text-sm-lh)`   | 子项行高；同上                         |
| `--mc-radio-height`    | `var(--mc-control-h-md)` | 子项控件高；同上                       |
| `--mc-radio-pad-x`     | `var(--mc-space-3)`      | 子项左右内边距；同上                   |
| `--mc-radio-group-gap` | `var(--mc-space-4)`      | 组内子项之间的间距；组按 `size` 写     |
| `--mc-radio-gap`       | `var(--mc-space-2)`      | 子项内圆圈与文案的间距                 |
| `--mc-radio-circle`    | `1.15em`                 | 圆圈边长（em，所以跟着字号缩放）       |
| `--mc-radio-dot`       | `0.55em`                 | 圆圈里的中心点边长                     |

## 相邻单元

- `mc-checkbox`（[`../checkbox/`](../checkbox/)）：可以同时勾多个时用它；一组里永远只能有一个是 radio。
- `mc-switch`（[`../switch/`](../switch/)）：只有开 / 关两态、改完立刻生效时用它。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
