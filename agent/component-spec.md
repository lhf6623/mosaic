# Mosaic 组件 API 规范

> [`components.md`](./components.md) 讲**怎么造**组件（分层、骨架、检查清单）。
> 本文讲**有哪些**组件、各自的 API 长什么样。
> 设计规则见 [`design-spec.md`](./design-spec.md)，令牌值见 [`design-tokens.md`](./design-tokens.md)。

---

## 一、全部组件共用的约定

这一节是硬约束 —— 所有组件的 API 都必须落在这个框架里，
不允许某个组件"因为情况特殊"另起一套。

### 1.1 引入方式

**按需引入，一个组件一条 `<l-m>`：**

```html
<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
```

标签名 = `mc-` + 目录名。同一个族的组件共用一个目录（目录名 = 主标签去掉 `mc-` 前缀）。

### 1.2 属性：四个正交维度

**不要把这些混成一维枚举。** 混了就没法组合（`variant="danger"` 之后
就没法再表达"我要描边样式的危险按钮"），而且 CSS 会退化成组合爆炸。

| 维度         | 属性                                                         | 取值                                                              | 默认      |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- | --------- |
| **语义色**   | `color`                                                      | `primary` / `info` / `success` / `warning` / `danger` / `neutral` | `primary` |
| **外观样式** | `variant`                                                    | 约定：`filled` / `outline` / `ghost`（部分组件另有 `subtle`）     | `filled`  |
| **尺寸**     | `size`                                                       | `sm` / `md` / `lg`                                                | `md`      |
| **状态**     | `disabled` / `loading` / `readonly` / `invalid` / `selected` | 布尔，存在即真                                                    | 无        |

组件**只声明它真正支持的维度**（`mc-card` 没有 `color`，`mc-spinner` 没有 `variant`）。
不支持的属性不要写进 `attrs` —— 写了就是承诺。

`variant` 的取值是**约定**而不是全局枚举：每个组件只声明自己实际支持的取值，
上表列出的是各组件通用的一套（`mc-menu` 用的是 `plain`（默认）/ `surface`）。

**实现方式**：`color` 只往组件自己的色槽（`--mc-<comp>-*`）里填值，`variant` 只决定这些槽
贴到 `background` / `color` / `border-color` 上，两者不直接相乘。槽的个数按需要定：
`mc-button` 用三个 —— `--mc-button-fill` / `--mc-button-on-fill` / `--mc-button-accent`，
因为中性色需要一个单独的强调色。规则数量级因此是「颜色数 + 外观数」，不是两者相乘。

### 1.3 尺寸：只有三档

| `size`       | 控件高                     | 用途                                                                       |
| ------------ | -------------------------- | -------------------------------------------------------------------------- |
| `sm`         | `--mc-control-h-sm` (28px) | 密集界面（表格行内、工具条）。**低于 32px 触控下限，不要用在移动端主操作** |
| `md`（默认） | `--mc-control-h-md` (36px) | 常规                                                                       |
| `lg`         | `--mc-control-h-lg` (44px) | 移动端主操作、突出操作                                                     |

**没有 `xs` / `xl`。** 需要更极端的尺寸时用 `style="height: …"` 精确覆盖，
不要往组件里加尺寸档位 —— 三档之外的需求都是个案。

### 1.4 值的读写（最容易踩的地方）

**标签属性是"初始值"，DOM property 是"运行时状态"。** 这条规则对所有带值的组件生效。

```html
<!-- HTML 里设初始值：用 default-* -->
<mc-input default-value="张三"></mc-input>
<mc-dialog default-open></mc-dialog>
```

```js
// JS 里读写运行时状态：用 property
input.value = '李四'; // ✅
input.setAttribute('value', '李四'); // ❌ 无效
dialog.open = true; // ✅
```

**布尔属性推荐走 `setAttribute` / `removeAttribute`** —— 属性是 ofa 观察的通道
（少数直接改不触发更新的 property 见 [P3](./ofa-pitfalls.md)）。
组件**可以**为布尔属性提供一个立即同步的 property 访问器 —— `mc-collapse-item` 的 `open` 就是
（`el.open = true` 写完立刻生效，不必等属性反射那一拍）。

```js
btn.setAttribute('disabled', '');
btn.removeAttribute('disabled');

item.open = true; // 组件提供了访问器时同样可以
```

**值的反射**：`value` / `checked` / `open` 等会反射到宿主元素的原生 DOM property，
所以 `e.target.value` 能读到值（[P18](./ofa-pitfalls.md) 的坑已由组件内部处理，使用者无感）。

### 1.5 事件

**不加 `mc-` 前缀**，用原生语义名，使用者不需要记两套命名。

| 事件             | 触发                           | `$event.data`     |
| ---------------- | ------------------------------ | ----------------- |
| `change`         | 值确定变化（失焦、选中、确认） | `{ value }`       |
| `input`          | 实时输入（每次按键）           | `{ value }`       |
| `open` / `close` | 弹层打开 / 关闭                | —                 |
| `select`         | 选项被选中                     | `{ value, item }` |
| `clear`          | 可清除输入被清空               | —                 |

```html
<mc-input on:change="value = $event.data.value"></mc-input>
```

**点击类交互不定义自定义事件** —— 原生 `click` 自带 `composed: true`，会穿透 shadow 边界冒泡。

### 1.6 插槽命名

| 名字                    | 用途                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| （无 `name`）           | 主内容                                                                           |
| `prefix` / `suffix`     | 输入框、按钮内部的前后附加物；容器类组件的「头部行尾」也用 `suffix`（`mc-card`） |
| `header` / `footer`     | 容器类组件的头尾                                                                 |
| `title` / `description` | 有明确语义的标题与描述                                                           |

**用 `prefix` / `suffix`，不用 `leading` / `trailing`** —— 和 CSS 逻辑属性（`padding-inline-start`）对齐。

### 1.7 `part` 命名

只在**内部有结构性子元素**且使用者确实需要定制时才暴露 `part`。
视觉在 `:host` 上的组件（如 `mc-button`）不需要 —— 外部 `style="…"` 已经够用。

通用词汇：`base` / `panel` / `overlay` / `header` / `body` / `footer` / `label` / `input` / `error`。
已开出的额外名字必须登记在这里：`list`（`mc-menu` / `mc-breadcrumb`）、
`pre` / `code` / `line`（`mc-code`）。

### 1.8 无障碍基线（每个组件都要满足）

- 可交互元素必须是**原生元素**（`<button>` / `<input>` / `<a>`），不是 `<div on:click>`
- 键盘可完成全部操作；弹层必须支持 `Esc` 关闭、打开时焦点进弹层、关闭后焦点归还
- 焦点环用 `--mc-color-ring`，不用 `currentColor`
- 图标按钮必须有 `aria-label`；装饰性 SVG 加 `aria-hidden="true"`
- 详见 [`design-spec.md` 第八节](./design-spec.md#八无障碍)

---

## 二、组件索引

| 组件            | 标签                                   | 目录          | 里程碑 | 状态      |
| --------------- | -------------------------------------- | ------------- | ------ | --------- |
| Button          | `mc-button`                            | `button/`     | M1     | ✅ 已实现 |
| Code            | `mc-code`                              | `code/`       | M1     | ✅ 已实现 |
| Collapse        | `mc-collapse` / `mc-collapse-item`     | `collapse/`   | M1     | ✅ 已实现 |
| Menu            | `mc-menu` / `mc-menu-item`             | `menu/`       | M1     | ✅ 已实现 |
| Breadcrumb      | `mc-breadcrumb` / `mc-breadcrumb-item` | `breadcrumb/` | M1     | ✅ 已实现 |
| Icon            | `mc-icon`                              | `icon/`       | M1     | 待建      |
| Card            | `mc-card`                              | `card/`       | M1     | ✅ 已实现 |
| Tag             | `mc-tag`                               | `tag/`        | M1     | ✅ 已实现 |
| Badge           | `mc-badge`                             | `badge/`      | M1     | 待建      |
| Spinner         | `mc-spinner`                           | `spinner/`    | M1     | 待建      |
| Input           | `mc-input`                             | `input/`      | M2     | 待建      |
| Textarea        | `mc-textarea`                          | `textarea/`   | M2     | 待建      |
| Checkbox        | `mc-checkbox`                          | `checkbox/`   | M2     | 待建      |
| Radio           | `mc-radio` / `mc-radio-group`          | `radio/`      | M2     | 待建      |
| Switch          | `mc-switch`                            | `switch/`     | M2     | 待建      |
| Select          | `mc-select` / `mc-option`              | `select/`     | M2     | 待建      |
| Alert           | `mc-alert`                             | `alert/`      | M2     | 待建      |
| Progress        | `mc-progress`                          | `progress/`   | M2     | 待建      |
| Toast（命令式） | —                                      | `toast/`      | M2     | 待建      |
| Dialog          | `mc-dialog`                            | `dialog/`     | M3     | 待建      |
| Dropdown        | `mc-dropdown` / `mc-menu-item`         | `dropdown/`   | M3     | 待建      |
| Tooltip         | `mc-tooltip`                           | `tooltip/`    | M3     | 待建      |
| Tabs            | `mc-tabs` / `mc-tab`                   | `tabs/`       | M3     | 待建      |
| Table           | `mc-table`                             | `table/`      | M3     | 待建      |
| Grid            | `mc-grid` / `mc-grid-item`             | `grid/`       | M3     | 待建      |

---

## 三、M1 组件

### mc-button

`packages/button/button.html` · **已实现**

| 属性       | 值                                                      | 默认      | 说明                          |
| ---------- | ------------------------------------------------------- | --------- | ----------------------------- |
| `color`    | `primary` `info` `success` `warning` `danger` `neutral` | `primary` | 语义色                        |
| `variant`  | `filled` `outline` `ghost`                              | `filled`  | 外观样式                      |
| `size`     | `sm` `md` `lg`                                          | `md`      | 尺寸                          |
| `type`     | `button` `submit` `reset`                               | `button`  | 转发给内部原生 button         |
| `disabled` | 布尔                                                    | —         | 禁用                          |
| `loading`  | 布尔                                                    | —         | 加载中，显示 spinner 且不可点 |
| `block`    | 布尔                                                    | —         | 撑满父容器宽度                |

| 插槽                | 说明          |
| ------------------- | ------------- |
| （默认）            | 按钮文案      |
| `prefix` / `suffix` | 前置/后置图标 |

| 事件    | 说明                                         |
| ------- | -------------------------------------------- |
| `click` | 原生事件，直接 `on:click` 监听，无自定义事件 |

**定制**：视觉全部在 `:host` 上，直接写原生 CSS 即可。

```html
<mc-button color="danger" variant="outline" size="sm">删除</mc-button>
<mc-button color="success" loading>正在保存…</mc-button>
<mc-button block style="height: 48px; border-radius: 9999px">圆角大按钮</mc-button>
<mc-button><span slot="prefix">🔍</span>搜索</mc-button>
```

---

### mc-code

`packages/code/code.html` · **已实现**

代码展示。代码文本可以贴在标签里，也可以用 `code` 属性 / `:code` 绑定传进来：

```html
<mc-code language="javascript" line-numbers> const a = 1; </mc-code>
```

| 属性                             | 值                                                              | 默认                     | 说明                                                                                                             |
| -------------------------------- | --------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src`                            | URL                                                             | —                        | **片段文件**：优先级最高；缺 `language` 时按文件后缀推断。同一 URL 多处引用只取一次                              |
| `code`                           | 字符串（可多行）                                                | —                        | 代码文本；不写则读**标签里的纯文本**。`<` 都要写 `&lt;`                                                          |
| `language`                       | 语言 id 或别名：`js` `ts` `html` `css` `json` `bash` `py` `md`… | —                        | 空 / `text` / `none` 表示不高亮                                                                                  |
| `line-numbers`                   | 布尔                                                            | —                        | 行号列（`position: sticky`）。行号是真实的 DOM 文本（`<span part="line">`），只靠 `user-select: none` 不参与复制 |
| `max-height`                     | 数字（px）或 CSS 长度                                           | —                        | 超出时在组件内部滚动；块内滚到底后滚轮会继续滚页面（不会把滚动锁在组件里）                                       |
| `soft-wrap`                      | 布尔                                                            | —                        | 长行折行，而不是横向滚动                                                                                         |
| `hljs-theme` / `hljs-theme-dark` | highlight.js 官方主题名                                         | `github` / `github-dark` | 亮色 / 暗色主题                                                                                                  |
| `hljs-base`                      | URL                                                             | 内置固定版本 CDN         | highlight.js 的 `build/` 目录（自托管 / 换镜像）                                                                 |

> ⚠️ 折行属性叫 **`soft-wrap`** 而不是 `wrap`：`wrap` 是 ofa.js 的保留名，
> 声明进 `attrs` 之后 `document.createElement('mc-code')` 会直接抛
> `NotSupportedError`（见 [P31](./ofa-pitfalls.md)）。

| part           | 说明                                  |
| -------------- | ------------------------------------- |
| `body`         | 滚动容器（`max-height` 作用在它身上） |
| `pre` / `code` | 等宽排版层 / 高亮产物层               |
| `line`         | 行号模式下的每一行                    |

| 运行时                    | 说明                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `el.code`（DOM property） | 读回当前原文（已 dedent）；写入等价于 `setAttribute('code', …)`，**立刻**重渲染 + 重新高亮 |

代码文本四种传法，优先级 `src` > `code` 属性 > 标签内文本：

```html
<!-- ① 标签里直接贴：最好读，不用转义引号 -->
<mc-code language="javascript"> const a = 1; </mc-code>

<!-- ② code 属性：单行/多行都行 -->
<mc-code language="javascript" code="const a = 1;"></mc-code>

<!-- ③ ofa 模板绑定：从页面 data 取（:prop 只对 attrs 里声明过的键生效） -->
<mc-code language="javascript" :code="snippet"></mc-code>

<!-- ④ 片段文件：长片段、或含 <script> / 大量 < 的片段 —— 文件是真 HTML/JS，不用转义 -->
<mc-code language="html" src="../snippets/quick-start.html"></mc-code>
```

> `src` 的路径按**页面文件**解析（和 `<link href>`、`export const parent` 一样）：
> ofa 编译页面模块时会把相对地址改写成绝对地址，组件拿到的已经是绝对 URL。
> 普通 HTML 宿主里没这层改写，此时按文档地址（`document.baseURI`）解析。

**什么时候用哪个**：短片段（一两行）贴标签里最省事；
含 `<script>`、或一半字符都是 `&lt;` 的长片段用 `src` ——
文档站里 `docs/snippets/quick-start.html` 就是这么放的，文件本身还能直接打开验证。

```js
// 运行时两种写法等价，且立刻生效（内部不等 ofa 那一拍，见 P4）
el.code = 'const b = 2;';
el.setAttribute('code', 'const b = 2;');
```

**标签内文本的书写约定**：开标签**独占一行**，代码统一缩进，闭标签独占一行 ——
组件的 dedent 靠「所有非空行的公共缩进」，首行粘在开标签上会让公共缩进变成 0，
整段就少去一层、渲染出来左边参差不齐：

```html
<!-- ✅ 公共缩进 = 2，dedent 后正好是代码本来的样子 -->
<mc-code language="html">
  &lt;!doctype html&gt; &lt;html lang="zh-CN"&gt; &lt;/mc-code&gt;

  <!-- ❌ 首行粘在标签上 → 公共缩进 0 → 其余行多出 2 格，第一行还顶在最左 -->
  <mc-code language="html">&lt;!doctype html&gt; &lt;html lang="zh-CN"&gt;</mc-code></mc-code
>
```

| L3 令牌                                                | 说明                                 |
| ------------------------------------------------------ | ------------------------------------ |
| `--mc-code-fill` / `--mc-code-border` / `--mc-code-fg` | 代码块自己的底色、描边、文字         |
| `--mc-code-dim`                                        | 行号颜色                             |
| `--mc-code-font-size` / `--mc-code-line-height`        | 排版                                 |
| `--mc-code-max-h`                                      | 高度上限（一般写 `max-height` 属性） |

**语法配色不是令牌**：它来自 highlight.js 的官方主题样式表
（`styles/<theme>.min.css`），取回来**原样 `adopt`** 进组件的 shadow root，
组件不覆盖它任何一条规则。给渲染节点**刻意不加 `hljs` 类**：主题里 `.hljs` 的底色、
`pre code.hljs` 的内边距那套"整块代码块"外观会接管组件盒模型，而这里只想要 token 颜色
（`adoptedStyleSheets` 的优先级高于组件自己的 `<style>`）。
亮暗跟随读 `color-scheme`（继承属性，能穿进 shadow root），切主题就换一张官方表。

**高亮是可选运行时增量**：默认从 jsDelivr 懒加载 highlight.js（core + 用到的语言，
每种一次、多实例共享）。加载失败 / 语言名写错 / CSP 拦截 → **保持纯文本**，
控制台一条 `[mosaic]` 警告，排版 / 行号 / 主题跟随都不受影响。

```html
<mc-code language="css" line-numbers max-height="200">
  :root { --mc-color-primary: 16 185 129; }
</mc-code>

<mc-code language="bash" soft-wrap>pnpm build && pnpm check:drift</mc-code>
```

```js
// 运行时换内容
el.code = 'const b = 2;';
```

---

### mc-icon

`packages/icon/icon.html` · M1

**图标方案：内联 SVG sprite，不用 `@unocss/preset-icons`。**
理由：preset-icons 把每个图标转成 data-URI 的 CSS，**gzip 后每个仍占 120–440 B**，
200 个图标就是 25–80 KB 纯 CSS，而且无法 tree-shake。
sprite 方案下一个图标约 200 B，且能按需加载。

| 属性    | 值             | 默认      | 说明                                                                 |
| ------- | -------------- | --------- | -------------------------------------------------------------------- |
| `name`  | 图标名         | —         | 必填，对应 sprite 里的 symbol id                                     |
| `size`  | `sm` `md` `lg` | `md`      | 映射到 `1em` / `1.25em` / `1.5em`，随 `font-size` 缩放               |
| `color` | 同 button      | `current` | `current` 表示继承文字色                                             |
| `label` | 字符串         | —         | 有值时视为有语义图标，设 `aria-label`；无值时加 `aria-hidden="true"` |

| 插槽     | 说明                        |
| -------- | --------------------------- |
| （默认） | 覆盖 `name`，直接放内联 SVG |

```html
<mc-icon name="search"></mc-icon> <mc-icon name="trash" label="删除" color="danger"></mc-icon>
```

---

### mc-card

`packages/card/card.html` · **已实现**

| 属性      | 值                    | 默认      | 说明                                          |
| --------- | --------------------- | --------- | --------------------------------------------- |
| `variant` | `surface` `outline`   | `surface` | 有底色 / 只有描边（两者都有 1px 描边）        |
| `padding` | `none` `sm` `md` `lg` | `md`      | 内边距，映射 `--mc-space-3/4/6`               |
| `divider` | `line` `none`         | `line`    | 头尾分隔线；`none` 只改颜色不改宽度，高度不抖 |

| 插槽                | 说明                                                           |
| ------------------- | -------------------------------------------------------------- |
| （默认）            | 主体内容                                                       |
| `header` / `footer` | 头尾，会自动加分隔线（`divider="none"` 可关）；没内容不占位    |
| `suffix`            | 头部那一行贴右边的附加物（徽标 / 状态 / 小按钮）；有它也算有头 |

| part                            | 说明 |
| ------------------------------- | ---- |
| `base` `header` `body` `footer` |      |

```html
<mc-card variant="outline" divider="none">
  <span slot="header">项目设置</span>
  <span slot="suffix">草稿</span>
  主体内容
  <div slot="footer"><mc-button size="sm">保存</mc-button></div>
</mc-card>
```

**卡片不做交互。** 组件里没有盖层、没有「铺满整卡」、没有 hover / cursor 规则：

- 操作元素（原生 `<a>` / `<button>`）由使用者写在插槽里，站内链接照旧走 `olink`；
- 「整卡可点」如果真需要，是使用者在页面 CSS 里给那个元素铺一条 `::after`。**宿主固定是
  `position: relative`（对外契约）**，就是给那条伪元素当包含块的；配方与三条坑（`inset`
  要按 `--mc-card-border-w` 取负值盖住边框那圈、`cursor` 必须显式写、悬停别给卡片加位移）
  见 `packages/card/page.html` 的「注意事项」。

理由（都实测过）：可点区域等于卡片的盒模型边界，铺满要处理边框那一圈的死区、伪元素上的
`cursor`（WebKit 里 `<a>` 的 cursor 是 `auto`，落在伪元素上解析成箭头）、以及悬停位移带来的
抖动（命中判定走**变换后**的盒子，指针会在边缘反复进出）；这些都是**行为**不是面。
而且「卡内几个动作元素、哪个算整卡动作」只有使用者知道，组件替它挑必然出错。

**明确不加的维度与能力**：`color`（容器不是强调元素，要强调用 L3 令牌）、`size`（高度由内容撑，
密疏用 `padding`）、`media` / `cover` 插槽（图像排版变体太多，插槽自己搭更自由）、
阴影 / elevation（令牌层没有阴影标度，层级靠底色明度差）、`href` 与 `interactive`
（组件造链接与 `olink` 冲突；整卡可点按上面那条交给使用者，组件只保证包含块）。

---

### mc-tag

`packages/tag/tag.html` · **已实现**

分类 / 状态标签。和 `mc-badge` 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互），
tag 是「内容本身」的标签 —— 它才有关闭与选中。

| 属性        | 值                                                      | 默认      | 说明                                                                   |
| ----------- | ------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `color`     | `primary` `info` `success` `warning` `danger` `neutral` | `neutral` | 语义色。默认中性 —— 标签是分类标记，语义色是强调                       |
| `variant`   | `subtle` `solid` `outline`                              | `subtle`  | 浅底深字 / 实心 / 描边（三档都保留 1px 边框，切换时高度不抖）          |
| `size`      | `sm` `md` `lg`                                          | `md`      | 只改字号与左右内边距；高度 = 行高 + 上下内边距 + 边框 = 26 / 30 / 34px |
| `closable`  | 布尔                                                    | —         | 右侧出现 × 按钮（`aria-label="移除"`，命中区 24×24）                   |
| `checkable` | 布尔                                                    | —         | 整块可点，点击切换选中态                                               |
| `selected`  | 布尔                                                    | —         | 选中态（配合 `checkable`）；运行时 `el.selected = true` 立刻生效       |
| `disabled`  | 布尔                                                    | —         | 压暗 50%，不可选也不可关                                               |

| 插槽 / part    | 说明                                               |
| -------------- | -------------------------------------------------- |
| 插槽（默认）   | 标签内容；`checkable` 时它同时是那个按钮的无障碍名 |
| `part="close"` | 关闭按钮（×），单独换色 / 换形状用它               |

| 事件     | 触发                     | `$event.data`  |
| -------- | ------------------------ | -------------- |
| `change` | `checkable` 的选中态变化 | `{ selected }` |
| `close`  | 点了 ×                   | —              |

两个事件都带 `bubbles` + `composed`（可挂在祖先上收全部标签的通知）。

**`selected` 覆盖 `variant`**：选中态统一用该色的实心（`--mc-tag-fill` / `--mc-tag-on-fill`）。
所以可切换的标签用默认 `subtle` 才看得出变化；写死 `variant="solid"` 时选中前后一个样。

**`closable` 只发 `close`，不删 DOM**（组件不改使用者的 DOM，同 `mc-menu` / `mc-breadcrumb`）：
自己在事件里 `el.remove()` 或改数据。可关 + 可选同时开时，× 压在 toggle 层上面（z-index 分开），
点 × 只关不选。

**交互元素都是原生按钮**：`checkable` 是 shadow 里一个铺满宿主的透明 `<button aria-pressed>`
（名字从插槽文本镜像过来），`closable` 的 × 是 `part="close"` 的原生按钮 —— 键盘
<kbd>Space</kbd> / <kbd>Enter</kbd> 可切换，焦点环用 `--mc-color-ring`。

| L3 令牌                 | 默认                            | 作用                                       |
| ----------------------- | ------------------------------- | ------------------------------------------ |
| `--mc-tag-fill`         | 按 `color`                      | `solid` 与选中态的底色                     |
| `--mc-tag-on-fill`      | 按 `color`                      | 实心上的文字色                             |
| `--mc-tag-accent`       | 按 `color`                      | `subtle` 的文字、`outline` 的线与文字      |
| `--mc-tag-subtle-fill`  | 按 `color`                      | `subtle` 的浅底（中性色用 surface-sunken） |
| `--mc-tag-pad-x` / `-y` | `--mc-space-3` / `--mc-space-1` | 左右 / 上下内边距                          |
| `--mc-tag-gap`          | `--mc-space-1`                  | 内容与 × 之间的间距                        |
| `--mc-tag-radius`       | `--mc-radius-md`                | 圆角（全圆角写 `--mc-radius-full`）        |

```html
<mc-tag color="success">已发布</mc-tag>
<mc-tag color="warning" variant="outline" size="sm">待审核</mc-tag>
<mc-tag closable on:close="onTagClose($event)">设计</mc-tag>
<mc-tag checkable selected color="primary" on:change="picked = $event.data.selected">已实现</mc-tag>
```

---

### mc-badge

`packages/badge/badge.html` · M1

| 属性      | 值                         | 默认      | 说明                                |
| --------- | -------------------------- | --------- | ----------------------------------- |
| `color`   | 同 button（无 `neutral`）  | `primary` | 语义色                              |
| `variant` | `solid` `subtle` `outline` | `subtle`  | 徽标默认用浅底，比 solid 更不抢视线 |
| `size`    | `sm` `md`                  | `md`      | 徽标只有两档                        |
| `dot`     | 布尔                       | —         | 只显示一个圆点，不显示内容          |
| `max`     | 数字                       | —         | 数值超过时显示 `max+`               |

```html
<mc-badge>新</mc-badge>
<mc-badge color="danger" variant="solid" :max="99">{{count}}</mc-badge>
<mc-badge dot color="success"></mc-badge>
```

---

### mc-spinner

`packages/spinner/spinner.html` · M1

| 属性    | 值                 | 默认      | 说明                                   |
| ------- | ------------------ | --------- | -------------------------------------- |
| `size`  | `sm` `md` `lg`     | `md`      | 1em / 1.5em / 2em，随 `font-size` 缩放 |
| `color` | `current` 或语义色 | `current` | 默认继承文字色                         |
| `label` | 字符串             | `加载中`  | 屏幕阅读器文案                         |

```html
<mc-spinner></mc-spinner> <mc-spinner size="lg" color="primary" label="正在同步"></mc-spinner>
```

---

### mc-collapse / mc-collapse-item

`packages/collapse/collapse.html` + `packages/collapse/collapse-item.html` · **已实现**

折叠面板，**容器 + 子项**两个标签：容器管外框、尺寸与互斥，子项管自己那格的开合。
开合直接骑在原生 `<details>/<summary>` 上 —— 键盘（<kbd>Enter</kbd> / <kbd>空格</kbd>）、
焦点、收起时内容对 <kbd>Tab</kbd> 与读屏都不可达，全是浏览器给的。

```html
<mc-collapse accordion>
  <mc-collapse-item header="配送与退换">下单后 48 小时内发货</mc-collapse-item>
  <mc-collapse-item header="发票说明" open>电子发票发到下单邮箱</mc-collapse-item>
</mc-collapse>
```

**mc-collapse（容器）**

| 属性        | 值             | 默认 | 说明                                                                    |
| ----------- | -------------- | ---- | ----------------------------------------------------------------------- |
| `accordion` | 布尔           | —    | 手风琴：同一时刻只允许一个子项展开                                      |
| `size`      | `sm` `md` `lg` | `md` | 头部高度 / 内边距 / 字号；只写在这一处，靠 `--mc-collapse-*` 继承给子项 |

| 插槽     | 说明                    |
| -------- | ----------------------- |
| （默认） | 子项 `mc-collapse-item` |

外框（边框 / 圆角 / 底色）在 `:host` 上，`style="border-radius:0"` 直接覆盖；
子项之间的分隔线由容器画（子项自己不带边框）。没有 `part`。

**mc-collapse-item（子项）**

| 属性       | 值     | 默认 | 说明                                                                      |
| ---------- | ------ | ---- | ------------------------------------------------------------------------- |
| `header`   | 字符串 | —    | 头部文案。富内容用同名的 `header` 插槽                                    |
| `name`     | 字符串 | —    | 标识；`open` / `close` 事件的 `$event.data.name`                          |
| `open`     | 布尔   | —    | 展开状态。**既是初始值也是运行时状态**，会反射回宿主属性                  |
| `disabled` | 布尔   | —    | 点不动、<kbd>Tab</kbd> 跳过、读屏可感知（原生 `<details>` 没有 disabled） |

| 插槽 / part     | 说明                                       |
| --------------- | ------------------------------------------ |
| 插槽 `header`   | 头部内容，给了就覆盖 `header` 属性的纯文本 |
| 插槽（默认）    | 面板内容                                   |
| `part="header"` | 头部（内部那个原生 `summary`）             |
| `part="body"`   | 内容区                                     |

| 事件    | 触发                   | `$event.data` |
| ------- | ---------------------- | ------------- |
| `open`  | 展开时在**子项**上触发 | `{ name }`    |
| `close` | 收起时在**子项**上触发 | `{ name }`    |

两个事件都带 `bubbles` + `composed`：挂在子项上收自己的，挂在容器上收全部子项的通知。

```js
// 运行时状态用 property，立刻生效（内部不等 ofa 那一拍，见 P4）
item.open = true;
item.setAttribute('open', ''); // 等价，但异步一拍
```

> ⚠️ 属性叫 **`header`** 而不是 `title`：`title` 是全局 HTML 属性，
> 写在宿主上浏览器会在悬停时弹一个原生 tooltip（[P32](./ofa-pitfalls.md) 还会把它反射出来）。

| L3 令牌                  | 说明                                       |
| ------------------------ | ------------------------------------------ |
| `--mc-collapse-header-h` | 头部高度（容器按 `size` 赋值，继承进子项） |
| `--mc-collapse-pad-x`    | 头部 / 内容左右内边距                      |
| `--mc-collapse-body-pad` | 内容区底部内边距                           |
| `--mc-collapse-font`     | 头部 / 内容字号                            |

> ⚠️ 子项**不能**给这些变量写默认值：在 `:host` 上定义会盖掉从容器继承来的值，
> 容器上的 `size` 就永远不生效。子项侧一律写成 `var(--mc-collapse-header-h, 兜底)`。

---

### mc-menu / mc-menu-item

`packages/menu/menu.html` + `packages/menu/menu-item.html` · **已实现**

垂直菜单，**容器 + 菜单项**两个标签，够撑起文档站那种侧栏导航。

**交互元素由使用者写在插槽里**（原生 `<a>` / `<button>`），组件不造链接、也不改使用者的
DOM：站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板（light DOM）里的
元素，shadow root 里造的 `<a>` 用不上（[P28](./ofa-pitfalls.md)、[`docs/routes.js`](../docs/routes.js)）。
代价是**状态也必须写在使用者的元素上**，组件只按属性给外观：

```html
<mc-menu>
  <mc-menu-item><a href="#/packages/button/page.html" aria-current="page">Button</a></mc-menu-item>
  <mc-menu-item><a href="#/packages/code/page.html">Code</a></mc-menu-item>
  <mc-menu-item group>布局</mc-menu-item>
  <mc-menu-item><a href="#/packages/collapse/page.html">Collapse</a></mc-menu-item>
</mc-menu>
```

**mc-menu（容器）**

| 属性      | 值                | 默认    | 说明                                                |
| --------- | ----------------- | ------- | --------------------------------------------------- |
| `size`    | `sm` `md` `lg`    | `md`    | 项高 / 内边距 / 字号；靠 `--mc-menu-*` 继承给菜单项 |
| `variant` | `plain` `surface` | `plain` | `surface` 加边框底色，当卡片用；`plain` 无外框      |

| 插槽 / part   | 说明                          |
| ------------- | ----------------------------- |
| 插槽（默认）  | 菜单项 `mc-menu-item`         |
| `part="list"` | 内层列表容器（项间距 / 布局） |

列表语义在容器上：`.mc-list` 是 `role="list"`，菜单项的 `role="listitem"` 由
**菜单项自己**补（`attached()` 里写，[P31](./ofa-pitfalls.md) 不允许在构造期往宿主写属性）；
使用者自己给 `mc-menu-item` 写了 `role` 就不覆盖。

**mc-menu-item（菜单项）**

| 属性    | 值   | 默认 | 说明                                       |
| ------- | ---- | ---- | ------------------------------------------ |
| `group` | 布尔 | —    | 分组标题行：纯文字、不可交互、不进列表语义 |

| 状态   | 写法                                                          | 组件做什么                                 |
| ------ | ------------------------------------------------------------- | ------------------------------------------ |
| 当前项 | 插槽元素上 `<a aria-current="page">`                          | 换底色字色 + 字重加粗（`false` 等于没写）  |
| 悬停   | 不用写                                                        | 整行浅底                                   |
| 禁用   | `<button disabled>`；`<a aria-disabled="true">` 并去掉 `href` | 压暗 50% + `cursor: not-allowed`，悬停不亮 |

**没有 `disabled` 属性**：链接原生就没有 disabled，组件又不改使用者的 DOM，
与其半吊子地「视觉禁用但键盘仍能激活」，不如把禁用写在原生元素上（`disabled` /
去掉 `href`）。同理**没有 `part`**：行盒子就在 `mc-menu-item` 自己身上。

组件把插槽元素的两个状态读出来、镜像成宿主属性，**这两个钩子可以直接拿来写外部样式**：

| 宿主钩子          | 什么时候有                                     |
| ----------------- | ---------------------------------------------- |
| `[data-current]`  | 插槽元素上 `aria-current` 不是 `false`         |
| `[data-disabled]` | 插槽元素 `disabled`，或 `aria-disabled="true"` |

> ⚠️ **行盒子（高度 / 内边距 / 底色 / 缩进）为什么在宿主上、不在插槽元素上**：
> 插槽元素同时是外层 shadow 树里的普通元素，`shadow-base.css` 对 `button` 的
> `padding` / `background` / `cursor` reset 是「直接命中」，按封装上下文压过组件内的
> `::slotted(button)`；`:host(:has(...))` 在 ofa.js 里又不生效，宿主「看不到孩子」。
> 所以视觉留宿主、插槽元素只当铺满整行的交互层、状态靠 JS 镜像 —— 完整推演见
> [P33](./ofa-pitfalls.md)，实现见 `packages/menu/menu-item.html` 头部注释。
> 副作用：禁用项若用 `<button>`，光标可能仍是手型（reset 那一条压不过），用 `<a>` 正常。

| L3 令牌                        | 默认                        | 作用                |
| ------------------------------ | --------------------------- | ------------------- |
| `--mc-menu-item-h`             | `--mc-control-h-md`         | 项高（`size` 改它） |
| `--mc-menu-pad-x`              | `--mc-space-4`              | 左右内边距          |
| `--mc-menu-font`               | `--mc-text-sm`              | 字号                |
| `--mc-menu-gap`                | `--mc-space-1`              | 项间距              |
| `--mc-menu-radius`             | `--mc-radius-md`            | 行圆角              |
| `--mc-menu-item-color`         | `--mc-color-fg-muted`       | 普通项文字          |
| `--mc-menu-item-color-hover`   | `--mc-color-fg`             | 悬停文字            |
| `--mc-menu-item-color-current` | `--mc-color-primary`        | 当前项文字          |
| `--mc-menu-item-bg-hover`      | `--mc-color-surface-sunken` | 悬停底色            |
| `--mc-menu-item-bg-current`    | `--mc-color-primary-subtle` | 当前项底色          |
| `--mc-menu-group-color`        | `--mc-color-fg-subtle`      | 分组标题文字        |

> ⚠️ 菜单项同样**不能**给 `--mc-menu-*` 写默认值，否则会盖掉容器继承来的通道
> （和 `mc-collapse-item` 同一条坑），消费侧一律 `var(--mc-menu-x, 兜底)`。

### mc-breadcrumb / mc-breadcrumb-item

```html
<mc-breadcrumb separator="/" label="面包屑">
  <mc-breadcrumb-item><a href="/components">组件</a></mc-breadcrumb-item>
  <mc-breadcrumb-item><a href="/components/base">基础</a></mc-breadcrumb-item>
  <mc-breadcrumb-item current>Button</mc-breadcrumb-item>
</mc-breadcrumb>
```

**mc-breadcrumb（容器）**

| 属性        | 值     | 默认     | 说明                                                                   |
| ----------- | ------ | -------- | ---------------------------------------------------------------------- |
| `separator` | 字符串 | `/`      | 级与级之间的分隔符；非默认值优先于 `--mc-breadcrumb-sep`（空值按默认） |
| `label`     | 字符串 | `面包屑` | `<nav>` 的无障碍名（英文站写 `label="Breadcrumb"`）                    |

| 插槽 / part   | 说明                        |
| ------------- | --------------------------- |
| 插槽（默认）  | 每一级 `mc-breadcrumb-item` |
| `part="base"` | 内层 `<nav>`                |
| `part="list"` | 内层 `<ol>`                 |

**mc-breadcrumb-item（一级）**

| 属性      | 值   | 默认 | 说明                                                                    |
| --------- | ---- | ---- | ----------------------------------------------------------------------- |
| `current` | 布尔 | —    | 当前页（最后一级）：字色更实 + 字重加重，并自动补 `aria-current="page"` |

**每一级的交互元素由使用者写在插槽里**（原生 `<a>`），组件不造链接 —— 与 `mc-menu`
同一条理由：站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板里的元素。
当前页写纯文本 + `current`。列表语义：容器渲染 `<nav>` + `<ol role="list">`，
每一级的 `role="listitem"` 由组件补（使用者自己写了 `role` 就不覆盖）。

**没有 `size` / `variant`**：面包屑是一行文字导航，这两档不成立；改字号直接覆盖容器的
`font-size`。**不承诺插槽里放 `<button>`** —— 页面 reset 对 `button` 的优先级压过组件内的
`::slotted()`（[P33](./ofa-pitfalls.md)），要可点的级就用 `<a>`。
同理，**宿主页面对 `a` 的颜色规则也压过 `::slotted(a)`**：页面里写了 `a { color: … }` 时
`--mc-breadcrumb-item-color` / `--mc-breadcrumb-item-color-hover` 都管不到链接色（悬停只剩组件加的下划线）
—— 链接色最终由页面的链接样式决定。要精确控制就写一条特异性不低于页面 `a` 规则的页面样式。

| L3 令牌                            | 默认                   | 作用                             |
| ---------------------------------- | ---------------------- | -------------------------------- |
| `--mc-breadcrumb-sep`              | `'/'`                  | 分隔符（CSS 字符串，要带引号）   |
| `--mc-breadcrumb-sep-color`        | `--mc-color-fg-subtle` | 分隔符颜色                       |
| `--mc-breadcrumb-gap`              | `--mc-space-2`         | 级间距（也是分隔符与文字的间距） |
| `--mc-breadcrumb-item-color`       | `--mc-color-fg-muted`  | 普通一级的文字                   |
| `--mc-breadcrumb-item-color-hover` | `--mc-color-fg`        | 悬停文字                         |
| `--mc-breadcrumb-current-color`    | `--mc-color-fg`        | 当前页文字                       |

> ⚠️ `separator` 属性与 `--mc-breadcrumb-sep` 令牌走**两条通道**：属性落到宿主上一个内部变量
> （`--mc-breadcrumb-sep-attr`），CSS 里是 `content: var(内部变量, var(--mc-breadcrumb-sep))`。
> 让属性直接写 `--mc-breadcrumb-sep` 会把使用者写在 `style` 上的令牌一起抹掉（实测踩过）。

---

## 四、M2 组件（接口已定，实现待做）

> 这一批会大量撞上 [`ofa-pitfalls.md`](./ofa-pitfalls.md) 的 P6 / P18 / P19 / P20
> （值的反射、`change` 事件穿透、点击外部判定）。开工前先把那四条读一遍。

### 表单控件共用约定

| 属性                                       | 说明                   |
| ------------------------------------------ | ---------------------- |
| `name`                                     | 表单字段名             |
| `value` / `default-value`                  | 运行时值 / HTML 初始值 |
| `disabled` `readonly` `required` `invalid` | 状态布尔               |
| `size`                                     | `sm` `md` `lg`         |
| `placeholder`                              | 占位符                 |

| 事件             | 说明                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `input`          | 每次输入，`$event.data.value`                                                                    |
| `change`         | 值确定变化（**组件内部已把原生 `change` 转发为 `composed: true`**，见 [P19](./ofa-pitfalls.md)） |
| `focus` / `blur` | 原生事件，已穿透                                                                                 |

**校验态不用独立的错误色板**，用 `invalid` 布尔 + `--mc-color-danger`。

### 各组件要点

| 组件                          | 关键属性                                                                             | 关键插槽 / part                             |
| ----------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| `mc-input`                    | `type` `clearable` `maxlength` `prefix`/`suffix` 文本                                | `prefix` `suffix` 插槽；`input` part        |
| `mc-textarea`                 | 同 input + `rows` `auto-resize` `maxlength` + 字数统计                               | 同 input                                    |
| `mc-checkbox`                 | `checked` / `default-checked` `indeterminate` `value`                                | 默认插槽为标签文案                          |
| `mc-radio` + `mc-radio-group` | group 上用 `value` `default-value` `name` `direction`；radio 上用 `value` `disabled` | 默认插槽为标签文案                          |
| `mc-switch`                   | `checked` / `default-checked` `disabled` `size`                                      | —                                           |
| `mc-select` + `mc-option`     | select 上 `value` `multiple` `placeholder` `clearable`；option 上 `value` `disabled` | `option` part；弹层 `panel` part            |
| `mc-alert`                    | `color` `variant` `title` `closable` `icon`                                          | `title` `description` 插槽                  |
| `mc-progress`                 | `value` `max` `indeterminate` `color` `size`                                         | `bar` part；`aria-valuenow` 齐全            |
| `toast()`                     | 命令式函数，返回 `{ close }`，对齐原生语义                                           | `toast(msg, { color, duration, position })` |

`mc-select` 是 M2 里最复杂的一个：它要处理浮层定位、点击外部关闭（**必须用 `composedPath()`**，
[P20](./ofa-pitfalls.md)）、键盘导航、以及消费 `o-fill` 渲染出来的 option
（[P12](./ofa-pitfalls.md)）。建议留出充足的实现时间。

---

## 五、M3 组件（接口草案）

> ⚠️ **M3 开工前必须先验证图层问题**：shadow DOM 里的 `position: fixed` + `z-index`
> 与宿主页面层叠上下文的关系。宿主页面上的 `transform` / `filter` / `contain`
> 会创建新的层叠上下文，可能把 shadow root 内的浮层困住。
> 验证后再决定是继续用 `position: fixed`，还是改用 popover API，还是挂载到 `document.body`。
> 详见 [`design-spec.md` 第七节](./design-spec.md#七层级)。

| 组件                           | 关键属性                                                                                                  | 关键插槽                        | 关键 part                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------ |
| `mc-dialog`                    | `open` / `default-open` `title` `closable` `mask-closable` `size`                                         | `header` `footer`（默认为主体） | `overlay` `panel` `header` `body` `footer` |
| `mc-dropdown` + `mc-menu-item` | dropdown 上 `open` `placement` `trigger`；item 上 `value` `disabled` `danger`                             | `trigger` 插槽                  | `panel`                                    |
| `mc-tooltip`                   | `content` `placement` `trigger` `delay`                                                                   | 默认插槽为触发元素              | `panel`                                    |
| `mc-tabs` + `mc-tab`           | tabs 上 `value` `default-value`；tab 上 `value` `disabled`                                                | tab 的默认插槽为标签文案        | `list` `panel` `indicator`                 |
| `mc-table`                     | `columns` `data`（JSON property，见 [P6](./ofa-pitfalls.md)）`striped` `hoverable` `loading` `empty-text` | `empty` `loading`               | `table` `row` `cell`                       |
| `mc-grid` + `mc-grid-item`     | grid 上 `cols` `gap` `min-item-width`；item 上 `span`                                                     | —                               | —                                          |

`mc-table` 的 `columns` / `data` 是**对象**，必须通过 property 传，
不能写成标签属性（会被 JSON 序列化，[P6](./ofa-pitfalls.md)）：

```html
<mc-table id="t"></mc-table>
<script type="module">
  document.querySelector('#t').columns = [{ key: 'name', title: '姓名' }];
  document.querySelector('#t').data = [{ name: '张三' }];
</script>
```
