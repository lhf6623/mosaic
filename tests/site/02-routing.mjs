/**
 * 站点 · 客户端路由与导航（第 8–9 节）：切页不整页刷新、顶栏点一次就跳
 */
import { ALL } from '../../docs/site-map.js';

export default async function run({ page, visit, goTop, goHash, pageState, check }) {
/* ------------------------------------------------------------------ *
 * 8. 【核心】客户端路由：切页不整页刷新 —— 判据是 window 上的标记切完还在
 * ------------------------------------------------------------------ */

const ROUTES = [
  { to: 'docs/pages/guide.html', h1: '快速开始', page: '快速开始' },
  { to: 'docs/pages/components.html', h1: '组件', page: '组件' },
  { to: 'packages/button/page.html', h1: 'Button', page: '组件' },
  { to: 'packages/color/page.html', h1: '设计令牌', page: '设计令牌' },
  { to: 'docs/pages/specs.html', h1: '规范', page: '规范' },
  { to: 'docs/pages/home.html', h1: 'Mosaic', page: '首页' },
];


await visit(page, '/index.html');
// 首页是海报，等它渲染出来再往下断言
await page.waitForFunction(() => !!window.__deep?.('.doc-poster'), { timeout: 15000 }).catch(() => {});
await page.evaluate(() => {
  window.__mosaicProbe = 'alive';
});
await page.waitForTimeout(1500);

const homeState = await pageState();

/**
 * 海报上「看得见」的文字（sr-only 标题被 clip 成 1px，textContent 仍在，要排除）
 */
const homeVisibleText = await page.evaluate(() => {
  const poster = window.__deep('.doc-poster');
  const out = [];
  for (const el of poster.querySelectorAll('*')) {
    if (el.closest('.sr-only') || el.children.length) continue;
    const text = el.textContent.trim();
    if (text) out.push(text);
  }
  return out;
});

check(
  '首页是一张海报：两个入口都用 mc-button，没有别的文字',
  homeState.h1 === 'Mosaic' &&
    homeVisibleText.join('/') === '快速开始/浏览组件' &&
    homeState.ctaTags.join('/') === 'mc-button/mc-button' &&
    homeState.buttons === 2 &&
    homeState.cards === 0,
  `h1=${homeState.h1}（sr-only）· 入口 ${homeState.ctaTags.join(' / ')}（${homeState.cta.join(' / ')}）· 卡片 ${homeState.cards} 处`,
);
check('首页没有二级菜单', homeState.navLinks === 0 && homeState.page === '首页', `菜单项=${homeState.navLinks} 高亮=${homeState.page}`);

const visits = [];
for (const route of ROUTES) {
  await goHash(route.to);
  const s = await pageState();
  visits.push({ route: route.to, ...s });
}

const wrongPage = visits.filter((v, i) => !v.h1?.startsWith(ROUTES[i].h1));
check(
  '每个路由都加载到正确的页面',
  wrongPage.length === 0,
  wrongPage.map((v) => `${v.route} → ${v.h1}`).join('\n        ') || `${visits.length} 条路由全部正确`,
);

const reloaded = visits.filter((v) => v.probe !== 'alive');
check(
  '切页全程不整页刷新（window 标记存活）',
  reloaded.length === 0,
  reloaded.length ? `这些页面发生了整页刷新：${reloaded.map((v) => v.route).join(', ')}` : `连续切换 ${visits.length} 个页面，标记一直活着`,
);

const wrongSection = visits.filter((v, i) => v.page !== ROUTES[i].page);
check(
  '顶部一级导航在每个路由上都高亮正确',
  wrongSection.length === 0,
  wrongSection.map((v) => `${v.route} → ${v.page}`).join('\n        ') || '6 条路由的归属全部正确',
);

/* ------------------------------------------------------------------ *
 * 9. 用导航点击切页（不是只靠改 hash）
 * ------------------------------------------------------------------ */

await goTop('快速开始');
check('点「快速开始」切到快速开始', (await pageState()).h1 === '快速开始');

const guideState = await pageState();
check(
  '没有二级菜单的页面是单列（正文铺满，没有左栏）',
  guideState.split === false && guideState.navLinks === 0,
  `分栏=${guideState.split} · 左栏链接 ${guideState.navLinks} 条`,
);

await goTop('组件');
const compState = await pageState();
check('点「组件」切到组件总览', compState.h1 === '组件');
check(`组件总览渲染出全部 ${ALL.length} 张卡片`, compState.cards === ALL.length, `实际 ${compState.cards} 张`);

/* 卡片是 <doc-cards> 模板渲染的：标签名走 {{$data.tagName}}。
   ⚠️ 曾经写在 <code> 里 —— ofa 不编译 <code> 的内容（P8），页面直接显示字面量 {{$data.tagName}} */
const cardTags = await page.evaluate(() => {
  const all = (query, root = document, acc = []) => {
    for (const el of root.querySelectorAll(query)) acc.push(el);
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) all(query, el.shadowRoot, acc);
    return acc;
  };
  return all('.doc-comp-card-tag').map((el) => el.textContent.trim());
});
check(
  '卡片里的标签名真的渲染了（不是字面量 {{…}}）',
  // 形状：mc-xxx，或 toast() 这种命令式组件的写法（登记表里就是这么写的）
  cardTags.length === ALL.length && cardTags.every((t) => /^[a-z][a-z0-9-]*(\(\))?$/.test(t)),
  `首张=${cardTags[0]} · 末张=${cardTags.at(-1)} · 含字面量=${cardTags.filter((t) => t.includes('{{')).length} 张`,
);

/* 卡片墙的卡片本体是**项目自己的 <mc-card>**（站点第一次拿组件搭页面）。
   卡片是面不是行为：它自己不参与交互（没有 interactive / 镜像属性、宿主不可聚焦、
   内部也没有控件），可点的是卡内那个「查看文档」真链接；待建的没有操作入口。 */
const cardImpl = await page.evaluate(() => {
  const host = window.__deepAll('doc-cards')[0];
  const cards = [...host.shadowRoot.querySelectorAll('mc-card.doc-comp-card')];
  const ready = cards.filter((c) => c.getAttribute('data-status') === 'ready');
  const planned = cards.filter((c) => c.getAttribute('data-status') === 'planned');
  const actions = ready.map((c) => c.querySelector('a.doc-comp-card-action'));
  return {
    total: cards.length,
    upgraded: cards.every((c) => !!c.shadowRoot),
    ready: ready.length,
    planned: planned.length,
    /** 卡片自己不参与交互 */
    inert: cards.every(
      (c) =>
        !c.hasAttribute('interactive') &&
        !c.hasAttribute('data-cover') &&
        !c.hasAttribute('data-stretch') &&
        c.tabIndex === -1 &&
        !c.shadowRoot.querySelector('a, button, input, [tabindex]'),
    ),
    /** 操作入口是卡内那个原生 <a>，href 带部署前缀（hashOf 给的） */
    actionsOk:
      actions.length === ready.length &&
      actions.every(
        (a) => a?.tagName === 'A' && (a.getAttribute('href') || '').includes('packages/'),
      ),
    /** 待建的连操作入口都没有（不给死链） */
    plannedStatic: planned.every((c) => !c.querySelector('a')),
    /** 没有任何铺满用的伪元素规则落在链接上（整卡可点已经拿掉了） */
    noStretch: actions.every((a) => getComputedStyle(a, '::after').position !== 'absolute'),
  };
});
check(
  '卡片墙用项目自己的 <mc-card>：卡片自己不参与交互，操作入口是卡内那个真链接，待建的没有入口',
  cardImpl.total === ALL.length &&
    cardImpl.upgraded &&
    cardImpl.ready > 0 &&
    cardImpl.inert &&
    cardImpl.actionsOk &&
    cardImpl.plannedStatic &&
    cardImpl.noStretch,
  JSON.stringify(cardImpl),
);
check(
  '组件页自带二级菜单：总览 + 全部组件',
  compState.split === true && compState.navLinks === ALL.length + 1,
  `分栏=${compState.split} · 左栏 ${compState.navLinks} 项（${ALL.length} 个组件 + 总览）`,
);
check(
  '二级菜单里当前页高亮（总览）',
  await page.evaluate(() =>
    window.__inside('doc-nav', 'a[aria-current]')[0]?.textContent?.trim() === '总览',
  ),
);

await page.evaluate(() => {
  window.__inside('doc-nav', 'a.doc-nav-comp[data-status="ready"]')[0]?.click();
});
await page.waitForTimeout(1500);
const onButton = await pageState();
check(
  '从页面自带的二级菜单点进组件文档页',
  onButton.h1?.startsWith('Button') && onButton.hash === ALL[0].path,
  `hash=${onButton.hash} · h1=${onButton.h1}`,
);
check(
  '未实现的组件不给死链（指向规范文档）',
  await page.evaluate(() => {
    const a = window.__inside('doc-nav', 'a.doc-nav-comp[data-status="planned"]')[0];
    return a?.href.includes('component-spec.md') && a?.target === '_blank';
  }),
);
}
