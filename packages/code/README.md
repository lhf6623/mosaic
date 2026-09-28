# mc-code（代码）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M1 · 标签 `mc-code` · 目录 `packages/code/`

代码展示。配色用 highlight.js 官方主题、按需懒加载，失败即降级为纯文本；行号 / 折行 / 限高滚动开箱可用。

## 单元里有什么

| 文件        | 角色                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `code.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html` | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`    | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`    | 11 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）              |
| `test/`     | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

mc-code — 代码展示组件。三条主线：

1. 文本来源优先级 `src` > `code` 属性/property > 标签内纯文本（读 textContent 并去公共缩进）。
2. 配色原样 adopt highlight.js 官方主题（默认 github / github-dark），刻意不给渲染节点加 `hljs` 类，
   否则主题的 .hljs 背景与内边距会盖掉组件底色（adopted 表优先于组件自己的 <style>）。
3. 高亮是可选的运行时增量：CDN 懒加载，失败即保持纯文本，同步先出文本、到位后再原地升级。
   行号建在「行」模型上：高亮产物里的 <span> 可跨行，splitLines() 负责标签配平切分。

## 令牌

| 令牌                                                   | 说明                                 |
| ------------------------------------------------------ | ------------------------------------ |
| `--mc-code-fill` / `--mc-code-border` / `--mc-code-fg` | 代码块自己的底色、描边、文字         |
| `--mc-code-dim`                                        | 行号颜色                             |
| `--mc-code-font-size` / `--mc-code-line-height`        | 排版                                 |
| `--mc-code-max-h`                                      | 高度上限（一般写 `max-height` 属性） |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单七节），将来由主题编辑器展示—— 依据 [`doc-render.md`](../../agent/doc-render.md) §三。

**语法配色不是令牌**：它来自 highlight.js 的官方主题样式表
（`styles/<theme>.min.css`），取回来**原样 `adopt`** 进组件的 shadow root，
组件不覆盖它任何一条规则。给渲染节点**刻意不加 `hljs` 类**：主题里 `.hljs` 的底色、
`pre code.hljs` 的内边距那套"整块代码块"外观会接管组件盒模型，而这里只想要 token 颜色
（`adoptedStyleSheets` 的优先级高于组件自己的 `<style>`）。
亮暗跟随读 `color-scheme`（继承属性，能穿进 shadow root），切主题就换一张官方表。

**高亮是可选运行时增量**：默认从 jsDelivr 懒加载 highlight.js（core + 用到的语言，
每种一次、多实例共享）。加载失败 / 语言名写错 / CSP 拦截 → **保持纯文本**，
控制台一条 `[mosaic]` 警告，排版 / 行号 / 主题跟随都不受影响。

**行号建在「行」模型上**：高亮产物里的 `<span>` 可跨行，`splitLines()` 负责标签配平切分，
切完才给每行套 `<span part="line">`（第 526 行 `setAttribute` 是动态的，模板里看不到）。

## 为什么不发事件

> 页面上**没有**这一节：按 [`doc-pages.md`](../../agent/doc-pages.md) §一「有事件才写这一节；一个都没有就整节省略」——
> `mc-code` 是纯展示组件，没有自定义事件，也不 `emit` 任何东西。
> 这一行留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- **唯一带可选外部依赖的单元**：highlight.js 按需从 CDN 懒加载，失败即降级为纯文本 —— 它不进 shadow root 之外的任何地方，也不影响排版 / 行号 / 主题跟随。

<!-- hand:end -->

## 改这个单元之前

- 造组件 / 改样式：[`authoring.md`](../../agent/authoring.md) · [`authoring-style.md`](../../agent/authoring-style.md)
- 写组件前必读的踩坑清单：[`pitfalls/README.md`](../../agent/pitfalls/README.md)
- 跨组件约定与组件索引：[`api/README.md`](../../agent/api/README.md)
- 文档页怎么排：[`doc-pages.md`](../../agent/doc-pages.md)
