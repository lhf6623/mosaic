/**
 * 站点 · 选测中间层（node-only）
 *
 * 守两件事，都是「不加浏览器、几毫秒」的静态账：
 *   ① 依赖地图（tests/suite-map.json）没有漏掉任何套件、也不认识不存在的套件 ——
 *      漏一个套件就会让它在新文件上被永远跳过，这是这套机制唯一的危险失效方向；
 *   ② 兜底策略（tests/select.mjs 的 FALLBACK）与文档里承诺的行为一致：
 *      共享面 → 全部、组件目录的新文件 → 碰过它的套件、纯文档 → 不跑、未知 → 保守全跑。
 *
 * `pnpm test:record` 正在重录地图时跳过 ①（那一刻地图一定是旧的）。
 */

import { READY, slugOf } from '../../docs/site-map.js';
import {
  changedFiles,
  loadMap,
  normalizePath,
  repoRoot,
  selectSuites,
} from '../select.mjs';
import { allSuites } from '../lib/suites.mjs';

export default async function run({ check }) {
  const suites = allSuites();
  const paths = suites.map((s) => s.path);
  const recording = process.env.MOSAIC_RECORD === '1';

  /* ------------------------------------------------------------------ *
   * ① 地图对账（录制中跳过）
   * ------------------------------------------------------------------ */

  const map = loadMap();
  if (recording) {
    check('录制模式：跳过地图新鲜度对账', true, 'MOSAIC_RECORD=1');
  } else {
    const missing = map ? paths.filter((p) => !map.suites?.[p]) : paths;
    check(
      `依赖地图覆盖每个套件（${paths.length} 个）`,
      !!map && missing.length === 0,
      missing.length
        ? `没录到：${missing.join(' / ')} —— 跑一次 pnpm test:record`
        : `${Object.keys(map.suites).length} 个套件 / ${Object.keys(map.byFile).length} 个文件`,
    );

    const known = new Set(paths);
    const ghost = map
      ? [...new Set(Object.values(map.byFile).flat())].filter((p) => !known.has(p))
      : [];
    check(
      '地图里的套件路径都真实存在（删套件后没留下幽灵条目）',
      ghost.length === 0,
      ghost.join(' / ') || '无',
    );

    const empty = map ? paths.filter((p) => !map.suites[p]?.length) : [];
    check(
      '每个套件在地图里都有碰过的文件（node-only 套件至少有它自己）',
      empty.length === 0,
      empty.join(' / ') || '无',
    );
  }

  /* ------------------------------------------------------------------ *
   * ② 真实地图上的关键命中：组件自己的文档页 → 该组件的套件
   * ------------------------------------------------------------------ */

  if (map && !recording) {
    const misses = READY.map((component) => {
      const slug = slugOf(component);
      const { selected } = selectSuites({ changed: [`packages/${slug}/page.html`], suites, map });
      return selected.includes(`packages/${slug}/test/${slug}.test.mjs`) ? null : slug;
    }).filter(Boolean);
    check(
      `改某个组件的文档页 → 至少命中它自己的套件（${READY.length} 个组件）`,
      misses.length === 0,
      misses.length ? `没命中：${misses.join(' / ')}` : '全部命中',
    );
  }

  /* ------------------------------------------------------------------ *
   * ③ 兜底策略：用一张合成地图把行为钉死（不依赖录制的具体内容）
   * ------------------------------------------------------------------ */

  const FAKE_SUITES = [
    { kind: 'site', label: '01', path: 'tests/site/01-load-shell.mjs' },
    { kind: 'site', label: '05', path: 'tests/site/05-doc-pages.mjs' },
    { kind: 'component', slug: 'tag', label: 'Tag', path: 'packages/tag/test/tag.test.mjs' },
  ];
  const FAKE_MAP = {
    version: 1,
    suites: {
      'tests/site/01-load-shell.mjs': ['docs/layout.html', 'packages/boot/mosaic.css'],
      'tests/site/05-doc-pages.mjs': ['packages/tag/page.html', 'docs/layout.html'],
      'packages/tag/test/tag.test.mjs': [
        'packages/tag/tag.html',
        'packages/tag/page.html',
        'docs/layout.html',
      ],
    },
    byFile: {
      'docs/layout.html': [
        'packages/tag/test/tag.test.mjs',
        'tests/site/01-load-shell.mjs',
        'tests/site/05-doc-pages.mjs',
      ],
      'packages/boot/mosaic.css': ['tests/site/01-load-shell.mjs'],
      'packages/tag/page.html': ['packages/tag/test/tag.test.mjs', 'tests/site/05-doc-pages.mjs'],
      'packages/tag/tag.html': ['packages/tag/test/tag.test.mjs'],
    },
  };
  const pick = (changed) => selectSuites({ changed, suites: FAKE_SUITES, map: FAKE_MAP });

  const exact = pick(['packages/tag/tag.html']);
  check(
    '精确命中：地图里有这个文件 → 只跑录到它的套件',
    JSON.stringify(exact.selected) === JSON.stringify(['packages/tag/test/tag.test.mjs']) &&
      exact.selected.length === 1,
    JSON.stringify(exact.selected),
  );

  const newInDir = pick(['packages/tag/demos/新文件.html']);
  check(
    '组件目录的新文件（地图里没有）→ 该组件的套件 + 地图里碰过这个目录的套件',
    newInDir.selected.includes('packages/tag/test/tag.test.mjs') &&
      newInDir.selected.includes('tests/site/05-doc-pages.mjs') &&
      newInDir.selected.length === 2,
    JSON.stringify(newInDir.selected),
  );

  const ownSuite = pick(['tests/site/05-doc-pages.mjs']);
  check(
    '改了套件文件自己 → 只跑它',
    JSON.stringify(ownSuite.selected) === JSON.stringify(['tests/site/05-doc-pages.mjs']),
    JSON.stringify(ownSuite.selected),
  );

  const shared = pick(['tests/lib/harness.mjs']);
  check(
    '测试基座 / 共享面 → 全部（full 标记 + 全选）',
    shared.full === true && shared.selected.length === FAKE_SUITES.length,
    JSON.stringify({ full: shared.full, n: shared.selected.length }),
  );

  const docs = pick(['README.md', 'agent/PLAN.md', '.prettierignore']);
  check(
    '纯文档 / 仓库配置 → 不跑浏览器套件（合成清单里没有「总是跑」的静态守卫，所以是全空）',
    docs.notes.every((n) => n.suites !== 'all') && docs.selected.length === 0,
    JSON.stringify(docs.notes.map((n) => [n.file, n.suites])),
  );

  /** 真实清单里那条静态守卫（11 扫全仓、跑一次 0.0s）在任何改动下都该被带上 */
  const realDocs = selectSuites({ changed: ['README.md'], suites, map });
  check(
    '真实清单：纯文档也不漏掉「总是跑」的静态守卫（11 号，扫全仓的 node-only 守卫）',
    recording || realDocs.selected.every((p) => p === 'tests/site/11-no-class-components.mjs'),
    JSON.stringify(realDocs.selected),
  );

  const unknown = pick(['some/new-thing.bin']);
  check(
    '未知路径 → 保守跑全部并在理由里说明',
    unknown.full === true && unknown.notes[0].why.includes('保守'),
    JSON.stringify(unknown.notes[0]),
  );

  const noMap = selectSuites({ changed: ['packages/tag/tag.html'], suites: FAKE_SUITES, map: null });
  /** 没录进地图的套件（新加的）必须总是跑：一次过期的录制不该让它永远被跳过 */
  const unrecorded = { ...FAKE_SUITES[0], label: 'New', path: 'packages/new/test/new.test.mjs' };
  const selfHeal = selectSuites({
    changed: ['packages/tag/tag.html'],
    suites: [...FAKE_SUITES, unrecorded],
    map: FAKE_MAP,
  });
  check(
    '地图缺失 / 套件不在图里 → 总是跑（自愈，不会静默漏跑）',
    noMap.full === true &&
      selfHeal.selected.includes(unrecorded.path) &&
      selfHeal.selected.includes('packages/tag/test/tag.test.mjs'),
    JSON.stringify({ 无地图: noMap.full, 新套件: selfHeal.selected }),
  );

  /* ------------------------------------------------------------------ *
   * ④ 路径与 git 取数
   * ------------------------------------------------------------------ */

  check(
    '路径归一：绝对路径 / ./ 前缀都能收敛成仓库相对路径',
    normalizePath(`${repoRoot()}packages/tag/tag.html`) === 'packages/tag/tag.html' &&
      normalizePath('./docs/pages/home.html') === 'docs/pages/home.html' &&
      normalizePath('docs//pages/home.html') === 'docs//pages/home.html',
    `${normalizePath(`${repoRoot()}packages/tag/tag.html`)} · ${normalizePath('./docs/pages/home.html')}`,
  );

  const changed = changedFiles('HEAD');
  check(
    'git 取改动：拿到当前工作区改动清单（含未跟踪文件）',
    Array.isArray(changed) && changed.every((f) => typeof f === 'string' && !f.startsWith('/')),
    Array.isArray(changed) ? `${changed.length} 个改动文件` : '取不到（null）',
  );
}
