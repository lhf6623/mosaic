# UnoCSS 用于「无构建 UI 组件库（ofa.js + jsDelivr CDN）」的技术结论

> 验证环境：`unocss@66.10.5`（CLI 由 `@unocss/cli` 提供）、Node v24.20.0、pnpm/npm。
> 文中所有体积数字与 CSS 产物均为**本机实跑结果**（`@unocss/core` `createGenerator()` + 真实 CLI），
> 不是估算；文档链接为 unocss.dev 官方页面。
> 标记约定：**【实测】** = 本机跑出来的；**【文档】** = 官方文档明确写的；**【推论】** = 由前两者推导。

---

## 0. TL;DR（先看这段）

1. **用 `presetWind3`（不要 `presetUno`/`presetWind`，已废弃改名），不要用 `presetWind4`**——除非你愿意接受 Tailwind4 风格的全局 reset 和 `color-mix()` 方案。wind3 的 "preflight" 只是给 `*` 塞一堆 `--un-*` 变量默认值，**不含元素样式 reset**，对组件库友好得多。**【实测】**
2. **CLI 用 `unocss` 命令即可**（`unocss` 包依赖 `@unocss/cli`，bin 名就是 `unocss`；pnpm 严格模式下 bin 可能不提升，那就显式装 `@unocss/cli`）。**【实测+文档】**
3. **v66.6.0 起 CLI 不再有默认 preset**，必须写 `uno.config.ts`。**【文档】**
4. **CLI 默认 `--preflights` 为 `true`**，想剔除 preflight 用 `--no-preflights`（citty 布尔取反，实测有效），或在 preset 里 `preflight: false`。**【实测】**
5. **扫描目录里如果包含 `.css` 文件，CLI 会把它们原样（经过 transformer 处理）拼到产物最前面**——这是把 `tokens.css` / 手写组件样式纳入同一条 UnoCSS 管线的最佳入口。**【实测】**
6. **动态类名 `ui-btn-${size}` 一律扫不到，且不会报错**（产物里静默缺失；实测 `src/dynamic.js` 产出 0 字节 CSS）。必须用 `safelist`。**【实测】**
7. **`safelist` 不支持 RegExp**（`safelist: [/^bg-primary-/]` 直接 `TypeError: s.trim is not a function`）。支持的是 `string` 和 **函数** `(ctx) => string[]`，函数能拿到 `ctx.theme`，这是批量生成色板的正道。**【实测】**
8. **主题色写 `rgb(var(--x-rgb) / <alpha-value>)` 在 wind3 下完美工作**（`bg-primary` / `bg-primary/50` 都对）；**在 wind4 下会漏出字面量 `<alpha-value>` 导致整条声明失效**。**【实测】**
9. **`:host-context()` 已被 CSSWG 从规范中移除、MDN 标记 Deprecated**，不要作为暗色模式主方案。Shadow DOM 下暗色优先用 **CSS 变量 token 切换**（自定义属性会跨 shadow 边界继承）。**【文档】**
10. **体积基线【实测】**：wind3 preflight **2159 B raw / ~348 B gzip**；wind4 默认 reset **~3.9 KB raw / ~1.35 KB gzip**；裸 `@unocss/reset/tailwind.css` **7499 B / 2628 B gzip**；一个 carbon 图标 **~750 B raw / ~440 B gzip**（第 2 个起边际约 +120 B gzip）；`presetTypography` 的 `prose` **~20 KB raw / ~2.3 KB gzip**。

---

## 1. 预编译静态 CSS 的正确姿势

### 1.1 `unocss` 还是 `@unocss/cli`？

**【实测】** `unocss` 包的 `package.json` 里 **没有 `bin` 字段**，但它的 `dependencies` 含 `@unocss/cli`，npm 会把 `node_modules/.bin/unocss` 提升出来，所以 `npx unocss` 能用。
**【文档】** 官方 CLI 文档原文：

> If you are not able to find the binary (e.g. with `pnpm` and only `unocss` is installed), you'll need to explicit install `@unocss/cli` standalone package.

结论：
- 单仓 / 组件库仓库：`pnpm add -D unocss` 然后 `package.json` 里写 `"build:css": "unocss \"src/**/*.{js,ts,html}\" -o dist/mosaic.css --no-preflights -m"`。
- 如果 CI 里 `unocss` 命令找不到（pnpm 严格 node_modules），就 `pnpm add -D @unocss/cli` 并在 script 里用 `unocss ...`（同一个 bin），或直接用 `npx @unocss/cli`。

参考：<https://unocss.dev/integrations/cli>

### 1.2 最小可用 `uno.config.ts`（组件库版）

```ts
// uno.config.ts
import {
  defineConfig,
  presetWind3,        // ← 不要用 presetUno / presetWind（已废弃，见 §5.4）
} from 'unocss'

export default defineConfig({
  presets: [
    presetWind3({
      // ★ 组件库关键开关
      preflight: false,      // boolean | 'on-demand'，默认 true
      dark: { dark: ':host(.dark)', light: ':host(.light)' }, // 见 §4
      // important: false,   // 不要开，会污染宿主页面
    }),
  ],
  // 让产物带原生 CSS @layer，避免组件库样式与宿主页面打架（见 §1.5）
  outputToCssLayers: {
    cssLayerName: (layer) => {
      if (layer === 'default') return 'mosaic.utilities'
      if (layer === 'shortcuts') return 'mosaic.components'
      if (layer === 'preflights') return 'mosaic.base'
      return `mosaic.${layer}`
    },
  },
  layers: {
    preflights: -100,
    shortcuts: -1,
    default: 1,
  },
})
```

**【实测】** `presetWind3` 的选项名是**单数 `preflight`**（`boolean | 'on-demand'`），
而 `presetWind4` 用复数 `preflights: { reset, theme, property }`。**两者不要混写。**

### 1.3 只扫描指定目录 + 输出单个 CSS

**方式 A：命令行 glob（最直接）**

```jsonc
// package.json
{
  "scripts": {
    "build:css": "unocss \"src/components/**/*.{js,ts,html}\" \"src/styles/**/*.css\" -o dist/mosaic.css --no-preflights",
    "dev:css":   "unocss \"src/components/**/*.{js,ts,html}\" \"src/styles/**/*.css\" -o dist/mosaic.css --no-preflights --watch",
    "build:css:min": "unocss \"src/**/*.{js,ts,html}\" -o dist/mosaic.min.css --no-preflights -m"
  },
  "devDependencies": { "unocss": "^66.10.5" }
}
```
> 【文档】npm script 里的 glob 必须转义引号；`-w/--watch` 开发用；`-o/--out-file` 默认是 cwd 下的 `uno.css`；`--stdout` 忽略 `--watch`/`--out-file`。

**方式 B：写进 config（更可控，多个 entry 多次产出）**

```ts
// uno.config.ts
export default defineConfig({
  cli: {
    entry: [
      // 主原子 CSS（全量组件模板）
      { patterns: ['src/components/**/*.{js,ts,html}'], outFile: 'dist/mosaic.css' },
      // 只给 shadow root 用的 base/reset（见 §8）
      { patterns: ['src/styles/base.css'], outFile: 'dist/mosaic-base.css' },
    ],
  },
  content: {
    filesystem: ['src/components/**/*.{js,ts,html}'], // 与 CLI patterns 取并集
  },
  // ...
})
```
**【实测】** `cli.entry` 多入口可用：`npx unocss -c t/entry.config.ts` 会分别生成每个 `outFile`。
注意 `content.filesystem` 与 CLI 传入的 patterns 是**取并集**（【文档】："The usage extracted from each source will be merged together"）。

### 1.4 产物里 `@layer` / `@property` 怎么处理

| 目标 | 开关 | 说明 |
|---|---|---|
| 我想要原生 `@layer` | `outputToCssLayers: true`（或对象形式自定义层名） | 【实测】默认 `false`。开 `true` 后产物顶部出现 `@layer preflights, icons, default;`，并用 `@layer xxx{...}` 包裹。 |
| 我不想要 `@layer`（老浏览器/宿主冲突） | `outputToCssLayers: false`（默认） | 【实测】产物仍带 `/* layer: default */` 注释，靠**输出顺序**保证优先级，且可用 `layers: {...}` 自定义顺序（【文档】"Layers without specified order will be sorted alphabetically"）。 |
| 强制输出所有层（即使没用） | `outputToCssLayers: { allLayers: true }` | 【文档】 |
| `@property` | **wind3 不产生 `@property`**；wind4 会产生，且 `preflights.property: false` **只关掉 `@supports` 回退块，关不掉 `@property` 本身** | 【实测】见 §6.3。需要彻底剥离只能后处理。 |

**【实测】wind3 产物结构（无 `@property`）：**
```css
@layer preflights, icons, default;
/* layer: preflights */
@layer preflights{ *,::before,::after{--un-rotate:0; ... } ::backdrop{...} }
/* layer: default */
@layer default{ .bg-primary{--un-bg-opacity:1;background-color:rgb(var(--ui-primary-rgb) / var(--un-bg-opacity));} }
```

**【实测】wind4 产物结构（有 `@property` + `@supports` 回退）：**
```css
/* layer: properties */
@supports (...) { *, ::before, ::after, ::backdrop { --un-bg-opacity:100%; } }
@property --un-bg-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
/* layer: theme */
:root, :host { --spacing: 0.25rem; --colors-red-500: oklch(63.7% 0.237 25.331); }
/* layer: base */
 *, ::after, ::before, ::backdrop, ::file-selector-button { box-sizing: border-box; margin: 0; padding: 0; }
```

### 1.5 `--rewrite` / transformer 在 CLI 里是支持的

**【实测】** CLI 会跑 `applyTransformers`；但**源文件只有在传 `--rewrite` 时才会被改写**，否则 transformer 只影响「抽取 + 产物 CSS」。实测：

```bash
$ unocss "t/css/**/*.{html,css}" -o t/out.css -c t/compile.config.ts          # 源码不变
$ unocss "t/css/**/*.{html,css}" -o t/out.css -c t/compile.config.ts --rewrite
✔ 1 file rewritten
# <div class=":uno: text-center sm:text-left bg-red-500 p-4"></div>
#   → <div class="uno-vha7pp"></div>
```

---

## 2. safelist / 动态类名

### 2.1 先接受现实：动态拼接是扫不到的

**【实测】** 对
```js
export function cls(size) {
  return `ui-btn-${size} p-${size === 'sm' ? 2 : 4} bg-primary-${size === 'lg' ? 700 : 500}`
}
```
跑 CLI，产出 **0 字节 CSS，且 exit code = 0**（无任何警告）。
默认 extractor 按空白/引号切分（【文档】："By default it split the source code by whitespace and quotes"），
`ui-btn-${size}` 这种 token 永远不可能匹配上规则。

**结论：组件库必须把「所有可能拼出来的类名」显式声明为 safelist，并且把「产物非空」写进 CI 断言。**

### 2.2 `safelist` 的真实类型（比文档更细）

【文档】config 页写的是 `safelist: string[]`，但**实际类型（66.10.5 `@unocss/core` d.ts 第 603 行）**是：

```ts
safelist?: (string | ((context: SafeListContext<Theme>) => Arrayable<string>))[]
// SafeListContext = { generator: UnoGenerator, theme: Theme }
```

**【实测】三种写法：**

```ts
safelist: [
  // ① 纯字符串：逐条
  'ui-btn-sm', 'ui-btn-lg',

  // ② 函数：能拿到完整 theme，用来批量生成色板/尺寸
  (ctx) => Object.keys(ctx.theme.colors.brand ?? {})
    .map(k => `bg-brand-${k}`),

  // ③ 也可以做「白名单 + 前缀展开」
  (ctx) => ['sm', 'md', 'lg'].flatMap(s => [`ui-btn-${s}`, `ui-btn-${s}-block`]),
]
```
> 实测 ② 生效：`matched` 里出现 `bg-brand-a` / `bg-brand-b`。

**【实测】RegExp 不支持：**
```ts
safelist: [/^bg-primary-/]   // 💥 TypeError: s.trim is not a function
```
（`@unocss/core` 里 safelist 的处理是 `typeof s === 'function' ? s(ctx) : s` 然后 `s.trim()`。）
**所以「正则 safelist」这个传闻是错的**，等价能力用函数写：

```ts
safelist: [
  (ctx) => {
    // 用正则做过滤的等价写法
    const all = Object.keys(ctx.theme.colors)
      .flatMap(c => [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(s => `bg-${c}-${s}`))
    return all.filter(x => /^bg-(brand|primary|danger)-/.test(x))
  },
]
```
⚠️ 注意：把 11 档 × N 色全 safelist 会让 CSS 明显膨胀（每个颜色工具约 100–140 B raw）。**组件库更推荐「组件类 → shortcuts」路线（见 §2.4），让 HTML 里出现的是语义类名，而不是把整张色板烤进 CSS。**

### 2.3 `blocklist`：主动关掉 API 面

【文档 + 源码】类型是：
```ts
type BlocklistValue = string | RegExp | ((selector: string) => boolean | null | undefined)
type BlocklistRule  = BlocklistValue | [BlocklistValue, BlocklistMeta]  // Meta = { message?: string }
blocklist?: BlocklistRule[]
warn?: boolean   // 默认 true，命中 blocklist 时告警
```

```ts
export default defineConfig({
  blocklist: [
    // 1) 正则：封掉整族
    [/^bg-(red|green|blue)-\d+$/],
    // 2) 带自定义提示
    [/^text-\d+$/, { message: '请使用语义色 text-fg / text-muted' }],
    // 3) 函数：完全自定义
    (selector) => selector.startsWith('!') ? true : undefined,
  ],
  warn: true,
})
```
**【实测】** `blocklist: [[/^bg-red-5/, { message: '...' }]]` 会真的把 `.bg-red-500` 从产物中剔除（`matched` 从 5 降到 4）。
⚠️ 与 `safelist` 不同，`blocklist` **是支持 RegExp 的**。

### 2.4 组件库真正的解法：`shortcuts` + `safelist`（推荐）

UnoCSS 的 `shortcuts` 能把一串原子折叠成一个语义类并在产物里展开：

```ts
shortcuts: [
  // 静态
  ['ui-btn', 'inline-flex items-center justify-center rounded-md font-medium transition-colors px-4 py-2'],
  // 组合（可以引用其它 shortcut）
  ['ui-btn-primary', 'ui-btn bg-primary text-white hover:bg-primary-600'],
  ['ui-btn-sm', 'ui-btn px-2 py-1 text-xs'],
  // 动态（正则 shortcut）
  [/^ui-btn-(sm|md|lg)$/, ([, size]) => `ui-btn ui-btn-size-${size}`],
],
safelist: [
  'ui-btn-primary', 'ui-btn-sm', 'ui-btn-md', 'ui-btn-lg',
  // 用函数从 sizes 推导，保证不漏
  (ctx) => ['sm', 'md', 'lg'].map(s => `ui-btn-${s}`),
],
```

**【实测】产物（关掉 preflight）：**
```css
@layer shortcuts, default;
/* layer: shortcuts */
@layer shortcuts{
.ui-btn-primary{display:inline-flex;align-items:center;justify-content:center;border-radius:0.375rem;
 padding-left:1rem;padding-right:1rem;padding-top:0.5rem;padding-bottom:0.5rem;
 --un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));font-weight:500;
 transition-property:color,background-color,...;transition-duration:150ms;}
}
```
好处：
- 组件模板里只写 `ui-btn ui-btn-primary`，宿主 HTML 干净、体积极小；
- 类名是「写死的」，不存在动态拼接 → safelist 只需枚举有限几个；
- **shortcut 里的原子即使模板里没出现也会生成**（因为 shortcut 定义本身就是 CSS 来源）。

**【实测】额外福利**：shortcut 里写了不存在的 theme key 时会告警，这是免费的拼写检查：
```
[unocss] unmatched utility "bg-primary" in shortcut "ui-btn-primary"
[unocss] unmatched utility "hover:bg-primary-600" in shortcut "ui-btn-primary"
```

### 2.5 `preset-tagify` 能不能救动态类名？——不能

【文档】`presetTagify` 是把标签名当工具类（`<text-red>`、`<flex>`），**不解决 safelist 问题**，而且它会让抽取面变大、产物不可控。组件库**不建议**引入。
参考：<https://unocss.dev/presets/tagify>

### 2.6 关于 `presetWind` 的 `preflight`

`preflight` 与 safelist **完全无关**。
**【实测】** wind3 的 `preflight: true` 产物就是 `*,::before,::after{--un-rotate:0; ... 约 50 个变量}` + `::backdrop{...}`，**不含 margin/padding/box-sizing reset**（那是 `@unocss/reset` 或 wind4 内置 reset 干的事）。
所以：**开 preflight 不会重置宿主页面，但会往页面每个元素上挂 ~50 个自定义属性**（有渲染开销）；组件库建议 `preflight: 'on-demand'`（【实测】只用到 opacity 变量时产物为 0 额外字节）或干脆 `false` + 自己在 `:host` 上声明需要的 `--un-*`。

---

## 3. 主题化（design tokens）

### 3.1 「UnoCSS theme 只引用 var，值写在 tokens.css」——完全可行，且是推荐做法

**【实测】wind3 下以下配置全部按预期工作：**

```ts
// uno.config.ts
theme: {
  colors: {
    // ① rgb 通道变量 + alpha 占位符（最常用）
    primary: {
      DEFAULT: 'rgb(var(--ui-primary-rgb) / <alpha-value>)',
      500: 'rgb(var(--ui-primary-500-rgb) / <alpha-value>)',
      600: 'rgb(var(--ui-primary-600-rgb) / <alpha-value>)',
      700: 'rgb(var(--ui-primary-700-rgb) / <alpha-value>)',
    },
    // ② hsl 拆分量 + alpha 占位符（同样工作）
    hslBrand: 'hsl(var(--ui-h) var(--ui-s) var(--ui-l) / <alpha-value>)',
    // ③ 纯 var（支持，但 alpha 会被忽略，见 §3.3）
    plainVar: 'var(--ui-plain)',
  },
}
```

对应的 `src/styles/tokens.css`（**放在 CLI 的扫描 glob 里，会被原样拼进产物最前面**）：

```css
/* src/styles/tokens.css */
:root,
:host {
  /* 颜色：存通道值，不含 rgb()，才能在工具类里拼 alpha */
  --ui-primary-rgb: 59 130 246;
  --ui-primary-500-rgb: 59 130 246;
  --ui-primary-600-rgb: 37 99 235;
  --ui-primary-700-rgb: 29 78 216;

  /* 尺寸/圆角等 token */
  --ui-radius: 0.5rem;
  --ui-space-unit: 0.25rem;
}

/* 暗色：只换变量值，不换选择器 —— 见 §4 */
:root[data-theme='dark'],
:host([data-theme='dark']) {
  --ui-primary-rgb: 96 165 250;
  --ui-surface-rgb: 17 24 39;
  --ui-fg-rgb: 243 244 246;
}
```

**【实测】wind3 产物：**
```css
.bg-primary                  {--un-bg-opacity:1;background-color:rgb(var(--ui-primary-rgb) / var(--un-bg-opacity));}
.bg-primary-500\/20          {background-color:rgb(var(--ui-primary-500-rgb) / 0.2);}
.text-primary\/50            {color:rgb(var(--ui-primary-rgb) / 0.5);}
.border-primary\/20          {border-color:rgb(var(--ui-primary-rgb) / 0.2);}
.text-hslBrand\/30           {color:hsl(var(--ui-h) var(--ui-s) var(--ui-l) / 0.3);}
```
**结论：`bg-primary`、`bg-primary/10`、`text-primary/50`、`border-primary/20` 全部正确，透明度与 `var()` 同时可用。**

### 3.2 alpha 占位符的精确机制（源码级）

`@unocss/rule-utils` 里：
```js
const alphaPlaceholders = ["%alpha", "<alpha-value>"]
function colorToString(color, alphaOverride) {
  if (typeof color === 'string') return color.replace(alphaPlaceholdersRE, `${alphaOverride ?? 1}`)
  // ...解析过的颜色走 rgb()/hsl() 拼装
}
```
- 当 theme 值是**字符串**（`var()` / `rgb(var(--x)/...)`）时，UnoCSS 只做**字符串替换**；
- 不写占位符 → **alpha 被静默忽略**。**【实测】** `plainVar: 'var(--ui-plain)'` + `bg-plain/50` **没有出现在产物里**（该 token 直接 unmatched）。
- 所以：**想支持 `/50` 就必须写 `<alpha-value>`（或 `%alpha`）占位符。**

### 3.3 ⚠️ 重大陷阱：wind4 不支持 `<alpha-value>`，会漏出字面量

**【实测】`presetWind4` + 同一份 theme：**
```css
.bg-primary            {background-color:color-mix(in srgb, rgb(var(--ui-primary-rgb) / <alpha-value>) var(--un-bg-opacity), transparent);}
.text-primary\/50      {color:color-mix(in srgb, rgb(var(--ui-primary-rgb) / <alpha-value>) 50%, transparent);}
```
`<alpha-value>` 是**非法 CSS**，整条声明失效 → 颜色全丢。
wind4 的 alpha 走 `color-mix()`，所以它的 theme 色必须是**可直接参与 color-mix 的完整颜色值**：

```ts
// wind4 正确写法：不要写 <alpha-value>
presetWind4()
theme: {
  colors: {
    // 让变量本身就是颜色
    primary: 'var(--ui-primary)',                       // tokens.css 里 --ui-primary: oklch(...) / rgb(...)
    // 或者用完整函数
    primary2: 'oklch(var(--ui-primary-l) var(--ui-primary-c) var(--ui-primary-h))',
  },
}
```
【实测】wind4 产物：`background-color: color-mix(in srgb, var(--colors-red-500) var(--un-bg-opacity), transparent)`
（`--un-bg-opacity` 在 wind4 里是**百分比** `<percentage>`，默认 `100%`，由 `@property` 提供 initial-value。）

### 3.4 wind4 会自动把 theme 变成 CSS 变量（省心但要控量）

【实测】`presetWind4()` 自动输出：
```css
/* layer: theme */
:root, :host { --spacing: 0.25rem; --colors-red-500: oklch(63.7% 0.237 25.331); --text-sm-fontSize: 0.875rem; ... }
```
- `:root, :host` —— **这个选择器组合对 Shadow DOM 很友好**（`<https://unocss.dev/presets/wind4>` 的 "theme Layer" 一节即为此写法）；
- 默认 `mode: 'on-demand'`（【文档】✅ By default），只生成用到的 key。
  **【实测】** `theme: true` 会全量生成 → **19569 B raw / 4908 B gzip**（vs on-demand 162 B raw）。**永远别开 `theme: true`。**

### 3.5 不推荐的做法

- ❌ `theme.colors` 里直接写死十六进制（失去运行时换肤能力，组件库必须可主题化）。
- ❌ 用 `extendTheme` 把默认 200 多个颜色也变成 `var()`（会拖大 theme 层、且默认色板本来也不需要）。
- ❌ 组件内部直接 `style="color: var(--ui-x)"` 混着原子类用（两套机制并存，维护成本翻倍）。

---

## 4. 暗色模式与 Shadow DOM

### 4.1 问题根因（两个边界，别混）

1. **选择器不穿 shadow 边界**：`.dark .dark\:bg-red-800` 要求命中元素有 `.dark` **祖先**。宿主 `<html class="dark">` 在 shadow root 之外，shadow 内的元素没有 `.dark` 祖先 → **不命中**。
2. **文档级样式表不进入 shadow root**：`<link rel="stylesheet" href="mosaic.css">` 里的规则对 shadow 内部**完全无效**（`@font-face`/`@property`/`@keyframes` 有部分全局语义，但普通规则不行）。所以原子类必须被 **adopt 进 shadow root**（见 §8），adopt 之后问题 1 依然存在。
3. **例外（关键）**：**可继承的自定义属性会跨 shadow 边界继承**。这是 token 方案成立的原因。

### 4.2 `:host-context()` 已被废弃 —— 不要用

**【文档】** MDN `:host-context()` 页面顶部标注 **Deprecated**：
> Avoid using this feature in new projects. The CSS Working Group removed `:host-context()` from the specification, due to opposition from vendors, performance considerations, and interest in alternatives.

（Firefox 至今支持不全也是老问题。）
所以网上常见的 `dark: { dark: ':host-context(.dark)' }` **可以生成**（【实测】产物 `.host-context(.dark) .dark\:bg-red-800{...}`），但**不要作为主方案**。
参考：<https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:host-context>

### 4.3 三个可靠方案（按推荐度排序）

#### 方案 A（首选）：Token 切换，完全不用 `dark:` variant

因为自定义属性跨 shadow 继承，只要在**文档级**样式表里切变量，所有 shadow root 自动跟随：

```css
/* tokens.css —— 放在 <link> 的文档级样式表里 */
:root, :host {
  color-scheme: light;
  --ui-surface-rgb: 255 255 255;
  --ui-fg-rgb: 17 24 39;
  --ui-border-rgb: 229 231 235;
}
:root[data-theme='dark'],
:host([data-theme='dark']) {
  color-scheme: dark;
  --ui-surface-rgb: 17 24 39;
  --ui-fg-rgb: 243 244 246;
  --ui-border-rgb: 55 65 81;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
    --ui-surface-rgb: 17 24 39;
    --ui-fg-rgb: 243 244 246;
    --ui-border-rgb: 55 65 81;
  }
}
```
组件模板里只写语义类（不写 `dark:`）：
```js
'ui-card bg-surface text-fg border border-border'
```
配套 theme：
```ts
theme: {
  colors: {
    surface: 'rgb(var(--ui-surface-rgb) / <alpha-value>)',
    fg: 'rgb(var(--ui-fg-rgb) / <alpha-value>)',
    border: 'rgb(var(--ui-border-rgb) / <alpha-value>)',
  },
}
```
优点：**切换零成本、CSS 体积不翻倍、跨 shadow 天然正确、可被宿主覆盖**。
缺点：`dark:` 那套「一处只有深色才生效的样式」需要新造 token（如 `--ui-shadow-strength`），不能直接写 `dark:shadow-lg`。

#### 方案 B：`dark: 'media'`（需要「跟随系统」而非手动切换时）

```ts
presetWind3({ dark: 'media' })
```
【实测】产物：
```css
@media (prefers-color-scheme: dark){
.dark\:bg-red-800{--un-bg-opacity:1;background-color:rgb(153 27 27 / var(--un-bg-opacity));}
}
```
媒体查询在 shadow 内完全有效 ✔；缺点是**用户无法手动切换**（`prefers-color-scheme` 由系统决定）。

#### 方案 C：自定义 selector + 运行时把 class 打到 host 上

```ts
presetWind3({ dark: { dark: ':host(.dark)', light: ':host(.light)' } })
```
【实测】产物：
```css
:host(.dark) .dark\:bg-red-800{--un-bg-opacity:1;background-color:rgb(153 27 27 / var(--un-bg-opacity));}
```
`:host(...)` 是标准且广泛支持的伪类。**前提**：`.dark` 必须落在 host 元素本身（不是 `<html>`）。ofa.js 里让组件自己跟主题：

```js
// 在基类 / 共享 mixin 里
const applyTheme = (el) => {
  const dark = document.documentElement.dataset.theme === 'dark'
  el.classList.toggle('dark', dark)
}
// 每个自定义元素 connectedCallback 里调用 + 监听 documentElement 的 data-theme 变化
```
优点：能手动切换；缺点：多一个运行时、每个 host 都要挂 class（`querySelectorAll` 式的全局扫描不推荐，最好由组件基类自己做）。

#### 方案对比

| | 切换能力 | CSS 体积 | Shadow 兼容 | 运行时依赖 |
|---|---|---|---|---|
| A. Token 切换 | ✅ 手动 + 系统 | 最小（1×） | ✅ 原生 | 无 |
| B. `dark: 'media'` | ❌ 仅系统 | 1× | ✅ 原生 | 无 |
| C. `:host(.dark)` | ✅ 手动 | 1× | ✅ | 需给 host 打 class |
| D. `:host-context(.dark)` | ✅ | 1× | ⚠️ 已废弃/支持不全 | 无 |

**建议：A 为主，C 作为「需要 `dark:` 语法糖」时的补充，B 作为一行开关的兜底。D 不要用。**

---

## 5. 组件库常用 preset 评估

### 5.1 输出体积 / 构建期体积实测

| Preset | 构建期包大小【实测】 | 产物体积代价【实测】 | 组件库建议 |
|---|---|---|---|
| `presetWind3`（`presetUno`/`presetWind` 的新名字） | 148 KB | 基线；preflight 2159 B raw / 348 B gz（可关） | ✅ **必用** |
| `presetWind4` | 364 KB | 默认 reset ~3.9 KB raw / **1.35 KB gz**；`@property` + `color-mix` | ⚠️ 除非要 Tailwind4 语义，否则不选 |
| `presetMini` | 216 KB | 比 wind3 更小（无 container/animation/gradient） | 🟡 想要更小的 API 面时可用 |
| `presetIcons` | 56 KB（+`@iconify-json/carbon` 1.2 MB） | 第 1 个图标 736 B raw / 441 B gz；8 个 5317 B / 1299 B（边际 ≈ +120 B gz/个） | 🟡 少量图标可用，见 §5.2 |
| `presetAttributify` | 24 KB | **对已用工具的 CSS 体积增量为 0** | 🟡 可选，见 §5.3 |
| `presetTypography` | 56 KB | `prose` 一次 **20403 B raw / 2277 B gz** | ❌ 除非真的发布富文本排版组件 |
| `presetTagify` | 20 KB | 很小 | ❌ 不推荐 |
| `presetWebFonts` | 40 KB | 取决于字体 | ❌ 组件库应让宿主决定字体 |
| `transformerCompileClass` | 16 KB | 见 §6.4 | 🟡 可选 |
| `transformerDirectives` | 28 KB | 0（编译期） | ✅ 推荐，写 `@apply` 很顺手 |
| `transformerVariantGroup` | — | 0（编译期） | ✅ 推荐，`hover:(bg-x text-y)` |

### 5.2 `preset-icons`：纯 CSS，无运行时

**【实测 + 文档】**：
- 产物是**纯 CSS**：把 SVG 以 `data:image/svg+xml;utf8,...` 内联进 `--un-icon`，单色图标用 `mask` + `background-color: currentColor`，彩色图标用 `background-image`。**客户端零 JS、零字体、零请求。**
- `@iconify-json/carbon` 只在**构建期（Node）**被 `@unocss/preset-icons` 读取（Node 环境会自动发现已安装的 collection，**不需要** `collections` 选项）。
- `@iconify/json`（全量，约 130 MB）**唯一需要的场景是构建期批量处理**；【文档】明确：浏览器/CDN 场景要用 `@iconify-json/*`。
- **图标类名会被当成普通 class 抽取**，写死在模板里最安全；如需动态，同样进 `safelist`。
- 产物形态示例【实测】：
```css
.i-carbon-sun{
  --un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 32 32' width='1.2em' height='1.2em' ...%3E%3Cpath fill='currentColor' d='...'/%3E%3C/svg%3E");
  -webkit-mask:var(--un-icon) no-repeat; mask:var(--un-icon) no-repeat;
  -webkit-mask-size:100% 100%; mask-size:100% 100%;
  background-color:currentColor; color:inherit; display:inline-block; vertical-align:middle;
  width:1.2em; height:1.2em;
}
```
- **体积提醒**：gzip 后每个图标仍要 ~120–440 B（SVG path 文本压缩率低）。一个 UI 库若有 200 个图标，就是 ~25–80 KB gzip 的纯 CSS。**多图标场景建议改用 `<svg><use>` sprite（一次 1 个文件、浏览器缓存），把 icons preset 只用于零散装饰图标。**
- 可选配置：
```ts
presetIcons({
  scale: 1.2,
  prefix: 'i-',                       // 默认就是 i-
  extraProperties: { display: 'inline-block', 'vertical-align': 'middle' },
  warn: true,                         // 匹配不到图标时告警（CI 友好）
  // 只装需要的 collection，Node 下自动发现；显式写更可控：
  // collections: { carbon: () => import('@iconify-json/carbon/icons.json').then(i => i.default) },
})
```

### 5.3 `preset-attributify`：体积为 0，但会改写你的 HTML 风格

**【实测】** 对同一批工具，加不加 attributify **CSS 字节完全相同**（744 B）。
它的成本在于：抽取器要额外扫 HTML 属性（`<div bg="red-500" text="sm">`），以及**属性名可能与组件自身的 property 冲突**。组件库若要开，建议**强制前缀**，避免和 ofa.js 组件的 attribute API 打架：

```ts
presetAttributify({
  prefix: 'un-',
  prefixedOnly: true,           // 只认 un-*
  ignoreAttributes: ['text'],   // 显式排除冲突属性
})
```
→ 用法变成 `<div un-bg="red-500" un-text="sm">`。
**结论：对「框架作者自己写组件模板」的场景收益不大（模板里本来就是 class），可以不开。**

### 5.4 `presetUno` / `presetWind` 已废弃

**【实测】** `node_modules/@unocss/preset-uno/package.json` 的 description 是 `"Deprecated, renamed to \`@unocss/preset-wind3\`"`，源码里也直接 `@deprecated Use presetWind3`。
`import { presetUno, presetWind, presetWind3, presetWind4 } from 'unocss'` 全部可用，但：
**统一写 `presetWind3`。**
参考：<https://unocss.dev/presets/wind3>

---

## 6. 体积控制

### 6.1 CLI 的 preflight 默认值是个坑

**【实测】** `@unocss/cli` 源码：`option("--preflights", ..., { default: true })`。
也就是说 **`unocss "src/**" -o out.css` 默认带 preflight**。剔除方式：
```bash
unocss "src/**/*.{js,ts,html}" -o dist/mosaic.css --no-preflights
```
或在 preset 里 `preflight: false` / `'on-demand'`。

### 6.2 体积实测汇总（同一组工具 = `bg-red-500 text-sm p-4`）

| 配置 | raw | gzip |
|---|---|---|
| wind3 `preflight: true`（默认） | 2336 B | 507 B |
| wind3 `preflight: false` | 177 B | 159 B |
| wind3 `preflight: 'on-demand'` | 177 B | 159 B |
| wind4 默认（reset + theme + @property + utils） | 4852 B | 1807 B |
| wind4 `preflights.reset: false` | 887 B | 461 B |
| wind4 `reset:false, property:false` | 697 B | 368 B |
| wind4 `reset:false, property:false, theme:false` | 535 B | 297 B |
| wind4 `theme: true`（全量主题变量） | **19569 B** | **4908 B** |
| `@unocss/reset/tailwind.css` 单独 | 7499 B | 2628 B |
| `@unocss/reset/normalize.css` 单独 | 5023 B | 1410 B |

> 【实测】CLI 的 `-m/--minify` 收益极小：5428 B → 5339 B（只是去掉换行和 `/* layer: */` 注释）；gzip 1477 → 1452 B。**真正决定体积的是「生成哪些工具 + 哪些 preflight」，不是 minify。**

### 6.3 `@property` 要不要剥离

- **wind3 不产生 `@property`** —— 想彻底避免，就用 wind3。**【实测】**
- **wind4 会产生**，而且 **`preflights.property: false` 只移除 `@supports{*{--un-*-opacity:100%}}` 回退块，不移除 `@property` 声明本身**。**【实测，源码第 11–14 行确认这是 `property()` preflight 的职责】**
  → 关掉 `property` 在**不支持 `@property` 的浏览器上会让 `bg-red-500` 直接失效**（`var(--un-bg-opacity)` 无值）。**所以 wind4 下别关它。**
- 若确实要剥离，只能自己后处理（`postprocess` 或产物上跑一次 lightningcss/postcss 正则删除 `@property` 块），并自行补 `*{--un-*-opacity:100%}` 回退。
- 若用 wind3：`--un-*-opacity` 由每条规则自带（【实测】`.bg-red-500{--un-bg-opacity:1;...}`），**Shadow DOM 下天然可用**，无需额外注入。

### 6.4 `transformer-compile-class`：对组件库有用，但要接受两个代价

```ts
import { transformerCompileClass } from 'unocss'
transformers: [transformerCompileClass({ trigger: ':uno:', classPrefix: 'ui-' })]
```
- **好处【实测】**：`:uno: text-center sm:text-left bg-red-500 p-4` → 源码里变成 `uno-vha7pp`，产物里是**一条合并规则**（含 `@media` 一起被收进同一个类），配合 CSS 压缩/gzip 的重复消除，能显著减小「原子类名重复」的文本量：
```css
.uno-vha7pp{--un-bg-opacity:1;background-color:rgb(239 68 68 / var(--un-bg-opacity));padding:1rem;text-align:center;}
@media (min-width: 640px){ .uno-vha7pp{text-align:left;} }
```
- **代价 1**：CLI 必须传 `--rewrite` 才会改写源文件（否则源码仍是 `:uno:`）；且**命令行 + 编辑器/IDE 里类名就不可读了**，调试、review、grep 都变难。
- **代价 2**：**产物默认落在 `shortcuts` 层**（【实测】`/* layer: shortcuts */`），与你手写的组件类同层，注意层顺序。
- **对「通过 jsDelivr 发布、源码就是最终产物」的库**：如果组件模板本身已经在仓库里经过构建（比如打包进 `.js`），用 compile-class 是净收益；如果**发布给用户的 `.js` 就是仓库源码**，用它会强行引入一次「源码重写」步骤，得不偿失。
- **建议**：默认不开；只有当你发现「原子类名文本」在 gzip 后仍占显著比例（比如 >15%）时再评估。

### 6.5 `transformer-directives`：推荐，但注意作用范围

**【实测】** 只在 **CSS 类文件**（`cssIdRE = /\.(css|postcss|sass|scss|less|stylus|styl)($|\?)/`）里生效：
```css
/* src/styles/card.css */
.ui-card { @apply rounded-lg p-4 shadow-sm bg-white; }
@screen sm { .ui-card { --at-apply: 'text-sm font-bold'; } }
.ui-x { color: theme('colors.red.500'); }
```
→ 产物（**被 CLI 内联进最终 CSS 文件**）：
```css
/* Source: /path/src/styles/card.css */
.ui-card{ border-radius:0.5rem;--un-bg-opacity:1;background-color:rgb(255 255 255 / var(--un-bg-opacity));padding:1rem; ... }
@media (min-width: 640px){ .ui-card { font-size:0.875rem;line-height:1.25rem;font-weight:700; } }
.ui-x { color: #ef4444; }
```
⚠️ **【实测】写在 `.html` 里的 `<style>@apply ...</style>` 不会被处理**（idFilter 只认 CSS 类扩展名），HTML 里的 `@apply` 会原样留在源码里。组件库应把 `@apply` 集中在 `.css` 文件。

### 6.6 其它体积手段

- **`blocklist` 收缩 API 面**（§2.3）：默认色板 200+ 颜色，blocklist 掉不用的族，可以防止后续误用导致体积意外上涨。
- **`presetMini` 代替 `presetWind3`**：砍掉 `container`/`animation`/`gradient` 等重工具，构建期更轻。
- **不要开** `important: true` / `important: '#app'`：组件库会污染宿主页面（且 `#app` 在你的 shadow DOM 里不存在）。
- **不要开后** `theme: true`（wind4）/**不要**盲写大片 safelist。
- **CI 守卫**：断言 `dist/mosaic.css` 非空 + 体积上限；用 `uno.generate(...).matched.size` 对比预期工具数，能抓住「动态类名扫不到」这类静默失败。

---

## 7. `@unocss/reset` 实测尺寸与选型

### 7.1 全部 reset 的实测体积

| 文件 | raw | gzip |
|---|---|---|
| `@unocss/reset/eric-meyer.css` | 1107 B | 631 B |
| `@unocss/reset/normalize.css` | 5023 B | 1410 B |
| `@unocss/reset/tailwind.css` | 7499 B | 2628 B |
| `@unocss/reset/tailwind-compat.css` | 7700 B | 2725 B |
| `@unocss/reset/tailwind-v4.css` | 8162 B | 2890 B |
| `@unocss/reset/sanitize/sanitize.css` | 7381 B | 2004 B |
| `@unocss/reset/sanitize/assets.css` | 168 B | 166 B |
| `@unocss/reset/sanitize/forms.css` | 1010 B | 514 B |
| `@unocss/reset/sanitize/system-ui.css` | 868 B | 267 B |
| `@unocss/reset/sanitize/typography.css` | 1153 B | 427 B |
| `@unocss/reset/sanitize/reduce-motion.css` | 708 B | 299 B |
| `@unocss/reset/sanitize/ui-monospace.css` | 992 B | 304 B |

【文档】各文件来源 & 差异：<https://unocss.dev/guide/style-reset>
- `tailwind.css` 基于 Tailwind v3 preflight；
- `tailwind-v4.css` 基于 Tailwind v4 preflight；
- `tailwind-compat.css` = `tailwind.css` 去掉 button 的 `background-color: transparent` 覆盖（【文档】专为「避免与 UI 框架冲突」而做，issue #2127）。

### 7.2 组件库应该用哪种？—— 都不建议直接整份 `<link>`

理由：
1. **reset 是给「整页应用」的，不是给「组件」的**。整份 reset 会重置宿主页面的 `h1~h6`、`img`、`button`、`ul`、表单控件——一个组件库干这事会被骂。
2. **Shadow DOM 下文档级 reset 本来就不生效**（只作用于 light DOM），所以「链接 reset + 组件内部也 reset」需要两套。
3. **体积**：tailwind reset 7499 B raw / 2628 B gzip，而组件库真正需要的部分极小。

**推荐做法：自己写一份 ~20 行的 `base.css`，同时适配 light DOM 和 shadow DOM，并且只在 shadow root 内 adopt：**

```css
/* src/styles/base.css  —— 产物：dist/mosaic-base.css（不进 <link>，只由 JS adopt 进 shadow root） */
*, ::before, ::after { box-sizing: border-box; }

:host {
  /* 组件内部的最小 base；不污染宿主 */
  display: inline-block;            /* 具体组件再覆盖 */
  font-family: var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif);
  line-height: 1.5;
  color: rgb(var(--ui-fg-rgb, 17 24 39));
  -webkit-text-size-adjust: 100%;
  tab-size: 4;
}

button, input, select, textarea {
  font: inherit; color: inherit; margin: 0;
}
button { background: none; border: 0; cursor: pointer; }
img, svg, video { display: block; max-width: 100%; height: auto; }
[hidden] { display: none !important; }
```
如果一定要用官方 reset：
- **light DOM 场景**（宿主页面就是要你的 reset）：`tailwind-compat.css`（避免覆盖 button 背景色）；
- **shadow root 场景**：**不要**用官方 reset 整份，用上面的自写版；或者用 wind4 内置 reset（它自带 `*,::before,::after,::backdrop,::file-selector-button` + `html, :host`，见 §1.4），但记得 `reset` 默认开启是因为 wind4 **没有**单独的 reset 包需求（【文档】："You don't need to install any additional CSS reset package like `@unocss/reset` or `normalize.css`"）。

---

## 8. 落地架构建议（ofa.js + jsDelivr，无构建分发）

### 8.1 两个物理文件，职责分离

```
dist/
├── mosaic.css        # ① 文档级：tokens(:root,:host) + 工具类 + 组件 shortcuts
│                     #    <link rel="stylesheet"> 给宿主页面的 light DOM 用
│                     #    同时也被 JS adopt 进每个 shadow root
└── mosaic-base.css   # ② 仅组件内部：:host 作用域的最小 base/reset（自写，~1KB）
                      #    只 adopt 进 shadow root，绝不 <link> 到文档
```

CLI：
```bash
unocss "src/components/**/*.{js,ts,html}" -o dist/mosaic.css --no-preflights -m
unocss "src/styles/base.css" -o dist/mosaic-base.css   # 纯 CSS 直通，无需预处理
```

### 8.2 Shadow DOM 的样式注入（关键 10 行）

因为 `<link>` 不进入 shadow root，组件内部必须 adopt。**共享同一个 `CSSStyleSheet` 对象**，避免 N 份解析：

```js
// src/styles/adopt.js —— 组件库内部工具，无构建、无依赖
const sheetCache = new Map()

async function loadSheet(url) {
  if (sheetCache.has(url)) return sheetCache.get(url)
  const sheet = new CSSStyleSheet()
  // 注意：CSSStyleSheet.replace() 返回 Promise；跨域 CDN 需 CORS 允许（jsDelivr 允许 GET + ACAO:*）
  await sheet.replace(await (await fetch(url)).text())
  // 也可以 sheet.replaceSync(text)（同步，会阻塞主线程，但省一次 await）
  sheetCache.set(url, sheet)
  return sheet
}

// 在组件基类里
export async function attachStyles(shadowRoot, ...urls) {
  const sheets = await Promise.all(urls.map(loadSheet))
  shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, ...sheets]
}
// 用法：await attachStyles(this.shadowRoot,
//   'https://cdn.jsdelivr.net/npm/@mosaic/ui@1/dist/mosaic.css',
//   'https://cdn.jsdelivr.net/npm/@mosaic/ui@1/dist/mosaic-base.css')
```
要点：
- `adoptedStyleSheets` 支持良好（Chrome 73+/Safari 16.4+/Firefox 101+）；同构造函数的 `CSSStyleSheet` 可被**多个 shadow root 共享**，内存只有一份。
- 若必须兼容老浏览器，退化为 `shadowRoot.appendChild(<style>cssText</style>)`（每个组件一份，浪费内存）。
- **`@layer` 在 shadow root 内是独立作用域**：每个 shadow root 自己解析 `@layer a, b;` 顺序，不会有跨树问题。
- **`@property` 是文档级的**：只在文档样式表里出现一次即可对所有 shadow tree 生效（wind4 场景）。wind3 则没有这个问题。
- **`@media (prefers-color-scheme)` 在 shadow root 内正常**（方案 B 可行）。

### 8.3 主题（用户可覆盖）

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mosaic/ui@1/dist/mosaic.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/@mosaic/ui@1/dist/mosaic.js"></script>

<style>
  /* 用户在自己的页面就能覆盖 token —— 因为 var 在 :root 且会继承进 shadow root */
  :root {
    --ui-primary-rgb: 16 185 129;
    --ui-radius: 0.25rem;
  }
</style>
```
**这是「UnoCSS theme 只引用 var」的最终价值**：宿主页面改 `--ui-*` 就能换肤，组件库完全不需要知道。

---

## 9. 需要你自己再验证的点（我无法在本环境确证的）

1. **ofa.js 组件的具体形态**：上面 §8.2 的 `adoptedStyleSheets` 方案对「每个组件一个 shadow root」最有效；如果 ofa.js 大量使用 light DOM 组件，则 `<link>` 就够了，adoption 可以不做。
2. **`:host-context()` 在你们目标浏览器矩阵里的实际支持率**——结论「已废弃，别用」来自 MDN，但你们若必须兼容旧版 Safari，方案 A 依然是最稳的。
3. **CDN 上 `fetch()` 组件 CSS 的 CORS 与缓存**：jsDelivr 默认 `access-control-allow-origin: *`，但请对你们的具体包路径验证一次（尤其带 `?v=` 查询串时的缓存命中）。
4. **图标体积**：§5.2 的数字基于 Carbon collection；你们真实图标集（尤其彩色/多 path）会显著不同，建议按最终图标清单跑一次 `du` 实测再决定 sprite vs data-URI。

---

## 附：可直接复制的最终配置

```ts
// uno.config.ts
import { defineConfig, presetWind3, presetIcons, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3({
      preflight: 'on-demand',                              // 只出需要的 --un-* 变量
      dark: { dark: ':host(.dark)', light: ':host(.light)' }, // Shadow DOM 可用（方案 C 兜底）
    }),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: { display: 'inline-block', 'vertical-align': 'middle' },
    }),
  ],
  transformers: [
    transformerDirectives(),   // .css 里可用 @apply / @screen / theme()
    transformerVariantGroup(), // hover:(bg-x text-y)
  ],
  theme: {
    colors: {
      // 只保留语义色；具体值全部走 tokens.css 的 CSS 变量
      primary: {
        DEFAULT: 'rgb(var(--ui-primary-rgb) / <alpha-value>)',
        500: 'rgb(var(--ui-primary-500-rgb) / <alpha-value>)',
        600: 'rgb(var(--ui-primary-600-rgb) / <alpha-value>)',
      },
      surface: 'rgb(var(--ui-surface-rgb) / <alpha-value>)',
      fg: 'rgb(var(--ui-fg-rgb) / <alpha-value>)',
      muted: 'rgb(var(--ui-muted-rgb) / <alpha-value>)',
      border: 'rgb(var(--ui-border-rgb) / <alpha-value>)',
      danger: 'rgb(var(--ui-danger-rgb) / <alpha-value>)',
    },
  },
  shortcuts: [
    ['ui-btn', 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors select-none disabled:opacity-50'],
    ['ui-btn-primary', 'ui-btn bg-primary text-white hover:bg-primary-600'],
    ['ui-btn-sm', 'ui-btn px-2 py-1 text-xs'],
    ['ui-btn-md', 'ui-btn px-4 py-2 text-sm'],
    ['ui-btn-lg', 'ui-btn px-6 py-3 text-base'],
    ['ui-card', 'bg-surface text-fg border border-border rounded-lg p-4 shadow-sm'],
  ],
  safelist: [
    // 显式枚举所有「可能被拼接出来」的组件类
    'ui-btn-sm', 'ui-btn-md', 'ui-btn-lg',
    'ui-btn-primary', 'ui-btn-ghost',
    // 函数形式：从 sizes 常量派生，防止手写遗漏
    (ctx) => ['sm', 'md', 'lg'].flatMap(s => [`ui-btn-${s}`, `ui-btn-${s}-block`]),
  ],
  blocklist: [
    [/^bg-(red|green|blue)-\d+$/, { message: '请使用语义色 bg-primary / bg-danger' }],
  ],
  layers: { preflights: -100, shortcuts: -1, default: 1 },
  outputToCssLayers: {
    cssLayerName: (layer) => (layer === 'default' ? 'mosaic.utilities' : layer === 'shortcuts' ? 'mosaic.components' : `mosaic.${layer}`),
  },
  cli: { entry: [{ patterns: ['src/components/**/*.{js,ts,html}', 'src/styles/**/*.css'], outFile: 'dist/mosaic.css' }] },
})
```

```jsonc
// package.json
{
  "scripts": {
    "build": "unocss -c uno.config.ts --no-preflights -m",
    "dev":   "unocss -c uno.config.ts --no-preflights --watch"
  },
  "devDependencies": {
    "unocss": "^66.10.5",
    "@iconify-json/carbon": "^1.2.0"
  }
}
```
