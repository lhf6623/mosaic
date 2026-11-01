# mc-code

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `packages/code/code.html` · **已实现**

代码展示。代码文本走 `code` 属性（或 `:code` 绑定）与片段文件两条路；标签里的内容**不读**。

**代码文本三种传法**，优先级 `src` > `code`：

```html
<!-- ① code 属性：多行也行，`<` 不用转义（只有引号要挑一下，见下） -->
<mc-code
  language="javascript"
  code="
  const a = 1;
"></mc-code>

<!-- ② ofa 模板绑定：从页面 data 取（:prop 只对 attrs 里声明过的键生效） -->
<mc-code language="javascript" :code="snippet"></mc-code>

<!-- ③ 片段文件：长片段、或两种引号都有 —— 文件是真 HTML/JS，不用转义 -->
<mc-code language="html" src="../snippets/quick-start.html"></mc-code>
```

> `src` 的路径按**页面文件**解析（和 `<link href>`、`export const parent` 一样）：
> ofa 编译页面模块时会把相对地址改写成绝对地址，组件拿到的已经是绝对 URL。
> 普通 HTML 宿主里没这层改写，此时按文档地址（`document.baseURI`）解析。

**标签里的内容不读。** 那是默认插槽的位置，容易被当成「能放任何东西」，所以组件从不把
`<mc-code>…</mc-code>` 之间的文本当代码 —— 写了也不显示，控制台给一条 `[mosaic]` 警告。

**属性值里的引号**：属性用一种引号包，代码里就只能有另一种 ——
代码里只有单引号就用双引号包，只有双引号就用单引号包，两种都有（HTML 片段最常见）
改用 `src` 文件。`<` 和 `&` 在属性值里按原样写即可，不用写成 `&lt;`。

**缩进**：多行写法把代码缩进到属性里，组件会去掉**所有非空行的公共缩进**，
所以整段往右挪几格都不影响渲染。

**什么时候用哪个**：一两行、引号单一 → `code` 属性；
长片段、两种引号都有、或含 `<script>` → `src` ——
文档站里 `docs/snippets/quick-start.html` 就是这么放的，文件本身还能直接打开验证。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/code/code.html"></l-m>

<mc-code id="demo"></mc-code>

<script type="module">
  await customElements.whenDefined('mc-code');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/code/code.html"></l-m>

<mc-code></mc-code>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称              | 值                 | 默认             | 说明                                                                                                 |
| ----------------- | ------------------ | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `src`             | `string`           | —                | **片段文件**：优先级最高；缺 `language` 时按文件后缀推断。同一 URL 多处引用只取一次                  |
| `code`            | `string`           | —                | 代码文本，可多行（去掉所有非空行的公共缩进）。`<` 不用转义，引号按「属性包一种、代码里另一种」挑     |
| `language`        | `string`           | —                | 语言 id 或别名（`js` `ts` `html` `css` `json` `bash` `py` `md`…）；空 / `text` / `none` 表示不高亮   |
| `line-numbers`    | `boolean`          | —                | 显示行号；行号不参与复制（`user-select: none`），整列 `position: sticky` 跟着滚                      |
| `max-height`      | `number \| string` | —                | 数字按 px，或写 CSS 长度；超出时在组件内部滚动；块内滚到底后滚轮会继续滚页面（不会把滚动锁在组件里） |
| `soft-wrap`       | `boolean`          | —                | 长行折行，而不是横向滚动                                                                             |
| `hljs-theme`      | `string`           | `github`         | highlight.js 官方主题名（亮色）                                                                      |
| `hljs-theme-dark` | `string`           | `github-dark`    | highlight.js 官方主题名（暗色）                                                                      |
| `hljs-base`       | `string`           | 内置固定版本 CDN | highlight.js 的 `build/` 目录地址（自托管 / 换镜像）                                                 |

## part

| 名称   | 说明                                  |
| ------ | ------------------------------------- |
| `body` | 滚动容器（`max-height` 作用在它身上） |
| `pre`  | 等宽排版层（`<pre>`）                 |
| `code` | 高亮产物层（`<code>`）                |
| `line` | 行号模式下的每一行                    |
