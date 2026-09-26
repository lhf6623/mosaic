# 关键决策（D1–D7）

每条都记了**为什么这么选**，以及被否决的备选。改这些决定之前先读完整条。

> 相关：[`README.md`](./README.md)（定位与约束）、[`roadmap.md`](./roadmap.md)（里程碑）。

---

## D1. 分发走 `/gh/`，仓库即产物

**结论**：`https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/...`，不发布 npm。
示例里的 `0.1.0` 是计划中的 M1 版本；仓库当前还没有 tag，所以这些 URL 在首次发布前会 404。

我原本认定 `/gh/` 会把 `.html` 301 甩到 `raw.githubusercontent.com`，据此决定改走 npm。
**那条结论是错的**，实测：

```
200  .../gh/ofajs/senti-ui@1.0.9/packages/button/button.html
     content-type: text/plain; cache-control: ...max-age=31536000, immutable
200  .../gh/ofajs/ofa.js@4.7.5/libs/scsr/test/comps/btn/t-btn.html
```

复现不出来。`.html` 在 `/gh/` 下正常服务，锁版本时是 1 年 `immutable`。

**改走 `/gh/` 的三个连带好处**：

1. **没有发布步骤**。打 tag 即发布，不用维护 npm 账号、不用对齐 `package.json` 版本和 tag
2. **没有 dist**。仓库里 `packages/**` 就是 CDN 上的东西，`源 = 产物`（正好满足 C2）
3. **不需要 npm publish 权限**，个人自用最省事

**代价与对策**：

- 生成物必须**提交进仓库**（`packages/color/tokens.css`、`packages/boot/mosaic.css`）。
  用 `pnpm check:drift` 在 CI 里重新生成后比对 `git diff`，防止提交的产物和生成器漂移。
- 版本别名（`@latest` / `@1`）是 7 天缓存，**文档一律锁精确版本**。
- jsDelivr 在大陆历史上反复出现不可达（可核实的集中事件是 2022-05）。
  冗余方案：换入口域名（`fastly.` / `gcore.` / `testingcf.jsdelivr.net`，同路径零改动）+ 自托管。

**这条路要接受的一件事**：`package.json` 里 `private: true` 是**正确的**，我们永远不 publish。

---

## D2. 组件形态：`packages/{name}/{name}.html`，源即产物

```
packages/button/
  button.html          ← 组件本体，源 = 产物，构建不碰它
  page.html            ← 文档页，注册在 docs/site-map.js，路由 #/packages/button/page.html
  demos/*.html         ← 可交互演示，一个例子一个文件，可单独打开
  test/button.test.mjs ← 组件自己的冒烟套件
```

没有 per-component 的 `README.md` / `index.html`：文档页就是 `page.html`。

标签名 = `mc-` + 目录名（目录 `button` → 标签 `mc-button`）。
**目录/文件用语义名，标签用带前缀的语义名** —— 一条规则同时消掉了"目录名 vs 标签名"的歧义。

**为什么组件本体不过构建器**：ofa.js 的组件就是一个 `.html`，
`<l-m src="...">` 运行时拉取并注册。它不该被转译、内联或打包（C2）。
构建只产出**共享的 CSS**，不碰组件文件。

---

## D3. CSS 如何进入 Shadow DOM —— 分三层，各自用最合适的机制

这是全案最核心的技术约束。

**已核实的事实**：

1. ofa.js 的组件渲染是（`packages/xhear/register.mjs:42`）：

   ```js
   const root = ele.attachShadow({ mode: 'open' });
   root.innerHTML = template.innerHTML;
   ```

   即**组件必定有 shadow root**，模板里的 `<style>` 是作用域内的。

2. 文档级 `<link>` 的规则**不会**进入 shadow root。

3. **但可继承的自定义属性会跨 shadow 边界继承。**

4. MDN 明确：`adoptedStyleSheets` 在 shadow root 内**排在组件自身 `<style>` 之后**，
   也就是**优先级更高**。所以工具类必须放进 `@layer`，否则会反过来盖住组件样式。

**关键区分：共享令牌 ≠ 共享工具类。**

我上一版把这两件事捆在一起，于是把"工具类进 shadow root"当成了整个 CSS 方案的问题，
凭空造出一个运行时单点依赖。实际上：

- **令牌**（`--mc-*`）是自定义属性 → **天然继承进 shadow root** → 只要在文档级写一份就行，**零机制**
- **工具类**（`.flex` / `.gap-2`）是普通规则 → **进不去** → 这才需要机制

所以分三层，各用各的：

| 层           | 内容          | 送达方式                                      | 依赖                |
| ------------ | ------------- | --------------------------------------------- | ------------------- |
| **令牌**     | `--mc-*` 定义 | 文档级 `:root` / `[data-theme="dark"]`        | **无**（靠继承）    |
| **工具类**   | UnoCSS 产物   | 共享 `CSSStyleSheet` adopt 进每个 shadow root | `attachShadow` 补丁 |
| **组件样式** | `:host` 视觉  | 组件模板自带的 `<style>`                      | **无**              |

**由此得到一个很有用的降级性质**：补丁挂了 → 颜色、圆角、尺寸**全部正常**
（令牌靠继承），只有工具类提供的排布失效。故障是分级的，不是全有全无。

**运行时**（`packages/boot/mosaic.js`，83 行，手写）就做三件事：

1. **补 `Element.prototype.attachShadow`**：新建 shadow root 立刻 adopt 两份 sheet；
   sheet 未就绪先收进 `pending`，稍后补上。
2. **加载两份 sheet**：`mosaic.css`（令牌 + 工具类）与 `shadow-base.css`（元素级 reset，
   只能 adopt）；失败只 `console.error`，退化成"有颜色无排布"。
3. **补扫 `walk(document.documentElement)`**：给补丁装上之前已存在的 shadow root 递归补
   adopt（`querySelectorAll` 不跨边界，只能递归）。

节选（`packages/boot/mosaic.js:29-37`）：

```js
Element.prototype.attachShadow = function (init) {
  const root = nativeAttach.call(this, init);
  if (!init || init.mode !== 'open') return root;
  if (loaded) adopt(root);
  else pending.add(root);
  return root;
};
```

几个要点：

- **`fetch` 不会产生第二次下载**：页面上已有 `<link href="mosaic.css">`，fetch 命中同一个 HTTP 缓存条目。
- **`mosaic.css`（可 link、可 adopt）与 `shadow-base.css`（只能 adopt）必须物理分开**：
  后者含 `*{box-sizing}` / `button{cursor}` 这类元素级 reset，
  一旦被 `<link>` 到宿主页面就会重置使用者的整页样式。
- **`@layer` 是硬性要求**，理由见事实 4。层顺序在 `packages/color/tokens.css` 里一次性声明：
  `mosaic.base < mosaic.tokens < mosaic.preflights < mosaic.components < mosaic.utilities`；
  组件自己的 `<style>` 未分层，赢过全部。

**否决/备选的方案**：

| 方案                     | 结论                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 每组件模板里放 `<link>`  | **备选**。零 JS、源=产物，但每实例多一个 `<link>` 节点，且首屏有短暂无样式窗口。若补丁方案出问题，退到这个 |
| 构建期把工具类内联进组件 | **否决**。破坏 C2（源≠产物），代码库和产物两套                                                             |
| 组件内部完全不用工具类   | **否决**。那就没有理由引入 UnoCSS 了                                                                       |
| 用 `<inject-host>` 注入  | **否决**。它注入到宿主所在作用域（顶层则进 `document.head`），**进不了 shadow root**                       |

> **这是唯一一个我建议在 M0 之后复盘一次的决策。** 补丁失效的风险用冒烟测试兜底，
> 退路是退到"每组件 `<link>`"。

---

## D4. 主题：只走 CSS 变量，禁用 `dark:` 变体

**结论**：主题切换 = 在 `<html>` 上切 `data-theme`，令牌整体换值。组件里**禁止** `dark:`。

**依据**：

- `uno.config.ts` 设的是 `dark: 'media'`，`dark:bg-black` 编译出来是
  `@media (prefers-color-scheme: dark){…}`，在 shadow root 里其实**生效** ——
  但它跟的是操作系统偏好，跟不了 `<html data-theme>` 这套三态切换。
  所以组件里**禁止** `dark:`：需要暗色差异就提升为令牌。
- `:host-context()` 已被 CSSWG 从规范移除（MDN 标 Deprecated），不能作为主路径。
- 自定义属性跨 shadow 继承（D3 事实 3），所以"换令牌"在天性上就是对的方案。

`dark: 'media'` 只是让误写的 `dark:` 行为可预期（跟 OS，而非页面主题）。

**组件变体一律用属性**（`:host([color="danger"])`、`:host([variant="outline"])`），理由三条：
HTML 干净、UnoCSS 不需要 safelist（没有拼接类名）、CSS 体积不随变体数膨胀。

**代价**：像 `dark:shadow-lg` 这种非颜色差异没法用变体表达，
解法是提升为令牌（如 `--mc-shadow-card`），而不是破例用 `dark:`。

---

## D5. UnoCSS 的三层用法

UnoCSS 在**构建期**运行，产出静态 CSS。它在这里有三个不可替代的作用：

**① 令牌映射层** —— `theme.colors` 全部写成 `rgb(var(--mc-color-*) / <alpha-value>)`。
这是 UnoCSS 在这个项目里最核心的价值：原子类**自动获得主题切换和透明度**。

```ts
primary: { DEFAULT: 'rgb(var(--mc-color-primary) / <alpha-value>)', /* ... */ }
// → bg-primary、text-primary、bg-primary/50 全部可用，且随主题自动切换
```

**② 使用者页面层** —— 预编译一份精选工具类子集，使用者在自己的 HTML
和自己的 ofa 组件里直接写 `<div class="flex gap-4 p-6">`。

**③ 组件内部层** —— 组件模板里用原子类写**内部排布**；
`<style>` 里用令牌写**对外可见的视觉**（尺寸/颜色/圆角），
保证使用者 `style="height:32px"` 能覆盖。

> **诚实说明**：如果一个组件的视觉几乎全在 `:host` 上（button 就是这样），
> 第 ③ 层能用的原子类会很少。原子化在这个项目里的主要价值在 ① 和 ②。
> 这是这类组件的性质决定的，不硬凑。

**必须遵守的配置约束**（都写进 `uno.config.ts` 注释了）：

- **`presetWind3`，不是 `presetWind4`**。wind3 的 theme 色支持 `<alpha-value>` 占位符，
  wind4 不支持 —— 写了会产出 `rgb(var(--x) / <alpha-value>)` 这种非法 CSS 而**整条声明静默失效**。
  wind4 还自带 Tailwind4 整页 reset。（`presetUno` / `presetWind` 已废弃，是 wind3 的旧名）
- **`outputToCssLayers` 必须开**，理由见 D3 事实 4。
- **`@apply` 只能写在 `.css` 文件里**。UnoCSS 的 `idFilter` 只认 css 类扩展名，
  写在 `.html` 的 `<style>` 里会被原样留下。
- **动态类名会被静默丢弃**：`ui-btn-${size}` 会产出 0 字节 CSS 且**退出码为 0**。
  D4 的属性驱动变体从根上避开了这个坑。
- **组件里的 `<script>` 也会被当成类名来源**：默认提取器扫的是整个文件，
  `packages/code/code.html` 的 JS 里冒出来的标识符和字符串片段（`indent` / `px` / `py` / `m-0`）
  实测白产出过 4 条工具类规则 —— 体积是小事，`class="indent"` 这种名字被莫名定义才麻烦。
  解法是官方 skip 标记（注释必须是完整闭合的块注释）把 script 段包起来：
  `/* @unocss-skip-start */ … /* @unocss-skip-end */`。约束是标记之间不能再出现这套字符串。
- **缺输入必须大声失败**。已实测：`tokens.css` 缺失时 UnoCSS 静默跳过，
  退出码 0，产出一份没有任何令牌定义的坏 CSS（当时的实测：32660 B → 19487 B）。
  守卫在 `tools/build-css.mjs` 里（`process.exit(1)` + 明确文案）。
  两个位置上的讲究：
  - **不能放在 `uno.config.ts` 里**：那要引 `node:fs`，会给一个纯 JS 项目强加
    `@types/node` 依赖；而且配置加载器（unconfig）会吞掉 init 阶段抛出的异常，
    只剩一个没有信息的退出码 1 —— 等于静默失败了一半。
  - **不能用 `throw`**：理由同上，异常到不了终端。

**预编译原子 CSS 的根本矛盾**：我们能编译的只有已知类名，而使用者会写什么是未知的。
所以 `mosaic.css` 是一份**精选子集**（当前 370 个工具类）。
子集之外的（`mt-7`、`bg-gradient-to-r`…）不存在，需要时得自己写 CSS。
这个边界已写在 `docs/pages/guide.html`（常见问题）与 [README](../README.md)，而不是等人踩坑。

---

## D6. 令牌三层模型

```
L1 原始色阶   --mc-primary-500: 134 102 255;      ← 存 sRGB 通道三元组
L2 语义令牌   --mc-color-primary: rgb(var(--mc-primary-600));
L3 组件令牌   --mc-button-fill: var(--mc-color-primary);
```

**组件只允许消费 L2 和 L3**，永远不碰 L1。由 `blocklist` 强制拦截
（`blocklist` 支持正则，`safelist` 不支持 —— 实测出来的类型差异）。

**全链路唯一不变量：颜色令牌存的都是「R G B」通道三元组**（存不包 `rgb()`，用必须包）。

不这样做的后果实测过：第一版里 L1 存三元组、L2 却存了完整颜色（`rgb(var(--mc-primary-600))`），
UnoCSS 拼出 `rgb(rgb(114 70 237) / 1)` 这种非法 CSS，**所有语义色工具类静默失效**，
颜色全部落回继承值，控制台零报错。

**另一条硬约束：令牌只定义在 `:root` 上，刻意不带 `:host`。**
令牌表在 shadow root 里也会被 adopt，而 `:host` 会给宿主元素重新赋一遍亮色值，
盖掉从文档继承下来的暗色值 —— 表现为「切主题时组件纹丝不动」。
`:root` 在 shadow root 内不匹配任何元素，天然无害。这条同样实测踩过。

代价是放弃 P3 广色域，将来可以加 `@supports (color: oklch(0 0 0))` 覆盖层补上。

```css
/* 使用者换肤：未分层 → 必定赢过 @layer mosaic.tokens */
:root {
  --mc-primary-600: 16 185 129;
}
```

---

## D7. 代码高亮：可选依赖 + 失败即降级

**结论**：`mc-code` 的语法高亮由 highlight.js 提供，从 jsDelivr **按需懒加载**
（core + 用到的语言，pin `11.11.1`），失败时**退化为纯文本**。

**为什么破了 C5 的"只有一个运行时依赖"**：代码块没有高亮，可用性差得多 ——
徒手写正则分词器要维护每种语言的边界（多行字符串、块注释、标签嵌套），
成本高、错得多，而且这套东西不该由 UI 框架自己发明。

**代价被三条约束压到最小**：

1. **懒加载**：只有页面里真的出现 `mc-code` 且给了 `language` 时才发请求，
   每种语言一次、多实例共享；配色是它官方 `styles/<theme>.min.css` 里的一张表，
   取回来**原样 adopt** 进组件的 shadow root，**不写一条覆盖它的规则**
   （亮暗各一份，默认 `github` / `github-dark`，切主题就换表）。
   给渲染节点刻意不加 `hljs` 类：主题里 `.hljs` 的底色与 `pre code.hljs` 的内边距
   会接管盒模型，而组件只需要 token 颜色 —— 这是"用它的配色、不接它的外观"。
2. **失败即降级**：离网 / CDN 不可达 / CSP 拦截 / 语言名写错 → 保持纯文本，
   控制台一条 `[mosaic]` 警告。排版、行号、主题跟随都不受影响 ——
   和 D3「补丁失效 = 有颜色无排布」一样是**分级故障**，不是全有全无。
3. **可替换**：`hljs-base` 属性指向别的来源（自托管、`fastly.` / `gcore.` 镜像），
   换源不需要改组件。

**首屏策略**：纯文本同步渲染（零依赖），高亮到位后原地升级 ——
不会出现"代码块先空白、后出字"。

**否决的备选**：自研分词器（成本与正确性都不划算）、构建期预高亮（破坏 C2 源=产物）、
引入完整 highlight.js 包（127 KB 一次全下，且带一堆用不到的语言）。

---
