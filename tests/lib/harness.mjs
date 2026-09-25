/**
 * 冒烟测试公共基座：浏览器/页面、穿透 shadow root 的查询、导航工具、check 与 results。
 *
 * 一个套件 = 一个独立 page，都挂在**同一个 browser context** 上：
 *   · 缓存共享 —— ofa.js / mosaic.css / 组件 .html 都来自 CDN，一个 context 只下一次；
 *   · 页面隔离 —— 套件之间没有隐式顺序依赖（套件依旧要自己 visit/goTop/goHash，别指望上一套留下的页面），
 *     所以 tests/smoke.mjs 可以用 --jobs 并行跑。
 * 每份会话有自己的 check 缓冲与错误清单（console / pageerror / HTTP≥400），互不污染。
 */

import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:8642').replace(/\/$/, '');
export const CHANNEL = process.env.CHANNEL ?? 'chrome';

/* ------------------------------------------------------------------ *
 * 「套件碰过哪些仓库文件」的采集：选测中间层（tests/select.mjs）的原料。
 * 页面请求的都是 localhost 上的仓库文件；CDN / data: / blob: 一律不算。
 * ------------------------------------------------------------------ */

let REPO_FILES = null;

/** 仓库里的文件清单（懒扫一次），用来把 URL 还原成仓库相对路径 */
function repoFiles() {
  if (REPO_FILES) return REPO_FILES;
  const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
  const skip = new Set(['node_modules', '.git', '.dsh', '.DS_Store']);
  const out = new Set();
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(`${dir}/${entry.name}`, rel);
      else out.add(rel);
    }
  };
  walk(root, '');
  REPO_FILES = out;
  return out;
}

/** URL → 仓库相对路径；不是本机文件 / 不在仓库里（favicon、CDN）返回 null */
export function repoPathOfUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(parsed.hostname)) return null;

  let path = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  const index = repoFiles();
  /* 子路径部署（08 的 --prefix /mosaic）会多一段前缀：从左往右剥到能对上仓库里的文件为止 */
  while (path && !index.has(path)) {
    const cut = path.indexOf('/');
    if (cut < 0) return null;
    path = path.slice(cut + 1);
  }
  return path || null;
}

/** 并行度默认值：4 与 CPU 数取小 —— 每个 page 都要真渲染，开太多只会互相拖慢 */
export const defaultJobs = () => Math.min(4, availableParallelism?.() ?? 4);

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

  /* <doc-nav> 是 ofa 组件模板（docs/components/nav.html），条目住在它**自己的** shadow root 里。
     CSS 选择器跨不过 shadow 边界，所以 `__deep*('doc-nav a')` 永远匹配不到 ——
     选择器里没法同时包含宿主和宿主 shadow 内的节点（P12 那条的同一个道理）。
     查组件内部一律走这个「宿主 + shadow 双路」助手。 */
  window.__inside = (hostSel, sel) => {
    const host = window.__deep(hostSel);
    if (!host) return [];
    return [...host.querySelectorAll(sel), ...(host.shadowRoot?.querySelectorAll(sel) ?? [])];
  };
}

export async function createHarness() {
  /* 浏览器取 CDN 走的是**系统代理**（curl 不走），本机代理挂掉时页面永远到不了 load，
     表象是「套件第一条就 30s 超时」。测试只连 localhost + jsDelivr，所以给一个直连开关：
     BROWSER_NO_PROXY=1 pnpm test。默认不变，免得挡掉真需要代理的环境。 */
  const args = process.env.BROWSER_NO_PROXY === '1' ? ['--no-proxy-server'] : [];
  const browser = await chromium.launch({ channel: CHANNEL, args });

  /* 一个 context 装所有套件的 page：CDN 缓存共享，页面之间互不可见（各自的 storage / cookie） */
  const context = await browser.newContext();
  await context.addInitScript(pageHelpers);

  /**
   * 给一个套件开一份独立会话：自己的 page、自己的 check 缓冲、自己的错误清单。
   * 返回的 API 与套件里解构的那几个名字一一对应（跨套件串用 page 会串台）。
   */
  async function createSession(label) {
    const page = await context.newPage();
    const results = [];
    const problems = [];
    /** 本套件碰过的仓库文件（选测中间层的原料，见 tests/select.mjs） */
    const files = new Set();

    /* 先落到站点再挂监听：有些套件开头直接 goTop / goHash（假定页面已经在站点上）。
       这次加载刻意不算进 problems —— 01 号套件断言 problems.length === 0，
       它量的是自己那次 visit，不是这一跳。 */
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' }).catch(() => {});

    /** 套件里所有 page（含 newPage 开的）都挂同一套监听：错误清单 + 碰过的文件 */
    const trackPage = (p) => {
      p.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text()}`);
      });
      p.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
      p.on('response', (r) => {
        if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
        const path = repoPathOfUrl(r.url());
        if (path) files.add(path);
      });
    };
    trackPage(page);

    /** 断言入缓冲，由 smoke.mjs 决定什么时候打印（并行时按套件成块输出） */
    const check = (name, ok, detail = '') => results.push({ name, ok, detail });

    /** 新开一页（同在共享 context 里）：注入脚本随 context 生效，监听也一并挂上 */
    const newPage = async (options) => {
      const opened = await context.newPage(options);
      trackPage(opened);
      return opened;
    };

    /**
     * 打开页面并等稳定：networkidle 必须加上限 —— 从 jsDelivr 取 ofa.js 时 CDN 抽风会一直挂着，
     * 裸等会把测试因网络拖红（开发时遇到过一次）；真正的失败交给后面的断言。
     */
    async function visit(target, path) {
      const res = await target.goto(path.startsWith('http') ? path : BASE + path, {
        waitUntil: 'load',
      });
      await target.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      return res; // 调用方要拿 status / ok()
    }

    /* 路由就绪 = 顶栏入口已经渲染出来（layout 的 ready 跑完）。冷启动时 ofa.js 还在从 CDN 下来，
       这之前点顶栏、改 hash 都是空操作 —— 筛着单跑某条站点套件就会踩到（没有前面的套件把它带热）。 */
    const routerReady = (target = page) =>
      target
        .waitForFunction(() => window.__deepAll('.doc-top-nav a').length >= 5, { timeout: 10000 })
        .catch(() => {});

    /** 用顶部一级导航切页（真实点击）；顶栏在布局页的 shadow root 里 */
    async function goTop(text) {
      await routerReady();
      await page.evaluate((label) => {
        window.__deepAll('.doc-top-nav a')
          .find((a) => a.textContent.trim() === label)
          ?.click();
      }, text);
      // 高亮落上 = 路由真的换了（点早了会什么都没发生）
      await page
        .waitForFunction(
          (label) =>
            window.__deepAll('.doc-top-nav a')
              .find((a) => a.textContent.trim() === label)
              ?.hasAttribute('aria-current'),
          text,
          { timeout: 10000 },
        )
        .catch(() => {});
      await page.waitForTimeout(1500);
    }

    async function goHash(to) {
      await routerReady();
      await page.evaluate((h) => {
        location.hash = `#/${h}`;
      }, to);
      await page
        .waitForFunction(
          (h) => decodeURIComponent(location.hash).replace(/^#\//, '') === h,
          to,
          { timeout: 10000 },
        )
        .catch(() => {});
      await page.waitForTimeout(1500);
    }

    /** 穿透 shadow root 的页面快照（本套件的 page） */
    const pageState = () =>
      page.evaluate(() => {
        const all = window.__deepAll;
        const nav = all('.doc-top-nav a');
        return {
          probe: window.__mosaicProbe,
          hash: location.hash.replace(/^#\//, ''),
          h1: all('h1')[0]?.textContent?.trim() ?? null,
          page: nav.find((a) => a.hasAttribute('aria-current'))?.textContent?.trim() ?? null,
          // 二级菜单在页面自己里面（<doc-nav>，ofa 组件）—— 宿主穿透查，条目在宿主 shadow 里双路查
          navLinks: window.__inside('doc-nav', 'a').length,
          split: all('.doc-split').length > 0,
          cards: all('.doc-comp-card').length,
          paletteRows: all('.doc-palette-row').length,
          buttons: all('mc-button').length,
          cta: all('.poster-links > *').map((el) => el.textContent.trim()),
          ctaTags: all('.poster-links > *').map((el) => el.tagName.toLowerCase()),
        };
      });

    return {
      label,
      page,
      newPage,
      visit,
      routerReady,
      goTop,
      goHash,
      pageState,
      check,
      problems,
      results,
      files,
      // 套件偶尔要自己开 context（03 的 reduced-motion）或看通道，照旧透传
      browser,
      context,
      chromium,
      BASE,
      CHANNEL,
      /** 关掉这一页（套件收工）；context / browser 由 smoke.mjs 统一收 */
      close: () => page.close(),
    };
  }

  return {
    browser,
    context,
    chromium,
    createSession,
    BASE,
    CHANNEL,
    close: () => browser.close(),
  };
}
