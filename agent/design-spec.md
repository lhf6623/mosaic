# Mosaic 设计规范

> [`design-tokens.md`](./design-tokens.md) 定义**有什么值**，本文定义**什么时候用哪个值**。
> 两者合起来才是完整的设计系统：令牌是词汇表，规范是语法。
>
> 本文的规则是**可执行**的 —— 每条都应该能在 code review 里判定对错，
> 不写「尽量保持一致」这种没法验收的话。

---

## 一、间距节奏

**基准单位 4px**，所有间距令牌都是它的整数倍（见 [design-tokens.md](./design-tokens.md#排版--间距--圆角--控件--动效--层级)）。
不允许出现 `padding: 7px` 这种脱离标度的值。

| 场景 | 令牌 | 值 |
|---|---|---|
| 图标与紧邻文字 | `--mc-space-2` | 8px |
| 标签内的行间 | `--mc-space-1` | 4px |
| 按钮内边距（md） | `--mc-space-4` | 16px |
| 同一组内的控件之间 | `--mc-space-2` | 8px |
| 表单行之间 | `--mc-space-4` | 16px |
| 卡片 / 面板内边距 | `--mc-space-6` | 24px |
| 卡片之间 | `--mc-space-4` | 16px |
| 页面区块之间 | `--mc-space-8` | 32px |
| 页面分节之间 | `--mc-space-12` | 48px |

**规则：**

1. **纵向间距一律用 `gap`，不用 `margin`。** margin 折叠会让间距在嵌套时突然变小，
   而且组件无法知道自己外面被包了什么。容器负责排布，子元素不写 `margin-top/bottom`。
2. **`--mc-space-1`（4px）只用于"紧贴"关系**（图标与角标、标签内的行），
   不作为常规内容间距 —— 相邻内容的间距从 8px 起步。
3. **同级元素间距必须一致。** 一组按钮之间是 `gap-2`，那这一组里就不能混 `gap-4`。
4. 组件**不对外部间距负责**。`mc-button` 不写 `margin`，
   使用者在外面用 `gap` 或 `class="mt-4"` 控制。

---

## 二、布局

### 用什么

| 需求 | 用什么 |
|---|---|
| 一行排列 | `flex items-center gap-*` |
| 等分 | `grid grid-cols-N gap-*` |
| 两端对齐 | `flex justify-between` |
| 纵向堆叠 | `flex flex-col gap-*` |
| 撑满剩余 | `flex-1 min-w-0` ← `min-w-0` 不能省，否则内容会撑破容器 |

**不引入栅格系统（12 列 / 24 列）。** 栅格在有构建工具、有布局语言的项目里能降低沟通成本，
但这里 `flex` + `gap` + `grid-cols-*` 已经覆盖全部需求，引入栅格只是多一层需要记忆的抽象。
如果确实需要，用 `grid grid-cols-12` + `col-span-*`（已在精选子集里）。

### 内容宽度

**正文行宽上限约 75 个西文字符 / 36 个汉字**，超过就换行困难、回扫丢行。
长文容器请限制宽度：

```html
<article class="max-w-full text-base">…</article>
<style>article { max-width: 68ch; }</style>
```

表单类界面不受此限（行宽本来就被控件约束）。

---

## 三、响应式

### 断点

与 UnoCSS 默认标度一致，**移动优先**（`md:flex` 意思是"≥768px 时 flex"）：

| 前缀 | 最小宽度 | 典型设备 |
|---|---|---|
| （无） | 0 | 手机竖屏 |
| `sm:` | 640px | 手机横屏 |
| `md:` | 768px | 平板竖屏 |
| `lg:` | 1024px | 平板横屏 / 小笔记本 |
| `xl:` | 1280px | 桌面 |

### 两条硬规则

**规则一：媒体查询在 shadow DOM 里是有效的，可以放心用。**

这点和 `dark:` 变体完全不同，值得说清楚为什么：

| | 生成的 CSS | 在 shadow root 内 |
|---|---|---|
| `dark:bg-black` | `.dark .dark\:bg-black` —— **后代选择器** | ❌ `<html class="dark">` 在 shadow 树外，匹配不到 |
| `md:flex` | `@media (min-width:768px){ .md\:flex }` —— **媒体查询** | ✅ 媒体查询不依赖祖先，正常工作 |

所以组件内部**可以**用 `@media` 和 `md:` / `lg:` 变体写响应式。
（但见规则二。）

**规则二：组件内部的响应式优先用容器查询（`@container`），不是媒体查询。**

组件不知道使用者把它放在了多宽的容器里 —— 侧边栏里的卡片和主区域里的卡片
在同一个视口宽度下，可用宽度差好几倍。媒体查询按**视口**判断，会给出错误的结果。

```css
/* ❌ 视口宽 ≠ 我有多宽 */
@media (min-width: 768px) { :host { flex-direction: row; } }

/* ✅ 按我实际拿到的宽度 */
:host { container-type: inline-size; }
@container (min-width: 400px) {
  :host { flex-direction: row; }
}
```

**规则三：精选工具类子集里的响应式变体是有限的。**
当前只包含 `md:` / `lg:` 下的 `block` / `hidden` / `flex` / `grid-cols-2..4` / `flex-row` / `w-auto`。
其余组合（`sm:mt-4`、`xl:grid-cols-6`…）**不存在**，需要时自己写 CSS。

理由：`断点 × 工具类` 是组合爆炸（5 × 350 = 1750 条），而实际布局里 90% 的响应式需求
就是「窄屏堆叠 / 宽屏并列」和「窄屏隐藏」。**这个边界要提前知道。**

---

## 四、排版

### 字号层级 → 用途

| 令牌 | 字号 / 行高 | 用途 |
|---|---|---|
| `--mc-text-xs` | 12 / 16 | 辅助说明、角标、表格内的次要列 |
| `--mc-text-sm` | 14 / 20 | **界面正文默认值**：表单、按钮、列表、卡片正文 |
| `--mc-text-base` | 16 / 24 | 长文正文（超过 3 行连续文字时用它） |
| `--mc-text-lg` | 18 / 28 | 小标题、卡片标题 |
| `--mc-text-xl` | 20 / 28 | 区块标题 |
| `--mc-text-2xl` | 24 / 32 | 页面标题 |
| `--mc-text-3xl` | 30 / 36 | 展示型大标题（每个页面最多一个） |

**规则：**

1. **界面默认 `text-sm`，长文默认 `text-base`。** 不要因为"看起来小"就把界面文字调到 16px——
   `14px` 是中文界面在 1x 屏上的成熟默认值，行高 20px 保证了两行之间不挤。
2. **字重只用 400 / 500 / 600。** `700` 只用于数字展示（金额、计数），
   中文在 700 下笔画会糊。
3. **不跳级。** 页面标题 `2xl`、区块 `xl`、卡片 `lg`，不要从 `2xl` 直接跳到 `sm`。
4. **行高跟着字号走，用配对的 `-lh` 令牌**，不要单独写 `line-height`。

### 中文排版

- 标点用**全角**（`，。：；！？`），不要用半角加空格模拟
- 中西文混排**不加空格**（交给 font-family 的字体回退处理，令牌里已配置中文回退栈）
- 数字与英文用 `--mc-font-mono` 的场景：代码、ID、需要对齐的数字列
- **不要用 `text-align: justify`** —— 中文两端对齐会在字间拉出难看的空隙

---

## 五、交互状态

这是整套规范里最需要统一的部分：同一个状态在不同组件里的表现必须一致，
否则整个库看起来像拼装的。

### 状态全集

| 状态 | 触发条件 | 统一表现 |
|---|---|---|
| **default** | — | 令牌定义的默认外观 |
| **hover** | 指针悬停，且 `disabled` / `loading` 时**不响应** | state layer 覆盖 8% `currentColor` |
| **active** | 按下 | state layer 覆盖 12% `currentColor` |
| **focus-visible** | **键盘**聚焦（`Tab` / 方向键） | `outline: 2px solid rgb(var(--mc-color-ring)); outline-offset: 2px` |
| **disabled** | `disabled` 属性存在 | `opacity: .5` + `cursor: not-allowed` + 不响应 hover/active |
| **loading** | `loading` 属性存在 | 同 disabled，另显示 spinner，且**保留原宽度**（不要让它跳动） |
| **readonly** | `readonly` 属性存在 | 外观同 default，但底色用 `--mc-color-surface-sunken`，光标为文本 |
| **invalid** | `invalid` 属性存在 | 边框/描边 `--mc-color-danger`，配 `aria-invalid="true"` |
| **selected** | 选中态（tab / option / 列表项） | `bg: --mc-color-primary-subtle`，文字 `--mc-color-primary` |

### state layer：用 `currentColor` 而不是新令牌

M3 的做法，很值得抄：hover / active 的叠加层用**当前文字色**的半透明版本。

```css
.mc-layer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  pointer-events: none;
}
:host(:hover) .mc-layer { opacity: 0.08; }
:host(:active) .mc-layer { opacity: 0.12; }
```

好处是**自动与任意配色协调**：不管按钮是 primary 还是 danger、
不管当前是亮色还是暗色主题，叠加层都是对的，一个额外令牌都不用加。

注意 `.mc-layer` 必须 `pointer-events: none`，且**层级要低于承载点击的原生元素**。

### 焦点环规则

1. **焦点环必须可见**，不允许 `outline: none` 而不给替代方案。
2. **不要用 `currentColor`** —— filled 按钮的文字是白的，白圈画在浅色页面上完全看不见。
   用 `--mc-color-ring`（[P16](./ofa-pitfalls.md)）。
3. `offset: 2px`，让环与元素之间有缝隙，形状更清楚。
4. 用 `:focus-visible` 而不是 `:focus` —— 鼠标点击不该出现焦点环。

### 触控目标尺寸

| 标准 | 最小值 | 说明 |
|---|---|---|
| WCAG 2.2 AA（2.5.8） | 24 × 24 px | 底线 |
| Mosaic 要求 | **32 × 32 px** | 图标按钮、勾选框、开关等小控件的下限 |
| 推荐（移动优先场景） | 44 × 44 px | 主要操作按钮 |

`--mc-control-h-sm` 是 28px，**低于 32px 下限**——所以 `size="sm"` 只允许用在
鼠标为主的密集界面（表格行内、工具条），不要用在移动端主操作上。

---

## 六、动效

### 时长选择

| 场景 | 令牌 | 值 |
|---|---|---|
| 颜色 / 背景 / 边框变化 | `--mc-duration-fast` | 120ms |
| 展开收起、位移、缩放 | `--mc-duration-base` | 180ms |
| 弹层进入 / 退出 | `--mc-duration-slow` | 280ms |

**规则：**

1. **只动 `transform` / `opacity` / `color` 系属性。**
   它们不触发重排，走合成层。动 `width` / `height` / `top` / `left` 会每帧重排。
2. **高度过渡类组件（collapse / accordion）默认 `transition-duration` 必须是 0s**，
   只在用户切换时临时启用；否则 `ResizeObserver` 跟随内容高度的每次更新也会被动画化，
   嵌套时会出现"外层追内层"的追帧现象（[P32](./ofa-pitfalls.md)）。
3. **进入用 `--mc-ease-emphasized`，其余一律 `--mc-ease-standard`。**
   不要把 `emphasized` 用在 hover 上——它有过冲，小范围变化会显得抖。
4. **动效不是装饰。** 如果一个动画不帮助用户理解"什么变了、从哪来、到哪去"，就不要加。

### 减弱动效

`shadow-base.css` 已经在 `prefers-reduced-motion: reduce` 下把所有 `--mc-duration-*`
统一压到 `1ms`。**组件只要用令牌写时长就自动合规**，不需要各自写媒体查询。
这也是不允许在组件里写死 `transition: .3s` 的原因之一。

---

## 七、层级

用令牌，不要自己写数字：

| 令牌 | 值 | 用途 |
|---|---|---|
| `--mc-z-dropdown` | 1000 | 下拉菜单、选择器弹层 |
| `--mc-z-sticky` | 1100 | 吸顶工具栏 |
| `--mc-z-overlay` | 1200 | 遮罩 |
| `--mc-z-modal` | 1300 | 对话框 |
| `--mc-z-popover` | 1400 | 点击弹出的浮层 |
| `--mc-z-toast` | 1500 | 消息条 |
| `--mc-z-tooltip` | 1600 | 提示（永远在最上） |

**规则：**

1. **只允许用令牌**，不允许 `z-index: 9999`。层级是全局资源，随手写会打架。
2. **组件内部不要再造新的层级语义。** 如果觉得需要，"组件相对于彼此的层级"
   才用上面这张表。
3. ⚠️ **`z-index` 管不了 shadow 边界。** 宿主页面上的 `transform` / `filter` / `contain`
   会创建新的层叠上下文，把 shadow root 里的 `position: fixed` 困在里面。
   M3 的浮层组件开工前必须先验证这一点（见 [PLAN.md 里程碑 M3](./PLAN.md#m3--浮层与布局)）。

---

## 八、无障碍

### 对比度

由令牌层强制保证，32 项自检见 [design-tokens.md](./design-tokens.md#四对比度自检)。
**组件不得绕过令牌直接写颜色** —— 那等于放弃了这套保证。

### 键盘

| 要求 | 落地 |
|---|---|
| 全部功能可仅用键盘完成 | 可交互元素必须是原生 `<button>` / `<input>` / `<select>` / `<a>`，不要用 `<div on:click>` |
| 激活 | `Enter` / `Space`（原生元素自带） |
| 关闭弹层 | `Esc`（必须实现） |
| 焦点陷阱 | 模态弹层打开时，`Tab` 循环必须留在弹层内 |
| 焦点归还 | 弹层关闭后，焦点必须回到打开它的那个元素 |
| 焦点顺序 | 与视觉顺序一致，不要用 `tabindex` 正数调整顺序 |

### ARIA

- **优先用原生语义**，`<button>` 不需要 `role="button"`。只有在没有对应原生元素时才用 ARIA。
- 图标按钮必须有 `aria-label`；纯装饰的 SVG 加 `aria-hidden="true"`。
- 校验失败时加 `aria-invalid="true"`，并用 `aria-describedby` 关联错误文案（不要让用户靠颜色判断）。
- 动态内容（toast、加载完成）用 `aria-live="polite"` 通知屏幕阅读器。
- **不要用 `aria-label` 覆盖已经可见的文案** —— 会造成语音控制和屏幕阅读器的用词不一致。

---

## 九、文案

| 场景 | 规则 | 例 |
|---|---|---|
| 按钮 | **动词开头**，说清楚做什么 | ✅ `保存修改` ❌ `确定` |
| 破坏性操作 | 说明后果，且按钮文案就是动作本身 | ✅ `删除 3 项` ❌ `是` |
| 错误信息 | 说**怎么修**，不只说哪里错 | ✅ `密码至少 8 位` ❌ `密码无效` |
| 空状态 | 必须有下一步引导，不能只说"暂无数据" | ✅ `还没有项目，创建一个开始吧` |
| 加载中 | 用具体动作，不用"加载中" | ✅ `正在保存…` ❌ `请稍候` |
| 标点 | 中文全角，句末不加句号（短语级 UI 文案） | ✅ `保存修改` ❌ `保存修改。` |
| 数字与单位 | 数字与单位之间不加空格 | ✅ `8px` ❌ `8 px` |

**长度约束**：按钮文案不超过 6 个汉字；标签不超过 8 个汉字。
超了说明这个操作该拆，或者该用图标 + 提示。
