#!/usr/bin/env node
/**
 * Mosaic — 端到端冒烟测试入口（真浏览器）
 *
 * 它同时是 **M0 的验收测试**。M0 的核心问题是：
 *
 *   D3 那个 attachShadow 补丁，到底能不能让工具类进到 shadow root 里？
 *   主题切换（令牌）能不能穿过 shadow 边界？
 *
 * 这些问题只有真浏览器能回答，所以这里用 playwright-core 驱动系统 Chrome
 * （不下载浏览器，走 channel: 'chrome'）。
 *
 * 用法：
 *   node tools/serve.mjs &                 # 或另开一个终端 pnpm dev
 *   node tests/smoke.mjs                   # 全量：站点套件 + 所有已实现组件
 *   node tests/smoke.mjs collapse          # 只跑某个组件的套件（内环快速反馈）
 *   node tests/smoke.mjs --site            # 只跑站点套件
 *
 * 套件住在哪：
 *   tests/site/*.mjs                        跨组件的站点不变量（外壳、路由、D3、色板、注入……）
 *   packages/<slug>/test/<slug>.test.mjs    组件自己的断言 —— 登记表里 READY 的都该有一个
 *
 * 公共基座（浏览器、断言、穿透查询注入、导航工具）在 tests/lib/harness.mjs，
 * 每个套件就是 `export default async (ctx) => {…}`。
 *
 * 环境变量：
 *   BASE_URL   默认 http://127.0.0.1:8642
 *   CHANNEL    默认 chrome；CI 上可设 chromium
 *
 * ⚠️ 写套件时踩到的坑，值得记一笔：
 *   getComputedStyle() 返回的是**活对象**，元素一旦从 DOM 移除，
 *   所有属性读出来都是空字符串。所以必须先取值、后 remove。
 *   第一版没注意，导致 3 个断言假失败。
 */

import { existsSync } from 'node:fs';
import { createHarness, BASE, CHANNEL } from './lib/harness.mjs';
import { READY } from '../docs/components.js';

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
];

const args = process.argv.slice(2);
const wanted = args.filter((a) => !a.startsWith('-'));
// 不带参数 = 全量；带 slug = 只跑那个组件；--site = 只跑站点；--site + slug = 两边都跑
const onlySite = args.includes('--site') && wanted.length === 0;
const includeSite = args.includes('--site') || wanted.length === 0;
const includeComponents = !onlySite;

const suites = includeSite ? [...SITE_SUITES] : [];
if (includeComponents) {
  for (const c of READY) {
    if (wanted.length && !wanted.includes(c.slug)) continue;
    suites.push([`../packages/${c.slug}/test/${c.slug}.test.mjs`, `${c.name} · 组件套件`]);
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
