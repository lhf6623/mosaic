# Mosaic 规划

> 基于 [ofa.js](https://ofajs.com) 的 **免安装、免构建** Web Components UI 框架。
> CSS 用 UnoCSS 做原子化，配色与尺寸走三层 CSS 变量令牌，通过 jsDelivr `/gh/` 分发。

本文是总纲。配色见 [`design-tokens.md`](./design-tokens.md)，组件写法见 [`components.md`](./components.md)，
ofa.js 的坑见 [`ofa-pitfalls.md`](./ofa-pitfalls.md)（**写组件前必读**），实测调研见 [`research/`](./research/)。

---

## 一、定位与约束

**一句话**：在 HTML 里加一个 `<link>` 和一个 `<script type="module">`，就能用 `<mc-button>`。
不需要 npm，不需要打包器，不需要脚手架。

| #   | 约束                                                  | 为什么                                                                                                                                                          |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 使用者侧零工具链                                      | 立项前提。任何"请先安装 X"的方案直接否决                                                                                                                        |
| C2  | 组件**不过打包器**：`packages/**.html` 源 = 产物      | ofa.js 的组件形态就是一个可独立寻址的 `.html`，被运行时 `<l-m src>` 拉取。它不应该变成 JS bundle                                                                |
| C3  | 组件不依赖宿主页面的任何 CSS                          | 宿主可能没有 reset，也可能有很激进的 reset                                                                                                                      |
| C4  | 定制点只用原生 CSS：`style="..."` + 令牌 + `::part()` | 与 C1 配套：配置对象需要写 JS，CSS 不需要                                                                                                                       |
| C5  | 只有一个运行时依赖 ofa.js，且 pin 在验证过的版本      | 见 [D1](#d1-分发走-gh仓库即产物) 与 [P23](./ofa-pitfalls.md)。唯一例外是代码高亮：**可选**依赖，懒加载、失败即降级（见 [D7](#d7-代码高亮可选依赖--失败即降级)） |

---

## 二、关键决策

### D1. 分发走 `/gh/`，仓库即产物

**结论**：`https://cdn.jsdelivr.net/gh/lhf6623/mosaic@1.0.0/...`，不发布 npm。

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

### D2. 组件形态：`packages/{name}/{name}.html`，源即产物

```
packages/button/
  button.html    ← 组件本体，源 = 产物，构建不碰它
  README.md      ← 自包含文档
  index.html     ← 验收页加载器
  page.html      ← 验收页内容
```

标签名 = `mc-` + 目录名（目录 `button` → 标签 `mc-button`）。
**目录/文件用语义名，标签用带前缀的语义名** —— 一条规则同时消掉了"目录名 vs 标签名"的歧义。

**为什么组件本体不过构建器**：ofa.js 的组件就是一个 `.html`，
`<l-m src="...">` 运行时拉取并注册。它不该被转译、内联或打包（C2）。
构建只产出**共享的 CSS**，不碰组件文件。

---

### D3. CSS 如何进入 Shadow DOM —— 分三层，各自用最合适的机制

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

**运行时**（`packages/boot/mosaic.js`，约 40 行，手写）：

```js
const CSS_URL = new URL('./mosaic.css', import.meta.url).href;
const SHADOW_URL = new URL('./shadow-base.css', import.meta.url).href;

let utilities = null; // 文档级 sheet：令牌 + 工具类
let shadowBase = null; // 只进 shadow root 的 reset
const pending = new Set(); // sheet 就绪前创建的 shadow root

// 必须在任何 ofa 组件实例化之前装好补丁
const nativeAttach = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (init) {
  const root = nativeAttach.call(this, init);
  if (init?.mode !== 'open') return root;
  if (utilities) root.adoptedStyleSheets = [...root.adoptedStyleSheets, utilities, shadowBase];
  else pending.add(root); // 竞态兜底：稍后补上
  return root;
};

(async () => {
  const load = async (url) => {
    const sheet = new CSSStyleSheet();
    await sheet.replace(await (await fetch(url)).text());
    return sheet;
  };
  [utilities, shadowBase] = await Promise.all([load(CSS_URL), load(SHADOW_URL)]);
  for (const root of pending) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, utilities, shadowBase];
  }
  pending.clear();
})();
```

几个要点：

- **`fetch(CSS_URL)` 不会产生第二次下载**：页面上已经有 `<link href="mosaic.css">`，
  fetch 命中同一个 HTTP 缓存条目。
- **竞态窗口是安全的**：`<link>` 已经让令牌生效（自定义属性继承），
  sheet 就绪前创建的 shadow root 被 `pending` 收着，稍后补 adopt。
- **`mosaic.css`（可 link、可 adopt）与 `shadow-base.css`（只能 adopt）必须物理分开**：
  后者含 `*{box-sizing}` / `button{cursor}` 这类元素级 reset，
  一旦被 `<link>` 到宿主页面就会重置使用者的整页样式。
- **`@layer` 是硬性要求**，理由见事实 4。层顺序：
  ```
  mosaic.tokens < mosaic.preflights < mosaic.components < mosaic.utilities
                                                          ↑ 组件自己的 <style> 未分层，赢过全部
  ```

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

### D4. 主题：只走 CSS 变量，禁用 `dark:` 变体

**结论**：主题切换 = 在 `<html>` 上切 `data-theme`，令牌整体换值。组件里**禁止** `dark:`。

**依据**：

- `dark:` 变体生成的是 `.dark .dark\:bg-x` 这类**后代选择器**。
  `<html class="dark">` 在 shadow 树外面，shadow root 内的选择器**匹配不到跨边界的祖先**。
  在组件里写 `dark:` 是**静默失效**，没有任何报错。
- `:host-context()` 已被 CSSWG 从规范移除（MDN 标 Deprecated），不能作为主路径。
- 自定义属性跨 shadow 继承（D3 事实 3），所以"换令牌"在天性上就是对的方案。

`uno.config.ts` 里 `dark: 'media'` 只是为了有人误写 `dark:` 时行为可预期（媒体查询在 shadow 内有效），
并与令牌里的 `prefers-color-scheme` 兜底保持一致。

**组件变体一律用属性**（`:host([color="danger"])`、`:host([variant="outline"])`），理由三条：
HTML 干净、UnoCSS 不需要 safelist（没有拼接类名）、CSS 体积不随变体数膨胀。

**代价**：像 `dark:shadow-lg` 这种非颜色差异没法用变体表达，
解法是提升为令牌（如 `--mc-shadow-card`），而不是破例用 `dark:`。

---

### D5. UnoCSS 的三层用法

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
  退出码 0，产出一份没有任何令牌定义的坏 CSS（32660 B → 19487 B）。
  守卫在 `tools/build-css.mjs` 里（`process.exit(1)` + 明确文案）。
  两个位置上的讲究：
  - **不能放在 `uno.config.ts` 里**：那要引 `node:fs`，会给一个纯 JS 项目强加
    `@types/node` 依赖；而且配置加载器（unconfig）会吞掉 init 阶段抛出的异常，
    只剩一个没有信息的退出码 1 —— 等于静默失败了一半。
  - **不能用 `throw`**：理由同上，异常到不了终端。

**预编译原子 CSS 的根本矛盾**：我们能编译的只有已知类名，而使用者会写什么是未知的。
所以 `mosaic.css` 是一份**精选子集**（当前 370 个工具类）。
子集之外的（`mt-7`、`bg-gradient-to-r`…）不存在，需要时得自己写 CSS。
**这个边界要写在文档首页**，而不是等人踩坑。

---

### D6. 令牌三层模型

```
L1 原始色阶   --mc-primary-500: 134 102 255;      ← 存 sRGB 通道三元组
L2 语义令牌   --mc-color-primary: rgb(var(--mc-primary-600));
L3 组件令牌   --mc-btn-fill: var(--mc-color-primary);
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

### D7. 代码高亮：可选依赖 + 失败即降级

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

## 三、目录结构

```
mosaic/
├── packages/
│   ├── boot/                      ← 运行时引导
│   │   ├── mosaic.js              # 手写：attachShadow 补丁 + adopt（唯一必需引入）
│   │   ├── mosaic.css             # 生成并提交：令牌 + 工具类（可 <link>）
│   │   └── shadow-base.css        # 手写：只进 shadow root 的 reset（禁止 <link>）
│   ├── color/
│   │   ├── tokens.css             # 生成并提交：三层令牌
│   │   └── page.html              # 令牌文档页（ofa.js 页面模块）
│   ├── button/
│   │   ├── button.html            # 组件本体（源 = 产物，构建不碰它）
│   │   └── page.html              # 组件文档页 ← 文档跟着组件走
│   ├── code/
│   │   ├── code.html              # 代码展示（高亮可选依赖 + 降级路径）
│   │   └── page.html
│   └── {next}/{next}.html ...
├── tools/
│   ├── gen-tokens.mjs             # 调色板生成 + WCAG 自检
│   ├── build-css.mjs              # CSS 构建入口（含「缺输入大声失败」守卫）
│   └── serve.mjs                  # 本地静态服务器（零依赖，强制禁缓存）
├── uno.config.ts                  # 纯声明式配置，不引 node: 内置模块
├── tsconfig.json                  # 只覆盖 uno.config.ts，供 IDE 与 pnpm typecheck
├── index.html                     # 入口：只做引入（路由库 + o-app 挂载点）
├── app-config.js                  # ofa.js 应用配置（首页地址、加载态、错误兜底）
├── docs/                          # 站点级资源（跨组件的东西）
│   ├── pages/                     # 站点级页面模块：home / guide / components / specs
│   ├── layout.html                # 布局页（嵌套路由的父页面）：顶栏 + 正文带 + <slot>
│   ├── site-map.js                # 站点唯一数据源（结构即菜单）：页面 / 组件 / 层级 / order / hidden
│   ├── routes.js                  # 路由工具：route() 归一当前路由
│   ├── doc-nav.html               # <doc-nav>：左栏二级菜单（站点级 ofa 组件模板，结构 = site-map 的树）
│   ├── shell.css  content.css     # 文档级视口/高度链 / 正文 + 分栏样式（页面自己 link 后者）
│   └── site.js  theme-boot.js     # 换页复位 + 滚轮接力 / 首帧主题
├── tests/
│   ├── smoke.mjs                  # 冒烟测试入口：站点套件 + 各组件套件（单飞见 README）
│   ├── lib/harness.mjs            # 公共基座：浏览器 / 断言 / 穿透查询注入 / 导航工具
│   └── site/*.mjs                 # 跨组件的站点不变量
# 组件自己的套件跟着组件走：packages/<name>/{demos,test}/
├── agent/
│   ├── PLAN.md  design-spec.md  design-tokens.md
│   ├── component-spec.md  components.md  ofa-pitfalls.md
│   └── research/{unocss,jsdelivr}.md
├── package.json                   # private: true（永不 publish）
└── README.md
```

**没有 `dist/`**。`packages/**` 就是 CDN 上的东西。

**产物与手写文件的分界**：

| 文件                   | 手写 / 生成 | 可否 `<link>`              | 可否 adopt 进 shadow |
| ---------------------- | ----------- | -------------------------- | -------------------- |
| `boot/mosaic.js`       | 手写        | —（脚本）                  | 它负责 adopt         |
| `boot/mosaic.css`      | **生成**    | ✅                         | ✅                   |
| `boot/shadow-base.css` | 手写        | ❌                         | ✅                   |
| `color/tokens.css`     | **生成**    | ✅（已被 mosaic.css 包含） | ✅                   |

---

## 四、构建与分发

```bash
pnpm tokens        # tools/gen-tokens.mjs → packages/color/tokens.css（含 WCAG 自检，不达标退出 1）
pnpm build:css     # unocss -c uno.config.ts → packages/boot/mosaic.css
pnpm build         # = tokens && build:css
pnpm check:drift   # CI：重新生成后 git diff --exit-code，防止产物与生成器漂移
pnpm dev           # 本地验收（http-server -c-1 禁缓存，端口 8642）
```

**发布流程**：

1. 改代码 → `pnpm build` → 提交（**生成物一起提交**）
2. 打 tag `v1.0.0` → 推送 → jsDelivr 自动可用
3. 文档里的引入地址锁精确版本：`.../gh/lhf6623/mosaic@1.0.0/packages/boot/mosaic.js`
4. 发布后**逐文件比对内容哈希**：jsDelivr 有 version fallback，
   新版本缺文件时会静默回退旧版本，只看 HTTP 200 会被骗过去

---

## 五、里程碑

### M0 — 打通骨架 ✅ **D3 已验证成立**

冒烟测试在 `tests/smoke.mjs`（真浏览器，22 项断言，`pnpm test`）。

- [x] `attachShadow` 补丁在真实 ofa.js 上生效 —— shadow root 内 `class="flex gap-2"` 起作用
- [x] `@layer` 优先级正确 —— 组件自身 `<style>`（未分层）赢过工具类
- [x] 工具类产物注入 shadow root（387 条规则）
- [x] 主题切换能穿过 shadow 边界（`rgb(114 70 237)` → `rgb(189 182 255)`）
- [x] 令牌靠自定义属性继承进 shadow root
- [x] 文档站五个页面可访问、无 404、色板实时渲染
- [ ] 验证降级：故意让补丁失效，确认颜色/尺寸仍正常，只有排布退化
- [ ] CI 接入（`check:drift` + 冒烟测试 + 体积上限）

**M0 推翻/修正了两条我原本写错的设计**，都已落到实现里：

1. **颜色令牌全链路必须是通道三元组。**
   第一版 L1 存三元组、L2 却存完整颜色（`rgb(var(--mc-primary-600))`），
   UnoCSS 拼出 `rgb(rgb(114 70 237) / 1)` 这种非法 CSS，**所有语义色工具类静默失效**。
   是冒烟测试里的 `text-muted → neutral-600` 断言把它抓出来的。

2. **令牌只能定义在 `:root`，不能带 `:host`。**
   令牌表在 shadow root 里也会被 adopt，`:host` 会给宿主元素重新赋一遍亮色值，
   盖掉从文档继承的暗色值 —— 切主题时组件纹丝不动。同样零报错。

这两条都是「D3 是否成立」的一部分，结论是：**D3 成立**，但前提是上面两条守住。

- **产出**：可运行的文档站（`pnpm dev`）+ 22 项真浏览器断言全绿

### M1 — 令牌与基础组件

- [ ] `mc-button` / `mc-code` / `mc-collapse`（均已实现）/ `mc-icon` / `mc-card` / `mc-badge` / `mc-spinner`
- [ ] 每个组件补齐 `{name}.html` + `README.md` + `index.html` + `page.html` 四件套
- **产出**：可发布的 0.1.0

### M2 — 表单与反馈

`mc-input` / `mc-textarea` / `mc-checkbox` / `mc-radio` / `mc-switch` / `mc-select` /
`mc-alert` / `mc-toast` / `mc-progress`

表单类组件统一约定见 [`components.md`](./components.md)。
这一批会大量撞上 [`ofa-pitfalls.md`](./ofa-pitfalls.md) 的 P6 / P18 / P19 / P20（值的反射与事件穿透）。

### M3 — 浮层与布局

`mc-dialog` / `mc-dropdown` / `mc-tooltip` / `mc-tabs` / `mc-table` / `mc-grid`

> ⚠️ M3 开头必须先验证图层：shadow DOM 里的 `position: fixed` + `z-index`
> 与宿主页面层叠上下文的关系。`--mc-z-*` 令牌已定义好，但弹出层挂在 shadow root 内部时，
> 是否会被宿主的 `transform` / `filter` 困住，需要实测后决定是否改用 popover API。

### M4 — 工程加固

CI 全量接入（令牌自检 + drift 检查 + 冒烟测试 + 体积上限）、
主题预设、自托管部署方案。

---

## 六、风险登记

| 风险                       | 影响                                         | 缓解                                                                    |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| **D3 运行时补丁失效**      | 组件失去排布（颜色/尺寸仍在）                | 降级是分级的（D3）；M0 端到端冒烟测试；退路是每组件 `<link>`            |
| 生成物与生成器漂移         | CDN 上的东西和源码不一致                     | 生成物提交进仓库 + CI `check:drift`                                     |
| jsDelivr 在大陆不可达      | 使用者无法加载                               | 换入口域名 + 自托管；不赌单一 CDN                                       |
| 预编译工具类子集不够用     | 使用者写了不存在的类名，静默无效果           | 文档首页写明边界；提供反馈入口                                          |
| ofa.js 升级破坏组件        | 大量组件同时失效                             | pin 验证过的版本 + `peerDependencies` 声明区间 + 升级必跑冒烟（见 P23） |
| 体积失控                   | 令牌 12.5 KB + 工具类 20 KB                  | CI 设体积上限；L1 色阶可拆成独立文件按需引入                            |
| 代码高亮的 CDN 不可达      | 代码块没有颜色（排版、行号、主题跟随都正常） | 失败即降级为纯文本；`hljs-base` 支持自托管 / 换镜像                     |
| 组件作者重复踩 ofa.js 的坑 | 排查极耗时（都是静默失效）                   | [`ofa-pitfalls.md`](./ofa-pitfalls.md) 作为写组件的必需前置阅读         |

---

## 七、待定

1. **标签前缀**：当前 `<mc-*>`。个人自用不 publish，只要目录名和标签前缀自洽即可。
2. **品牌主色**：当前 OKLCH 色相 288°（紫罗兰）。
   换色改 `tools/gen-tokens.mjs` 里一个数字，对比度自检会保证换完仍达标。
3. **是否随组件附一份给 AI 读的自包含 `README.md`** —— 纯增量工作，M1 之后再定。
