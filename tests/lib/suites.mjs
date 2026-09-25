/**
 * 套件清单的唯一真相源：站点套件（定序）+ 每个 READY 组件自己的套件。
 * 三个消费方都从这里取，免得加组件时漏改一处：
 *   · tests/smoke.mjs        —— 跑（--site / slug 过滤、并行、录制）
 *   · tests/select.mjs       —— 选（改动 → 该跑哪些）
 *   · tests/site/12-affected.mjs —— 守（地图覆盖 + 兜底策略）
 *
 * path 是**仓库相对路径**（依赖地图的键、选择结果的标识）；file 是可直接 import / existsSync 的 URL。
 */

import { READY, slugOf } from '../../docs/site-map.js';

/** 站点套件：顺序就是开工顺序（并行后各套件各一页，这个顺序只影响谁先起跑） */
const SITE = [
  ['site/01-load-shell.mjs', '站点 · 加载与外壳'],
  ['site/02-routing.mjs', '站点 · 客户端路由与导航'],
  ['site/03-home-poster.mjs', '站点 · 首页海报与外壳滚动'],
  ['site/04-nav-stability.mjs', '站点 · 导航稳定性'],
  ['site/05-doc-pages.mjs', '站点 · 组件文档页与「查看代码」'],
  ['site/06-boot-palette.mjs', '站点 · 启动与色板'],
  ['site/07-inject-server.mjs', '站点 · HTML 注入免疫'],
  ['site/08-subpath.mjs', '站点 · 子路径部署（Pages 项目页）'],
  ['site/09-doc-toc.mjs', '站点 · 右栏本页目录'],
  ['site/10-nav-data.mjs', '站点 · 导航数据对账'],
  ['site/11-no-class-components.mjs', '站点 · 组件写法守卫（node-only）'],
  ['site/12-affected.mjs', '站点 · 选测中间层（node-only）'],
];

export const siteSuites = () =>
  SITE.map(([rel, label]) => ({
    kind: 'site',
    label,
    path: `tests/${rel}`,
    file: new URL(`../${rel}`, import.meta.url),
  }));

export const componentSuites = () =>
  READY.map((component) => {
    const slug = slugOf(component);
    return {
      kind: 'component',
      slug,
      label: `${component.label} · 组件套件`,
      path: `packages/${slug}/test/${slug}.test.mjs`,
      file: new URL(`../../packages/${slug}/test/${slug}.test.mjs`, import.meta.url),
    };
  });

/** 全部套件（站点在前、组件在后，与 --list 的输出一致） */
export const allSuites = () => [...siteSuites(), ...componentSuites()];
