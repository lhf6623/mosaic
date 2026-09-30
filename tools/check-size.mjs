#!/usr/bin/env node
/* mosaic — 体积上限守卫（`pnpm check:size`，也挂在 `pnpm check` 里）。
 *
 * 为什么要有它：这是 CDN 直发的库，体积是**使用者要付的代价**。它不会自己喊疼，只会随着
 * 「顺手多一个图标 / 多两条工具类 / 组件里塞段说明」慢慢涨 —— 所以给关键产物一条预算线。
 * 超了要么优化，要么**显式**提上限；提上限这个动作必须出现在 diff 里，别默默放过。
 *
 * 预算 = 当前值上浮约 10%（每行注释里写着现值）。它拦的是无意增长，不是逼你优化。
 *
 * 两条规则：
 *   ① 共享产物（使用者必下的那几个）逐文件预算，raw + gzip 各一条线；
 *   ② 任一组件本体（`packages/<slug>/*.html`，page.html 是文档页不算）≤ 40 KB。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 共享产物：raw / gzip 两条线（注释里是写下预算时的现值） */
const SHARED = [
  // 51.0 KB / 9.0 KB —— 令牌 + 图标 + 工具类，使用者必下（卸掉 UnoCSS 后从 69.2 降下来）
  { file: 'packages/boot/mosaic.css', raw: 56 * 1024, gzip: 10 * 1024 },
  // 6.7 KB / 2.6 KB —— 组件自带的基座（shadow reset + 令牌默认值），
  // 每个组件 <link> 它一次、浏览器共享缓存；只对**组件**生效，不进宿主页面
  { file: 'packages/boot/component-base.css', raw: 8192, gzip: 3072 },
  // 1.7 KB / 0.95 KB
  { file: 'packages/boot/shadow-base.css', raw: 3 * 1024, gzip: 1.5 * 1024 },
  // 11.9 KB / 5.2 KB
  { file: 'packages/boot/scroll-pin.js', raw: 13 * 1024, gzip: 6 * 1024 },
  // 2.0 KB / 1.3 KB（组件共用：颜色字面量的数学，color-attr 与 tone 都引它）
  { file: 'packages/boot/color-math.js', raw: 2.5 * 1024, gzip: 1.75 * 1024 },
  // 6.2 KB / 3.2 KB（组件共用：color 收 hex 的接线器，接了它的组件才下）
  { file: 'packages/boot/color-attr.js', raw: 7 * 1024, gzip: 3.75 * 1024 },
  // 9.5 KB / 4.4 KB（按需引入：整段子树要任意色才下；数学已抽到 color-math.js）
  { file: 'packages/boot/tone.js', raw: 10.5 * 1024, gzip: 5.0 * 1024 },
  // 15.0 KB / 4.5 KB（已被 mosaic.css 包含，单列是为了盯住令牌的增长）
  { file: 'packages/color/tokens.css', raw: 16 * 1024, gzip: 5 * 1024 },
];

/** 组件本体单文件上限：现值最大的是 code.html 27.9 KB */
const COMPONENT_RAW = 40 * 1024;

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const problems = [];
const rows = [];

for (const item of SHARED) {
  let buf;
  try {
    buf = readFileSync(join(ROOT, item.file));
  } catch {
    problems.push(item.file + '：读不到 —— 产物是不是没 build？');
    continue;
  }
  const raw = buf.length;
  const gzip = gzipSync(buf).length;
  rows.push([item.file, kb(raw) + ' / ' + kb(gzip), kb(item.raw) + ' / ' + kb(item.gzip)]);
  if (raw > item.raw) problems.push(item.file + '：raw ' + kb(raw) + '，超预算 ' + kb(item.raw));
  if (gzip > item.gzip)
    problems.push(item.file + '：gzip ' + kb(gzip) + '，超预算 ' + kb(item.gzip));
}

const bodies = [];
for (const entry of readdirSync(join(ROOT, 'packages'), { withFileTypes: true })) {
  // ⚠️ `packages/` 下还住着**目录级文档**（`packages/README.md`）——只有目录才是组件单元
  if (!entry.isDirectory()) continue;
  const slug = entry.name;
  for (const name of readdirSync(join(ROOT, 'packages', slug))) {
    if (!name.endsWith('.html') || name === 'page.html') continue;
    const file = 'packages/' + slug + '/' + name;
    const size = statSync(join(ROOT, file)).size;
    bodies.push([file, size]);
    if (size > COMPONENT_RAW) {
      problems.push(file + '：' + kb(size) + '，超单文件上限 ' + kb(COMPONENT_RAW));
    }
  }
}
bodies.sort((a, b) => b[1] - a[1]);

console.log('\n[mosaic] 体积预算（raw / gzip）');
for (const row of rows) {
  console.log('  ' + row[0].padEnd(40) + row[1].padStart(18) + '   预算 ' + row[2]);
}
console.log(
  '\n  组件本体单文件上限 ' +
    kb(COMPONENT_RAW) +
    '；最大三个：' +
    bodies
      .slice(0, 3)
      .map((b) => b[0].replace('packages/', '') + ' ' + kb(b[1]))
      .join(' · '),
);

if (problems.length) {
  console.error('\n[mosaic] 体积超预算：');
  for (const problem of problems) console.error('  · ' + problem);
  console.error('  —— 要么优化，要么改 tools/check-size.mjs 里那张表（让提上限也进 diff）\n');
  process.exit(1);
}
console.log('\n[mosaic] 全部在预算内\n');
