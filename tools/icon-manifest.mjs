/**
 * Mosaic 内置图标清单 —— **唯一真相源**：左边对外名（稳定 API，永不因上游改名而变），右边上游「图标集:图标名」。
 * 加一个内置图标 = 加一行 + `pnpm icons`（生成物要提交）；选名字用语义名而非上游名，同一语义只留一个名字。
 * 许可：ALLOWED_SETS 是硬白名单，`tools/gen-icons.mjs` 核对每一集的 license.spdx，不在名单里的集直接失败
 * （GPL / CC-BY-NC / 需要署名的 CC-BY 一律进不来）。
 */

/** 内置来源集。裸名（`name="search"`）查不到本地时，远程也按这个集拼 URL（可用 icon-set 覆盖）。 */
export const ICON_SOURCE = 'lucide';

/** 允许出现在内置集里的上游图标集（spdx 白名单在 gen-icons.mjs） */
export const ALLOWED_SETS = ['lucide', 'simple-icons'];

export const ICONS = {
  // ---- 方向与折叠 ----
  'chevron-up': 'lucide:chevron-up',
  'chevron-down': 'lucide:chevron-down',
  'chevron-left': 'lucide:chevron-left',
  'chevron-right': 'lucide:chevron-right',
  'chevrons-up-down': 'lucide:chevrons-up-down',
  'arrow-up': 'lucide:arrow-up',
  'arrow-down': 'lucide:arrow-down',
  'arrow-left': 'lucide:arrow-left',
  'arrow-right': 'lucide:arrow-right',

  // ---- 语义状态（mc-alert 的四个内置图形）----
  info: 'lucide:info',
  warning: 'lucide:triangle-alert',
  success: 'lucide:circle-check',
  error: 'lucide:circle-x',
  help: 'lucide:circle-question-mark',

  // ---- 通用操作 ----
  check: 'lucide:check',
  close: 'lucide:x',
  plus: 'lucide:plus',
  minus: 'lucide:minus',
  search: 'lucide:search',
  menu: 'lucide:menu',
  more: 'lucide:ellipsis',
  drag: 'lucide:grip-vertical',
  external: 'lucide:external-link',
  copy: 'lucide:copy',
  download: 'lucide:download',
  upload: 'lucide:upload',
  refresh: 'lucide:refresh-cw',
  spinner: 'lucide:loader-circle',
  filter: 'lucide:filter',
  trash: 'lucide:trash-2',
  edit: 'lucide:pencil',
  eye: 'lucide:eye',
  'eye-off': 'lucide:eye-off',
  settings: 'lucide:settings',

  // ---- 对象与信息 ----
  user: 'lucide:user',
  calendar: 'lucide:calendar',
  clock: 'lucide:clock',
  link: 'lucide:link',
  image: 'lucide:image',
  file: 'lucide:file',
  folder: 'lucide:folder',
  lock: 'lucide:lock',
  unlock: 'lucide:lock-open',
  star: 'lucide:star',
  heart: 'lucide:heart',
  bell: 'lucide:bell',

  // ---- 空态 ----
  /* 「空」的语义入口：空收件箱 / 空托盘，mc-empty 的内置图形用它（组件里写 class="mc-icon-empty"） */
  empty: 'lucide:inbox',

  // ---- 主题与播放 ----
  sun: 'lucide:sun',
  moon: 'lucide:moon',
  play: 'lucide:play',
  pause: 'lucide:pause',

  // ---- 财务 ----
  wallet: 'lucide:wallet',
  'credit-card': 'lucide:credit-card',
  banknote: 'lucide:banknote',
  coins: 'lucide:coins',
  calculator: 'lucide:calculator',
  receipt: 'lucide:receipt-text',
  'piggy-bank': 'lucide:piggy-bank',
  landmark: 'lucide:landmark',
  percent: 'lucide:percent',
  scale: 'lucide:scale',

  // ---- 报表 ----
  'chart-bar': 'lucide:chart-bar',
  'chart-line': 'lucide:chart-line',
  'chart-pie': 'lucide:chart-pie',
  'trending-up': 'lucide:trending-up',
  'trending-down': 'lucide:trending-down',
  table: 'lucide:table',
  'file-spreadsheet': 'lucide:file-spreadsheet',

  // ---- 品牌：开发与代码 ----
  /* 品牌图标与语义图标同一条产物（都进 mosaic.css）；品牌 path 大一个量级，预算跟着抬过。
     图形数据是 CC0（simple-icons），但**商标归各自公司**：只作平台标识，别无暗示。见 icons.license.txt。 */
  github: 'simple-icons:github',
  gitlab: 'simple-icons:gitlab',
  gitee: 'simple-icons:gitee',
  docker: 'simple-icons:docker',
  npm: 'simple-icons:npm',
  vue: 'simple-icons:vuedotjs',
  react: 'simple-icons:react',
  svelte: 'simple-icons:svelte',

  // ---- 品牌：国内互联网 ----
  wechat: 'simple-icons:wechat',
  qq: 'simple-icons:qq',
  alibaba: 'simple-icons:alibabadotcom',
  taobao: 'simple-icons:taobao',
  xiaomi: 'simple-icons:xiaomi',
  huawei: 'simple-icons:huawei',
  bilibili: 'simple-icons:bilibili',
  zhihu: 'simple-icons:zhihu',
  weibo: 'simple-icons:sinaweibo',
  baidu: 'simple-icons:baidu',

  // ---- 品牌：国际 ----
  google: 'simple-icons:google',
  apple: 'simple-icons:apple',
  microsoft: 'simple-icons:microsoft',
  amazon: 'simple-icons:amazon',
  youtube: 'simple-icons:youtube',
  x: 'simple-icons:x',
};
