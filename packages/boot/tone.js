/**
 * tone.js —— 任意色（hex / 品牌色）的一处实现：落成 L2 六个令牌写在目标元素上，
 * 靠自定义属性继承，子树里所有消费令牌的组件自动跟着变。
 *
 * 声明式 `<div data-tone="#fff000">`；命令式 `applyTone('#brand', '#fff000')` / `clearTone('#brand')`。
 * 值收 hex（`#fff000` / `#fc0`）或 `"R G B"` 三元组；写别的只警告一次、什么都不改（不猜不降级）。
 *
 * 四条限制：① hex 不随主题翻转（品牌色），但派生档（浅底 / 悬停 / 按下 / 焦点环）跟着主题重算；
 * ② `-fg` 由 WCAG 亮度算，不接受使用者指定；③ 极浅的品牌色在浅底变体上会读不清 ——
 * 语义色有构建期对比度门禁，任意色没有；④ 写的是元素内联 `style`，会盖过同名令牌。
 * 令牌表没加载时只写 primary / -fg，派生档跳过并警告一次。其余见 `packages/README.md` §1.2。
 */

import { mix, parseHex, readToken, readableOn, triple, warnOnce } from './color-math.js';

/** 六个需要写的令牌：一个色族的全套，少一个就有一处不跟着变 */
const TOKENS = [
  '--mc-color-primary',
  '--mc-color-primary-fg',
  '--mc-color-primary-subtle',
  '--mc-color-primary-hover',
  '--mc-color-primary-active',
  '--mc-color-ring',
];

/** 声明式入口的属性名（与 `data-theme` 同风格：全局 data 属性不另加前缀） */
const ATTR = 'data-tone';

/* 颜色：解析 / 令牌回读 / 对比度 / 混合 —— 数学在 color-math.js（与组件的 color="#fff000" 共用），
   这里只多一条"也收 `255 240 0` 三元组"的宽容（data-tone 与令牌同形）。 */

/** `#fff000` / `#fc0` / `255 240 0` → [r, g, b]；不认的返回 null */
function parse(value) {
  const text = String(value ?? '').trim();
  const hex = parseHex(text);
  if (hex) return hex;
  if (!/^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(text)) return null;
  const rgb = text.split(/\s+/).map(Number);
  return rgb.every((n) => n <= 255) ? rgb : null;
}

const warn = (message) => warnOnce(message, `[mosaic] tone：${message}`);

/** 把解析好的颜色写到元素上；令牌读不到时退化为只写必需的两个 */
function paint(el, rgb, opts) {
  const surface = readToken('--mc-color-surface');
  const dir = readToken('--mc-color-fg');
  el.style.setProperty('--mc-color-primary', triple(rgb));
  el.style.setProperty('--mc-color-primary-fg', triple(readableOn(rgb)));
  if (!surface || !dir) {
    warn(
      '读不到 --mc-color-surface / --mc-color-fg，派生档（浅底 / 悬停 / 按下 / 焦点环）跳过 —— mosaic.css 加载了吗？',
    );
    return;
  }
  el.style.setProperty('--mc-color-primary-subtle', triple(mix(rgb, surface, opts.subtle)));
  el.style.setProperty('--mc-color-primary-hover', triple(mix(rgb, dir, opts.step)));
  el.style.setProperty('--mc-color-primary-active', triple(mix(rgb, dir, opts.step * 2)));
  el.style.setProperty('--mc-color-ring', triple(mix(rgb, dir, opts.step)));
}

/** 选择器 / 元素 / 元素列表 → 元素数组（不跨 shadow 边界：这是使用者面的 API，不走内部） */
function resolve(target) {
  if (typeof target === 'string') return [...document.querySelectorAll(target)];
  if (target instanceof Element) return [target];
  if (target && typeof target[Symbol.iterator] === 'function') return [...target];
  return [];
}

/**
 * 给一个元素（含子树）换任意色。
 *
 * @param {string|Element|Iterable<Element>} target 选择器或元素
 * @param {string} color hex（`#fff000` / `#fc0`）或通道三元组（`255 240 0`）
 * @param {{subtle?: number, step?: number}} [opts] 派生档的混合比例，一般不用给
 * @returns {boolean} 是否至少应用成功一个元素（值非法 / 没命中元素 → false，且什么都不改）
 */
export function applyTone(target, color, opts = {}) {
  const els = resolve(target);
  const rgb = parse(color);
  if (!rgb) {
    warn(`"${color}" 不是合法的 hex 或 "R G B" 三元组 —— 没有改动`);
    return false;
  }
  const merged = { subtle: 0.9, step: 0.12, ...opts };
  for (const el of els) el.setAttribute(ATTR, String(color).trim());
  /* 属性观察器会再叫一次 paint（幂等）；这里直接画一遍是为了不依赖观察器的时机 */
  for (const el of els) paint(el, rgb, merged);
  return els.length > 0;
}

/** 撤回任意色：删掉属性、清掉那六个令牌（元素回到语义色） */
export function clearTone(target) {
  const els = resolve(target);
  for (const el of els) {
    el.removeAttribute(ATTR);
    clearPainting(el);
  }
  return els.length > 0;
}

/** 只清令牌，不动属性（`clearTone` 与「使用者直接 removeAttribute」共用） */
function clearPainting(el) {
  for (const name of TOKENS) el.style.removeProperty(name);
}

/* ------------------------------------------------------------------ *
 * 声明式：`data-tone` + 主题变化重算
 * ------------------------------------------------------------------ */

function applyFromAttribute(el) {
  const value = el.getAttribute(ATTR);
  const rgb = parse(value);
  if (!rgb) {
    warn(`元素上的 ${ATTR}="${value}" 不是合法的 hex 或 "R G B" 三元组 —— 没有改动`);
    return;
  }
  paint(el, rgb, { subtle: 0.9, step: 0.12 });
}

/** 主题变了：派生档要按新主题的 surface / fg 重算（hex 本身不变，见文件头限制 ①） */
function reapplyAll() {
  for (const el of document.querySelectorAll(`[${ATTR}]`)) applyFromAttribute(el);
}

function scanAdded(node) {
  if (node.nodeType !== 1) return;
  if (node.hasAttribute?.(ATTR)) applyFromAttribute(node);
  for (const el of node.querySelectorAll?.(`[${ATTR}]`) ?? []) applyFromAttribute(el);
}

/* 引入即生效：先把已经存在的扫一遍（module 是 defer 的，DOM 已就绪） */
reapplyAll();

new MutationObserver((records) => {
  for (const record of records) {
    if (record.type !== 'attributes') {
      for (const node of record.addedNodes) scanAdded(node);
      continue;
    }
    /* 属性变了：有值就应用，被删掉（clearTone 或使用者自己 removeAttribute）就清干净。
       没有这一步，删属性会走进"读到 null 再警告一次"的岔路。 */
    const el = record.target;
    if (el.hasAttribute(ATTR)) applyFromAttribute(el);
    else clearPainting(el);
  }
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: [ATTR], // 只盯这一个属性：我们自己写的 style 不会把回调再叫起来
});

new MutationObserver(reapplyAll).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

/* 「跟随系统」那一态没有 data-theme，靠这条媒体查询兜 */
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reapplyAll);
