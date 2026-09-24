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
import { ALL, GROUPS, NAV, isGroup, pagesOf } from '../../docs/site-map.js';

/** 仓库根（本文件在 tests/site/ 下） */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** 外壳页（顶栏 + 正文带）与组件分区的布局页（三栏 + 左栏菜单 + 右栏目录） */
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

export default async function run({ check }) {
  const pages = pageFiles().map((path) => ({ path, text: readFileSync(`${ROOT}${path}`, 'utf8') }));

  /* ① 每页都挂在正确的层上：组件分区里的页面挂分区布局页（doc-layout.html），
        其余挂在总外壳（layout.html）。页面写的是相对路径（'../doc-layout.html' 等），
        所以必须**相对本文件解析**后再比 —— 写错或漏写，那一页就掉出外壳（没顶栏、没正文带） */
  const sectionRoutes = new Set([
    ...NAV.filter((entry) => entry.menu).map((entry) => entry.to),
    ...NAV.flatMap((entry) => (entry.menu ? pagesOf(entry) : []).map((page) => page.to)),
  ]);
  const detached = pages
    .map((page) => {
      const parent = /export const parent\s*=\s*'([^']+)'/.exec(page.text)?.[1];
      const resolved = parent ? posix.normalize(posix.join(posix.dirname(page.path), parent)) : null;
      const want = sectionRoutes.has(page.path) ? SECTION_LAYOUT : SHELL;
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

  /* ② 每个页面都在 NAV 里（NAV 的入口 to + 各分区叶子 to） */
  const registered = new Set([
    ...NAV.map((entry) => entry.to),
    ...NAV.flatMap((entry) => (entry.menu ?? []).filter((node) => !isGroup(node)).map((node) => node.to)),
  ]);
  const orphans = pages.map((page) => page.path).filter((path) => !registered.has(path));

  check(
    '没有游离页面：每个 page.html 都在 docs/site-map.js 的 NAV 里',
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

  /* ⑤ 组件条目自身的账（数据源：docs/site-map.js 的 ALL / GROUPS）：分组必须存在、同组 order 不重复、没有游离条目
        （分组写错时排序会把它们沉到最底，肉眼不一定看得出，所以这里显式对账） */
  const groupTitles = new Set(GROUPS.map((group) => group.title));
  const badGroup = ALL.filter((item) => !groupTitles.has(item.group)).map(
    (item) => `${item.name} → group「${item.group}」不在分组表里`,
  );

  const orderSeen = new Map();
  const dupOrder = [];
  for (const item of ALL) {
    const key = `${item.group}#${item.order}`;
    if (orderSeen.has(key)) dupOrder.push(`${key}（${orderSeen.get(key)} 与 ${item.name}）`);
    orderSeen.set(key, item.name);
  }

  const grouped = GROUPS.reduce((n, group) => n + group.items.length, 0);

  check(
    `组件条目的分组 / 顺序 / 归属都对得上（${ALL.length} 条）`,
    badGroup.length === 0 && dupOrder.length === 0 && grouped === ALL.length,
    [
      ...badGroup,
      ...dupOrder.map((d) => `同组 order 重复：${d}`),
      grouped !== ALL.length ? `分组展开后 ${grouped} 条 ≠ ALL ${ALL.length} 条` : '',
    ]
      .filter(Boolean)
      .join('\n        ') || `分组 ${GROUPS.length} 个 · 条目 ${ALL.length} 条 · order 无重复`,
  );

  /* ⑥ 菜单叶子必须显式带 status：hasPage() 是严格判断（status === 'ready'），
        漏写会被当成"没有页面"—— 上一页 / 下一页就静默少一条（实测踩过） */
  const leavesWithoutStatus = NAV.flatMap((entry) => entry.menu ?? [])
    .filter((node) => !isGroup(node) && node.status !== 'ready' && node.status !== 'planned')
    .map((node) => `${node.label} → status=${String(node.status)}`);

  check(
    '菜单叶子都显式写了 status（ready / planned）',
    leavesWithoutStatus.length === 0,
    leavesWithoutStatus.join('\n        ') || '全部齐全',
  );
}
