#!/usr/bin/env node
/**
 * mosaic — 内置图标生成器：清单 + 上游图标数据 → 三份提交进仓库的产物：icons.generated.ts（运行时数据源，
 * mc-icon 按名查它、从不发请求）、icons.generated.css（每条一个 data-URI mask，类名 mc-icon-<名字>）、
 * icons.license.txt（来源与许可）。三条守卫都是「缺输入必须大声失败」，而且是**构建期**就红：
 * ① 上游名必须真的存在（含别名解析）；② license.spdx 必须在白名单里（GPL / CC-BY-NC / 需署名的 CC-BY 进不来）；
 * ③ 生成的类名不能和组件已有的类名撞车。
 * 用法：node tools/gen-icons.mjs（通常经 `pnpm icons`；`pnpm build` 里排在 tokens 之前）
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

/* ---------- 2. 逐条解析：上游名 → 图形数据（getIconData 解析别名与 rotate/hFlip 变换） ---------- */

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

/* ---------- 3. 类名守卫：图标类名和组件内部类名同处一个全局命名空间（mosaic.css 进使用者页面）----
 * 组件里写死的 `mc-icon-x` 必须在清单里（上游改名要在**构建期**炸）；组件自己的 <style> 里也不许出现
 * 同名选择器 —— 那等于把内部节点变成图标（`.mc-close` 实测过）。外层包装类不算。 */

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
  /* 只认「真的当类名用」的地方：class="…" 里的整词或引号包起来的整串；刻意不扫裸文本（@keyframes 动画名不是类名） */
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
 * 运行时数据源：mc-icon 组件按名查它（本地查不到才走远程）。
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

/* ---------- 图标 CSS：每条一个 data-URI mask —— 唯一用途是让组件里的**静态**图标直接吃类名
 * （`<span class="mc-icon-spinner">`），零 JS、零字体、零请求；中转变量是 --mc-icon-uri。 */
const ICON_W = sets.get(ICON_SOURCE).data.width ?? 24;
const ICON_H = sets.get(ICON_SOURCE).data.height ?? 24;

/** data-URI 里 `<` `>` `#` 必须转义；属性引号换成单引号（外层 url() 用的是双引号） */
const encodeSvg = (svg) =>
  svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23').replace(/"/g, "'");

const iconRule = (name, data) => {
  const svg =
    `<svg viewBox='0 0 ${data.width ?? ICON_W} ${data.height ?? ICON_H}' display='inline-block'` +
    ` vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' >${data.body}</svg>`;
  return (
    `.mc-icon-${name}{--mc-icon-uri:url("data:image/svg+xml;utf8,${encodeSvg(svg)}");` +
    `-webkit-mask:var(--mc-icon-uri) no-repeat;mask:var(--mc-icon-uri) no-repeat;` +
    `-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;` +
    `display:inline-block;vertical-align:middle;width:1em;height:1em;}`
  );
};

const iconCss = `/* 由 tools/gen-icons.mjs 生成 —— 勿手改；清单在 tools/icon-manifest.mjs。
 *
 * 内置图标的 CSS：每条一个 data-URI mask。类名 \`mc-icon-<名字>\`，盒子恒为 1em、颜色走
 * currentColor —— 尺寸交给 font-size、颜色跟随文字（组件里的静态图标就靠这个，零请求）。
 * ⚠️ \`--mc-icon-uri\` 是**生成出来的 mask 源**，不是可换肤的组件令牌，别在主题里覆盖它。
 *
 * 上游：${srcInfo.name} · ${srcInfo.license?.title ?? '?'}（${srcInfo.license?.spdx ?? '?'}）
 * 署名与来源见同目录的 icons.license.txt；由 tools/build-css.mjs 装配进 packages/boot/mosaic.css
 * 的 mosaic.icons 层（层顺序见 packages/color/tokens.css）。
 * ========================================================================== */

@layer mosaic.icons {
${Object.entries(icons)
  .map(([name, data]) => iconRule(name, data))
  .join('\n')}
}
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'icons.generated.ts'), collectionTs);
writeFileSync(resolve(OUT_DIR, 'icons.generated.css'), iconCss);
writeFileSync(resolve(OUT_DIR, 'icons.license.txt'), licenseLines.join('\n'));
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
console.log(
  `\n[mosaic] 内置图标：${Object.keys(icons).length} 个 · 来源 ${usedSets.join(' + ')}\n` +
    `         packages/icon/icons.generated.ts   ${kb(collectionTs)}\n` +
    `         packages/icon/icons.generated.css  ${kb(iconCss)}\n` +
    `         packages/icon/icons.license.txt    ${kb(licenseLines.join('\n'))}\n`,
);
