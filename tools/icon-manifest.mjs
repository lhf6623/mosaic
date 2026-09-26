/**
 * Mosaic 内置图标清单 —— **唯一真相源**。
 *
 * 左边是对外名（我们的稳定 API，写进使用者的 HTML，永不因上游改名而变），
 * 右边是上游「图标集:图标名」（会变：lucide 有 219 个别名、上游还会归档整个集）。
 *
 * 加一个内置图标 = 在这里加一行 + `pnpm icons`（生成物要提交）。使用者的 HTML 一个字都不用改。
 * 选名字时只有两条讲究：
 *   · 用语义名而不是上游名（`close` 而不是 lucide 的 `x`、`trash` 而不是 `trash-2`）；
 *   · 同一语义只留一个名字，别开同义词（别名会让文档与代码搜索都变难）。
 *
 * 许可：ALLOWED_SETS 是硬白名单，`tools/gen-icons.mjs` 会核对每一集的 license.spdx，
 * 不在名单里的集直接构建失败（GPL / CC-BY-NC / 需要署名的 CC-BY 一律进不来）。
 */

/** 内置来源集。裸名（`name="search"`）查不到本地时，远程也按这个集拼 URL（可用 icon-set 覆盖）。 */
export const ICON_SOURCE = 'lucide';

/** 允许出现在内置集里的上游图标集（spdx 白名单在 gen-icons.mjs 里） */
export const ALLOWED_SETS = ['lucide'];

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

  // ---- 语义状态（mc-alert 的四个内置图形对应的就是这四个语义名）----
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

  // ---- 主题与播放 ----
  sun: 'lucide:sun',
  moon: 'lucide:moon',
  play: 'lucide:play',
  pause: 'lucide:pause',
};
