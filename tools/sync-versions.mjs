#!/usr/bin/env node
/**
 * mosaic — 把文档 / 示例里的 CDN 版本号统一到 docs/lib/version.mjs。
 *
 * 用法：
 *   pnpm versions          写回（发版时用）
 *   pnpm versions --check  只检查不写（check:docs 里的 doc-versions 也会拦）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from './doc-drift/lib/parse.mjs';
import { MOSAIC_VERSION, OFA_VERSION, VERSIONED_GLOBS } from '../docs/lib/version.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const RULES = [
  { re: /(gh\/lhf6623\/mosaic@)([\w.-]+)/g, want: MOSAIC_VERSION, label: 'mosaic' },
  { re: /(gh\/ofajs\/ofa\.js@)([\w.-]+)/g, want: OFA_VERSION, label: 'ofa.js' },
];

const files = [...new Set(VERSIONED_GLOBS.flatMap((glob) => listFiles(ROOT, glob)))].sort();
const stale = [];

for (const file of files) {
  const abs = resolve(ROOT, file);
  const before = readFileSync(abs, 'utf8');
  let after = before;
  for (const { re, want, label } of RULES) {
    after = after.replace(re, (match, prefix, version) => {
      if (version === want) return match;
      stale.push(`${file}：${label}@${version} → @${want}`);
      return prefix + want;
    });
  }
  if (!CHECK && after !== before) writeFileSync(abs, after);
}

if (!stale.length) {
  console.log(`[mosaic] CDN 版本号一致：mosaic@${MOSAIC_VERSION} · ofa.js@${OFA_VERSION}`);
  process.exit(0);
}
console.log(`[mosaic] ${CHECK ? '版本不一致' : '已同步版本'}：\n  ${stale.join('\n  ')}`);
process.exit(CHECK ? 1 : 0);
