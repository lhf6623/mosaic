/* 文档站站点脚本 —— 只剩两件「不建 DOM」的杂事：
 *   · 路由变化时把正文带滚回顶部（换页复位）；
 *   · 两侧浮动栏滚到底后，把滚轮接力给正文带（fixed 元素的滚轮链终点是视口，视口不滚）。
 * 页面占位（组件卡片 / 色板）已经是组件：docs/doc-cards.html、docs/doc-palette.html；
 * 左栏 / 右栏 / 面包屑 / 翻页也都是组件模板，路由信号统一走 docs/state/route.js。 */

import { onRouteChange, startRouteTracking } from './state/route.js';

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

/* ---------- 侧栏滚到底后，滚轮接力给正文带 ----------
 *
 * 两栏是 position: fixed（见 content.css 的分栏注释）：fixed 元素的滚轮链终点是**视口**，
 * 而视口不滚（外壳锁一屏，滚的是 .doc-main）—— 于是滚轮在栏内到底后会被吞掉。
 * 这里只在边界那一下接管、转发给正文带，栏内还能滚时一律不插手
 * （同 packages/code/code.html 里限高代码块的处理）。
 */
const WHEEL_LINE = 16;

function wheelPixels(event) {
  if (event.deltaMode === 1) return event.deltaY * WHEEL_LINE;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

// ⚠️ 不能用 event.target：跨了两层 shadow 之后它在 document 层被重定向成外层宿主（实测是 o-page），
// 只能用 composedPath() 在事件路径里认出 <doc-nav> / <doc-toc>
document.addEventListener(
  'wheel',
  (event) => {
    if (!event.deltaY || event.ctrlKey || event.metaKey) return;

    const host = event
      .composedPath()
      .find((node) => node instanceof Element && node.matches?.('doc-nav, doc-toc'));
    if (!host) return;

    const down = event.deltaY > 0;
    const atTop = host.scrollTop <= 0;
    const atBottom = host.scrollTop + host.clientHeight >= host.scrollHeight - 1;
    if ((down && !atBottom) || (!down && !atTop)) return;

    const scroller = deepQuery('.doc-main')[0];
    if (!scroller) return;

    event.preventDefault(); // 拦掉「被吞掉的那一次」，改由我们转发
    scroller.scrollTop += wheelPixels(event);
  },
  { passive: false },
);

/* ---------- 启动 ---------- */

startRouteTracking(); // 全站唯一挂 hashchange + router-change 的地方（docs/state/route.js）

/** 换页复位：滚的是外壳的 .doc-main（在 shadow root 里，window 不可滚） */
function handleRouteChange() {
  deepQuery('.doc-main')[0]?.scrollTo({ top: 0 });
}

// olink 走 pushState、不触发 hashchange（P28）：两个信号的差异收在 state/route.js 里，这里只订阅
onRouteChange(handleRouteChange);
