#!/usr/bin/env node
/*
 * Mosaic 设计令牌生成器：调色板由 OKLCH 算出，只改 HUES / RAMPS，其余全部推导。
 * 产出 packages/color/tokens.css（生成物提交进仓库，分发走 jsDelivr /gh/）并做 WCAG 对比度自检，不达标 exit 1。
 * 用法：node tools/gen-tokens.mjs [--check]（--check 只自检不写文件，给 CI 用）
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'packages/color/tokens.css');
const CHECK_ONLY = process.argv.includes('--check');

/* ---------- 1. 色空间：OKLCH -> 线性 sRGB -> sRGB（OKLab 感知均匀，相邻档视觉步长一致） ---------- */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Ottosson 的 OKLab -> 线性 sRGB 合成矩阵，每行系数和为 1（a=b=0 得中性灰），漏掉中间 XYZ 会让整条色阶偏色
function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const linearToSrgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const srgbToLinear = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** OKLCH -> sRGB 0..1，超出 sRGB 色域时二分降低 chroma（保色相和明度） */
function oklchToSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  let lo = 0;
  let hi = C;
  let rgb = oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h));
  if (!inGamut(rgb)) {
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      rgb = oklabToLinearSrgb(L, mid * Math.cos(h), mid * Math.sin(h));
      if (inGamut(rgb)) lo = mid;
      else hi = mid;
    }
    rgb = oklabToLinearSrgb(L, lo * Math.cos(h), lo * Math.sin(h));
  }
  return rgb.map((c) => clamp01(linearToSrgb(clamp01(c))));
}

const toHex = (rgb) =>
  '#' +
  rgb
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/** 令牌里存的是 sRGB 通道三元组（"R G B"），配合 rgb(var(--x) / <alpha-value>) 支持透明度 */
const toChannels = (rgb) => rgb.map((c) => Math.round(c * 255)).join(' ');

/* ---------- 2. WCAG 对比度 ---------- */

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(rgb1, rgb2) {
  const [a, b] = [relativeLuminance(rgb1), relativeLuminance(rgb2)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/* ---------- 3. 色阶参数 ---------- */

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// 统一的明度爬升。相邻档位的 OKLab L 差控制在 0.05~0.12，视觉步长才均匀。
const L_RAMP = {
  50: 0.972,
  100: 0.938,
  200: 0.886,
  300: 0.808,
  400: 0.704,
  500: 0.623,
  600: 0.546,
  700: 0.488,
  800: 0.424,
  900: 0.379,
  950: 0.272,
};

// chroma 乘数：中间档最艳，两端收敛，避免浅色档发脏、深色档发荧光
const C_CURVE = {
  50: 0.09,
  100: 0.17,
  200: 0.31,
  300: 0.51,
  400: 0.78,
  500: 0.96,
  600: 1.0,
  700: 0.91,
  800: 0.75,
  900: 0.62,
  950: 0.44,
};

/** 六个色族：hue 是 OKLCH 色相角，cmax 是该色相在 sRGB 里的彩度上限。换品牌色只改 primary.hue 重跑 */
const HUES = {
  neutral: { hue: 258, cmax: 0.032 }, // 微冷灰，与 primary 同色相 → 界面更"整"
  primary: { hue: 288, cmax: 0.235 }, // Mosaic 品牌色：紫罗兰，避开满地蓝
  info: { hue: 248, cmax: 0.198 },
  success: { hue: 152, cmax: 0.185 },
  warning: { hue: 72, cmax: 0.168 },
  danger: { hue: 26, cmax: 0.212 },
};

const PALETTE = {};
for (const [name, { hue, cmax }] of Object.entries(HUES)) {
  PALETTE[name] = {};
  for (const step of STEPS) {
    const rgb = oklchToSrgb(L_RAMP[step], cmax * C_CURVE[step], hue);
    PALETTE[name][step] = { rgb, hex: toHex(rgb), channels: toChannels(rgb) };
  }
}

/* ---------- 4. 语义层：组件只能引用这一层 ---------- */

/* 语义令牌引用原始色阶。颜色令牌一律存「R G B 通道三元组」、不加 rgb() 包装：UnoCSS 会拼成
 * `rgb(var(--x) / <alpha-value>)`，存完整颜色就拼出 `rgb(rgb(...) / 1)` 非法 CSS，整条声明被
 * 计算阶段丢弃 —— 表现为"类名在、规则在、就是不生效"，极难排查。 */
const ref = (family, step) => `var(--mc-${family}-${step})`;

const THEMES = {
  // 每个色族只留一个档位，且必须同时满足：① 实心填充上的 -fg ≥ 4.5:1；② 作为文字落在 surface 上 ≥ 4.5:1。
  // 所以 bg/text/border-<family> 可以无脑用同一个令牌；下面的自检强制保证，改色相不达标会构建失败。
  light: {
    'color-bg': ref('neutral', 50),
    'color-surface': '255 255 255',
    'color-surface-raised': '255 255 255',
    'color-surface-sunken': ref('neutral', 100),
    'color-fg': ref('neutral', 900),
    'color-fg-muted': ref('neutral', 600),
    'color-fg-subtle': ref('neutral', 500),
    'color-fg-inverted': '255 255 255',
    'color-border': ref('neutral', 200),
    'color-border-strong': ref('neutral', 300),
    'color-ring': ref('primary', 500),
    'color-overlay': '15 18 30',

    // 中性表面只作「次要按钮的填充底色」：它无法同时胜任填充和文字两个角色（填充要浅、文字要深），所以单独一套
    'color-neutral': ref('neutral', 200),
    'color-neutral-fg': ref('neutral', 900),
    'color-overlay-alpha': '0.45',

    'color-primary': ref('primary', 600),
    'color-primary-hover': ref('primary', 700),
    'color-primary-active': ref('primary', 800),
    'color-primary-subtle': ref('primary', 50),
    'color-primary-fg': '255 255 255',

    'color-info': ref('info', 600),
    'color-info-hover': ref('info', 700),
    'color-info-active': ref('info', 800),
    'color-info-subtle': ref('info', 50),
    'color-info-fg': '255 255 255',

    // success 特例：600 当文字放白底只有 3.3:1，绿色又难再压深，整体下移一档到 700 两个角色才都达标
    'color-success': ref('success', 700),
    'color-success-hover': ref('success', 800),
    'color-success-active': ref('success', 900),
    'color-success-subtle': ref('success', 50),
    'color-success-fg': '255 255 255',

    'color-warning': ref('warning', 600),
    'color-warning-hover': ref('warning', 700),
    'color-warning-active': ref('warning', 800),
    'color-warning-subtle': ref('warning', 50),
    'color-warning-fg': '255 255 255',

    'color-danger': ref('danger', 600),
    'color-danger-hover': ref('danger', 700),
    'color-danger-active': ref('danger', 800),
    'color-danger-subtle': ref('danger', 50),
    'color-danger-fg': '255 255 255',
  },
  dark: {
    'color-bg': ref('neutral', 950),
    'color-surface': ref('neutral', 900),
    'color-surface-raised': ref('neutral', 800),
    'color-surface-sunken': '4 6 12',
    'color-fg': ref('neutral', 50),
    'color-fg-muted': ref('neutral', 300),
    'color-fg-subtle': ref('neutral', 400),
    'color-fg-inverted': ref('neutral', 950),
    'color-border': ref('neutral', 800),
    'color-border-strong': ref('neutral', 700),
    'color-ring': ref('primary', 400),
    'color-overlay': '0 0 0',
    'color-neutral': ref('neutral', 700),
    'color-neutral-fg': ref('neutral', 50),
    'color-overlay-alpha': '0.65',

    // 深色主题统一浅色填充 + 近黑文字：满足 AA，也避免「深底上再放深色按钮」导致层级塌陷
    'color-primary': ref('primary', 300),
    'color-primary-hover': ref('primary', 200),
    'color-primary-active': ref('primary', 100),
    'color-primary-subtle': ref('primary', 950),
    'color-primary-fg': ref('neutral', 950),

    'color-info': ref('info', 300),
    'color-info-hover': ref('info', 200),
    'color-info-active': ref('info', 100),
    'color-info-subtle': ref('info', 950),
    'color-info-fg': ref('neutral', 950),

    'color-success': ref('success', 300),
    'color-success-hover': ref('success', 200),
    'color-success-active': ref('success', 100),
    'color-success-subtle': ref('success', 950),
    'color-success-fg': ref('neutral', 950),

    'color-warning': ref('warning', 300),
    'color-warning-hover': ref('warning', 200),
    'color-warning-active': ref('warning', 100),
    'color-warning-subtle': ref('warning', 950),
    'color-warning-fg': ref('neutral', 950),

    'color-danger': ref('danger', 300),
    'color-danger-hover': ref('danger', 200),
    'color-danger-active': ref('danger', 100),
    'color-danger-subtle': ref('danger', 950),
    'color-danger-fg': ref('neutral', 950),
  },
};

/** 状态色族，对比度自检按这个列表遍历 */
const FAMILIES = ['primary', 'info', 'success', 'warning', 'danger'];

/** 与主题无关的标量令牌 */
const SCALARS = {
  'font-sans':
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  'font-mono':
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',

  'text-xs': '0.75rem',
  'text-xs-lh': '1rem',
  'text-sm': '0.875rem',
  'text-sm-lh': '1.25rem',
  'text-base': '1rem',
  'text-base-lh': '1.5rem',
  'text-lg': '1.125rem',
  'text-lg-lh': '1.75rem',
  'text-xl': '1.25rem',
  'text-xl-lh': '1.75rem',
  'text-2xl': '1.5rem',
  'text-2xl-lh': '2rem',
  'text-3xl': '1.875rem',
  'text-3xl-lh': '2.25rem',

  'weight-normal': '400',
  'weight-medium': '500',
  'weight-semibold': '600',
  'weight-bold': '700',

  'space-0': '0',
  'space-1': '0.25rem',
  'space-2': '0.5rem',
  'space-3': '0.75rem',
  'space-4': '1rem',
  'space-5': '1.25rem',
  'space-6': '1.5rem',
  'space-8': '2rem',
  'space-10': '2.5rem',
  'space-12': '3rem',
  'space-16': '4rem',

  'radius-none': '0',
  'radius-sm': '0.25rem',
  'radius-md': '0.375rem',
  'radius-lg': '0.5rem',
  'radius-xl': '0.75rem',
  'radius-2xl': '1rem',
  'radius-full': '9999px',

  'control-h-sm': '1.75rem',
  'control-h-md': '2.25rem',
  'control-h-lg': '2.75rem',

  'duration-fast': '120ms',
  'duration-base': '180ms',
  'duration-slow': '280ms',
  'ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'ease-emphasized': 'cubic-bezier(0.2, 0, 0, 1.2)',

  'z-dropdown': '1000',
  'z-sticky': '1100',
  'z-overlay': '1200',
  'z-modal': '1300',
  'z-popover': '1400',
  'z-toast': '1500',
  'z-tooltip': '1600',
};

/* ---------- 5. 自检：对比度 ---------- */

const hexOf = (family, step) => PALETTE[family][step].rgb;

const hexToRgb = (hex) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  return [0, 1, 2].map((i) => parseInt(m[i + 1], 16) / 255);
};

/** 把语义令牌的表达式解析回 rgb，用于算对比度 */
function resolveValue(expr, theme) {
  if (expr === '255 255 255') return [1, 1, 1];
  if (expr === '4 6 12') return hexToRgb('#04060c');
  /* 把语义令牌的表达式解析回 rgb 算对比度。L2 现在写裸的 `var(--mc-<family>-<step>)`（通道三元组
   * 由消费者包 rgb()），必须跟着改：早期匹配 `rgb(var(…))`，去掉包装后正则再也匹配不上，所有
   * 规则被下面的 continue 静默跳过 —— 自检变空转。这里两种写法都收。 */
  const m = /^(?:rgb\()?var\(--mc-([a-z]+)-(\d+)\)\)?$/.exec(expr);
  if (!m) return null;
  const [, family, step] = m;
  return PALETTE[family][step].rgb;
}

const CONTRAST_RULES = [
  // [前景语义, 背景语义, 最低要求, 说明]
  ['color-fg', 'color-bg', 4.5, '正文 / 页面底色'],
  ['color-fg', 'color-surface', 4.5, '正文 / 卡片'],
  ['color-fg-muted', 'color-surface', 4.5, '次要文字 / 卡片'],
  ['color-fg-subtle', 'color-surface', 3.0, '占位符（大字号）'],
  ['color-neutral-fg', 'color-neutral', 4.5, '中性按钮：填充上的文字'],
  ['color-border-strong', 'color-surface', 1.4, '强边框需可见'],
  ['color-ring', 'color-surface', 3.0, '焦点环（WCAG 1.4.11 非文字对比）'],
  // 状态色：同一个令牌要同时胜任"填充"和"文字"两个角色，两条规则都得过
  ...FAMILIES.map((f) => [`color-${f}-fg`, `color-${f}`, 4.5, `${f}：填充上的文字`]),
  ...FAMILIES.map((f) => [`color-${f}`, 'color-surface', 4.5, `${f}：中性底上的文字`]),
];

let failures = 0;
const report = [];
for (const [themeName, tokens] of Object.entries(THEMES)) {
  for (const [fgKey, bgKey, min, label] of CONTRAST_RULES) {
    const fg = resolveValue(tokens[fgKey], themeName);
    const bg = resolveValue(tokens[bgKey], themeName);
    if (!fg || !bg) continue;
    const ratio = contrast(fg, bg);
    const ok = ratio >= min;
    if (!ok) failures++;
    report.push({ themeName, pair: `${fgKey} on ${bgKey}`, ratio, min, ok, label });
  }
}

/* ---------- 6. 生成 CSS ---------- */

const lines = [];
const push = (...s) => lines.push(...s);

push(
  '/* ============================================================================',
  ' * Mosaic Design Tokens — 由 tools/gen-tokens.mjs 生成，请勿手工编辑',
  ` * 品牌色相 ${HUES.primary.hue}° (OKLCH) · 6 色族 × ${STEPS.length} 档 · 重新生成：pnpm tokens`,
  ' *',
  ' * 三层结构，组件只允许消费第 2、3 层：',
  ' *   L1 原始色阶  --mc-<family>-<step>   存 sRGB 通道三元组，配合 rgb(var(--x) / a) 支持透明度',
  ' *   L2 语义令牌  --mc-color-* / --mc-space-* / ...  主题在这里切换',
  ' *   L3 组件令牌  --mc-<component>-*     默认引用 L2，供使用者按实例覆盖',
  ' *',
  ' * 令牌只定义在 :root 上（不带 :host）。原因见下方 @layer 声明处的注释。',
  ' * ========================================================================== */',
  '',
  '/* 层顺序在这里一次性钉死。',
  ' *',
  ' * 为什么必须显式声明、且必须出现在最前面：CSS 的层顺序由「首次出现」决定，',
  ' * 后写的 @layer 语句无法把已声明过的层挪位。而 shadow root 里我们会 adopt 两份表',
  ' * （mosaic.css + shadow-base.css），如果靠它们的先后顺序来隐式排序，',
  ' * 一旦 adopt 顺序变了，shadow-base 里的元素级 reset 就会跑到工具类**上面**去，',
  ' * 把 px-4 之类的规则压掉。显式声明让顺序与 adopt 顺序解耦。',
  ' *',
  ' * 预期顺序（从低到高）：',
  ' *   组件自己的 <style> 是未分层的 → 永远赢过全部上面这些层',
  ' */',
  '@layer mosaic.base, mosaic.tokens, mosaic.preflights, mosaic.components, mosaic.utilities;',
  '',
  '/* 令牌只写在 :root 上，**刻意不写 :host**。',
  ' *',
  ' * 这份表在 shadow root 里也会被 adopt 一次，但里面所有令牌选择器都只在文档根上匹配：',
  ' *',
  ' *   :root              在 shadow root 内不匹配任何元素 → 不干扰',
  ' *   [data-theme=dark]  选的是 <html>，也在 shadow 树外 → 不干扰',
  ' *',
  ' * 组件的令牌从哪来？靠**自定义属性继承** —— :root 上的值一路继承进每个 shadow root。',
  ' *',
  ' * 如果这里写成 `:root, :host`，shadow root 里的 `:host` 会给宿主元素重新赋一遍',
  ' * **亮色**值，直接盖掉从文档继承下来的暗色值 —— 表现为「切主题时组件纹丝不动」。',
  ' * 同理，暗色规则不能写成 `:host([data-theme=dark])`，那在组件上永远不成立。',
  ' */',
  '@layer mosaic.tokens {',
  '  /* ---- L1 原始色阶 ------------------------------------------------ */',
  '  :root {',
);

for (const [family, steps] of Object.entries(PALETTE)) {
  push(`    /* ${family} */`);
  for (const step of STEPS) {
    push(`    --mc-${family}-${step}: ${steps[step].channels}; /* ${steps[step].hex} */`);
  }
}
push('  }', '');

push('  /* ---- L2 语义令牌 · 亮色（默认） -------------------------------- */');
push('  :root {');
push('    color-scheme: light;');
for (const [key, value] of Object.entries(THEMES.light)) push(`    --mc-${key}: ${value};`);
push('  }', '');

push('  /* ---- L2 语义令牌 · 暗色 ---------------------------------------- */');
push('  /* 方式一：显式切换（推荐，可做「跟随系统 / 强制亮 / 强制暗」三态） */');
push('  [data-theme="dark"] {');
push('    color-scheme: dark;');
for (const [key, value] of Object.entries(THEMES.dark)) push(`    --mc-${key}: ${value};`);
push('  }', '');
push('  /* 方式二：未显式指定时跟随系统偏好 */');
push('  @media (prefers-color-scheme: dark) {');
push('    :root:not([data-theme]) {');
push('      color-scheme: dark;');
for (const [key, value] of Object.entries(THEMES.dark)) push(`      --mc-${key}: ${value};`);
push('    }');
push('  }', '');

push('  /* ---- L2 排版 / 间距 / 圆角 / 控件 / 动效 / 层级 ------------------ */');
push('  :root {');
let lastGroup = '';
for (const [key, value] of Object.entries(SCALARS)) {
  const group = key.split('-')[0];
  if (group !== lastGroup) {
    push('');
    lastGroup = group;
  }
  push(`    --mc-${key}: ${value};`);
}
push('  }');
push('}', '');

push(
  '/* ---- 使用示例 ------------------------------------------------------',
  ' * 组件内部（shadow DOM）：直接消费语义令牌即可，无需任何工具类',
  ' *   .mc-btn { background: rgb(var(--mc-color-primary)); color: rgb(var(--mc-color-primary-fg)); }',
  ' *',
  ' * 宿主页面覆盖（未分层 → 一定赢过 @layer）：',
  ' *   :root { --mc-color-primary: 16 185 129; }',
  ' *',
  ' * 单实例覆盖（组件令牌在宿主元素上重新赋值，随继承进入 shadow DOM）：',
  ' *   <mc-button style="--mc-color-primary: 220 38 38">删除</mc-button>',
  ' * ------------------------------------------------------------------ */',
);

const css = lines.join('\n');

/* ---------- 7. 报告 ---------- */

const pad = (s, n) => String(s).padEnd(n, ' ');
console.log('\n\x1b[1mMosaic 调色板\x1b[0m  (OKLCH hue 生成 → sRGB 通道)\n');
for (const [family, steps] of Object.entries(PALETTE)) {
  const swatches = STEPS.map((s) => steps[s].hex).join(' ');
  console.log(`  ${pad(family, 9)} ${swatches}`);
}

console.log('\n\x1b[1mWCAG 对比度自检\x1b[0m\n');
for (const themeName of Object.keys(THEMES)) {
  console.log(`  \x1b[2m${themeName}\x1b[0m`);
  for (const r of report.filter((r) => r.themeName === themeName)) {
    const tag = r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(
      `    ${tag}  ${r.ratio.toFixed(2).padStart(5)} : 1  \x1b[2m(min ${r.min})\x1b[0m  ${pad(r.pair, 34)} ${r.label}`,
    );
  }
  console.log('');
}

if (failures) {
  console.error(`\x1b[31m✗ ${failures} 项对比度未达标\x1b[0m — 调整 HUES/L_RAMP 后重跑\n`);
  process.exit(1);
}

if (CHECK_ONLY) {
  console.log('\x1b[32m✓ 对比度全部达标（未写文件）\x1b[0m\n');
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, css, 'utf8');
console.log(`\x1b[32m✓\x1b[0m 对比度全部达标`);
console.log(
  `\x1b[32m✓\x1b[0m 已写入 ${OUT.replace(ROOT + '/', '')} (${(css.length / 1024).toFixed(1)} KB)\n`,
);
