# mc-code

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `packages/code/code.html` · **已实现**

代码展示。代码文本可以贴在标签里，也可以用 `code` 属性 / `:code` 绑定传进来。

**代码文本四种传法**，优先级 `src` > `code` 属性 > 标签内文本：

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

---

## 属性

| 名称              | 值                 | 默认             | 说明                                                                                                             |
| ----------------- | ------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src`             | `string`           | —                | **片段文件**：优先级最高；缺 `language` 时按文件后缀推断。同一 URL 多处引用只取一次                              |
| `code`            | `string`           | —                | 代码文本，可多行；不写则读**标签里的纯文本**。`<` 都要写 `&lt;`                                                  |
| `language`        | `string`           | —                | 语言 id 或别名（`js` `ts` `html` `css` `json` `bash` `py` `md`…）；空 / `text` / `none` 表示不高亮               |
| `line-numbers`    | `boolean`          | —                | 行号列（`position: sticky`）。行号是真实的 DOM 文本（`<span part="line">`），只靠 `user-select: none` 不参与复制 |
| `max-height`      | `number \| string` | —                | 数字按 px，或写 CSS 长度；超出时在组件内部滚动；块内滚到底后滚轮会继续滚页面（不会把滚动锁在组件里）             |
| `soft-wrap`       | `boolean`          | —                | 长行折行，而不是横向滚动                                                                                         |
| `hljs-theme`      | `string`           | `github`         | highlight.js 官方主题名（亮色）                                                                                  |
| `hljs-theme-dark` | `string`           | `github-dark`    | highlight.js 官方主题名（暗色）                                                                                  |
| `hljs-base`       | `string`           | 内置固定版本 CDN | highlight.js 的 `build/` 目录地址（自托管 / 换镜像）                                                             |

### 运行时读写

| 运行时                    | 说明                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `el.code`（DOM property） | 读回当前原文（已 dedent）；写入等价于 `setAttribute('code', …)`，**立刻**重渲染 + 重新高亮 |

## part

| 名称   | 说明                                  |
| ------ | ------------------------------------- |
| `body` | 滚动容器（`max-height` 作用在它身上） |
| `pre`  | 等宽排版层（`<pre>`）                 |
| `code` | 高亮产物层（`<code>`）                |
| `line` | 行号模式下的每一行                    |
