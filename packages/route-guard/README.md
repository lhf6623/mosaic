# mc-route-guard（路由守卫）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-route-guard` · 目录 `packages/route-guard/`

在 ofa.js 的 `o-app` 里，点击指向当前路由的 `olink` 链接不再重新进入当前页；只发
`same-route` 事件，页面不重建、状态不丢。

## 单元里有什么

| 文件               | 角色                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `route-guard.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`        | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`           | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`           | 1 个演示（页面用可编辑示例读**同一份文件**）                                  |
| `test/`            | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**这是路由层的补丁，被做成了组件。** 「点当前路由不重进」应该由 ofa.js 的 olink 处理器负责；
在它修之前，用 `mc-route-guard` 把这段逻辑集中在一处：菜单、面包屑、tab、手写 `<a olink>`
都自动受益，不需要每个组件各写一份 URL 比较。收到上游修复后，这个组件可以直接移除。

**捕获阶段先于 ofa 的代理。** ofa 的 olink 处理器挂在组件 shadow root 上；守卫在 `window`
的 `click` 捕获阶段跑，先 `preventDefault()`，ofa 的处理器看到 `defaultPrevented` 就返回，
不会再 `app.goto`。这依赖 ofa 现在的 olink 实现（`olink` / `origin-href`），所以它是
**临时补丁**，不是稳定的框架契约。

**当前路由用 ofa 的权威数据。** 从 `event.composedPath()` 找最近的 `o-app`，用
`$('o-app').current.src` 取当前页，而不是猜地址栏或依赖菜单的 `current`。目标地址优先用
`origin-href`，并归一化 origin / path / search / hash：尾部斜杠忽略，query 与页内锚点保留，
避免把 `#section` 的滚动误判成当前路由。`app.current` 在过渡期可能为空，拿不到就不拦。

**只拦无修饰左键。** `meta / ctrl / shift / alt` 点击、`target`、`download`、外部链接、
`#` 页内锚点都放行；链接上加 `olink-force` 也能强制跳过。守卫只改「点击是否继续导航」，
**不改 `app.goto` / `app.replace`**：需要主动刷新时仍显式调用，行为不变。

**事件在拦下之后发。** `same-route` 不负责取消（导航已经拦了），只给应用做关抽屉、埋点、
回顶部这些「点了当前项」的收尾。菜单自己的 `navigate` 事件仍照发——两个事件各管各的。

**刻意不做：**

- 不接管完整路由：页面栈、history、嵌套布局、动画都归 ofa 的 `o-router` / `o-app`。
- 不改 `app.goto`：显式刷新/重进是使用者主动行为，应该继续可用。
- 不依赖 `mc-menu` 的 `current`：它是 UI 选中态，可能不是路由；路由判断只认 `app.current.src`。
- 不处理普通 `<a href>`：没有 `olink` 的链接不是 ofa 的路由入口。

## 相邻单元

- 与 [`mc-menu`](../menu/)：菜单行的 `href` 在 `o-app` 里会渲染成 `olink`；守卫装一次，
  菜单里的当前项、面包屑、其他 `<a olink>` 都不再重进当前路由。
- 与 ofa 的 `o-router` / `o-app`：守卫只读 `app.current.src`，不改路由栈；上游修好后优先用上游。
- 与 [`mc-dropdown`](../dropdown/) / [`mc-popover`](../popover/)：它们复用 `mc-menu-item`，
  里面的 `olink` 行同样被守卫覆盖。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定与组件索引：[`packages/README.md`](../README.md)
- 文档页 / 演示区规范：[`packages/page-spec.md`](../page-spec.md)
