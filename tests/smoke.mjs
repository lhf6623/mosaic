#!/usr/bin/env node
/**
 * Mosaic 端到端冒烟测试入口（playwright-core + 系统 Chrome）。
 *
 * 用法（先起 `pnpm dev`）：
 *   node tests/smoke.mjs                 全量：12 个站点套件 + 每个 READY 组件的套件（默认并行 4）
 *   node tests/smoke.mjs --changed       只跑**工作区改动**命中的套件（选测中间层，见 tests/select.mjs）
 *   node tests/smoke.mjs --changed main  只跑与 `main` 有差异的部分（含未跟踪文件）
 *   node tests/smoke.mjs --jobs 1        串行跑（排查「以为是并行引发的时序问题」时用）
 *   node tests/smoke.mjs --jobs 6        临时加大并行度（可用 JOBS=6 代替）
 *   node tests/smoke.mjs --list          只列出会跑哪些套件（可与 --changed 组合预览），不启动浏览器
 *   node tests/smoke.mjs --record        跑全量并重录依赖地图 tests/suite-map.json（选了就忽略 --changed）
 *   node tests/smoke.mjs --site          只跑站点套件
 *   node tests/smoke.mjs --site nav      只跑站点套件里匹配 "nav" 的（04 / 10）——
 *                                        位置参数同时按「套件文件 / 标签是否包含它」过滤；
 *                                        一个站点套件都没匹配上时退回「站点全部 + 该组件」，保住
 *                                        `--site button` 这种老用法
 *   node tests/smoke.mjs menu            只跑 menu 组件套件；`menu --site` 就是它还加站点套件
 *
 * 并行模型：一个套件 = 一个 page，都挂在同一个 browser context 上（CDN 缓存共享，只下一次）。
 * 套件之间没有顺序依赖，所以输出按**完成顺序**成块打印，收尾再给一张按定义顺序的用时表。
 *
 * 环境变量 BASE_URL / CHANNEL / JOBS / BROWSER_NO_PROXY=1（本机代理挂掉时直连）。
 */

import { existsSync } from 'node:fs';
import { createHarness, defaultJobs, BASE, CHANNEL } from './lib/harness.mjs';
import { allSuites } from './lib/suites.mjs';
import { changedFiles, loadMap, saveMap, selectSuites } from './select.mjs';

const argv = process.argv.slice(2);

/** 取一个「只有开关、没有值」的选项（取走即从 argv 摘掉） */
const takeFlag = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return false;
  argv.splice(i, 1);
  return true;
};

/** 取一个 `--name value` 形式的选项值，顺手从 argv 摘掉（剩下的才是位置参数） */
const takeValue = (...names) => {
  for (const name of names) {
    const i = argv.indexOf(name);
    if (i < 0) continue;
    const value = argv[i + 1];
    argv.splice(i, value === undefined ? 1 : 2);
    return value;
  }
  return undefined;
};

const onlyList = takeFlag('--list');
const record = takeFlag('--record');
if (record) process.env.MOSAIC_RECORD = '1'; // 让 12 号守卫知道「地图马上就要重录，别对账」
const jobsRaw = takeValue('--jobs', '-j') ?? process.env.JOBS;
const jobs = Math.max(1, Math.min(8, Number.parseInt(jobsRaw ?? '', 10) || defaultJobs()));

/* --changed [ref]：ref 省略就是 HEAD（工作区改动 + 未跟踪文件） */
const changedAt = argv.indexOf('--changed');
let changedRef;
if (changedAt > -1) {
  const next = argv[changedAt + 1];
  changedRef = next && !next.startsWith('-') ? next : 'HEAD';
  argv.splice(changedAt, changedRef === 'HEAD' && next === undefined ? 1 : 2);
}

// --site 只跑站点；同时给了 slug 就两边都跑
const positional = argv.filter((a) => !a.startsWith('-'));
const wanted = positional;
const onlySite = argv.includes('--site') && wanted.length === 0;
const includeSite = argv.includes('--site') || wanted.length === 0;
const includeComponents = !onlySite;

const all = allSuites();

/* 位置参数先当站点套件过滤（套件路径或标签包含它就留下）。一个都没命中时说明给的是组件 slug，
   按老规矩跑全部站点 —— 于是 `--site button` 仍是「站点全部 + button 组件套件」。 */
const pickedSite = wanted.length
  ? all.filter((s) => s.kind === 'site' && wanted.some((w) => s.path.includes(w) || s.label.includes(w)))
  : all.filter((s) => s.kind === 'site');

let suites = [];
if (record) {
  // 录制要的是完整地图：忽略一切过滤，跑全量
  suites = all;
} else {
  if (includeSite) suites.push(...(pickedSite.length ? pickedSite : all.filter((s) => s.kind === 'site')));
  if (includeComponents) {
    suites.push(
      ...all.filter((s) => s.kind === 'component' && (!wanted.length || wanted.includes(s.slug))),
    );
  }
}

/* 选测中间层：改动 → 该跑哪些套件（依赖地图 + 兜底策略，见 tests/select.mjs） */
if (changedRef !== undefined) {
  const changed = changedFiles(changedRef);
  if (changed === null) {
    console.log(`\n\x1b[33m取不到 git 改动（ref=${changedRef}）→ 全量\x1b[0m`);
  } else {
    const map = loadMap();
    const picked = selectSuites({ changed, suites, map });
    const labels = new Map(suites.map((s) => [s.path, s.label]));
    console.log(
      `\n\x1b[1m▌选测\x1b[0m \x1b[2m--changed ${changedRef} · 改动 ${changed.length} 个文件 → ` +
        `命中 ${picked.selected.length}/${suites.length} 个套件${picked.full ? '（共享面 → 全部）' : ''}\x1b[0m`,
    );
    for (const note of picked.notes.slice(0, 8)) {
      const hit =
        note.suites === 'all' || note.suites === 'none'
          ? note.suites
          : note.suites.map((p) => labels.get(p) ?? p).join(' / ');
      console.log(`\x1b[2m  ${note.file} → ${note.why}${hit === 'all' || hit === 'none' ? '' : `：${hit}`}\x1b[0m`);
    }
    if (picked.notes.length > 8) console.log(`\x1b[2m  …另有 ${picked.notes.length - 8} 条命中\x1b[0m`);
    suites = suites.filter((s) => picked.selected.includes(s.path));
  }
}

if (!suites.length) {
  if (changedRef !== undefined) {
    console.log('\n改动没有命中任何套件（要全量就去掉 --changed，或加 --record 重录地图）\n');
    process.exit(0);
  }
  console.error(
    `\n没有匹配的套件：${process.argv.slice(2).join(' ') || '(空)'}\n` +
      `  站点套件：${all.filter((s) => s.kind === 'site').map((s) => s.path.replace('tests/site/', '').replace('.mjs', '')).join(' / ')}\n` +
      `  组件套件：${all.filter((s) => s.kind === 'component').map((s) => s.slug).join(' / ')}\n` +
      `  例：--site nav · --site 10 · menu · --changed\n`,
  );
  process.exit(1);
}

if (onlyList) {
  console.log(
    `\n共 ${suites.length} 个套件（--jobs ${jobs}）` +
      (record ? ' · 录制模式' : changedRef !== undefined ? ` · --changed ${changedRef}` : '') +
      '：',
  );
  for (const s of suites) console.log(`  ${s.label.padEnd(26)} ${s.path}`);
  process.exit(0);
}

const harness = await createHarness();
const started = Date.now();

console.log(
  `\n\x1b[1mMosaic 冒烟测试\x1b[0m  ${BASE}  (${CHANNEL})  ` +
    `\x1b[2m${suites.length} 个套件 · 并行 ${Math.min(jobs, suites.length)}` +
    `${record ? ' · 录制依赖地图' : ''}\x1b[0m`,
);

/* 预热：先在共享 context 的缓存里放上公共资产（ofa.js / mosaic.css / shadow-base / 布局页与文档模块）。
   不预热的话，并行开工的 N 个 page 会同时从 CDN 取同一批文件，互相排队，把各套件 10–15s 的
   就绪等待顶爆（实测：4 并行时 01 / 03 / 04 / 06 / 09 全红）。预热本身失败只提示 ——
   真问题由各套件自己的断言说话。 */
const warmStart = Date.now();
const warm = await harness.createSession('预热');
await warm.visit(warm.page, '/index.html#/packages/button/page.html');
const warmed = await warm.page
  .waitForFunction(
    () => window.__deepAll('mc-button').length > 0 && window.__deepAll('mc-collapse').length > 0,
    { timeout: 30000 },
  )
  .then(() => true)
  .catch(() => false);
await warm.close();
console.log(
  `\x1b[2m预热 ${((Date.now() - warmStart) / 1000).toFixed(1)}s` +
    (warmed ? '' : '（超时：CDN 慢或不可达，各套件的就绪等待可能更久）') +
    '\x1b[0m',
);

/** 一个套件跑完的账：checks / problems / 碰过的文件 / 用时；按完成顺序打印 */
const outcomes = new Array(suites.length);

const printSuite = (o) => {
  console.log(
    `\n\x1b[1m▌${o.label}\x1b[0m \x1b[2m${(o.ms / 1000).toFixed(1)}s\x1b[0m` +
      (o.failed ? ` \x1b[31m${o.failed} 条失败\x1b[0m` : ''),
  );
  for (const r of o.checks) {
    console.log(
      `  ${r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${r.name}` +
        (r.detail ? `\n        \x1b[2m${r.detail}\x1b[0m` : ''),
    );
  }
};

let cursor = 0;
const worker = async () => {
  while (true) {
    const index = cursor++;
    if (index >= suites.length) return;

    const suite = suites[index];
    const session = await harness.createSession(suite.label);
    const t0 = Date.now();
    const tally = {
      ...suite,
      checks: session.results,
      problems: session.problems,
      files: session.files,
      ms: 0,
    };

    if (!existsSync(suite.file)) {
      session.check(
        `${suite.label}：套件文件存在`,
        false,
        `${suite.path} 不存在 —— 组件登记成 ready 就该有自己的测试套件`,
      );
    } else {
      try {
        const mod = await import(suite.file.href);
        await mod.default(session);
      } catch (error) {
        // 套件自己抛异常不该拖垮整轮：记一条失败，其余套件照跑
        session.check(`${suite.label}：套件执行到收工`, false, String(error?.stack ?? error));
      }
    }

    tally.ms = Date.now() - t0;
    tally.total = tally.checks.length;
    tally.failed = tally.checks.filter((r) => !r.ok).length;
    outcomes[index] = tally;
    printSuite(tally);
    await session.close();
  }
};

await Promise.all(Array.from({ length: Math.min(jobs, suites.length) }, worker));
await harness.close();

/* 录制依赖地图：套件 → 它实际请求过的仓库文件（+ 套件文件自己）。
   选测中间层用它做精确命中，见 tests/select.mjs。 */
if (record) {
  const map = { version: 1, suites: {}, byFile: {} };
  for (const o of outcomes) map.suites[o.path] = [...new Set([...o.files, o.path])].sort();
  for (const [path, files] of Object.entries(map.suites)) {
    for (const file of files) (map.byFile[file] ??= []).push(path);
  }
  map.byFile = Object.fromEntries(
    Object.entries(map.byFile)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, list]) => [file, list.sort()]),
  );
  saveMap(map);
  const failedSuites = outcomes.filter((o) => o.failed).length;
  console.log(
    `\n\x1b[2m已写入 tests/suite-map.json：${outcomes.length} 个套件 / ` +
      `${Object.keys(map.byFile).length} 个文件` +
      (failedSuites ? `（⚠️ 本轮有 ${failedSuites} 个套件失败，地图可能不全，补跑后再录一次）` : '') +
      '\x1b[0m',
  );
}

const wall = ((Date.now() - started) / 1000).toFixed(1);
const allChecks = outcomes.flatMap((o) => o.checks);
const failed = allChecks.filter((r) => !r.ok);
const problems = outcomes.flatMap((o) => o.problems);

/* 按定义顺序的用时表：谁在拖后腿一眼可见（并行时墙上时间 ≈ 最慢那条 + 排队） */
console.log(`\n\x1b[1m套件用时\x1b[0m`);
for (const o of outcomes) {
  const secs = `${(o.ms / 1000).toFixed(1)}s`.padStart(6);
  const pass = `${o.total - o.failed}/${o.total}`.padStart(7);
  console.log(`  ${o.failed ? '\x1b[31m✗' : '\x1b[32m✓\x1b[0m'} ${secs} ${pass}  ${o.label}`);
}

if (failed.length) {
  console.log(`\n\x1b[31m失败清单\x1b[0m`);
  for (const r of failed) console.log(`  · ${r.name}${r.detail ? `\n    ${r.detail}` : ''}`);
}

if (problems.length) {
  const uniq = [...new Set(problems)];
  console.log(
    `\n\x1b[2m（各套件 page 上累积了 ${problems.length} 条 console/HTTP 问题、去重后 ${uniq.length} 条；` +
      `首页那几条由第 1 个套件断言，其余仅供参考）\x1b[0m`,
  );
  for (const p of uniq.slice(0, 5)) console.log(`\x1b[2m  ${p}\x1b[0m`);
  if (uniq.length > 5) console.log(`\x1b[2m  …还有 ${uniq.length - 5} 条\x1b[0m`);
}

console.log(
  `\n${failed.length ? '\x1b[31m✗' : '\x1b[32m✓'} ${allChecks.length - failed.length}/${allChecks.length} 通过` +
    `\x1b[0m \x1b[2m· ${wall}s 墙上时间（并行 ${Math.min(jobs, suites.length)}）\x1b[0m\n`,
);

process.exit(failed.length ? 1 : 0);
