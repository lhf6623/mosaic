import {
  defineConfig,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

/**
 * Mosaic — UnoCSS 配置
 *
 * 三条硬性约束，改动前请先读 agent/PLAN.md 的「D3 / D4」：
 *
 *  1. 用 presetWind3，不用 presetWind4。
 *     - wind3 的 theme 色支持 `<alpha-value>` 占位符，wind4 不支持，
 *       写了会产出 `rgb(var(--x) / <alpha-value>)` 这种非法 CSS 而静默失效。
 *     - wind4 自带 Tailwind4 整页 reset，`<link>` 出去会重置宿主页面。
 *
 *  2. 必须开启 outputToCssLayers。
 *     MDN 明确：adoptedStyleSheets 在 shadow root 内排在组件自身 `<style>` **之后**，
 *     也就是优先级更高。只有把工具类放进 @layer，组件自己的样式才能稳定覆盖它。
 *
 *  3. 颜色只能走语义令牌。
 *     组件里禁止出现 `bg-primary-500` 这类原始色阶，由下面的 blocklist 拦截。
 *
 * 本文件保持**纯声明式**：不引任何 node: 内置模块、不做文件系统 I/O、不调 process.exit。
 * 构建输入的校验放在 tools/build-css.mjs —— 顺带避开给一个纯 JS 项目强加 @types/node 依赖。
 */

/* ------------------------------------------------------------------ *
 * 精选工具类子集
 *
 * 这是「预编译原子 CSS」这个模式的核心矛盾：我们能编译的只有已知的类名，
 * 而使用者在自己的页面里会写什么是未知的。
 *
 * 三条出路，我们选了第 1 条：
 *   1. 预编译一份「精选子集」——覆盖布局/间距/排版/语义色，体积可控
 *   2. 全量输出 presetWind3 —— 1 MB 级别的产物，不可接受
 *   3. 让使用者自己跑 UnoCSS —— 那就违背了"免构建"的立项前提
 *
 * 代价必须说清楚：这份子集之外的类名（例如 mt-7、bg-gradient-to-r）不会存在，
 * 使用者需要时得自己写 CSS。所以子集要覆盖"搭界面时 90% 会用到的东西"。
 * ------------------------------------------------------------------ */

const SPACING = ['0', '1', '2', '3', '4', '5', '6', '8', '10', '12'];
const SIDES = ['', 'x', 'y', 't', 'r', 'b', 'l'];

/** 布局与排版：不可枚举，只能手写 */
const LAYOUT = [
  // 显示
  'block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'hidden', 'contents',
  // 定位
  'static', 'relative', 'absolute', 'fixed', 'sticky',
  'inset-0', 'top-0', 'right-0', 'bottom-0', 'left-0', 'z-0', 'z-10', 'z-20', 'z-50',
  // 弹性盒
  'flex-row', 'flex-col', 'flex-wrap', 'flex-nowrap', 'flex-1', 'flex-auto', 'flex-none',
  'items-start', 'items-center', 'items-end', 'items-baseline', 'items-stretch',
  'justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around', 'justify-evenly',
  'self-start', 'self-center', 'self-end', 'self-stretch', 'order-first', 'order-last',
  // 网格
  'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-6', 'grid-cols-12',
  'col-span-1', 'col-span-2', 'col-span-3', 'col-span-4', 'col-span-6', 'col-span-12',
  // 尺寸
  'w-full', 'w-auto', 'w-screen', 'w-fit', 'h-full', 'h-auto', 'h-screen',
  'min-w-0', 'min-h-0', 'max-w-full', 'max-w-none', 'size-full',
  // 溢出
  'overflow-hidden', 'overflow-auto', 'overflow-visible', 'overflow-x-auto', 'overflow-y-auto',
  // 文字
  'text-left', 'text-center', 'text-right', 'text-nowrap', 'truncate',
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl',
  'font-normal', 'font-medium', 'font-semibold', 'font-bold',
  'leading-none', 'leading-tight', 'leading-normal', 'leading-relaxed',
  'uppercase', 'lowercase', 'capitalize', 'underline', 'line-through', 'italic',
  // 边框与效果
  'border', 'border-0', 'border-t', 'border-b', 'border-l', 'border-r',
  'rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full',
  'shadow-none', 'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg',
  'opacity-0', 'opacity-25', 'opacity-50', 'opacity-75', 'opacity-100',
  'cursor-pointer', 'cursor-not-allowed', 'cursor-default', 'cursor-text',
  'pointer-events-none', 'pointer-events-auto',
  'select-none', 'select-text', 'sr-only', 'transition', 'transition-none',
  'outline-none', 'ring-0', 'ring-2', 'ring-4',
];

/**
 * 响应式变体：只放"做页面骨架"真正会用到的十几个。
 *
 * 为什么不全放：`{断点} × {工具类}` 是组合爆炸（5 个断点 × 350 个类 = 1750 条），
 * 而实际布局里 90% 的响应式需求就是「窄屏堆叠 / 宽屏并列」和「窄屏隐藏」。
 * 这几条覆盖了它们。
 *
 * 组件内部**不要**用这些断点类：组件不知道自己会被放进多宽的容器里，
 * 应该用容器查询（@container），见 agent/design-spec.md「四、响应式」。
 */
const RESPONSIVE = ['md', 'lg'].flatMap((bp) =>
  ['block', 'hidden', 'flex', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'flex-row', 'w-auto'].map(
    (u) => `${bp}:${u}`,
  ),
);

/** 语义色：组件和使用者都只允许用这一套，原始色阶由 blocklist 拦截 */
const STATUS = ['primary', 'info', 'success', 'warning', 'danger'];
const NEUTRAL_COLORS = [
  'bg-background', 'bg-surface', 'bg-surface-raised', 'bg-surface-sunken', 'bg-overlay',
  'text-foreground', 'text-muted', 'text-subtle',
  'border-border', 'border-border-strong',
  'hover:bg-surface-sunken',
];
const STATUS_COLORS = STATUS.flatMap((f) => [
  `bg-${f}`, `bg-${f}-hover`, `bg-${f}-active`, `bg-${f}-subtle`,
  `text-${f}`, `text-${f}-fg`,
  `border-${f}`, `ring-${f}`,
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
      // 'on-demand'：只输出真正用到的 --un-* 变量，不往宿主页面每个元素上挂 50 个属性。
      // wind3 的 preflight 本来就不含元素级 reset，对组件库是安全的。
      preflight: 'on-demand',
      // 组件在 shadow DOM 里，`dark:` 变体（依赖祖先类）永远不命中；
      // media 至少是可用的。Mosaic 自己的主题切换一律走令牌，不用 dark:。
      dark: 'media',
    }),
  ],

  // @apply / @screen 只在 .css 文件里生效（UnoCSS 的 idFilter 只认 css 类扩展名），
  // 写在 .html 的 <style> 里会被原样留下 —— 这是实测结论，别踩。
  transformers: [transformerDirectives(), transformerVariantGroup()],

  theme: {
    /**
     * 只覆盖颜色和字体。间距 / 圆角 / 字号刻意复用 UnoCSS 默认标度，
     * 因为 tokens.css 里的 --mc-space-* / --mc-radius-* / --mc-text-*
     * 就是按同一套数值生成的（p-4 === --mc-space-4 === 1rem），两边天然对齐。
     * 重映射成 var() 反而会让 p-7、w-1/2 这类非标度值消失，得不偿失。
     */
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
    // 组件内部只把「布局」原子化，「颜色」全部走令牌 —— 见 agent/components.md。
    // 变体由 :host([variant=...]) 选择器驱动，不拼类名。
    ['mc-focus-ring', 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'],
    ['mc-truncate', 'overflow-hidden text-ellipsis whitespace-nowrap'],
    ['mc-center', 'flex items-center justify-center'],
  ],

  /**
   * 组件模板里的工具类是字面量（变体由 :host([attr]) 驱动，不拼类名），
   * 所以能静态扫到，本来不需要 safelist。
   * 这里存在的唯一理由是：把「使用者会写、但我们组件里没用到」的原子类补进来。
   * 详见文件顶部「精选工具类子集」。
   */
  safelist: [
    ...CURATED_SAFELIST,
    // 兜底表达式形式的类
    'mc-focus-ring',
    'mc-truncate',
    'mc-center',
  ],

  /**
   * 禁止在组件里直接引用原始色阶。
   * 目的不是洁癖：原始色阶不随主题切换（暗色下 bg-primary-600 在深底上对比度不够），
   * 用了就一定会在某个主题下出可读性问题。
   */
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

  /**
   * 产出原生 @layer。tokens.css 自己声明了 @layer mosaic.tokens，
   * 由于它被 CLI 拼在产物最前面，层顺序天然是：
   *   mosaic.tokens  <  mosaic.preflights  <  mosaic.utilities  <  mosaic.components
   * 于是「宿主页面未分层的覆盖」和「组件自身的 <style>」都必定赢过工具类。
   */
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
        // tokens.css 在前、组件模板在后 → 令牌铺底，工具类随后。
        // 刻意不包含 shadow-base.css：那份 reset 只能注入 shadow root，
        // 绝不能 <link> 到宿主页面，所以它不进这个产物，由 mosaic.js 在运行时单独取用。
        // 排除 packages/*/page.html —— 那是**文档页**（ofa.js 页面模块），不是组件模板。
        // 不排除的话，文档排版里用到的工具类（mt-3、mb-3 …）会被扫进框架产物，
        // 让「精选子集」的体积跟着文档写作风格浮动。
        patterns: ['packages/color/tokens.css', 'packages/**/*.html', '!packages/*/page.html'],
        outFile: 'packages/boot/mosaic.css',
      },
    ],
  },
});
