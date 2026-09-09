# mosaic

页面聚合壳：一份 JSON 注册，把散落的 HTML 页面与 GitHub Pages 集中展示。

## 状态

**设计阶段。** 目录结构尚未确定，当前只有工程骨架，避免提前把架构决策写死。

## 目标

- 注册一个新页面 = 配置里加一行，**不改壳代码**
- 能集成任意外部页面，包括**别人的 GitHub Pages**（不可控、不认识本壳）
- 技术栈：ofa.js 4.6.12（CDN），无构建工具，纯静态，部署在 GitHub Pages 子路径

## 已验证的技术约束

这几条是实测 + 扒源码得到的结论，设计时必须遵守：

1. **GitHub Pages 可被 iframe 嵌套** —— 实测多个 Pages 站点，响应头无 `X-Frame-Options`、无 CSP `frame-ancestors`。
2. **Pages 返回 `Access-Control-Allow-Origin: *`** —— 跨域 `fetch` 其 HTML 可行。
3. **无法预检"某站点是否禁止嵌套"** —— 读取 `X-Frame-Options` 需要 `Access-Control-Expose-Headers`，Pages 没提供。只能靠加载超时兜底，并给"新窗口打开"出口。
4. **shadow DOM 只隔离 DOM 和 CSS，不隔离 JS** —— 共享 `window`、全局 `customElements`（重名报错）、组件内能访问主 `document`。可继承属性和 CSS 自定义属性会穿透边界（这是主题同步的唯一通道）。
5. **注入的 `<script>` 不会执行**（HTML 规范）—— 所以"fetch HTML 塞进 shadow"对第三方页面是死的：不执行脚本页面不可交互，执行脚本则污染全局。
6. **ofa.js 4.6.12 原生支持别名** —— `$.config({ alias: { "@xxx": "绝对地址" } })`；别名须匹配 `/^@.+/`、值不能以 `.` 开头、重复定义抛 `alias_already`、未定义抛 `no_alias`。注意 `<link href="@xxx/...">` 不走 ofa 解析。
7. **ofa 动态路由段（`#/app/:name`）未验证** —— 源码里没找到证据，建议自写 hash 路由。

## 设计红线

- 不设计需要子应用配合的强约定（第三方页面做不到）
- 不引入 ofa.js 之外的运行时依赖
- 不过度设计：能跑、好加页面、不崩，比架构优雅重要
