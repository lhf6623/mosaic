#!/usr/bin/env node
/**
 * 产物新鲜度守卫。跑：`node tools/check-fresh.mjs`（= `pnpm check:drift`）
 *
 * 守什么：`packages/color/tokens.css`、`packages/boot/mosaic.css`、`icons.generated.ts`、
 * `icons.license.txt` 这四份**是构建产物，但必须提交进仓库**（使用者侧零工具链，
 * CDN 直接取仓库里的文件）。于是有一种特有的脱节：**源码改了、产物没重新生成** ——
 * 构建成功、测试也绿（测试跑的是仓库里那份产物），只有使用者拿到的 CSS 是旧的。
 * 实测踩到过一次：`mosaic.css` 里缺了源码后来才用到的 `.visible` / `.resize` / `.px`，
 * 而且缺了不会有任何报错。
 *
 * 怎么判：重新跑一遍生成，比对前后。变了就说明仓库里那份是旧的。
 * ⚠️ 这个脚本**会改工作区**（重新生成产物）—— 这是故意的：报出来的同时已经修好了，
 *    使用者要做的只是把它提交上去。跑之前工作区干净，跑完要么没变、要么留下待提交的新产物。
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PRODUCTS = [
  'packages/color/tokens.css',
  'packages/boot/mosaic.css',
  'packages/icon/icons.generated.ts',
  'packages/icon/icons.license.txt',
];

/** 顺序照 `pnpm build`：图标 → 令牌 → CSS（build-css 会自检前两份在不在） */
const BUILD = ['tools/gen-icons.mjs', 'tools/gen-tokens.mjs', 'tools/build-css.mjs'];

const read = (rel) => {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  /* ⚠️ 换行符要归一：Windows 上 checkout 出来的文件是 CRLF，而生成脚本写出来的是 LF。
     不归一的话，「内容其实一致、只是行尾不同」会被误报成产物过期。 */
  return readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
};

const before = new Map(PRODUCTS.map((f) => [f, read(f)]));

for (const script of BUILD) {
  const r = spawnSync(process.execPath, [resolve(ROOT, script)], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32' && script.endsWith('build-css.mjs'),
  });
  if (r.status !== 0) {
    console.error(`\n[mosaic] 构建失败（${script}），产物新鲜度无从判断。`);
    process.exit(r.status ?? 1);
  }
}

const stale = PRODUCTS.filter((f) => read(f) !== before.get(f));

if (!stale.length) {
  console.log(`[mosaic] 产物新鲜度：${PRODUCTS.length} 份产物都与源码一致（构建是幂等的）`);
  process.exit(0);
}

console.error(
  `\n[mosaic] 产物与源码脱节 —— 这 ${stale.length} 份刚才被重新生成了：\n` +
    stale.map((f) => `         · ${f}\n`).join('') +
    `\n         意思是：有人改了源码（组件里的类名 / 令牌脚本 / 图标清单）却没跑 \`pnpm build\`。\n` +
    `         已经按源码重新生成好了 —— **把它们一起提交**（产物必须一起提交，使用者侧没有构建）。\n` +
    `         想看改了什么：\`git diff -- ${stale.join(' ')}\`\n`,
);
process.exit(1);
