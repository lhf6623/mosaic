/** 冒烟测试公共基座：浏览器/页面、穿透 shadow root 的查询、导航工具、check 与 results；套件要自己 visit/goHash，别指望上一套留下的页面。 */

import { chromium } from 'playwright-core';

export const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:8642').replace(/\/$/, '');
export const CHANNEL = process.env.CHANNEL ?? 'chrome';

/** 注入每个页面：穿透 shadow 的 __deep/__deepAll；pointermove 监听计数（验证切走首页时清理） */
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

  // 外壳（顶栏、正文带、主题按钮）在布局页 docs/layout.html 的 shadow root 里，所以查外壳一律走穿透版
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

  /* 浏览器取 CDN 走的是**系统代理**（curl 不走），本机代理挂掉时页面永远到不了 load，
     表象是「套件第一条就 30s 超时」。测试只连 localhost + jsDelivr，所以给一个直连开关：
     BROWSER_NO_PROXY=1 pnpm test。默认不变，免得挡掉真需要代理的环境。 */
  const args = process.env.BROWSER_NO_PROXY === '1' ? ['--no-proxy-server'] : [];
  const browser = await chromium.launch({ channel: CHANNEL, args });

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
   * 打开页面并等稳定：networkidle 必须加上限 —— 从 jsDelivr 取 ofa.js 时 CDN 抽风会一直挂着，
   * 裸等会把测试因网络拖红（开发时遇到过一次）；真正的失败交给后面的断言。
   */
  async function visit(target, path) {
    const res = await target.goto(path.startsWith('http') ? path : BASE + path, { waitUntil: 'load' });
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

  /** 用顶部一级导航切页（真实点击）；顶栏在布局页的 shadow root 里 */
  async function goTop(label) {
    await page.evaluate((text) => {
      window.__deepAll('.doc-top-nav a')
        .find((a) => a.textContent.trim() === text)
        ?.click();
    }, label);
    await page.waitForTimeout(1500);
  }

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
