# mc-code-editor（代码编辑）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-code-editor` · 目录 `packages/code-editor/`

代码编辑器。轻量 HTML / JS / CSS 编辑：语法高亮 + 行号，值按表单控件那套读（value / input / change）；CodeMirror 随组件懒加载，失败降级成普通文本框。

## 单元里有什么

| 文件               | 角色                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `code-editor.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`        | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`           | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`           | 7 个演示（页面用可编辑示例读**同一份文件**）                                  |
| `test/`            | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**它是表单控件，不是「代码 IDE」**：v1 只收 `value` / `language` / `name` / `readonly` / `disabled` / `invalid` / `auto-resize` 这一组最小属性，行号、括号匹配 / 自动闭合、缩进 2、`Ctrl/Cmd + /` 注释、`Esc` 离焦都是固定行为，不给开关。折叠与补全没有搬（对应的 addon 也没 vendor）—— 多一个开关就多一条演示与一份资产，而当前的使用场景是「改一段示例，点运行看效果」。要加时先问一遍：是不是值得为此扩 API。

**键盘基线的一个有意例外**：`Tab` 被编辑器吃掉做缩进（不吞 Tab 的话键盘用户没法缩进），出口是 `Esc`（CM 的 extraKeys 把焦点丢回页面）；`Shift-Tab` 反缩进、`Ctrl/Cmd + /` 注释。除此之外没有全局快捷键，也不拦浏览器组合键。

**值 / 事件与 [`mc-textarea`](../textarea/) 同一套**：`default-value` 给初始值、宿主 property `value` 给运行时值、`input` / `change` 都从组件发出来带 `data.value`、原生 `input` 先 `stopPropagation()` 再转发。因为宿主上定义了 `value` property，`mc-form` 的 `isCarrier`（`'value' in el`）会自动把它当控件收集，不用改 form。

**CodeMirror 随组件 vendor，懒加载**：`vendor/codemirror/` 是 MIT 的 CodeMirror 5.65.20（provenance 见 `vendor/codemirror/SOURCES.txt`），组件用 `url`（ofa 传给组件模块的真实地址）拼出 `new URL('./vendor/codemirror/', url)`，所以 CDN / 本地 / 子路径部署都对，不需要使用者配 base。第一次**可见**才下载：收起的抽屉先不加载，由 IntersectionObserver 等可见后再开始；指针 / 焦点到宿主也强制加载。加载失败降级成模板里的 `<textarea>`，值 / 事件契约不变。这是「第三方库自己造节点」的例外，理由写在组件脚本顶部，也登记在 [`packages/README.md`](../README.md) §1.9。

**主题**：CM 的基础样式由脚本 fetch 后插到本 shadow root 的**最前面**，组件自己的 `<style>` 后写，所以主题覆盖压得住 CM 默认规则。语法色是 L3 令牌（见下表），默认值用 `light-dark()` 跟随 `color-scheme`；没有 JS 主题观察者，切主题只靠令牌层已经写好的 `color-scheme`。

**高度**：不写 `auto-resize` 时宿主固定 `--mc-code-editor-h`（8rem）；写了就由脚本量 `.CodeMirror-sizer` 的内容高度并写宿主行内 `height`（同 mc-textarea 的 auto-resize，测量是模板表达不了的）。`ResizeObserver` 在容器尺寸变化时 `refresh()` 并重新量高；卸载时断开。

**刻意不做**：不要把工具栏（运行 / 复制 / 切换视图）塞进组件 —— 那是 `doc-example` 的职责；不要加 `color` / `variant` / `size` 维度；不要自己实现编辑器内核（CM6 的样式注入方式与 shadow root 不合，Monaco 更重且需要 worker，见评估记录）。

## 令牌

| 令牌                           | 默认                           | 作用                        |
| ------------------------------ | ------------------------------ | --------------------------- |
| `--mc-code-editor-h`           | `8rem`                         | 不写 `auto-resize` 时的高度 |
| `--mc-code-editor-fill`        | `--mc-color-surface-code`      | 编辑器底色                  |
| `--mc-code-editor-border`      | `--mc-color-border`            | 边框 / 行号列分隔线         |
| `--mc-code-editor-gutter-fill` | `--mc-color-surface-sunken`    | 行号列底色                  |
| `--mc-code-editor-gutter-fg`   | `--mc-color-fg-subtle`         | 行号颜色                    |
| `--mc-code-editor-font-size`   | `--mc-text-sm`                 | 字号                        |
| `--mc-code-editor-line-height` | `1.7`                          | 行高                        |
| `--mc-code-editor-keyword`     | `light-dark(#d73a49, #ff7b72)` | 关键字 / 类型 / 内置        |
| `--mc-code-editor-string`      | `light-dark(#032f62, #a5d6ff)` | 字符串                      |
| `--mc-code-editor-comment`     | `light-dark(#6a737d, #8b949e)` | 注释                        |
| `--mc-code-editor-tag`         | `light-dark(#22863a, #7ee787)` | HTML 标签 / 名称            |
| `--mc-code-editor-attribute`   | `light-dark(#6f42c1, #d2a8ff)` | HTML 属性 / CSS 限定符      |
| `--mc-code-editor-number`      | `light-dark(#005cc5, #79c0ff)` | 数字 / 原子                 |
| `--mc-code-editor-variable`    | `light-dark(#e36209, #ffa657)` | 变量                        |
| `--mc-code-editor-def`         | `light-dark(#6f42c1, #d2a8ff)` | 定义                        |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

## 相邻单元

- 与 [`mc-code`](../code/) 的分工：mc-code 只**展示**（不编辑、不发事件），本单元是**输入**（value / input / change、可进 mc-form）。
- 值语义 / 事件 / 降级思路与 [`mc-textarea`](../textarea/) 同族：多行文本的读写先看那单元，本单元只多一层「CM 是第三方、按需下载」。
- 与 [`message()`](../message/) 一样属于「有可选外部依赖」的单元；本单元的依赖随包发布（`vendor/`），失败时降级而不是静默。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
