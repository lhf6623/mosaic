/**
 * 日期工具 —— 共享运行时（`packages/boot/` 这一层是「多个组件都要用」的东西，见 packages/README.md）。
 *
 * 当前使用者：`mc-date-picker`；以后 time-picker / calendar / 表格的日期列都该用它，别各写一份。
 *
 * 三条前提（改之前先看）：
 *
 * 1. **日期一律用「本地日历日」的三个数字 `{ y, m, d }` 表示，不走 `Date.parse('YYYY-MM-DD')`** ——
 *    后者按 UTC 解析，东八区上会整体退一天。需要 Date 对象时只借它做「本地时区」的加减。
 * 2. **无 DOM、无组件依赖**：这里只做纯计算，能被任何组件 import，也能被 node 直接单测。
 * 3. **不引第三方**：使用者侧零工具链，这份文件要能直接走 CDN 到浏览器。
 *
 * 月份 / 星期都是 1 基（`m: 1` 是一月）；`weekdayIndex` 例外，返回 0–6 且**周一 = 0**（中文月历排法）。
 */

/* ---------- 类型 ---------- */

/**
 * 一个「本地日历日」：月份 1–12、日 1–31，都是 1 基。
 * @typedef {object} Day
 * @property {number} y 年，四位数（2026）
 * @property {number} m 月，1–12
 * @property {number} d 日，1–31
 */

/**
 * 某一天落在 ISO 周历的哪一周。
 * @typedef {object} WeekInfo
 * @property {number} weekYear ISO 周所属的年 —— 跨年那一周属于「有周四的那一年」，可能不等于日期的年份
 * @property {number} week 周序号，1–53
 */

/**
 * canonical key 覆盖的日期区间：日就是起止同一天，周 / 月 / 年是整段。
 * @typedef {object} Period
 * @property {Day} start 区间第一天
 * @property {Day} end 区间最后一天
 */

/**
 * 格式串编译结果：`regex` 用来解析输入、`parts` 用来输出、`order` 记录捕获组与字段的对应。
 * @typedef {object} CompiledFormat
 * @property {Array<{ kind: 'literal', text: string } | { kind: 'token', token: string }>} parts
 * @property {RegExp} regex
 * @property {Array<{ field: 'year' | 'month' | 'day' | 'week', twoDigit?: boolean }>} order
 */

/* ---------- 基础 ---------- */

/**
 * 两位补零（`7` → `'07'`）。
 * @param {number | string} value
 * @returns {string}
 */
export const pad2 = (value) => String(value).padStart(2, '0');

/**
 * 四种选择粒度各自的「标准格式」—— 也是格式非法时的回退值。
 * @type {Record<string, string>}
 */
export const TYPE_DEFAULTS = {
  day: 'YYYY-MM-DD',
  week: 'YYYY-[W]WW',
  month: 'YYYY-MM',
  year: 'YYYY',
};

/**
 * 日历日 → `YYYY-MM-DD`。
 * @param {Day} date
 * @returns {string}
 */
export const isoOf = (date) => date.y + '-' + pad2(date.m) + '-' + pad2(date.d);

/**
 * 三个数字是不是一个真实存在的日子（挡掉 2 月 30 日、13 月这种）。
 * @param {Day | null | undefined} date
 * @returns {boolean}
 */
export const isRealDate = (date) => {
  if (
    !date ||
    !Number.isInteger(date.y) ||
    !Number.isInteger(date.m) ||
    !Number.isInteger(date.d)
  ) {
    return false;
  }
  /* 用 2000 年做底座再 setFullYear：Date 会把 0–99 当 1900–1999 */
  const probe = new Date(2000, date.m - 1, date.d);
  probe.setFullYear(date.y);
  return (
    probe.getFullYear() === date.y && probe.getMonth() === date.m - 1 && probe.getDate() === date.d
  );
};

/**
 * `YYYY-MM-DD` → 日历日；格式不对或不存在的日子给 `null`。
 * @param {unknown} raw
 * @returns {Day | null}
 */
export const parseIso = (raw) => {
  const text = String(raw ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const date = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  return isRealDate(date) ? date : null;
};

/**
 * 今天（本地时区）。
 * @returns {Day}
 */
export const todayDate = () => {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
};

/* ---------- 加减 ---------- */

/**
 * 加减天数（跨月 / 跨年 / 闰年都交给 Date 算）。
 * @param {Day} date
 * @param {number} delta 正数往后、负数往前
 * @returns {Day}
 */
export const addDays = (date, delta) => {
  const next = new Date(date.y, date.m - 1, date.d + delta);
  return { y: next.getFullYear(), m: next.getMonth() + 1, d: next.getDate() };
};

/**
 * 某年某月有多少天（`month` 超出 1–12 时按 Date 的滚动规则算）。
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
export const monthLength = (year, month) => new Date(year, month, 0).getDate();

/**
 * 加月：目标月没有那一天时**收到月末**（1 月 31 日 + 1 个月 = 2 月 28/29 日）。
 * @param {Day} date
 * @param {number} delta
 * @returns {Day}
 */
export const addMonths = (date, delta) => {
  const total = date.y * 12 + (date.m - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(date.d, monthLength(y, m)) };
};

/**
 * 加年：2 月 29 日 + 1 年落到平年时**收到 2 月 28 日**。
 * @param {Day} date
 * @param {number} delta
 * @returns {Day}
 */
export const addYears = (date, delta) => {
  const y = date.y + delta;
  return { y, m: date.m, d: Math.min(date.d, monthLength(y, date.m)) };
};

/* ---------- 周 / 差值 ---------- */

/**
 * 星期几：周一 = 0 … 周日 = 6（中国常见的月历排法）。
 * @param {Day} date
 * @returns {number}
 */
export const weekdayIndex = (date) => (new Date(date.y, date.m - 1, date.d).getDay() + 6) % 7;

/**
 * 三个数字 → UTC 毫秒（只用来算「差几天」，避开夏令时那 1 小时）。
 * @param {Day} date
 * @returns {number}
 */
const utcDay = (date) => Date.UTC(date.y, date.m - 1, date.d);

/**
 * `a - b` 相差几天。
 * @param {Day} a
 * @param {Day} b
 * @returns {number}
 */
export const dayDiff = (a, b) => Math.round((utcDay(a) - utcDay(b)) / 86400000);

/**
 * 该日期所属的 ISO 周（周一为一周开始）。
 * ⚠️ `weekYear` 可能和 `date.y` 不同 —— 跨年那一周属于「有周四的那一年」。
 * @param {Day} date
 * @returns {WeekInfo}
 */
export const isoWeekInfo = (date) => {
  const thursday = addDays(date, 3 - weekdayIndex(date));
  const weekYear = thursday.y;
  const jan4 = { y: weekYear, m: 1, d: 4 };
  const week1 = addDays(jan4, -weekdayIndex(jan4));
  return { weekYear, week: Math.floor(dayDiff(thursday, week1) / 7) + 1 };
};

/**
 * ISO 周 → 那一周的周一。
 * @param {number} weekYear
 * @param {number} week
 * @returns {Day}
 */
export const mondayOfWeek = (weekYear, week) => {
  const jan4 = { y: weekYear, m: 1, d: 4 };
  return addDays(addDays(jan4, -weekdayIndex(jan4)), (week - 1) * 7);
};

/* ---------- 值 ↔ canonical key ----------
 * canonical key 是「这个粒度选中的值」的标准写法：`YYYY-MM-DD` / `YYYY-Www` / `YYYY-MM` / `YYYY`。
 * 组件对外暴露的值一律走它，跟显示格式（format）解耦。 */

/**
 * 日期 + 粒度 → canonical key。
 * @param {Day} date
 * @param {string} type `'day' | 'week' | 'month' | 'year'`
 * @returns {string}
 */
export const keyOfDate = (date, type) => {
  if (type === 'week') {
    const info = isoWeekInfo(date);
    return info.weekYear + '-W' + pad2(info.week);
  }
  if (type === 'month') return date.y + '-' + pad2(date.m);
  if (type === 'year') return String(date.y);
  return isoOf(date);
};

/**
 * canonical key → 它覆盖的日期区间（周 / 月 / 年都有起止；日就是起止同一天）。
 * @param {string | null | undefined} key
 * @param {string} type `'day' | 'week' | 'month' | 'year'`
 * @returns {Period | null} 不合法给 `null`
 */
export const periodOfKey = (key, type) => {
  const text = String(key || '');
  if (type === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(text);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m < 1 || m > 12) return null;
    return { start: { y, m, d: 1 }, end: { y, m, d: monthLength(y, m) } };
  }
  if (type === 'year') {
    const match = /^(\d{4})$/.exec(text);
    if (!match) return null;
    const y = Number(match[1]);
    return { start: { y, m: 1, d: 1 }, end: { y, m: 12, d: 31 } };
  }
  if (type === 'week') {
    const match = /^(\d{4})-W(\d{2})$/.exec(text);
    if (!match) return null;
    const weekYear = Number(match[1]);
    const week = Number(match[2]);
    if (week < 1 || week > 53) return null;
    const start = mondayOfWeek(weekYear, week);
    const info = isoWeekInfo(start);
    if (info.weekYear !== weekYear || info.week !== week) return null;
    return { start, end: addDays(start, 6) };
  }
  const date = parseIso(text);
  return date ? { start: date, end: date } : null;
};

/* ---------- 格式串 ----------
 * 支持的 token：YYYY / YY / MM / M / DD / D / WW / W；方括号里是字面量（`YYYY-[W]WW` 的 W）。
 * 按 type 校验必需字段：day 要 年/月/日、week 要 年/周、month 要 年/月、year 只要年。 */

/**
 * 转义正则元字符（格式串里的字面量段）。
 * @param {string} text
 * @returns {string}
 */
const escapeRegExp = (text) => text.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');

/**
 * 把格式串编译成「解析正则 + 字段顺序」。
 * @param {string | null | undefined} pattern
 * @param {string} type `'day' | 'week' | 'month' | 'year'`
 * @returns {CompiledFormat | null} 格式不合法（缺必需字段 / 多了不属于该粒度的字段）给 `null`
 */
export const compileFormat = (pattern, type) => {
  const text = String(pattern || '');
  if (!text) return null;
  /** @type {Record<string, string[]>} */
  const requiredByType = {
    day: ['year', 'month', 'day'],
    week: ['year', 'week'],
    month: ['year', 'month'],
    year: ['year'],
  };
  const required = requiredByType[type] || requiredByType.day;
  const allowed = new Set(required);
  /** @type {CompiledFormat['parts']} */
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(/\[([^\]]*)\]|YYYY|YY|WW|W|MM|M|DD|D/g)) {
    if (match.index > last) parts.push({ kind: 'literal', text: text.slice(last, match.index) });
    if (match[1] !== undefined) parts.push({ kind: 'literal', text: match[1] });
    else parts.push({ kind: 'token', token: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'literal', text: text.slice(last) });

  let source = '^';
  /** @type {CompiledFormat['order']} */
  const order = [];
  /** @type {Record<string, number>} */
  const seen = { year: 0, month: 0, day: 0, week: 0 };
  for (const part of parts) {
    if (part.kind === 'literal') {
      source += escapeRegExp(part.text);
      continue;
    }
    switch (part.token) {
      case 'YYYY':
        source += '(\\d{4})';
        order.push({ field: 'year', twoDigit: false });
        seen.year += 1;
        break;
      case 'YY':
        source += '(\\d{2})';
        order.push({ field: 'year', twoDigit: true });
        seen.year += 1;
        break;
      case 'MM':
        source += '(\\d{2})';
        order.push({ field: 'month' });
        seen.month += 1;
        break;
      case 'M':
        source += '(\\d{1,2})';
        order.push({ field: 'month' });
        seen.month += 1;
        break;
      case 'DD':
        source += '(\\d{2})';
        order.push({ field: 'day' });
        seen.day += 1;
        break;
      case 'D':
        source += '(\\d{1,2})';
        order.push({ field: 'day' });
        seen.day += 1;
        break;
      case 'WW':
        source += '(\\d{2})';
        order.push({ field: 'week' });
        seen.week += 1;
        break;
      default:
        source += '(\\d{1,2})';
        order.push({ field: 'week' });
        seen.week += 1;
        break;
    }
  }
  source += '$';
  if (!required.every((field) => seen[field] === 1)) return null;
  for (const field of Object.keys(seen)) {
    if (!allowed.has(field) && seen[field] > 0) return null;
  }
  return { parts, regex: new RegExp(source), order };
};

/** 编译结果按「type | pattern」缓存：同一个格式串在每次渲染里会被反复用到 @type {Map<string, CompiledFormat | null>} */
const FORMAT_CACHE = new Map();

/** 格式非法只提醒一次（同一个串刷屏没意义）@type {Set<string>} */
const FORMAT_WARNED = new Set();

/**
 * 取编译结果；格式非法时回退该粒度的标准格式，并提醒一次。
 * @param {string | null | undefined} pattern
 * @param {string} type
 * @returns {CompiledFormat | null}
 */
const compiledFormat = (pattern, type) => {
  const key = type + '|' + String(pattern || '');
  if (FORMAT_CACHE.has(key)) return FORMAT_CACHE.get(key) ?? null;
  const own = compileFormat(pattern, type);
  const fallback = own || compileFormat(TYPE_DEFAULTS[type] || TYPE_DEFAULTS.day, type);
  if (!own && pattern && !FORMAT_WARNED.has(key)) {
    FORMAT_WARNED.add(key);
    console.warn('[mosaic] 日期格式无效：' + pattern + '（type=' + type + '，已回退默认格式）');
  }
  FORMAT_CACHE.set(key, fallback);
  return fallback;
};

/**
 * canonical key → 按 pattern 显示出来的文本。
 * @param {string} key
 * @param {string | null | undefined} pattern
 * @param {string} type
 * @returns {string} key 不合法 / 解析不出时给空串
 */
export const formatKey = (key, pattern, type) => {
  const period = periodOfKey(key, type);
  if (!period) return '';
  const date = period.start;
  const info = type === 'week' ? isoWeekInfo(date) : null;
  const compiled = compiledFormat(pattern, type);
  if (!compiled) return '';
  let out = '';
  for (const part of compiled.parts) {
    if (part.kind === 'literal') {
      out += part.text;
      continue;
    }
    switch (part.token) {
      case 'YYYY':
        out += String(info ? info.weekYear : date.y).padStart(4, '0');
        break;
      case 'YY':
        out += pad2((info ? info.weekYear : date.y) % 100);
        break;
      case 'MM':
        out += pad2(date.m);
        break;
      case 'M':
        out += String(date.m);
        break;
      case 'DD':
        out += pad2(date.d);
        break;
      case 'D':
        out += String(date.d);
        break;
      case 'WW':
        out += pad2(info ? info.week : 0);
        break;
      default:
        out += String(info ? info.week : 0);
        break;
    }
  }
  return out;
};

/**
 * 用户敲进来的文本 → canonical key。
 * @param {unknown} raw
 * @param {string | null | undefined} pattern
 * @param {string} type
 * @returns {string | null} 解析不出 / 不是合法日期时给 `null`
 */
export const parseKey = (raw, pattern, type) => {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const compiled = compiledFormat(pattern, type);
  if (!compiled) return null;
  const match = compiled.regex.exec(text);
  if (!match) return null;
  /** @type {Record<string, number>} */
  const fields = { year: 0, month: 0, day: 0, week: 0 };
  compiled.order.forEach((item, index) => {
    const value = Number(match[index + 1]);
    if (item.field === 'year') {
      /* 两位年份按 POSIX 惯例分界：00–69 → 20xx，70–99 → 19xx */
      fields.year = item.twoDigit ? (value <= 69 ? 2000 + value : 1900 + value) : value;
    } else {
      fields[item.field] = value;
    }
  });
  if (type === 'day') {
    const date = { y: fields.year, m: fields.month, d: fields.day };
    return isRealDate(date) ? isoOf(date) : null;
  }
  if (type === 'week') {
    if (fields.week < 1 || fields.week > 53) return null;
    const monday = mondayOfWeek(fields.year, fields.week);
    const info = isoWeekInfo(monday);
    if (info.weekYear !== fields.year || info.week !== fields.week) return null;
    return fields.year + '-W' + pad2(fields.week);
  }
  if (type === 'month') {
    if (fields.month < 1 || fields.month > 12) return null;
    return fields.year + '-' + pad2(fields.month);
  }
  return String(fields.year);
};
