#!/usr/bin/env node
/**
 * 页面注册表生成器：扫 pages/**\/*.html 第一行的元信息，产出根目录的 pages.registry.js。
 *
 * 页面元信息是**唯一手写源**（写在页面第一行，改页面时顺手改它）：
 *   <!-- page: {"label":"风险列表","group":"风险","order":20} -->
 * 外壳的菜单 / 标题、check:app 的页面存在性都从生成物读，任何人都不许手改注册表。
 *
 * 用法：
 *   node mosaic-admin/tools/page-registry.mjs          生成 / 覆盖注册表
 *   node mosaic-admin/tools/page-registry.mjs --check  只对账；过期退出 1（check:app 复用 build()）
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** mosaic-admin/ */
export const ADMIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PAGES_DIR = join(ADMIN_ROOT, 'pages');
export const REGISTRY_FILE = join(ADMIN_ROOT, 'pages.registry.js');

/** 页面第一行的元信息：整行一条注释，JSON 文本（生成器不猜格式） */
const META_LINE = /^<!--\s*page:\s*(\{.*\})\s*-->$/;

/** @type {string[]} */
const problems = [];

const toPosix = (path) => path.split(sep).join('/');

async function walkPages(dir) {
  /** @type {string[]} */
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => {
    throw new Error(`找不到页面目录：${dir}`);
  });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkPages(full)));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

/**
 * 读一份页面并解析元信息。
 * @param {string} full 绝对路径
 */
async function readPage(full) {
  const rel = toPosix(relative(ADMIN_ROOT, full));
  const lines = (await readFile(full, 'utf8')).split(/\r?\n/);
  const first = lines.find((line) => line.trim() !== '') ?? '';
  const matched = first.trim().match(META_LINE);
  if (!matched) {
    problems.push(
      `${rel}：第一行必须是 <!-- page: {"label":"…","group":"…","order":0} -->（当前首行：${first.trim() || '(空)'}）`,
    );
    return null;
  }

  let meta;
  try {
    meta = JSON.parse(matched[1]);
  } catch (error) {
    problems.push(`${rel}：元信息不是合法 JSON —— ${error.message}`);
    return null;
  }

  const label = typeof meta.label === 'string' ? meta.label.trim() : '';
  const group = typeof meta.group === 'string' ? meta.group.trim() : '';
  const order = Number(meta.order);

  if (!label) problems.push(`${rel}：元信息缺 label（菜单 / 标题要显示的名字）`);
  if (!group) problems.push(`${rel}：元信息缺 group（菜单分组名）`);
  if (!Number.isFinite(order)) problems.push(`${rel}：元信息缺 order（同组内的排序数字）`);
  if (!label || !group || !Number.isFinite(order)) return null;

  return { file: rel, label, group, order, hidden: meta.hidden === true };
}

/**
 * 扫页面 + 生成注册表源码。返回 { source, pages, menu, problems }。
 * 有 problems 时 source 仍然给出（便于一次性打印全部问题），调用方决定是否写盘。
 */
export async function build() {
  problems.length = 0;
  const fulls = await walkPages(PAGES_DIR);

  /** @type {{file: string, label: string, group: string, order: number}[]} */
  const pages = [];
  for (const full of fulls) {
    const page = await readPage(full);
    if (page) pages.push(page);
  }

  pages.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));

  /* 菜单：分组按「组内最小 order」排，组内按 order + 文件名排。
     每个分组是一条 type:'group' + children 的折叠/常显组（mc-menu 的既有形状）。 */
  /** @type {{group: string, order: number, children: {key: string, label: string, href: string}[]}[]} */
  const groups = [];
  for (const page of pages) {
    if (page.hidden) continue; // 隐藏页（登录 / 详情等）注册路由、不进菜单
    let bucket = groups.find((item) => item.group === page.group);
    if (!bucket) {
      bucket = { group: page.group, order: page.order, children: [] };
      groups.push(bucket);
    }
    bucket.order = Math.min(bucket.order, page.order);
    /* href 用 hash：应用自己路由（o-router 已不在链路里），菜单点它是原生锚点、只改地址栏 */
    bucket.children.push({ key: page.file, label: page.label, href: '#/' + page.file });
  }
  groups.sort((a, b) => a.order - b.order || a.group.localeCompare(b.group));

  const menu = groups.map((bucket) => ({
    key: `group:${bucket.group}`,
    type: 'group',
    label: bucket.group,
    children: bucket.children,
  }));

  const source = [
    '// 生成物，勿手改：node mosaic-admin/tools/page-registry.mjs',
    '// 页面清单的唯一手写源是 pages/**/*.html 第一行的 <!-- page: {...} --> 元信息；',
    '// check:app 会重生成并逐字节对账 —— 注册表过期直接失败。',
    '',
    `export const PAGES = ${JSON.stringify(pages, null, 2)};`,
    '',
    `export const MENU = ${JSON.stringify(menu, null, 2)};`,
    '',
  ].join('\n');

  return { source, pages, menu, problems: [...problems] };
}

/** 运行 check：返回 { ok, messages }，不改盘 */
export async function check() {
  const result = await build();
  const messages = [...result.problems];

  let actual = '';
  try {
    actual = await readFile(REGISTRY_FILE, 'utf8');
  } catch {
    messages.push('缺 pages.registry.js：跑一次 node mosaic-admin/tools/page-registry.mjs。');
    return { ok: false, messages, result };
  }

  if (actual !== result.source) {
    messages.push(
      'pages.registry.js 与页面元信息不一致（生成物过期）：重跑 node mosaic-admin/tools/page-registry.mjs。',
    );
  }

  return { ok: messages.length === 0, messages, result };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    const status = await check();
    if (status.ok) {
      console.log(
        `页面注册表 ✓（${status.result.pages.length} 页 / ${status.result.menu.length} 组）`,
      );
    } else {
      for (const message of status.messages) console.error(message);
      process.exitCode = 1;
    }
  } else {
    const result = await build();
    if (result.problems.length) {
      for (const message of result.problems) console.error(message);
      process.exitCode = 1;
    } else {
      await writeFile(REGISTRY_FILE, result.source, 'utf8');
      console.log(
        `页面注册表已生成：${result.pages.length} 页 / ${result.menu.length} 组 → pages.registry.js`,
      );
    }
  }
}
