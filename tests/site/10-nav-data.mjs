/**
 * 站点 · 导航数据对账（docs/site-map.js ↔ 实际页面文件）
 *
 * 静态站没有路由注册表，所以这份数据必须同时和磁盘、和它自己的结构规矩对得上：
 *   ① 每页挂在正确的布局页上（parent 写错 / 漏写 → 那一页掉出外壳，没顶栏没正文带）；
 *   ② 每个 page.html 都在数据里（忘了登记 → 顶栏 / 左栏 / 面包屑 / 翻页里都没有它）；
 *   ③ 数据里写了 path 的都有文件 —— path 是「已实现」的唯一凭据，写了就不能是死链；
 *   ④ 结构自身的账：order 是数字且同层唯一、数组顺序就是 order 顺序、hidden 必须真有页面、
 *      组件节点的 tagName 与目录名一致；hidden 不进左栏（menuOf 沿树剔除），但仍在工具面（READY）。
 *
 * 不需要浏览器：直接读文件对账，跑得飞快。site 套件里唯一一个 node-only 的。
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV, READY, SITE, hasPage, menuOf, slugOf } from '../../docs/site-map.js';

/** 仓库根（本文件在 tests/site/ 下） */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** 外壳页（顶栏 + 正文带）与分区布局页（三栏 + 左栏菜单 + 右栏目录） */
const SHELL = 'docs/layout.html';
const SECTION_LAYOUT = 'docs/doc-layout.html';

/** 站点里所有「页面」文件：docs/pages/*.html + packages/<slug>/page.html */
function pageFiles() {
  const site = readdirSync(`${ROOT}docs/pages`)
    .filter((name) => name.endsWith('.html'))
    .map((name) => `docs/pages/${name}`);

  const packages = readdirSync(`${ROOT}packages`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/page.html`)
    .filter((path) => existsSync(`${ROOT}${path}`));

  return [...site, ...packages].sort();
}

/** 按树序遍历，回调拿得到祖先链（报错时能写出「组件 / 基础 / Button」这种位置） */
function walk(nodes, visit, ancestors = []) {
  for (const node of nodes) {
    visit(node, ancestors);
    if (node.children) walk(node.children, visit, [...ancestors, node]);
  }
}

/** 数组顺序是不是严格按 order 递增（递归） */
const inOrder = (nodes) =>
  nodes.every(
    (node, i) =>
      (i === 0 || nodes[i - 1].order < node.order) && (!node.children || inOrder(node.children)),
  );

export default async function run({ check }) {
  const pages = pageFiles().map((path) => ({ path, text: readFileSync(`${ROOT}${path}`, 'utf8') }));

  const nodes = [];
  walk(NAV, (node, ancestors) => nodes.push({ node, ancestors }));
  const pageNodes = nodes
    .filter(({ node }) => hasPage(node))
    .map(({ node, ancestors }) => ({
      node,
      at: [...ancestors.map((a) => a.label), node.label].join(' / '),
    }));

  /** 组件里还没有页面的（待建）—— 只用于报数 */
  const plannedCount = nodes.filter(({ node }) => node.tagName && !hasPage(node)).length;

  /* ① 每页都挂在正确的层上：分区里的页面挂分区布局页（doc-layout.html），其余挂总外壳（layout.html）。
        页面写的是相对路径（'../doc-layout.html' 等），所以必须**相对本文件解析**后再比 */
  const sectionPaths = new Set();
  for (const entry of NAV) {
    if (!entry.children) continue;
    walk([entry], (node) => {
      if (hasPage(node)) sectionPaths.add(node.path);
    });
  }

  const detached = pages
    .map((page) => {
      const parent = /export const parent\s*=\s*'([^']+)'/.exec(page.text)?.[1];
      const resolved = parent ? posix.normalize(posix.join(posix.dirname(page.path), parent)) : null;
      const want = sectionPaths.has(page.path) ? SECTION_LAYOUT : SHELL;
      return { path: page.path, parent, resolved, want, ok: resolved === want };
    })
    .filter((page) => !page.ok);

  check(
    `每个页面都挂在正确的布局页上（${pages.length} 个页面）`,
    detached.length === 0,
    detached
      .map((p) => `${p.path} → ${p.parent ?? '(没写)'}（解析成 ${p.resolved ?? '—'}，应为 ${p.want}）`)
      .join('\n        ') || `分区页 → ${SECTION_LAYOUT} · 其余 → ${SHELL}`,
  );

  /* ② 每个页面都在数据里 */
  const registered = new Set(pageNodes.map(({ node }) => node.path));
  const orphans = pages.map((page) => page.path).filter((path) => !registered.has(path));

  check(
    '没有游离页面：每个 page.html 都在 docs/site-map.js 的 NAV 里',
    orphans.length === 0,
    orphans.join('\n        ') || `NAV 覆盖了全部 ${pages.length} 个页面`,
  );

  /* ③ 数据里写了 path 的都有文件（没有 path 就是待建，不进这条） */
  const missing = pageNodes
    .filter(({ node }) => !existsSync(`${ROOT}${node.path}`))
    .map(({ node, at }) => `${at} → ${node.path}`);

  check(
    `NAV 里带 path 的条目都有对应文件（共 ${pageNodes.length} 页，另有待建 ${plannedCount} 项）`,
    missing.length === 0,
    missing.join('\n        ') || `无死链`,
  );

  /* ④ 路由不重复。分区入口不再复用子节点的 path（落到子树第一页，见 site-map 的 firstPageOf），所以没有例外 */
  const routes = pageNodes.map(({ node }) => node.path);
  const counts = new Map();
  for (const path of routes) counts.set(path, (counts.get(path) ?? 0) + 1);

  const dupes = [...counts].filter(([, n]) => n > 1).map(([path, n]) => `${path}（${n} 次）`);

  check('NAV 里没有重复路由', dupes.length === 0, dupes.join(' / ') || '无重复');

  /* ⑤ 结构自身的规矩：order / 空分组 / hidden / 组件字段 */
  const structural = [];
  const seenTags = new Map();

  const audit = (siblings, where) => {
    const orders = new Map();

    for (const node of siblings) {
      const at = `${where} / ${node.label}`;

      if (typeof node.order !== 'number' || Number.isNaN(node.order)) {
        structural.push(`${at} 没写 order`);
      } else if (orders.has(node.order)) {
        structural.push(`${at} 的 order ${node.order} 与「${orders.get(node.order)}」重复`);
      } else {
        orders.set(node.order, node.label);
      }

      if (!node.path && !node.children && !node.tagName) {
        structural.push(`${at} 既没有 path / children，也不是组件`);
      }
      if (node.children && node.children.length === 0) structural.push(`${at} 是空分组`);
      if (node.hidden === true && !hasPage(node)) {
        structural.push(`${at} 标了 hidden 却没有 path（没页面的条目直接删掉就行）`);
      }

      if (node.tagName) {
        if (seenTags.has(node.tagName)) {
          structural.push(`${at} 的 tagName ${node.tagName} 与「${seenTags.get(node.tagName)}」重复`);
        } else {
          seenTags.set(node.tagName, node.label);
        }
        /* 命令式组件（入口是函数，如 message()）：tagName 不是 mc-<目录名>，
           标签由模块自己在运行时创建 —— 这条命名规矩对它不适用。
           判定用 `mc-` 前缀的形状，不写死名字：以后再加命令式组件自动走这条。 */
        const imperative = !node.tagName.startsWith('mc-');
        if (hasPage(node)) {
          if (!/^packages\/[^/]+\/page\.html$/.test(node.path)) {
            structural.push(`${at} 的 path 不在 packages/<目录>/page.html：${node.path}`);
          } else if (!imperative && node.tagName !== `mc-${slugOf(node)}`) {
            structural.push(
              `${at} 的标签名与目录名对不上：${node.tagName} vs ${slugOf(node)}/`,
            );
          }
        }
      }

      if (node.children) audit(node.children, at);
    }
  };
  audit(NAV, '顶层');

  check(
    `结构规矩都对得上（${nodes.length} 个节点：order 唯一 / 组件字段齐全 / hidden 有页面）`,
    structural.length === 0,
    structural.join('\n        ') || `order 无重复 · tagName 无重复 · ${seenTags.size} 个组件`,
  );

  /* ⑥ 文件里看到的顺序就是页面上的顺序：数组按 order 写（order 才是权威） */
  check(
    '数据数组的顺序与 order 一致（打开文件看到的就是菜单）',
    inOrder(SITE) && inOrder(NAV),
    inOrder(SITE)
      ? '数组顺序 == order 顺序'
      : '有节点的数组位置与 order 不符 —— 把那条挪到 order 对应的位置',
  );

  /* ⑦ hidden 只影响展示：沿树继承、隐藏后空掉的分组整条不出现 */
  const fake = {
    label: '假分区',
    children: [
      { order: 10, label: '可见页', path: 'packages/a/page.html' },
      { order: 20, label: '隐藏页', path: 'packages/b/page.html', hidden: true },
      {
        order: 30,
        label: '整组隐藏',
        children: [{ order: 10, label: '组内页', path: 'packages/c/page.html', hidden: true }],
      },
    ],
  };
  const fakeMenu = menuOf(fake).map((node) => node.label);

  check(
    'hidden 沿树继承：隐藏的页面不出现，隐藏后空掉的分组整条不出现',
    fakeMenu.join(' / ') === '可见页',
    `menuOf(假分区) → ${fakeMenu.join(' / ') || '(空)'}`,
  );

  /* ⑧ 工具面（READY）只收「有 tagName + 有页面」的组件 —— 冒烟套件与文档页检查都开在它上面 */
  check(
    `工具面 READY 只收有 tagName、有页面的组件（${READY.length} 个）`,
    READY.every((component) => component.tagName && hasPage(component)),
    `READY ${READY.length} 条`,
  );
}
