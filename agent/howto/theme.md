# 怎么给一个应用（站点 / 后台）统一改主题色

> **这是食谱**：三层令牌、层序、使用禁忌的规矩在 [`../design-tokens.md`](../design-tokens.md)；
> 这里只讲「换主题色」按范围该动哪一处、怎么验证。

---

## 先按范围选一条路

| 你要改的                       | 走哪条                                                                | 生效范围                          |
| ------------------------------ | --------------------------------------------------------------------- | --------------------------------- |
| 整个品牌色（6 个色族一起）     | 改 `tools/gen-tokens.mjs` 的 `HUES` → `pnpm tokens && pnpm build:css` | 生成的 `packages/boot/mosaic.css` |
| 只换主色（其余色族不动）       | 入口样式表里覆盖 L2 的 primary 五件套 + 焦点环                        | 所有组件的 primary                |
| 只改某一类组件                 | `mc-button { --mc-button-fill: …; }`                                  | 该类组件的每个实例                |
| 只改某一个实例                 | 元素上 `style="--mc-button-fill: …"`                                  | 那一个实例                        |
| 改组件**内部结构**（不是颜色） | `::part(名字)` —— **逐组件名录**，见该组件 `api.md` 的「插槽与 part」 | 该组件已开的 part                 |

⚠️ 在 `:root` 上写 **L3**（`--mc-button-fill`）**不生效**：组件自己的 `:host` 声明过它，继承值打不过元素上的声明。L3 是给「单个实例 / 某一类组件」用的。

---

## 只换主色：覆盖 L2 的 primary 色族

令牌只在 `:root` 上、靠自定义属性继承进每个 shadow root，所以**一段就够**。放进应用的入口样式表（未分层 → 必定赢过 `@layer mosaic.tokens`，不用 `!important`、不用管加载顺序）：

```css
:root {
  --mc-color-primary: 5 150 105; /* 填充色，同时也是文字色 */
  --mc-color-primary-hover: 4 120 87;
  --mc-color-primary-active: 6 95 70;
  --mc-color-primary-subtle: 236 253 245; /* 极浅底：提示条 / 标签 */
  --mc-color-primary-fg: 255 255 255; /* 压在填充色上的文字 */
  --mc-color-ring: 16 185 129; /* 焦点环（亮色比填充浅一档） */
}

[data-theme='dark'] {
  --mc-color-primary: 110 231 183; /* 暗色反过来：浅填充 + 近黑文字 */
  --mc-color-primary-hover: 167 243 208;
  --mc-color-primary-active: 209 250 229;
  --mc-color-primary-subtle: 2 44 34;
  --mc-color-primary-fg: 4 6 12; /* = neutral-950 */
  --mc-color-ring: 52 211 153;
}

/* 不写 data-theme、跟随系统的那一态也要覆盖，否则「自动」下还是旧色 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --mc-color-primary: 110 231 183;
    --mc-color-primary-hover: 167 243 208;
    --mc-color-primary-active: 209 250 229;
    --mc-color-primary-subtle: 2 44 34;
    --mc-color-primary-fg: 4 6 12;
    --mc-color-ring: 52 211 153;
  }
}
```

六个令牌的分工见 [`../design-tokens.md`](../design-tokens.md) §三：`-fg` 是压在填充上的文字、`-subtle` 是极浅底、`-hover` / `-active` 各进一档（亮色加深，暗色反过来）。

---

## 连六个色族一起换：改生成器

手写整套色阶几乎不可能同时满足感知均匀与对比度达标，所以走生成器：

**1. 改 `tools/gen-tokens.mjs` 的 `HUES`**（每个色族一组 `hue` / `cmax`）。

**2. 重算 + 重建**：

```bash
pnpm tokens        # 重算 6 色族 × 11 档 + 34 项对比度自检，不达标退出 1
pnpm build:css     # 重新生成 packages/boot/mosaic.css（令牌 + 工具类）
```

**3. `packages/color/tokens.css` 与 `packages/boot/mosaic.css` 都是生成物、且提交进仓库** —— 别手改，`pnpm check:drift` 会打回。

---

## 验证

```bash
pnpm tokens        # 对比度自检：34 项任一不达标就退出 1
pnpm check:tokens  # 产物是不是源码生成的（手改过 tokens.css 会被这条抓）
pnpm check:docs    # 令牌账：代码里的令牌 README 写了没、README 写的代码有没有
```

页面里再扫一眼三种主题态（跟随系统 / `<html data-theme="light">` / `data-theme="dark"`）：

```js
getComputedStyle(document.documentElement).getPropertyValue('--mc-color-primary'); // 应该是你的三元组
```

---

## 这一步最容易踩的

- **只改 `--mc-color-primary` 一个** → `-hover` / `-active` / `-subtle` / `--mc-color-ring` 还是老色，一悬停就露馅
- **令牌里写颜色而不是三元组**（`#10b981` / `rgb(16 185 129)`）→ 全链路是 `rgb(var(--x))`，**静默失效**
- **漏掉暗色 / 跟随系统那一态** → 切到暗色或自动模式还是旧色（上面三段要覆盖齐）
- **在 `:root` 上覆盖 L3 令牌** → 组件 `:host` 自己声明过，不生效；L3 写宿主元素 / 元素选择器
- **手改 `packages/color/tokens.css`** → 生成物 + 提交进仓库，`pnpm check:drift` 打回；改 `HUES` 重跑
- **`::part()` 选不中不报错** —— 只对组件真的开过的 part 生效（`mc-button` 一个都没开：形状走宿主 `style`、颜色走令牌），名录见该组件 `api.md`
- 用 JS 在运行时切主题会有一拍闪烁（首帧先无色再变色）—— [P25](../pitfalls/06-platform.md)
- 焦点环是独立令牌，别指望它跟着 `color` 走；指示色也不能用 `currentColor` —— [P16](../pitfalls/03-style-scope.md)
