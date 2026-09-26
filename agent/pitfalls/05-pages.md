# 五、页面模块与静态服务器（P26 / P27 / P40 / P41）

> 索引见 [`README.md`](./README.md)。

---

> 这一节的 P26 / P27 / P41 来自同一类真实事故：**换成别人的静态服务器就挂，用 `pnpm dev` 没事**。
> 一次是文档站首页在 VS Code Live Server 下**页面空白、不报错**；另一次是组件页上那个组件的
> 实例**全部没升级、演示区空着**。同一个注入机制，一个打在页面模块上、一个打在组件模块上。

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

### P41 · 组件文件里同样不能出现 body / svg / head 的结束标签 —— 内联 svg 是最自然的踩法

**现象**：文档页上这个组件的实例**全部没升级** —— 标签还写在页面里，但 `shadowRoot` 是 `null`、
`customElements.get(标签)` 是 `undefined`，于是演示区那块空着、页面其余部分完全正常。控制台一条：

```
Uncaught (in promise) Error: 加载组件模块出错，错误的模块地址: …/packages/<name>/<name>.html
```

P26 / P27 讲的是**页面模块**；这条是同一个机制的**组件版**：`<l-m src>` 拉的就是组件文件本身，
ofa 照样取文件里**第一个 `<script>`** 当模块。区别只在触发物 —— 页面那边常是注释里写了结束标签
原文，组件这边是**画图标时非常自然会写的内联 svg 标记**。

**原因**：VS Code Live Server 的注入点是「第一个 body 结束标签 → svg 结束标签 → head 结束标签」，
**纯文本替换、不看上下文**。组件里一有内联 svg，注入的 `<script>` 就落在模块 `<script>` 前面，
被 ofa 当成组件模块 —— 那里面没有 `export default`，加载当场失败。没有内联 svg 的组件天然免疫，
所以这个坑一直等到仓库里第一个画图标的组件才炸。

**写法**（二选一，都实测过）：

1. **让文件里根本不存在那三个结束标签**（`mc-alert` 采用这条）：图标用 DOM API 建
   （`document.createElementNS`）再 append 进 shadow root 里的容器 —— 文件里没有那个序列，
   服务器无从注入，渲染结果与内联标记完全一致；
2. **把模块 `<script>` 挪到 `<template component>` 最前**（P26 那招用在组件上，实测有效）：
   注入点落在后面也抢不走第一个 script。代价是偏离 [`../authoring.md`](../authoring.md) §4 的
   骨架（style → 结构 → script）。

**和 P40 长得一模一样，别只看控制台**：外层都是 `wrong module address`，`reason.cause` 也都是
「注册'xxx'组件出错」，`customElements.get(标签)` 两边都是 `undefined` —— 实测注入这条的
外层消息、内层 cause、注册结果与 P40 **完全一致**，靠控制台分不开。判据在文件里：P40 是文件
**没写 `tag`**，这条是文件里有**注入点**（内联 svg，或注释里的结束标签原文）。Live Server 场景下
还有个旁证：控制台里有服务器自己打的那句 `Live reload enabled.`。

**守卫**：`tests/site/07-inject-server.mjs` 两条 —— 静态扫全仓 `.html`（模拟 live-server 的注入，
注入点必须排在第一个 `<script>` 之后，或文件里根本没有注入点），以及在 `--inject` 服务器上真跑
一遍组件页（实例必须全部升级）；`tests/site/05-doc-pages.mjs` 另有一条「每个演示的活样例至少有一个
已升级的 `mc-*`」，专拦「页面不报错、样例空白」这种表象。

---
