/**
 * 站点 · 导航数据对账（docs/nav.js ↔ 实际页面文件）
 *
 * 这三条是「静态站没有路由注册表」最容易漂的地方：
 *   ① 新加了页面却忘了登记 → 顶栏/左栏/翻页里都没有它；
 *   ② nav.js 里写了页面但文件不在（或漏了 status: 'planned'）→ 死链；
 *   ③ 页面的 export const parent 写错或漏写 → 那一页「掉出外壳」（没有顶栏、没有正文带）。
 *
 * 这一套不需要浏览器：直接读文件对账，跑得飞快。site 套件里唯一一个 node-only 的。
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV, isGroup } from '../../docs/nav.js';

/** 仓库根（本文件在 tests/site/ 下） */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

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

export default async function run({ check }) {
  const pages = pageFiles().map((path) => ({ path, text: readFileSync(`${ROOT}${path}`, 'utf8') }));

  /* ① 每页都挂上了外壳：必须 export const parent，且**相对本文件解析后**落到 docs/layout.html
        （页面写的是 '../layout.html' 或 '../../docs/layout.html'，两种都对） */
  const detached = pages
    .map((page) => {
      const parent = /export const parent\s*=\s*'([^']+)'/.exec(page.text)?.[1];
      const resolved = parent ? posix.normalize(posix.join(posix.dirname(page.path), parent)) : null;
      return { path: page.path, parent, resolved };
    })
    .filter((page) => page.resolved !== 'docs/layout.html');

  check(
    `每个页面都写了 export const parent 且指向外壳（${pages.length} 个页面）`,
    detached.length === 0,
    detached.map((p) => `${p.path} → ${p.parent ?? '(没写)'}（解析成 ${p.resolved ?? '—'}）`).join('\n        ') ||
      '全部解析到 docs/layout.html',
  );

  /* ② 每个页面都在 NAV 里（NAV 的入口 to + 各分区叶子 to） */
  const registered = new Set([
    ...NAV.map((entry) => entry.to),
    ...NAV.flatMap((entry) => (entry.menu ?? []).filter((node) => !isGroup(node)).map((node) => node.to)),
  ]);
  const orphans = pages.map((page) => page.path).filter((path) => !registered.has(path));

  check(
    '没有游离页面：每个 page.html 都在 docs/nav.js 的 NAV 里',
    orphans.length === 0,
    orphans.join('\n        ') || `NAV 覆盖了全部 ${pages.length} 个页面`,
  );

  /* ③ NAV 里已实现的条目都有文件（planned 的没有页面，靠 external 指到规范文档） */
  const leaves = [
    ...NAV.map((entry) => ({ ...entry, level: '一级入口' })),
    ...NAV.flatMap((entry) =>
      (entry.menu ?? [])
        .filter((node) => !isGroup(node))
        .map((node) => ({ ...node, level: entry.label })),
    ),
  ];
  const missing = leaves
    .filter((leaf) => leaf.status !== 'planned' && !existsSync(`${ROOT}${leaf.to}`))
    .map((leaf) => `${leaf.level} · ${leaf.label} → ${leaf.to}`);

  check(
    `NAV 里已实现的条目都有对应文件（共 ${leaves.length} 项，含待建 ${leaves.filter((l) => l.status === 'planned').length} 项）`,
    missing.length === 0,
    missing.join('\n        ') || '无死链',
  );

  /* ④ 顺带：路由不重复。例外是「分区首页」——组件分区的入口 to 就是它自己的第一项（总览），
        这种重合是有意的：locate() 先命中入口，所以那一页没有面包屑/翻页 */
  const owned = new Set(NAV.map((entry) => entry.to));
  const routes = leaves.filter((leaf) => !owned.has(leaf.to)).map((leaf) => leaf.to);
  const dupes = routes.filter((route, i) => routes.indexOf(route) !== i);

  check('NAV 里没有重复路由', dupes.length === 0, [...new Set(dupes)].join(' / ') || '无重复');
}
