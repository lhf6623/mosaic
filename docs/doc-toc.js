/* `<doc-toc>` —— 组件文档页右栏的「本页目录」，站点级自定义元素
 * （和 <doc-nav> 一样不进 packages/：它读的是页面结构、知道外壳的滚动容器，
 *   且要渲染进页面自己的 shadow root，见 docs/doc-nav.js 头部那段）。
 *
 * 与 <doc-nav>（左栏、来自登记表）成对：这一栏扫**页面自己的标题**生成，所以：
 *   · 它必须和正文住在同一个 shadow root 里（页面模板里放一个 <doc-toc> 就行），
 *     这样才能 h2/h3 一把捞出来；
 *   · 目录项不能用 `#id` 锚点：地址栏 hash 归 ofa 路由器所有（#/packages/…），
 *     而且页面正文在 shadow root 里、URL fragment 也进不去 —— 所以点击一律
 *     preventDefault + 程序化滚动（见 agent/ofa-pitfalls.md 的 P28/P29 一带）；
 *   · 滚动容器只有外壳的 .doc-main（见 content.css 的分栏注释），scroll-spy 盯它；
 *     高亮仍旧走 mc-menu 那条路：给 <a> 写 aria-current，组件镜像成宿主的 data-current。
 *
 * ⚠️ 标题不是一开始就齐的：组件总览页的卡片由 docs/site.js 异步渲染，才长出分组 h3。
 * 所以这里挂一个 MutationObserver，标题签名变了就重建目录（签名没变不碰 DOM，
 * 免得把正在点的节点换掉 —— 同 doc-nav.js 里那条「不重建 DOM」的教训）。
 */

import { el, attr, setCurrent } from './dom.js';

export const DOC_TOC_TAG = 'doc-toc';

/** 收进目录的标题层级。页面里 h1 只有一个（页名），不进目录 */
const HEADINGS = 'h2, h3';

/** 当前项判定带：滚动容器顶部往下这么高的区间里，最后一个标题算「当前」。
 *  不能只留几像素 —— 点目录项后标题落在 scroll-margin-top（顶栏 + 间距 ≈ 72px）处，
 *  判定线太靠上会把上一节判成当前（实测踩过） */
const ACTIVE_BAND_RATIO = 0.3;
const ACTIVE_BAND_MAX = 240;

/** 页面内容变动后重建目录的防抖时间 */
const REBUILD_DEBOUNCE = 150;

/** 标题文案 → id（CJK 原样保留；去空白与标点，重复的加序号） */
function slugify(text, taken) {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'section';
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

class DocToc extends HTMLElement {
  /** 箭头函数字段：add 和 remove 必须是同一个引用（同 doc-nav.js 的理由） */
  _onScroll = () => this.syncActive();
  _onResize = () => this.syncActive();
  _onMutate = (records) => {
    // 自己重建目录造成的变动不算「页面内容变了」，否则自激
    if (records.every((r) => r.target === this || this.contains(r.target))) return;
    this.scheduleRender();
  };

  connectedCallback() {
    this._observer = new MutationObserver(this._onMutate);

    /* 页面模板是整块挂上来的，但异步内容（示例、总览卡片）会晚到 —— 先补几拍，之后交给 observer */
    let tries = 0;
    const settle = () => {
      if (this.render() || ++tries >= 10) return;
      setTimeout(settle, 50);
    };
    settle();

    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback() {
    clearTimeout(this._rebuildTimer);
    this._observer?.disconnect();
    this._scroller?.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
  }

  scheduleRender() {
    clearTimeout(this._rebuildTimer);
    this._rebuildTimer = setTimeout(() => this.render(), REBUILD_DEBOUNCE);
  }

  /** 扫标题 → 建目录。返回是否建成了（没标题时由 settle 再试） */
  render() {
    const root = this.getRootNode();
    const headings = [...root.querySelectorAll(HEADINGS)].filter((h) => h.textContent.trim());
    if (!headings.length) return false;

    // 标题没变就别碰 DOM：重建会把正在点击 / 正在滚动的节点换掉
    const signature = headings.map((h) => h.textContent.trim()).join('|');
    if (this._signature === signature) return true;
    this._signature = signature;

    const taken = new Set();
    this._entries = headings.map((heading) => {
      if (!heading.id) heading.id = slugify(heading.textContent, taken);
      else taken.add(heading.id);
      return { heading, id: heading.id, level: Number(heading.tagName.slice(1)) };
    });

    this.replaceChildren(this._buildMenu());
    this._menu.addEventListener('click', (event) => this.onItemClick(event));

    // 一次性动作：盯页面内容变化、找到滚动容器并挂上 scroll-spy
    this._observer.observe(root, { childList: true, subtree: true });
    this._scroller ??= this.scroller();
    this._scroller?.addEventListener('scroll', this._onScroll, { passive: true });

    this.syncActive();
    return true;
  }

  _buildMenu() {
    // ⚠️ 自定义属性（size / group）走 attr()：el() 只赋 property，`size = 'sm'` 是 expando
    const menu = attr(el('mc-menu'), { size: 'sm' });
    menu.append(attr(el('mc-menu-item', { textContent: '本页目录' }), { group: '' }));

    for (const entry of this._entries) {
      const a = el('a', { href: `#${entry.id}`, textContent: entry.heading.textContent.trim() });
      a.dataset.tocId = entry.id;
      const item = el('mc-menu-item', {}, [a]);
      /* h3 比 h2 缩进一档：走 mc-menu 的 L3 尺寸通道，不另开 API */
      if (entry.level > 2) item.style.setProperty('--mc-menu-pad-x', 'calc(var(--mc-space-3) * 2)');
      menu.append(item);
    }

    this._menu = menu;
    return menu;
  }

  /**
   * 最近的滚动祖先。⚠️ 必须走**扁平树**：子页面是被外壳的 <slot> 投影进去的，
   * 只看 parentElement / getRootNode().host 会从文档树绕过去，永远走不到 .doc-main。
   */
  scroller() {
    let node = this.assignedSlot ?? this.parentElement ?? this.getRootNode()?.host ?? null;
    while (node) {
      const style = getComputedStyle(node);
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(style.overflowY)) {
        return node;
      }
      node = node.assignedSlot ?? node.parentElement ?? node.getRootNode()?.host ?? null;
    }
    return null;
  }

  /** 地址栏 hash 不归我们管，所以只滚不跳 */
  onItemClick(event) {
    const a = event.target?.closest?.('a');
    const entry = a && this._entries.find((e) => e.id === a.dataset.tocId);
    if (!entry) return;

    event.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    entry.heading.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  /** 滚动位置 → 当前项。位置每次现量，演示区抽屉开合后不用额外通知 */
  syncActive() {
    if (!this._entries || !this._scroller) return;
    const box = this._scroller.getBoundingClientRect();
    const line = box.top + Math.min(box.height * ACTIVE_BAND_RATIO, ACTIVE_BAND_MAX);

    let active = this._entries[0];
    for (const entry of this._entries) {
      if (entry.heading.getBoundingClientRect().top <= line) active = entry;
    }

    for (const link of this._menu.querySelectorAll('a')) {
      setCurrent(link, link.dataset.tocId === active?.id, 'location');
    }
  }
}

/** 注册元素。重复注册会抛，所以先查一遍 */
export function defineDocToc() {
  if (!customElements.get(DOC_TOC_TAG)) customElements.define(DOC_TOC_TAG, DocToc);
}
