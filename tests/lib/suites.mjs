/**
 * 套件清单的唯一真相源：每个 READY 组件自己的套件。
 * 两个消费方从这里取，免得加组件时漏改一处：
 *   · tests/smoke.mjs  —— 跑（slug 过滤、并行、录制）
 *   · tests/select.mjs —— 选（改动 → 该跑哪些）
 *
 * path 是**仓库相对路径**（依赖地图的键、选择结果的标识）；file 是可直接 import / existsSync 的 URL。
 *
 * ⚠️ 文档站（tests/site/）那批套件已按「站点定型、不再大改」的取舍整体删掉：
 *    外壳 / 搜索 / 导航 / 文档与代码对账都不再有浏览器守卫，需要时从 git 历史里取回。
 */

import { READY, slugOf } from '../../docs/site-map.js';

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

/** 全部套件（--list 的输出顺序） */
export const allSuites = () => componentSuites();
