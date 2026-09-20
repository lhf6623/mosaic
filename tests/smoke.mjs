#!/usr/bin/env node
/**
 * Mosaic — 端到端冒烟测试（真浏览器）
 *
 * 它同时是 **M0 的验收测试**。M0 的核心问题是：
 *
 *   D3 那个 attachShadow 补丁，到底能不能让工具类进到 shadow root 里？
 *   主题切换（令牌）能不能穿过 shadow 边界？
 *
 * 这些问题只有真浏览器能回答，所以这里用 playwright-core 驱动系统 Chrome
 * （不下载浏览器，走 channel: 'chrome'）。
 *
 * 用法：
 *   node tools/serve.mjs &          # 或另开一个终端 pnpm dev
 *   node tests/smoke.mjs
 *
 * 环境变量：
 *   BASE_URL   默认 http://127.0.0.1:8642
 *   CHANNEL    默认 chrome；CI 上可设 chromium
 *
 * ⚠️ 写这个文件时踩到的坑，值得记一笔：
 *   getComputedStyle() 返回的是**活对象**，元素一旦从 DOM 移除，
 *   所有属性读出来都是空字符串。所以必须先取值、后 remove。
 *   第一版没注意，导致 3 个断言假失败。
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
// 直接 import 站点用的登记表 —— 期望值从它算，而不是把数字抄一份到测试里。
// 这样以后加组件只要改登记表，测试不会假失败。
import { ALL, READY, PLANNED, GROUPS } from '../docs/components.js';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:8642').replace(/\/$/, '');
const CHANNEL = process.env.CHANNEL ?? 'chrome';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(
    `  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}` +
      (detail ? `\n        \x1b[2m${detail}\x1b[0m` : ''),
  );
};

/**
 * 打开一个页面并等它稳定。
 *
 * 不用裸的 `waitUntil: 'networkidle'` —— 页面要从 jsDelivr 取 ofa.js，
 * CDN 抽风时那个请求会一直挂着，networkidle 永远不满足、直接超时，
 * 于是测试因为网络而不是因为代码红了（开发时就遇到过一次）。
 * 这里给 networkidle 加个上限，超时就继续 —— 真正该失败的地方由后面的断言负责。
 */
async function visit(page, path) {
  const res = await page.goto(path.startsWith('http') ? path : BASE + path, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  return res; // 调用方要拿 status / ok()
}

const browser = await chromium.launch({ channel: CHANNEL });
const page = await browser.newPage();

/*
 * 页面内容渲染在 o-page 自己的 shadow root 里，document.querySelector 找不到。
 * 注入一个穿透版，测试里统一用它取页面内的元素。
 */
await page.addInitScript(() => {
  // 数 pointermove 监听的增删，用来验证切走首页时确实清理了（否则每次进首页都会多挂一个）
  window.__pointerMoveAdds = 0;
  window.__pointerMoveRemoves = 0;
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  window.addEventListener = (type, ...rest) => {
    if (type === 'pointermove') window.__pointerMoveAdds++;
    return add(type, ...rest);
  };
  window.removeEventListener = (type, ...rest) => {
    if (type === 'pointermove') window.__pointerMoveRemoves++;
    return remove(type, ...rest);
  };

  window.__deep = (sel, root = document) => {
    for (const el of root.querySelectorAll(sel)) return el;
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        const hit = window.__deep(sel, el.shadowRoot);
        if (hit) return hit;
      }
    }
    return null;
  };

  /*
   * 外壳在布局页 docs/layout.html 的 shadow root 里（顶栏、正文带、主题按钮都是），
   * 所以查外壳元素一律走穿透版；页内正文本来就在子页面 shadow 里，一并适用。
   */
  window.__deepAll = (sel, root = document, out = []) => {
    for (const el of root.querySelectorAll(sel)) out.push(el);
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) window.__deepAll(sel, el.shadowRoot, out);
    }
    return out;
  };
});

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
page.on('response', (r) => {
  if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
});

console.log(`\n\x1b[1mMosaic 冒烟测试\x1b[0m  ${BASE}  (${CHANNEL})\n`);

/* ------------------------------------------------------------------ *
 * 1. 首页加载：无 404、无运行时错误
 * ------------------------------------------------------------------ */
await visit(page, '/index.html');

check('首页加载无 404 / 无运行时报错', problems.length === 0, problems.join('\n        '));

/*
 * 下面 2/3/7 节验证的是 D3 那套机制（shadow root 注入样式、主题穿过 shadow 边界），
 * 需要一个真正加载了 Mosaic 组件的页面做载体。
 *
 * 首页现在只剩标题和两个入口，不引任何组件（刻意做的海报），
 * 所以切到组件文档页来跑 —— 那里有 <l-m> 和活的可交互演示。
 */
await page.evaluate(() => {
  location.hash = '#/packages/button/page.html';
});
await page.waitForFunction(() => !!window.__deep?.('mc-button'), { timeout: 15000 }).catch(() => {});

/* ------------------------------------------------------------------ *
 * 2. ofa.js 注册组件，<l-m> 把组件拉起来
 * ------------------------------------------------------------------ */
check(
  'mc-button 已注册（ofa.js + <l-m> 正常）',
  await page.evaluate(() => !!customElements.get('mc-button')),
);
check(
  'mc-button 实例已升级并创建 shadow root',
  await page.evaluate(() => !!window.__deep('mc-button')?.shadowRoot),
);

/* ------------------------------------------------------------------ *
 * 3. 【D3 核心】运行时补丁把样式表 adopt 进了 shadow root
 *
 * 注意统计方式：顶层 cssRules 是 @layer 块，工具类在块**里面**，所以要递归下去数。
 * ------------------------------------------------------------------ */
const sheets = await page.evaluate(() => {
  const sr = window.__deep('mc-button')?.shadowRoot;
  if (!sr) return null;

  const count = (list) => {
    let n = 0;
    for (const r of list) {
      if (r.cssRules?.length) n += count(r.cssRules);
      else n += 1;
    }
    return n;
  };

  return {
    adopted: sr.adoptedStyleSheets.length,
    rules: sr.adoptedStyleSheets.reduce((n, s) => n + count(s.cssRules), 0),
  };
});
check(
  'shadow root 已 adopt Mosaic 样式表（2 份）',
  sheets?.adopted === 2,
  `adoptedStyleSheets.length = ${sheets?.adopted}`,
);
check('注入的样式表内容非空', (sheets?.rules ?? 0) > 300, `${sheets?.rules} 条规则`);

/* ------------------------------------------------------------------ *
 * 4. 【D3 核心】工具类在 shadow root 内部真的生效
 *
 * 这是整个架构的关键假设：文档级 <link> 的规则进不了 shadow root，
 * 只有通过 adoptedStyleSheets 注入才能让组件模板里的 class="flex gap-2" 起作用。
 * ------------------------------------------------------------------ */
const utils = await page.evaluate(() => {
  const host = document.createElement('div');
  document.body.append(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML =
    '<div class="flex gap-2">' +
    '<span class="text-muted">a</span>' +
    '<span class="bg-surface border border-border">b</span>' +
    '</div>';

  const row = sr.querySelector('.flex');
  const text = sr.querySelector('.text-muted');
  const box = sr.querySelector('.bg-surface');

  // 必须在这里把值读成普通字符串 —— 下面的 host.remove() 会让活对象读空
  const out = {
    display: getComputedStyle(row).display,
    gap: getComputedStyle(row).gap,
    textColor: getComputedStyle(text).color,
    bg: getComputedStyle(box).backgroundColor,
    border: getComputedStyle(box).borderColor,
  };
  host.remove();
  return out;
});

check('工具类生效：display:flex', utils.display === 'flex', `display = ${utils.display}`);
check('工具类生效：gap-2 = 8px', utils.gap === '8px', `gap = ${utils.gap}`);
check(
  '语义色工具类生效：text-muted → neutral-600',
  utils.textColor === 'rgb(101, 113, 131)',
  `text-muted = ${utils.textColor}`,
);
check('语义色工具类生效：bg-surface', utils.bg === 'rgb(255, 255, 255)', `bg-surface = ${utils.bg}`);
check(
  '语义色工具类生效：border-border → neutral-200',
  utils.border === 'rgb(213, 218, 224)',
  `border-border = ${utils.border}`,
);

/* ------------------------------------------------------------------ *
 * 5. 令牌靠自定义属性继承进 shadow root（不依赖运行时机制）
 * ------------------------------------------------------------------ */
const tokenInherits = await page.evaluate(() => {
  const host = document.createElement('div');
  document.body.append(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = '<span class="text-muted">x</span>';
  const value = getComputedStyle(sr.querySelector('.text-muted')).getPropertyValue(
    '--mc-color-fg-muted',
  );
  host.remove();
  return value;
});
// 令牌存的是裸通道三元组（不是完整颜色），这是全局约定，见 agent/design-tokens.md
check(
  '令牌跨 shadow 边界继承',
  tokenInherits.trim() === '101 113 131',
  `--mc-color-fg-muted = ${tokenInherits.trim()}`,
);

/* ------------------------------------------------------------------ *
 * 6. @layer 优先级：组件自己的 <style>（未分层）能覆盖工具类
 *
 * MDN 明确 adoptedStyleSheets 排在组件自身 <style> 之后（优先级更高），
 * 所以这一条只有在工具类被放进 @layer 时才成立。这是 D3 的硬前提。
 * ------------------------------------------------------------------ */
const layerOrder = await page.evaluate(() => {
  const host = document.createElement('div');
  document.body.append(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = '<style>.probe { color: rgb(1, 2, 3); }</style><span class="probe text-muted">x</span>';
  const color = getComputedStyle(sr.querySelector('.probe')).color;
  host.remove();
  return color;
});
check(
  '组件自身 <style>（未分层）赢过工具类（@layer）',
  layerOrder === 'rgb(1, 2, 3)',
  `期望 rgb(1, 2, 3)，实际 ${layerOrder}`,
);

/* ------------------------------------------------------------------ *
 * 7. 【关键】主题切换能穿过 shadow 边界
 *
 * 这一条曾经真的坏过：令牌表里写了 `:root, :host`，shadow root 内的 :host
 * 会给宿主重新赋一遍亮色值，盖掉从文档继承的暗色值 → 切主题组件纹丝不动。
 * ------------------------------------------------------------------ */
const buttonBg = () =>
  page.evaluate(() => getComputedStyle(window.__deep('mc-button')).backgroundColor);

const lightBg = await buttonBg();
await page.evaluate(() => {
  document.documentElement.dataset.theme = 'dark';
});
await page.waitForTimeout(80);
const darkBg = await buttonBg();

check('切到暗色后组件颜色随之变化', lightBg !== darkBg, `${lightBg} → ${darkBg}`);

const docSurface = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--mc-color-surface').trim(),
);
check('文档级令牌也切到了暗色', docSurface !== '255 255 255', `--mc-color-surface = ${docSurface}`);

await page.evaluate(() => delete document.documentElement.dataset.theme);
await page.waitForTimeout(80);
check('切回自动（亮色）后恢复', (await buttonBg()) === lightBg);

/* ------------------------------------------------------------------ *
 * 8. 【核心】客户端路由：切页不整页刷新
 *
 * 这是改造文档站的目的。判据：在 window 上放一个标记，
 * 连续切换多个页面后它还在 —— 整页刷新会把它冲掉。
 * ------------------------------------------------------------------ */

const ROUTES = [
  { to: 'docs/pages/guide.html', h1: '快速开始', page: '快速开始' },
  { to: 'docs/pages/components.html', h1: '组件', page: '组件' },
  { to: 'packages/button/page.html', h1: 'Button', page: '组件' },
  { to: 'packages/color/page.html', h1: '设计令牌', page: '设计令牌' },
  { to: 'docs/pages/specs.html', h1: '规范', page: '规范' },
  { to: 'docs/pages/home.html', h1: 'Mosaic', page: '首页' },
];

/** 穿透 shadow root 的求值 —— 页面内容在 o-page 的 shadow root 里 */
const pageState = () =>
  page.evaluate(() => {
    const all = window.__deepAll;
    const nav = all('.doc-top-nav a');
    return {
      probe: window.__mosaicProbe,
      hash: location.hash.replace(/^#\//, ''),
      h1: all('h1')[0]?.textContent?.trim() ?? null,
      page: nav.find((a) => a.hasAttribute('aria-current'))?.textContent?.trim() ?? null,
      // 二级菜单在页面自己里面（<doc-nav>），不在外壳里 —— 所以照样要穿透查
      navLinks: all('doc-nav a').length,
      split: all('.doc-split').length > 0,
      cards: all('.doc-comp-card').length,
      paletteRows: all('.doc-palette-row').length,
      buttons: all('mc-button').length,
      cta: all('.poster-links > *').map((el) => el.textContent.trim()),
      ctaTags: all('.poster-links > *').map((el) => el.tagName.toLowerCase()),
    };
  });

/** 用顶部一级导航切页（模拟真实点击）。顶栏在布局页的 shadow root 里 */
async function goTop(label) {
  await page.evaluate((text) => {
    window.__deepAll('.doc-top-nav a')
      .find((a) => a.textContent.trim() === text)
      ?.click();
  }, label);
  await page.waitForTimeout(1500);
}

/** 直接改 hash 切页 */
async function goHash(to) {
  await page.evaluate((h) => {
    location.hash = `#/${h}`;
  }, to);
  await page.waitForTimeout(1500);
}

await visit(page, '/index.html');
// 首页是海报，等它渲染出来再往下断言
await page.waitForFunction(() => !!window.__deep?.('.doc-poster'), { timeout: 15000 }).catch(() => {});
await page.evaluate(() => {
  window.__mosaicProbe = 'alive';
});
await page.waitForTimeout(1500);

const homeState = await pageState();

/**
 * 海报上「看得见」的文字。
 *
 * sr-only 的标题（给大纲/SEO 用）要排除掉 —— 它被 clip 成 1px，但 textContent 仍在。
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
check(
  '组件页自带二级菜单：总览 + 全部组件',
  compState.split === true && compState.navLinks === ALL.length + 1,
  `分栏=${compState.split} · 左栏 ${compState.navLinks} 项（${ALL.length} 个组件 + 总览）`,
);
check(
  '二级菜单里当前页高亮（总览）',
  await page.evaluate(() =>
    window.__deep('doc-nav a[aria-current]')?.textContent?.trim() === '总览',
  ),
);

// 从页面自己的二级菜单点进组件页
await page.evaluate(() => {
  window.__deep('doc-nav a.doc-nav-comp[data-status="ready"]')?.click();
});
await page.waitForTimeout(1500);
const onButton = await pageState();
check(
  '从页面自带的二级菜单点进组件文档页',
  onButton.h1?.startsWith('Button') && onButton.hash === `packages/${READY[0].slug}/page.html`,
  `hash=${onButton.hash} · h1=${onButton.h1}`,
);
check(
  '未实现的组件不给死链（指向规范文档）',
  await page.evaluate(() => {
    const a = window.__deep('doc-nav a.doc-nav-comp[data-status="planned"]');
    return a?.href.includes('component-spec.md') && a?.target === '_blank';
  }),
);

/* ------------------------------------------------------------------ *
 * 9.2 首页的鼠标视差图案
 *
 * 三层方块（数据驱动渲染），越近的层位移越大。没有真浏览器测不了这个。
 * ------------------------------------------------------------------ */

/** 读三层当前的 transform */
const artTransforms = () =>
  page.evaluate(() => {
    const art = window.__deep('.poster-art');
    if (!art) return null;
    // 层里的方块是 o-fill 从数据渲染出来的，所以按 .art-bit 数，不能数 children
    return [...art.querySelectorAll('[data-layer]')].map((g) => ({
      layer: g.dataset.layer,
      kids: g.querySelectorAll('.art-bit').length,
      transform: g.style.transform || '',
    }));
  });

await goTop('首页');
await page.waitForTimeout(600);

/*
 * 外壳的滚动契约：**全局不出滚动条**，滚动只发生在内部区域。
 *
 * 外壳本身是「上下」——顶栏 + 正文带；带二级菜单的页面在正文带里自己拆成
 * 「左右」（左菜单自己滚、右正文自己滚）。所以这里量两件事：
 *   1. 视口高度 == 文档高度，且 body 是 overflow: hidden（没有全局滚动条）
 *   2. 首页正文区正好一屏、不溢出（海报仍然撑满，没有被压扁）
 */
const homeScroll = await page.evaluate(() => {
  const main = window.__deep('.doc-main');
  return {
    doc: document.documentElement.scrollHeight,
    view: window.innerHeight,
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    mainOverflowY: getComputedStyle(main).overflowY,
    mainClient: main.clientHeight,
    mainOver: main.scrollHeight - main.clientHeight,
  };
});
check(
  '外壳固定一屏：没有全局滚动条',
  homeScroll.doc <= homeScroll.view + 1 && homeScroll.bodyOverflowY === 'hidden',
  `文档 ${homeScroll.doc}px / 视口 ${homeScroll.view}px · body overflow-y=${homeScroll.bodyOverflowY}`,
);
check(
  '首页正好一屏，正文区不出滚动条',
  homeScroll.mainOver <= 1,
  `正文区 clientHeight ${homeScroll.mainClient}px · 溢出 ${homeScroll.mainOver}px · overflow-y=${homeScroll.mainOverflowY}`,
);

/*
 * 顺带守一下高度链条：长页面的内容不能被压扁裁掉。
 *
 * 说明白：这条**不是**用来区分 `flex: 1` 和 `flex: 1 1 auto` 的 ——
 * 实测两者在这里结果完全一样。它防的是更粗暴的改动：给链条上的元素加
 * `overflow: hidden`、去掉 `min-height: 0`，或者让 .doc-main 不再是滚动容器。
 *
 * ⚠️ 其中 o-router 那个 `overflow: hidden` 是最阴的一个：ofa.js 的 o-router
 * 自带 `:host { … overflow: hidden }`，它会把超出的一截裁掉、而且不再往上传
 * 滚动溢出 —— 于是 .doc-main 的 scrollHeight 永远等于 clientHeight，
 * 长页面被静默截断、页面上还看不到任何滚动条。所以这条必须真滚到底去看。
 */
await goTop('组件');
await page.waitForTimeout(1500);

/* ---- 二级菜单在页面里：外壳只有顶栏 + 正文带，页面自己分左右两栏 ---- */

const shellBox = await page.evaluate(() => {
  const top = window.__deep('.doc-top').getBoundingClientRect();
  const main = window.__deep('.doc-main');
  const mr = main.getBoundingClientRect();
  const nav = window.__deep('doc-nav');
  const content = window.__deep('.doc-split > .doc-body');
  const nr = nav.getBoundingClientRect();
  const cr = content.getBoundingClientRect();
  const r = (n) => Math.round(n);
  return {
    topW: r(top.width),
    viewW: window.innerWidth,
    topBottom: r(top.bottom),
    viewH: window.innerHeight,
    mainTop: r(mr.top),
    mainBottom: r(mr.bottom),
    navRight: r(nr.right),
    contentLeft: r(cr.left),
    navTop: r(nr.top),
    contentTop: r(cr.top),
    navBottom: r(nr.bottom),
    contentBottom: r(cr.bottom),
    navOverflowY: getComputedStyle(nav).overflowY,
    contentOverflowY: getComputedStyle(content).overflowY,
    // 二级菜单在**子页面**的 shadow 里，不该出现在外壳正文带的 light DOM 里
    shellHasNav: !!main.querySelector('doc-nav'),
  };
});
check(
  '顶栏是「上」：贴满宽度，正文带紧接着它铺到底',
  shellBox.topW === shellBox.viewW &&
    shellBox.mainTop === shellBox.topBottom &&
    shellBox.mainBottom === shellBox.viewH,
  `顶栏宽 ${shellBox.topW}/${shellBox.viewW}px · 正文带 ${shellBox.mainTop}–${shellBox.mainBottom}px · 视口高 ${shellBox.viewH}px`,
);
check(
  '外壳里不再有侧栏（二级菜单搬进页面了）',
  shellBox.shellHasNav === false,
  `.doc-main 里出现 <doc-nav>=${shellBox.shellHasNav}`,
);
check(
  '带二级菜单的页面自己分成左右两栏，两栏都占满顶栏以下',
  shellBox.navRight <= shellBox.contentLeft + 1 &&
    shellBox.contentLeft > 0 &&
    shellBox.navTop === shellBox.contentTop &&
    shellBox.navBottom === shellBox.viewH &&
    shellBox.contentBottom === shellBox.viewH,
  `菜单 ${shellBox.navTop}–${shellBox.navBottom}px（右边界 ${shellBox.navRight}px）/ 正文 ${shellBox.contentTop}–${shellBox.contentBottom}px（左边界 ${shellBox.contentLeft}px）`,
);
check(
  '两栏各自滚',
  shellBox.navOverflowY === 'auto' && shellBox.contentOverflowY === 'auto',
  `overflow-y 菜单=${shellBox.navOverflowY} 正文=${shellBox.contentOverflowY}`,
);

const longPage = await page.evaluate(() => {
  const main = window.__deep('.doc-main');
  const content = window.__deep('.doc-split > .doc-body');
  const last = content?.lastElementChild;
  content.scrollTop = content.scrollHeight; // 滚到底，最后一块内容必须够得着
  const cr = content.getBoundingClientRect();
  const lr = last?.getBoundingClientRect();
  return {
    mainOver: main.scrollHeight - main.clientHeight,
    overflowY: getComputedStyle(content).overflowY,
    globalOver: document.documentElement.scrollHeight - window.innerHeight,
    clientH: content.clientHeight,
    scrollH: content.scrollHeight,
    contentTop: cr.top,
    contentBottom: cr.bottom,
    lastTop: lr ? lr.top : null,
    lastBottom: lr ? lr.bottom : null,
  };
});
check(
  '长页面在页面自己的正文栏里滚（外壳和 window 都不滚）',
  longPage.overflowY === 'auto' &&
    longPage.globalOver <= 1 &&
    longPage.mainOver <= 1 &&
    longPage.scrollH > longPage.clientH,
  `正文栏 ${longPage.clientH}/${longPage.scrollH}px · 外壳正文带溢出 ${longPage.mainOver}px · 全局溢出 ${longPage.globalOver}px`,
);
check(
  '滚到底后长页面的最后一块内容在正文栏里可见（没被裁掉）',
  longPage.lastTop !== null &&
    longPage.lastBottom !== null &&
    longPage.lastTop >= longPage.contentTop - 1 &&
    longPage.lastBottom <= longPage.contentBottom + 1,
  `最后元素 ${Math.round(longPage.lastTop)}–${Math.round(longPage.lastBottom)}px · 正文栏 ${Math.round(longPage.contentTop)}–${Math.round(longPage.contentBottom)}px`,
);

/*
 * 换页复位：全局不滚之后，window.scrollTo 成了空操作，
 * 复位必须打在外壳正文带上（site.js 的 route-change 处理里做；
 * 顶栏的 olink 不触发 hashchange，所以那里同时听 router-change）。
 * 用「设计令牌」这种单列长页面来测 —— 它滚的就是外壳正文带。
 */
await goHash('packages/color/page.html');
await page.evaluate(() => {
  window.__deep('.doc-main').scrollTop = 99999;
});
const scrolledBefore = await page.evaluate(() => Math.round(window.__deep('.doc-main').scrollTop));
await goHash('docs/pages/specs.html');
const resetTop = await page.evaluate(() => Math.round(window.__deep('.doc-main').scrollTop));
check(
  '换页后正文区自动回到顶部',
  scrolledBefore > 0 && resetTop === 0,
  `切页前 scrollTop=${scrolledBefore}px → 切页后 ${resetTop}px`,
);

/*
 * 滚轮接力：菜单滚到底之后，继续滚要把滚动转给同一页的正文栏。
 * 两栏各自滚，纯 CSS 做不到这一点（外壳不可滚，链上去是死路）。
 */
await goTop('组件');
await page.waitForTimeout(1200);
const bridge = await page.evaluate(() => {
  const nav = window.__deep('doc-nav');
  const content = window.__deep('.doc-split > .doc-body');
  nav.scrollTop = nav.scrollHeight; // 先把菜单滚到底
  content.scrollTop = 0;
  const box = nav.getBoundingClientRect();
  return {
    navMax: nav.scrollHeight - nav.clientHeight,
    contentMax: content.scrollHeight - content.clientHeight,
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
});
await page.mouse.move(bridge.x, bridge.y);
await page.mouse.wheel(0, 400);
await page.waitForTimeout(400);
const afterWheel = await page.evaluate(() => ({
  navTop: Math.round(window.__deep('doc-nav').scrollTop),
  contentTop: Math.round(window.__deep('.doc-split > .doc-body').scrollTop),
  winY: window.scrollY,
}));
check(
  '菜单滚到底后滚轮转给正文栏，window 始终不滚',
  bridge.navMax > 0 &&
    bridge.contentMax > 400 &&
    afterWheel.contentTop > 0 &&
    afterWheel.winY === 0,
  `菜单可滚 ${bridge.navMax}px / 正文可滚 ${bridge.contentMax}px · 滚轮后正文栏 scrollTop ${afterWheel.contentTop} · window.scrollY ${afterWheel.winY}`,
);

/*
 * 窄屏：五个中文一级入口在 375px 下必然放不下。放不下只能让**顶栏自己**横滚，
 * 不能把整页撑出横向滚动条（那又是「全局滚动条」了）。
 */
await page.setViewportSize({ width: 375, height: 700 });
await page.waitForTimeout(600);
const narrowTop = await page.evaluate(() => {
  const nav = window.__deep('.doc-top-nav');
  return {
    docW: document.documentElement.scrollWidth,
    viewW: window.innerWidth,
    navScrollable: nav.scrollWidth > nav.clientWidth,
    overflowX: getComputedStyle(nav).overflowX,
  };
});
check(
  '窄屏下顶栏入口自己在内部横滚，不产生全局横向滚动条',
  narrowTop.docW <= narrowTop.viewW + 1 &&
    narrowTop.navScrollable &&
    narrowTop.overflowX === 'auto',
  `文档宽 ${narrowTop.docW}px / 视口 ${narrowTop.viewW}px · 顶栏可滚=${narrowTop.navScrollable} · overflow-x=${narrowTop.overflowX}`,
);
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(600);

await goTop('首页');
await page.waitForTimeout(700);

const artIdle = await artTransforms();
check(
  '首页海报有马赛克图案，且分成三层',
  Array.isArray(artIdle) && artIdle.length === 3 && artIdle.every((l) => l.kids > 0),
  artIdle ? artIdle.map((l) => `${l.layer}:${l.kids}块`).join(' ') : '没找到图案',
);

/* ---- 方块不能越出可视区域 ---- */

/**
 * 量出所有方块的包围盒，和容器比对。
 *
 * 这里守着一个用户报过的问题：网格写成固定的 18×11 格时总宽 1296，
 * 而容器只有 1200 出头，边缘的方块就只能被硬切。现在按容器实测尺寸算行列数，
 * 必须完全落在里面。
 */
const measureArt = async (page) =>
  page.evaluate(() => {
    const deep = (sel, root = document) => {
      for (const el of root.querySelectorAll(sel)) return el;
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          const hit = deep(sel, el.shadowRoot);
          if (hit) return hit;
        }
      }
      return null;
    };
    const art = deep('.poster-art');
    const host = deep('.doc-poster');
    if (!art || !host) return null;

    /*
     * 一律量**屏幕坐标**的矩形。
     *
     * 方块是数据驱动出来的 HTML 元素（.art-bit），位置写在行内样式里 ——
     * 拿样式值去比容器尺寸会在「算错了但没越界」时误判通过，只有真实矩形算数。
     */
    const hostRect = host.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const bit of art.querySelectorAll('.art-bit')) {
      const r = bit.getBoundingClientRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right);
      maxY = Math.max(maxY, r.bottom);
    }

    const over = Math.max(
      hostRect.left - minX,
      hostRect.top - minY,
      maxX - hostRect.right,
      maxY - hostRect.bottom,
    );

    return {
      box: `${host.clientWidth}x${host.clientHeight}`,
      layers: [...art.querySelectorAll('[data-layer]')].map(
        (l) => `${Math.round(l.getBoundingClientRect().width)}x${Math.round(l.getBoundingClientRect().height)}`,
      ),
      count: art.querySelectorAll('.art-bit').length,
      over: Math.round(over),
      overflow: over > 0.5,
    };
  });

const artBox = await measureArt(page);
check(
  '方块完全落在可视区域内（不被切）',
  artBox && !artBox.overflow,
  `容器 ${artBox?.box} · 三层 ${artBox?.layers.join(' / ')} · ${artBox?.count} 块 · 越界 ${artBox?.over}px`,
);

// 换几个尺寸，网格必须重新贴合：「尺寸变了 → data 重算 → 视图跟上」这条链要真的走通
const resized = [];
for (const [w, h] of [
  [900, 700],
  [1600, 900],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(600);
  const m = await measureArt(page);
  resized.push({ w, h, ...m });
}
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(600);

check(
  '窗口尺寸变化后网格重新贴合（三层跟容器同尺寸，且不越界）',
  resized.every((r) => !r.overflow && r.layers.length === 3 && r.layers.every((b) => b === r.box)),
  resized.map((r) => `${r.w}×${r.h} → 容器 ${r.box} 三层 ${r.layers.join('/')} ${r.count}块`).join('\n        '),
);

await page.mouse.move(80, 120);
await page.waitForTimeout(800);
const artMoved = await artTransforms();

const shifted = (artMoved ?? []).map((l) =>
  Math.abs(parseFloat(/translate3d\((-?[\d.]+)px/.exec(l.transform)?.[1] ?? '0')),
);
check(
  '鼠标移动后三层都跟着位移',
  shifted.length === 3 && shifted.every((n) => n > 0.5),
  `位移 ${shifted.map((n) => n.toFixed(1) + 'px').join(' / ')}`,
);
check(
  '位移量随层深递增（有景深，不是整块平移）',
  shifted.length === 3 && shifted[0] < shifted[1] && shifted[1] < shifted[2],
  `远 ${shifted[0]?.toFixed(1)} < 中 ${shifted[1]?.toFixed(1)} < 近 ${shifted[2]?.toFixed(1)}`,
);

/* ---- 色片不能压到入口按钮上：视差推到极值也不行 ---- */

/*
 * 守着一个修过的 bug：色片的排除区只按**静态位置**算，余量（16px）还比色片自己的
 * 半宽（22.3px）小，于是鼠标一移到角落 —— 近景层整体平移 46px —— 色片就滑到
 * 「快速开始」底下（实测 414px 视口下压进去 44px）。
 *
 * 三个维度都要覆盖，少一个都测不出来：
 *   · 四个角 —— 只量鼠标居中时的位置看不出问题
 *   · 窄屏 —— 宽屏下色片离按钮本来就远，问题只在小窗口暴露
 *   · 边到边距离 —— 交叠为 0 也可能是「贴着」，这里要的是「留出了余量」
 */
const chipWorst = { dist: Infinity };
for (const [vw, vh, tag] of [
  [1280, 800, '1280 宽'],
  [414, 700, '414 窄'],
]) {
  await page.setViewportSize({ width: vw, height: vh });
  await page.waitForTimeout(600); // 等 ResizeObserver 重排 + 缓动归位

  for (const [x, y, at] of [
    [2, 2, '左上'],
    [vw - 2, 2, '右上'],
    [2, vh - 2, '左下'],
    [vw - 2, vh - 2, '右下'],
  ]) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(700); // 缓动系数 0.06，追平要一会儿
    const hit = await page.evaluate(() => {
      const art = window.__deep('.poster-art');
      const links = window.__deep('.poster-links');
      if (!art || !links) return null;
      const btns = [...links.children].map((b) => ({
        label: b.textContent.trim(),
        r: b.getBoundingClientRect(),
      }));
      let tightest = { dist: Infinity };
      for (const chip of art.querySelectorAll('.art-chip')) {
        const r = chip.getBoundingClientRect();
        for (const b of btns) {
          const gx = Math.max(0, Math.max(r.left - b.r.right, b.r.left - r.right));
          const gy = Math.max(0, Math.max(r.top - b.r.bottom, b.r.top - r.bottom));
          const dist = Math.hypot(gx, gy);
          if (dist < tightest.dist) {
            tightest = { dist, label: b.label, color: chip.dataset.color };
          }
        }
      }
      return tightest;
    });
    if (hit && hit.dist < chipWorst.dist) Object.assign(chipWorst, hit, { at: `${tag} ${at}` });
  }
}

check(
  '色片与入口按钮留有余量（视差推到极值、缩到窄屏也一样）',
  chipWorst.dist > 0,
  chipWorst.dist === Infinity
    ? '没找到色片或按钮'
    : `最紧在${chipWorst.at}：${chipWorst.color} 色片离「${chipWorst.label}」${chipWorst.dist.toFixed(1)}px`,
);

// 后面的用例按 1280×800 算（原来就是这个尺寸，量完再切回来）
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(600);

/* ---- 减弱动效偏好下不做视差 ---- */
const reduceCtx = await browser.newContext({ reducedMotion: 'reduce' });
const reducePage = await reduceCtx.newPage();
await reducePage.goto(`${BASE}/index.html`, { waitUntil: 'load' });
await reducePage.waitForTimeout(1600);
await reducePage.mouse.move(80, 120);
await reducePage.waitForTimeout(700);
const reduceTransforms = await reducePage.evaluate(() => {
  const deep = (sel, root = document) => {
    for (const el of root.querySelectorAll(sel)) return el;
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        const hit = deep(sel, el.shadowRoot);
        if (hit) return hit;
      }
    }
    return null;
  };
  const art = deep('.poster-art');
  return art ? [...art.querySelectorAll('[data-layer]')].map((g) => g.style.transform || '') : null;
});
check(
  'prefers-reduced-motion: reduce 时不做视差',
  Array.isArray(reduceTransforms) && reduceTransforms.every((t) => t === ''),
  reduceTransforms ? JSON.stringify(reduceTransforms) : '没找到图案',
);
await reduceCtx.close();

/* ---- 路由来回切时不能累积 pointermove 监听 ---- */

// 先切走首页 —— 此刻正挂在首页的那个监听器本来就该存在，所以要离开后再比，
// 否则 add 永远比 remove 多 1，断言会误报（第一版就是这么写错的）。
await goTop('组件');
await page.waitForTimeout(700);

const leak = await page.evaluate(() => ({
  add: window.__pointerMoveAdds ?? 0,
  remove: window.__pointerMoveRemoves ?? 0,
}));
check(
  '切走首页时清理了 pointermove 监听（不累积）',
  leak.add === leak.remove && leak.add > 0,
  `add=${leak.add} remove=${leak.remove}`,
);

/* ------------------------------------------------------------------ *
 * 9.5 【回归】导航 DOM 必须稳定，且真人节奏的点击一次就跳转
 *
 * 这里守着一个修过的 bug：原来每个轮询 tick 都 replaceChildren() 重建菜单，
 * 路由变化后每秒重建 10 次。真实点击的 mousedown 与 click 之间目标节点被换掉，
 * click 就不触发了 —— 表现为「菜单要按很多次才跳转」（实测第一轮点了 6 次）。
 *
 * 注意：用 element.click() 测不出来。它是程序化的、同步的，不受 DOM 替换影响。
 * 必须用 page.mouse 走真实的按下-抬起，才能复现。
 * ------------------------------------------------------------------ */

await goTop('组件');
await page.waitForTimeout(600);

const navChurn = await page.evaluate(
  () =>
    new Promise((resolve) => {
      // 二级菜单现在由页面自己带（<doc-nav>），照样要盯住它的 DOM 会不会被反复重建
      const deep = (sel, root = document) => {
        for (const el of root.querySelectorAll(sel)) return el;
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const hit = deep(sel, el.shadowRoot);
            if (hit) return hit;
          }
        }
        return null;
      };
      const nav = deep('doc-nav');
      let n = 0;
      const obs = new MutationObserver((list) => {
        n += list.length;
      });
      obs.observe(nav, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        resolve(n);
      }, 1500);
    }),
);
check('路由稳定后导航 DOM 不变动（不重建菜单）', navChurn === 0, `1.5 秒内变更 ${navChurn} 次`);

/** 真人节奏的点击：按下与抬起之间隔 120ms */
async function humanClick(selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  return true;
}

let clicksNeeded = 0;
for (let i = 1; i <= 4; i++) {
  clicksNeeded = i;
  const ok = await humanClick('.doc-top-nav a:nth-child(1)'); // 「首页」
  if (!ok) continue;
  await page.waitForTimeout(600);
  if ((await page.evaluate(() => location.hash)).includes('home.html')) break;
}
check('真人节奏点击：一次就跳转', clicksNeeded === 1, `需要点 ${clicksNeeded} 次`);

// 点回组件页，后面的断言依赖页面自带的二级菜单
await goTop('组件');
await page.waitForTimeout(600);

/* ------------------------------------------------------------------ *
 * 10. 页面自带的二级菜单内容超高时自己滚
 *
 * 这一条曾经真的坏过：侧栏 sticky 且不设 max-height + overflow 时，
 * 顶部被钉住而整页滚动不带动它，底部那些组件永远够不到。
 *
 * 现在外壳固定一屏、整页不滚（见 9.2 那几条），菜单是页面里固定高度的一栏，
 * 超出部分必须由它自己滚 —— 否则会被 .doc-split 的 overflow: hidden 裁掉。
 * ------------------------------------------------------------------ */
const menuScroll = await page.evaluate(() => {
  const nav = window.__deep('doc-nav');
  const headerH = window.__deep('.doc-top').getBoundingClientRect().height;
  const links = [...nav.querySelectorAll('a')];
  const last = links[links.length - 1];
  nav.scrollTop = nav.scrollHeight; // 尽量滚到底
  const lr = last.getBoundingClientRect();
  return {
    overflowY: getComputedStyle(nav).overflowY,
    scrollH: nav.scrollHeight,
    clientH: nav.clientHeight,
    lastLabel: last.textContent.trim(),
    /*
     * 必须拿**视口**做参照，不能拿菜单自己的矩形。
     * 坏掉时菜单本身会延伸到视口外，那时最后一项"在菜单内"依然成立，
     * 拿 nav 的 rect 对比会误判为通过。
     */
    lastVisibleInViewport: lr.top >= headerH - 1 && lr.bottom <= window.innerHeight + 1,
  };
});
check('页面自带的二级菜单内容超高时自己滚动（overflow-y: auto）', menuScroll.overflowY === 'auto', `overflow-y=${menuScroll.overflowY} scrollH=${menuScroll.scrollH} clientH=${menuScroll.clientH}`);
check('滚到底后最后一个组件在视口内可见', menuScroll.lastVisibleInViewport, `最后一项是「${menuScroll.lastLabel}」`);

/* ------------------------------------------------------------------ *
 * 11. 文档跟着组件走 —— 组件的文档页就在它自己的目录里
 * ------------------------------------------------------------------ */

const colocated = await (async () => {
  const p = await browser.newPage();
  const bad = [];
  for (const c of READY) {
    // 必须经由路由打开：page.html 是 <template page>，当独立网页打开会渲染成空白
    const url = `/index.html#/packages/${c.slug}/page.html`;
    const failed = [];
    p.removeAllListeners('response');
    p.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    p.removeAllListeners('pageerror');
    p.on('pageerror', (e) => failed.push(String(e)));
    const res = await visit(p, url);
    // 页面自己的二级菜单渲染出来 = 站点共享脚本（含 doc-nav.js）也跑起来了
    const navOk = await p.evaluate(() => {
      const deep = (sel, root = document) => {
        for (const el of root.querySelectorAll(sel)) return el;
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const hit = deep(sel, el.shadowRoot);
            if (hit) return hit;
          }
        }
        return null;
      };
      return deep('doc-nav')?.querySelectorAll('a').length > 3;
    });
    if (!res?.ok() || failed.length || !navOk) {
      bad.push(`packages/${c.slug}/page.html — ${res?.status()}${failed.length ? ' · ' + failed.join(', ') : ''}${navOk ? '' : ' · 二级菜单未渲染'}`);
    }
  }
  await p.close();
  return bad;
})();
check(
  `每个已实现组件的文档页都在它自己的目录里（${READY.length} 个）`,
  colocated.length === 0,
  colocated.join('\n        '),
);

/* ------------------------------------------------------------------ *
 * 12. 色板是从真实 tokens.css 解析渲染的
 * ------------------------------------------------------------------ */

await goHash('packages/color/page.html');
const tokensState = await pageState();
check('令牌文档页可获取', tokensState.h1 === '设计令牌', `h1=${tokensState.h1}`);
check('色板渲染出 66 个色块（6 色族 × 11 档）', tokensState.paletteRows === 6, `6 个色族 / ${tokensState.paletteRows} 行`);

/* ------------------------------------------------------------------ *
 * 12.2 【回归】直接带 hash 冷启动，页面占位也要渲染出来
 *
 * 这里守着一个真实踩到的 bug：o-app 启动时会先加载 app-config 里的首页，
 * 再切到 hash 指向的页面。原来轮询的收工条件是「.doc-body 变了一个」——
 * 首页挂上那一刻就成立了，于是真正那一页的占位（组件卡片 / 色板）永远
 * 没人渲染：**直接打开** `#/docs/pages/components.html` 卡片区是空的，
 * 而点导航进来又是好的。现在收工条件改成「o-page 的 src 已经是 hash 指向的页面」。
 * ------------------------------------------------------------------ */

const freshLoads = await (async () => {
  const p = await browser.newPage();
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
 * 12.3 入口只做引入，外壳由**布局页**提供（ofa.js 嵌套路由）
 *
 * index.html 曾经把顶栏、正文带、o-router 全写在自己身上。现在它们是
 * docs/layout.html 这个 `<template page>` 布局页的 shadow 内容，子页面用
 * `export const parent` 挂上去。所以守三件事：
 *   · 入口的**响应原文**里没有外壳标记
 *   · 运行时是「布局页 o-page > 子页面 o-page」两层，外壳在布局页 shadow root 里
 *   · 每个页面模块都声明了 parent —— 漏一个，那一页就掉出外壳
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

/* ------------------------------------------------------------------ *
 * 12. 对静态服务器的 HTML 注入免疫
 *
 * VS Code Live Server 会往 HTML 响应里注入 live-reload 脚本，
 * 注入点是响应里第一个 body / svg / head 的结束标签。
 *
 * 踩过的坑：页面模块注释里写了那三个结束标签的原文，注入点被引到文件顶部；
 * 注入内容自带的 HTML 注释又把我们的注释提前闭合，于是注入的 script 变成
 * 真实元素、排到了我们脚本前面 —— ofa.js 取第一个 script 当模块代码，
 * 拿到的是服务器的脚本，页面直接加载失败。
 *
 * 这条路径用「模拟同样的注入」的服务器来测，否则很容易在改注释或模板结构时静默回归。
 * ------------------------------------------------------------------ */

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
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
    const injPage = await browser.newPage();
    const injErrs = [];
    injPage.on('pageerror', (e) => injErrs.push(String(e)));
    injPage.on('console', (m) => {
      if (m.type() === 'error') injErrs.push(m.text());
    });

    await injPage.goto(`http://127.0.0.1:${INJECT_PORT}/index.html`, { waitUntil: 'load' });
    await injPage.waitForTimeout(2200);
    const injState = await injPage.evaluate(() => {
      const deep = (sel, root = document) => {
        for (const el of root.querySelectorAll(sel)) return el;
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const hit = deep(sel, el.shadowRoot);
            if (hit) return hit;
          }
        }
        return null;
      };
      const art = deep('.poster-art');
      return {
        h1: deep('h1')?.textContent?.trim() ?? null,
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

/* ------------------------------------------------------------------ */

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length ? '\x1b[31m✗' : '\x1b[32m✓'} ${results.length - failed.length}/${results.length} 通过\x1b[0m\n`,
);

process.exit(failed.length ? 1 : 0);
