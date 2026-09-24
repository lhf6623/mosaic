/* `<doc-crumb>` / `<doc-pager>` —— 从当前路由在 docs/nav.js 那棵树里的位置派生的两小块：
 * 面包屑（组件 / Button）与上一页 / 下一页。
 *
 * 以前这两块是每个组件页手写的：4 份面包屑 + 5 条翻页链接，加一个组件、调一次顺序都要
 * 手工跟着改（而且当时已经不一致：Button 与 Collapse 只有 prev、没有 next）。现在一处都不用手写。
 *
 * 与 <doc-nav> 同一个套路：站点级普通自定义元素，渲染进**页面自己的** shadow root，
 * 样式在 content.css（`doc-crumb` / `doc-pager` 两个标签选择器）。
 *
 * ⚠️ 挂载那一刻 `location.hash` 未必已经落到新路由（SPA 内跳转时页面先挂上、hash 后落），
 * 所以**必须跟着路由重渲染** —— 只按 connectedCallback 渲染一次会出现「点进组件页却没有面包屑」
 * （子路径套件实测抓到）。签名没变就不动 DOM。
 */

import { locate, siblingsOf } from './site-map.js';
import { route, hashOf } from './routes.js';
import { el } from './dom.js';

export const DOC_CRUMB_TAG = 'doc-crumb';
export const DOC_PAGER_TAG = 'doc-pager';

class DocCrumb extends HTMLElement {
  _onRouteChange = () => this.render();

  connectedCallback() {
    this.render();
    window.addEventListener('hashchange', this._onRouteChange);
    document.addEventListener('router-change', this._onRouteChange);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this._onRouteChange);
    document.removeEventListener('router-change', this._onRouteChange);
  }

  render() {
    const current = route();
    if (current === this._route) return;
    this._route = current;

    const hit = locate(current);
    // 顶层入口自己那一页没有「在哪里面」这回事，不渲染
    if (!hit?.leaf) return;

    this.replaceChildren(
      el('a', { href: hashOf(hit.entry.to), textContent: hit.entry.label }),
      document.createTextNode(` / ${hit.leaf.label}`),
    );
  }
}

class DocPager extends HTMLElement {
  _onRouteChange = () => this.render();

  connectedCallback() {
    this.render();
    window.addEventListener('hashchange', this._onRouteChange);
    document.addEventListener('router-change', this._onRouteChange);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this._onRouteChange);
    document.removeEventListener('router-change', this._onRouteChange);
  }

  render() {
    const current = route();
    if (current === this._route) return;
    this._route = current;

    const { prev, next } = siblingsOf(current);
    const links = [];

    // 标签直接用目标页面的名字，不再手抄一遍
    if (prev) {
      links.push(
        el('a', {
          className: 'doc-pager-prev',
          href: hashOf(prev.to),
          textContent: `← ${prev.label}`,
        }),
      );
    }
    if (next) {
      links.push(
        el('a', {
          className: 'doc-pager-next',
          href: hashOf(next.to),
          textContent: `${next.label} →`,
        }),
      );
    }

    if (links.length) this.replaceChildren(...links);
  }
}

/** 注册两个元素。重复注册会抛，所以先查一遍 */
export function defineDocTrail() {
  for (const [tag, cls] of [
    [DOC_CRUMB_TAG, DocCrumb],
    [DOC_PAGER_TAG, DocPager],
  ]) {
    if (!customElements.get(tag)) customElements.define(tag, cls);
  }
}
