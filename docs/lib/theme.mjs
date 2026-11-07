/* 主题：偏好（auto / light / dark）→ documentElement[data-theme] 的唯一实现。
   顶栏下拉与 iframe 预览都从这里读写；首帧那份在 docs/theme-boot.js（同步脚本，晚不得，import 不了）。 */

/** @typedef {'auto' | 'light' | 'dark'} ThemeMode */
/** @typedef {'light' | 'dark'} ThemeName */

/** @type {readonly ThemeMode[]} */
export const THEMES = ['auto', 'light', 'dark'];

/** @type {Record<ThemeMode, string>} */
export const THEME_LABELS = { auto: '自动', light: '亮色', dark: '暗色' };

const KEY = 'mosaic-doc-theme';
const DARK = '(prefers-color-scheme: dark)';

/** @param {unknown} value @returns {value is ThemeMode} */
const isMode = (value) => THEMES.some((mode) => mode === value);

/** 已存的偏好；读不到 / 非法 → auto @returns {ThemeMode} */
export function storedTheme() {
  try {
    const value = localStorage.getItem(KEY);
    if (isMode(value)) return value;
  } catch {}
  return 'auto';
}

/** 偏好 → 真正落到 data-theme 的那一态 @param {ThemeMode} mode @returns {ThemeName} */
export const resolvedTheme = (mode) =>
  mode === 'auto' ? (window.matchMedia(DARK).matches ? 'dark' : 'light') : mode;

/** 当前实际生效的那一态（给需要跟着翻的地方用，如 iframe 预览） @returns {ThemeName} */
export const currentTheme = () =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

/** 应用并记住（顺便把非法 mode 归到 auto）；返回最终采用的偏好 @param {unknown} mode @returns {ThemeMode} */
export function applyTheme(mode) {
  const next = isMode(mode) ? mode : 'auto';
  document.documentElement.dataset.theme = resolvedTheme(next);
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  return next;
}

/* ---------- 变更通知：全站唯一一处「data-theme 观察 + 系统偏好监听」 ---------- */

/** @type {Set<(theme: ThemeName) => void>} */
const listeners = new Set();
/** @type {MutationObserver | undefined} */
let observer;
/** @type {MediaQueryList | undefined} */
let darkMq;
/** @type {(() => void) | undefined} */
let onSystemChange;

const notify = () => {
  const theme = currentTheme();
  for (const cb of [...listeners]) cb(theme);
};

function startWatching() {
  if (observer) return;
  observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  darkMq = window.matchMedia(DARK);
  /* 系统换色只在「跟随系统」时动手；别的偏好下系统怎么换都不该影响页面 */
  onSystemChange = () => {
    if (storedTheme() === 'auto') applyTheme('auto');
  };
  darkMq.addEventListener('change', onSystemChange);
}

function stopWatching() {
  observer?.disconnect();
  observer = undefined;
  if (onSystemChange) darkMq?.removeEventListener('change', onSystemChange);
  darkMq = undefined;
  onSystemChange = undefined;
}

/**
 * 订阅「主题真的变了」（含系统偏好切换）；返回退订函数，最后一个订阅者走了就停止观察。
 * @param {(theme: ThemeName) => void} cb
 * @returns {() => void}
 */
export function onThemeChange(cb) {
  startWatching();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (!listeners.size) stopWatching();
  };
}
