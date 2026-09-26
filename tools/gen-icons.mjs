#!/usr/bin/env node
/**
 * mosaic — 内置图标生成器：清单 + 上游图标数据 → 两份提交进仓库的产物。
 *
 *   packages/icon/icons.generated.ts   我们的 mc 图标集合（IconifyJSON 形状，键 = 对外名）
 *                                      —— 只被 uno.config.ts 在**构建期**读取，运行时从不请求
 *   packages/icon/icons.license.txt    来源与许可清单（署名义务、白名单核对结果）
 *
 * 三条守卫都是「缺输入必须大声失败」，而且是**构建期**就红，不留到浏览器里变成静默空白：
 *   1. 清单里的上游名必须真的存在（含别名解析）—— 上游改名/归档会在构建时就暴露；
 *   2. 图标集的 license.spdx 必须在白名单里 —— GPL / CC-BY-NC / 需署名的 CC-BY 一律进不来；
 *   3. 生成的图标类名不能和组件里已有的类名撞车 —— `mc-icon-*` 是和组件内部类同处一个全局
 *      命名空间的（mosaic.css 会被 <link> 进使用者的页面），撞了就是把某个内部元素变成图标。
 *
 * 用法：node tools/gen-icons.mjs（通常经 `pnpm icons` 调用；`pnpm build` 里排在 tokens 之前）
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getIconData } from '@iconify/utils';
import { ALLOWED_SETS, ICONS, ICON_SOURCE } from './icon-manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const OUT_DIR = resolve(ROOT, 'packages/icon');

/** 可放心内置的上游许可：只需保留版权声明、可商用、无传染性 */
const OK_SPDX = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'Unlicense',
  '0BSD',
]);

const fail = (lines) => {
  console.error(`\n[mosaic] 图标生成中止：\n${lines.map((l) => `         · ${l}\n`).join('')}`);
  process.exit(1);
};

/** 读某个图标集的原始数据（icons.json）+ 元信息（info.json） */
function loadSet(set) {
  const read = (file) => {
    let path;
    try {
      path = require.resolve(`@iconify-json/${set}/${file}`);
    } catch {
      path = resolve(ROOT, 'node_modules', '@iconify-json', set, file);
    }
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      fail([`读不到 @iconify-json/${set}/${file}`, `先执行 pnpm install（${err.message}）`]);
    }
  };
  return { data: read('icons.json'), info: read('info.json') };
}

/* ---------- 1. 清单里用到了哪些集，许可是否在白名单 ---------- */

const usedSets = [...new Set(Object.values(ICONS).map((spec) => spec.slice(0, spec.indexOf(':'))))];
const bad = usedSets.filter((s) => !ALLOWED_SETS.includes(s));
if (bad.length)
  fail([
    `清单里用了不在 ALLOWED_SETS 里的集：${bad.join(' ')}`,
    '白名单在 tools/icon-manifest.mjs',
  ]);

const sets = new Map(usedSets.map((s) => [s, loadSet(s)]));

const licenseProblems = [];
for (const [set, { info }] of sets) {
  const license = info?.license ?? {};
  if (!license.spdx)
    licenseProblems.push(`${set}：上游 info.json 没有 license.spdx，无法核对，请人工确认`);
  else if (!OK_SPDX.has(license.spdx))
    licenseProblems.push(`${set}：${license.spdx} 不在可内置白名单里`);
}
if (licenseProblems.length) fail(licenseProblems);

/* ---------- 2. 逐条解析：上游名 → 图形数据（getIconData 会解析别名与 rotate/hFlip 变换） ---------- */

const icons = {};
const missing = [];

/** getIconData 的结果可能带 `hidden` 之类的上游元信息：只留渲染真正需要的那几个字段 */
function pick(data) {
  const out = { body: data.body };
  for (const key of ['width', 'height', 'left', 'top', 'rotate', 'hFlip', 'vFlip']) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

for (const [pub, spec] of Object.entries(ICONS)) {
  const set = spec.slice(0, spec.indexOf(':'));
  const original = spec.slice(spec.indexOf(':') + 1);
  const data = getIconData(sets.get(set).data, original);
  if (!data?.body) missing.push(`${pub} → ${spec} 在该集里不存在（上游改名了？）`);
  else icons[pub] = pick(data);
}
if (missing.length) fail(missing);

/* ---------- 3. 类名守卫：引用必须存在；组件自己的样式不能占用图标类名 ----------
 * 图标类名和组件内部类名同处一个全局命名空间（mosaic.css 会被 <link> 进使用者的页面），守两头：
 *   · 组件里写死的 `mc-icon-x`（静态图标直接吃类，省一个文件请求）必须在清单里 ——
 *     上游改名或手滑要在**构建期**就炸，别等浏览器里静默空白；
 *   · 组件自己的 `<style>` 里不能出现和内置图标同名的选择器 —— 那等于把某个内部节点变成图标。
 *     实测过的反面教材：集合名叫 mc 时 `.mc-close` 会被写成图标规则，alert 的关闭按钮直接废。
 *     （外层包装类不算：`.mc-loader` 包着 `.mc-icon-spinner` 是合法且推荐的写法。）
 */

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const packagesDir = resolve(ROOT, 'packages');
const scanFiles = [packagesDir, resolve(ROOT, 'docs')]
  .flatMap((dir) => walk(dir))
  .filter((f) => /\.(html|mjs|js)$/.test(f));

const referenced = new Map();
const noteRef = (cls, file) => {
  if (!/^mc-icon-[a-z0-9-]+$/.test(cls)) return;
  if (!referenced.has(cls)) referenced.set(cls, new Set());
  referenced.get(cls).add(relative(ROOT, file));
};
for (const file of scanFiles) {
  const text = readFileSync(file, 'utf8');
  /* 只认「真的当类名用」的地方：class="…" 里的整词，或引号包起来的整串。
     刻意不扫裸文本 —— @keyframes mc-icon-spin 这种动画名不是类名，不该被当成图标引用。 */
  for (const attr of text.matchAll(/class="([^"]*)"/g)) {
    for (const token of attr[1].split(/\s+/)) noteRef(token, file);
  }
  for (const quoted of text.matchAll(/['"`](mc-icon-[a-z0-9-]+)['"`]/g)) noteRef(quoted[1], file);
}

const unknownRefs = [...referenced].filter(([cls]) => !(cls.slice('mc-icon-'.length) in icons));
if (unknownRefs.length) {
  fail([
    ...unknownRefs.map(
      ([cls, files]) => `引用了不存在的内置图标 ${cls}（${[...files].join(' ')}）`,
    ),
    '要么改 tools/icon-manifest.mjs 里的名字，要么改引用处',
  ]);
}

const styledInComponents = new Map();
for (const file of walk(packagesDir).filter((f) => f.endsWith('.html'))) {
  const text = readFileSync(file, 'utf8');
  for (const block of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const sel of block[1].matchAll(/\.(mc-icon-[a-z0-9-]+)/g)) {
      if (!styledInComponents.has(sel[1])) styledInComponents.set(sel[1], new Set());
      styledInComponents.get(sel[1]).add(relative(ROOT, file));
    }
  }
}

const styledClashes = [...styledInComponents].filter(
  ([cls]) => cls.slice('mc-icon-'.length) in icons,
);
if (styledClashes.length) {
  fail([
    ...styledClashes.map(
      ([cls, files]) => `组件样式占用了内置图标类名 ${cls}（${[...files].join(' ')}）`,
    ),
    '组件的内部类请换个名字',
  ]);
}

/* ---------- 写出产物 ---------- */

const srcInfo = sets.get(ICON_SOURCE).info;
const collectionTs = `/* 由 tools/gen-icons.mjs 生成 —— 勿手改；清单在 tools/icon-manifest.mjs。
 *
 * 这份数据只被 uno.config.ts 在构建期读取（presetIcons 把它编译进 packages/boot/mosaic.css）。
 * 运行时从不请求它 —— 组件靠 CSS 类名 \`mc-icon-<名字>\` 命中本地图标。
 *
 * 上游：${srcInfo.name} · ${srcInfo.license?.title ?? '?'}（${srcInfo.license?.spdx ?? '?'}）
 * 署名与来源见同目录的 icons.license.txt。
 */

/** 单个图标的图形数据（Iconify 的 IconifyIcon 形状，transforms 已由 getIconData 解析） */
export type IconifyIconData = {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  rotate?: number;
  hFlip?: boolean;
  vFlip?: boolean;
};

export type MosaicIconSet = {
  prefix: string;
  width: number;
  height: number;
  icons: Record<string, IconifyIconData>;
};

const iconSet: MosaicIconSet = {
  prefix: 'icon',
  width: ${sets.get(ICON_SOURCE).data.width ?? 24},
  height: ${sets.get(ICON_SOURCE).data.height ?? 24},
  icons: {
${Object.entries(icons)
  .map(([name, data]) => `    ${JSON.stringify(name)}: ${JSON.stringify(data)},`)
  .join('\n')}
  },
};

export default iconSet;
`;

const licenseLines = [
  'Mosaic 内置图标 —— 来源与许可',
  '',
  '本文件由 tools/gen-icons.mjs 生成，随清单变化。',
  `内置图标数：${Object.keys(icons).length}`,
  '',
];
for (const [set, { info }] of sets) {
  const license = info.license ?? {};
  const count = Object.values(ICONS).filter((s) => s.startsWith(`${set}:`)).length;
  licenseLines.push(
    `${info.name}（Iconify 集名：${set}）`,
    `  许可：${license.title ?? '?'}${license.spdx ? `（${license.spdx}）` : ''}`,
    `  来源：${license.url ?? info.author?.url ?? '（上游未提供 URL）'}`,
    `  作者：${info.author?.name ?? '（上游未提供）'}`,
    `  本仓库内置其中 ${count} 个图标的图形数据（清单见 tools/icon-manifest.mjs）`,
    '',
  );
}
licenseLines.push(
  '说明：图形数据以 Iconify 的 JSON 格式原样取自上述图标集（尺寸、描边、填充都未改动）。',
  '署名：以上许可均不要求在界面上署名；本文件即为版权声明的留存位置，随仓库一起提交。',
  '',
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'icons.generated.ts'), collectionTs);
writeFileSync(resolve(OUT_DIR, 'icons.license.txt'), licenseLines.join('\n'));
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
console.log(
  `\n[mosaic] 内置图标：${Object.keys(icons).length} 个 · 来源 ${usedSets.join(' + ')}\n` +
    `         packages/icon/icons.generated.ts  ${kb(collectionTs)}\n` +
    `         packages/icon/icons.license.txt   ${kb(licenseLines.join('\n'))}\n`,
);
