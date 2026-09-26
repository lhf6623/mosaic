# mc-code

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/code/code.html` · **已实现**

代码展示。代码文本可以贴在标签里，也可以用 `code` 属性 / `:code` 绑定传进来：

```html
<mc-code language="javascript" line-numbers> const a = 1; </mc-code>
```

| 名称              | 值                                                              | 默认             | 说明                                                                                                             |
| ----------------- | --------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src`             | URL                                                             | —                | **片段文件**：优先级最高；缺 `language` 时按文件后缀推断。同一 URL 多处引用只取一次                              |
| `code`            | 字符串（可多行）                                                | —                | 代码文本；不写则读**标签里的纯文本**。`<` 都要写 `&lt;`                                                          |
| `language`        | 语言 id 或别名：`js` `ts` `html` `css` `json` `bash` `py` `md`… | —                | 空 / `text` / `none` 表示不高亮                                                                                  |
| `line-numbers`    | 布尔                                                            | —                | 行号列（`position: sticky`）。行号是真实的 DOM 文本（`<span part="line">`），只靠 `user-select: none` 不参与复制 |
| `max-height`      | 数字（px）或 CSS 长度                                           | —                | 超出时在组件内部滚动；块内滚到底后滚轮会继续滚页面（不会把滚动锁在组件里）                                       |
| `soft-wrap`       | 布尔                                                            | —                | 长行折行，而不是横向滚动                                                                                         |
| `hljs-theme`      | highlight.js 官方主题名                                         | `github`         | 亮色主题                                                                                                         |
| `hljs-theme-dark` | highlight.js 官方主题名                                         | `github-dark`    | 暗色主题                                                                                                         |
| `hljs-base`       | URL                                                             | 内置固定版本 CDN | highlight.js 的 `build/` 目录（自托管 / 换镜像）                                                                 |

> ⚠️ 折行属性叫 **`soft-wrap`** 而不是 `wrap`：`wrap` 是 ofa.js 的保留名，
> 声明进 `attrs` 之后 `document.createElement('mc-code')` 会直接抛
> `NotSupportedError`（见 [P31](../pitfalls/01-props.md)）。

| 名称   | 说明                                  |
| ------ | ------------------------------------- |
| `body` | 滚动容器（`max-height` 作用在它身上） |
| `pre`  | 等宽排版层（`<pre>`）                 |
| `code` | 高亮产物层（`<code>`）                |
| `line` | 行号模式下的每一行                    |

| 运行时                    | 说明                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `el.code`（DOM property） | 读回当前原文（已 dedent）；写入等价于 `setAttribute('code', …)`，**立刻**重渲染 + 重新高亮 |

代码文本四种传法，优先级 `src` > `code` 属性 > 标签内文本：

```html
<!-- ① 标签里直接贴：最好读，不用转义引号 -->
<mc-code language="javascript"> const a = 1; </mc-code>

<!-- ② code 属性：单行/多行都行 -->
<mc-code language="javascript" code="const a = 1;"></mc-code>

<!-- ③ ofa 模板绑定：从页面 data 取（:prop 只对 attrs 里声明过的键生效） -->
<mc-code language="javascript" :code="snippet"></mc-code>

<!-- ④ 片段文件：长片段、或含 <script> / 大量 < 的片段 —— 文件是真 HTML/JS，不用转义 -->
<mc-code language="html" src="../snippets/quick-start.html"></mc-code>
```

> `src` 的路径按**页面文件**解析（和 `<link href>`、`export const parent` 一样）：
> ofa 编译页面模块时会把相对地址改写成绝对地址，组件拿到的已经是绝对 URL。
> 普通 HTML 宿主里没这层改写，此时按文档地址（`document.baseURI`）解析。

**什么时候用哪个**：短片段（一两行）贴标签里最省事；
含 `<script>`、或一半字符都是 `&lt;` 的长片段用 `src` ——
文档站里 `docs/snippets/quick-start.html` 就是这么放的，文件本身还能直接打开验证。

```js
// 运行时两种写法等价，且立刻生效（内部不等 ofa 那一拍，见 P4）
el.code = 'const b = 2;';
el.setAttribute('code', 'const b = 2;');
```

**标签内文本的书写约定**：开标签**独占一行**，代码统一缩进，闭标签独占一行 ——
组件的 dedent 靠「所有非空行的公共缩进」，首行粘在开标签上会让公共缩进变成 0，
整段就少去一层、渲染出来左边参差不齐：

```html
<!-- ✅ 公共缩进 = 2，dedent 后正好是代码本来的样子 -->
<mc-code language="html">
  &lt;!doctype html&gt; &lt;html lang="zh-CN"&gt; &lt;/mc-code&gt;

  <!-- ❌ 首行粘在标签上 → 公共缩进 0 → 其余行多出 2 格，第一行还顶在最左 -->
  <mc-code language="html">&lt;!doctype html&gt; &lt;html lang="zh-CN"&gt;</mc-code></mc-code
>
```

| 令牌                                                   | 说明                                 |
| ------------------------------------------------------ | ------------------------------------ |
| `--mc-code-fill` / `--mc-code-border` / `--mc-code-fg` | 代码块自己的底色、描边、文字         |
| `--mc-code-dim`                                        | 行号颜色                             |
| `--mc-code-font-size` / `--mc-code-line-height`        | 排版                                 |
| `--mc-code-max-h`                                      | 高度上限（一般写 `max-height` 属性） |

**语法配色不是令牌**：它来自 highlight.js 的官方主题样式表
（`styles/<theme>.min.css`），取回来**原样 `adopt`** 进组件的 shadow root，
组件不覆盖它任何一条规则。给渲染节点**刻意不加 `hljs` 类**：主题里 `.hljs` 的底色、
`pre code.hljs` 的内边距那套"整块代码块"外观会接管组件盒模型，而这里只想要 token 颜色
（`adoptedStyleSheets` 的优先级高于组件自己的 `<style>`）。
亮暗跟随读 `color-scheme`（继承属性，能穿进 shadow root），切主题就换一张官方表。

**高亮是可选运行时增量**：默认从 jsDelivr 懒加载 highlight.js（core + 用到的语言，
每种一次、多实例共享）。加载失败 / 语言名写错 / CSP 拦截 → **保持纯文本**，
控制台一条 `[mosaic]` 警告，排版 / 行号 / 主题跟随都不受影响。

```html
<mc-code language="css" line-numbers max-height="200">
  :root { --mc-color-primary: 16 185 129; }
</mc-code>

<mc-code language="bash" soft-wrap>pnpm build && pnpm check:drift</mc-code>
```

```js
// 运行时换内容
el.code = 'const b = 2;';
```

---
