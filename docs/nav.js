/* 站点结构唯一真相源。
 *
 * 谁进顶栏、谁的子菜单是什么、当前路由落在哪一支，全在这里；三处导航都从它派生：
 *   · 顶栏（docs/layout.html）        —— NAV 的顶层入口，高亮 = 当前路由命中的那一支
 *   · 左栏（docs/doc-nav.js）         —— 命中分支的 menu（分组标题 + 叶子）
 *   · 面包屑 / 翻页（docs/doc-trail.js）—— 命中分支的位置与相邻页面
 *
 * 组件分区的 menu 不是手写的：从登记表 docs/components.js 派生（加一个组件仍旧只改登记表）。
 *
 * ⚠️ 页内目录（h2/h3）**不进这里**：它是内容派生的、每页都不同，由 <doc-toc> 扫标题生成。
 *    把它写进数据意味着每加一节、改个标题、挪次顺序都要两处改，而且锚点 id 是页面里生成的，
 *    手写必然对不上。
 *
 * ⚠️ 链接一律用 routes.js 的 hashOf() 生成，不能指望 olink：olink 是编译期指令，
 *    运行时造出来的 <a olink> 不会被处理，点下去是整页跳转（实测）。
 */

import { GROUPS, OVERVIEW, pageOf } from './components.js';

/** 未实现的组件不给死链，指到规范里的接口定义（外链，不走 hash 路由） */
export const SPEC_URL = 'https://github.com/lhf6623/mosaic/blob/main/agent/component-spec.md';

/** 组件分区的子菜单：总览 + 登记表里的分组与组件（这一项的顺序就是左栏的顺序） */
function componentMenu() {
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

/** 顶层入口。带 menu 的是「分区」——左栏、面包屑、翻页都围着它转 */
export const NAV = [
  { label: '首页', to: 'docs/pages/home.html' },
  { label: '快速开始', to: 'docs/pages/guide.html' },
  { label: '设计令牌', to: 'packages/color/page.html' },
  { label: '规范', to: 'docs/pages/specs.html' },
  { label: '组件', to: OVERVIEW, menu: componentMenu() },
];

/** menu 里的一项是不是分组标题（不可点，只当标题） */
export const isGroup = (node) => typeof node?.group === 'string';

/** 当前路由落在哪一支：`{ entry, leaf }`；顶层入口自己那一页只有 entry（leaf 为 null） */
export function locate(route) {
  for (const entry of NAV) {
    if (entry.to === route) return { entry, leaf: null };

    for (const node of entry.menu ?? []) {
      if (!isGroup(node) && node.to === route) return { entry, leaf: node };
    }
  }
  return null;
}

/** 分区里**真正有页面**的叶子（按左栏顺序）。未实现的跳过：翻页不能指向不存在的页 */
export const pagesOf = (entry) =>
  (entry?.menu ?? []).filter((node) => !isGroup(node) && node.status !== 'planned');

/** 同一分区里相邻的上一页 / 下一页（没有就是 null） */
export function siblingsOf(route) {
  const { entry } = locate(route) ?? {};
  const pages = pagesOf(entry);
  const index = pages.findIndex((page) => page.to === route);
  return { prev: pages[index - 1] ?? null, next: pages[index + 1] ?? null };
}
