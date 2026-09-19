# 通过 jsDelivr 分发「无构建」Web Components UI 框架：工程与分发实践

> 研究对象：基于 ofa.js 的 Web Components UI 框架，使用者只用两个标签（`<script type="module">` + `<link rel="stylesheet">`）即可接入，不用 npm、不用打包器。
> 本文所有关键结论均基于 **jsDelivr 官方 README/文档 + 对 `cdn.jsdelivr.net` 的实测 HTTP 响应头**，并标注了可复核的命令。

---

## 0. 结论速览（TL;DR）

| 问题 | 结论 |
|---|---|
| `gh` 还是 `npm`？ | **发布到 npm，用 `/npm/pkg@x.y.z/`。** GitHub tag 只作为备份/预览。理由见 §1。 |
| 缓存 | 精确版本 = 1 年 + `immutable`；版本范围/`latest` = 浏览器 7 天、边缘 12 小时（实测）。 |
| 版本锁定 | 文档只教 `@1.2.3` 精确版本；`@latest`/`@1`/`@1.2` 仅用于 demo。 |
| SRI | 支持，**必须**用「精确版本 + 显式文件路径 + 包内已存在的文件」。可从 `data.jsdelivr.com` 的 `hash` 字段直接得到 `sha256-...`（实测等于 SRI）。 |
| `+esm` | **`/npm/` 才有，`/gh/.../+esm` 实测 404。** 本框架自带原生 ESM，**不要用 `+esm`**。 |
| 重复加载同一模块 | ESM 按 **解析后的绝对 URL** 去重。必须用 **import map + peer dependency + 双入口** 约定把 ofa.js 收敛到唯一 URL。 |
| import map 兼容性 | Baseline *Widely available*（Chrome 89 / Firefox 108 / Safari 16.4；2025-09-27 起进入 widely available）。 |
| `.html` 组件文件 | **`/gh/` 下 `.html` 会 301 跳到 `raw.githubusercontent.com`**（实测），脱离 jsDelivr 缓存且在中国大陆不可靠；**`/npm/` 下直接以 `text/plain` 由 jsDelivr 缓存返回**。→ 模板优先内联进 `.mjs`；若要发 `.html`，必须走 npm。 |
| 发新版不生效 | 锁版本的用户不受影响；用 `@latest`/`@1` 的用户最长等 7 天。用 `https://purge.jsdelivr.net/...` 主动 purge（只对别名 URL 有效）。 |
| 冗余 | jsDelivr 有多入口域名（`fastly.` / `gcore.` / `testingcf.jsdelivr.net`，实测同路径均 200）；再叠加 unpkg；**大陆生产建议自托管**。 |
| TS 类型 | `types` + 手写 `.d.ts` 可行，但 **TS 不会自动抓取远程 URL 的类型**；无构建用户需要 import map 裸标识符 + 本地 `d.ts` shim，或走 esm.sh 的 `x-typescript-types`。 |

---

## 1. `gh` 与 `npm` 两种分发的取舍

### 1.1 官方定位

jsDelivr 官方 README 明确写着：

> We recommend using npm for projects that support it for better UX - npm packages are searchable on our website, and package pages show additional useful information.

两者的 URL 形态与版本语义：

```
/npm/package@version/file       # 精确版本
/npm/package@3/file             # 版本范围（major）
/npm/package@3.1/file           # 版本范围（minor）
/npm/package@beta/file          # dist-tag
/npm/package@latest/file        # 或省略版本
/gh/user/repo@version/file      # tag / commit / branch
/gh/user/repo@3/file            # 版本范围（仅对合法 semver tag 生效）
/gh/user/repo@latest/file       # 无 tag 时回退默认分支
```

### 1.2 实测：缓存策略（这是最关键的差异之一）

```
$ curl -sSI "https://cdn.jsdelivr.net/npm/ofa.js@4.7.0/dist/ofa.min.mjs" | grep -i cache-control
cache-control: public, max-age=31536000, s-maxage=31536000, immutable

$ curl -sSI "https://cdn.jsdelivr.net/npm/ofa.js@4/dist/ofa.min.mjs" | grep -i cache-control
cache-control: public, max-age=604800, s-maxage=43200

$ curl -sSI "https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" | grep -i cache-control
cache-control: public, max-age=604800, s-maxage=43200
```

| URL 类型 | 浏览器 `max-age` | 边缘 `s-maxage` | 官方描述 |
|---|---|---|---|
| 精确版本 / commit hash（npm & gh 一致） | 31536000（1 年） | 31536000 | "Effectively forever"，永久存 S3 |
| 版本别名（`@latest` / `@1` / `@1.2`） | 604800（7 天） | 43200（12 小时） | 7 天，可 purge |
| 分支（`@main`） | — | — | 12 小时 |

> 注意：**npm 与 gh 的「最新版本」可能不一致**。实测同一时刻 `gh/ofajs/ofa.js@latest` 解析到 `4.7.5`，而 `npm/ofa.js@latest` 解析到 `4.7.0`，两个 `.mjs` 体积也不同（75653 vs 74123 字节）。这对「文档里写 `@latest`、用户却拿到旧版」这类幽灵 bug 是直接诱因。

### 1.3 版本解析

- **npm**：`@1`、`@1.2`、`@latest`、dist-tag（`@beta`）、省略版本都支持。npm 强制 semver，所以别名永远可解析。
- **gh**：版本范围 **仅对合法 semver tag 生效**（官方原文："only works with valid semver versions"）。tag 写成 `release-1.2` 或 `v1.2.3` 之外的形式时，范围别名会失效。`@latest` 在没有任何 tag 时**回退到默认分支**——这意味着内容会随 push 变化，对组件库是灾难。
- 两者都有 **version fallback**：请求的新版本里没有该文件时，jsDelivr 回退到上一版本继续服务而不是 404。这既是「不会白屏」的保险，也是**陷阱**：如果你的构建漏发了某个文件，用户会静默拿到旧版本的文件，很难排查。→ 发布后必须逐文件校验（见 §4.4）。

### 1.4 刷新 CDN 缓存（purge）

官方限制：
- 只对**版本别名 URL**（`@latest`、`@1`、`@1.2`）有效；**对精确版本 / commit 无效**（精确版本永久缓存，物理上无法更新）。
- 需要合法 semver release。
- 有速率限制，且官方说 purge 权限「需要发邮件到 d@jsdelivr.com 申请」。

实测端点（返回 JSON，含各 CDN provider 的刷新结果）：

```bash
curl "https://purge.jsdelivr.net/npm/mosaic-ui@1.2/dist/index.mjs"
# => {"id":"...","status":"finished","timestamp":"...","paths":{"/npm/mosaic-ui@1.2/dist/index.mjs":{"throttled":false,"providers":{"CF":true,"FY":true}}}}
```

**关键推论**：精确版本无法 purge，所以「发错版本」的唯一补救是 **再发一个新版本号**。这正是必须锁精确版本的另一个理由——锁了版本的用户永远不会遇到缓存问题。

### 1.5 SRI（Subresource Integrity）

官方规则（[Using SRI](https://www.jsdelivr.com/using-sri-with-dynamic-files)）：SRI 只能用在**保证永不变化的完整单文件链接 + 静态版本**上。**禁止**用于：

- 版本别名（会变）
- default file（会自动 minify）
- **按需 minify 的文件**（重新 minify 可能产生不同字节）
- `/combine/` 合并文件
- `+esm` 生成产物（同理，是构建产物）

**可用技巧（实测有效）**：`data.jsdelivr.com` 的 flat 结构里每个文件带 `hash` 字段，它**就是 base64 编码的 SHA-256**：

```bash
$ curl -s "https://data.jsdelivr.com/v1/packages/npm/ofa.js@4.7.0?structure=flat" \
  | python3 -c "import sys,json;print([f['hash'] for f in json.load(sys.stdin)['files'] if f['name']=='/dist/ofa.min.mjs'][0])"
gOH+VSPUwfC7gl6KaniM81b423sNf78K0y+sjbEUkAY=

$ curl -s "https://cdn.jsdelivr.net/npm/ofa.js@4.7.0/dist/ofa.min.mjs" | openssl dgst -sha256 -binary | openssl base64 -A
gOH+VSPUwfC7gl6KaniM81b423sNf78K0y+sjbEUkAY=   # 完全一致
```

所以文档里可以直接给出：

```html
<script type="module"
  src="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/index.mjs"
  integrity="sha256-<data.jsdelivr.com 的 hash 字段>"
  crossorigin="anonymous"></script>
```

> 前提：该文件是**仓库里本来就有的**（不是 jsDelivr 按需 minify 出来的）。所以**发布时自己产好 `.min.mjs`**，不要依赖 jsDelivr 的 `.min` 自动生成。
> CSS 同理，`<link>` 支持 `integrity`。
> 对模块内部 `import` 的依赖，`<script integrity>` 不生效——那要用 import map 的 `integrity` 键（见 §2.4）。

### 1.6 中国大陆访问稳定性

- jsDelivr 官方一直宣称在中国有节点（README "China" 节、esm.run 页 "including mainland China"）。
- 但历史上出现过**多轮中国大陆不可达**：GitHub issue 里可核实的集中爆发是 **2022 年 5 月**，包括
  [#18407 "Can jsdelivr regain its ICP filing in mainland China?"](https://github.com/jsdelivr/jsdelivr/issues/18407)、
  [#18402 "China cannot visit cdn.jsdelivr.net"](https://github.com/jsdelivr/jsdelivr/issues/18402)、
  [#18425 "Try jsdelivr to re-icp filing in China possible"](https://github.com/jsdelivr/jsdelivr/issues/18425)、
  [#18397 DNS pollution / SNI block](https://github.com/jsdelivr/jsdelivr/issues/18397)。
  2023、2026 年仍有 DNS 路由相关 issue（如 #18487、#18736）。
- 关于「2024 年因 ICP 备案导致中断」：**我未能核实到 2024 年的官方事件记录**；可考证的 ICP/DNS 事件集中在 2022 年。建议按「历史上反复发生、未来仍可能发生」来设计冗余，而不是绑定某一次事件。
- 现实中的缓解手段是**换入口域名**（见 §5.4）与**自托管**。

### 1.7 明确推荐

> **主分发：npm。** `https://cdn.jsdelivr.net/npm/<pkg>@<exact-version>/...`
> **备份：同名 GitHub tag + `/gh/<user>/<repo>@v<version>/...`**（内容需与 npm 完全一致）。

理由（按重要性排序）：

1. **`.html` 行为差异是决定性的**（实测）：`/gh/` 下 `.html` 返回 `301 → raw.githubusercontent.com`，脱离 jsDelivr 的 S3 永久存储与边缘缓存，且 `raw.githubusercontent.com` 在中国大陆长期不稳定；`/npm/` 下 `.html` 由 jsDelivr 直接以 `text/plain` 返回并缓存 1 年。基于 ofa.js 的组件库**大量依赖运行时 fetch `.html` 模板**，这一条几乎一票否决 `/gh/`。
2. **`+esm` 只有 npm 有**（实测 `/gh/.../+esm` 对 jquery、shoelace、ofa.js 全部 404）。将来若要给 CJS 生态或懒人用户提供单文件入口，只有 npm 这条路。
3. **版本语义更稳**：npm 强制 semver，`@1`/`@1.2`/tag 永远可解析；gh 的范围别名要求合法 semver tag，`@latest` 无 tag 时还会回退到可变的默认分支。
4. **官方推荐 npm**，且有可搜索的包页、README 展示、下载统计、entrypoints 分析。
5. 缓存与 SRI 行为两者一致，不构成差异。

**代价**：需要维护一次 npm 发布（CI 自动化后成本≈0）。建议 tag 与 npm 同时发，tag 用 `v1.2.3`，`package.json` 用 `1.2.3`。

---

## 2. ESM 与依赖解析

### 2.1 根因：ESM 的模块身份 = 解析后的绝对 URL

ES Module 的去重（module map）以**解析后的绝对 URL 字符串**为键。这意味着：

| 写法 | 是否同一个模块实例 |
|---|---|
| `.../gh/ofajs/ofa.js/dist/ofa.min.mjs` vs `.../npm/ofa.js@4.7.0/dist/ofa.min.mjs` | ❌ 不同 |
| `.../gh/ofajs/ofa.js/dist/ofa.min.mjs` vs `.../gh/ofajs/ofa.js@4.7.5/dist/ofa.min.mjs` | ❌ 不同（一个是别名，一个是精确） |
| `.../ofa.min.mjs` vs `.../ofa.min.mjs?v=1` | ❌ 不同（query 参与 URL） |
| `.../ofa.min.mjs` vs `.../ofa.min.mjs`（文本完全一致） | ✅ 相同 |
| import map 把 `"ofa.js"` 映射到 `.../ofa.min.mjs`，同时另一处直接 `import ".../ofa.min.mjs"` | ✅ 相同（映射只改 specifier，最终 URL 一致） |

### 2.2 「同一模块被加载两次」的真实后果

如果应用自己 `import ".../gh/ofajs/ofa.js/dist/ofa.min.mjs"`，而组件库内部 `import ".../npm/ofa.js@4.7.0/dist/ofa.min.mjs"`：

- ofa.js 会被实例化 **两次**：两套内部状态、两套响应式系统、两个 `$` 全局。
- 组件库基于 A 实例注册的组件，用户用 B 实例的 API 去操作 → 状态不同步、更新丢失。
- `customElements.define` 若未做防重保护，第二次会抛 `NotSupportedError: ... has already been defined`。（ofa.js 内部确实调用 `customElements.define`。）
- 体积翻倍（ofa.min.mjs ≈ 74 KB，未压缩 ≈ 164 KB）。

**这是无构建组件库的头号集成 bug**，且现象随机（取决于用户引入顺序），必须在文档层面给死规范。

### 2.3 解决方案：peer dependency + import map + 双入口

ofa.js 应被视为 **peer dependency**（宿主提供，库不内联）。落地三件套：

**(a) `package.json` 声明 peer（面向 npm/bundler 用户，也是文档契约）：**

```json
{
  "peerDependencies": { "ofa.js": ">=4.7.0 <5" },
  "peerDependenciesMeta": { "ofa.js": { "optional": false } }
}
```

**(b) 提供两个入口文件，覆盖两种用户：**

```js
// dist/standalone.mjs —— 零配置入口：内部用「钉死的精确 URL」引入 ofa.js
import "https://cdn.jsdelivr.net/npm/ofa.js@4.7.0/dist/ofa.min.mjs";
// ...随后注册全部组件
```

```js
// dist/bare.mjs —— import map 入口：只写裸标识符，交给页面 import map 解析
import "ofa.js";
// ...随后注册全部组件
```

```js
// dist/index.mjs —— 默认入口，重定向到 standalone（对「直接 script 标签」最友好）
export * from "./standalone.mjs";
```

**(c) 文档里同时给两种用法，并强调「不要混用」：**

```html
<!-- 用法 A：零配置（推荐给纯静态用户） -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/themes/light.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/standalone.mjs"></script>
<!-- standalone 内部已用完全相同的 URL 引入 ofa.js，无需你再引一次 -->
```

```html
<!-- 用法 B：import map（推荐给需要自己用 ofa.js API 的用户） -->
<script type="importmap">
{
  "imports": {
    "ofa.js": "https://cdn.jsdelivr.net/npm/ofa.js@4.7.0/dist/ofa.min.mjs",
    "mosaic-ui": "https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/bare.mjs",
    "mosaic-ui/": "https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/components/"
  }
}
</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/themes/light.css">
<script type="module">
  import "mosaic-ui";
  import { $ } from "ofa.js";   // 与库共用同一个 ofa.js 实例（URL 相同 → 去重）
</script>
```

**第 (b) 点的关键**：`standalone.mjs` 里的 URL 必须与用法 A 用户可能自己写的 URL **逐字节相同**（同 host、同版本、同路径、无 query）。文档必须把「唯一合法 URL」写死并声明为公共契约——否则用户随手换个镜像域名（如 `fastly.jsdelivr.net`）就会重新触发双载。

> 进阶做法：把镜像域名也纳入 import map 的 `scopes`，或让 `standalone.mjs` 暴露一个 `window.__MOSAIC_OFA__` 检查点，在检测到「已存在且 URL 不同」时 console.error 报警。无构建场景下无法阻止，但可以**让错误可见**。

### 2.4 `+esm` 是什么、什么时候必须用

`/+esm` 是 jsDelivr 的 **按需打包服务**（`esm.run` 同源）。官方 blog 描述：它会解析 package `exports`/`browser` 入口、CJS→ESM 转换、polyfill 部分 Node.js API、打包依赖、tree-shake、minify、生成 source map。

实测：

```
/npm/lit@3.2.1/+esm           → 200, cache-control: immutable
/npm/@shoelace-style/shoelace@2/+esm → 200, cache-control: max-age=604800（因为是范围别名）
/gh/jquery/jquery@3.7.1/+esm  → 404
/gh/shoelace-style/shoelace@2.20.1/+esm → 404
/gh/ofajs/ofa.js@4.7.5/+esm   → 404
```

**结论：`+esm` 是 npm 专属，`/gh/` 不支持。**

**什么时候必须用 `+esm`：**
- 你要用的库**只发 CJS**（没有原生 ESM 产物），无构建场景下浏览器起不来。
- 库有**裸模块依赖**且你不想维护 import map。
- 想用**一个请求**拿到全部依赖（懒人/demo）。

**为什么本框架不该用：**
1. ofa.js 与你的库**都发原生 ESM**，`+esm` 是多余的转换层。
2. `+esm` 会把依赖**内联进 bundle**，破坏「按需引入单个组件」的粒度，也破坏与用户已有 ofa.js 实例的共享（URL 不同 → 双载）。
3. `+esm` 产物是**构建产物**，不能做 SRI（官方明确禁止对生成文件用 SRI）。
4. 生成产物在极端情况下（failover 重新 minify）可能变化，与 `immutable` 缓存语义相悖。

> 一句话：**能发原生 ESM 就不要用 `+esm`；只有遇到 CJS-only 的第三方依赖时才用它。**

### 2.5 import map 浏览器兼容现状（2025）

| 浏览器 | 起始版本 | 发布日期 |
|---|---|---|
| Chrome / Chrome Android | 89 | 2021-03-02 |
| Edge | 89 | 2021-03-04 |
| Firefox / Firefox Android | 108 | 2022-12-13 |
| Safari / Safari iOS | 16.4 | 2023-03-27 |

- MDN：import map 标记为 **Baseline "Widely available"**，"available across browsers since March 2023"。
- [web-features explorer](https://web-platform-dx.github.io/web-features-explorer/features/import-maps/)：**Widely Available since 2025-09-27**。
- 即：**2025 年底起，import map 可以当作全量基线能力使用**，无需 polyfill。

**必须知道的约束：**
- import map 必须在**任何发起的模块加载之前**解析；`<script type="importmap">` 要在模块脚本之前。**Chrome 133+ 才支持多个 import map**（此前每文档只能有一个）——若你的页面/第三方脚本已有 import map，在旧浏览器上会冲突。**给用户的建议是：import map 只保留一份，且放在 `<head>` 最前。**
- import map **不影响 `<script src="...">` 的路径**，只影响 `import`/`import()` 的 specifier。
- import map **不作用于 Worker/Worklet**。
- `integrity` 键：import map 支持为 specifier 指定 `integrity`，实现「模块图内的 SRI」。支持情况为 **Chromium 127+ / Safari 18+**，Firefox 尚未支持（用前请按目标浏览器核对 MDN 兼容表）。这是无构建场景下对「`<script integrity>` 无法覆盖内部 import」的补位方案。

```html
<script type="importmap">
{
  "imports": { "ofa.js": "https://cdn.jsdelivr.net/npm/ofa.js@4.7.0/dist/ofa.min.mjs" },
  "integrity": { "https://cdn.jsdelivr.net/npm/ofa.js@4.7.0/dist/ofa.min.mjs": "sha384-..." }
}
</script>
```

---

## 3. 分发文件清单与目录约定

### 3.1 推荐目录树

```
mosaic-ui/
├─ package.json
├─ README.md
├─ LICENSE
└─ dist/                                  # 唯一发布目录（files: ["dist", ...]）
   ├─ standalone.mjs                      # 零配置入口：内部 import 钉死的 ofa.js URL
   ├─ standalone.mjs.map
   ├─ bare.mjs                            # import map 入口：import "ofa.js"
   ├─ index.mjs                           # 默认入口（re-export standalone）
   ├─ index.d.ts                          # 顶层类型入口，对应 "types"
   ├─ ofa.js                              # 可选：镜像一份 ofa.js（离线/自托管用）
   ├─ core/
   │  ├─ component.mjs                    # 组件基类（被各组件复用）
   │  ├─ tokens.css                        # 设计变量（CSS custom properties）
   │  └─ theme.css
   ├─ components/
   │  ├─ m-button/
   │  │  ├─ m-button.mjs                  # 副作用模块：define + 模板内联
   │  │  ├─ m-button.css                  # 组件私有样式（被 .mjs 以字符串内联或 fetch）
   │  │  └─ m-button.d.ts
   │  ├─ m-input/
   │  │  ├─ m-input.mjs
   │  │  ├─ m-input.css
   │  │  └─ m-input.d.ts
   │  └─ ...
   ├─ themes/
   │  ├─ light.css
   │  └─ dark.css
   └─ types/
      ├─ index.d.ts
      └─ components/
         ├─ m-button.d.ts
         └─ m-input.d.ts
```

### 3.2 「整体引入」与「按需引入」如何共存

- **整体引入**：`dist/standalone.mjs`（或 `dist/index.mjs`）是一个**副作用模块**，import 时注册全部组件。用户只写一个 `<script type="module" src>`。
- **按需引入**：`dist/components/m-button/m-button.mjs` 是**自包含的**——它自己 import `core/component.mjs`，但不 import 其他组件。用户可只引一个文件。

```html
<!-- 只用按钮 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/core/tokens.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/components/m-button/m-button.css">
<script type="module"
  src="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/standalone.mjs"></script>
<script type="module"
  src="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/components/m-button/m-button.mjs"></script>
```

或配合 import map 前缀映射（更干净）：

```html
<script type="importmap">
{ "imports": {
  "ofa.js": "https://cdn.jsdelivr.net/npm/ofa.js@4.7.0/dist/ofa.min.mjs",
  "mosaic-ui/": "https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/"
}}
</script>
<script type="module">
  import "mosaic-ui/components/m-button/m-button.mjs";
</script>
```

**CSS 的组织原则**：把 CSS 也做成「可整体、可按需」。`tokens.css` 是必需的地基（组件依赖 CSS 变量），组件私有 CSS 与组件同名同目录。**不要把全部组件 CSS 打进一个巨大的 `index.css`**——那会破坏按需引入的意义。

### 3.3 ⚠️ 最大工程坑：`.html` 组件文件在 `/gh/` 下会被重定向出 CDN

ofa.js 的组件以 `.html` 文件承载模板，运行时通过 `fetch()` 拉取（对 `ofa.min.mjs` 反查可见多处 `fetch(...)` 调用与 `.html` 扩展名处理）。实测：

```bash
$ curl -sSI "https://cdn.jsdelivr.net/gh/ofajs/ofa.js@4.7.5/libs/scsr/test/comps/btn/t-btn.html"
HTTP/2 301
content-type: text/plain; charset=utf-8
location: https://raw.githubusercontent.com/ofajs/ofa.js/4.7.5/libs/scsr/test/comps/btn/t-btn.html
access-control-allow-origin: *
```

而 npm 侧（以一个确实发布了 `.html` 的包为例）：

```bash
$ curl -sSI "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/index.html"
HTTP/2 200
content-type: text/plain; charset=utf-8
cache-control: public, max-age=31536000, s-maxage=31536000, immutable
```

**解读与对策：**

1. jsDelivr **不会**以 `text/html` 提供 HTML（官方："HTML files are served with Content-Type: text/plain for security reasons"）。ofa.js 用 `fetch().text()` 自行解析，所以 `text/plain` **不影响功能**。
2. 但 `/gh/` 会把 `.html` **301 跳出 jsDelivr**，落到 `raw.githubusercontent.com`：
   - 每个组件多一次跨域重定向往返（延迟翻倍）；
   - **不走 jsDelivr 的 S3 永久存储与边缘缓存**，绕开了它最强的那层可靠性；
   - `raw.githubusercontent.com` 在中国大陆长期不可靠 —— 你的 CDN 冗余方案对它无效；
   - `?meta`/SRI 体系对跳转后的内容不适用。
3. **首选对策：不要在运行时 fetch `.html`。** 把模板作为 template literal 内联进 `.mjs`：

   ```js
   // dist/components/m-button/m-button.mjs
   import { Component } from "../../core/component.mjs";
   const template = /* html */ `<button class="m-btn"><slot></slot></button>`;
   export class MButton extends Component { /* ... */ }
   customElements.define("m-button", MButton);
   ```
   收益：少一次网络往返、无重定向、可 SRI、可被 import map 统一管理、单文件即可用。
4. **次选对策：必须发 `.html` 时走 npm**（由 jsDelivr 直接以 `text/plain` + 1 年 immutable 提供），并在文档里禁止 `/gh/` 写法。
5. 如果组件数多、模板大，可考虑「构建期把 `.html` 内联为 `.mjs`」的极小预处理（不是打包器，只是一次性转换脚本）——仍然满足"用户无构建"。

### 3.4 不要发布的东西

- `node_modules/`、测试用例、demo 站点、源 `.html` 模板（如果已内联）、CI 配置、`.map` 之外的中间产物。
- 单文件 > 20 MB（gh）/ 包 > 150 MB 会被 jsDelivr 拒绝。
- 依赖内联：**不要把 ofa.js 打进你的 bundle**（见 §2.2）。`files` 字段要精确，避免把 `devDependencies` 的东西带出去。

---

## 4. 版本与发布流程

### 4.1 `package.json` 参考（可直接改字段使用）

```json
{
  "name": "mosaic-ui",
  "version": "1.2.3",
  "description": "No-build Web Components UI framework based on ofa.js",
  "type": "module",
  "license": "MIT",

  "main": "./dist/index.mjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "style": "./dist/themes/light.css",
  "unpkg": "./dist/standalone.mjs",
  "jsdelivr": "./dist/standalone.mjs",

  "sideEffects": [
    "./dist/index.mjs",
    "./dist/standalone.mjs",
    "./dist/bare.mjs",
    "./dist/components/**/*.mjs",
    "**/*.css"
  ],

  "files": ["dist", "README.md", "LICENSE"],

  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "default": "./dist/index.mjs"
    },
    "./standalone": {
      "types": "./dist/index.d.ts",
      "import": "./dist/standalone.mjs",
      "default": "./dist/standalone.mjs"
    },
    "./bare": {
      "types": "./dist/index.d.ts",
      "import": "./dist/bare.mjs",
      "default": "./dist/bare.mjs"
    },
    "./components/*": {
      "types": "./dist/components/*/*.d.ts",
      "import": "./dist/components/*/*.mjs",
      "default": "./dist/components/*/*.mjs"
    },
    "./themes/*": "./dist/themes/*",
    "./core/*": "./dist/core/*",
    "./package.json": "./package.json"
  },

  "peerDependencies": { "ofa.js": ">=4.7.0 <5" },
  "keywords": ["web-components", "ui", "ofa.js", "no-build", "custom-elements"],
  "repository": { "type": "git", "url": "https://github.com/USER/mosaic-ui.git" },
  "publishConfig": { "access": "public", "provenance": true }
}
```

字段要点：
- **`files`**：白名单，只发 `dist`。npm 默认还会带上 `package.json`/`README`/`LICENSE`。
- **`exports`**：`types` 条件**必须放在每个条件块的第一位**（Node/TS 按顺序匹配）。
- **`jsdelivr` / `unpkg` / `browser` / `main`**：jsDelivr 用它决定「省略文件路径时的 default file」，优先级 `jsdelivr` > `browser` > `main`。我们的用法是显式写全路径，所以这个字段主要是为了 `https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3`（不带文件）也能用。注意 **default file 会被自动 minify**，因此**不要对它用 SRI**。
- **`style`**：jsDelivr 用它识别 CSS default file（Bootstrap 用的就是这个字段）。
- **`sideEffects`**：让 bundler 用户知道组件模块有注册副作用，避免被错误 tree-shake。CDN 用户不受影响，但能救 npm 用户。

### 4.2 GitHub Actions：打 tag → 发布 npm（最小可用）

推荐用 **npm trusted publishing (OIDC)**，无需长期 `NPM_TOKEN`（[2025-07-31 GA](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)，要求 npm CLI ≥ 11.5.1；使用后**自动生成 provenance，不再需要 `--provenance`**）。

在 npmjs.com 该包设置里配置 trusted publisher：org/user、repo、workflow 文件名、environment（如 `npm`）。

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write   # 创建 GitHub Release
  id-token: write   # npm trusted publishing (OIDC)

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: npm
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"                 # npm 11.x
          registry-url: "https://registry.npmjs.org"

      - name: Verify tag matches package.json version
        run: |
          PKG="$(node -p "require('./package.json').version")"
          TAG="${GITHUB_REF_NAME#v}"
          echo "package=$PKG tag=$TAG"
          [ "$PKG" = "$TAG" ] || { echo "::error::tag $TAG != package.json $PKG"; exit 1; }

      - name: Publish to npm (provenance is automatic via OIDC)
        run: npm publish --access public

      - name: Wait until jsDelivr can resolve the new version
        run: |
          V="$(node -p "require('./package.json').version")"
          for i in $(seq 1 30); do
            if curl -fsS "https://data.jsdelivr.com/v1/packages/npm/mosaic-ui@$V" >/dev/null; then
              echo "jsDelivr sees $V"; exit 0
            fi
            sleep 10
          done
          echo "::error::jsDelivr did not pick up $V in time"; exit 1

      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          tag_name: ${{ github.ref_name }}
```

若暂时不用 trusted publishing，则退回 token 方式（GitHub 官方文档写法）：

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          registry-url: "https://registry.npmjs.org"
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 4.3 保证 jsDelivr 上的文件与 tag 对应

机制上：
- jsDelivr 对 **npm 新版本是「推送即生效」**；对 gh 是「tag 出现即生效」。
- 首次访问某文件时从 npm/GitHub 拉取并**永久存入 S3**，此后即使源被删也继续服务。
- 存在 **version fallback**：新版本缺文件时回退旧版本（静默！）。

因此必须做「发布后校验」，而不是相信「发布成功了」。

### 4.4 发布后自检脚本（可复制）

```bash
#!/usr/bin/env bash
set -euo pipefail
PKG="mosaic-ui"; V="1.2.3"; BASE="https://cdn.jsdelivr.net/npm/${PKG}@${V}"

# 1) 关键文件逐个人工清单校验（防 version fallback 静默兜底）
FILES=(
  "/dist/standalone.mjs"
  "/dist/bare.mjs"
  "/dist/index.mjs"
  "/dist/core/tokens.css"
  "/dist/themes/light.css"
  "/dist/components/m-button/m-button.mjs"
  "/dist/index.d.ts"
)
for f in "${FILES[@]}"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}${f}")"
  echo "$code  ${f}"
  [ "$code" = "200" ] || { echo "MISSING: ${f}（注意 version fallback 可能让你误以为 200！）"; exit 1; }
done

# 2) 校验 version fallback 没在骗你：对比 jsDelivr 上的 hash 与本地 dist 的 hash
for f in "${FILES[@]}"; do
  [ "${f##*.}" = "d.ts" ] && continue
  remote="$(curl -s "${BASE}${f}" | shasum -a 256 | awk '{print $1}')"
  local="$(shasum -a 256 ".${f}" | awk '{print $1}')"
  [ "$remote" = "$local" ] || { echo "MISMATCH: ${f}"; exit 1; }
done
echo "all good: jsDelivr 内容与本地 dist 完全一致"

# 3) 生成 SRI 清单（从 data API 取 hash）
curl -s "https://data.jsdelivr.com/v1/packages/npm/${PKG}@${V}?structure=flat" \
| python3 -c "
import sys,json
d=json.load(sys.stdin)
for f in d['files']:
    if f['name'].startswith('/dist/') and not f['name'].endswith('.map'):
        print(f\"{f['name']}\tsha256-{f['hash']}\")
" | tee "dist/SRI-${V}.txt"
```

> **第 2 步是精髓**：仅看 HTTP 200 无法区分「文件真在新版本」和「version fallback 回退到旧版本」。必须比对内容哈希。

---

## 5. CDN 缓存与「发新版不生效」的坑

### 5.1 缓存时长（实测 + 官方）

| 请求形态 | 浏览器缓存 | 边缘缓存 | 能否 purge |
|---|---|---|---|
| `/npm/pkg@1.2.3/file` | 1 年 `immutable` | 1 年 | ❌ 永久不可变 |
| `/gh/user/repo@v1.2.3/file` | 1 年 `immutable` | 1 年 | ❌ |
| `/npm/pkg@1.2/file` | 7 天 | 12 小时 | ✅ |
| `/npm/pkg@1/file` | 7 天 | 12 小时 | ✅ |
| `/npm/pkg@latest/file` | 7 天 | 12 小时 | ✅ |
| `/npm/pkg/file` | 7 天 | 12 小时 | ✅ |
| `/gh/user/repo@main/file` | 12 小时 | 12 小时 | — |

### 5.2 `@latest` 的行为与陷阱

- `@latest`（或省略版本）= 解析到当前最新**已发布版本**，然后**缓存 7 天**。期间即使你发了新版，用户仍拿旧版，直到缓存过期或你 purge。
- gh 的 `@latest` 在**没有任何 tag** 时回退默认分支并缓存 12 小时 —— 内容随 push 变化，`immutable` 语义被打破（浏览器可能缓存 7 天一个会变的别名 URL）。
- npm 与 gh 的 latest 可能不同步（实测 4.7.0 vs 4.7.5）。

**因此：文档与 demo 里出现的每一个 script 标签都必须锁精确版本。** 把 `@latest` 当作「文档站首页的自动更新展示」可以，但绝不能出现在复制粘贴给用户的代码块里。

### 5.3 文档里如何引导用户锁版本

1. **所有代码块写死 `@1.2.3`**，并在旁边用注释强调：

   ```html
   <!-- 生产环境请固定版本号（@1.2.3）。不要用 @latest / @1 / @1.2：最长 7 天内拿不到新版本。 -->
   <script type="module"
     src="https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/standalone.mjs"
     integrity="sha256-..."
     crossorigin="anonymous"></script>
   ```

2. **给出「升级三步走」**：改版本号 → 更新 `integrity` → 回归测试。并提供 `SRI-x.y.z.txt` 供复制。
3. **提供一个「版本检查」小工具**（用户粘到 console 即可得知自己锁的版本）：

   ```js
   // https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/version.js
   window.__MOSAIC_UI_VERSION__ = "1.2.3";
   console.info("[mosaic-ui]", window.__MOSAIC_UI_VERSION__);
   ```
4. **说明 purge 只对别名有效**，并给出发布者视角的 purge 命令（用户侧无需关心）。
5. 可选：提供 `@1.2`「跟随补丁」通道，但明确标注「最长 7 天延迟、可能被 purge 提前刷新、不建议生产」。

### 5.4 可用性风险与冗余方案

**风险清单**
- jsDelivr 在中国大陆的历史性不可达（2022 年 ICP/DNS 事件为可核实的高峰，此后反复出现 DNS 类问题）。
- 单点域名故障：`cdn.jsdelivr.net` 若 DNS 被污染/被劫持，整站白屏。
- `.html` 经 `/gh/` 跳转到 `raw.githubusercontent.com`，绕开 jsDelivr 冗余。
- `+esm` 产物依赖构建服务，构建服务异常时不可用。

**冗余方案（按推荐度）**

1. **自托管（大陆生产首选）**：把 `dist/` 原样拷到自己的域名/GitHub Pages/OSS+CDN。无构建库的 `dist` 是纯静态文件，自托管成本极低，且能备案、能被自己的 CDN 加速。文档里给一条 `npm pack` 或直接下载 tarball 的路径。
   ```bash
   npm pack mosaic-ui@1.2.3   # 得到 mosaic-ui-1.2.3.tgz，解压即 dist/
   ```
2. **换 jsDelivr 入口域名（零成本、同内容、不同 CDN）**。实测以下域名同路径均返回 200：

   | 域名 | 实测解析到 |
   |---|---|
   | `cdn.jsdelivr.net` | Fastly（本机实测 `2a04:4e42:400::485`） |
   | `fastly.jsdelivr.net` | Fastly |
   | `gcore.jsdelivr.net` | Cloudflare（实测 `2606:4700::6811:d005`） |
   | `testingcf.jsdelivr.net` | Cloudflare |

   文档里可以说明：大陆网络下若 `cdn.jsdelivr.net` 不通，把域名替换为 `fastly.jsdelivr.net` 或 `gcore.jsdelivr.net`，路径完全不变。**注意**：这会让 URL 变化 → 若用户同时用 import map 和 standalone 入口，必须**整体替换**，否则触发 §2.2 的双载。建议把这个选择做成文档里的「一次性决策」，不要混用。
3. **备用 CDN：unpkg**（`https://unpkg.com/mosaic-ui@1.2.3/dist/standalone.mjs`）。实测可用；`GET https://unpkg.com/pkg@1.2.3/?meta` 会返回每个文件的 `integrity`（`sha256-...`），便于生成 SRI。
4. **下策：esm.sh**。它会在响应头给出 `x-typescript-types`（见 §6），对类型友好；但实测对 `ofa.js` 返回 500，且它是重打包服务（URL 与文件均非原样），会引入与 jsDelivr 不同的模块身份，**不适合作为本框架的镜像**。

**给用户的失败降级示例**（不依赖任何 CDN 特性，纯 HTML 能力）：

```html
<script type="module">
  // 主源失败时切备用域名（注意：两个 URL 只能有一个真正被加载，避免双载）
  const SOURCES = [
    "https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/standalone.mjs",
    "https://unpkg.com/mosaic-ui@1.2.3/dist/standalone.mjs",
    "https://fastly.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/standalone.mjs"
  ];
  for (const src of SOURCES) {
    try { await import(src); break; }
    catch (e) { console.warn("[mosaic-ui] CDN failed:", src, e); }
  }
</script>
```

> 这段代码用 `await import()` 顺序降级。它比静态 `<script src>` 多一次尝试，但对「CDN 全面不可用」有实质帮助。注意它会让 `standalone.mjs` 的 ofa.js URL 也走同一域名——所以 `standalone.mjs` 内部若写死 jsDelivr URL，切到 unpkg 后仍会去 jsDelivr 取 ofa.js。**正解**：`standalone.mjs` 应基于 `import.meta.url` 推导同源 ofa.js 路径，或干脆用 `bare.mjs` + import map 让用户完全掌控。

---

## 6. 无构建库的 TypeScript 类型提示

### 6.1 关键事实：TS 不会自动从 CDN 抓类型

TypeScript / VS Code **不会**为 `import "https://cdn.jsdelivr.net/..."` 去网络请求 `.d.ts`。远程 URL 导入在没有本地声明时是 `TS2307: Cannot find module`。

因此「无构建 + 有类型」需要主动设计，而不是只丢一个 `.d.ts` 到 `dist`。

### 6.2 可行方案（按推荐度）

**(1) `types` 字段 + 手写 `.d.ts`（面向 npm/编辑器用户）**

```json
{
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    },
    "./components/*": {
      "types": "./dist/components/*/*.d.ts",
      "import": "./dist/components/*/*.mjs"
    }
  }
}
```

手写 `.d.ts` 示例（ofa.js 的 `Component` 基类 + 自定义元素标签）：

```ts
// dist/index.d.ts
import type { Component } from "ofa.js";

export declare class MButton extends Component {
  /** 是否禁用 */
  disabled: boolean;
  /** 按钮类型 */
  type: "default" | "primary" | "danger";
}

export declare class MInput extends Component {
  value: string;
  placeholder: string;
}

// 让编辑器在 HTML/JSX 中识别自定义元素（可选，需使用者 tsconfig 包含此文件）
declare global {
  interface HTMLElementTagNameMap {
    "m-button": MButton;
    "m-input": MInput;
  }
}
```

可行性：**完全可行**，因为无构建库的 API 面通常不大（一批自定义元素 + 若干属性/事件 + `$` 辅助函数）。维护成本主要是「`.d.ts` 与 `.mjs` 手动同步」，建议用 JSDoc + `tsc --emitDeclarationOnly` 从源码生成（这是**发布者侧**的构建，不影响使用者无构建）。

**(2) import map 裸标识符 + 本地 shim（无构建用户的可落地方案）**

如果用户用了 import map，模块说明符是裸名（`mosaic-ui`），就可以用一个本地 `.d.ts` 声明它——**版本变化时 shim 不需要改**：

```ts
// types/vendor.d.ts（用户项目里，或从 CDN 下载）
declare module "mosaic-ui" {
  export * from "mosaic-ui/types";   // 或者直接把声明内联写在这里
  export declare class MButton extends HTMLElement { disabled: boolean; }
}
declare module "mosaic-ui/components/m-button/m-button.mjs" {
  export declare class MButton extends HTMLElement { disabled: boolean; }
}
```

配套 `tsconfig.json`（可选，用于把组件目录前缀映射过去）：

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "strict": true
  },
  "include": ["src", "types/vendor.d.ts"]
}
```

这就是 §2.3 推荐「import map 裸标识符」的额外收益：**类型可声明、且与版本号解耦**。若坚持用完整 URL 作为 specifier，则 shim 必须写成 `declare module "https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/standalone.mjs"`，每次升级版本都要改类型文件——很痛。

**(3) `/// <reference>` 直引（最土但最稳）**

```html
<script type="module" src=".../standalone.mjs"></script>
<!-- 用户把 dist/index.d.ts 下载到本地 vendor/ 后： -->
```
```ts
/// <reference path="./vendor/mosaic-ui.d.ts" />
```

**(4) esm.sh 的 `x-typescript-types`（仅特定运行时/工具有效）**

实测：

```bash
$ curl -sI "https://esm.sh/@github/relative-time-element@5.3.1" | grep -i x-typescript-types
x-typescript-types: https://esm.sh/@github/relative-time-element@5.3.1/dist/index.d.ts
```

- esm.sh 会在响应头宣告类型位置；`?dts` 也设置该头。
- **Deno** 原生支持 `X-TypeScript-Types`，浏览器端工具链（如某些 CDN-aware 编辑器/构建器）也会读取。
- **但 TypeScript 本体仍不支持该头**（[microsoft/TypeScript#38864](https://github.com/microsoft/TypeScript/issues/38864) 长期未实现）。所以它救不了常规 `tsc` 用户。
- unpkg 的 `?meta` 提供每个文件的 `integrity`，但不提供类型头。

### 6.3 结论

- **`.d.ts` 必须发**（`files` 里包含 `dist/types`，`package.json` 有 `types` 且 `exports` 里 `types` 条件排第一）。
- **对无构建用户，唯一不痛的方式是 import map + `declare module "mosaic-ui"` shim**，并把这个 shim 文件**也通过 CDN 提供**：
  `https://cdn.jsdelivr.net/npm/mosaic-ui@1.2.3/dist/types/mosaic-ui.d.ts`，文档教用户下载到本地 `types/`。
- 不要承诺「TS 能自动发现 CDN 类型」——它不能。文档要诚实说明。

---

## 7. 可参考的真实案例

### 7.1 Shoelace（`@shoelace-style/shoelace`）—— 最值得抄的架构

- 文档明确给出 **CDN Installation (Easiest)**，`<link>` + `<script type="module">` 两行接入，锁 `@2.20.1`。
- **最关键的借鉴：`/cdn` 与 `/dist` 双产物**（v2.5.0 引入）：
  - `@shoelace-style/shoelace/cdn/...` 是**预打包**的，依赖全部内联，**给 CDN 用户**（无需 import map / 依赖解析）。
  - `@shoelace-style/shoelace/dist/...` **不打依赖**，留给 bundler 去 dedupe，**给 npm 用户**。
  - 官方原文解释动机：解决「从 npm 安装时加载了多个版本的 Lit」的问题——**这正是 §2.2 的双载问题，Shoelace 用双产物正面解决了它**。
- **Autoloader 模式**：一个很小的脚本监听 DOM，按需 lazy load 未注册的元素，`<script src=".../cdn/shoelace-autoloader.js">`。代价是可能「Flash of Undefined Custom Elements」（文档坦诚指出并给出缓解链接）。
- **Cherry picking**：文档给每个组件一段「Importing」代码，可以只引 `dist/components/button/button.js`；并明确警告 **绝不要从 `shoelace.js` cherry pick**（会把整包拉下来），也不要直接 import `chunks/*`（是构建产物、版本间会变）。
- **`setBasePath()` / `data-shoelace`**：组件依赖图标等资产时，必须显式告诉库资产在哪；CDN 模式下靠 `shoelace.js` 的 `import.meta.url` 自动探测。
- 版本策略：文档与 CDN 链接**全部锁 `@2.20.1`**，站点版本号常驻页头。

**可借鉴结论**：
1. 给 CDN 用户一份**预打包、无外部依赖**的入口（≈ 我们的 `standalone.mjs`），给 npm 用户一份**保留依赖**的入口（≈ `bare.mjs`）。**两种产物分开，别指望一份产物同时取悦两边。**
2. 按需引入要有**稳定的、可按组件的路径约定**；把构建产物（chunk/hash）标记为不可直接引用。
3. 资产（图标/字体）必须有 base path 机制，且 CDN 模式要能自动探测。

### 7.2 Pico.css（`@picocss/pico`）—— 纯 CSS 库的版本策略

- CDN 用法一行：`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">`。
- **注意它用的是 `@2`（major 范围别名），不是 `@latest`，也不是精确版本**。这是一种「文档站追求自动更新 + 大版本内不破坏」的折中；作为组件库我们**不应**照抄——CSS 的破坏性变更通常比 JS 组件小，且它接受 7 天缓存延迟。
- 站点有 **Version picker**，显式提供 v1 / v2 的文档切换，说明「锁版本」这件事在文档层必须有出口。
- 安装方式并列 **manual（下载）/ CDN / npm / Composer**，且 CDN 段落紧跟在 manual 之后，用最少字给出可复制链接。
- 提供 **class-less 版本**（`pico.classless.min.css`）——同一份 CDN 分发下用**不同文件路径**表达不同「使用档次」。这与我们「整体引入 / 按需引入」的多入口思路同构。

**可借鉴结论**：文件名即产品线（`pico.min.css` / `pico.classless.min.css`），用路径区分「完整/轻量」而不是用参数；文档提供版本选择器。

### 7.3 `@github/relative-time-element` —— 原生 ESM + 类型 + 子路径的极简范例

npm metadata（实测 `registry.npmjs.org/@github/relative-time-element/latest`）：

```json
{
  "version": "5.3.1",
  "type": "module",
  "main": "dist/bundle.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./define": "./dist/index.js",
    "./duration": "./dist/duration.js",
    "./relative-time": "./dist/relative-time-element.js",
    "./relative-time/define": "./dist/relative-time-element-define.js"
  }
}
```

- **原生 ESM（`"type": "module"`）+ 细粒度 `exports` 子路径**，无构建工具即可 `import`（jsDelivr/Deno/浏览器都能直接吃）。
- 关注点分离：`index.js` 有副作用（自动 `define`），`*.component.js`/类模块无副作用——Shoelace 也用了同样的 `.component.js` 约定（文档专门讲 "Avoiding auto-registering imports"）。
- 类型：`types` 指向 `dist/index.d.ts`，**源码即类型来源**，无需额外构建；esm.sh 能读到并把 `x-typescript-types` 指过去。
- 它也被 GitHub 自家页面以 CDN 方式直接使用（无构建）。

**可借鉴结论**：`exports` 子路径可以把「注册（side-effect）」和「类（pure）」拆开；这让按需引入和 tree-shaking 都干净。我们的 `m-button.mjs`（注册）与 `m-button.component.mjs`（仅 class）可以采用同样约定。

### 7.4 三个案例的横向对比

| 维度 | Shoelace | Pico.css | relative-time-element |
|---|---|---|---|
| CDN 形态 | `/npm/...@2.20.1/cdn/...`（预打包） | `/npm/@picocss/pico@2/css/...`（范围别名） | `/npm/...@5.3.1/dist/...`（原生 ESM） |
| 是否锁精确版本 | ✅ 锁 | ❌ 用 `@2` | ✅ 锁 |
| 双产物（CDN vs bundler） | ✅ `/cdn` vs `/dist` | N/A | 不区分（原生 ESM 两边通吃） |
| 按需引入 | ✅ 按组件路径 | 按文件路径（classless） | ✅ 按 `exports` 子路径 |
| 版本切换文档 | 页头常驻版本号 | Version picker | — |
| 对我们的启示 | **双入口 + autoloader + base path** | 文件名表达档次；文档给版本选择 | `exports` 分离 side-effect / pure，types 同源 |

---

## 8. 落地清单（Checklist）

**架构**
- [ ] npm 为主分发（`/npm/pkg@x.y.z/`），gh tag 为备份，两者内容哈希一致。
- [ ] ofa.js 作为 **peer dependency**，绝不内联。
- [ ] 提供 `standalone.mjs`（钉死 URL，零配置）/ `bare.mjs`（裸标识符，配 import map）/ `index.mjs`（默认→standalone）三入口。
- [ ] 文档写死「ofa.js 唯一合法 URL」，并警告混用会双载。
- [ ] **不发布需要运行时 `fetch` 的 `.html`**；模板内联进 `.mjs`。若必须发 `.html`，只走 npm。
- [ ] 组件按 `dist/components/<name>/<name>.mjs` 自包含；拆分 `.component.mjs`（pure）与注册模块（side-effect）。
- [ ] `tokens.css` 作为 CSS 地基，组件 CSS 与组件同目录，**不合并成巨型 index.css**。

**发布**
- [ ] `package.json`：`files: ["dist", ...]`、`exports` 中 `types` 条件第一、`jsdelivr`/`style` 字段、`sideEffects` 正确。
- [ ] CI：tag 校验版本号一致 → `npm publish --access public`（trusted publishing / OIDC）→ 等待 jsDelivr 解析到新版本。
- [ ] 发布后脚本：**逐文件 HTTP 200 + 内容哈希比对**（防 version fallback 静默兜底）。
- [ ] 生成并发布 `SRI-<version>.txt`（从 `data.jsdelivr.com` 的 `hash` 字段取 `sha256-...`）。
- [ ] 自产 `.min.mjs` / `.min.css`（不要依赖 jsDelivr 按需 minify，否则 SRI 不可用）。

**文档**
- [ ] 所有代码块锁精确版本，旁边注明「不要用 @latest/@1/@1.2，最长 7 天不生效」。
- [ ] 同时给「零配置」与「import map」两种用法，并强调二选一。
- [ ] 提供 `<script>` + `integrity` + `crossorigin` 的完整示例。
- [ ] 提供「下载 tarball 自托管」路径（大陆生产推荐）。
- [ ] 说明换镜像域名（`fastly.` / `gcore.` / `testingcf.jsdelivr.net`）时**整站一起换**。
- [ ] 给出 `types/vendor.d.ts` shim 与 `tsconfig.json`（诚实说明 TS 不会自动抓远程类型）。

**运维**
- [ ] 记住：精确版本**不可 purge**；发错只能发新版本。
- [ ] 别名 URL 需更新时，`curl https://purge.jsdelivr.net/npm/pkg@1.2/dist/x.mjs`。
- [ ] 监控 `https://status.jsdelivr.com/`；大陆业务准备自托管兜底。

---

## 9. 主要事实来源

- jsDelivr 官方 README / 文档：<https://github.com/jsdelivr/jsdelivr#readme>（版本别名、缓存 7 天/1 年/12 小时、purge 限制、default file 解析顺序 `jsdelivr > browser > main`、`style` 字段、中国节、HTML 以 `text/plain` 提供、体积限制）
- jsDelivr SRI 指南：<https://www.jsdelivr.com/using-sri-with-dynamic-files>
- jsDelivr purge 工具：<https://www.jsdelivr.com/tools/purge>
- jsDelivr ESM 说明：<https://www.jsdelivr.com/esm>、<https://www.jsdelivr.com/blog/jsdelivr-2023-esm-website-api/>、<https://www.jsdelivr.com/blog/making-more-npm-packages-work-with-jsdelivr-esm/>
- jsDelivr Data API：<https://www.jsdelivr.com/docs/data.jsdelivr.com>（flat 结构的 `hash`、`/resolved`、`/entrypoints`）
- import map 兼容性：<https://web-platform-dx.github.io/web-features-explorer/features/import-maps/>、<https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap>
- npm trusted publishing：<https://docs.npmjs.com/trusted-publishers>、<https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/>
- GitHub Actions 发布 npm：<https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages>
- TS 远程类型头：<https://github.com/microsoft/TypeScript/issues/38864>
- Shoelace 安装文档：<https://shoelace.style/getting-started/installation>
- Pico.css 快速开始：<https://picocss.com/docs>
- jsDelivr 中国相关 issue：#18407 / #18402 / #18425 / #18397（<https://github.com/jsdelivr/jsdelivr/issues>）

> 本文中所有 `curl` 输出均为 2026-09 实测（`date` 响应头 `Sat, 19 Sep 2026`）。CDN 行为可能变化，落地前请用 §4.4 的自检脚本重新验证。
