/**
 * 冒烟测试的公共基座：浏览器、断言、穿透查询注入、导航工具。
 *
 * 站点套件（`tests/site/*.mjs`）和组件套件（`packages/<slug>/test/*.mjs`）都是
 * `export default async (ctx) => {…}`，从这里拿同一套东西：
 *
 *   { page, newPage, visit, goHash, goTop, pageState, check, problems,
 *     browser, chromium, BASE, CHANNEL, results, close }
 *
 * 每个页面（连新开的页）都注入一遍穿透查询，所以套件里不用再各自抄一份 `__deepAll`。
 *
 * 顺序由入口 `tests/smoke.mjs` 决定：站点套件在前，组件套件按登记表顺序在后 ——
 * 有些站点断言看的是"主 page 现在停在哪一页"，所以套件内部要自己先 `visit`/`goHash`，
 * 不要指望上一个套件留下的页面。
 */

import { chromium } from 'playwright-core';

export const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:8642').replace(/\/$/, '');
export const CHANNEL = process.env.CHANNEL ?? 'chrome';

/**
 * 注入到每个页面：
 *   · `__deep` / `__deepAll` —— 穿透 shadow root 的查询（页面内容在 o-page 的 shadow root 里）
 *   · pointermove 监听计数 —— 验证切走首页时确实清理了（否则每次进首页都会多挂一个）
 */
export function pageHelpers() {
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
}

export async function createHarness() {
  const results = [];
  const problems = [];

  const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(
      `  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}` +
        (detail ? `\n        \x1b[2m${detail}\x1b[0m` : ''),
    );
  };

  const browser = await chromium.launch({ channel: CHANNEL });

  /** 新开一页（可带 context 选项）：穿透查询一起注入，套件里不手抄 __deepAll */
  const newPage = async (options) => {
    const p = await browser.newPage(options);
    await p.addInitScript(pageHelpers);
    return p;
  };

  const page = await newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });

  /**
   * 打开一个页面并等它稳定。
   *
   * 不用裸的 `waitUntil: 'networkidle'` —— 页面要从 jsDelivr 取 ofa.js，
   * CDN 抽风时那个请求会一直挂着，networkidle 永远不满足、直接超时，
   * 于是测试因为网络而不是因为代码红了（开发时就遇到过一次）。
   * 这里给 networkidle 加个上限，超时就继续 —— 真正该失败的地方由后面的断言负责。
   */
  async function visit(target, path) {
    const res = await target.goto(path.startsWith('http') ? path : BASE + path, {
      waitUntil: 'load',
    });
    await target.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    return res; // 调用方要拿 status / ok()
  }

  /** 穿透 shadow root 的页面快照（主 page 专用） */
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
      window
        .__deepAll('.doc-top-nav a')
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

  const close = () => browser.close();

  return {
    browser,
    chromium,
    page,
    newPage,
    visit,
    goTop,
    goHash,
    pageState,
    check,
    problems,
    results,
    BASE,
    CHANNEL,
    close,
  };
}
