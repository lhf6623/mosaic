#!/usr/bin/env node
/**
 * Mosaic 端到端冒烟测试入口（playwright-core + 系统 Chrome）。
 *
 * 用法：node tests/smoke.mjs [slug] [--site]（先起 `pnpm dev`）；
 * 环境变量 BASE_URL / CHANNEL。
 */

import { existsSync } from 'node:fs';
import { createHarness, BASE, CHANNEL } from './lib/harness.mjs';
import { READY, slugOf } from '../docs/site-map.js';

/* 站点套件：顺序就是执行顺序 —— 有些断言看的是"主 page 现在停在哪一页" */
const SITE_SUITES = [
  ['./site/01-load-shell.mjs', '站点 · 加载与外壳'],
  ['./site/02-routing.mjs', '站点 · 客户端路由与导航'],
  ['./site/03-home-poster.mjs', '站点 · 首页海报与外壳滚动'],
  ['./site/04-nav-stability.mjs', '站点 · 导航稳定性'],
  ['./site/05-doc-pages.mjs', '站点 · 组件文档页与「查看代码」'],
  ['./site/06-boot-palette.mjs', '站点 · 启动与色板'],
  ['./site/07-inject-server.mjs', '站点 · HTML 注入免疫'],
  ['./site/08-subpath.mjs', '站点 · 子路径部署（Pages 项目页）'],
  ['./site/09-doc-toc.mjs', '站点 · 右栏本页目录'],
  ['./site/10-nav-data.mjs', '站点 · 导航数据对账'],
];

const args = process.argv.slice(2);
const wanted = args.filter((a) => !a.startsWith('-'));
// --site 只跑站点；同时给了 slug 就两边都跑
const onlySite = args.includes('--site') && wanted.length === 0;
const includeSite = args.includes('--site') || wanted.length === 0;
const includeComponents = !onlySite;

const suites = includeSite ? [...SITE_SUITES] : [];
if (includeComponents) {
  for (const c of READY) {
    const slug = slugOf(c);
    if (wanted.length && !wanted.includes(slug)) continue;
    suites.push([`../packages/${slug}/test/${slug}.test.mjs`, `${c.label} · 组件套件`]);
  }
}

if (!suites.length) {
  console.error(
    `\n没有匹配的套件：${args.join(' ') || '(空)'}\n` +
      `  可用：${READY.map((c) => c.slug).join(' / ')} · 或者 --site\n`,
  );
  process.exit(1);
}

const harness = await createHarness();
const { check, results, problems } = harness;

console.log(`\n\x1b[1mMosaic 冒烟测试\x1b[0m  ${BASE}  (${CHANNEL})`);
console.log(`\x1b[2m${suites.length} 个套件${onlySite || !includeSite ? '' : ''}${includeSite && includeComponents ? '（站点 + 组件）' : includeSite ? '（只站点）' : '（只组件）'}\x1b[0m`);

for (const [path, label] of suites) {
  const file = new URL(path, import.meta.url);
  if (!existsSync(file)) {
    check(`${label}：套件文件存在`, false, `${path} 不存在 —— 组件登记成 ready 就该有自己的测试套件`);
    continue;
  }

  console.log(`\n\x1b[1m▌${label}\x1b[0m`);
  const mod = await import(file.href);
  await mod.default(harness);
}

await harness.close();

if (problems.length) {
  console.log(
    `\n\x1b[2m（主 page 上累积了 ${problems.length} 条 console/HTTP 问题；首页那几条由第 1 个套件断言，其余仅供参考）\x1b[0m`,
  );
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length ? '\x1b[31m✗' : '\x1b[32m✓'} ${results.length - failed.length}/${results.length} 通过\x1b[0m\n`,
);

process.exit(failed.length ? 1 : 0);
