/* `<doc-nav>` —— 文档站左栏二级菜单，站点级自定义元素。
 *
 * 菜单内容不再自己拼：当前路由命中 docs/nav.js 的哪一支，就渲染那一支的 menu
 * （组件页进来就是「总览 + 分组标题 + 组件」，换个分区自然换成那一支）。
 *
 * 为什么是普通自定义元素、不是 ofa 组件（import 不是理由：静态相对 import 能用的）：
 *   · 它要把内容**渲染进页面自己的 shadow root**：站点 CSS（content.css）与几条站点断言
 *     都按 light DOM 查它（`doc-nav a`），套一层 shadow root 只会让这些钩子失效；
 *   · 它本来就是站点外壳的一部分（知道导航数据、知道分栏），不进 packages/，也就用不上
 *     ofa 组件那套 attrs / watch / part。
 *
 * 菜单的「长相」交给 mc-menu，本文件只管两件事：渲染哪一支、谁是当前页。
 * 滚轮不用手工接力 —— 整页只有外壳的 .doc-main 一个滚动容器，侧栏滚到底由浏览器接力过去。 */

import { locate, isGroup } from './nav.js';
import { route, hashOf, toRepoPath } from './routes.js';
import { el, attr, setCurrent } from './dom.js';

export const DOC_NAV_TAG = 'doc-nav';

const toOf = (a) => toRepoPath(a.getAttribute('href'));

class DocNav extends HTMLElement {
  /** 箭头函数字段：add 和 remove 必须是**同一个引用**，普通方法每次取到的是新函数对象，摘不掉监听 */
  _onRouteChange = () => {
    this.syncSection();
    this.syncActive();
  };

  connectedCallback() {
    this.render();

    /* hashchange 管页内跳转；router-change 管 o-app 导航 —— 顶栏链接走 pushState 时不触发
       hashchange，只听前者会漏掉「从顶栏点进来」（实测高亮空着）。 */
    window.addEventListener('hashchange', this._onRouteChange);
    document.addEventListener('router-change', this._onRouteChange);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this._onRouteChange);
    document.removeEventListener('router-change', this._onRouteChange);
  }

  /**
   * 菜单内容 = 当前路由命中那一支的 menu。**只有分区变了才重建**：
   * 重建会让真人点击的 mousedown / click 落在两个节点上（实测「菜单要点好几次才跳转」），
   * 同分区内切页只切高亮。
   */
  syncSection() {
    const entry = locate(route())?.entry ?? null;
    if (entry === this._entry) return;
    this.render();
  }

  render() {
    // 页面自己声明的项优先：原节点直接搬进 <mc-menu-item>，不重建（保住 <a> 上的属性）
    const declared = [...this.children].filter((node) => node.matches('a, li'));
    const menu = el('mc-menu');
    this._entry = locate(route())?.entry ?? null;

    if (declared.length) {
      for (const node of declared) {
        const inner = node.matches('a') ? [node] : [...node.childNodes];
        menu.append(el('mc-menu-item', {}, inner));
      }
    } else {
      for (const node of this._entry?.menu ?? []) {
        menu.append(isGroup(node) ? this._group(node.group) : this._link(node));
      }
    }

    this.replaceChildren(menu);
    this.syncActive();
  }

  /** 分组标题行。⚠️ 自定义属性走 attr()：el() 只赋 property，`node.group = ''` 写不成属性 */
  _group(text) {
    return attr(el('mc-menu-item', { textContent: text }), { group: '' });
  }

  _link(item) {
    const a = el('a', {});
    a.textContent = item.label;
    a.dataset.to = item.to;
    if (item.title) a.title = item.title;
    if (item.status) {
      a.className = 'doc-nav-comp';
      a.dataset.status = item.status;
    }
    if (item.external) {
      a.href = item.external;
      a.target = '_blank';
      a.rel = 'noreferrer';
    } else {
      a.href = hashOf(item.to);
    }
    return el('mc-menu-item', {}, [a]);
  }

  /** 只切 aria-current，不重建 DOM —— 重建会让真实点击的 mousedown/click 落在两个节点上。
      当前项的高亮由 mc-menu 负责：它把 <a> 上的 aria-current 镜像成宿主的 data-current */
  syncActive() {
    const path = route();
    for (const a of this.querySelectorAll('a')) {
      setCurrent(a, a.dataset.to === path || toOf(a) === path);
    }
  }
}

/** 注册元素。重复注册会抛，所以先查一遍 */
export function defineDocNav() {
  if (!customElements.get(DOC_NAV_TAG)) customElements.define(DOC_NAV_TAG, DocNav);
}
