/**
 * 站点 · 启动与色板（第 12.x 节）：色板回读 tokens.css、冷启动占位、入口与布局页
 */
import { ALL, READY } from '../../docs/components.js';

export default async function run({ page, visit, goHash, pageState, check, BASE, newPage }) {
/* ------------------------------------------------------------------ *
 * 12. 色板是从真实 tokens.css 解析渲染的
 * ------------------------------------------------------------------ */

await goHash('packages/color/page.html');
const tokensState = await pageState();
check('令牌文档页可获取', tokensState.h1 === '设计令牌', `h1=${tokensState.h1}`);
check('色板渲染出 66 个色块（6 色族 × 11 档）', tokensState.paletteRows === 6, `6 个色族 / ${tokensState.paletteRows} 行`);

/* ------------------------------------------------------------------ *
 * 12.2 【回归】直接带 hash 冷启动，页面占位也要渲染出来（曾坏过：收工条件是「.doc-body 变了一个」，首页挂上就成立，真正那页的占位永远没人渲染；现在改成「o-page 的 src 已经是 hash 指向的页面」）
 * ------------------------------------------------------------------ */

const freshLoads = await (async () => {
  const p = await newPage();
  const out = [];
  for (const [url, sel] of [
    ['/index.html#/docs/pages/components.html', '.doc-comp-card'],
    ['/index.html#/packages/color/page.html', '.doc-palette-row'],
  ]) {
    await visit(p, url);
    await p.waitForTimeout(1500);
    const count = await p.evaluate((s) => {
      const all = (query, root = document, acc = []) => {
        for (const el of root.querySelectorAll(query)) acc.push(el);
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) all(query, el.shadowRoot, acc);
        }
        return acc;
      };
      return all(s).length;
    }, sel);
    out.push({ url, sel, count });
  }
  await p.close();
  return out;
})();
check(
  '直接带 hash 冷启动也渲染页面占位（卡片 / 色板）',
  freshLoads[0].count === ALL.length && freshLoads[1].count === 6,
  freshLoads.map((f) => `${f.url} → ${f.sel} ${f.count} 个`).join(' · '),
);

/* ------------------------------------------------------------------ *
 * 12.3 入口只做引入，外壳由布局页 docs/layout.html 提供（ofa.js 嵌套路由；子页面用 export const parent 挂上去，漏一个那一页就掉出外壳）
 * ------------------------------------------------------------------ */

const entryHtml = await (await fetch(`${BASE}/index.html`)).text();
const bodyStart = entryHtml.indexOf('<body');
const bodyEnd = entryHtml.indexOf('</body>');
const entryBody = entryHtml.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd);
// 注释里的 <l-m> / <o-app> 只是说明文字，不算内容标记 —— 先去掉注释再看
const entryBodyMarkup = entryBody.replace(/<!--[\s\S]*?-->/g, '');
check(
  'index.html 只做引入：body 里只有路由库 + o-app 挂载点，没有外壳标记',
  bodyStart > -1 &&
    /href="\.\/docs\/shell\.css"/.test(entryHtml.slice(0, bodyStart)) &&
    /<l-m\b/.test(entryBodyMarkup) &&
    /<o-app\s+src="\.\/app-config\.js"/.test(entryBodyMarkup) &&
    !/<(header|main|nav|h1)\b/i.test(entryBodyMarkup),
  entryBodyMarkup.replace(/\s+/g, ' ').trim().slice(0, 200),
);

const layoutState = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('o-page')];
  const layout = pages.find((p) => (p.getAttribute('src') || '').endsWith('/docs/layout.html'));
  const child = pages.find((p) => p !== layout);
  return {
    count: pages.length,
    layoutSrc: layout?.getAttribute('src')?.split('/').slice(-2).join('/') ?? null,
    childParentTag: child?.parentElement?.tagName.toLowerCase() ?? null,
    topInShadow: !!layout?.shadowRoot?.querySelector('.doc-top'),
    mainInShadow: !!layout?.shadowRoot?.querySelector('.doc-main'),
    navLinks: layout?.shadowRoot?.querySelectorAll('.doc-top-nav a').length ?? 0,
    themeBtn: !!layout?.shadowRoot?.querySelector('.doc-theme'),
  };
});
check(
  '外壳由布局页 docs/layout.html 提供（子页面嵌在它的 o-page 里，外壳在它的 shadow root 里）',
  layoutState.count === 2 &&
    layoutState.layoutSrc === 'docs/layout.html' &&
    layoutState.childParentTag === 'o-page' &&
    layoutState.topInShadow &&
    layoutState.mainInShadow &&
    layoutState.navLinks === 5 &&
    layoutState.themeBtn,
  JSON.stringify(layoutState),
);

/** 切页时布局页不重建 —— 否则顶栏、主题按钮会闪 */
const layoutIdentity = await (async () => {
  await page.evaluate(() => {
    window.__layoutBefore = [...document.querySelectorAll('o-page')].find((p) =>
      (p.getAttribute('src') || '').endsWith('/docs/layout.html'),
    );
  });
  await goHash('docs/pages/guide.html');
  return page.evaluate(() => {
    const pages = [...document.querySelectorAll('o-page')];
    const layout = pages.find((p) => (p.getAttribute('src') || '').endsWith('/docs/layout.html'));
    const child = pages.find((p) => p !== layout);
    return {
      same: layout === window.__layoutBefore,
      child: (child?.getAttribute('src') || '').split('/').slice(-2).join('/'),
      active: layout?.shadowRoot?.querySelector('.doc-top-nav a[aria-current]')?.textContent?.trim() ?? null,
    };
  });
})();
check(
  '切页时布局页不重建（顶栏 / 主题按钮不闪，高亮跟着路由走）',
  layoutIdentity.same === true && layoutIdentity.active === '快速开始',
  `子页面=${layoutIdentity.child} · 顶栏高亮=${layoutIdentity.active}`,
);

/** 每个页面模块都要挂到布局页上；少一条，那一页就掉出外壳 */
const parentRefs = await (async () => {
  const urls = [
    'docs/pages/home.html',
    'docs/pages/guide.html',
    'docs/pages/specs.html',
    'docs/pages/components.html',
    'packages/color/page.html', // 令牌文档页不是组件，但它同样是页面模块
    ...READY.map((c) => `packages/${c.slug}/page.html`),
  ];
  const missing = [];
  for (const url of urls) {
    const text = await (await fetch(`${BASE}/${url}`)).text();
    if (!/export\s+const\s+parent\s*=/.test(text)) missing.push(url);
  }
  return { total: urls.length, missing };
})();
check(
  `每个页面模块都声明了 export const parent（${parentRefs.total} 个）`,
  parentRefs.missing.length === 0,
  parentRefs.missing.join(' · ') || '全部已挂到布局页',
);
}
