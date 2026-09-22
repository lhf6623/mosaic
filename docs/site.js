/* 文档站站点脚本：渲染页面里的占位（组件卡片 / 色板 / 计数）。
 * 页面模块的脚本不能相对 import，所以读登记表的渲染留在这里（详见 agent/components.md）。 */

import { GROUPS, ALL, pageOf } from './components.js';
import { route, hashOf } from './routes.js';
import { defineDocNav } from './doc-nav.js';

/* dataset / style 是只读 getter：Object.assign(node, props) 会抛，且是在渲染途中抛 */
const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset' || key === 'style') Object.assign(node[key], value);
    else node[key] = value;
  }
  node.append(...children);
  return node;
};

/** 穿透 shadow root 的查询（正文在 o-page 的 shadow root 里，document.querySelector 看不到） */
function deepQuery(selector) {
  const hits = [];
  const walk = (root) => {
    for (const node of root.querySelectorAll(selector)) hits.push(node);
    for (const node of root.querySelectorAll('*')) {
      if (node.shadowRoot) walk(node.shadowRoot);
    }
  };
  walk(document);
  return hits;
}

/* ---------- 色板：直接解析 packages/color/tokens.css，色值不抄第二份 ---------- */

const LAYOUT_ORDER = ['neutral', 'primary', 'info', 'success', 'warning', 'danger'];

function relativeLuminance(r, g, b) {
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

async function renderPaletteInto(host) {
  let css;
  try {
    const res = await fetch('./packages/color/tokens.css', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    css = await res.text();
  } catch (err) {
    host.textContent = `色板读取失败：${err.message}（请通过 http 服务打开，不要用 file://）`;
    return;
  }

  // 生成器输出的形状：`--mc-<family>-<step>: R G B; /* #hex */`
  const re = /--mc-([a-z]+)-(\d+):\s*([\d ]+);\s*\/\*\s*(#[0-9a-f]{6})\s*\*\//gi;
  const families = new Map();

  for (const [, family, step, channels, hex] of css.matchAll(re)) {
    if (!families.has(family)) families.set(family, new Map());
    families.get(family).set(Number(step), { channels: channels.trim(), hex });
  }

  if (!families.size) {
    host.textContent = '没有从 tokens.css 里解析到原始色阶，正则可能需要跟着生成器更新。';
    return;
  }

  const ordered = [...families.keys()].sort(
    (a, b) => LAYOUT_ORDER.indexOf(a) - LAYOUT_ORDER.indexOf(b),
  );

  for (const family of ordered) {
    const steps = [...families.get(family).entries()].sort((a, b) => a[0] - b[0]);

    const row = el('div', { className: 'doc-palette-row' });
    row.append(el('div', { className: 'doc-palette-name', textContent: family }));

    const strip = el('div', { className: 'doc-palette-strips' });
    for (const [step, { channels, hex }] of steps) {
      const [r, g, b] = channels.split(/\s+/).map(Number);
      const swatch = el('div', { className: 'doc-swatch', textContent: String(step) });
      swatch.style.backgroundColor = `rgb(${channels})`;
      // 浅底配深字、深底配浅字
      swatch.style.color =
        relativeLuminance(r, g, b) > 0.45
          ? 'rgb(var(--mc-neutral-950))'
          : 'rgb(var(--mc-neutral-50))';
      swatch.title = `--mc-${family}-${step} · ${hex}`;
      strip.append(swatch);
    }

    row.append(strip);
    host.append(row);
  }
}

/* ---------- 组件卡片（总览页与首页里的 [data-component-cards]） ---------- */

function renderCardsInto(host) {
  const only = host.dataset.componentCards;
  const groups =
    only && only !== 'all'
      ? GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.status === only) })).filter(
          (g) => g.items.length,
        )
      : GROUPS;

  for (const group of groups) {
    const section = el('section', { className: 'doc-comp-group' });
    section.append(el('h3', { textContent: group.title }));
    if (group.desc) {
      section.append(el('p', { className: 'doc-comp-group-desc', textContent: group.desc }));
    }

    const grid = el('div', { className: 'doc-comp-grid' });
    for (const item of group.items) {
      const ready = item.status === 'ready';
      const card = el(ready ? 'a' : 'div', {
        className: 'doc-comp-card',
        dataset: { status: item.status },
      });
      // hash 是按「相对域名根」解析的，子路径部署要带上前缀（见 routes.js）
      if (ready) card.href = hashOf(pageOf(item.slug));

      const badge = el('span', {
        className: 'doc-comp-badge',
        textContent: ready ? '已实现' : item.milestone,
      });
      badge.dataset.status = item.status;

      card.append(
        el('div', { className: 'doc-comp-card-top' }, [
          el('span', { className: 'doc-comp-card-name', textContent: item.name }),
          badge,
        ]),
        el('code', { className: 'doc-comp-card-tag', textContent: item.tag }),
        el('p', { className: 'doc-comp-card-desc', textContent: item.desc }),
      );
      grid.append(card);
    }

    section.append(grid);
    host.append(section);
  }
}

/** 打 dataset 标记保证幂等 —— 路由变化会反复触发，重复渲染会把内容叠加起来 */
function renderPagePlaceholders() {
  for (const host of deepQuery('[data-palette]')) {
    if (host.dataset.rendered) continue;
    host.dataset.rendered = '1';
    renderPaletteInto(host);
  }

  for (const host of deepQuery('[data-component-cards]')) {
    if (host.dataset.rendered) continue;
    host.dataset.rendered = '1';
    renderCardsInto(host);
  }

  for (const node of deepQuery('[data-component-count]')) {
    const wanted = node.dataset.componentCount;
    const n = ALL.filter((i) => (wanted === 'all' ? true : i.status === wanted)).length;
    node.textContent = String(n);
  }
}

/* ---------- 路由变化：页面异步挂上，用有上限的轮询等它到齐 ---------- */

const RENDER_POLL_MS = 100;
const RENDER_POLL_TRIES = 50; // 约 5 秒，足够覆盖慢速 CDN
const RENDER_STABLE_TICKS = 5;

let pollTimer = null;

/** 当前挂上的页面是不是 hash 指向的那一个（嵌套路由下有两个 o-page，要遍历） */
function isRoutedPageMounted() {
  const want = `/${route()}`;
  return [...document.querySelectorAll('o-page')].some((page) => {
    const src = page.getAttribute('src');
    return !!src && decodeURIComponent(src.split(/[?#]/)[0]).endsWith(want);
  });
}

function scheduleRender() {
  clearInterval(pollTimer);

  let tries = 0;
  let stable = 0;

  const tick = () => {
    renderPagePlaceholders();

    // 页面到齐后再多看几拍，等它把 shadow 内容建完（占位是幂等的，多跑没副作用）
    const ready = isRoutedPageMounted() && deepQuery('.doc-body').length > 0;
    stable = ready ? stable + 1 : 0;

    if (stable >= RENDER_STABLE_TICKS || ++tries >= RENDER_POLL_TRIES) clearInterval(pollTimer);
  };

  tick();
  pollTimer = setInterval(tick, RENDER_POLL_MS);
}

/* ---------- 启动 ---------- */

defineDocNav();
scheduleRender();

/** 换页复位 + 重渲染。滚的是外壳的 .doc-main（在 shadow root 里，window 不可滚） */
function onRouteChange() {
  deepQuery('.doc-main')[0]?.scrollTo({ top: 0 });
  scheduleRender();
}

// olink 走 pushState、不触发 hashchange（P28），所以主信号用 router-change
document.addEventListener('router-change', onRouteChange);
window.addEventListener('hashchange', onRouteChange);
