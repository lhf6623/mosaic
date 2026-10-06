/**
 * color-math.js —— 颜色字面量的一处数学：hex 解析 / WCAG 文字色 / 混色 / 读令牌。
 * 组件不直接引它，引 `color-attr.js`（将来换算法只有一处要改）。
 */

/** 长度为 3 的 [r, g, b]，每个 0~255 @typedef {number[]} RGB */

/**
 * `#fff000` / `#fc0` → [255, 240, 0]；不认的返回 null（调用方决定怎么说）
 * @param {unknown} value
 * @returns {RGB | null}
 */
export function parseHex(value) {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/**
 * 令牌 → [r, g, b]（令牌存的是裸三元组）；读不到返回 null（样式表还没就位）
 * @param {string} name
 * @returns {RGB | null}
 */
export function readToken(name) {
  const parts = (
    getComputedStyle(document.documentElement).getPropertyValue(name).match(/\d+/g) ?? []
  )
    .slice(0, 3)
    .map(Number);
  return parts.length === 3 ? parts : null;
}

/** @param {number} v @returns {number} */
const linear = (v) => ((v /= 255), v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/**
 * WCAG 相对亮度（0~1）
 * @param {RGB} rgb
 * @returns {number}
 */
export const luminance = ([r, g, b]) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/**
 * WCAG 对比度（1~21）：判断"这个底配这个字"够不够 4.5:1
 * @param {RGB} a
 * @param {RGB} b
 * @returns {number}
 */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 按 WCAG 相对亮度选文字色：亮底黑字、暗底白字（阈值 0.35 ≈ 4.5:1 的临界）
 * @param {RGB} rgb
 * @returns {RGB}
 */
export const readableOn = (rgb) => (luminance(rgb) > 0.35 ? [0, 0, 0] : [255, 255, 255]);

/**
 * 线性混色：a 向 b 走 t（0~1）
 * @param {RGB} a
 * @param {RGB} b
 * @param {number} t
 * @returns {RGB}
 */
export const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/**
 * [r, g, b] → 令牌要的 "R G B" 三元组
 * @param {RGB} rgb
 * @returns {string}
 */
export const triple = (rgb) => rgb.join(' ');

/** 同一个 key 只警告一次 —— 属性变更、DOM 变更会把回调叫起来很多次 */
/** @type {Set<string>} */
const warned = new Set();

/**
 * @param {string} key
 * @param {string} message
 */
export function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}
