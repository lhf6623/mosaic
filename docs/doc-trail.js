/* `<doc-crumb>` / `<doc-pager>` —— 从当前路由在 docs/site-map.js 那棵树里的位置派生的两小块：
 * 面包屑（组件 / Button）与上一页 / 下一页。
 *
 * 以前这两块是每个组件页手写的：4 份面包屑 + 5 条翻页链接，加一个组件、调一次顺序都要
 * 手工跟着改（而且当时已经不一致：Button 与 Collapse 只有 prev、没有 next）。现在一处都不用手写。
 *
 * 面包屑本身是项目自己的 <mc-breadcrumb>（packages/breadcrumb/）：这里只负责「派生哪几级 +
 * 生成带部署前缀的链接」（hashOf()，不用 olink —— 那是编译期指令，运行时造的 <a olink>
 * 不会被处理，见 docs/routes.js），外观、分隔符、当前项都在组件里。
 * 所以 content.css 只剩一条间距规则。
 *
 * 隐藏页（hidden）直链打开时：顶栏仍点亮所属分区，但面包屑与翻页都不渲染 —— 它不在导航里。
 *
 * 与 <doc-nav> 同一个套路：站点级普通自定义元素，渲染进**页面自己的** shadow root。
 *
 * ⚠️ 挂载那一刻 `location.hash` 未必已经落到新路由（SPA 内跳转时页面先挂上、hash 后落），
 * 所以**必须跟着路由重渲染** —— 只按 connectedCallback 渲染一次会出现「点进组件页却没有面包屑」
 * （子路径套件实测抓到）。签名没变就不动 DOM。
 */

import { locate, siblingsOf } from './site-map.js';
import { route, hashOf } from './routes.js';
import { el, attr } from './dom.js';

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
    // 顶层入口自己那一页没有「在哪里面」这回事；隐藏页不在导航里，也不渲染
    if (!hit?.node || hit.node === hit.entry || hit.hidden) return;

    // 每一级都是 <mc-breadcrumb-item>：可点的那级放原生 <a>（href 走 hashOf()），
    // 当前页是纯文本 + current（组件据此补 aria-current="page"）
    const crumb = el('mc-breadcrumb');
    const last = attr(el('mc-breadcrumb-item'), { current: '' });
    crumb.append(
      el('mc-breadcrumb-item', {}, [
        el('a', { href: hashOf(hit.entry.path), textContent: hit.entry.label }),
      ]),
      last,
    );
    last.append(hit.node.label);

    this.replaceChildren(crumb);
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
          href: hashOf(prev.path),
          textContent: `← ${prev.label}`,
        }),
      );
    }
    if (next) {
      links.push(
        el('a', {
          className: 'doc-pager-next',
          href: hashOf(next.path),
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
