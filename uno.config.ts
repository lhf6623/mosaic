import { defineConfig, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss';

/*
 * Mosaic — UnoCSS 配置。三条硬约束（改动前先读 agent/PLAN.md 的 D3 / D4）：用 presetWind3 而非
 * wind4（wind4 的 theme 色不支持 <alpha-value>，会产出非法 CSS 且静默失效，还自带整页 reset）、
 * 必须开 outputToCssLayers（②）、颜色只走语义令牌。本文件纯声明式，输入校验收在 tools/build-css.mjs。
 */

/* ---------- 精选工具类子集：只能预编译已知类名，故取覆盖布局/间距/排版/语义色的子集。
 * 代价说清楚：子集之外的类名（mt-7、bg-gradient-to-r）不存在，使用者需要时得自己写 CSS。 ---------- */

const SPACING = ['0', '1', '2', '3', '4', '5', '6', '8', '10', '12'];
const SIDES = ['', 'x', 'y', 't', 'r', 'b', 'l'];

/** 布局与排版：不可枚举，只能手写 */
const LAYOUT = [
  // 显示
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'hidden',
  'contents',
  // 定位
  'static',
  'relative',
  'absolute',
  'fixed',
  'sticky',
  'inset-0',
  'top-0',
  'right-0',
  'bottom-0',
  'left-0',
  'z-0',
  'z-10',
  'z-20',
  'z-50',
  // 弹性盒
  'flex-row',
  'flex-col',
  'flex-wrap',
  'flex-nowrap',
  'flex-1',
  'flex-auto',
  'flex-none',
  'items-start',
  'items-center',
  'items-end',
  'items-baseline',
  'items-stretch',
  'justify-start',
  'justify-center',
  'justify-end',
  'justify-between',
  'justify-around',
  'justify-evenly',
  'self-start',
  'self-center',
  'self-end',
  'self-stretch',
  'order-first',
  'order-last',
  // 网格
  'grid-cols-1',
  'grid-cols-2',
  'grid-cols-3',
  'grid-cols-4',
  'grid-cols-6',
  'grid-cols-12',
  'col-span-1',
  'col-span-2',
  'col-span-3',
  'col-span-4',
  'col-span-6',
  'col-span-12',
  // 尺寸
  'w-full',
  'w-auto',
  'w-screen',
  'w-fit',
  'h-full',
  'h-auto',
  'h-screen',
  'min-w-0',
  'min-h-0',
  'max-w-full',
  'max-w-none',
  'size-full',
  // 溢出
  'overflow-hidden',
  'overflow-auto',
  'overflow-visible',
  'overflow-x-auto',
  'overflow-y-auto',
  // 文字
  'text-left',
  'text-center',
  'text-right',
  'text-nowrap',
  'truncate',
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'font-normal',
  'font-medium',
  'font-semibold',
  'font-bold',
  'leading-none',
  'leading-tight',
  'leading-normal',
  'leading-relaxed',
  'uppercase',
  'lowercase',
  'capitalize',
  'underline',
  'line-through',
  'italic',
  // 边框与效果
  'border',
  'border-0',
  'border-t',
  'border-b',
  'border-l',
  'border-r',
  'rounded-none',
  'rounded-sm',
  'rounded',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-full',
  'shadow-none',
  'shadow-sm',
  'shadow',
  'shadow-md',
  'shadow-lg',
  'opacity-0',
  'opacity-25',
  'opacity-50',
  'opacity-75',
  'opacity-100',
  'cursor-pointer',
  'cursor-not-allowed',
  'cursor-default',
  'cursor-text',
  'pointer-events-none',
  'pointer-events-auto',
  'select-none',
  'select-text',
  'sr-only',
  'transition',
  'transition-none',
  'outline-none',
  'ring-0',
  'ring-2',
  'ring-4',
];

/** 响应式变体只放骨架会用到的十几个：{断点}×{工具类} 组合爆炸，而 90% 需求就是窄屏堆叠 / 隐藏。
 *  组件内部不要用断点类（不知道自己会被放进多宽的容器），用容器查询，见 agent/design-spec.md。 */
const RESPONSIVE = ['md', 'lg'].flatMap((bp) =>
  [
    'block',
    'hidden',
    'flex',
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-4',
    'flex-row',
    'w-auto',
  ].map((u) => `${bp}:${u}`),
);

/** 语义色：组件和使用者都只允许用这一套，原始色阶由 blocklist 拦截 */
const STATUS = ['primary', 'info', 'success', 'warning', 'danger'];
const NEUTRAL_COLORS = [
  'bg-background',
  'bg-surface',
  'bg-surface-raised',
  'bg-surface-sunken',
  'bg-overlay',
  'text-foreground',
  'text-muted',
  'text-subtle',
  'border-border',
  'border-border-strong',
  'hover:bg-surface-sunken',
];
const STATUS_COLORS = STATUS.flatMap((f) => [
  `bg-${f}`,
  `bg-${f}-hover`,
  `bg-${f}-active`,
  `bg-${f}-subtle`,
  `text-${f}`,
  `text-${f}-fg`,
  `border-${f}`,
  `ring-${f}`,
  `hover:bg-${f}-hover`,
]);

const CURATED_SAFELIST = [
  ...LAYOUT,
  ...RESPONSIVE,
  ...NEUTRAL_COLORS,
  ...STATUS_COLORS,
  ...SIDES.flatMap((s) => SPACING.flatMap((n) => [`p${s}-${n}`, `m${s}-${n}`])),
  ...SPACING.map((n) => `gap-${n}`),
].filter((v, i, a) => a.indexOf(v) === i);

/** 语义色 -> rgb(var(--mc-...) / <alpha-value>)，让 /50 这类透明度语法可用 */
const tok = (name: string): string => `rgb(var(--mc-color-${name}) / <alpha-value>)`;

/** 状态色族统一五件套：填充 / hover / active / 浅底 / 填充上的文字 */
const status = (family: string): Record<string, string> => ({
  DEFAULT: tok(family),
  hover: tok(`${family}-hover`),
  active: tok(`${family}-active`),
  subtle: tok(`${family}-subtle`),
  fg: tok(`${family}-fg`),
});

export default defineConfig({
  presets: [
    presetWind3({
      // 'on-demand' 只输出用到的 --un-* 变量；wind3 preflight 本来就不含元素级 reset，对组件库安全
      preflight: 'on-demand',
      // 组件在 shadow DOM 里，`dark:`（依赖祖先类）永远不命中，只能设 media；主题切换一律走令牌
      dark: 'media',
    }),
  ],

  // @apply / @screen 只在 .css 文件里生效（UnoCSS 的 idFilter 只认 css 扩展名），写在 .html 的 <style> 里会被原样留下
  transformers: [transformerDirectives(), transformerVariantGroup()],

  theme: {
    /** 只覆盖颜色和字体。间距/圆角/字号复用 UnoCSS 默认标度 —— tokens.css 的 --mc-space-* 等本就按
     *  同一套数值生成（p-4 === --mc-space-4 === 1rem）；重映射成 var() 反而会让 p-7 这类值消失。 */
    colors: {
      inherit: 'inherit',
      current: 'currentColor',
      transparent: 'transparent',
      white: '#fff',
      black: '#000',

      background: tok('bg'),
      surface: {
        DEFAULT: tok('surface'),
        raised: tok('surface-raised'),
        sunken: tok('surface-sunken'),
      },
      foreground: tok('fg'),
      muted: tok('fg-muted'),
      subtle: tok('fg-subtle'),
      // 用法：`border border-border` / `border border-border-strong`
      border: {
        DEFAULT: tok('border'),
        strong: tok('border-strong'),
      },
      ring: tok('ring'),
      // overlay 是唯一带透明度的令牌，拆成了三元组 + 独立 alpha
      overlay: 'rgb(var(--mc-color-overlay) / var(--mc-color-overlay-alpha))',

      primary: status('primary'),
      info: status('info'),
      success: status('success'),
      warning: status('warning'),
      danger: status('danger'),
    },
    fontFamily: {
      sans: 'var(--mc-font-sans)',
      mono: 'var(--mc-font-mono)',
    },
  },

  shortcuts: [
    // 组件内部只把「布局」原子化，「颜色」全走令牌；变体由 :host([variant=...]) 选择器驱动，不拼类名
    [
      'mc-focus-ring',
      'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    ],
    ['mc-truncate', 'overflow-hidden text-ellipsis whitespace-nowrap'],
    ['mc-center', 'flex items-center justify-center'],
  ],

  /** 组件模板里的工具类是字面量，本不需要 safelist；这里只把「使用者会写、组件里没用到」的类补进来。
   *  见文件顶部「精选工具类子集」。 */
  safelist: [
    ...CURATED_SAFELIST,
    // 兜底表达式形式的类
    'mc-focus-ring',
    'mc-truncate',
    'mc-center',
  ],

  /** 禁止组件直接引用原始色阶：它不随主题切换（暗色下 bg-primary-600 对比度不够），必然在某个主题出问题 */
  blocklist: [
    [
      /-(neutral|primary|info|success|warning|danger)-\d+/,
      { message: '请改用语义色：bg-primary / text-muted / border-border（原始色阶不随主题切换）' },
    ],
  ],

  // 层顺序：preflights < shortcuts < default
  layers: {
    preflights: -100,
    shortcuts: -1,
    default: 1,
  },

  /** 必须开（见文件头 ②）：产出原生 @layer，tokens.css 声明在前，层顺序天然是
   *  mosaic.tokens < preflights < utilities < components，于是宿主未分层覆盖和组件 <style> 都赢过工具类。 */
  outputToCssLayers: {
    cssLayerName: (layer) => {
      if (layer === 'default') return 'mosaic.utilities';
      if (layer === 'shortcuts') return 'mosaic.components';
      if (layer === 'icons') return 'mosaic.icons';
      return `mosaic.${layer}`;
    },
  },

  cli: {
    entry: [
      {
        // tokens.css 在前、组件模板在后 → 令牌铺底、工具类随后。刻意不含 shadow-base.css（那份 reset 只能
        // 进 shadow root，由 mosaic.js 运行时取用）；排除 packages/*/page.html（那是文档页，不是组件模板，
        // 否则文档排版用的工具类会被扫进框架产物）。默认提取器扫整个文件，组件 <script> 里的 JS 标识符会被
        // 当类名，用 /* @unocss-skip-start */ … /* @unocss-skip-end */ 包住 script 段即可。
        patterns: ['packages/color/tokens.css', 'packages/**/*.html', '!packages/*/page.html'],
        outFile: 'packages/boot/mosaic.css',
      },
    ],
  },
});
