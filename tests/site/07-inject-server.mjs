/**
 * 站点 · HTML 注入免疫（第 12 节）：模拟 Live Server 的注入，页面模块与**组件模块**仍能加载
 *
 * Live Server 往 HTML 里注入 live-reload script，规则是「注入点依次找 body / svg / head 的结束
 * 标签，取第一个命中处」——**纯文本替换、不看上下文**。而 ofa.js 取文件里的**第一个 `<script>`**
 * 当模块：注入的 script 一旦排在前面就抢走它，报「加载组件模块出错」。
 * 所以不变量是：任何一个 .html（页面模块、组件本体、演示文件）里，注入点要么不存在，
 * 要么必须排在第一个 `<script>` 之后。
 *
 * 这里两条各管一段：静态扫描（全仓 .html，不启浏览器）+ 真浏览器（拿注入服务器跑一遍会撞的页面）。
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default async function run({ check, newPage }) {
/* ------------------------------------------------------------------ *
 * 12.1 静态不变量：全仓 .html 的注入点都必须排在第一个 <script> 之后
 * ------------------------------------------------------------------ */

/** Live Server 的注入位置（规则照抄 tools/serve.mjs 的 injectLikeLiveServer） */
function injectionPoint(html) {
  const candidates = [/<\/body>/i, /<\/svg>/, /<\/head>/i];
  for (const re of candidates) {
    const m = re.exec(html);
    if (m) return { index: m.index, mark: m[0] };
  }
  return null;
}

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const htmlFiles = (() => {
  const out = ['index.html'];
  const skip = new Set(['node_modules', '.git', '.dsh']);
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(`${rootDir}${dir}`, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const rel = `${dir}${entry.name}`;
      if (entry.isDirectory()) walk(`${rel}/`, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith('.html')) out.push(`${prefix}${entry.name}`);
    }
  };
  walk('/docs/', 'docs/');
  walk('/packages/', 'packages/');
  return out;
})();

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const vulnerable = [];
for (const rel of htmlFiles) {
  const html = readFileSync(`${rootDir}${rel}`, 'utf8');
  const point = injectionPoint(html);
  if (!point) continue; // 三个结束标签都没有 → live-server 也不注入，天然免疫
  const script = /<script[^>]*>/i.exec(html);
  if (!script || point.index < script.index) {
    vulnerable.push(
      `${rel}:${lineOf(html, point.index)} 的 ${point.mark} 排在第一个 <script> 之前` +
        `${script ? `（第 ${lineOf(html, script.index)} 行）` : '（文件里根本没有 <script>）'}`,
    );
  }
}

check(
  `${htmlFiles.length} 个 .html 的注入点都排在第一个 <script> 之后（注入抢不走 ofa 的模块）`,
  vulnerable.length === 0,
  vulnerable.length ? vulnerable.join('\n        ') : '无内联 svg / 无提前的 body 结束标签',
);

/* ------------------------------------------------------------------ *
 * 12.2 真浏览器：在注入服务器上跑一遍「内联 svg 会撞」的那类页面
 * ------------------------------------------------------------------ */

const ROOT_DIR = rootDir;
const INJECT_PORT = 8643;
const injectServer = spawn(
  process.execPath,
  ['tools/serve.mjs', '--port', String(INJECT_PORT), '--inject'],
  { cwd: ROOT_DIR, stdio: 'ignore' },
);

const injectReady = await (async () => {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${INJECT_PORT}/index.html`);
      if (res.ok) return true;
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
})();

try {
  check('模拟注入的服务器起来了', injectReady, `端口 ${INJECT_PORT}`);

  if (injectReady) {
    const injPage = await newPage();
    const injErrs = [];
    injPage.on('pageerror', (e) => injErrs.push(String(e)));
    injPage.on('console', (m) => {
      if (m.type() === 'error') injErrs.push(m.text());
    });

    await injPage.goto(`http://127.0.0.1:${INJECT_PORT}/index.html`, { waitUntil: 'load' });
    await injPage.waitForTimeout(2200);
    const injState = await injPage.evaluate(() => {
      const art = window.__deep('.poster-art');
      return {
        h1: window.__deep('h1')?.textContent?.trim() ?? null,
        art: art
          ? ['far', 'mid', 'near']
              .map((k) => art.querySelector(`[data-layer="${k}"]`)?.querySelectorAll('.art-bit').length ?? 0)
              .join('/')
          : null,
      };
    });

    check(
      '页面模块在被 HTML 注入的服务器上仍能加载',
      injState.h1 === 'Mosaic' && injState.art && !injState.art.startsWith('0/'),
      `h1=${injState.h1} · 图案 ${injState.art}${injErrs.length ? ' · ' + injErrs[0] : ''}`,
    );

    /* 组件本体走的是另一条路：<l-m src="…/*.html"> 拉的是**组件文件本身**，
       文件里任何注入点都会让 ofa 取错模块（alert 的内联 svg 就这么栽过）。
       用文档页把「组件 + 演示」整条链路跑一遍，断言实例真的升级、图形真的建出来。 */
    const compErrs = [];
    injPage.on('pageerror', (e) => compErrs.push(String(e)));
    await injPage.goto(`http://127.0.0.1:${INJECT_PORT}/index.html?inj=alert#/packages/alert/page.html`, {
      waitUntil: 'load',
    });
    await injPage
      .waitForFunction(
        () => {
          const deep = (root, sel, out = []) => {
            for (const el of root.querySelectorAll('*')) {
              if (el.matches?.(sel)) out.push(el);
              if (el.shadowRoot) deep(el.shadowRoot, sel, out);
            }
            return out;
          };
          const all = deep(document, 'mc-alert');
          /* 内置图形由 mc-icon 异步渲染（它要先等样式表 adopt）—— 等它真的落进 shadow 再断言 */
          const glyph = all[0]?.shadowRoot
            ?.querySelector('mc-icon.mc-glyphs')
            ?.shadowRoot?.querySelector('.mc-glyph[class*="mc-icon-"]');
          return all.length > 0 && all.every((el) => !!el.shadowRoot) && !!glyph;
        },
        { timeout: 15000 },
      )
      .catch(() => {});
    const compState = await injPage.evaluate(() => {
      const deep = (root, sel, out = []) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.matches?.(sel)) out.push(el);
          if (el.shadowRoot) deep(el.shadowRoot, sel, out);
        }
        return out;
      };
      const all = deep(document, 'mc-alert');
      const first = all[0];
      const iconHost = first?.shadowRoot?.querySelector('mc-icon.mc-glyphs');
      return {
        total: all.length,
        upgraded: all.filter((el) => !!el.shadowRoot).length,
        /* 内置图形已经搬进 mc-icon：本组件的 shadow 里只有 1 个 mc-icon 实例，
           图形本体在它的 shadow 里 —— 所以「结构真的建出来」要往下钻一层看 */
        icons: first?.shadowRoot?.querySelectorAll('mc-icon.mc-glyphs').length ?? 0,
        glyph: iconHost?.shadowRoot?.querySelector('.mc-glyph[class*="mc-icon-"]')?.getAttribute('class') ?? null,
      };
    });
    await injPage.close();

    check(
      '组件模块在被 HTML 注入的服务器上仍能加载（实例全部升级、内部结构真的建出来）',
      compState.total > 0 &&
        compState.upgraded === compState.total &&
        compState.icons === 1 &&
        (compState.glyph ?? '').includes('mc-icon-info'),
      `${compState.upgraded}/${compState.total} 升级 · 图标容器 ${compState.icons} 个 · 图形 ${compState.glyph ?? '(未渲染)'}${
        compErrs.length ? ' · ' + compErrs[0] : ''
      }`,
    );
  }
} finally {
  injectServer.kill();
}
}
