/**
 * 站点 · 启动与色板（第 12.x 节）：色板回读 tokens.css、冷启动占位、入口与布局页
 */
import { ALL, READY } from '../../docs/site-map.js';

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
    /* 顶栏右侧的仓库入口：外链 + 图标按钮（要有 aria-label，装饰 SVG 要 aria-hidden） */
    github: (() => {
      const a = layout?.shadowRoot?.querySelector('.doc-github');
      return a
        ? {
            href: a.getAttribute('href'),
            target: a.getAttribute('target'),
            rel: a.getAttribute('rel'),
            label: a.getAttribute('aria-label'),
            iconHidden: a.querySelector('svg')?.getAttribute('aria-hidden'),
            inTopbar: a.closest('.doc-top') !== null,
            inNav: a.closest('.doc-top-nav') !== null,
          }
        : null;
    })(),
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

check(
  '顶栏右侧有仓库入口：外链 + aria-label，图标是装饰性 SVG，且不混进一级菜单（nav 仍是 5 条）',
  layoutState.github?.href === 'https://github.com/lhf6623/mosaic' &&
    layoutState.github?.target === '_blank' &&
    layoutState.github?.rel === 'noreferrer' &&
    !!layoutState.github?.label &&
    layoutState.github?.iconHidden === 'true' &&
    layoutState.github?.inTopbar === true &&
    layoutState.github?.inNav === false,
  JSON.stringify(layoutState.github),
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
    ...READY.map((c) => c.path),
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
 * 12.4 任意色走令牌层（D8 · agent/howto/arbitrary-color.md）：
 *      容器 / 实例上覆盖 L2 六件套就到达组件；:root 上写 L3 不生效。
 *      组件一个都不用支持 hex —— 这就是 D8 的判据，钉住它。
 * ------------------------------------------------------------------ */

const TONE =
  '--mc-color-primary: 255 240 0; --mc-color-primary-fg: 0 0 0;' +
  ' --mc-color-primary-subtle: 255 252 224; --mc-color-primary-hover: 230 216 0;' +
  ' --mc-color-primary-active: 204 192 0; --mc-color-ring: 60 67 77';

/* 组件本体按需引入：index 首页本来就会引到 button，但别依赖"上一页留下的注册" */
await page.evaluate(() => {
  if (!customElements.get('mc-button')) {
    const el = document.createElement('l-m');
    el.setAttribute('src', '/packages/button/button.html');
    document.head.append(el);
  }
});
await page
  .waitForFunction(() => !!customElements.get('mc-button'), { timeout: 8000 })
  .catch(() => {});

await page.evaluate((tone) => {
  const box = document.createElement('div');
  box.id = 'tone-probe';
  box.innerHTML =
    `<div style="${tone}"><mc-button id="tone-scoped" color="primary">子树</mc-button></div>` +
    `<mc-button id="tone-instance" color="primary" style="${tone}">实例</mc-button>` +
    `<mc-button id="tone-plain" color="primary">默认</mc-button>`;
  document.body.append(box);

  /* :root 上写 L3（--mc-button-fill）不该生效：组件 :host 自己声明过它，继承值打不过 */
  const style = document.createElement('style');
  style.id = 'tone-root-l3';
  style.textContent = ':root { --mc-button-fill: 9 9 9; }';
  document.head.append(style);
}, TONE);

await page
  .waitForFunction(
    () =>
      ['tone-scoped', 'tone-instance', 'tone-plain'].every(
        (id) => !!document.getElementById(id)?.shadowRoot,
      ),
    { timeout: 5000 },
  )
  .catch(() => {});

const tone = await page.evaluate(() => {
  const read = (id) => {
    const cs = getComputedStyle(document.getElementById(id));
    return { bg: cs.backgroundColor, fg: cs.color };
  };
  /* 默认按钮的期望值按当前主题算，别写死亮色值 */
  const primary = getComputedStyle(document.documentElement)
    .getPropertyValue('--mc-color-primary')
    .trim()
    .match(/\d+/g)
    .slice(0, 3)
    .join(', ');
  const out = {
    scoped: read('tone-scoped'),
    instance: read('tone-instance'),
    plain: read('tone-plain'),
    themePrimary: `rgb(${primary})`,
  };
  document.getElementById('tone-root-l3')?.remove();
  document.getElementById('tone-probe')?.remove();
  return out;
});
check(
  '任意色走令牌层：容器 / 实例上覆盖 L2 六件套就到达组件，:root 上写 L3 不生效（D8）',
  tone.scoped.bg === 'rgb(255, 240, 0)' &&
    tone.scoped.fg === 'rgb(0, 0, 0)' &&
    tone.instance.bg === 'rgb(255, 240, 0)' &&
    tone.instance.fg === 'rgb(0, 0, 0)' &&
    tone.plain.bg === tone.themePrimary,
  JSON.stringify({ ...tone, 期望任意色: 'rgb(255, 240, 0) / 字 rgb(0, 0, 0)' }),
);

/* ------------------------------------------------------------------ *
 * 12.5 boot/tone.js —— 任意色的唯一实现（D8）：
 *      命令式 / 声明式同一份实现、跨组件生效、切主题重算派生档、清除与非法值。
 * ------------------------------------------------------------------ */

/* tag 也引进来：要证明"一处实现、多个结构不同的组件一起受益" */
await page.evaluate(() => {
  if (!customElements.get('mc-tag')) {
    const el = document.createElement('l-m');
    el.setAttribute('src', '/packages/tag/tag.html');
    document.head.append(el);
  }
});
await page
  .waitForFunction(() => !!customElements.get('mc-tag'), { timeout: 8000 })
  .catch(() => {});

const toneModule = await page.evaluate(async () => {
  const { applyTone, clearTone } = await import('/packages/boot/tone.js');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cs = (el) => getComputedStyle(el);
  const box = document.createElement('div');
  box.id = 'tone2-probe';
  box.innerHTML =
    '<div id="tone2-scope"><mc-button id="tone2-btn" color="primary">按钮</mc-button>' +
    '<mc-tag id="tone2-tag" color="primary">标签</mc-tag></div>' +
    '<div id="tone2-decl" data-tone="#fff000"><mc-button id="tone2-dbtn" color="primary">声明式</mc-button></div>' +
    '<mc-button id="tone2-plain" color="primary">默认</mc-button>';
  document.body.append(box);
  await wait(250); // 组件升级是异步的

  const scope = document.getElementById('tone2-scope');
  const btn = document.getElementById('tone2-btn');
  const tag = document.getElementById('tone2-tag');
  const decl = document.getElementById('tone2-decl');
  const plain = document.getElementById('tone2-plain');
  const inline = (el, name) => el.style.getPropertyValue(name).trim();
  const asRgb = (el, name) => `rgb(${inline(el, name).split(/\s+/).join(', ')})`;

  /* ① 命令式：选择器 + hex（tag 的底色有 120ms 过渡，读计算值前要等它走完） */
  const applied = applyTone('#tone2-scope', '#fff000');
  await wait(400);
  const lightSubtle = inline(scope, '--mc-color-primary-subtle');
  const legacyTheme = document.documentElement.getAttribute('data-theme');

  /* ② 声明式：模块引入之后插入的 [data-tone] 要被观察器接住 */
  const declared = { bg: cs(document.getElementById('tone2-dbtn')).backgroundColor };

  /* ③ 切到相反的主题：hex 不变、派生档重算 */
  const wasDark = legacyTheme === 'dark';
  document.documentElement.setAttribute('data-theme', wasDark ? 'light' : 'dark');
  await wait(120);
  const flippedSubtle = inline(scope, '--mc-color-primary-subtle');
  if (legacyTheme === null) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', legacyTheme);
  await wait(400); // 恢复主题后 tag 又走一次过渡，等它落定再快照

  /* ③b 快照：必须在清除之前读 */
  const painted = {
    button: { bg: cs(btn).backgroundColor, fg: cs(btn).color },
    tag: { bg: cs(tag).backgroundColor, subtle期望: asRgb(scope, '--mc-color-primary-subtle') },
    brand: inline(scope, '--mc-color-primary'),
  };

  /* ④ 清除 + 非法值 */
  const cleared = clearTone('#tone2-scope');
  await wait(80);
  const bad = document.createElement('mc-button');
  box.append(bad);
  const invalid = applyTone(bad, 'rgb(1,2,3)');
  const missing = applyTone('#tone2-nope', '#fff000');

  const out = {
    applied,
    declared,
    cleared,
    invalid,
    missing,
    '按钮（命令式）': painted.button,
    '标签（命令式，4 槽）': painted.tag,
    '派生档变化': { light: lightSubtle, flipped: flippedSubtle, 品牌色未变: painted.brand },
    '默认按钮（同页对照）': cs(plain).backgroundColor,
    '清除后 primary 令牌': inline(scope, '--mc-color-primary'),
    '非法值没写令牌': bad.style.getPropertyValue('--mc-color-primary') === '',
  };
  document.getElementById('tone2-probe')?.remove();
  return out;
});

check(
  'tone.js：一处实现两种用法 —— 选择器 / 声明式都生效，跨组件（button + tag）一起变',
  toneModule.applied === true &&
    toneModule['按钮（命令式）'].bg === 'rgb(255, 240, 0)' &&
    toneModule['按钮（命令式）'].fg === 'rgb(0, 0, 0)' &&
    toneModule.declared.bg === 'rgb(255, 240, 0)',
  JSON.stringify(toneModule),
);
check(
  'tone.js：标签吃到同一份令牌（浅底 = 派生的 -subtle），切主题 hex 不变而派生档重算',
  toneModule['标签（命令式，4 槽）'].bg === toneModule['标签（命令式，4 槽）'].subtle期望 &&
    toneModule['派生档变化'].light !== toneModule['派生档变化'].flipped &&
    toneModule['派生档变化']['品牌色未变'] === '255 240 0',
  JSON.stringify(toneModule['派生档变化']),
);
check(
  'tone.js：clearTone 清干净（回到语义色），非法值与没命中的选择器都只返回 false、不改任何令牌',
  toneModule.cleared === true &&
    toneModule['清除后 primary 令牌'] === '' &&
    toneModule['默认按钮（同页对照）'].bg !== 'rgb(255, 240, 0)' &&
    toneModule.invalid === false &&
    toneModule.missing === false &&
    toneModule['非法值没写令牌'] === true,
  JSON.stringify({
    cleared: toneModule.cleared,
    invalid: toneModule.invalid,
    missing: toneModule.missing,
    '清除后 primary 令牌': toneModule['清除后 primary 令牌'],
  }),
);
}
