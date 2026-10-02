# mc-textarea（多行输入）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-textarea` · 目录 `packages/textarea/`

多行输入框。支持自动增高与字数统计。

## 单元里有什么

| 文件            | 角色                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `textarea.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`     | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`        | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`        | 7 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`         | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**值读写与事件和 [`mc-input`](../input/) 一字不差**：`default-value` 属性给初始值、宿主 property
`value` 给运行时值（真相在内部原生 `<textarea>`）、`input` / `change` 都从组件发出来带
`data.value`、原生 `input` 先 `stopPropagation()` 再转发（否则宿主上会多一条没有 `data` 的）。
那一份的注释更细，这里不重复 —— 改这里时先把 [`../input/README.md`](../input/README.md) 读一遍。

**转发给内部原生元素一律用 `attr:`**（除了 `disabled` 用 `:disabled`）：这一条在 textarea 上不是风格问题
而是生死问题 —— 实测 `<textarea :placeholder="…">` / `<textarea :rows="…">` **完全不生效**
（同一个仓库里 `<input :placeholder>` 却生效），所以 `placeholder` / `rows` / `name` /
`maxlength` / `readonly` 全部走 `attr:`，`null` 表示移除属性。细节与证据见
[`../input/README.md`](../input/README.md) 的「转发给内部原生元素」那段。

**`size` 改的是 `min-height` 而不是 `height`**：多行控件的真实高度由 `rows` 与内容决定，
把 `height` 写死会让 `rows` 失效。三档改的是 `min-height`（`--mc-control-h-*`）、内边距
（`--mc-space-*`）、字号与行高（`--mc-text-*`，行高直接决定一行多高），口径与其余组件一致。

**`auto-resize` 只写 shadow 内部元素**：

```js
el.style.height = `${el.scrollHeight}px`; // scrollHeight 本身就是内容高度，不用先归零
```

- 监听只在开着 `auto-resize` 时挂着，由 `bindAutoResize()` 统一增删：`watch` 里属性一变就重挂，
  `detached()` 里摘掉（"摘监听"这件事必须真的发生，否则重连的元素会累积监听）。
- ⚠️ **`attached()` 可能早于元素拿到布局**，那时 `scrollHeight` 是 `0` —— 照着写成 `0px`
  会把内容整块裁掉（实测：demo 里空着的那条连 placeholder 都看不见，直到第一次输入才好）。
  所以量到 0 就 `requestAnimationFrame` **补一次**；只补一次（`_resizeRetry`），
  藏在 `display: none` 里时不会变成每帧空转。那个帧句柄在 `detached()` / 关掉属性时都要
  `cancelAnimationFrame`。
- 打开时额外压掉原生拖拽把手与滚动条（`:host([auto-resize]) .mc-input { overflow: hidden; resize: none }`）——
  高度既然由脚本写死，手动拖拽只会被下一次输入覆盖，滚动条则会污染 `scrollHeight`。
- 句柄存在 `_onAutoResize` 上，**不叫 `resize`**：那会盖掉同名的 proto 方法。

**字数统计只在给了 `maxlength` 时显示**，内容就是 `当前/上限`（长度用 `value.length`，
与原生 `maxlength` 数的 UTF-16 单元保持同一口径）。它写在 `part="counter"` 的常驻元素里，
显隐走宿主上的 `data-has-maxlength`（同 input 的 `data-has-*`）。

**没有 `color` / `variant` 维度**：语气由 `invalid` 一个布尔表达（错误色取 `--mc-color-danger`）。

## 令牌

| 令牌                          | 默认                        | 作用                               |
| ----------------------------- | --------------------------- | ---------------------------------- |
| `--mc-textarea-bg`            | `--mc-color-surface-sunken` | 输入区底色                         |
| `--mc-textarea-border`        | `--mc-color-border-strong`  | 常态边框，也是禁用态边框           |
| `--mc-textarea-border-hover`  | `--mc-color-fg-subtle`      | hover 边框                         |
| `--mc-textarea-placeholder`   | `--mc-color-fg-subtle`      | 占位符颜色                         |
| `--mc-textarea-affix-color`   | `--mc-color-fg-muted`       | `prefix` / `suffix` 插槽容器的颜色 |
| `--mc-textarea-counter-color` | `--mc-color-fg-subtle`      | 字数统计的颜色                     |
| `--mc-textarea-gap`           | `--mc-space-2`              | 前后缀与输入区之间的间距           |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

## 相邻单元

- 与 [`mc-input`](../input/) 同族：单行 / 多行的分工，值读写、事件、`data-has-*` 镜像全部照它抄。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
