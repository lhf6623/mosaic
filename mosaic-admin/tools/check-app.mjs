#!/usr/bin/env node
/**
 * check:app —— mosaic-admin 的硬规则守卫（纯静态，不起浏览器）。
 *
 * 守的是 docs/plan-collaboration.md §2 / mosaic-admin/AGENTS.md 的八条硬规则里可静态判定的部分：
 *   1. 库只经 vendor/mosaic 引用（不许 ../packages/、docs/、组件内部 .js），引用路径必须存在；
 *   2. 库（packages/ docs/ tools/ tests/）不许反向引用 mosaic-admin/；
 *   3. 页面 ≤ 120 行、第一行有元信息、parent 指向 shell/layout.html、不直接 fetch；
 *   8. 页面注册表可重生成且必须新鲜；app-config 的 home 必须是已注册页面；
 * 外加 vendor/mosaic 链接状态（复用 link-vendor.mjs 的检查）。
 *
 * 只看**引用值**（src / href / import / parent / home），不扫正文与注释里的路径文字 ——
 * 注释里提一句 ../packages/ 做反例说明不该报错，真正要拦的是会发请求 / 会解析模块的那些值。
 *
 * 用法：node mosaic-admin/tools/check-app.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_ROOT, check as checkLink } from './link-vendor.mjs';
import { check as checkRegistry, PAGES_DIR, REGISTRY_FILE } from './page-registry.mjs';

const REPO_ROOT = resolve(ADMIN_ROOT, '..');
/** mosaic-admin 自己的 docs（方案 / 契约），页面引用它不算越界 */
const ADMIN_DOCS = join(ADMIN_ROOT, 'docs');

/** 应用里“可以被引用”的库文件只有两种形状（硬规则 1） */
const ALLOWED_IN_VENDOR = [/^boot\/mosaic\.css$/, /^[a-z0-9-]+\/[a-z0-9-]+\.html$/];

/** 只扫运行期代码；admin 自己的 docs/*.md 不参与路径边界 */
const RUNTIME_DIRS = ['shell', 'pages', 'components', 'shared', 'styles', 'spikes'];
const RUNTIME_FILES = ['index.html', 'config.js'];
const CODE_EXT = /\.(html?|m?js|css)$/i;

/** 引用值：HTML 属性 / ESM 说明符 / 页面 parent / app-config home */
const REF_ATTR = /\b(?:src|href)\s*=\s*(["'])([^"']+)\1/gi;
const REF_IMPORT = /\bfrom\s+(["'])([^"']+)\1|\bimport\s*\(\s*(["'])([^"']+)\3\s*\)/g;
const REF_PARENT = /\bparent\s*=\s*(["'])([^"']+)\1/g;
const REF_HOME = /\bhome\s*=\s*(["'])([^"']+)\1/g;
/** 非请求 / 非模块的协议值 */
const SKIP_SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

const toPosix = (path) => path.split(sep).join('/');
const errors = [];
const fail = (message) => errors.push(message);

const isFile = (path) =>
  stat(path).then(
    (info) => info.isFile(),
    () => false,
  );

async function walkFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(full, out);
    else if (CODE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

/** 从一份文件里抠出所有“会被解析成路径”的值 */
function refsOf(text, rel) {
  const refs = [];
  for (const match of text.matchAll(REF_ATTR)) refs.push({ value: match[2], kind: 'attr' });
  for (const match of text.matchAll(REF_IMPORT)) {
    refs.push({ value: match[2] ?? match[4], kind: 'import' });
  }
  if (rel.endsWith('.html')) {
    const isPage = rel.startsWith('pages/');
    if (isPage)
      for (const match of text.matchAll(REF_PARENT)) refs.push({ value: match[2], kind: 'parent' });
  }
  if (rel === 'app-config.js') {
    for (const match of text.matchAll(REF_HOME)) refs.push({ value: match[2], kind: 'home' });
  }
  return refs;
}

/* ------------------------------------------------------------------ *
 * 1. 路径边界：库只经 vendor/mosaic，引用必须存在
 * ------------------------------------------------------------------ */

async function scanPaths() {
  const files = [...RUNTIME_FILES.map((name) => join(ADMIN_ROOT, name))];
  for (const dir of RUNTIME_DIRS) files.push(...(await walkFiles(join(ADMIN_ROOT, dir))));

  for (const file of files) {
    const rel = toPosix(relative(ADMIN_ROOT, file));
    if (!(await isFile(file))) {
      fail(`缺文件：${rel}`);
      continue;
    }

    const text = await readFile(file, 'utf8');
    for (const ref of refsOf(text, rel)) {
      const token = ref.value.trim();
      if (!token || SKIP_SCHEME.test(token)) continue;

      /* 只关心“看起来是路径”的值：查询串 / 纯锚点 / 单段文案留给浏览器 */
      if (!token.includes('/') && !/\.(?:html?|m?js|css|svg|json|woff2?)$/i.test(token)) continue;

      const target = resolve(dirname(file), token.replace(/[?#].*$/, ''));
      const targetRel = toPosix(relative(ADMIN_ROOT, target));

      if (targetRel.startsWith('..')) {
        fail(`${rel}：越界引用「${token}」—— 库只能经 vendor/mosaic 引用（硬规则 1）`);
        continue;
      }

      if (targetRel.startsWith('vendor/mosaic/')) {
        if (!(await isFile(target))) {
          fail(`${rel}：引用的库文件不存在 —— ${targetRel}`);
          continue;
        }
        const inside = targetRel.slice('vendor/mosaic/'.length);
        if (!ALLOWED_IN_VENDOR.some((pattern) => pattern.test(inside))) {
          fail(
            `${rel}：${targetRel} 不是对外入口 —— 只认 vendor/mosaic/<slug>/<slug>.html 与 vendor/mosaic/boot/mosaic.css`,
          );
        }
        continue;
      }

      if (targetRel.startsWith('vendor/lib/')) {
        if (!(await isFile(target))) fail(`${rel}：引用的 vendor/lib 文件不存在 —— ${targetRel}`);
        continue;
      }

      if (!(await isFile(target))) {
        fail(`${rel}：引用的文件不存在 —— ${targetRel || '(mosaic-admin 根)'}`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 1.5 按钮级权限：权限码只在 shared/perm.js 定义，页面 / 外壳 / 组件里不许写业务码字面量
 * ------------------------------------------------------------------ */

/** 业务权限码的形状：\`域:动作\`（域是业务词；自定义事件名 / 图标名不会长这样） */
const PERM_LITERAL = /['"](?:risk|import|order|finance|base|system):[a-z][a-z0-9-]*['"]/g;

async function scanPermissionLiterals() {
  const roots = ['pages', 'shell', 'components'].map((name) => join(ADMIN_ROOT, name));
  const files = [];
  for (const root of roots) files.push(...(await walkFiles(root)));

  for (const file of files) {
    const rel = toPosix(relative(ADMIN_ROOT, file));
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(PERM_LITERAL)) {
      fail(
        `${rel}：出现了权限码字面量 ${match[0]} —— 权限码只在 shared/perm.js 定义，页面引用 PERM 常量`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 2. 库不许反向引用应用
 * ------------------------------------------------------------------ */

async function scanReverseImports() {
  const roots = ['packages', 'docs', 'tools', 'tests'].map((name) => join(REPO_ROOT, name));
  const skip = new Set(['node_modules', '.git', '.workbuddy']);
  for (const root of roots) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const stack = entries.map((entry) => join(root, entry.name));
    while (stack.length) {
      const current = stack.pop();
      const info = await stat(current).catch(() => null);
      if (!info) continue;
      if (info.isDirectory()) {
        if (skip.has(current.split(sep).pop())) continue;
        const children = await readdir(current, { withFileTypes: true });
        for (const child of children) stack.push(join(current, child.name));
        continue;
      }
      if (!CODE_EXT.test(current) && !current.endsWith('.md') && !current.endsWith('.json'))
        continue;
      const text = await readFile(current, 'utf8').catch(() => '');
      if (text.includes('mosaic-admin')) {
        fail(
          `${toPosix(relative(REPO_ROOT, current))}：库 / 站点 / 库工具里出现了 mosaic-admin 引用（硬规则 2）`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 3. 页面规则
 * ------------------------------------------------------------------ */

async function walkPages(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walkPages(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const MAX_PAGE_LINES = 120;
const META_LINE = /^<!--\s*page:\s*(\{.*\})\s*-->$/;

async function scanPages() {
  const pages = await walkPages(PAGES_DIR);
  if (!pages.length) fail('pages/ 下没有任何页面');

  for (const file of pages) {
    const rel = toPosix(relative(ADMIN_ROOT, file));
    const text = await readFile(file, 'utf8');
    const lines = text.split(/\r?\n/);
    if (lines.length > MAX_PAGE_LINES) {
      fail(
        `${rel}：${lines.length} 行，超过 ${MAX_PAGE_LINES} 行上限（页面只接线，逻辑下沉 shared / components）`,
      );
    }

    const first = lines.find((line) => line.trim() !== '')?.trim() ?? '';
    const matched = first.match(META_LINE);
    if (!matched) {
      fail(`${rel}：第一行缺元信息 <!-- page: {"label":"…","group":"…","order":0} -->`);
    } else {
      try {
        const meta = JSON.parse(matched[1]);
        for (const key of ['label', 'group']) {
          if (typeof meta[key] !== 'string' || !meta[key].trim()) fail(`${rel}：元信息缺 ${key}`);
        }
        if (!Number.isFinite(Number(meta.order))) fail(`${rel}：元信息缺 order`);
      } catch (error) {
        fail(`${rel}：元信息不是合法 JSON —— ${error.message}`);
      }
    }

    /* G2 起外壳改成「常驻 o-page + 自建 hash 路由」，页面不再挂 parent（挂了会被 ofa 包一层已删除的 layout） */
    if (/export\s+const\s+parent\s*=/.test(text)) {
      fail(`${rel}：页面不要再 export const parent —— 外壳是常驻 o-page，页面无父页面`);
    }

    if (/\bPERM\./.test(text) && !/from\s+['"][^'"]*shared\/perm\.js['"]/.test(text)) {
      fail(`${rel}：用了 PERM.* 权限码却没从 shared/perm.js 导入`);
    }

    if (/\bolink\b/.test(text)) {
      fail(`${rel}：页面不许写 olink —— 应用自己管路由（站内链接写 href="#/pages/…"）`);
    }

    if (/\bfetch\s*\(|XMLHttpRequest|\baxios\b/.test(text)) {
      fail(`${rel}：页面里不许直接发请求（请求走 shared/http，硬规则 3）`);
    }
  }

  return pages.length;
}

/* ------------------------------------------------------------------ *
 * 4. 注册表 / 入口
 * ------------------------------------------------------------------ */

async function scanRegistry() {
  const registry = await checkRegistry();
  for (const message of registry.messages) fail(message);
  if (!registry.result) return null;

  if (!(await isFile(REGISTRY_FILE))) fail('缺 pages.registry.js');

  const homePath = 'pages/home.html';
  if (!(await isFile(join(ADMIN_ROOT, homePath)))) fail(`首页不存在：${homePath}`);
  else if (!registry.result.pages.some((page) => page.file === homePath)) {
    fail(`首页没进注册表：${homePath}`);
  }

  /* 菜单 href 必须是应用自己的 hash 路由（原生锚点只改地址栏，不再走 o-router） */
  for (const group of registry.result.menu) {
    for (const child of group.children) {
      if (!child.href.startsWith('#/')) {
        fail(`注册表菜单项 href 不是 hash 路由：${child.href}（应形如 #/pages/…）`);
      }
    }
  }

  const index = await readFile(join(ADMIN_ROOT, 'index.html'), 'utf8').catch(() => '');
  if (!/<admin-shell[\s>]/.test(index)) fail('index.html 缺 <admin-shell>（应用外壳）');
  if (!/<l-m\s+src="\.\/shell\/admin-shell\.html"/.test(index)) {
    fail('index.html 缺 <l-m src="./shell/admin-shell.html">（外壳没注册）');
  }
  if (/<o-app[\s>]|<o-router[\s>]/.test(index)) {
    fail('index.html 里不许有 <o-app> / <o-router>（o-app 换 leaf 会销毁多标签页状态）');
  }

  return registry.result;
}

/* ------------------------------------------------------------------ */

const link = await checkLink();
for (const message of link.messages) fail(message);

await scanPaths();
await scanPermissionLiterals();
await scanReverseImports();
const pageCount = await scanPages();
const registry = await scanRegistry();

if (errors.length) {
  console.error(`check:app 失败（${errors.length} 项）：`);
  for (const message of errors) console.error('  · ' + message);
  process.exitCode = 1;
} else {
  console.log(
    `check:app ✓（${pageCount} 页 / ${registry?.menu.length ?? 0} 组 / vendor ${link.mode === 'copy' ? '副本' : '链接'}）`,
  );
}
