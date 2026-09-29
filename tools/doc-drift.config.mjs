/**
 * Mosaic 的「文档 ↔ 代码」约定 —— 就是把仓库的规矩写成数据。
 *
 * 引擎在 `tools/doc-drift/`（从 skill 拷进来的通用副本，零仓库知识）。
 * **改这里的约定（文件放哪、表头叫什么、什么算豁免、哪些数字要对账）只动这份配置**；
 * 除非出现全新的代码写法，才需要动引擎（见 SKILL.md）。
 *
 * 跑：`pnpm check:docs`（= `node tools/doc-drift/drift.mjs`）。
 */

import { dirname, posix } from 'node:path';
import { READY, slugOf } from '../docs/site-map.js';
import { componentSuites, siteSuites } from '../tests/lib/suites.mjs';
import { mdTables } from './doc-drift/lib/parse.mjs';

/** 组件清单的唯一真相源在 site-map：里程碑也从那里取，不另抄一份 */
const stageOf = (slug) => READY.find((node) => slugOf(node) === slug)?.stage ?? null;

/* ------------------------------------------------------------------ *
 * 代码侧：怎么从组件源码抽「接口事实」
 * ------------------------------------------------------------------ */

const code = {
  components: {
    roots: ['packages/*'],
    // 组件本体：同目录下所有 .html（page.html 由引擎排除）——
    // 一个目录可以有多个标签：collapse/ 里是 collapse.html + collapse-item.html
    entry: ['*.html'],
    // 命令式组件（没有标签属性，入口是函数）：packages/message/
    module: ['*.js'],
    imperative: ['message'],
    stageOf,
  },
  // 标签名从组件模板里认
  tagPattern: "tag:\\s*'([\\w-]+)'",
  // 组件级令牌的命名约定与「内部令牌」标记
  tokenPrefix: '--mc-{slug}-',
  internalMarker: '@internal',
  // facet → adapter（adapter 实现在引擎的 lib/parse.mjs；这里只挑用哪几个）
  facets: {
    attrs: ['attrsObject'],
    events: ['emitCall', 'newEvent'],
    slots: ['slotElement'],
    parts: ['partAttribute', 'setAttributePart', 'partProperty'],
    tokens: ['tokenPrefix'],
  },
};

/* ------------------------------------------------------------------ *
 * 文档侧：每个面（surface）对一次账
 * ------------------------------------------------------------------ */

/** 开发文档：组件 API 规范（packages/<slug>/api.md），每组件一份 —— 单元内聚，跟着组件走 */
const apiSpec = {
  id: 'api-spec',
  title: '开发文档 · 逐组件 API 规范（packages/*/api.md ↔ 组件代码）',
  kind: 'markdown',
  files: 'packages/{slug}/api.md',
  missing: '已实现的组件在 API 规范里必须逐组件一份',
  tables: [
    { header: ['名称', '值', '默认'], facet: 'attrs', name: 0, default: 2 },
    // ⚠️ 令牌表**不在这里** —— api.md 是页面参考区的渲染源，而令牌不进页面；
    // 令牌搬进了单元 README，由下面的 `unit-tokens` 面单独对账
    { header: ['名称', '类型', '说明'], facet: 'events', name: 0 },
    // 插槽与 part 同一张表：`插槽 x` / `part="x"` 带前缀，或裸名字；都按代码事实归类
    { header: ['名称', '说明'], facet: 'slotsParts', name: 0, bareNames: 'codeFacts' },
  ],
  // 命令式组件没有标签属性：改对账「方法」表与源码里的 DEFAULTS
  imperatives: {
    methods: {
      header: ['名称', '说明'],
      name: 0,
      source: 'module',
      pattern: 'call',
      skipRow: '插槽|part=',
    },
    config: {
      header: ['名称', '值', '默认'],
      name: 0,
      source: 'module',
      pattern: 'defaultsKeys',
      const: 'DEFAULTS',
    },
  },
};

/**
 * 开发文档：单元 README 里的令牌表（packages/<slug>/README.md ↔ 组件代码）
 *
 * 令牌不进文档页（将来由主题编辑器展示），所以不住 api.md（那是页面渲染源）——
 * 但**对账不能跟着停**：代码里加了令牌而文档没写，以前靠 api-spec 面的 tokens facet 抓，
 * 现在那一列没了，这一面接过来。少一面守卫 = 静默失效。
 */
const unitTokens = {
  id: 'unit-tokens',
  title: '开发文档 · 组件令牌（packages/*/README.md ↔ 组件代码）',
  kind: 'markdown',
  files: 'packages/{slug}/README.md',
  tables: [
    // 两种形状都收（`令牌 / 默认 / 作用` 与 `令牌 / 作用`）：表头按前缀匹配，只声明第一列
    { header: ['令牌'], facet: 'tokens', name: 0 },
  ],
};

/** 组件文档：页面骨架（doc-pages.md §一 的固定骨架） */
const pageSkeleton = {
  id: 'page-skeleton',
  title: '组件文档 · 页面骨架（packages/*/page.html）',
  kind: 'html',
  files: 'packages/{slug}/page.html',
  skeleton: {
    root: '<template page>',
    link: 'docs/content.css',
    requireH1Code: true,
    require: ['<doc-crumb>', '<doc-pager>'],
    parentExport: 'doc-layout.html',
    firstH2: '例子',
    /* 「注意事项」是**可选尾节**：有值得提醒的才写，没有就整节省略（`mc-button` 就没有）。
       所以不用 lastH2 —— 那会逼着每页都凑一节，凑出来的往往是废话。
       下表是参考区顺序，列的是当前用到的**全部**参考节名；顺序断言由引擎 1.0.1 起真正生效
       （1.0.0 里它是恒成立的死断言），任何一节排到「注意事项」后面都会红。
       加新节名（比如将来由 md 渲染出来的「令牌」）时，按位置把名字补进这张表。 */
    referenceOrder: ['属性', '方法', '事件', '配置', '插槽与 part', '插槽', 'part', '注意事项'],
  },
};

/** 组件文档：演示区 ↔ demos/*.html */
const pageDemos = {
  id: 'page-demos',
  title: '组件文档 · 演示区 ↔ demos/',
  kind: 'html',
  files: 'packages/{slug}/page.html',
  demos: {
    dir: 'packages/{slug}/demos',
    pattern: 'demos/[\\w.-]+\\.html',
    links: true,
  },
};

/* ------------------------------------------------------------------ *
 * 仓库特有的账（声明式规则）
 * ------------------------------------------------------------------ */

/** 单任务必读闭包的**行数预算** —— agent/README.md 导航表里那一列。超了就是「做这件事要读的东西变多了」。 */
const readBudget = { maxLines: 600 };

/** markdown 链接目标（只认 `](…)` 这种；锚点原样带回来，调用方自己决定跳不跳） */
function markdownLinks(text) {
  const out = [];
  let i = 0;
  while ((i = text.indexOf('](', i)) >= 0) {
    const end = text.indexOf(')', i + 2);
    if (end < 0) break;
    out.push(text.slice(i + 2, end));
    i = end + 1;
  }
  return out;
}

/** 文档里的 `[P<n>](文件)` / `[P<n>–P<m>](文件)` 引用（自锚点 `[P1](#p1-…)` 也收，调用方跳过） */
function pitfallRefs(text) {
  const out = [];
  let i = 0;
  while ((i = text.indexOf('[P', i)) >= 0) {
    let j = i + 2;
    while (j < text.length && text[j] >= '0' && text[j] <= '9') j += 1;
    if (j === i + 2) {
      i = i + 2;
      continue;
    }
    const first = Number(text.slice(i + 2, j));
    let second = first;
    let k = j;
    const dash = text[k];
    if (dash === '-' || dash === '–' || dash === '—') {
      let m = k + 1;
      if (text[m] === 'P') m += 1;
      let n = m;
      while (n < text.length && text[n] >= '0' && text[n] <= '9') n += 1;
      if (n > m) {
        second = Number(text.slice(m, n));
        k = n;
      }
    }
    if (text.slice(k, k + 2) !== '](') {
      i = j;
      continue;
    }
    const end = text.indexOf(')', k + 2);
    if (end < 0) break;
    out.push({ first: first, second: second, href: text.slice(k + 2, end), index: i });
    i = end + 1;
  }
  return out;
}

const rules = [
  {
    type: 'index',
    id: 'api-index',
    title: '开发文档 · 组件索引（agent/api/README.md ↔ packages/）',
    file: 'agent/api/README.md',
    single: true,
    header: ['组件', '标签', '目录', '里程碑', '状态'],
    columns: { name: 0, tag: 1, dir: 2, stage: 3, status: 4 },
    implemented: '已实现',
    entry: 'packages/{dir}/{dir}.html',
    stageLabel: '里程碑',
    mustList: true,
  },
  {
    type: 'paths',
    id: 'dev-paths',
    title: '开发文档 · 路径与目录树（agent/** ↔ 仓库）',
    files: ['agent/**/*.md', 'README.md'],
    // 考古 / 外部原文：记录的是历史状态，出现已删除的文件是正常的
    // ⚠️ 教程豁免：它讲的是「要创建什么」，正文里点名的 `packages/badge/*.html` 此刻就该不存在。
    // 「路径面」的语义是「文档里点名的文件仓库里有吗」，对教程不成立 —— 教程里的**链接**
    // 由 `doc-links` 那条 custom 规则守（它跳过代码块，所以只查真链接）。
    skipFiles: ['agent/archive/**', 'agent/vendor/**', 'agent/tutorial.md'],
    historyWords: '已删|删掉|删了|曾是|曾经|原来|以前|不再|去掉|旧版|history',
    placeholder: '[{}<>*…$|@=()!?#]',
    placeholderSegment: '^(?:x|y|z|n|xxx|yyy|name|slug|foo|bar|baz)$',
    topDirs: ['packages', 'tools', 'docs', 'tests', 'agent'],
    // 规范里给「还没实现的组件」写文件名，是在定接口，不算脱节。
    // 两条：已实现的住在组件单元里（`packages/<slug>/api.md`），
    // 未实现的草案还留在 `agent/api/<slug>.md`（badge / spinner，目录都还没建）
    plannedSpec: {
      filePattern: '^(?:packages/([\\w-]+)/api\\.md|agent/api/([\\w-]+)\\.md)$',
      group: 2,
    },
    // 带行号的引用可能是上游源码（`packages/xhear/register.mjs:42` —— ofa.js 的包）
    foreignLineRef: {
      pattern: '^packages/([\\w-]+)/',
      check: 'packages/{segment}',
    },
  },
  {
    type: 'tree',
    id: 'dev-tree',
    title: '开发文档 · 目录树（agent/plan/structure.md）',
    file: 'agent/plan/structure.md',
    commentChars: '#←',
    placeholder: '[{}<>*…$|@=()!?#]',
  },
  {
    type: 'commands',
    id: 'dev-commands',
    title: '开发文档 · 命令（pnpm / node ↔ 真实脚本）',
    files: ['agent/**/*.md', 'README.md'],
    runner: 'pnpm',
    builtins: [
      'install',
      'i',
      'add',
      'remove',
      'rm',
      'update',
      'up',
      'run',
      'exec',
      'dlx',
      'why',
      'list',
      'ls',
      'outdated',
      'publish',
      'pack',
      'link',
      'unlink',
      'store',
      'config',
      'import',
      'deploy',
      'prune',
    ],
  },
  {
    type: 'counts',
    id: 'dev-facts',
    title: '开发文档 · 数字与清单（踩坑条数 / 套件数）',
    claims: [
      {
        label: '条坑',
        pattern: '(\\d+)\\s*条',
        files: ['agent/README.md', 'agent/pitfalls/README.md'],
        // 踩坑条数：`### P<n>` 的总数就是真相
        actual: ({ io }) =>
          io
            .listFiles('agent/pitfalls/*.md')
            .reduce((sum, file) => sum + [...io.read(file).matchAll(/^### P\d+/gm)].length, 0),
      },
      {
        label: '个站点套件',
        pattern: '(\\d+)\\s*个?站点套件',
        files: ['agent/**/*.md', 'README.md', 'tests/smoke.mjs', 'tests/select.mjs'],
        actual: () => siteSuites().length,
      },
      {
        label: '个组件套件',
        pattern: '(\\d+)\\s*个?组件套件',
        files: ['agent/**/*.md', 'README.md', 'tests/smoke.mjs', 'tests/select.mjs'],
        actual: () => componentSuites().length,
      },
      {
        /* 「370 个工具类」这种数字以前没人守：改了 uno.config 或加了图标它就悄悄过期。
           口径写死成「mosaic.css 里以 . 开头的选择器行数」—— 与文档用词「N 条工具类规则」
           一一对应；换口径（比如只算 utilities 层、不算图标）就要连文档用词一起改。 */
        label: '条工具类规则',
        // 只认「当前 / 现为 / 管线（N 条…」这种**报数**的写法；
        // decisions.md 里「实测白产出过 4 条工具类规则」讲的是另一件事，别误伤
        pattern: '(?<=当前 |现为 |管线（)(\\d+)\\s*条(?:精选)?工具类规则',
        files: ['README.md', 'agent/**/*.md', 'docs/**/*.html'],
        actual: ({ io }) =>
          io
            .read('packages/boot/mosaic.css')
            .split('\n')
            .filter((line) => /^\s*\.[a-zA-Z]/.test(line)).length,
      },
      {
        label: '组（check:docs 对账组）',
        pattern: '(\\d+)\\s*组(?:全绿|全部对齐)',
        files: ['agent/**/*.md', 'README.md', 'docs/**/*.html'],
        actual: () => GROUP_COUNT,
      },
    ],
  },
  {
    /* 参考区改由 md 渲染之后，这一面（页面手写表格 ↔ 代码）就没对象了 ——
       接口事实改由上面的 `api-spec` 面（packages/<slug>/api.md ↔ 代码）守着，
       「每页真的挂了 <doc-spec>、src 指向的 md 真的存在」由 rules 里的 `page-spec-ref` 守着。
       留一个 custom 面兜住**反向**那条：页面里不许再手抄参考表格（防止回潮）。 */
    type: 'custom',
    id: 'page-no-hand-table',
    title: '组件文档 · 页面不许再手抄参考表格（防回潮）',
    run: ({ io, components, problems }) => {
      for (const c of components) {
        const page = `packages/${c.slug}/page.html`;
        if (!io.exists(page)) continue;
        const text = io.read(page);
        // 参考区的表都是 .doc-table；演示区里的表格不算（那本来就是页面自己的内容）
        for (const m of text.matchAll(/<table class="doc-table"/g)) {
          const line = text.slice(0, m.index).split('\n').length;
          problems.push(
            `${page}:${line}：页面里还有手抄的 .doc-table —— 参考区该由 <doc-spec> 渲染`,
          );
        }
      }
    },
  },
  {
    type: 'custom',
    id: 'page-spec-ref',
    title: '组件文档 · 每页挂 <doc-spec> 且 src 指向存在的 md',
    run: ({ io, components, problems }) => {
      for (const c of components) {
        const page = `packages/${c.slug}/page.html`;
        if (!io.exists(page)) continue;
        const text = io.read(page);
        const m = text.match(/<doc-spec[^>]*\ssrc="([^"]+)"/);
        if (!m) {
          problems.push(`${page}：没有 <doc-spec>，参考区是空的`);
          continue;
        }
        // src 按页面文件解析（ofa 编译期会把相对地址改写成绝对地址，同 mc-code 的 src）
        const src = m[1];
        const rel = src.startsWith('./')
          ? `packages/${c.slug}/${src.slice(2)}`
          : src.replace(/^(\.\.\/)+/, '');
        if (!io.exists(rel)) {
          problems.push(`${page}：<doc-spec src="${src}"> 指向的 md 不存在（解析成 ${rel}）`);
        }
      }
    },
  },
  {
    /* 参考区搬到 md 之后，「插槽 / part 合成一节还是各自成节」没人守了：引擎里那条
       `slotPartTitle` 只认 html 面（page.html 早就不放参考表了），等于死代码。约定落回配置：
       代码里两种都有 → 一节 `插槽与 part`（混合表，名称加前缀 `插槽 header` / `part="header"`）；
       只有插槽 → `插槽`；只有 part → `part`；都没有就整节省略。 */
    type: 'custom',
    id: 'api-slot-part-title',
    title: '组件文档 · API 规范里插槽 / part 的节名与代码事实一致',
    run: ({ io, components, problems }) => {
      for (const c of components) {
        const api = `packages/${c.slug}/api.md`;
        if (!io.exists(api)) continue;
        const hasSlots = c.facts.union.slots.size > 0;
        const hasParts = c.facts.union.parts.size > 0;
        const want =
          hasSlots && hasParts ? '插槽与 part' : hasSlots ? '插槽' : hasParts ? 'part' : null;
        const present = [...io.read(api).matchAll(/^##\s+(.+?)\s*$/gm)]
          .map((m) => m[1].replace(/`/g, '').trim())
          .filter((name) => /^插槽|^part/.test(name));
        if (!want) {
          if (present.length) {
            problems.push(
              `${api}：代码里既没有插槽也没有 part，却写了「${present.join(' / ')}」节`,
            );
          }
          continue;
        }
        if (present.length !== 1 || present[0] !== want) {
          const actual = present.length ? `「${present.join(' / ')}」` : '（缺这一节）';
          problems.push(
            `${api}：这一段 <h2> 应为「${want}」（代码里${hasSlots ? '有插槽' : '没插槽'}、${
              hasParts ? '有 part' : '没 part'
            }），实际是 ${actual}`,
          );
        }
      }
    },
  },
  {
    /* 「例子按 api.md 的属性来、内部样式按 part 来」—— 演示和接口不许脱节：
       组件代码里有的属性，至少有一个演示真的用它；有的 part，至少有一个演示用 `::part()` 改它。
       ⚠️ 这是**最低覆盖线**，不是「一条演示只讲一个属性」：同一维度的变体（三档尺寸、六个颜色）
       合一条照样算覆盖；反过来，加了属性 / part 却没有演示，这里就红。 */
    type: 'custom',
    id: 'demo-covers-api',
    title: '组件文档 · 演示覆盖 api.md 的属性与 part',
    run: ({ io, components, problems }) => {
      for (const c of components) {
        if (c.imperative) continue; // 命令式组件没有标签属性，也没有 part
        const dir = 'packages/' + c.slug + '/demos';
        const files = io.listFiles(dir + '/*.html');
        if (!files.length) continue;
        const text = files.map((file) => io.read(file)).join('\n');
        for (const attr of c.facts.union.attrs.keys()) {
          const re = new RegExp('(?:^|[^\\w-])' + attr + '(?:[^\\w-]|$)');
          if (!re.test(text)) {
            problems.push(dir + '：属性 `' + attr + '` 在组件代码里有，演示里一次都没出现');
          }
        }
        for (const part of c.facts.union.parts) {
          if (!text.includes('::part(' + part + ')')) {
            problems.push(
              dir + '：part `' + part + '` 在组件代码里有，没有演示用 `::part(' + part + ')` 改它',
            );
          }
        }
      }
    },
  },
  {
    /* 「值」列 = TS 类型：不再写「布尔 / 字符串 / 数字」这类中文类型词，枚举写成字面量联合
       `'sm' | 'md' | 'lg'`。联合里的竖线在 md 表格里按 GFM 转义（`\|`），引擎 1.0.3 起认得。
       只查 `名称 | 值 | 默认` 这种表（属性 / 配置），别的表（状态 / 宿主钩子 / 内置集）不管。 */
    type: 'custom',
    id: 'api-value-ts',
    title: '组件文档 · API 规范「值」列写 TS 类型',
    run: ({ io, components, problems }) => {
      const OK =
        /^(?:boolean|string|number|number \| string|\(\) => void|'[^']*'(?: \| '[^']*')*)$/;
      for (const c of components) {
        const api = 'packages/' + c.slug + '/api.md';
        if (!io.exists(api)) continue;
        for (const table of mdTables(io.read(api))) {
          if (table.header[0] !== '名称' || table.header[1] !== '值' || table.header[2] !== '默认')
            continue;
          for (const row of table.rows) {
            const value = (row.cells[1] ?? '').replace(/[`*]/g, '').trim();
            if (!OK.test(value)) {
              problems.push(
                api +
                  ':' +
                  row.line +
                  '：值列「' +
                  row.cells[1] +
                  '」不是 TS 类型（boolean / string / number / 字面量联合）',
              );
            }
          }
        }
      }
    },
  },
  {
    /* 组件单元的 README 是**入口卡**（目录里有什么、状态、相邻单元分工），不是接口文档。
       三件事盯住它别越线、别烂：
         ① 有 api.md 的单元必须有 README.md（反过来也一样）；
         ② README 里不许出现任何接口节标题 —— 那些归 api.md，写了就是第二份会漂移的副本；
         ③ 状态（M 几）与 site-map.js 对账 —— 这是 README 里唯一允许重复的「事实」。 */
    type: 'custom',
    id: 'unit-readme',
    title: '组件单元 · README 入口卡（存在 / 不写接口事实 / 状态对账）',
    run: ({ io, components, problems }) => {
      /* ② README 里不许出现**接口**节标题 —— 属性 / 方法 / 事件 / 配置 / 插槽 / part 归 api.md，
         写了就是第二份会漂移的副本。
         ⚠️ **令牌是唯一例外**：按海风的定性，令牌不进文档页（将来由主题编辑器展示），
         也不留在 api.md 里当「渲染源里没人渲染的半截」—— 它归 README，由 `unit-tokens` 面对账。
         整行精确匹配：`## 为什么不发事件` 这种不算接口节。 */
      const FORBIDDEN = /^(?:属性|方法|事件|配置|插槽(?:\s+与\s+part)?|part)$/;
      for (const c of components) {
        const readme = `packages/${c.slug}/README.md`;
        const api = `packages/${c.slug}/api.md`;
        const hasApi = io.exists(api);
        const hasReadme = io.exists(readme);
        if (hasApi && !hasReadme) {
          problems.push(`${readme}：有 api.md 的单元必须有 README.md（单元入口卡）`);
          continue;
        }
        if (!hasApi && hasReadme) {
          problems.push(`${api}：有 README.md 却没有 api.md —— 接口规范才是单元的必配件`);
          continue;
        }
        if (!hasReadme) continue;

        const text = io.read(readme);
        for (const m of text.matchAll(/^##\s+(.+?)\s*$/gm)) {
          const name = m[1].replace(/`/g, '').trim();
          if (FORBIDDEN.test(name)) {
            const line = text.slice(0, m.index).split('\n').length;
            problems.push(
              `${readme}:${line}：README 里出现了「${name}」节 —— 接口事实的唯一手写源是 api.md，这里写了就是第二份会漂移的副本`,
            );
          }
        }

        const want = stageOf(c.slug);
        const got = text.match(/\*\*状态\*\*：[^·]*·\s*(M\d)/)?.[1] ?? null;
        if (want && got !== want) {
          problems.push(`${readme}：写的里程碑是 ${got ?? '（没写）'}，site-map.js 里是 ${want}`);
        }
      }

      /* ④ 组件本体不许再长篇大论：头注释只留一行定位 + 指针，设计说明归 README 的「设计取舍」。
         这份文件是要经 CDN 发给使用者的产物，注释会一起发出去 —— 顺便也消掉「两处都写」的漂移源。
         行内注释（`/* …`）不在其列：那些解释的是「这一行为什么这么写」，就该留在代码旁边。 */
      const MAX_HEAD_COMMENT = 8;
      for (const c of components) {
        for (const file of c.facts.files.filter((f) => f.endsWith('.html'))) {
          const lines = io.read(file).split('\n');
          const s = lines.findIndex((l) => /^\s*<!--/.test(l));
          if (s < 0 || s > 2) continue;
          let e = -1;
          for (let i = s; i < lines.length; i++) {
            if (/-->/.test(lines[i])) {
              e = i;
              break;
            }
          }
          if (e - s + 1 > MAX_HEAD_COMMENT) {
            problems.push(
              `${file}：文件头注释 ${e - s + 1} 行（上限 ${MAX_HEAD_COMMENT}）—— 设计说明搬到 ${`packages/${c.slug}/README.md`} 的「设计取舍」节`,
            );
          }
        }
      }
    },
  },
  {
    type: 'custom',
    id: 'doc-links',
    title: '文档 · 链接指向的文件都存在（md，跳过代码块与归档）',
    run: ({ io, problems }) => {
      /* 文档里的 `[…](…)` 链接，目标不存在就是断链 —— 链接坏掉是**静默**的：
         没人报错，只是读者点了没反应，所以要有守卫。

         两条豁免（缺一条就会误报）：
         1. **代码块里的不算** —— 教程与规范里的示例路径（`packages/badge/badge.html`）
            是给读者**复制到别处**用的，按当前文件解析必然不存在。
         2. **归档目录不查** —— 里面是历史原文，记录的是当时状态。
         http(s) / mailto / 纯锚点本来就不查。 */
      const SKIP = /^(?:agent\/archive|agent\/vendor)\//;
      /* ⚠️ `io.listFiles` 收**单个** glob 字符串，不收数组 —— 传数组会拿到空列表，
         这条规则就变成「什么都不查还全绿」。逐条 flatMap，和引擎里的写法保持一致。 */
      const GLOBS = ['agent/**/*.md', 'packages/**/*.md', 'docs/**/*.md', 'README.md'];
      const files = GLOBS.flatMap((g) => io.listFiles(g));

      for (const file of files) {
        if (SKIP.test(file)) continue;
        const lines = io.read(file).split('\n');
        let fence = false;
        for (let i = 0; i < lines.length; i++) {
          if (/^\s*(?:```|````)/.test(lines[i])) {
            fence = !fence;
            continue;
          }
          if (fence) continue;
          for (const m of lines[i].matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
            const href = m[1].trim();
            if (/^(?:https?:|mailto:|#)/.test(href)) continue;
            const base = href.split('#')[0];
            if (!base) continue;
            /* 走 posix，不用 `path.resolve`：后者在 Windows 上给了绝对路径（`D:\mosaic\…`），
               再拿去 `io.exists` 拼一遍就变成 `D:\mosaic/D:\mosaic\…` —— 明明存在的链接全被报成断链。 */
            const dir = dirname(file).split('\\').join('/');
            const target = posix.normalize(posix.join(dir, base));
            if (target.startsWith('..') || !io.exists(target)) {
              problems.push(
                `${file}:${i + 1}：链接指向 \`${href}\`（解析为 \`${target}\`），文件不存在`,
              );
            }
          }
        }
      }
    },
  },
  {
    /* 「默认不读」得能验：导航表每一行都写清**必读闭包**（读完这些就能动手做这件事），
       这里算它的总行数并卡预算。没有这条守卫，「读这份」会慢慢变回「相关文档若干」。 */
    type: 'custom',
    id: 'read-budget',
    title: '开发文档 · 单任务必读闭包（agent/README.md ↔ 文件存在与行数预算）',
    run: ({ io, problems }) => {
      const NAV = 'agent/README.md';
      let rows = 0;
      io.read(NAV)
        .split('\n')
        .forEach((line, index) => {
          const cells = line.split('|');
          if (cells.length !== 5) return;
          const task = cells[1].trim();
          const cell = cells[2].trim();
          const kind = cells[3].trim();
          if (!task || task === '我要做什么' || task === '-'.repeat(task.length)) return;
          if (kind.startsWith('工具')) return; // 工具行指向命令，没有文档闭包
          const links = markdownLinks(cell);
          if (!links.length) {
            problems.push(
              NAV +
                ':' +
                (index + 1) +
                '：这一行的「读这份」没有文件链接 —— 必读闭包必须是文件清单',
            );
            return;
          }
          let total = 0;
          for (const href of links) {
            // 目录链接末尾的 `/` 要去掉：glob 拼出 `agent/howto//**` 匹配不上（会退化成读目录，EISDIR）
            let base = href.split('#')[0];
            while (base.endsWith('/')) base = base.slice(0, -1);
            const target = posix.normalize(posix.join('agent', base));
            if (!io.exists(target)) {
              problems.push(NAV + ':' + (index + 1) + '：闭包里的 ' + href + ' 不存在');
              continue;
            }
            const inside = io.listFiles(target + '/**/*.md');
            for (const file of inside.length ? inside : target.endsWith('.md') ? [target] : []) {
              total += io.read(file).split('\n').length;
            }
          }
          rows += 1;
          if (total > readBudget.maxLines) {
            problems.push(
              NAV +
                ':' +
                (index + 1) +
                '：「' +
                task +
                '」的必读闭包 ' +
                total +
                ' 行，超预算 ' +
                readBudget.maxLines +
                '（配置 readBudget）—— 该拆文档，不是加预算',
            );
          }
        });
      if (rows === 0) problems.push(NAV + '：一行闭包都没解析到 —— 守卫会安静地全绿');
    },
  },
  {
    /* 做法的契约（agent/howto/README.md 自己写的那几条）得有人守：
         ① 开篇一句「这是食谱」—— 读者要立刻知道这是步骤不是规矩；
         ② 有「验证」节，节里有一条能跑的命令（「怎么知道自己做对了」）；
         ③ 有「这一步最容易踩的」节。
       顺带守**坑条目引用**：`[P<n>](文件)` 必须真的落在那个文件的 `### P<n>` 上 ——
       引错编号比不引更坏（读者按编号反查会扑空）。 */
    type: 'custom',
    id: 'howto-contract',
    title: '开发文档 · 食谱契约与坑条目引用（agent/howto/** ↔ pitfalls/）',
    run: ({ io, problems }) => {
      const lineOf = (text, index) => text.slice(0, index).split('\n').length;

      for (const file of io.listFiles('agent/howto/*.md')) {
        if (file.endsWith('README.md')) continue;
        const lines = io.read(file).split('\n');
        if (!lines.slice(0, 6).join('\n').includes('这是食谱')) {
          problems.push(file + '：开头没有「这是食谱」—— 读者分不出这是步骤还是规矩');
        }
        const verifyAt = lines.findIndex(
          (line) => line.startsWith('## ') && (line.includes('验证') || line.includes('做对了')),
        );
        if (verifyAt < 0) {
          problems.push(file + '：缺「验证」节 —— 每份食谱都要有「怎么知道自己做对了」');
        } else {
          const body = [];
          for (let i = verifyAt + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
            body.push(lines[i]);
          }
          const section = body.join('\n');
          if (
            !section.includes('```') ||
            !(section.includes('pnpm ') || section.includes('node '))
          ) {
            problems.push(file + '：「验证」节里没有能跑的命令（pnpm / node）');
          }
        }
        if (!lines.some((line) => line.startsWith('## ') && line.includes('最容易踩的'))) {
          problems.push(file + '：缺「这一步最容易踩的」节 —— 见 agent/howto/README.md 的三条');
        }
      }

      const files = io
        .listFiles('agent/**/*.md')
        .filter((file) => !file.startsWith('agent/archive/') && !file.startsWith('agent/vendor/'));
      for (const file of files) {
        const text = io.read(file);
        for (const ref of pitfallRefs(text)) {
          if (ref.href.startsWith('#')) continue;
          const target = posix.normalize(posix.join(dirname(file), ref.href.split('#')[0]));
          if (!io.exists(target)) {
            problems.push(
              file +
                ':' +
                lineOf(text, ref.index) +
                '：P' +
                ref.first +
                ' 指向的 ' +
                ref.href +
                ' 不存在',
            );
            continue;
          }
          const entryLines = io.read(target).split('\n');
          for (let n = ref.first; n <= ref.second; n += 1) {
            const prefix = '### P' + n;
            const hit = entryLines.some(
              (line) =>
                line.startsWith(prefix) && !'0123456789'.includes(line[prefix.length] || ''),
            );
            if (!hit) {
              problems.push(
                file +
                  ':' +
                  lineOf(text, ref.index) +
                  '：' +
                  ref.href +
                  ' 里没有 P' +
                  n +
                  ' 这条 —— 引错编号会让人扑空',
              );
            }
          }
        }
      }
    },
  },
];

/** check:docs 的总组数 = 每个面一条 + 每条规则一条 + 自检一条；文档里写「N 组全绿」按它对账 */
const GROUP_COUNT = [apiSpec, unitTokens, pageSkeleton, pageDemos].length + rules.length + 1;

export default {
  code,
  // `page-api`（页面手写参考表格 ↔ 代码）已随 S3 一并删除：11 页全部改由 md 渲染，
  // 那一面再留着就是「对 11 页全 skip」的空转 —— 接口事实由 `api-spec` 守，
  // 「挂了 doc-spec / 不许再手抄表格」由 rules 里两条 custom 守。
  surfaces: [apiSpec, unitTokens, pageSkeleton, pageDemos],
  rules,
};
