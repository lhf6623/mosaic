# 怎么给组件一个任意色（hex / 品牌色）

> **这是食谱**：三层令牌、层序、使用禁忌的规矩在 [`../design-tokens.md`](../design-tokens.md)；
> 整站换主题色在 [`theme.md`](./theme.md)。这份只回答一件事：**手上有 `#fff000`，怎么落到组件上**。
> `color` 为什么现在收 hex、代价是什么，见 [`../plan/decisions.md`](../plan/decisions.md) 的 D8。

---

## 先按范围选一条路

| 你要改的                                | 怎么写                                        | 生效范围                           |
| --------------------------------------- | --------------------------------------------- | ---------------------------------- |
| **一个按钮**（最省事）                  | `<mc-button color="#fff000">`                 | 那一个按钮，见第一步               |
| 一段子树 / 一个页面（任意组件）         | 容器上 `data-tone="#fff000"`                  | 子树里所有消费令牌的组件，见第二步 |
| 一个实例 / 一类组件（要控制到具体令牌） | `style="--mc-button-fill: …"` 或容器上覆盖 L2 | 见第三步                           |
| 全站品牌色                              | 入口样式表 `:root`（三态写齐）                | 全站，见 [`theme.md`](./theme.md)  |

## 第一步：组件属性直接写 hex（`button` / `tag` / `icon` / `alert`）

```html
<mc-button color="#fff000">品牌按钮</mc-button>
<mc-button variant="outline" color="#1a7f5a">hex 描边</mc-button>
<mc-tag color="#1a7f5a">hex 标签</mc-tag>
<mc-tag variant="solid" color="#ff6b35">hex 实心</mc-tag>
<mc-icon name="heart" color="#ff6b35"></mc-icon>
<mc-alert color="#1a7f5a" heading="标题" icon>hex 提示条</mc-alert>
```

- **文字色自动给**：按 WCAG 相对亮度选黑或白（`#fff000` 配黑字 17.7:1；配白字只有 1.19:1，所以不交给你定）。
- **只收 hex**（`#fff000` / `#fc0`）。`rgb()` / `hsl()` / 颜色名 / 拼错的值 → 一条 `[mosaic]` 警告 +
  **不给颜色**（不猜、不降级；元素就保持 CSS 默认外观）。
- **四个有 `color` 的组件全接了**：`button` / `tag` / `icon` / `alert`（漏接会被 11 号静态守卫拦下，
  现在豁免表是空的）。理由与代价见 [D8](../plan/decisions.md)。
- 六个语义名一个字没变（仍走 CSS，仍随主题翻转）；hex 不随主题翻转（它是品牌色，不是语义色）。
- `tag` 的默认外观是浅底：`-subtle-fill` 按当前主题派生并**随主题重算**；品牌色同时是浅底上的文字色，
  所以太浅的颜色会读不清（`#fff000` 1.16:1）—— 这时控制台会有一条对比度警告。
- 原理：`boot/color-attr.js` 只往该组件自己的色槽填值（button 三个槽、tag / alert 四个槽、icon 直接写
  `color`），所以 `variant` 的组合关系不变。

## 第二步：整段子树 / 任意组件 —— 引 `tone.js`

```html
<script type="module" src=".../packages/boot/tone.js"></script>

<div data-tone="#fff000">
  <mc-button color="primary">按钮</mc-button>
  <mc-tag color="primary">标签</mc-tag>
</div>
```

```js
import { applyTone, clearTone } from '.../packages/boot/tone.js';
applyTone('#brand', '#fff000'); // 选择器 / 元素都行；"255 240 0" 三元组也收
clearTone('#brand'); // 撤回：删属性 + 清掉那六个令牌
```

它写的是 L2 六件套（`--mc-color-primary` / `-fg` / `-subtle` / `-hover` / `-active` / `--mc-color-ring`），
所以**一处覆盖、子树里所有消费令牌的组件一起变**，切主题还会重算派生档。四条限制写在
[tone.js 文件头](../../packages/boot/tone.js)，最容易吃到的一条：**浅底变体的强调色仍是品牌色本身**，
`#fff000` 在 tag 的浅底上只有 1.16:1 —— 挑一个中等明度的品牌色，或这类组件用实心外观。

## 第三步：手写令牌（要控制到具体令牌、或亮暗两套）

组件读的是 L2 语义令牌，一个色族六个，少写一个就有一处不跟着变：

| 令牌                        | 管什么                       | 少写它的表现                               |
| --------------------------- | ---------------------------- | ------------------------------------------ |
| `--mc-color-primary`        | 实心底 / 文字 / 描边         | —                                          |
| `--mc-color-primary-fg`     | 压在实心底上的文字           | 亮底配白字，`#fff000` 只剩 1.19:1          |
| `--mc-color-primary-subtle` | 浅底（tag / alert 默认外观） | 浅底还是主题色（最常漏的一处）             |
| `--mc-color-primary-hover`  | 悬停档                       | 悬停回主题色（tag / alert 吃它）           |
| `--mc-color-primary-active` | 按下档                       | 同上                                       |
| `--mc-color-ring`           | 焦点环                       | 焦点环还是主题色（独立令牌，不跟 `color`） |

```css
/* 放进你的样式表：选择器决定作用范围（容器 / 一类组件 / :root 都行） */
.brand-scope {
  --mc-color-primary: 255 240 0;
  --mc-color-primary-fg: 0 0 0;
  --mc-color-primary-subtle: 255 252 224;
  --mc-color-primary-hover: 230 216 0;
  --mc-color-primary-active: 204 192 0;
  --mc-color-ring: 60 67 77;
}
```

两个要点：**值是 "R G B" 三元组，不是 hex**（`#fff000` → `255 240 0`）；**`color` 照写语义名**
（你换的是「primary 在这个子树里是什么颜色」，`color="primary"` 照旧随主题翻转）。
不想引任何模块的话，最小的自己算版本：

```js
/** '#fff000' / '#fc0' → [255, 240, 0]；不认的返回 null */
const toTriple = (hex) => {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** 亮底黑字、暗底白字（WCAG 相对亮度，阈值 0.35 ≈ 4.5:1 的临界） */
const readableOn = ([r, g, b]) => {
  const lin = (v) => ((v /= 255), v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.35 ? '0 0 0' : '255 255 255';
};

const [r, g, b] = toTriple('#fff000');
const el = document.querySelector('#brand');
el.style.setProperty('--mc-color-primary', `${r} ${g} ${b}`);
el.style.setProperty('--mc-color-primary-fg', readableOn([r, g, b]));
```

派生档（`-subtle` / `-hover` / `-active` / ring）照 `color-math.js` 那十几行抄 —— 都是"按
surface / fg 混"，别自己发明一套别的手感。

## 怎么知道自己做对了

改完在页面 console 里回读一句：

```js
getComputedStyle(document.querySelector('mc-button')).backgroundColor; // "rgb(255, 240, 0)"
```

或者跑这几条守卫（button / tag / icon 各自钉「hex 生效 + 非法值不写槽 + 改回语义名清干净」；
06 钉「令牌覆盖到达组件 / `:root` 上写 L3 不生效 / tone.js 的声明式与主题重算」）：

```bash
node tests/smoke.mjs button
node tests/smoke.mjs tag
node tests/smoke.mjs icon
node tests/smoke.mjs --site 06
```

## 这一步最容易踩的

- **在没声明 `color` 的组件上写 hex**（如 `mc-card`）→ 静默回落默认色；判据是「只有声明了 `color` 的组件才收」—— [D8](../plan/decisions.md)
- **给 `color` 写非 hex 的值**（`rgb()` / 颜色名）→ 一条 `[mosaic]` 警告 + 不给颜色；只认 `#fff000` / `#fc0`
- **令牌里写颜色而不是三元组**（`#fff000` / `rgb(…)`）→ 全链路 `rgb(var(--x))`，静默失效 —— [theme.md](./theme.md)
- **只覆盖 `--mc-color-primary`** → 浅底 / 悬停 / 焦点环还是主题色；tag、alert 的浅底就是这么露馅的
- **在 `:root` 上写 L3**（`--mc-button-fill`）→ 组件自己的 `:host` 声明过它，继承值打不过，不生效 —— [theme.md](./theme.md)
- **亮底忘了配深色文字** → 对比度不达标（`#fff000` + 白 = 1.19:1）；这也是 `color` 的 `-fg` 由组件算的原因
- **拿一个极浅的品牌色配浅底变体** → 品牌色自己当浅底文字，`#fff000` 实测 1.16:1（第二步那条限制）
