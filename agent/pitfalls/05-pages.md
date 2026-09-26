# 五、页面模块与静态服务器（P26 / P27 / P40）

> 索引见 [`README.md`](./README.md)。

---

> 这一节的两条来自同一个真实事故：文档站首页在 VS Code Live Server 下**页面空白、
> 不报错**。用 `pnpm dev`（项目自带服务器）没事，换成别人的静态服务器就挂。

### P26 · 页面模块的 `<script>` 必须放在 `<template page>` 最前面

ofa.js 把页面模块的 `<script>` 抽出来当模块代码执行 —— `drawUrl` 里取的是模板内
**第一个** `script`。任何排在它前面的脚本都会被当成页面代码，包括**静态服务器注入的脚本**。

### P27 · 页面模块的注释里不要写 body / svg / head 的结束标签原文

VS Code Live Server 会往 HTML 响应里注入 live-reload 脚本，注入点依次找
「第一个 body 结束标签 → svg 结束标签 → head 结束标签」。

注释里一旦出现这些字符串，注入点就被引到文件顶部；而注入内容**自带一个 HTML 注释**，
会把你那条注释提前闭合 —— 后面的 `<script>` 随之变成真实元素，且排在你的脚本前面。
P26 于是被触发，页面空白。

**两条合起来**：无论服务器往哪注入，都抢不走第一个 `<script>` 的位置。

**为什么难查**：页面不报错，只是什么都不渲染。控制台里唯一线索是服务器自己打的
`Live reload enabled.` —— 看起来一切正常。

冒烟测试里有一条 `--inject` 服务器专门跑这条路径（照抄 live-server 的注入规则），
改模板结构或注释时如果破坏了它，测试会直接变红。

### P40 · 组件文件**不写 `tag`** 时按文件名推断 —— 改名 / 挪目录就换标签或直接注册失败

```html
<!-- ❌ 假设某个组件文件没写 tag：ofa 按文件名推断出 'example'（无连字符 → 非法） -->
<template component>
  <script>
    export default () => ({ data: {} });
  </script>
</template>
<!--
  控制台：Error loading component module, wrong module address: …/components/example.html
  真正的 cause（只有监听 unhandledrejection 才看得到）：
          Error in registering the 'example' component
-->

<!-- ✅ 显式写 tag：与文件名、目录名彻底解耦 -->
export default () => ({ tag: 'doc-example', data: {} });
```

**为什么难查**：推断出来的标签名往往不带连字符（本例是 `example`）—— 不是合法的自定义元素名，
注册当场失败；
而 ofa 的组件加载管线会**把内层错误再包一层** —— `<l-m>` 拿到含 `<template component>` 的
文件后，会抽出模板、按 `${模板} .mjs --real:${url}` 合成模块再 import，内层错误丢在那一步，
外层只留一句 `load_comp_module: wrong module address`，看起来像 URL 写错了。

**写法**：每个组件都**显式写 `tag`**，别依赖文件名推断。Mosaic 的组件都写了；
`docs/doc-nav.html` 曾是唯一的例外（文件名恰好等于标签，歪打正着），
后来挪进 `docs/components/` 并改名 `nav.html` 时立刻炸了 —— 现已显式声明 `tag: 'doc-nav'`。

**怎么定位**：组件不渲染、控制台只给「wrong module address」时，先
`customElements.get('标签名')` 看注册上没上，再监听 `unhandledrejection` 读 `reason.cause`。

---
