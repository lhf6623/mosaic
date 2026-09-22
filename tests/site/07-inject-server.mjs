/**
 * 站点 · HTML 注入免疫（第 12 节）：模拟 Live Server 的注入，页面模块仍能加载
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default async function run({ check, newPage }) {
/* ------------------------------------------------------------------ *
 * 12. 对静态服务器的 HTML 注入免疫（Live Server 往第一个 body/svg/head 结束标签注入 live-reload；页面模块注释里写这些标签原文会把注入点引到文件顶部，注入内容自带的注释又提前闭合我们的注释，ofa.js 取第一个 script 直接加载失败）
 * ------------------------------------------------------------------ */

const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url)); // 仓库根（这个文件在 tests/site/ 下）
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
    await injPage.close();

    check(
      '页面模块在被 HTML 注入的服务器上仍能加载',
      injState.h1 === 'Mosaic' && injState.art && !injState.art.startsWith('0/'),
      `h1=${injState.h1} · 图案 ${injState.art}${injErrs.length ? ' · ' + injErrs[0] : ''}`,
    );
  }
} finally {
  injectServer.kill();
}
}
