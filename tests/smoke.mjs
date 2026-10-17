#!/usr/bin/env node
/**
 * Mosaic 端到端冒烟测试入口（playwright-core + 系统 Chrome）。
 *
 * 用法（先起 `pnpm dev`）：
 *   pnpm test                默认：只跑**本次改动**命中的套件（选测中间层，见 tests/select.mjs）。
 *                            工作区干净 → 什么都不跑（**不会**自动转全量）；
 *                            这次改动若被判定为全量（共享面 / 依赖地图缺失），入口会拒绝执行并退出 1 ——
 *                            全量必须显式，见下面两条。
 *   pnpm test origin/main    跟某个 ref 比（提交之后想验自己这批就用这条；显式 ref 照常选测）
 *   pnpm test:all            全量：每个 READY 组件的套件。**只在明确要求时跑**；
 *                            `node tests/smoke.mjs`（不带过滤）是另一个等价的显式入口
 *   node tests/smoke.mjs --jobs 1        串行跑（排查「以为是并行引发的时序问题」时用）
 *   node tests/smoke.mjs --jobs 6        临时加大并行度（可用 JOBS=6 代替）
 *   pnpm test --list         只列出会跑哪些套件（可与其它参数组合预览），不启动浏览器
 *   node tests/smoke.mjs --record        重录依赖地图 tests/suite-map.json：
 *                                        不给过滤 = 跑全量整份重录（显式动作）；给了过滤（如 `popover --record`）
 *                                        = 只跑并只重录这些套件、其余条目合并保留（新增组件时用这条，
 *                                        收尾从一次全量降成一次单套件）。两种都忽略 --changed
 *                                        例：`node tests/smoke.mjs popover --record`
 *   node tests/smoke.mjs menu            只跑 menu 组件套件（位置参数就是组件 slug，可给多个）
 *
 * ⚠️ 文档站（docs/）那批套件已按「站点定型、不再大改」的取舍整体删掉 —— 连同 --site 与选测守卫。
 *    需要时从 git 历史里取回（提交信息里能搜到 #site）。
 *
 * 并行模型：一个套件 = 一个 page，都挂在同一个 browser context 上（CDN 缓存共享，只下一次）。
 * 套件之间没有顺序依赖，所以输出按**完成顺序**成块打印，收尾再给一张按定义顺序的用时表。
 *
 * 环境变量 BASE_URL / CHANNEL / JOBS / BROWSER_NO_PROXY=1（本机代理挂掉时直连）。
 */

import { existsSync } from 'node:fs';
import { createHarness, defaultJobs, BASE, CHANNEL } from './lib/harness.mjs';
import { allSuites } from './lib/suites.mjs';
import { changedFiles, importClosure, loadMap, saveMap, selectSuites } from './select.mjs';

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
if (record) process.env.MOSAIC_RECORD = '1'; // 录地图时告诉 harness：这一轮别做对账
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

/* 位置参数是组件 slug（可给多个；不给就是全部）。`--site` 那套随文档站套件一起删了。 */
const positional = argv.filter((a) => !a.startsWith('-'));
const wanted = positional;

const all = allSuites();
let suites = all.filter((s) => !wanted.length || wanted.includes(s.slug));

/* 录制：没给过滤就是整份重录（跑全量）；给了过滤就**只录这些套件、其余条目合并保留** ——
   新增一个组件时，收尾从「一次全量」降到「一次单套件」。见下面写地图那段。 */
const partialRecord = record && wanted.length > 0;

/* 选测中间层：改动 → 该跑哪些套件（依赖地图 + 兜底策略，见 tests/select.mjs）
   录制时不做选测过滤：录制要的是「这套件碰过哪些文件」，跳着跑会漏。
   ⚠️ 全量只有显式入口（`pnpm test:all` / 不带过滤的 `node tests/smoke.mjs` / `--record` 整份重录）。
   默认 --changed 入口在两种情况下**不跑**：没有改动可测，或选择结果被判成全量。 */
let autoFull = false;
/** @type {{ file: string, why: string }[]} */
let autoFullWhy = [];
if (changedRef !== undefined && !record) {
  const changed = changedFiles(changedRef);
  if (changed === null) {
    console.error(
      `\n\x1b[31m取不到 git 改动（ref=${changedRef}）\x1b[0m → 不跑测试。\n` +
        `  \x1b[2m要全量请显式 pnpm test:all；只验某个组件：node tests/smoke.mjs <slug>\x1b[0m\n`,
    );
    process.exit(1);
  }
  if (!changed.length) {
    /* 隐式 --changed（`pnpm test` 的默认）或显式 ref 没有差异：没有可测的改动。
       不再自动转全量 —— 全量必须是显式命令。 */
    console.log(
      `\n\x1b[1m▌选测\x1b[0m \x1b[2m工作区${changedRef === 'HEAD' ? '' : `与 ${changedRef} `}没有改动 → 不跑测试。` +
        `要全量请显式 pnpm test:all；只验某个组件：node tests/smoke.mjs <slug>\x1b[0m\n`,
    );
    process.exit(0);
  }
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
  /* 选择结果 = 全部套件（共享面 / 未知面 / 地图缺失）：默认入口不自动开跑，交给显式全量。
     指定了 slug 的除外 —— 那是使用者显式收窄到这些组件。 */
  if (picked.full && !wanted.length) {
    autoFull = true;
    autoFullWhy = picked.notes
      .filter((note) => note.suites === 'all')
      .slice(0, 6)
      .map((note) => ({ file: note.file, why: note.why }));
  }
}

/* 显式全量（`node tests/smoke.mjs` / `pnpm test:all`）且工作区脏时提示一句：
   默认入口只跑改动命中的范围，这里把能省多少算出来 —— 免得「全量」变肌肉记忆。
   ⚠️ 全量是**显式**动作：默认 `pnpm test` 在判定为全量时拒绝执行，不会自己起。 */
if (!record && changedRef === undefined && suites.length === all.length) {
  const dirty = changedFiles('HEAD') ?? [];
  if (dirty.length) {
    const picked = selectSuites({ changed: dirty, suites: all, map: loadMap() });
    console.log(
      picked.full
        ? `\n\x1b[33m▌提示\x1b[0m 工作区有 ${dirty.length} 个改动，影响全部套件（共享面 / 测试基座）。` +
            `\x1b[2m默认入口 pnpm test 会拒绝自动跑全量；你这次是显式全量，才真正开跑。\x1b[0m\n`
        : `\n\x1b[33m▌提示\x1b[0m 工作区有 ${dirty.length} 个改动：` +
            `\x1b[2m默认入口 pnpm test 只会跑 ${picked.selected.length}/${all.length} 个套件（--list 先预览）\x1b[0m\n`,
    );
  }
}

if (!suites.length) {
  if (changedRef !== undefined) {
    console.log(
      '\n改动没有命中任何套件（没有可跑的；要全量请显式 pnpm test:all，或跑 node tests/smoke.mjs <slug>）\n',
    );
    process.exit(0);
  }
  console.error(
    `\n没有匹配的套件：${process.argv.slice(2).join(' ') || '(空)'}\n` +
      `  组件套件：${all.map((s) => s.slug).join(' / ')}\n` +
      `  例：menu · input · --changed · --list\n`,
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

/* 默认入口拒绝自动全量：选择结果是全部套件时，把决定权交还给使用者（退出 1，避免「一条没跑也全绿」）。
   --list 已经在上面退出，所以想先看清单的人仍然看得到。 */
if (autoFull) {
  console.error(
    `\n\x1b[1m▌拒绝自动跑全量\x1b[0m 这次改动被判定为全量：\n` +
      autoFullWhy.map((note) => `  · ${note.file} → ${note.why}`).join('\n') +
      `\n\x1b[2m默认入口 pnpm test 只跑「改动命中的套件」，全量必须显式：\n` +
      `  pnpm test:all                     确认要跑全量\n` +
      `  pnpm test --list                  先看会跑哪些套件\n` +
      `  node tests/smoke.mjs <slug>       只验某个组件\x1b[0m\n`,
  );
  process.exit(1);
}

const harness = await createHarness();
const started = Date.now();

console.log(
  `\n\x1b[1mMosaic 冒烟测试\x1b[0m  ${BASE}  (${CHANNEL})  ` +
    `\x1b[2m${suites.length} 个套件 · 并行 ${Math.min(jobs, suites.length)}` +
    `${record ? (partialRecord ? ' · 只重录本轮的套件' : ' · 整份重录依赖地图') : ''}\x1b[0m`,
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

    /* 每个套件都统一断言「这一页没有 404 / console 报错」——
       这条以前在 17 处组件套件里各写一遍（另外 9 个干脆没写），现在由跑器负责：
       只在**出问题**时补一条失败，全绿时不占断言数（汇总仍在轮末打印）。

       ⚠️ **跨组件的公共契约到此为止，别再加一层浏览器契约套件**。理由（2026-09 实测）：
         · 浏览器里的断言按「归一化后同形」统计，跨套件重复的只有 9%（32 条），其中 17 条
           就是这条「无 404」（已上移），其余 343 条是组件特有行为（badge 的 max 截断、
           tabs 的 Home/End、dialog 的焦点陷阱…），**没有可收的**；
         · 「每页各跑一遍」的公共套件成本极高（曾经那条走 26 个文档页要 62s），为几条断言
           付这个时间不划算 —— 文档站那批套件就是这么整体删掉的。
       将来若真要做，正确形态是一张**最小夹具页**（一页同时挂 N 个组件、不经外壳 + 路由 +
       三栏 + doc-spec，估计 3~5s），那顺带还能让组件套件摆脱对站点的依赖。 */
    if (tally.problems.length) {
      session.check(`${suite.label}：页面无 404 / 报错`, false, tally.problems.join('\n'));
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

/* 录制依赖地图：套件 → 它实际请求过的仓库文件（+ 套件文件自己 + 静态 import 闭包）。
   选测中间层用它做精确命中，见 tests/select.mjs。 */
if (record) {
  /* 部分录制：拿现有地图当底，只替换本轮跑过的套件条目 —— 别把没跑的套件的记录冲掉。
     整份录制（没给过滤）时才新建。 */
  const map = partialRecord ? (loadMap() ?? { version: 1, suites: {}, byFile: {} }) : { version: 1, suites: {}, byFile: {} };
  map.version = 1;
  map.suites ??= {};
  for (const o of outcomes) {
    /* 三部分：真正请求过的文件 + 套件文件自己 + **静态 import 闭包**
       （静态 import 进来的模块不吃 HTTP，只能这样进地图） */
    map.suites[o.path] = [...new Set([...o.files, o.path, ...importClosure(o.path)])].sort();
  }
  /* byFile 是 suites 的反查索引，**整份重建**（部分录制时旧条目也一起参与重建） */
  const byFile = {};
  for (const [path, files] of Object.entries(map.suites)) {
    for (const file of files) (byFile[file] ??= []).push(path);
  }
  map.byFile = Object.fromEntries(
    Object.entries(byFile)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, list]) => [file, list.sort()]),
  );
  saveMap(map);
  const failedSuites = outcomes.filter((o) => o.failed).length;
  console.log(
    `\n\x1b[2m已写入 tests/suite-map.json：` +
      (partialRecord
        ? `本轮更新 ${outcomes.length} 个套件（其余 ${Object.keys(map.suites).length - outcomes.length} 个沿用旧记录）`
        : `${outcomes.length} 个套件（整份重录）`) +
      ` / 共 ${Object.keys(map.byFile).length} 个文件` +
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
      `仅供参考）\x1b[0m`,
  );
  for (const p of uniq.slice(0, 5)) console.log(`\x1b[2m  ${p}\x1b[0m`);
  if (uniq.length > 5) console.log(`\x1b[2m  …还有 ${uniq.length - 5} 条\x1b[0m`);
}

console.log(
  `\n${failed.length ? '\x1b[31m✗' : '\x1b[32m✓'} ${allChecks.length - failed.length}/${allChecks.length} 通过` +
    `\x1b[0m \x1b[2m· ${wall}s 墙上时间（并行 ${Math.min(jobs, suites.length)}）\x1b[0m\n`,
);

process.exit(failed.length ? 1 : 0);
