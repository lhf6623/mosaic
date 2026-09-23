/** 站点 · 子路径部署（GitHub Pages 项目页 `/<repo>/`）：ofa 把 hash 当相对域名根解析，子路径下会 404 / 高亮错位，所以另起带 --prefix /mosaic 的服务器走一遍。 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default async function run({ check, newPage }) {
  const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url));
  const PORT = 8645;
  const PREFIX = '/mosaic';
  const base = `http://127.0.0.1:${PORT}${PREFIX}/`;

  const server = spawn(
    process.execPath,
    ['tools/serve.mjs', '--port', String(PORT), '--prefix', PREFIX],
    { cwd: ROOT_DIR, stdio: 'ignore' },
  );

  const p = await newPage();
  const failed = [];
  p.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  p.on('pageerror', (e) => failed.push(String(e)));

  const active = () =>
    p.evaluate(() =>
      window.__deepAll('.doc-top-nav a')
        .filter((a) => a.hasAttribute('aria-current'))
        .map((a) => a.textContent.trim())
        .join('/'),
    );
  const h1 = () => p.evaluate(() => window.__deepAll('h1')[0]?.textContent?.trim() ?? null);
  const click = (sel, text) =>
    p.evaluate(
      ([s, t]) =>
        window.__deepAll(s)
          .find((el) => el.textContent.trim() === t)
          ?.click(),
      [sel, text],
    );
  const settle = () => p.waitForTimeout(1600);

  try {
    /* 等带前缀的服务器起来 */
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      try {
        up = (await fetch(`${base}index.html`)).ok;
      } catch {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    check('带 --prefix /mosaic 的服务器起来了', up, base);

    /* ① 打开站点根：默认首页，一级菜单要亮「首页」 */
    await p.goto(base, { waitUntil: 'load' });
    await p
      .waitForFunction(() => window.__deepAll('.doc-top-nav a').length >= 5, { timeout: 10000 })
      .catch(() => {});
    await settle();
    const landing = { active: await active(), h1: await h1() };
    check(
      '子路径落地：首页亮「首页」（不是空高亮）',
      landing.active === '首页' && landing.h1 === 'Mosaic',
      JSON.stringify(landing),
    );

    /* ② 顶栏五个入口逐个点：高亮必须对得上 */
    const tops = [];
    for (const label of ['快速开始', '设计令牌', '规范', '组件', '首页']) {
      await click('.doc-top-nav a', label);
      await settle();
      tops.push({ label, active: await active() });
    }
    check(
      '子路径：顶栏五个入口的高亮全对得上',
      tops.every((t) => t.active === t.label),
      tops.map((t) => `${t.label}→${t.active || '(空)'}`).join(' · '),
    );

    /* ③ 二级菜单（侧栏）能进组件页，且两级菜单同时高亮 */
    await click('.doc-top-nav a', '组件');
    await settle();
    await click('doc-nav a', 'Collapse');
    await settle();
    const side = {
      h1: await h1(),
      top: await active(),
      nav: await p.evaluate(() =>
        window.__deepAll('doc-nav a')
          .filter((a) => a.hasAttribute('aria-current'))
          .map((a) => a.textContent.trim())
          .join('/'),
      ),
    };
    check(
      '子路径：侧栏能进组件页（不是 404），顶栏亮「组件」、侧栏亮「Collapse」',
      side.h1?.startsWith('Collapse') && side.top === '组件' && side.nav === 'Collapse',
      JSON.stringify(side),
    );

    /* ④ 总览页的组件卡片能进组件页 */
    await p.goto(`${base}#${PREFIX}/docs/pages/components.html`, { waitUntil: 'load' });
    await settle();
    await p.evaluate(() => {
      // 卡片文本是「Button 已实现 mc-button 按钮。…」，按 href 找才准
      window.__deepAll('.doc-comp-card')
        .find((c) => (c.getAttribute('href') || '').includes('packages/button/page.html'))
        ?.click();
    });
    await settle();
    const card = { h1: await h1(), top: await active() };
    check(
      '子路径：总览卡片能进组件页（卡片链接也带前缀）',
      card.h1?.startsWith('Button') && card.top === '组件',
      JSON.stringify(card),
    );

    /* ⑤ 面包屑与分页链接 */
    await click('.doc-pager-prev', '← 总览');
    await settle();
    const crumbBack = await h1();
    await p.goto(`${base}#${PREFIX}/packages/collapse/page.html`, { waitUntil: 'load' });
    await settle();
    await click('doc-crumb a', '组件');
    await settle();
    const crumb = await h1();
    check(
      '子路径：面包屑 / 分页链接都能导航',
      crumbBack === '组件' && crumb === '组件',
      `分页→${crumbBack} · 面包屑→${crumb}`,
    );

    /* ⑥ 冷启动深链（地址栏里的 hash 是带前缀的形式） */
    await p.goto(`${base}#${PREFIX}/packages/collapse/page.html`, { waitUntil: 'load' });
    await settle();
    const deep = { h1: await h1(), top: await active() };
    check(
      '子路径：冷启动深链直接打开组件页，且高亮正确',
      deep.h1?.startsWith('Collapse') && deep.top === '组件',
      JSON.stringify(deep),
    );

    /* ⑦ 全程没有 404 / 运行时报错 */
    check(
      '子路径下没有 404 / 运行时报错',
      failed.length === 0,
      failed.join(' | ') || '无',
    );
  } finally {
    await p.close();
    server.kill();
  }
}
