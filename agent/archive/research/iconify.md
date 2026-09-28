# Iconify / 图标方案事实核查报告（面向 mosaic-ui：免构建、jsDelivr 分发、全 shadow root）

**核查时间**：2026-09-26（以 `api.iconify.design` 响应头日期、npm registry 实时数据、本机浏览器实测为准）
**标注约定**：`实测` = 本次亲自测量/运行（含本机浏览器与字节数测量）；`官方文档` = 官方文档或官方源码原文；`推测` = 推断；`未能核实` = 未找到可靠来源，不编造。

**来源与可信度（Lead 追加）**

- 本文由本次会话的调研子代理撰写，其浏览器环境已独立核对：Chrome **153.0.8010.53** + Playwright WebKit **26.6（`webkit-2359`）**，与文首声明一致。
- **已被 Lead 独立复现的关键结论**：跨域 `<use>` 被两引擎拒绝（`ACAO: *` 无效）、shadow root 引用 light DOM 的 `#id` 失败、同源外部 `<use>` 在 shadow root 内可用且 `currentColor` 可穿透、`mask-image` 指向 `<symbol>` 失败、sprite / data-URI CSS / registry JSON 三形态 gzip 同量级（≈40–50 B/图标）、238 个集合的许可分布（MIT 108 / CC-BY-4.0 52 / Apache-2.0 31 …）。
- **2025-04-01「删除 localStorage 缓存 / 不建议离线使用」的官方原文，Lead 已单独抓取 `iconify.design/news/2025.html` 复核通过。**
- **Lead 补充的两条（本文未覆盖）**：① 同 shadow root 内把 `<symbol>` 与 `<use>` 写在**同一次 `innerHTML`** 里，两引擎都渲染；但**先有 `<use href>`、之后异步补 symbol 时 WebKit 不重新解析**（Chrome 会重解析）—— 必须让 `use` 出现在 symbol 之后，或在 symbol 到位后重挂 `href`。② data-URI mask 在 shadow root 内的渲染**已实测通过**（本文把它列为「未单独实测」）。
- **待复核 → 已部分澄清**：本文测到的「同一 mask 覆盖面积跨引擎不一致（420 vs 576 px）」用的是 `<mask>` 元素 + `userSpaceOnUse` 夹具；**换成 preset-icons 实际产出的 data-URI mask 后，Lead 实测两引擎点亮像素几乎一致**（32px 描边图标：Chrome 156 / WebKit 160；24px check：Chrome 47 / WebKit 52，差 ~5%，属光栅化差异）。跨域 `mask` 在 WebKit 下的行为仍未测。
- **复现说明**：本文夹具路径为 `/tmp/icontest/`（临时目录，不随仓库保留）；要长期复现需把用例搬进 `tests/`。

---

## A. Iconify 运行时 API 与组件

### A1 公共 API 当前状态

**结论**

1. `api.iconify.design` 是免费公共服务，无需账号/密钥；官方文档只请求"考虑赞助"，**没有**任何速率限制数字、公平使用条款或 SLA 承诺 → 速率限制/公平使用/SLA：**未能核实**（官方文档中不存在此类声明）。
2. `实测` API 版本 **3.2.0**，`/collections` 返回 **238 个图标集、合计 378,032 个图标**。官方文档散文里的 "over 60k icons / more than 70 icon sets" 是**过时的动态占位符**（raw markdown 里写作 `${counters.icons-short}`），不要引用这组数字。
3. 2025–2026 **没有**发生 v2→v3 强制迁移或端点废弃；官方明确 v2/v3 查询并存且"will continue being supported"。
4. 批量上限：官方说单次查询**图标数量不限**，但浏览器有 URL 长度限制，Iconify 自己的组件把 URL 限制在 **500 字符**内。
5. 端点事实（`实测`）：批量 SVG 端点 `/{prefix}.svg?icons=...` **返回 404**；`/collection.json?prefix=...` 与 `/collections.json` 返回 **HTTP 200 但 body 是字符串 `404`**（历史遗留怪癖，别用）。
6. 响应头（`实测`）：`cache-control: public, max-age=604800, immutable`、`access-control-allow-origin: *`、`cross-origin-resource-policy: cross-origin`；**没有任何 `x-ratelimit-*` 头**。
7. 冗余设计：主域名 + `api.simplesvg.com` + `api.unisvg.com`，官方组件在 **0.75s** 超时后切备用主机。
8. 2025–2026 重要变更（news）：2025-04-01 所有组件**移除 localStorage 缓存**（GDPR，包体积约 -10%）；2025-12-02 API v3.1.1 关键 bug 修复；2025-11-26 **Figma API 限速**导致以 Figma 为源的图标集**不再维护**；2026-07-10 宣布 30 万+ 图标；2026-09-19 新增 VPS 一键部署脚本；2026-05-14 新版 icon-sets 网站支持"选中多个图标，生成 bundle 与 sprite"。

**证据（URL + 关键原文/数字）**

- <https://iconify.design/docs/api/> — 官方文档原文："Public API is available at `https://api.iconify.design`."、"It is a public service, servers are free to use, but please do keep in mind that running those servers is not free."；备份主机 `api.simplesvg.com` / `api.unisvg.com`；"timeout is 0.75 seconds"。（`官方文档`）
- <https://iconify.design/docs/api/icon-data.md> — "Number of icons per query is not limited, however be aware that browsers have limit on URL length. Iconify icon components limit URL length to 500."；查询形如 `/{prefix}.json?icons={icons}`。（`官方文档`）
- <https://github.com/iconify/website/blob/main/docs/api/queries.md> — "API v2 queries ... They are supported and will continue being supported"；"API v3 queries are available since version 3 of Iconify API."（`官方文档`）
- `实测`（2026-09-26）：`GET https://api.iconify.design/version` → `Iconify API version 3.2.0 (DE)`；`GET /collections` → 98,111 B JSON，238 个 set，`sum(total)=378032`；`GET /lucide.json?icons=home,user` → 647 B，200，头部无 rate-limit；`GET /lucide.svg?icons=home,user` → 404 "Not found"；`GET /collection.json?prefix=lucide` → 200，body=`404`；`GET /last-modified?prefixes=lucide,mdi` → `{"lastModified":{"mdi":1737398331,"lucide":1790080172}}`。
- `实测`：`GET /lucide.css?icons=home,user` 输出使用 `mask-image: var(--svg)` + `background-color: currentColor` 的 CSS（见 A/B 相关结论）。
- <https://iconify.design/news/2025.html>（原始文件 <https://github.com/iconify/website/tree/main/news/2025>）2025-04-01 条目原文："This update removes usage of `localStorage` for caching icons, making all components GDPR compliant."、"Iconify Icon components load icons from API should only be used when internet access is guaranteed. Those components should not be used for apps that can work offline."；2025-11-26："Figma has introduced heavy rate limiting for API queries... those icon sets will no longer be maintained."（`官方文档`）
- <https://iconify.design/news/2026.html>（原始文件 <https://github.com/iconify/website/tree/main/news/2026>）2026-05-14："Select multiple icons, generate bundles and sprites."；2026-07-10："over 300k open source icons"。（`官方文档`）
- `实测`：官方 API 软件 `@iconify/api@3.2.0` 源码中**没有任何限流代码**，只有用于图标集自动更新的 `UPDATE_THROTTLE=60`（秒）。→ 公共服务的限流（若有）来自 Cloudflare 层，官方文档未提及。（`实测` + `推测`）

**对我们的影响**

- 官方**不提供任何可用性承诺**，所以 mosaic-ui 不应把"图标能显示"作为框架的默认保证。
- 运行时 API 意味着：终端用户的浏览器要直连 `api.iconify.design`（Cloudflare）。在中国大陆的可达性/延迟不可控（`推测`，本次未能核实）。
- 若采用"运行时取图标"，请自行加一级失败兜底（内联 fallback 或空占位），不要指望 API 有 SLA。
- 不要把 `/{prefix}.svg?icons=` 当作 sprite 端点（实测 404）；Iconify API **没有** sprite 端点。官方能生成 sprite 的地方只有 icon-sets 网站的手动代码生成器（2026-05-14 news）。

---

### A2 `iconify-icon` Web Component

**结论**

1. 当前版本 **3.0.3**（npm `latest`，MIT），`实测` 构建产物体积：`dist/iconify-icon.min.js` = **22,658 B 未压缩 / 8,256 B gzip -9**；npm 解包体积 **247,847 B**（含 cjs/mjs/min/d.ts 多份构建）。官网页面上写的 `0.0.4` 是文档模板里的动态版本占位符，**不是**当前版本。
2. **默认从 API 取图标**，并把 SVG 渲染进组件自己的 shadow root（官方文档原文确认）。
3. **支持离线/自托管**，但方式是"自己喂数据"：`setCustomIconLoader()` / `addCollection()` / `addIcon()`，或自建 Iconify API。注意：2025-04 起 localStorage 缓存被**彻底删除**，官方明确不建议用于离线应用。
4. **FOUC/布局抖动确实存在**，官方文档有专门的 "Layout shift" 一节，根因是"web component 注册与渲染是异步的，渲染前元素没有宽度"；官方给的解法是 `iconify-icon { display:inline-block; width:1em; height:1em; }`。
5. 在 shadow DOM 中使用：**未能核实**存在已知问题。需要区分历史包袱：2020 年的 issue #33「use in the shadowDom (custom Element)」讲的是**旧版 `@iconify/iconify` SVG framework**（它只扫描 `document.body`，需要 `scanDOM(shadowRoot)`），**不是** `iconify-icon` web component。web component 由全局 `customElements` 注册，嵌套在别人的 shadow root 里工作。
6. 官方自述的 shadow DOM 缺点：无法方便地改图标内部样式（如 `stroke-width`）；**不能只用 `width`/`height` 属性缩放**，只能靠 `font-size`。

**证据（URL + 关键原文/数字）**

- `实测`：`https://registry.npmjs.org/iconify-icon/latest` → `version: 3.0.3`、`license: "MIT"`、`unpackedSize: 247847`、`fileCount: 11`、`dependencies: {"@iconify/types":"^2.0.0"}`。
- `实测`：`curl https://cdn.jsdelivr.net/npm/iconify-icon@3/dist/iconify-icon.min.js` → **22,658 B**；`gzip -9` → **8,256 B**。
- <https://iconify.design/docs/iconify-icon/>（raw: <https://github.com/iconify/website/blob/main/docs/iconify-icon/index.md>）
  - "This might cause layout shift. To avoid layout shift, add this to your CSS: `iconify-icon { display: inline-block; width: 1em; height: 1em; }`"
  - "Web component will retrieve icon data from Iconify API, then will render SVG in shadow DOM."
  - "Don't want to rely on third party API servers? You can host your own Iconify API. You can also use it with your own icons."
  - "Rendering only visible icons: As of version 2.0.0 of the web component, icons are rendered only when visible to the visitor."；"As of version 2.1.0, you can opt out of this behavior by adding `noobserver`".
- <https://iconify.design/docs/icon-components/> — 缺点原文："Requires access to Iconify API, making it unusable for offline applications."；shadow DOM 缺点："Accessing icon content, such as changing `stroke-width`, is not always possible."、"Cannot render icon without `width` and `height`, making it impossible to resize icon with those properties. Icon can be resized only with `font-size`."
- 抖动根因与解法（维护者原话）：<https://github.com/iconify/iconify/issues/296> — "Web component is initialised asynchronously by browsers, which means before it is initialised, icon is not rendered and element has no width. I always add this code to CSS: `iconify-icon { width: 1em; height: 1em; }`"。同一 issue 里还暴露了一个真实 bug（`observer` 属性名拼错 + 默认值反向），**在 2.1.0 修复**，改用 `noobserver`。（`官方文档`/维护者回复）
- 另一个抖动报告：<https://github.com/iconify/iconify/issues/344> "Content Shift Issue in React When Changing Routes with Iconify Icons"（2024-10-22 提，次日 closed，属 `@iconify/react`）。（`官方文档`/issue）
- 历史 issue（**不要误用**）：<https://github.com/iconify/iconify/issues/33>（2020，旧 framework，`scanDOM(shadowRoot)`）。
- <https://iconify.design/news/2025.html> 2025-04-01："Code that managed `localStorage` cache was not just disabled, it was removed. This reduces package size for components by about 10%."（`官方文档`）

**对我们的影响**

- 引入 `iconify-icon` = 8.3 KB gzip 运行时 + 首次访问的网络往返 + **无法离线** + 需要你自己写 1em 占位 CSS 才不抖。对"免构建、源=产物、CDN 分发"的 mosaic-ui 来说，这等于把框架的可用性外包给第三方 API。
- 嵌套 shadow root 本身**不是**障碍（没有找到已知 bug）；障碍是离线与抖动。
- 如果坚持用，最小兜底是：`iconify-icon{display:inline-block;width:1em;height:1em}` + 期望所有图标首次渲染有一次请求延迟。

---

### A3 官方对"生产环境用 API 还是自带图标数据"的建议

**结论**：官方立场明确——**运行时 API 只适合"联网保证 + 图标集合不确定"的场景**（主题/后台自定义器），**不适合离线应用**；构建期方案（SVG+CSS、Unplugin Icons）才是给常规项目的推荐。并且官方在 2025-09 承认 **SVG+CSS 方案在当时的 Safari 上不被支持**，需要 fallback 组件。

**证据**

- <https://iconify.design/docs/icons/icon-data.md> — "There are several downsides of using API to get icon data: Requires a visitor to be online. Not usable in offline applications. Relies on third party service..."；并指出构建期包"cannot use them at run time because they are too big"。（`官方文档`）
- <https://iconify.design/docs/icon-components/> — "Iconify icon components are perfect for complex projects like theme or website customisers, customisable admin panels or any similar projects, where icons can be customised by user."
- <https://iconify.design/news/2025.html> 2025-04-01 原文："Those components should not be used for apps that can work offline. For offline usage, see links above to alternative solutions."（指向 CSS 方案与 Unplugin Icons）
- <https://iconify.design/news/2025.html> 2025-09-28 "Fallback components for SVG + CSS"："currently the latest version of Safari browser does not support it. That means a fallback is required to render icons as full SVG without CSS for Safari users."（`官方文档`）
- <https://iconify.design/docs/usage/> — "SVG + CSS is the preferred solution because it: Reduces HTML size. Caches icons in CSS. Gives you full power of CSS to manipulate icons."（`官方文档`）

**对我们的影响**

- mosaic-ui 的定位（免构建、仓库即产物）与"构建期抽图标"天然冲突：你的框架无法约束使用者在 build 阶段做抽取。因此现实选项只有三种：**（a）运行时 API**、**（b）随组件分发的预生成资产（sprite/内联 SVG）**、**（c）完全不依赖图标**。"官方推荐构建期"这条建议对 mosaic-ui **不可直接套用**，但它的结论（离线优先）对你有利——支持 (b)。

---

## B. 构建期工具链与体积

### B4 Iconify 数据包与工具包

**结论**

| 包 | 版本 | 体积（npm 解包） | 文件数 | license 字段 | 定位 |
|---|---|---|---|---|---|
| `@iconify/json` | 2.2.533（2026-09-23） | **484,860,697 B ≈ 462 MiB** | 255 | MIT（包元数据；**数据逐集授权**） | 全量数据，等同 icon-sets 仓库 |
| `@iconify-json/lucide` | 1.2.136 | **611,972 B ≈ 598 KiB** | 9 | ISC | 单集数据包（`icons.json` / `info.json` / `metadata.json` / `chars.json`） |
| `@iconify-json/mdi` | 1.2.3 | 3,472,864 B ≈ 3.3 MiB | 9 | Apache-2.0 | 同上 |
| `@iconify-json/tabler` | 1.2.40 | 2,136,798 B ≈ 2.0 MiB | 9 | MIT | 同上 |
| `@iconify/collections` | 1.0.741 | 124,034 B | 5 | MIT | 只有 `collections.json`（集清单+授权） |
| `@iconify/utils` | 3.1.7 | 199,000 B | 155 | MIT | 运行时/构建期**基础解析与转换**（含 SVG 生成、CSS 生成） |
| `@iconify/tools` | 5.0.14 | 245,867 B | 184 | MIT | Node 端**导入/清理/校验/导出**（Figma、SVGO、JSON 包、单文件 SVG） |
| `@iconify/types` | 2.0.0 | 25,671 B | 9 | MIT | 类型定义 |
| `@iconify/api` | 3.2.0 | 212,765 B | 202 | MIT | 可自托管 API 服务 |

- UnoCSS 官方文档说 `@iconify/json`"~130MB"，与 npm 报的 **462 MiB 解包**不一致（可能是安装后压缩/稀疏差异）——引用时请注明来源不同。
- `@iconify/utils` 与 `@iconify/tools` **都不能生成 SVG sprite**（`实测`：把两个包 tarball 解出后 `grep -ri "sprite"` 全库**零命中**）。`@iconify/tools` 只有"导出单文件 SVG / 导出目录 / 导出 JSON 包 / 导出图标包"，`@iconify/utils` 只有"把单个图标转成 SVG"。
- `@iconify/utils` 里有一个**官方且机器可读的授权语义表**：`lib/misc/licenses.js` 导出 `licensesData`（SPDX → `{attribution, commercial, sameLicense}`）。这是把"要不要署名/能不能商用"自动化的官方基础。
- 版本断裂提醒（对 2025–2026 很重要）：`@iconify/utils` v3 与 `@iconify/tools` v5 **移除 CommonJS**（2025-06-08 / 2025-11-27），`@iconify/tools` v5 还用自研 XML 解析器替换了旧依赖；`@iconify/tools` v5.0.14 移除了 axios 依赖（2025-11-25），改用 `setFetch()`。

**证据**

- `实测`：npm registry `/latest` 与全量文档字段（`version`/`license`/`dist.unpackedSize`/`dist.fileCount`），2026-09-26 采集；发布页如 <https://www.npmjs.com/package/@iconify/json>、<https://www.npmjs.com/package/@iconify-json/lucide>、<https://www.npmjs.com/package/@iconify/utils>、<https://www.npmjs.com/package/@iconify/tools>。
- `实测`：`tar xzf @iconify/utils@3.1.7.tgz && grep -ril sprite package/` → 无结果；`@iconify/tools@5.0.14` 同样无结果。
- <https://iconify.design/docs/libraries/utils/> — "Parsing Iconify icon sets in `IconifyJSON` format. Exporting icons from `IconifyIcon` format ... as SVG. Basic parser for SVG."；"Iconify Utils can do only basic parsing ... It is not meant for more complex stuff."（`官方文档`）
- <https://iconify.design/docs/usage/svg/> — "Currently, you'll need to use JavaScript for that. There are no usable libraries for other programming languages."；"Use `iconToSVG()` to generate SVG content and attributes."（`官方文档`）
- <https://iconify.design/docs/libraries/tools/export/svg.md>、<https://iconify.design/docs/libraries/tools/icon-set/export.md> — 导出能力列表（单 SVG / 目录 / IconifyJSON / 图标包），**无 sprite**。（`官方文档`）
- 授权表源码：<https://app.unpkg.com/@iconify/utils@3.1.7/files/lib/misc/licenses.js>（`实测`已解包核对全文）。
- 迁移公告：<https://github.com/iconify/website/blob/main/news/2025/06.08.md>（utils 去 CJS）、<https://github.com/iconify/website/blob/main/news/2025/27.11.md>（tools v5 去 CJS + 自研 XML 解析器）、<https://github.com/iconify/website/blob/main/news/2025/25.11.md>（去 axios）。（`官方文档`）
- 单集包结构（`实测` tar 列表）：`icons.json, info.json, metadata.json, chars.json, index.js, index.mjs, index.d.ts, package.json, README.md`。

**对我们的影响**

- **`@iconify/json` 不可作为运行时依赖**（462 MiB）——这是最重要的结论。
- 若 mosaic-ui 想"零构建"生成 sprite，**没有现成的 Iconify 官方函数**可以直接用：`@iconify/utils` 能给你 `iconToSVG()`（单图标 → SVG 属性+body），sprite 的 `<symbol>` 拼装要你自己写（几行字符串拼接），或者用第三方 sprite 工具（见 E）。
- 想做"授权清单自动化"时，`@iconify/utils` 的 `licensesData` 是官方可用积木（但要自己按用到的图标集 join `collections.json`）。

---

### B5 `@unocss/preset-icons`（66.x）与 `@iconify/tailwind4`

**结论（`@unocss/preset-icons@66.10.5`，`实测`源码 + 官方文档）**

- **默认输出是 CSS 的 mask/background 图片（data-URI），不是 sprite、不是 symbol、不是 SVG 文件。** 渲染模式默认 `mode: 'auto'`（自动在 `bg`/`mask` 间选择，按图标是否含 `currentColor`）；可用 `?bg` / `?mask` 后缀逐图标覆盖。
- 支持 `collections`、`autoInstall`、`scale`（默认 1，但**注意** Iconify 官方文档提醒 UnoCSS 默认把图标缩放到 1.2em）、`prefix`（默认 `i-`）、`extraProperties`、`customizations`、`warn`、`cdn`。
- `autoInstall` **确实仍存在于 66.10.5**（类型定义 `autoInstall?: boolean`，注释 "will be also auto installed when missing"）——但当前官方文档页**不再介绍它**。
- **不支持 sprite/symbol 输出**（`实测`：包内 `grep -r "sprite\|<symbol"` 零命中）。想要 sprite 必须换工具。
- 浏览器端建议用 `@iconify-json/*` 而非 `@iconify/json`（官方原文："the `json` file is huge"）。

**结论（`@iconify/tailwind4@1.2.3`）**

- 输出同样是 **CSS 的 mask-image / background-image**（data-URI），通过动态选择器 `icon-[mdi-light--home]` 或"干净选择器 + `prefixes` 白名单"两种模式使用；选项只有 `prefix`、`scale`、`icon-sets`（自定义集）、`prefixes`。
- **不支持 sprite**。官方解释了为什么干净选择器必须写 `prefixes`：否则插件要为"每一个可能存在的图标"生成 CSS，"With over 60,000 icons available, it might take a lot of time. Then Tailwind CSS keeps it all in memory, which might cause Tailwind CSS to run out of memory."

**证据**

- <https://unocss.dev/presets/icons>（raw: <https://github.com/unocss/unocss/blob/main/docs/presets/icons.md>）— "By default, this preset will choose the rendering modes automatically for each icon"；`?bg` / `?mask`；`collections` 选项；"you can specify the `cdn` option since `v0.32.10`"；"If you prefer to install all the icon sets available on Iconify at once (~130MB)"；全文**无** sprite/symbol 字样。（`官方文档`）
- `实测`：`@unocss/preset-icons@66.10.5` 解包后 `dist/core-*.mjs` 中 `const { scale = 1, mode = "auto", prefix = "i-", warn = false, iconifyCollectionsNames, collections: customCollections, extraProperties = {}, customizations = {`，并出现 `autoInstall`；类型 `autoInstall?: boolean`；模式常量仅 `"auto" | "bg" | "mask"`；`grep -rn "sprite\|<symbol" dist/` **无命中**。
- <https://iconify.design/docs/usage/css/unocss/> — "Be aware that by default, UnoCSS scales icons to `1.2em`."；`customize` 回调用例（`customizations.customize`）。（`官方文档`）
- <https://iconify.design/docs/usage/css/tailwind/tailwind4/>（raw: <https://github.com/iconify/website/blob/main/docs/usage/css/tailwind/tailwind4/index.md>）— 选项 `prefix`/`scale`/`icon-sets`/`prefixes`；"`iconify` renders an icon as a mask image ... `iconify-color` renders an icon as a background image"；内存/耗时的原文说明。（`官方文档`）

**对我们的影响**

- 如果你的用户愿意构建，UnoCSS/Tailwind 插件能拿到"每图标 ~38–49 gzip B"的最小 CSS 体积（见 B6），但产物是 **data-URI CSS**，**在 shadow DOM 里同样受"mask 引用"规则影响**（相同 tree scope 内联可用，跨 shadow 引用 light DOM 不可用——见 D）。data-URI 形式的 mask 不涉及跨文档引用，所以这条路线在 shadow DOM 里是安全的。
- 但 mosaic-ui 是"免构建"，这两个插件都用不上；它们的价值在于**证明官方推荐路径的体积量级**，作为你自建方案的对照基线。

---

### B6 单图标字节数对照（同一份 lucide 数据，2026-09-26 本机 `gzip -9` 实测）

数据源：`@iconify-json/lucide@1`（`icons.json`，1,925 个图标 + 219 别名，24×24 描边图标；文件本身 609,294 B / gzip 91,984 B）。
sprite 构造：`<svg xmlns=...><symbol id="i-名字" viewBox="0 0 24 24">{body}</symbol>…</svg>`；单文件构造：同样的 `body` 包在完整 `<svg …>` 里。

| N | sprite 原文字节 | sprite gzip | **gzip/symbol** | N 个独立 SVG 文件 gzip 合计 | gzip/文件 | data-URI CSS gzip | gzip/图标 |
|---|---|---|---|---|---|---|---|
| 10 | 2,853 | 736 | 73.6 | 2,288 | 228.8 | 837 | 83.7 |
| 50 | 14,160 | 2,068 | **41.4** | 10,619 | 212.4 | 2,328 | 46.6 |
| 200 | 57,677 | 8,215 | **41.1** | 43,743 | 218.7 | 9,150 | 45.8 |
| 800 | 244,401 | 34,802 | 43.5 | 183,833 | 229.8 | 39,169 | 49.0 |

Iconify 官方 API 生成的 CSS（`/{prefix}.css?icons=`，含一次性的公共规则块）与 JSON：

| N | CSS 原文字节 | CSS gzip | gzip/图标 | JSON gzip | JSON gzip/图标 |
|---|---|---|---|---|---|
| 1 | 632 | 379 | 379.0 | 243 | 243.0 |
| 10 | 4,223 | 896 | 89.6 | 754 | 75.4 |
| 50 | 20,839 | 2,435 | 48.7 | 2,237 | 44.7 |
| 100 | 38,699 | 3,853 | **38.5** | 3,619 | 36.2 |

其他 `实测` 数字：`/lucide/house.svg` = 363 B（gzip 240 B）；`/mdi/home.svg` = 158 B（gzip 153 B）；`/mdi.css?icons=<50 个>` gzip = 2,406 B（48.1 B/图标）；`iconify-icon@3` min.js gzip = **8,256 B**。

**结论**

- **sprite（每 symbol 约 41–44 gzip B）≈ data-URI CSS（约 46–49 gzip B）**，sprite 略省；而"每个图标一个独立 SVG 文件"是 **213–230 gzip B/图标，贵 4–5 倍**（每个文件都要付 gzip 头与重复的 `<svg …>` 外壳）。
- **图标字体**的单图标字节数：**未能核实**（本次未构建字体做对照，官方也没有给出可比数字）。
- 关键量级感受：**200 个图标的整张 sprite，gzip 后约 8.2 KB**；换成 200 个独立文件是 43.7 KB。
- 上述 sprite 数字**不包含** `<use>` 引用端的开销（每个引用点约几十字节）。

**对 mosaic-ui 的具体启示（数字层）**

- 若每个组件 shadow root 内联自己的小 sprite，成本以"组件用到几个图标"计；一个 3 图标的 sprite gzip 大约 150–250 B（按 73.6 B/symbol 在 N=10 时偏高估算，N 小则固定开销占比高，`推测`）。
- 若分发一张全局 sprite（例如 200 图标 ≈ 8.2 KB gzip），必须解决"shadow root 如何引用"的问题——这正好是 D 节的主题，答案是：外部文件引用在跨域下**不可用**，同源下可用；跨 shadow root 引用 light DOM `#id` **不可用**。

---

## C. 许可

### C7 Iconify 工具链自身的许可

| 对象 | 许可 | 证据 |
|---|---|---|
| `api.iconify.design`（公共服务） | 无许可证概念；官方称"public service, servers are free to use"，仅请求赞助 | <https://iconify.design/docs/api/>（`官方文档`） |
| `@iconify/api`（自托管软件） | MIT | `实测` npm `license: "MIT"`，v3.2.0 |
| `@iconify/utils` | MIT | `实测` npm + 包内 `license.txt`，v3.1.7 |
| `@iconify/tools` | MIT | `实测` npm，v5.0.14 |
| `iconify-icon` | MIT | `实测` npm，v3.0.3，`license: "MIT"` |
| `@iconify/json`（数据包元数据） | **包元数据写 MIT，但数据是逐集授权的** | `实测` npm `license: "MIT"`；官方文档把数据授权指向各集 `info.license`（见 C8） |
| `@iconify-json/*`（单集包元数据） | 随集变化：lucide = ISC、mdi = Apache-2.0、tabler = MIT | `实测` npm 字段 |
| `@iconify/types` / `@iconify/collections` | MIT | `实测` npm |

- 速率限制 / 商用条款 / SLA：**未能核实**（官方文档中无此类文本；`@iconify/api` 源码无限流实现）。

### C8 图标集授权：机器可读格式 + 逐集风险

**结论 1：格式（当前 = 对象）**

当前（2025–2026）机器可读格式是 **对象**：

```json
"license": { "title": "ISC", "spdx": "ISC", "url": "https://github.com/lucide-icons/lucide/blob/main/LICENSE" }
```

- `spdx` 与 `url` **都是可选**：实测 238 个集中有 **13 个缺 `url`**（如 `carbon` 只有 `{title, spdx}`）。
- **不存在 `licenseTitle` 字段**：`实测` 对全部 238 个集的键做并集，键只有 `author, category, displayHeight, height, hidden, license, name, palette, samples, tags, total, version`。
- 旧格式（字符串）仍被兼容：`@iconify/utils@3.1.7` 的 `convertIconSetInfo()` 里 `typeof source.license === "string"` → 归一化成 `{title}`，并把 `{spdx, url}` 从对象里补全。`实测`源码：`info.license = { title: getSourceNestedString("license","title", typeof source.license === "string" ? source.license : "") }`。
- 权威类型定义：`@iconify/types` 的 `IconifyInfo.license = { title: string; spdx?: string; url?: string }`。

**结论 2：238 个集的授权分布（`实测`，2026-09-26 对 `/collections` 全量统计）**

| SPDX | 集数 |
|---|---|
| MIT | 108 |
| CC-BY-4.0 | 52 |
| Apache-2.0 | 31 |
| OFL-1.1 | 13 |
| CC0-1.0 | 10 |
| CC-BY-SA-4.0 | 7 |
| ISC | 3 |
| GPL-2.0-or-later | 2 |
| CC-BY-SA-3.0 | 2 |
| GPL-3.0-or-later | 2 |
| MPL-2.0 / GPL-2.0-only / BSD-3-Clause / Unlicense / CC-BY-NC-SA-4.0 / CC-BY-3.0 / GPL-3.0 / CC-BY-NC-4.0 | 各 1 |

- **宽松（无需署名、可商用）**：MIT 108 + Apache-2.0 31 + OFL-1.1 13 + CC0-1.0 10 + ISC 3 + MPL-2.0 1 + BSD-3-Clause 1 + Unlicense 1 = **168 / 238**。
- **需要署名**：CC-BY-* / CC-BY-SA-* 共 **64 个集、93,375 个图标**（用 `licensesData` 的 `attribution: true` 口径）。
- **禁止商用**：`cbi`(CC-BY-NC-SA-4.0, 1,737 图标)、`ps`(CC-BY-NC-4.0, 479 图标) —— **共 2 个集**。
- **GPL 系**（要求衍生同许可）：7 个集左右（`licensesData` 里 `sameLicense: true`）。

**结论 3：常用图标集逐一核对（`实测` 取自线上 `/collections`，URL 即集内 `license.url`）**

| 集 | SPDX | 署名要求 | 商用 | 备注 |
|---|---|---|---|---|
| Lucide (`lucide`) | **ISC** | 否 | 可 | 1,853 图标；<https://github.com/lucide-icons/lucide/blob/main/LICENSE> |
| Tabler (`tabler`) | MIT | 否 | 可 | 6,220 |
| Material Design Icons (`mdi`) | Apache-2.0 | 否 | 可 | 7,447 |
| Material Symbols (`material-symbols`) | Apache-2.0 | 否 | 可 | 15,717 |
| Bootstrap Icons (`bi`) | MIT | 否 | 可 | 2,078 |
| Phosphor (`ph`) | MIT | 否 | 可 | 9,072 |
| Remix Icon (`ri`) | Apache-2.0 | 否 | 可 | 3,188 |
| Iconoir (`iconoir`) | MIT | 否 | 可 | 1,671 |
| Carbon (`carbon`) | Apache-2.0 | 否 | 可 | 2,618；**license 对象缺 `url`** |
| Fluent UI System Icons (`fluent`) | MIT | 否 | 可 | 19,850 |
| Font Awesome 6 Solid (`fa6-solid`) | **CC BY 4.0** | **是** | 可 | 1,402；集标签为 **"Archive / Unmaintained"**，version 6.7.2 |
| MDI-Pictogrammers 系（`mdi`） | Apache-2.0 | 否 | 可 | 见上 |
| Simple Icons（`simple-icons`） | **未能核实**（该前缀未在本次 238 集列表核对范围内命中） | — | — | 未核实 |

**结论 4：官方是否提供"生成 attribution 清单"的工具**

- **官方没有**"一条命令生成 NOTICE/授权清单"的成品工具。（`未能核实` 存在此类官方 CLI；在 utils/tools 两个包里也没有对应导出。）
- 官方提供的是**积木**：`@iconify/utils` 的 `licensesData`（SPDX → `{attribution, commercial, sameLicense}`）+ `@iconify/collections`（`collections.json` 含每集授权）。自己 join 即得清单。
- 社区工具：**`@samrobbins/iconify-license`**（v1.1.1，2022-07-29，MIT，bin `iconify-license`），用法 `npx @samrobbins/iconify-license https://example.com`，用 Puppeteer 打开你的站点、检测用到哪些 iconify 集、输出授权与署名要求。**注意：2022 年后未更新，依赖 `puppeteer@^15`，已属陈旧**。（<https://www.npmjs.com/package/@samrobbins/iconify-license>）

**证据**

- `实测`：`GET https://api.iconify.design/collections`（238 集）逐集读取 `license.{title,spdx,url}`，统计见上；`GET https://raw.githubusercontent.com/iconify/icon-sets/master/collections.json`（123,131 B）与 `json/lucide.json` 的 `info.license` 结构一致。
- `实测`：`@iconify/utils@3.1.7` 的 `lib/misc/licenses.js` 全文（`licensesData`）：
  - `"Apache-2.0": freeLicense`（`attribution:false, commercial:true`）、`"MIT"`、`"MPL-2.0"`、`"CC0-1.0"`、`"ISC"`、`"OFL-1.1"`、`"Unlicense"`、`"BSD-2-Clause"`、`"BSD-3-Clause"` 同为 free；
  - `"CC-BY-3.0" / "CC-BY-4.0"` = `attribLicense`（`attribution:true, commercial:true`）；
  - `"CC-BY-SA-3.0" / "CC-BY-SA-4.0"` = `attribSameLicense`；
  - `"CC-BY-NC-4.0"` = `{attribution:true, commercial:false}`；`"CC-BY-NC-SA-4.0"` = `{attribution:true, commercial:false, sameLicense:true}`；
  - `"GPL-2.0-only" / "GPL-2.0-or-later" / "GPL-3.0" / "GPL-3.0-or-later"` = `freeSameLicense`。
- <https://app.unpkg.com/@iconify/types@2.0.0/files/types.d.ts>（`实测`解包）— `license: { title: string; spdx?: string; url?: string }`，注释 "SPDX license identifier."。

**对我们的影响**

- **可安全默认**：MIT/Apache-2.0/ISC/CC0 的集占 168/238。若 mosaic-ui 想"零授权负担"，优先在文档与预设里只推荐 Lucide(ISC)、Tabler(MIT)、MDI/Material Symbols(Apache-2.0)、Bootstrap Icons(MIT)、Phosphor(MIT)、Iconoir(MIT)、Carbon(Apache-2.0)、Fluent(MIT)。
- **必须有机制提醒**：CC-BY-4.0 的集有 52 个（含 Font Awesome），一旦用户用了它们，理论上有署名义务。mosaic-ui 最好在文档里给一张"署名要求表"，或提供一个 `credits` 组件的占位约定。
- 注意 **`carbon` 等 13 个集缺 `license.url`**：自动生成清单时要能容忍字段缺失。
- **不要自动把 Font Awesome 当成免费无义务资产**（下一节）。

### C9 Font Awesome Free 的 CC BY 4.0 署名如何落地

**结论**

1. Font Awesome Free 是**三分许可**：图标（SVG/JS 文件）= **CC BY 4.0**；字体文件（web/desktop font）= **SIL OFL 1.1**；其余非字体非图标文件（代码）= **MIT**。
2. CC BY 4.0 的署名要求是**实质性的**，必须：标注创作者、版权声明、许可声明、免责声明、指向材料的 URI/链接，并说明是否修改；但**允许多种落地形式**——法条原文允许 "in any reasonable manner based on the medium, means, and context"，并明确"提供一个包含所需信息的资源的 URI 或超链接"就算合理。
3. Font Awesome 官方的落地指引（其仓库 `LICENSE.txt` 的 "# Attribution" 节）原文是：**下载到的 Font Awesome Free 文件本身已内嵌足够的署名注释，正常使用时"you shouldn't need to do anything additional"**。
4. **关键推论（`推测`，但逻辑直接）**：如果你**只抽出几个图标的路径数据**、把它们塞进自己的 sprite/内联 SVG，通常会**丢掉那些内嵌注释**。此时"文件自带署名"这条豁免不再成立，你需要自己以其他合理方式满足 CC BY 4.0（例如在项目的 acknowledgements/README/关于页里写 "Icons: Font Awesome Free (CC BY 4.0)" 并附链接）。**没有**找到 Font Awesome 官方明确说"只用几个图标也必须每页显示署名"的文本 → 该具体问题**未能核实**。
5. 本次**未能抓取** `fontawesome.com/license/free` 的正文（该页为客户端渲染，抓到的 HTML 只有标题），因此**未能核实**该页上的具体措辞；以上 2/3 条依据的是 CC 官方 legalcode 与 Font Awesome 仓库里的 `LICENSE.txt`。

**证据**

- <https://github.com/FortAwesome/Font-Awesome/blob/6.x/LICENSE.txt>（`实测`全文下载，165 行）：
  - 第 13 行 `# Icons: CC BY 4.0 License (https://creativecommons.org/licenses/by/4.0/)`；正文 "The Font Awesome Free download is licensed under a Creative Commons Attribution 4.0 International License and applies to all icons packaged as SVG and JS file types."
  - 第 21 行 `# Fonts: SIL OFL 1.1 License`；"In the Font Awesome Free download, the SIL OFL license applies to all icons packaged as web and desktop font files."
  - 第 121 行 `# Code: MIT License`；"In the Font Awesome Free download, the MIT license applies to all non-font and non-icon files."
  - 第 147 行 `# Attribution`；原文："Attribution is required by MIT, SIL OFL, and CC BY licenses. **Downloaded Font Awesome Free files already contain embedded comments with sufficient attribution, so you shouldn't need to do anything additional when using these files normally.** We've kept attribution comments terse, so we ask that you do not actively work to remove them from files, especially code."
  - 第 160 行 `# Brand Icons`："**Please do not use brand logos for any purpose except to represent the company, product, or service to which they refer.**"
- <https://creativecommons.org/licenses/by/4.0/legalcode.en>（`实测`抓取正文）Section 3(a)(1)：必须保留 "identification of the creator(s)… a copyright notice; a notice that refers to this Public License; a notice that refers to the disclaimer of warranties; a URI or hyperlink to the Licensed Material…"；3(a)(2)：**"You may satisfy the conditions in Section 3(a)(1) in any reasonable manner based on the medium, means, and context in which You Share the Licensed Material. For example, it may be reasonable to satisfy the conditions by providing a URI or hyperlink to a resource that includes the required information."**（`官方文档`）
- 官方 license 页（本次未能取到正文）：<https://fontawesome.com/license/free>。
- Iconify 侧确认 FA6 Solid = CC-BY-4.0：`实测` `/collections` 中 `fa6-solid.license = {title:"CC BY 4.0", spdx:"CC-BY-4.0", url:"https://creativecommons.org/licenses/by/4.0/"}`，且该集被标注为 `"Archive / Unmaintained"`。

**对我们的影响**

- 若 mosaic-ui 内置或示例里出现 Font Awesome 图标：**在抽取图标数据的那一刻，就要在项目里放一份署名**（README / 关于页 / credits 组件）。别依赖"文件自带注释"。
- 品牌图标（brand icons）另有商标限制，不要在 UI 里把品牌 logo 当装饰图标用。
- 更省事的产品决策：**默认图标集避开 Font Awesome**（选 Lucide/Tabler/Material/Phosphor 等无署名义务的集），把 Font Awesome 作为"用户显式选择并自行承担署名"的可选集。

---

## D. shadow DOM 里使用 SVG sprite 的浏览器事实

> 本节最有力的部分来自**本机真实浏览器实测**（2026-09-26）：
> - **Blink**：系统安装版 Google Chrome **153.0.8010.53**（Playwright `channel: 'chrome'`）
> - **WebKit**：Playwright 内置 **WebKit 26.6**（`webkit-2359`，对应 Safari 26.x 引擎）
> - 方法：本地起两个 HTTP 服务（`127.0.0.1:8977` 同源；`127.0.0.1:8978` 响应头带 `Access-Control-Allow-Origin: *`），在 shadow root / light DOM 中放置各种 `<use>` 与 `mask-image`，截图后**逐像素**统计 40×40 区域内渲染出的红色像素数（`nothing` = 完全没渲染；数值即覆盖面积）。
> - **未测**：真实 Safari.app、Firefox。因此 WebKit 结论来自 Playwright WebKit，Firefox/Gecko **未实测**。

### D10 外部文件引用：`<use href="sprite.svg#id">`

**结论（实测，Chrome 153 + WebKit 26.6 一致）**

1. **同源外部文件引用可用**，且在 light DOM 与 shadow root 内**都可用**：
   - light DOM `<use href="/sprite3.svg#sym3">` → 渲染 880（WebKit）/ 873（Chrome）像素
   - **shadow root 内** 同一引用 → 同样渲染 880 / 873 像素 ✅
2. **跨域外部文件引用被浏览器直接拒绝，`Access-Control-Allow-Origin: *` 救不了**：
   - light DOM 与 shadow root 两种位置**都**渲染 0 像素 ❌
   - 控制台错误原文（WebKit）：`Unsafe attempt to load URL http://127.0.0.1:8978/sprite3.svg from origin http://127.0.0.1:8977. Domains, protocols and ports must match.`
   - 控制台错误原文（Chrome）：`Unsafe attempt to load URL http://127.0.0.1:8978/sprite3.svg from frame with URL http://127.0.0.1:8977/index3.html. Domains, protocols and ports must match.`
   - MDN 对此有明确说明："For security reasons, browsers may apply the same-origin policy on `<use>` elements and may refuse to load a cross-origin URL in the `href` attribute. **There is currently no defined way to set a cross-origin policy for `<use>` elements.**"
3. **无 fragment 的整文档引用（`<use href="/sprite.svg">`）实测不渲染**（0 像素，两个引擎）；MDN 说"modern implementations have been updated so that… you can refer to it without a URL fragment"，但**在本次 fixture 下两引擎都没渲染**（`推测`：我的 sprite 里只有 `<symbol>`，整文档引用缺可渲染内容所致；此点**不能**作为"浏览器不支持无 fragment 引用"的证据）。
4. **`currentColor` 能穿透**：sprite 内 symbol 用 `fill="currentColor"`，引用端在 shadow host 上设 `color:#c00`，两个引擎都渲染出**红色**（而不是默认黑色）。也就是说 use 引用的克隆内容会继承引用处的 `color`。
   - 注意这与"外部 SVG 作为 `img`/`background-image` 时不能用 `currentColor`"是**两回事**。Iconify 官方文档也提醒："One downside of using SVG as external resource is it cannot inherit color from parent element. Browsers will use black instead of `currentColor`."——那是说 `background-image`/`img`，不是 `<use>`。
5. **失败是静默的**：跨域被拒时没有可见占位、没有除控制台外的提示，元素就是什么都不画（因此会有"图标缺失导致的布局/视觉空洞"）。
6. 相邻事实：`data:` URL 形式的 `<use href="data:...">` 已被 Chrome 明确弃用/移除（安全原因），见 Chrome for Developers 博客与 MDN 的 "Loading resources from data URIs via `<use>`" 一节（`官方文档`）。

**证据**

- `实测`：见上表与命令输出（`/tmp/icontest/index3.html`，Chrome 153.0.8010.53 / WebKit 26.6）。
- <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/use> — "For security reasons, browsers may apply the same-origin policy on `<use>` elements… There is currently no defined way to set a cross-origin policy for `<use>` elements."；"### Loading resources from external files via `<use>`"；"### Loading resources from data URIs via `<use>` … is deprecated for security reasons."（`官方文档`）
- <https://developer.chrome.com/blog/migrate-way-from-data-urls-in-svg-use> — "Support for data: URLs in SVG `<use>` element will be removed."（`官方文档`，页面正文本次因网络无法抓取，仅依据搜索结果标题与摘要 → 该条**部分未能核实原文**；MDN 的对应段落可作独立佐证）
- 相关互操作 bug（WebKit）：<https://bugs.webkit.org/show_bug.cgi?id=303998> — "[SVG] Interoperability Failure: `<style>` inside external SVG referenced by `<use>` is ignored (Blink implements, WebKit/Gecko do not)"（2025-12-11 提，RESOLVED **DUPLICATE** of 249080）。说明**外部 `<use>` 本身在 WebKit/Gecko 是工作的**，问题在外部文件里的 `<style>` 不被应用。（`官方文档`）
- <https://bugs.webkit.org/show_bug.cgi?id=249080> — "CSS selectors should not pierce the shadow root created by the SVG `<use>` element"（duplicate；评论引 SVG2 §UseStyleInheritance）。（`官方文档`）

**对我们的影响（这是本次最重要的可执行结论）**

- **mosaic-ui 通过 jsDelivr `/gh/` 分发仓库文件 = 与用户站点跨域。因此"组件 shadow root 里写 `<use href="https://cdn.jsdelivr.net/gh/.../sprite.svg#icon">`" 在 Chrome 与 WebKit 上都会静默失败。** 这条路线**必须排除**。
- 可行的替代（按成本排序）：
  1. **把 sprite 内联进每个 shadow root**（`root.innerHTML = template.innerHTML` 里直接带 `<svg><symbol>` + `<use href="#id">`）——同 tree scope，实测可用（`实测`：shadow root 自定义 symbol → 880/873 像素渲染成功）。
  2. **使用 CSS `mask-image` + data-URI**（不涉及跨文档 `use`）——构建期把图标编成 data-URI CSS，运行时无外部请求。
  3. 若要外部 sprite，必须**同源**：让使用者把 sprite 放到自己站点（自托管），这在"免安装"体验上是退步。
- `currentColor` 可穿透这点是好消息：内联 symbol + `<use>` 可以正常跟随文字颜色，不需要为每个颜色生成一份资源。

### D11 shadow root 内 `<use href="#localId">` 引用 light DOM 的 `<symbol>`

**结论（实测，两引擎一致）**

1. **不能工作。** shadow root 内 `<use href="#light-icon">`（`<symbol id="light-icon">` 定义在文档 light DOM）→ 渲染 **0 像素**，且 `use.getBBox()` 返回 **0×0**；而完全相同的引用写在 light DOM 里 → 正常渲染。Chrome 与 WebKit 行为一致。
2. 反向、以及同 tree scope 都是正常的：
   - shadow root 内自己定义 `<symbol id="own-icon">` 并 `<use href="#own-icon">` → 渲染成功 ✅
   - light DOM 引用 light DOM 的 symbol → 成功 ✅
3. 规范层面：这是"ID 引用必须在同一 tree scope 内解析"的体现（shadow DOM 的封装）。W3C/CSSWG 有长期未决的讨论（"Clarify how fragment URLs are resolved within shadow trees"、webcomponents issue #179），实际浏览器**都不跨 shadow 边界解析**。
4. 已知浏览器差异主要在 CSS 选择器能否穿透 `<use>` 产生的 shadow tree（Firefox 符合规范、Chrome/Safari 曾不符合，见 WebKit 249080），与"跨 shadow root 的 ID 解析"是不同问题。

**证据**

- `实测`：`/tmp/icontest/index3.html` 单元格 `1-use-light-id-in-shadow` → 0/1600 像素；`2-use-light-id-in-lightdom` → 880（WebKit）/873（Chrome）；`3-use-own-symbol-in-shadow` → 880/873。`getBBox()`：跨 shadow 引用返回 `[0,0,0,0]`。
- <https://github.com/w3c/webcomponents/issues/179>（"How should various document internal references work when SVG is being used in shadow DOM"）；<https://lists.w3.org/Archives/Public/public-css-archive/2018May/0658.html>（"[csswg-drafts] Clarify how fragment URLs are resolved within shadow trees"）。（`官方文档`/规范讨论）
- <https://bugs.webkit.org/show_bug.cgi?id=249080> — use 元素产生的 shadow root 与选择器穿透问题。（`官方文档`）
- <https://github.com/WICG/idrefs/blob/main/research.md> — 大量"ID 作用域"痛点与"browsers currently treat all element IDs in the document as part of a single global namespace"的说明（社区征集材料，非规范）。（`官方文档`/社区材料）

**对我们的影响**

- 任何"在文档里放一张全局 sprite，组件 shadow root 用 `<use href="#icon-x">` 引用"的设计**在本机两引擎上都不成立**。要么把 symbol 复制进每个 shadow root，要么改用 CSS mask（但注意下一条：mask 对 light DOM 的 `#id` 引用在 shadow root 内同样失败）。
- 好消息是**"同 shadow root 内自包含 defs + use"完全可用**，这与 mosaic-ui "`packages/**` 就是 CDN 产物、组件模板自带一切"的模型天然契合。

### D12 CSS `mask-image: url(...)` / `url(#id)`

**结论（实测，两引擎一致）**

1. **`mask-image: url(外部文件.svg#mask元素id)` 可用**，且**在 light DOM 与 shadow root 内都可用**：
   - light DOM → 576（WebKit）/ 420（Chrome）像素；shadow root → 576 / 420 ✅
   - 注意：`#id` 必须指向 SVG 里的 **`<mask>` 元素**（合法 `<mask-source>`）。MDN 明确：`<mask-source>` 是 "A `<url>` reference to a `<mask>` or to a CSS image"，示例即 `mask-image: url("masks.svg#mask1")`。
2. **`#id` 指向 `<symbol>`（例如 `mask-image: url(sprite.svg#i-home)`）实测渲染 0 像素**（两引擎），即：**不能拿"图标 symbol"直接当 mask 源**。要做 mask 图标，必须用 **data-URI 的完整 SVG**（或指向真正的 `<mask>` 元素）。
3. **`mask-image: url(#id)` 指向 light DOM 的 `<mask>`，写在 shadow root 里 → 失败（0 像素）**；写在 light DOM 里 → 成功；shadow root 内指向**自己 tree scope 内的** `<mask>` → 成功。这与 D11 的 ID 作用域结论一致。
4. **两引擎的掩码覆盖面积不同**（同一 fixture，无 `maskUnits` 属性，白色 24×24 矩形 + 黑色圆 r=7）：Chrome 420 px vs WebKit 576 px。含义：Chrome 把黑色圆当作"遮掉"（luminance 语义，576−π·7²≈422），WebKit 输出整块 576（更接近 alpha 语义）。→ **跨引擎 mask 视觉结果需要单独验证**（`实测`现象；成因未核实，故不做机制断言）。
5. `mask-image` 的**跨域**加载：Chrome 实测**成功**（CDN 文件带 `ACAO: *`）；WebKit 因我的 fixture 变体（`maskUnits="userSpaceOnUse"`）在 WebKit 下本就未生效，**未能确认**跨域行为。另无法确认 `ACAO` 是否必需。
6. 前缀：我所有 fixture 同时写了 `-webkit-mask-image` 与标准 `mask-image`，两者都通过；**未单独验证"现代 Safari 是否仍需前缀"** → 该点**未能核实**。
7. 用 **data-URI（完整 SVG）做 mask** 是官方/主流做法：Iconify API 的 `/{prefix}.css?icons=` 输出正是 `mask-image: var(--svg)` + `background-color: currentColor`，UnoCSS preset-icons 同理。

**证据**

- `实测`：`/tmp/icontest/index4.html`（无 `maskUnits`）：
  - `X1` light DOM `url(#lm)` → 576（WebKit）/ 420（Chrome）✅
  - `X2` shadow root 内 `url(#om)`（同 tree scope）→ 576 / 420 ✅
  - `X3` shadow root 内 `url(#lm)`（light DOM 的 mask）→ **0 / 0** ❌
  - `X4` light DOM `url(/sprite4.svg#m4)` → 576 / 420 ✅
  - `X5` shadow root `url(/sprite4.svg#m4)` → 576 / 420 ✅
  - `实测`：`/tmp/icontest/index3.html` `9-mask-ext-symbolfile`（`url(/sprite3.svg#sym3)`，文件里只有 `<symbol>`）→ **0 / 0** ❌
- <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image> — 值语法示例 `mask-image: url("masks.svg#mask1");`；"`<mask-source>`: A `<url>` reference to a `<mask>` or to a CSS image."；"An `<image>` can be any type of image, including generated images"；示例 "the `<mask-source>` used as our mask image is an external SVG"。（`官方文档`）
- <https://iconify.design/docs/api/css.md> — API 生成的 CSS 用 `mask-image` + `background-color: currentColor`，并提供 `mode=mask|background`、`var=null` 等参数。（`官方文档`）
- <https://unocss.dev/presets/icons> — 默认在 `bg` / `mask` 之间自动选择，`?bg` / `?mask` 覆盖。（`官方文档`）

**对我们的影响**

- **"图标用 CSS mask" 在 shadow DOM 里是安全的**，前提是 mask 源为 **data-URI** 或**同一 shadow root 内**定义/同源的**外部 `<mask>` 文件**。
- **不要**设计成"文档级一个 sprite，各 shadow root 用 `url(#icon-id)` 引用"——实测在 shadow root 内解析不到 light DOM 的 ID。
- **mask 无法直接用 `<symbol>`**，所以"一个 sprite 同时供 `<use>` 和 `mask-image` 复用"的想法在本机实测下**行不通**（mask 需要完整 SVG data-URI 或真正的 `<mask>` 定义）。
- WebKit 与 Chrome 的 mask 覆盖面积差异值得在你的支持矩阵里留一条：**同一 mask 在两个引擎下可能视觉不同**。

---

## E. 替代方案

### E13 构建期把图标变成 SVG sprite 的主流工具

| 工具 | 输出形式 | 定位 / 现状（2026-09） |
|---|---|---|
| `svg-sprite`（jkphl/svg-sprite） | 生成**独立 sprite 文件**：`<symbol>` sprite、CSS sprite、view sprite、defs sprite 等多种模式（可配 `mode: {symbol: ...}`） | 老牌、功能最全；**v2.0.4 发布于 2024-03-26**，npm 记录最后修改 2025-02-20 → 仍在维护节奏之外但可用。（`实测` npm registry） |
| `svg-sprite-loader`（webpack） | 把 SVG 目录注入为 webpack 模块，运行时**把 `<symbol>` 注入文档**，配合 `<use href="#id">` | Webpack 时代方案；本次未核实其 2025–2026 维护状态 → **未能核实** |
| `vite-plugin-svg-icons` | 生成 **symbol sprite 并注入文档**，提供 `<use xlink:href="#icon-xxx">` 的组件用法（内部用 svg-baker） | **v2.0.1 发布于 2022-01-29**，明显停更 → 新项目不推荐。（`实测` npm registry） |
| `unplugin-icons` | 把图标编译成**框架组件**（Vue/React/Svelte/Solid/Vanilla/Web Components…），默认是**内联 SVG**，不是 sprite | **v24.0.0 发布于 2026-09-11，活跃维护**；`实测` 其 README 全文**无** sprite/symbol 模式说明 → **不支持 sprite 输出**。（`官方文档`/`实测`） |
| `@svg-use/*`（`@svg-use/core` / `vite` / `webpack` / `rollup` / `react`） | **每个图标一个独立 `.svg` 文件**（内含 `<symbol>`/根元素 `id="use-href-target"`），JS 侧只导出该文件的 URL，组件输出 `<svg><use href="/assets/icon-HASH.svg#use-href-target">`；通过 CSS 变量 `--svg-use-href-color` 做主题化 | 专门解决"SVG-in-JS 造成的体积与重复"问题，主张把 SVG 留在 JS 之外；`@svg-use/core@1.0.0` 发布于 2025-03-29。（`官方文档`）**注意**：它的核心用法正是**外部文件 `<use>`**，因此**与跨域 CDN 分发不兼容**（见 D10）。 |
| `svgstore` / `gulp-svgstore` / `grunt-svgstore` | 生成一个 **`<symbol>` sprite 文件**，由构建流拼装 | `svgstore@3.0.1` 发布于 2021-11-03 → 老工具，简单可控。（`实测` npm registry） |
| `svgtofont` / `fantasticon` | 生成**图标字体**（+ 可选样式/示例页） | `svgtofont@6.5.3`（2026-06-30）、`fantasticon@4.1.0`（2026-01-04），两者都活跃；但输出是字体，**不是 sprite**。（`实测` npm registry） |
| Iconify 官方 Unplugin | **SVG + CSS 拆分**：构建期生成图标，SVG 与 CSS 分离，宣称"massively reduces HTML size" | <https://github.com/iconify/iconify-unplugin>，2025-11-18 宣布；目前仅 Vue/Svelte/React/Preact，文档称"not ready yet"。**不是 sprite**。（`官方文档`） |
| Iconify icon-sets 网站（手动） | 网站代码生成器支持"选中多个图标，生成 bundle 与 sprite" | <https://icon-sets.iconify.design/>，2026-05-14 news 公告。（`官方文档`） |
| 面向 shadow DOM 的 sprite 工具 | **未找到**明确以"shadow DOM 内联 sprite"为卖点的工具 | **未能核实** |

**证据**：各包 npm registry 元数据（`version` / `time`）为 `实测`；`@svg-use` 输出形式来自 <https://github.com/fpapado/svg-use> README（`官方文档`）；`unplugin-icons` 无 sprite 来自 <https://github.com/unplugin/unplugin-icons> README 全文检索（`实测`/`官方文档`）；`svg-sprite` 输出模式来自 <https://github.com/svg-sprite/svg-sprite>。

**对我们的影响**

- 这些工具**全部是构建期**的，与 mosaic-ui"免构建、源=产物"直接冲突：你无法在用户站点跑 `svg-sprite`。
- 唯一对你有参考价值的是**输出格式**：`svg-sprite` / `svgstore` / `@tabler/icons-sprite` 的"单文件 `<symbol>` sprite"就是你要在自己仓库里预生成的那种产物；你可以在自己的开发流程里用它们生成 `packages/**` 里的 sprite，而让终端用户零构建。
- **`@svg-use/*` 不要用**：它的架构（跨文件 `<use>`）在你的跨域 CDN 分发模型下会被浏览器直接拒绝（D10 实测）。

### E14 直接依赖图标 npm 包自建 sprite：做法与体积

**package 内容（`实测`：下载 npm tarball 后列目录）**

| 包 | 版本/发布 | 许可 | 解包体积 | 是否自带可用 sprite | 内容要点 |
|---|---|---|---|---|---|
| `lucide-static` | 1.48.0 / 2026-09-24 | ISC | **50,819,961 B（50.8 MB）**，5,855 文件 | **是** | tarball 7.0 MB；含 `icons/`（2,121 个 `.svg`）、**`sprite.svg`**、`font/lucide.symbol.svg`、`dist/`、`icon-nodes.json`、`tags.json` |
| `bootstrap-icons` | 1.13.1 / 2025-05-09 | MIT | 2,989,529 B，2,088 文件 | **是** | tarball 896 KB；含根目录 **`bootstrap-icons.svg`** + `icons/`（2,079 个 `.svg`）+ `font/` |
| `@tabler/icons-sprite` | 3.48.0 / 2026-09-22 | MIT | 5,012,587 B，6 文件 | **是（专用 sprite 包）** | tarball 628 KB，只有 3 个文件：`dist/tabler-sprite.svg`、`tabler-sprite-nostroke.svg`、`tabler-sprite-filled.svg`；覆盖 **6,220** 个图标；用法 `<use xlink:href="path/to/tabler-sprite.svg#tabler-activity">` |
| `@tabler/icons` | 3.48.0 / 2026-09-22 | MIT | 11,305,169 B，11,424 文件 | 否 | 逐图标文件（多格式） |
| `heroicons` | 2.2.0 / 2024-11-18 | MIT | 700,262 B，1,291 文件 | 否 | `16/`、`20/`、`24/` 下 outline/solid 的 `.svg`（1,288 个），无 sprite |
| `@phosphor-icons/core` | 2.1.1 / 2024-03-29 | MIT | 6,476,685 B，9,081 文件 | 否 | 9,072 个 `.svg`，无 sprite（更新已停滞） |
| `remixicon` | 4.9.1 / 2026-01-29 | Apache-2.0 | 14,054,420 B，3,245 文件 | 部分 | `icons/`（3,231 `.svg`）+ `fonts/`（含 `remixicon.symbol.svg`，属字体用 symbol 集，非通用 sprite） |

**自建 sprite 的做法与实际字节数**

本次我直接用 `@iconify-json/lucide`（128 KB tarball，9 个文件）在本地"自建 sprite"，结果即 B6 表格：**每 symbol gzip 约 41–44 B**；同为 lucide 数据，走独立文件是 **213–230 gzip B/图标**。

**证据**

- `实测`：各包 tarball 解包列目录 + `wc -c`（命令输出见 B6/E14 段落）；npm registry 的 `dist.unpackedSize` / `dist.fileCount` / `time`。
- <https://www.npmjs.com/package/@tabler/icons-sprite>；`实测` 其 README 原文："SVG sprite with all 6,220 Tabler Icons, ready to use with `<use>`."、"The package ships three sprites in the `dist` directory"。（`官方文档`）
- <https://www.npmjs.com/package/lucide-static>（`实测` tarball 内确有 `package/sprite.svg`）。
- 图标字体单图标字节数：**未能核实**。

**对我们的影响**

- **`@tabler/icons-sprite` 是最贴近你需求的上游产物**：一个 628 KB 的 tarball 里就是成品 sprite（解包 5.0 MB / 3 个文件），MIT，无署名义务，2026-09 仍在更新。缺点是必须**同源托管**（D10）——所以正确用法是"把它拷进 `packages/**` 并让使用者同源于自己的站点"，但要小心：如果 mosaic-ui 组件直接从 jsDelivr 取它，跨域 `<use>` 会失败。
- **`lucide-static` 已经带 `sprite.svg`**，省掉自建；50.8 MB 解包对 npm 依赖偏大，但你只为仓库里那一份 sprite 付体积成本。
- `bootstrap-icons` 自带 `bootstrap-icons.svg`，MIT，2.99 MB 解包，是第二便宜的现成选择。
- `heroicons` / `@phosphor-icons/core` 不提供 sprite，需要自建；Phosphor 已停更（2024-03）。
- 最省 CDN 流量的仍是**自建单 sprite**（每 symbol ~41–44 gzip B）；直接用上游整包 sprite 时，用户至少要为整张 sprite（Tabler 6,220 图标）付一次传输——`未能核实` 该 5 MB sprite 的 gzip 后大小（本次未下载实测）。

---

## 总表：方案 × 运行时依赖 × 离线可用 × 体积 × 许可风险

| 方案 | 运行时依赖 | 离线可用 | 体积（gzip，实测口径） | 许可风险 | 与 mosaic-ui（全 shadow root / jsDelivr 跨域）的兼容性 |
|---|---|---|---|---|---|
| **`iconify-icon` web component（运行时 API）** | **是**：api.iconify.design（免费、无 SLA、无限流文档） | **否**（2025-04 起已删除 localStorage 缓存） | 运行时 **8,256 B** + 首次请求（实测 lucide 2 图标 647 B；`icons` 批量按 URL ≤500 字符切分） | 低（组件 MIT），但**图标集许可风险转移给使用者** | 可用（嵌套 shadow root 无已知 bug），但抖动需 `iconify-icon{width:1em;height:1em}` 兜底；离线不可用 |
| **Iconify API 生成的 CSS（构建期抓取后静态化）** | 构建期需要 API/数据包；运行时无 | **是**（静态 CSS） | N=100 实测 **3,853 B**（38.5 B/图标）；N=1 为 379 B | 取决于图标集（CC-BY 需署名） | 兼容（data-URI mask，无跨文档引用） |
| **UnoCSS `@unocss/preset-icons`（构建期）** | 构建期（`@iconify-json/*`，浏览器构建建议不用 `@iconify/json`） | **是** | 自建同口径实测 **45.8–49.0 B/图标**（N=200/800）；官方 API CSS 基线 38.5 B/图标 | 取决于图标集 | 兼容（data-URI mask/bg）；但**免构建场景用不上** |
| **`@iconify/tailwind4`（构建期）** | 构建期 | **是** | 同上量级（官方未给数字；本次未单独测 → 未能核实） | 取决于图标集 | 兼容；**不支持 sprite**；免构建场景用不上 |
| **内联 SVG（每图标一个 `<svg>`，写进 shadow root）** | 无 | **是** | 与"单个 symbol"同级：约 **200–360 B 原始 / 40–45 B gzip 边际**（800 图标 sprite 摊薄 43.5 B，单图标 gzip 240 B 含固定开销） | 取决于图标集 | **完全兼容**（同 tree scope，`currentColor` 可穿透） |
| **外部 sprite + `<use href="CDN/sprite.svg#id">`（跨域）** | 无（但需网络） | 否（首次需网络；无缓存策略则每次） | sprite 本体：**41–44 B/symbol gzip**（200 图标 ≈ 8.2 KB） | 取决于图标集 | **❌ 实测被 Chrome 153 与 WebKit 26.6 拒绝**（"Domains, protocols and ports must match"）；`ACAO: *` 无效。**mosaic-ui 通过 jsDelivr 分发时不可用** |
| **外部 sprite + `<use>`（同源/自托管）** | 无 | 否（首次）或可缓存 | 同上一行 | 同上 | ✅ 实测可用（light DOM 与 shadow root 都可用）；需让使用者自托管 sprite |
| **内联 sprite 进每个 shadow root + `<use href="#id">`** | 无 | **是** | 按每组件用到的图标数：**41–44 B/symbol gzip** + 少量模板开销 | 取决于图标集 | **✅ 实测可用**（同 shadow root 内 symbol → 渲染成功）；**最契合 mosaic-ui "源=产物"模型** |
| **文档级全局 sprite + shadow root 内 `url(#id)` / `use href="#id"`** | 无 | 是 | 最省（sprite 只传一次，约 41–44 B/symbol gzip） | 取决于图标集 | **❌ 实测失败**：shadow root 无法解析 light DOM 的 ID（`<use>` 与 `mask-image: url(#id)` 都是 0 像素） |
| **CSS `mask-image: url(sprite.svg#mask)`（`<mask>` 元素）** | 无 | 否（首次） | 同 sprite 量级 | 取决于图标集 | ✅ 实测可用（light DOM / shadow root、同源外部文件均可）；**跨域 Chrome 通过、WebKit 未能确认**；两引擎覆盖面积有差异（420 vs 576） |
| **CSS `mask-image: url(sprite.svg#symbol)`（用 symbol 当 mask）** | 无 | — | — | — | **❌ 实测 0 像素**（两引擎）；必须用 data-URI 完整 SVG 或真正的 `<mask>` |
| **data-URI mask CSS（UnoCSS/Iconify API 路线）** | 无 | **是** | **38.5–49 B/图标 gzip** | 取决于图标集 | ✅ 兼容（无跨文档引用）；本次未单独做渲染实测（属官方/主流用法） |
| **图标字体** | 无（需随包分发字体文件） | 是 | **未能核实**（未构建对照；官方明确反对："Do not use icon fonts!!!"） | 取决于图标集；OFL 有保留字体名限制 | 可用但官方反对（模糊、难对齐、必须下整包字体、无彩色/无动画） |
| **上游现成 sprite 包（`@tabler/icons-sprite` MIT 6,220 图标 / `lucide-static` 自带 sprite / `bootstrap-icons.svg`）** | 无 | 视托管位置 | Tabler sprite 解包 5,012,587 B（3 个文件，tarball 628 KB）；lucide-static 解包 50.8 MB / `bootstrap-icons` 2.99 MB | **Tabler MIT / Lucide ISC / Bootstrap MIT → 无署名义务** | 需**同源**托管才能用 `<use>`；把 sprite 作为仓库产物分发（同源）可行，直接从 CDN 跨域 `<use>` 不可行 |
| **Font Awesome Free 作为图标源** | 无 | 是 | 与其它集同量级 | **⚠️ 图标为 CC BY 4.0，需署名**；品牌图标另有商标限制；Iconify 已把 `fa6-solid` 标为 "Archive / Unmaintained" | 技术上可用；**法务上必须自行落地署名**（尤其抽取图标数据后内嵌注释会丢失） |

---

## 附：本次实测的环境与可复现性

- 时间：2026-09-26。
- 浏览器：Google Chrome **153.0.8010.53**（Blink，Playwright `channel: 'chrome'`）；Playwright **WebKit 26.6**（`webkit-2359`）。**未测真实 Safari.app 与 Firefox**。
- fixture：`/tmp/icontest/{index.html,index2.html,index3.html,index4.html}` + 双端口本地服务（`8977` 同源、`8978` 带 `Access-Control-Allow-Origin: *`）；判定方式为截图后统计 40×40 单元内红色像素数（`nothing` = 0，`unmasked` ≈ 1600）。
- 体积：所有 gzip 数字均为 `gzip -9`；sprite/文件/data-URI 三种产物由同一份 `@iconify-json/lucide@1` 的 `icons.json`（1,925 图标）生成，N 取前 N 个图标名。
- 声明：所有"未能核实"项均为本次确实未找到可靠来源，未做任何数字或原文的推测性填充。
