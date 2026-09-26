#!/usr/bin/env node
/* mosaic — CSS 构建入口。守卫必须放在 UnoCSS 之外：tokens.css 缺失时 UnoCSS 会**静默跳过**它，
 * 退出码 0，产出一份没有令牌定义的坏 CSS（所有 var(--mc-color-*) 变成悬空引用）—— 构建成功、颜色全失效。
 * 放 uno.config.ts 里则要引 node:fs，且 init 阶段异常会被配置加载器吞掉，只剩一个无信息的退出码 1。
 * 用法：node tools/build-css.mjs（通常经 `pnpm build:css` 调用） */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS } from './icon-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 缺任何一个都不该继续构建 */
const REQUIRED_INPUTS = [
  'packages/color/tokens.css',
  'packages/icon/icons.generated.ts',
  'uno.config.ts',
];

const missing = REQUIRED_INPUTS.filter((f) => !existsSync(resolve(ROOT, f)));

if (missing.length) {
  console.error(
    `\n[mosaic] 构建中止：缺少输入\n` +
      missing.map((f) => `         · ${f}\n`).join('') +
      `\n         tokens.css 由 tools/gen-tokens.mjs 生成（pnpm tokens），\n` +
      `         icons.generated.ts 由 tools/gen-icons.mjs 生成（pnpm icons）——\n` +
      `         两者的产物都要提交进仓库，先执行 \`pnpm build\` 一次即可。\n` +
      `         继续构建会产出一份没有令牌定义 / 没有图标规则的 CSS，且不会有任何报错。\n`,
  );
  process.exit(1);
}

const bin = resolve(ROOT, 'node_modules/.bin/unocss');

if (!existsSync(bin)) {
  console.error('\n[mosaic] 找不到 unocss 可执行文件，请先执行 `pnpm install`。\n');
  process.exit(1);
}

// Windows 下 .bin 里是 .cmd 要走 shell；透传额外参数（如 --watch）好让 dev:css 复用同一个守卫
const result = spawnSync(bin, ['-c', 'uno.config.ts', ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) process.exit(result.status ?? 1);

/* ---------- 产物自检：两类静默失效都在这里变成构建失败 ----------
 * 1. 图标层顺序没声明 → mosaic.icons 被追加到 utilities 之后，图标规则里的 color:inherit
 *    会盖掉使用者的 text-primary（实测过：computed color 变成 rgb(0,0,0)）。
 * 2. 内置图标的类名没进产物 → presetIcons 默认不 warn，缺一个图标不会有任何提示，
 *    使用者看到的是「这个图标永久走远程、还慢」，非常难查。
 * ------------------------------------------------------------------ */

const outFile = resolve(ROOT, 'packages/boot/mosaic.css');
const css = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';

const problems = [];
if (!/^@layer [^;]*\bmosaic\.icons\b/m.test(css)) {
  problems.push(
    '`@layer` 声明里没有 mosaic.icons —— 它会被追加到 mosaic.utilities 之后，' +
      '图标规则会盖掉使用者的工具类（层声明在 packages/color/tokens.css，由 gen-tokens.mjs 生成）',
  );
}
const lostIcons = Object.keys(ICONS).filter((name) => !css.includes(`.mc-icon-${name}{`));
if (lostIcons.length) {
  problems.push(
    `以下内置图标的类名不在产物里：${lostIcons.join(' ')} —— ` +
      '检查 uno.config.ts 的 safelist 是否由 icons.generated.ts 派生',
  );
}

if (problems.length) {
  console.error(
    `\n[mosaic] 产物自检未通过：\n${problems.map((p) => `         · ${p}\n`).join('')}`,
  );
  process.exit(1);
}

console.log(
  `[mosaic] mosaic.css 自检通过：${Object.keys(ICONS).length} 个内置图标 · 层顺序含 mosaic.icons`,
);

process.exit(0);
