/**
 * `<doc-nav>` —— 文档站的二级菜单（左栏），站点级自定义元素。
 *
 * 为什么是普通自定义元素，而不是 ofa.js 组件：
 *   · 它要直接 `import` 组件登记表（docs/components.js）。ofa.js 的页面/组件代码
 *     是经 eval 执行的，相对 import 解析不了（页面模块那侧已知的坑，见
 *     docs/site.js 顶部注释），拿不到登记表就只能把 20 个组件的清单抄一遍。
 *   · 它渲染在**页面自己的 shadow root** 里，正文样式 content.css 已经在那儿了，
 *     不需要 shadow DOM，也就用不着 mosaic.js 再给它 adopt 一份样式。
 *
 * 两种用法：
 *   1. 菜单来自登记表（组件总览页 + 每个组件文档页）：
 *        <doc-nav data-source="components"></doc-nav>
 *   2. 页面自己声明菜单项（谁需要谁写，外壳不再集中维护）：
 *        <doc-nav>
 *          <a href="#/docs/pages/guide.html">快速开始</a>
 *        </doc-nav>
 *
 * 高亮由它自己盯 `hashchange` + `router-change` —— 二级菜单是页面自己的东西，
 * 不靠外壳脚本同步（顶栏的 olink 不触发 hashchange，见 connectedCallback 里的说明）。
 */

import { GROUPS, pageOf, OVERVIEW } from './components.js';
import { route } from './routes.js';

export const DOC_NAV_TAG = 'doc-nav';

/** 未实现的组件不给死链，指到规范里的接口定义（外链，不走 hash 路由） */
const SPEC_URL = 'https://github.com/lhf6623/mosaic/blob/main/agent/component-spec.md';

const setCurrent = (a, on) => {
  if (on && !a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  else if (!on && a.hasAttribute('aria-current')) a.removeAttribute('aria-current');
};

/** 从一个 <a> 反推它指向的路由（`#/xxx` → `xxx`） */
const toOf = (a) => (a.getAttribute('href') ?? '').replace(/^#\/?/, '');

/**
 * 登记表驱动的菜单：总览 + 分组标题 + 每个组件（带实现状态）。
 *
 * 每一项都是个纯数据描述，渲染时再变成 DOM —— 数据和结构分开，
 * 以后要换渲染方式（比如折叠分组）不用动这一层。
 */
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
  /**
   * 箭头函数字段：add 和 remove 必须是**同一个引用**，
   * 普通方法每次取到的都是新的函数对象，摘不掉监听。
   */
  _onRouteChange = () => this.syncActive();

  connectedCallback() {
    this.render();

    /*
     * 两个信号都要听：
     *   hashchange      页面内的普通 `<a href="#/…">`（比如面包屑）
     *   router-change   o-app 每次导航都会冒泡它 —— 顶栏的 `<a olink>` 走
     *                   history.pushState，**不触发 hashchange**，只听前一个
     *                   会漏掉「从顶栏点进来」这条路（实测高亮会空着）。
     */
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
        ul.append(item.group ? el('li', { className: 'doc-nav-group', textContent: item.group }) : this._link(item));
      }
    }

    this.replaceChildren(ul);
    this.syncActive();
  }

  /** 登记表里的一条 → <li><a> */
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
      a.href = `#/${item.to}`;
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

/**
 * 建 DOM 的小工具。
 *
 * ⚠️ 不能直接 `Object.assign(node, props)`：`dataset` / `style` 这类是**只读 getter**，
 * 赋值会抛 TypeError，而且是在渲染途中抛出，表现为「整块内容空白」。
 */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'dataset' || key === 'style') Object.assign(node[key], value);
    else node[key] = value;
  }
  node.append(...children);
  return node;
}

/**
 * 侧栏吃不下的滚轮，转交给同一栏里的正文。
 *
 * 两栏各自滚，于是指针停在侧栏上滚动时，浏览器只滚最近的滚动容器（侧栏）。
 * 侧栏内容少的时候滚轮就彻底没反应 —— 用户以为页面卡住了。所以它到顶/到底
 * （或压根不可滚）时，把这次滚动转给兄弟节点里的内容栏。
 *
 * 纯 CSS 做不到：外壳本身固定一屏、不可滚，链上去也是死路。
 */
function bridgeWheel(nav) {
  nav.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.defaultPrevented) return; // 缩放 / 别处已处理
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // 横向留给代码块

      const max = nav.scrollHeight - nav.clientHeight;
      const canScroll = e.deltaY > 0 ? nav.scrollTop < max - 1 : nav.scrollTop > 1;
      if (canScroll) return; // 自己还滚得动，先让它滚

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
