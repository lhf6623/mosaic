/* `<doc-nav>` —— 文档站二级菜单，站点级自定义元素。
 * 用普通自定义元素而非 ofa 组件：要直接 import 登记表（ofa 页面/组件经 eval，相对 import 解析不了），
 * 且它渲染在页面自己的 shadow root 里，正文样式已在，不需要 shadow DOM。 */

import { GROUPS, pageOf, OVERVIEW } from './components.js';
import { route, hashOf, toRepoPath } from './routes.js';

export const DOC_NAV_TAG = 'doc-nav';

/** 未实现的组件不给死链，指到规范里的接口定义（外链，不走 hash 路由） */
const SPEC_URL = 'https://github.com/lhf6623/mosaic/blob/main/agent/component-spec.md';

const setCurrent = (a, on) => {
  if (on && !a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  else if (!on && a.hasAttribute('aria-current')) a.removeAttribute('aria-current');
};

const toOf = (a) => toRepoPath(a.getAttribute('href'));

/** 登记表 → 纯数据项（总览 + 分组标题 + 每个组件），渲染时才变成 DOM */
function componentItems() {
  const items = [{ to: OVERVIEW, label: '总览' }];

  for (const group of GROUPS) {
    items.push({ group: group.title });

    for (const item of group.items) {
      const ready = item.status === 'ready';
      items.push({
        to: pageOf(item.slug),
        label: item.name,
        title: ready ? item.desc : `${item.milestone} · 待建 —— ${item.desc}`,
        status: item.status,
        external: ready ? null : SPEC_URL,
      });
    }
  }

  return items;
}

class DocNav extends HTMLElement {
  /** 箭头函数字段：add 和 remove 必须是**同一个引用**，普通方法每次取到的是新函数对象，摘不掉监听 */
  _onRouteChange = () => this.syncActive();

  connectedCallback() {
    this.render();

    /* hashchange 管页内跳转；router-change 管 o-app 导航 —— 顶栏 <a olink> 走 pushState，
       不触发 hashchange，只听前者会漏掉「从顶栏点进来」（实测高亮空着）。 */
    window.addEventListener('hashchange', this._onRouteChange);
    document.addEventListener('router-change', this._onRouteChange);
    bridgeWheel(this);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this._onRouteChange);
    document.removeEventListener('router-change', this._onRouteChange);
  }

  render() {
    // 页面自己声明的项优先：原节点直接搬进 <li>，不重建（保住 <a> 上的属性）
    const declared = [...this.children].filter((node) => node.matches('a, li'));

    const ul = document.createElement('ul');
    ul.className = 'doc-nav-list';

    if (declared.length) {
      for (const node of declared) {
        const inner = node.matches('a') ? [node] : [...node.childNodes];
        ul.append(el('li', {}, inner));
      }
    } else if (this.dataset.source === 'components') {
      for (const item of componentItems()) {
        ul.append(
          item.group
            ? el('li', { className: 'doc-nav-group', textContent: item.group })
            : this._link(item),
        );
      }
    }

    this.replaceChildren(ul);
    this.syncActive();
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
    return el('li', {}, [a]);
  }

  /** 只切 aria-current，不重建 DOM —— 重建会让真实点击的 mousedown/click 落在两个节点上 */
  syncActive() {
    const path = route();
    for (const a of this.querySelectorAll('a')) {
      setCurrent(a, a.dataset.to === path || toOf(a) === path);
    }
  }
}

/** 建 DOM 小工具。⚠️ 不能 Object.assign(node, props)：dataset/style 是只读 getter，赋值抛错且整块渲染空白 */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset' || key === 'style') Object.assign(node[key], value);
    else node[key] = value;
  }
  node.append(...children);
  return node;
}

/* 侧栏吃不下的滚轮转交给同栏正文：两栏各自滚时，指针停在侧栏上就只滚侧栏，内容少时滚轮
 * 彻底没反应（像卡住）。纯 CSS 做不到 —— 外壳固定一屏、不可滚，链上去也是死路。 */
function bridgeWheel(nav) {
  nav.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // 横向留给代码块

      const max = nav.scrollHeight - nav.clientHeight;
      const canScroll = e.deltaY > 0 ? nav.scrollTop < max - 1 : nav.scrollTop > 1;
      if (canScroll) return;

      const content = nav.parentElement?.querySelector(':scope > .doc-body');
      if (!content) return;

      content.scrollTop += e.deltaY;
      e.preventDefault();
    },
    { passive: false }, // 要能 preventDefault，不能是 passive
  );
}

/** 注册元素。重复注册会抛，所以先查一遍 */
export function defineDocNav() {
  if (!customElements.get(DOC_NAV_TAG)) customElements.define(DOC_NAV_TAG, DocNav);
}
