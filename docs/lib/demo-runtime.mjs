/**
 * demo-runtime.mjs —— 组件文档页「可编辑示例」的运行时编译（站点内部工具，不随组件发布）。
 *
 * 一段编辑后的 demo 源码怎么变成能渲染的组件：ofa 4.7.5 的 `$.register` 是公开 API
 * （它自己的 html 模块加载器最后一步就是调它），传入 `{ tag, temp, data, proto, ready, … }`
 * 即可注册一个组件。于是「编辑后看效果」不需要服务器、也不需要 iframe：
 * 把 demo 文件原文拆成 temp + 组件配置，换一个新 tag 注册出来就行。
 *
 * ofa 的 html 加载器平常替我们做的三件事，这里必须自己做：
 *   ① 去掉 `<template component>` 外壳，只把内部标记交给 temp；
 *   ② script 里的相对 import 改成绝对地址 —— 脚本走 blob 模块执行，blob 没有目录，
 *      `../../message/message.js` 这种地址解不出来；
 *   ③ 标记里的相对 href/src（含 <style> 的 url()）按 demo 文件地址重写 —— 同一份源码
 *      既可能从 `/packages/x/demos/` 下加载，也可能来自编辑器的内存文本。
 *
 * ⚠️ 示例文件仍是唯一源：编辑器里看到的、预览编译的都是 demos/*.html 的同一份文本，
 *    没有第二份片段会漂移。
 */

/** 同一 URL 的源码只取一次（页面里可能既被示例加载、又被编辑器读） */
const textByUrl = new Map();

/**
 * 取 demo 文件原文（带缓存）。
 * @param {string} url 绝对地址
 * @returns {Promise<string>}
 */
export function loadDemoText(url) {
  if (!textByUrl.has(url)) {
    const promise = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`示例文件加载失败：HTTP ${res.status} · ${url}`);
      return res.text();
    })();
    textByUrl.set(url, promise);
    promise.catch(() => textByUrl.delete(url)); // 失败不缓存，允许重试
  }
  return textByUrl.get(url);
}

/**
 * 去公共缩进：和 mc-code 同一套口径（制表符按两个空格算）
 * @param {string} text
 * @returns {string}
 */
function dedent(text) {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    .split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  let indent = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    indent = Math.min(indent, line.length - line.trimStart().length);
  }
  if (Number.isFinite(indent) && indent > 0) return lines.map((l) => l.slice(indent)).join('\n');
  return lines.join('\n');
}

const OPEN_TAG = /<template\s+component[^>]*>/i;
const CLOSE_TAG = '</template>';
/** 收尾的 <script> 块：demo 约定「一个脚本、放在最后」（235 个 demo 全量核对过） */
const TRAILING_SCRIPT = /\n[ \t]*<script>([\s\S]*?)<\/script>[ \t]*$/;

/**
 * @typedef {object} DemoSource
 * @property {string} inner  编辑器里显示的源码（去掉外壳、已去公共缩进）
 * @property {string} markup 预览用的标记（不含收尾 script 块）
 * @property {string} script 收尾 script 的内容（可能为空串）
 */

/**
 * 把 demo 源码拆成「编辑器文本」与「编译用标记 / 脚本」。
 *
 * 两种入参都要认：
 *   · demo 文件原文（带 `<template component>` 外壳）—— 打开抽屉时从文件读到的；
 *   · 外壳内部的源码（编辑器里的当前文本）—— 「运行」时拿到的，外壳已经去掉。
 * 不认第二种就会一运行就报「找不到 <template component> 外壳」。
 * @param {string} text
 * @returns {DemoSource}
 */
export function parseDemoSource(text) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  const open = OPEN_TAG.exec(src);
  let body = src;
  if (open) {
    const afterOpen = src.slice(open.index + open[0].length);
    const closeAt = afterOpen.lastIndexOf(CLOSE_TAG);
    if (closeAt < 0) throw new Error('示例文件里找不到 </template> 收尾');
    body = afterOpen.slice(0, closeAt);
  }

  const inner = dedent(body);
  const scriptMatch = TRAILING_SCRIPT.exec(inner);
  const markup = (scriptMatch ? inner.slice(0, scriptMatch.index) : inner).trim();
  if (!markup) throw new Error('示例文件里没有可预览的标记');
  return { inner, markup, script: scriptMatch ? scriptMatch[1] : '' };
}

/**
 * 相对地址才算「要重写」；协议地址 / 协议相对地址 / 纯锚点原样保留
 * @param {string | null} value
 * @returns {boolean}
 */
const isRelativeUrl = (value) =>
  typeof value === 'string' && value !== '' && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);

/**
 * @param {string} value
 * @param {string} baseUrl
 * @returns {string}
 */
const toAbsolute = (value, baseUrl) => {
  if (!isRelativeUrl(value)) return value;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
};

/**
 * script 里的相对 import 改成绝对地址（静态 import / export … from / 动态 import）。
 * 只认 import / export 语句里的 from 与裸 import —— 普通字符串不动。
 * @param {string} code
 * @param {string} baseUrl demo 文件的绝对地址
 * @returns {string}
 */
export function rebaseImports(code, baseUrl) {
  return String(code ?? '')
    .replace(/(\bfrom\s*|\bimport\s*)(['"])([^'"\n]+)\2/g, (match, prefix, quote, spec) => {
      const absolute = toAbsolute(spec, baseUrl);
      return absolute === spec ? match : prefix + quote + absolute + quote;
    })
    .replace(/\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g, (match, quote, spec) => {
      const absolute = toAbsolute(spec, baseUrl);
      return absolute === spec ? match : 'import(' + quote + absolute + quote + ')';
    });
}

/**
 * 标记里的相对 href / src 与 <style> 里的 url() 按 demo 文件地址重写
 * （面包屑、下拉、mc-code 的 src 等 10 多个 demo 用到）。
 * @param {string} markup
 * @param {string} baseUrl
 * @returns {string}
 */
export function rebaseMarkup(markup, baseUrl) {
  const template = document.createElement('template');
  template.innerHTML = markup;

  for (const el of template.content.querySelectorAll('[href], [src]')) {
    for (const attr of ['href', 'src']) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const absolute = toAbsolute(value, baseUrl);
      if (absolute !== value) el.setAttribute(attr, absolute);
    }
  }

  for (const style of template.content.querySelectorAll('style')) {
    style.textContent = (style.textContent ?? '').replace(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
      (match, quote, value) => {
        const absolute = toAbsolute(value.trim(), baseUrl);
        return absolute === value.trim() ? match : `url(${quote}${absolute}${quote})`;
      },
    );
  }

  return template.innerHTML;
}

let tagSeq = 0;

/** 每次运行都换一个新 tag：自定义元素不能重复注册，旧实例留在注册表里无妨 */
export function nextDemoTag() {
  tagSeq += 1;
  return `demo-live-${tagSeq}`;
}

/**
 * 合法自定义元素名（小写、以字母开头、必须带连字符）
 * @param {unknown} value
 * @returns {boolean}
 */
const isCustomTag = (value) =>
  typeof value === 'string' && /^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(value);

/**
 * 把 demo 源码编译成组件并注册，返回可直接 createElement 的 tag。
 *
 * `reuseTag = true`（初始预览用）保留 demo 文件自己声明的标签（如 `demo-alert-colors`）：
 * 测试按这个标签查页面里的演示，SPA 间来回换页时标签已经注册过、直接复用定义即可。
 * 编辑后的预览一律换新标签（自定义元素不能重复注册）。
 *
 * @param {{ text: string, url: string, reuseTag?: boolean }} options
 *   text = 编辑器里的源码 / 文件内部源码，url = demo 文件地址
 * @returns {Promise<string>}
 */
export async function compileDemo({ text, url, reuseTag = false }) {
  const { markup, script } = parseDemoSource(text);
  /** @type {Record<string, any>} */
  let config = {};

  if (script.trim()) {
    const code = rebaseImports(script, url);
    const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    try {
      /** @type {any} */
      const mod = await import(/* @vite-ignore */ blobUrl);
      const preset = mod.default;
      if (typeof preset === 'function') config = (await preset({ url, load: null })) ?? {};
      else if (preset && typeof preset === 'object') config = { ...preset };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`脚本执行失败：${message}`, { cause: error });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  const tag = reuseTag && isCustomTag(config.tag) ? config.tag : nextDemoTag();
  /* 换页回来时同一个 demo 标签已经注册过（自定义元素不能重复注册）：直接复用那个定义 */
  if (customElements.get(tag)) return tag;

  const ofa = /** @type {any} */ (globalThis).$;
  if (!ofa?.register) throw new Error('ofa.js 的 $.register 不可用（页面没加载 ofa？）');

  try {
    ofa.register({ ...config, tag, temp: rebaseMarkup(markup, url) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`组件注册失败：${message}`, { cause: error });
  }
  return tag;
}
