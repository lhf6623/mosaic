#!/usr/bin/env node
/* mosaic — CSS 构建入口。守卫必须放在 UnoCSS 之外：tokens.css 缺失时 UnoCSS 会**静默跳过**它，
 * 退出码 0，产出一份没有令牌定义的坏 CSS（所有 var(--mc-color-*) 变成悬空引用）—— 构建成功、颜色全失效。
 * 放 uno.config.ts 里则要引 node:fs，且 init 阶段异常会被配置加载器吞掉，只剩一个无信息的退出码 1。
 * 用法：node tools/build-css.mjs（通常经 `pnpm build:css` 调用） */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 缺任何一个都不该继续构建 */
const REQUIRED_INPUTS = ['packages/color/tokens.css', 'uno.config.ts'];

const missing = REQUIRED_INPUTS.filter((f) => !existsSync(resolve(ROOT, f)));

if (missing.length) {
  console.error(
    `\n[mosaic] 构建中止：缺少输入\n` +
      missing.map((f) => `         · ${f}\n`).join('') +
      `\n         tokens.css 由 tools/gen-tokens.mjs 生成，请先执行 \`pnpm tokens\`（或 \`pnpm build\`）。\n` +
      `         继续构建会产出一份没有任何令牌定义的 CSS，所有颜色会失效且不会有任何报错。\n`,
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

process.exit(result.status ?? 1);
