#!/usr/bin/env node
/* mosaic — CSS 装配入口。跑：`node tools/build-css.mjs`（= `pnpm build:css`）。
 *
 * 产物只有一份：`packages/boot/mosaic.css` —— 使用者 `<link>` 的就是它，必须提交进仓库。
 * 它按顺序拼三份源码，**没有任何 CSS 框架参与**：
 *
 *   packages/color/tokens.css            生成 · 令牌 + @layer 层顺序声明（tools/gen-tokens.mjs）
 *   packages/icon/icons.generated.css    生成 · 内置图标的 mask 规则（tools/gen-icons.mjs）
 *   packages/boot/utilities.css          手写 · 工具类子集
 *
 * 为什么守卫必须在这里：拼接少了一份输入，产出的是一份**坏 CSS 但退出码 0**
 * （所有 var(--mc-*) 悬空、图标整片空白），构建"成功"、页面静默失效 —— 实测过。
 *
 * 加一条工具类：改 packages/boot/utilities.css（手写，不再有扫描器替你生成）。
 */

import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS } from './icon-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 缺任何一个都不该继续装配 */
const SOURCES = [
  { file: 'packages/color/tokens.css', by: 'tools/gen-tokens.mjs', cmd: 'pnpm tokens' },
  { file: 'packages/icon/icons.generated.css', by: 'tools/gen-icons.mjs', cmd: 'pnpm icons' },
  { file: 'packages/boot/utilities.css', by: '手写', cmd: '' },
];

const OUT = 'packages/boot/mosaic.css';

const BANNER = `/* 由 tools/build-css.mjs 装配 —— 勿手改；改源码后重跑 \`pnpm build:css\`（\`pnpm check:drift\` 会比对）。
 * 来源（按序）：packages/color/tokens.css · packages/icon/icons.generated.css · packages/boot/utilities.css
 * ========================================================================== */
`;

const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;

/** 装配 + 自检；返回 { css, problems } */
function build() {
  const missing = SOURCES.filter((s) => !existsSync(resolve(ROOT, s.file)));
  if (missing.length) {
    return {
      css: null,
      problems: [
        ...missing.map(
          (s) => `缺少输入 ${s.file}（由 ${s.by} 生成）` + (s.cmd ? ` —— 先执行 \`${s.cmd}\`` : ''),
        ),
        '继续装配会产出一份没有令牌 / 没有图标的坏 CSS，且不会有任何报错',
      ],
    };
  }

  const parts = SOURCES.map((s) => read(s.file));
  const css = `${BANNER}\n${parts.join('\n')}`;
  const problems = [];

  /* 1. 层顺序：mosaic.icons 必须在声明里，且排在 utilities **之前**。
   *    层顺序由「首次出现」决定；图标规则写着 color:inherit / width:1em，
   *    一旦被排到 utilities 之后，实测会盖掉 text-primary（computed color 变成 rgb(0,0,0)）、
   *    w-full 也压不住 width:1em。 */
  const decl = /^@layer [^;]*;/m.exec(css)?.[0] ?? '';
  const icons = decl.indexOf('mosaic.icons');
  const utils = decl.indexOf('mosaic.utilities');
  if (icons < 0) {
    problems.push(
      '`@layer` 声明里没有 mosaic.icons —— 层顺序声明在 packages/color/tokens.css（tools/gen-tokens.mjs）',
    );
  } else if (utils >= 0 && icons > utils) {
    problems.push(
      '`@layer` 声明里 mosaic.icons 排在 mosaic.utilities 之后 —— 图标规则会盖掉使用者的工具类',
    );
  }

  /* 2. 内置图标一条都不能少：少了不会有任何提示，使用者看到的是「这个图标永久走远程、还慢」 */
  const lost = Object.keys(ICONS).filter((name) => !css.includes(`.mc-icon-${name}{`));
  if (lost.length) {
    problems.push(`以下内置图标的类名不在产物里：${lost.join(' ')} —— 检查 tools/gen-icons.mjs`);
  }

  return { css, problems };
}

/** 写出产物（内容不变就不动文件，免得 check:drift 报假过期） */
function write(css) {
  const outFile = resolve(ROOT, OUT);
  if (existsSync(outFile) && readFileSync(outFile, 'utf8') === css) return false;
  writeFileSync(outFile, css);
  return true;
}

function run({ quiet = false } = {}) {
  const { css, problems } = build();
  if (problems.length) {
    console.error(
      `\n[mosaic] CSS 装配中止：\n${problems.map((p) => `         · ${p}\n`).join('')}`,
    );
    return 1;
  }
  const changed = write(css);
  if (!quiet) {
    const sizes = SOURCES.map((s) => `${s.file.split('/').pop()} ${kb(read(s.file))}`).join(' · ');
    console.log(
      `\n[mosaic] ${OUT} 装配完成：${kb(css)} · ${Object.keys(ICONS).length} 个内置图标\n` +
        `         来源：${sizes}${changed ? '' : '（内容无变化）'}\n`,
    );
  }
  return 0;
}

if (process.argv.includes('--watch')) {
  const code = run();
  if (code !== 0) process.exit(code);
  console.log(`[mosaic] 监听 ${SOURCES.map((s) => s.file).join(' · ')} —— 改动即重新装配`);
  let timer = null;
  for (const { file } of SOURCES) {
    watch(resolve(ROOT, file), () => {
      /* 编辑器保存常常连发几次事件，防抖一下免得重复写产物 */
      clearTimeout(timer);
      timer = setTimeout(() => run(), 50);
    });
  }
} else {
  process.exit(run());
}
