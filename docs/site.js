/**
 * 文档站的站点脚本 —— 只做**数据驱动的那一件事**：把页面里的占位
 * （组件卡片 / 色板 / 计数）渲染出来。
 *
 * 外壳不在这里：顶栏、主题按钮、正文带都在布局页 docs/layout.html 里
 * （它的 shadow root，样式与结构一体），顶栏高亮由它的 `routerChange` 负责。
 * 二级菜单也不在这里：哪个页面需要左栏，就自己放 <doc-nav>（docs/doc-nav.js）。
 *
 * 为什么这些必须留在模块里：页面模块的脚本**不能相对 import**
 * （ofa.js 的页面代码经 eval 执行，解析不了相对路径，这是个已知坑），
 * 而占位渲染要读组件登记表（components.js）。所以需要共享数据的渲染留在这里，
 * 页面只负责放自己的标记。同理，本文件必须能穿透 shadow root 查找。
 */

import { GROUPS, ALL, pageOf } from './components.js';
import { route } from './routes.js';
import { defineDocNav } from './doc-nav.js';

/* ------------------------------------------------------------------ *
 * 1. 路由
 *
 * 用地址栏 hash 做路由（o-router 负责把它和 o-app 同步）。
 * hash 里的路径相对仓库根 —— 因为 app-config.js 就放在根上。
 * 当前路由由 routes.js 的 route() 归一（地址栏没有 hash 时就是首页）。
 * 一级菜单不在这里 —— 它在布局页 docs/layout.html 的顶栏里。
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 2. DOM 工具
 * ------------------------------------------------------------------ */

/**
 * ⚠️ 不能直接 `Object.assign(node, props)`：`dataset` / `style` 这类是**只读 getter**，
 * 赋值会抛 `TypeError: Cannot set property dataset of #<HTMLElement> which has only a getter`，
 * 而且是在渲染中途抛出，表现为"整块内容空白"。
 */
const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset' || key === 'style') Object.assign(node[key], value);
    else node[key] = value;
  }
  node.append(...children);
  return node;
};

/**
 * 穿透 shadow root 的查询。
 *
 * 正文渲染在「布局页 o-page」和「子页面 o-page」各自的 shadow root 里，
 * 普通的 document.querySelector 看不到。页面里的 [data-palette] /
 * [data-component-cards] 占位、以及外壳的 .doc-main 都靠它找到。
 */
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

/* ------------------------------------------------------------------ *
 * 3. 色板渲染（token 文档页里的 [data-palette]）
 *
 * 直接读 packages/color/tokens.css 解析，而不是把色值抄一份到页面里 ——
 * 这样色板永远和真实令牌同步，不存在"文档写的是旧色值"。
 * ------------------------------------------------------------------ */

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

  // 匹配生成器输出的 `--mc-<family>-<step>: R G B; /* #hex */`
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
      // 浅底配深字、深底配浅字，保证色号在任何档位上都能看清。
      // 用令牌而不是硬编码，这样文档站自己也跟着主题走。
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

/* ------------------------------------------------------------------ *
 * 4. 组件卡片（总览页与首页里的 [data-component-cards]）
 * ------------------------------------------------------------------ */

function renderCardsInto(host) {
  const only = host.dataset.componentCards; // 'ready' | 'planned' | 'all'
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
      if (ready) card.href = `#/${pageOf(item.slug)}`;

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

/**
 * 把当前页面里的占位渲染掉。
 *
 * 用 dataset 打标记保证幂等 —— 路由变化会反复触发，重复渲染会把内容叠加起来。
 */
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

/* ------------------------------------------------------------------ *
 * 5. 路由变化
 *
 * 页面是异步挂载的，所以不能在 hashchange 那一刻只渲染一次 —— 那时新页面还没上来。
 * 而且页面内容渲染在 o-page **自己的** shadow root 里（实测：o-app 的 shadow root
 * 里只有一个 <style> 和一个 <slot>，o-page 是它的 light DOM 子节点），
 * 所以从 document 或 o-app 上挂 MutationObserver 都看不到内容出现。
 *
 * 干脆用「有上限的轮询」：简单、显然正确、自限。
 * 渲染是幂等的 —— 占位元素上打 dataset.rendered 标记，重复执行没有副作用。
 * ------------------------------------------------------------------ */

const RENDER_POLL_MS = 100;
const RENDER_POLL_TRIES = 50; // 约 5 秒，足够覆盖慢速 CDN

/** 路由页挂上之后再观察几拍，等它把 shadow 内容建完 */
const RENDER_STABLE_TICKS = 5;

let pollTimer = null;

/**
 * 当前挂上的页面是不是 hash 指向的那一个。
 *
 * ⚠️ 嵌套路由下 document 里有**两个** o-page：外层是布局页 docs/layout.html，
 * 内层（它的 light DOM 子节点）才是当前子页面。所以要遍历，不能只看第一个。
 *
 * ⚠️ 不能只比对 `.doc-body` 变没变 —— 首次带着 hash 打开时，o-app 会先加载
 * app-config 里的首页，再切到 hash 指向的页面；「变了」在首页那一刻就成立，
 * 轮询于是提前收工，真正那一页的占位（组件卡片、色板）永远没人渲染。
 * 实测：直接打开 `#/docs/pages/components.html`，卡片区是空的。
 */
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

    // 路由页到了、正文也挂上了，再多看几拍确认内容建完（占位是幂等的，多跑没副作用）
    const ready = isRoutedPageMounted() && deepQuery('.doc-body').length > 0;
    stable = ready ? stable + 1 : 0;

    if (stable >= RENDER_STABLE_TICKS || ++tries >= RENDER_POLL_TRIES) clearInterval(pollTimer);
  };

  tick();
  pollTimer = setInterval(tick, RENDER_POLL_MS);
}

/* ------------------------------------------------------------------ *
 * 6. 启动
 * ------------------------------------------------------------------ */

defineDocNav(); // 注册 <doc-nav>，页面里的左栏靠它
scheduleRender();

/**
 * 换页时把正文区拉回顶部，并渲染新页面的占位。
 *
 * ⚠️ 滚动的是外壳的 `.doc-main` —— 它在布局页的 shadow root 里（所以要 deepQuery）。
 * 滚 window 是空操作：外壳固定一屏、全局没有滚动条（见 docs/shell.css）。
 * 页面自带的左栏不用管：换页会连页面一起换掉，新元素从 0 开始。
 *
 * ⚠️ 只监听 hashchange 不够：布局页顶栏的 `<a olink>` 走 history.pushState，
 * **不触发 hashchange**。o-app 每次导航都会冒泡一个 `router-change` 事件
 * （实测从 o-app 冒到 document），拿它当主信号，hashchange 兜底。
 */
function onRouteChange() {
  deepQuery('.doc-main')[0]?.scrollTo({ top: 0 });
  scheduleRender();
}

document.addEventListener('router-change', onRouteChange);
window.addEventListener('hashchange', onRouteChange);
