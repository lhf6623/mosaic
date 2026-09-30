#!/usr/bin/env node
/* mosaic — CSS 装配入口。跑：`node tools/build-css.mjs`（= `pnpm build:css`）。
 *
 * 装配出两份产物，都要提交进仓库（使用者侧零构建，CDN 直接取）：
 *
 *   packages/boot/mosaic.css          ← 使用者 `<link>` 的那份（可选：令牌 + 工具类）
 *       packages/color/tokens.css            生成 · 令牌 + @layer 层顺序声明
 *       packages/icon/icons.generated.css    生成 · 内置图标 mask
 *       packages/boot/utilities.css          手写 · 工具类子集
 *
 *   packages/boot/component-base.css  ← **组件自己** `<link>` 的那份（shadow 作用域，不外溢）
 *       packages/color/token-defaults.css    生成 · shadow 内的令牌默认值（--mc-def-*）
 *       packages/boot/shadow-base.css        手写 · 只进 shadow root 的元素级 reset
 *
 * 为什么守卫必须在这里：拼接少了一份输入，产出的是一份**坏 CSS 但退出码 0**
 * （var(--mc-*) 悬空、图标整片空白），构建"成功"、页面静默失效 —— 实测过。
 *
 * 加一条工具类：改 packages/boot/utilities.css（手写，没有扫描器替你生成）。
 */

import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS } from './icon-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** mosaic.css 的输入（按序拼） */
const SOURCES = [
  { file: 'packages/color/tokens.css', by: 'tools/gen-tokens.mjs', cmd: 'pnpm tokens' },
  { file: 'packages/icon/icons.generated.css', by: 'tools/gen-icons.mjs', cmd: 'pnpm icons' },
  { file: 'packages/boot/utilities.css', by: '手写', cmd: '' },
];

/** component-base.css 的输入（按序拼） */
const BASE_SOURCES = [
  { file: 'packages/color/token-defaults.css', by: 'tools/gen-tokens.mjs', cmd: 'pnpm tokens' },
  { file: 'packages/boot/shadow-base.css', by: '手写', cmd: '' },
];

const OUT = 'packages/boot/mosaic.css';
const BASE_OUT = 'packages/boot/component-base.css';

const BANNER = `/* 由 tools/build-css.mjs 装配 —— 勿手改；改源码后重跑 \`pnpm build:css\`（\`pnpm check:drift\` 会比对）。
 * 来源（按序）：packages/color/tokens.css · packages/icon/icons.generated.css · packages/boot/utilities.css
 * ========================================================================== */
`;

const BASE_BANNER = `/* 由 tools/build-css.mjs 装配 —— 勿手改；改源码后重跑 \`pnpm build:css\`。
 * 来源（按序）：packages/color/token-defaults.css · packages/boot/shadow-base.css
 *
 * 这份是**组件自己**在模板里 <link> 的基座：进了那个 shadow root，不外溢到宿主页面。
 * 它给两样东西：shadow 内的元素级 reset，以及令牌的默认值（--mc-def-*）。
 * 令牌默认值刻意用独立名字 + 两级回退（var(--mc-color-x, var(--mc-def-color-x))）——
 * 页面在 :root / [data-theme] / 宿主 style 上写的令牌照旧赢过它，换肤不受影响。
 * ========================================================================== */
@layer mosaic.base, mosaic.tokens, mosaic.icons, mosaic.utilities;
`;

const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;

/** 缺输入就大声失败：继续装配会产出一份坏 CSS，且没有任何报错 */
function missingInputs() {
  return [...SOURCES, ...BASE_SOURCES]
    .filter((s) => !existsSync(resolve(ROOT, s.file)))
    .map((s) => `缺少输入 ${s.file}（由 ${s.by} 生成）` + (s.cmd ? ` —— 先执行 \`${s.cmd}\`` : ''));
}

/** 装配两份产物 + 自检；返回 { files: [{out, css}], problems } */
function build() {
  const missing = missingInputs();
  if (missing.length) {
    return { files: [], problems: [...missing, '继续装配会产出一份没有令牌 / 没有图标的坏 CSS'] };
  }

  const css = `${BANNER}\n${SOURCES.map((s) => read(s.file)).join('\n')}`;
  const baseCss = `${BASE_BANNER}\n${BASE_SOURCES.map((s) => read(s.file)).join('\n')}`;
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

  /* 3. 基座必须真的带上令牌默认值：少了它，组件里那条两级回退会静默落到「无值」，
   *    表现为颜色 / 间距整片失效，而且只在「页面没引令牌表」时才复现 —— 正是最难查的那类。 */
  if (!baseCss.includes('--mc-def-')) {
    problems.push(
      'component-base.css 里没有 --mc-def-* 默认值 —— 没引令牌表的页面上组件会整片失效（检查 packages/color/token-defaults.css）',
    );
  }
  if (!baseCss.includes('box-sizing: border-box')) {
    problems.push('component-base.css 里没有 shadow reset（检查 packages/boot/shadow-base.css）');
  }

  return {
    files: [
      { out: OUT, css },
      { out: BASE_OUT, css: baseCss },
    ],
    problems,
  };
}

/** 写出产物（内容不变就不动文件，免得 check:drift 报假过期） */
function write(file, css) {
  const outFile = resolve(ROOT, file);
  if (existsSync(outFile) && readFileSync(outFile, 'utf8') === css) return false;
  writeFileSync(outFile, css);
  return true;
}

function run({ quiet = false } = {}) {
  const { files, problems } = build();
  if (problems.length) {
    console.error(
      `\n[mosaic] CSS 装配中止：\n${problems.map((p) => `         · ${p}\n`).join('')}`,
    );
    return 1;
  }
  const changed = files.filter((f) => write(f.out, f.css)).length;
  if (!quiet) {
    console.log(
      `\n[mosaic] 装配完成（${Object.keys(ICONS).length} 个内置图标）：\n` +
        files.map((f) => `         ${f.out.padEnd(38)} ${kb(f.css)}`).join('\n') +
        `\n         来源：${[...SOURCES, ...BASE_SOURCES]
          .map((s) => s.file.split('/').pop())
          .join(' · ')}${changed ? '' : '（内容无变化）'}\n`,
    );
  }
  return 0;
}

const WATCHED = [...SOURCES, ...BASE_SOURCES];

if (process.argv.includes('--watch')) {
  const code = run();
  if (code !== 0) process.exit(code);
  console.log(`[mosaic] 监听 ${WATCHED.map((s) => s.file).join(' · ')} —— 改动即重新装配`);
  let timer = null;
  for (const { file } of WATCHED) {
    watch(resolve(ROOT, file), () => {
      /* 编辑器保存常常连发几次事件，防抖一下免得重复写产物 */
      clearTimeout(timer);
      timer = setTimeout(() => run(), 50);
    });
  }
} else {
  process.exit(run());
}
