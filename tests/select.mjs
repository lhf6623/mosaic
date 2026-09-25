/**
 * 选测中间层：**改动 → 该跑哪些套件**（不是「全量」也不是「手工挑」）。
 *
 * 两层判断，先精确后兜底：
 *
 *   ① 依赖地图 `tests/suite-map.json`（`pnpm test:record` 录制，提交进仓库）
 *      记的是**每个套件实际请求过的仓库文件**。精确命中，而且由数据说话 ——
 *      改 `docs/layout.html` 会命中所有加载过它的套件，不需要谁手工维护一张表。
 *
 *   ② 兜底策略（下面的 FALLBACK 一节）：地图里没有的文件 —— 新文件、构建配置、纯文档。
 *      原则是**宁可多跑不可漏跑**：判断不了的路径按「影响全部」处理，并把原因打出来。
 *
 * 为什么不做成一张手写的 glob 表：手写的表一定会和实现漂移（仓库自己的 agent/ 文档里
 * 反复强调这条），而「实际请求过什么」是测出来的事实，不会撒谎。兜底策略只管地图管不到的部分。
 *
 * CLI：
 *   node tests/select.mjs                                    # 工作区改动（含未跟踪文件）
 *   node tests/select.mjs --changed origin/main              # 与某个 ref 比
 *   node tests/select.mjs packages/tag/tag.html docs/x.html  # 直接给文件
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allSuites } from './lib/suites.mjs';

/** 依赖地图的位置（提交进仓库；只有 --record 会写它） */
export const MAP_FILE = new URL('./suite-map.json', import.meta.url);

export const repoRoot = () => fileURLToPath(new URL('../', import.meta.url));

export function loadMap() {
  try {
    return JSON.parse(readFileSync(MAP_FILE, 'utf8'));
  } catch {
    return null; // 还没录制过：调用方按「全部都不在图里」处理 → 总是跑全部
  }
}

export function saveMap(map) {
  writeFileSync(MAP_FILE, `${JSON.stringify(map, null, 2)}\n`);
}

/**
 * 工作区 / 某个 ref 的改动清单（仓库相对路径，含未跟踪文件）。
 * 取不到（不是 git 仓库、ref 不存在）返回 null —— 调用方退回全量，绝不静默少跑。
 */
export function changedFiles(ref = 'HEAD') {
  const git = (args) => execFileSync('git', args, { cwd: repoRoot(), encoding: 'utf8' });
  try {
    const diff = git(['diff', '--name-only', ref]).split('\n');
    const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n');
    return [...new Set([...diff, ...untracked].map((s) => s.trim()).filter(Boolean))];
  } catch {
    return null;
  }
}

/** 归一成仓库相对路径：绝对路径、`./` 前缀、反斜杠都收拾掉 */
export function normalizePath(file) {
  let path = String(file).trim().replace(/\\/g, '/');
  const root = repoRoot();
  if (path.startsWith(root)) path = path.slice(root.length);
  return path.replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * 套件文件的**静态 import 闭包**（只跟相对路径，递归）。
 *
 * 为什么需要它：node-only 套件（10 / 11 / 12）不请求 HTTP，它们 `import` 的
 * `docs/site-map.js` / `select.mjs` 在录制时**看不见** —— 于是「改了 site-map.js」
 * 会漏掉正是守 site-map 结构的 10 号。这条洞补在录制侧（smoke.mjs --record 会把
 * 闭包一起写进地图），选择侧就不用为它加特例。
 */
export function importClosure(entryPath, { only = true } = {}) {
  const root = repoRoot();
  const seen = new Set();
  const out = new Set();

  /** 相对说明符 → 真实文件（补 .js/.mjs/index.js 这几种写法） */
  const resolve = (dir, spec) => {
    const base = posix.normalize(posix.join(dir, spec));
    if (base.startsWith('..')) return null; // 别爬出仓库
    for (const candidate of [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`]) {
      try {
        if (statSync(join(root, candidate)).isFile()) return candidate;
      } catch {
        /* 试下一个 */
      }
    }
    return null;
  };

  const visit = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    let text;
    try {
      text = readFileSync(join(root, rel), 'utf8');
    } catch {
      return;
    }
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    const specs = [
      // import … from './x' / export … from './x' —— 说明符与 from 可能隔着好几行（格式化后的多行 import）
      ...text.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"](\.[^'"]+)['"]/g),
      // 副作用导入：import './x'
      ...text.matchAll(/(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g),
    ];
    for (const match of specs) {
      const resolved = resolve(dir, match[1]);
      if (!resolved) continue;
      out.add(resolved);
      visit(resolved);
    }
  };

  if (only) visit(entryPath);
  return [...out];
}

/* ------------------------------------------------------------------ *
 * ② 兜底策略：地图没精确命中时按路径判。返回 { suites } / { all } / { none } + 理由
 * ------------------------------------------------------------------ */

function fallback(file, suites, byFile) {
  // 测试基础设施：改了基座 / 跑器 / 地图本身，任何套件都可能受影响
  if (/^tests\/(lib\/|smoke\.mjs$|select\.mjs$|suite-map\.json$)/.test(file)) {
    return { all: true, why: '测试基础设施 → 全部' };
  }

  // 套件文件自身：只跑它
  const own = suites.find((s) => s.path === file);
  if (own) return { suites: [own.path], why: '套件文件自身' };

  // 组件目录下的文件：该组件的套件 + 地图里碰过这个目录的套件
  // （新加的 demo / 片段没在地图里，但 05 这样的套件早就碰过 packages/<slug>/）
  const comp = /^packages\/([\w-]+)\//.exec(file);
  if (comp) {
    const dir = `packages/${comp[1]}/`;
    const touched = new Set();
    for (const [known, list] of Object.entries(byFile)) {
      if (known.startsWith(dir)) for (const path of list) touched.add(path);
    }
    const owner = suites.find((s) => s.path === `packages/${comp[1]}/test/${comp[1]}.test.mjs`);
    if (owner) touched.add(owner.path);
    if (touched.size) {
      return { suites: [...touched], why: `组件目录 packages/${comp[1]}/ 的新文件 → 碰过它的套件` };
    }
    return { all: true, why: `packages/${comp[1]}/ 还没被任何套件碰过（新组件？）→ 全部` };
  }

  // 共享面：构建配置、运行时、令牌、文档站（外壳 / 布局 / 页面 / 内容样式）
  if (/^(uno\.config\.ts|tsconfig\.json|package\.json|index\.html|app-config\.js|tools\/|docs\/)/.test(file)) {
    return { all: true, why: '共享面（构建 / 运行时 / 文档站）→ 全部' };
  }

  // 纯文档与仓库配置：跑不了浏览器，也不影响运行
  if (/^(README\.md|agent\/|\.)/.test(file)) return { none: true, why: '纯文档 / 仓库配置 → 不跑' };

  // 其余未知：保守跑全部（宁可多跑不可漏跑）
  return { all: true, why: '地图里没有、也不在已知面 → 保守跑全部' };
}

/* ------------------------------------------------------------------ *
 * 选择
 * ------------------------------------------------------------------ */

/**
 * @param {object}   input
 * @param {string[]} input.changed  改动文件（仓库相对路径；normalizePath 会兜一层）
 * @param {object[]} [input.suites] 套件清单，默认 allSuites()
 * @param {object}   [input.map]    依赖地图，默认读 tests/suite-map.json
 * @returns {{ selected: string[], skipped: string[], notes: object[], full: boolean }}
 */
/**
 * 无论怎么改都跑的套件：它们断言的是「全仓的静态事实」（fs 扫 docs/ 与 packages/），
 * import 不到、HTTP 也录不到，静态推不出来 —— 而代价趋近 0（node-only）。
 * 漏了它们等于漏掉那类守卫，所以宁可跑。
 */
const ALWAYS_RUN = new Set(['tests/site/11-no-class-components.mjs']);

export function selectSuites({ changed, suites = allSuites(), map = loadMap() }) {
  const paths = suites.map((s) => s.path);
  const byFile = map?.byFile ?? {};
  const notes = [];
  const keep = new Set();
  let full = false;

  for (const raw of changed ?? []) {
    const file = normalizePath(raw);
    if (!file) continue;

    const exact = byFile[file];
    if (exact?.length) {
      for (const path of exact) keep.add(path);
      notes.push({ file, suites: exact, why: '依赖地图精确命中' });
      continue;
    }

    const hit = fallback(file, suites, byFile);
    if (hit.all) {
      full = true;
      notes.push({ file, suites: 'all', why: hit.why });
    } else if (hit.none) {
      notes.push({ file, suites: 'none', why: hit.why });
    } else {
      for (const path of hit.suites) keep.add(path);
      notes.push({ file, suites: hit.suites, why: hit.why });
    }
  }

  /* 地图里没有条目的套件（新加的、还没录制）：--changed 下**总是跑** ——
     否则一次过期的录制会让新套件永远被跳过（这是这套机制唯一危险的失效方向）。 */
  if (map) {
    for (const suite of suites) {
      if (map.suites?.[suite.path]) continue;
      keep.add(suite.path);
      notes.push({
        file: suite.path,
        suites: [suite.path],
        why: '不在依赖地图里 → 总是跑（pnpm test:record 补上）',
      });
    }
  } else if (changed?.length) {
    full = true; // 地图都没有：无从判断，全量
    notes.push({ file: '(依赖地图缺失)', suites: 'all', why: 'tests/suite-map.json 不存在 → 全部' });
  }

  for (const path of ALWAYS_RUN) {
    if (paths.includes(path) && !keep.has(path)) {
      keep.add(path);
      notes.push({ file: path, suites: [path], why: '扫描全仓的静态守卫 → 总是跑' });
    }
  }

  const selected = full ? paths : paths.filter((path) => keep.has(path));
  return { selected, skipped: paths.filter((path) => !selected.includes(path)), notes, full };
}

/* ------------------------------------------------------------------ *
 * CLI：只打印「该跑哪些」，不启动浏览器（跑由 tests/smoke.mjs --changed 负责）
 * ------------------------------------------------------------------ */

function main() {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--changed');

  let changed;
  if (at > -1) {
    const ref = argv[at + 1] && !argv[at + 1].startsWith('-') ? argv[at + 1] : 'HEAD';
    changed = changedFiles(ref);
    if (!changed) {
      console.log(`取不到 git 改动（ref=${ref}）→ 全量`);
      changed = [];
    }
  } else if (argv.length) {
    changed = argv.filter((a) => !a.startsWith('-'));
  } else {
    changed = changedFiles('HEAD') ?? [];
  }

  const suites = allSuites();
  const byPath = new Map(suites.map((s) => [s.path, s]));
  const { selected, notes, full } = selectSuites({ changed, suites });

  console.log(
    `\n改动 ${changed.length} 个文件 → 命中 ${selected.length}/${suites.length} 个套件` +
      (full ? '（共享面 → 全部）' : '') +
      '\n',
  );
  for (const note of notes) {
    const picked = note.suites === 'all' || note.suites === 'none' ? note.suites : note.suites.map((p) => byPath.get(p)?.label ?? p).join(' / ');
    console.log(`  ${note.file}\n      → ${note.why}${picked === 'all' || picked === 'none' ? '' : `：${picked}`}`);
  }

  console.log('\n要跑的套件：');
  for (const path of selected) console.log(`  ✓ ${byPath.get(path)?.label ?? path}`);
  if (selected.length < suites.length) {
    console.log(`\n跳过 ${suites.length - selected.length} 个：${suites.filter((s) => !selected.includes(s.path)).map((s) => s.label).join(' · ')}`);
  }
  console.log();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
