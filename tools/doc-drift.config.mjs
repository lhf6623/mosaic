/**
 * Mosaic 的「文档 ↔ 代码」约定 —— 把仓库的规矩写成数据。引擎在 `tools/doc-drift/`（skill 拷来的通用副本）。
 * **改这里的约定只动这份配置**；除非出现全新的代码写法，才需要动引擎（见 SKILL.md）。
 * 跑：`pnpm check:docs`（= `node tools/doc-drift/drift.mjs`）。
 */

import { dirname, posix } from 'node:path';
import { READY, slugOf } from '../docs/site-map.js';
import { componentSuites, siteSuites } from '../tests/lib/suites.mjs';
import { mdTables } from './doc-drift/lib/parse.mjs';

/** 组件清单的唯一真相源在 site-map：里程碑也从那里取，不另抄一份 */
const stageOf = (slug) => READY.find((node) => slugOf(node) === slug)?.stage ?? null;

/* ---------- 代码侧：从组件源码抽「接口事实」 ---------- */

const code = {
  components: {
    roots: ['packages/*'],
    // 组件本体：同目录下所有 .html（page.html 由引擎排除）；一个目录可以有多个标签
    entry: ['*.html'],
    // 命令式组件（没有标签属性，入口是函数）
    module: ['*.js'],
    imperative: ['message'],
    stageOf,
  },
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

/* ---------- 文档侧：每个面（surface）对一次账 ---------- */

/** 开发文档：逐组件 API 规范（packages/<slug>/api.md）—— 单元内聚，跟着组件走 */
const apiSpec = {
  id: 'api-spec',
  title: '开发文档 · 逐组件 API 规范（packages/*/api.md ↔ 组件代码）',
  kind: 'markdown',
  files: 'packages/{slug}/api.md',
  missing: '已实现的组件在 API 规范里必须逐组件一份',
  tables: [
    { header: ['名称', '值', '默认'], facet: 'attrs', name: 0, default: 2 },
    // ⚠️ 令牌表**不在这里** —— api.md 是页面参考区的渲染源，令牌不进页面，搬进了单元 README
    // （由下面的 `unit-tokens` 面对账）；事件与方法同一张表：带调用语法的行按方法对账（`callRows`）
    { header: ['名称', '类型', '说明'], facet: 'events', name: 0, callRows: true },
    // 插槽与 part 各自一节、名字写裸的；归哪一类按代码事实判
    { header: ['名称', '说明'], facet: 'slotsParts', name: 0, bareNames: 'codeFacts' },
  ],
  // 命令式组件没有标签属性：`属性` 表对账模块的 DEFAULTS，`事件` 表对账模块里的可调用名
  imperatives: {
    methods: {
      header: ['名称', '类型', '说明'],
      name: 0,
      source: 'module',
      pattern: 'call',
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

/** 开发文档：单元 README 里的令牌表（packages/<slug>/README.md ↔ 组件代码）
 * 令牌不进文档页，所以不住 api.md；但对账不能跟着停 —— 少一面守卫 = 静默失效。 */
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

/** 组件文档：页面骨架（packages/README.md §一 的固定骨架） */
const pageSkeleton = {
  id: 'page-skeleton',
  title: '组件文档 · 页面骨架（packages/*/page.html）',
  kind: 'html',
  files: 'packages/{slug}/page.html',
  skeleton: {
    root: '<template page>',
    link: 'docs/content.css',
    requireH1Code: true,
    parentExport: 'doc-layout.html',
    firstH2: '例子',
    /* 下表是参考区顺序，列的是当前用到的**全部**参考节名；加新节名时按位置把名字补进这张表。 */
    referenceOrder: ['属性', '事件', '插槽', 'part'],
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

/* ---------- 仓库特有的账（声明式规则） ---------- */

const rules = [
  {
    type: 'index',
    id: 'api-index',
    title: '开发文档 · 组件索引（packages/README.md ↔ packages/）',
    file: 'packages/README.md',
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
    title: '开发文档 · 路径与目录树（packages/**/*.md ↔ 仓库）',
    files: ['packages/**/*.md', 'docs/**/*.md', 'README.md'],
    // 考古：记录的是历史状态，出现已删除的文件是正常的
    historyWords: '已删|删掉|删了|曾是|曾经|原来|以前|不再|去掉|旧版|history',
    placeholder: '[{}<>*…$|@=()!?#]',
    placeholderSegment: '^(?:x|y|z|n|xxx|yyy|name|slug|foo|bar|baz)$',
    topDirs: ['packages', 'tools', 'docs', 'tests'],
    // 规范里给「还没实现的组件」写文件名，是在定接口，不算脱节。
    plannedSpec: {
      filePattern: '^packages/([\\w-]+)/api\\.md$',
      group: 1,
    },
    // 带行号的引用可能是上游源码（`packages/xhear/register.mjs:42` —— ofa.js 的包）
    foreignLineRef: {
      pattern: '^packages/([\\w-]+)/',
      check: 'packages/{segment}',
    },
  },
  {
    type: 'commands',
    id: 'dev-commands',
    title: '开发文档 · 命令（pnpm / node ↔ 真实脚本）',
    files: ['packages/**/*.md', 'docs/**/*.md', 'README.md'],
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
    title: '开发文档 · 数字与清单（套件数 / 工具类 / 对账组）',
    claims: [
      {
        label: '个站点套件',
        pattern: '(\\d+)\\s*个?站点套件',
        files: ['README.md', 'tests/smoke.mjs', 'tests/select.mjs', 'docs/**/*.html'],
        actual: () => siteSuites().length,
      },
      {
        label: '个组件套件',
        pattern: '(\\d+)\\s*个?组件套件',
        files: ['README.md', 'tests/smoke.mjs', 'tests/select.mjs', 'docs/**/*.html'],
        actual: () => componentSuites().length,
      },
      {
        /* 口径 = mosaic.css 里 **mosaic.utilities 层**以 . 开头的选择器行数，与文档用词
           「N 条工具类规则」一一对应。⚠️ 必须限定在这一层：不限定的话 50 条图标规则会被一起算进来。 */
        label: '条工具类规则',
        // 只认「当前 / 现为 / 管线（N 条…」这种**报数**的写法；别处讲的是另一件事，别误伤
        pattern: '(?<=当前 |现为 |管线（)(\\d+)\\s*条(?:精选)?工具类规则',
        files: ['README.md', 'docs/**/*.html'],
        actual: ({ io }) => {
          const css = io.read('packages/boot/mosaic.css');
          const layer = css.slice(css.indexOf('@layer mosaic.utilities {'));
          return layer.split('\n').filter((line) => /^\s*\.[a-zA-Z]/.test(line)).length;
        },
      },
      {
        label: '组（check:docs 对账组）',
        pattern: '(\\d+)\\s*组(?:全绿|全部对齐)',
        files: ['README.md', 'docs/**/*.html'],
        actual: () => GROUP_COUNT,
      },
    ],
  },
  {
    /* 接口事实改由 `api-spec` 面守；留一个 custom 面兜住**反向**那条：页面里不许再手抄参考表格（防回潮）。 */
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
    /* 「插槽 / part 各自成节还是合成一节」无人守（引擎那条只认 html 面）。约定落回配置：**各自一节、
       名字写裸的**，代码里没有哪一类就整节省略；另外盯着「名字别串节」（裸名字之后光看表看不出来）。 */
    type: 'custom',
    id: 'api-slot-part-title',
    title: '组件文档 · API 规范里插槽 / part 的节名与代码事实一致',
    run: ({ io, components, problems }) => {
      for (const c of components) {
        const api = `packages/${c.slug}/api.md`;
        if (!io.exists(api)) continue;
        const text = io.read(api);
        const hasSlots = c.facts.union.slots.size > 0;
        const hasParts = c.facts.union.parts.size > 0;
        const want = [hasSlots ? '插槽' : null, hasParts ? 'part' : null].filter(Boolean);
        /* 按 h2 位置切块，别用 `(?=^##|...)` 那种正则 —— 多行模式下 `\s*$` 恒真，切出来的节只有
           一行，整条守卫会安静地失效（写这条时踩过一次）。 */
        const marks = [...text.matchAll(/^##\s+(.+?)\s*$/gm)];
        const sections = marks.map((mark, index) => ({
          title: mark[1].replace(/`/g, '').trim(),
          body: text.slice(
            mark.index + mark[0].length,
            index + 1 < marks.length ? marks[index + 1].index : text.length,
          ),
        }));
        const present = sections
          .map((section) => section.title)
          .filter((name) => /^插槽|^part/.test(name));
        if (present.join(' / ') !== want.join(' / ')) {
          problems.push(
            `${api}：插槽 / part 的节应为「${want.join(' / ') || '（都不写）'}」（代码里${
              hasSlots ? '有插槽' : '没插槽'
            }、${hasParts ? '有 part' : '没 part'}），实际是「${present.join(' / ') || '（缺）'}」`,
          );
          continue;
        }
        for (const [title, kind] of [
          ['插槽', 'slots'],
          ['part', 'parts'],
        ]) {
          if (!want.includes(title)) continue;
          const body = sections.find((section) => section.title === title)?.body ?? '';
          for (const line of body.split('\n')) {
            if (!line.trim().startsWith('|')) continue;
            const cell = (line.split('|')[1] ?? '').replace(/[`*]/g, '').trim();
            if (!cell || cell === '名称' || /^[:\-\s]+$/.test(cell)) continue;
            const isDefault = cell === '（默认）' || cell === '(默认)';
            const known =
              kind === 'slots'
                ? isDefault || c.facts.union.slots.has(cell)
                : c.facts.union.parts.has(cell);
            if (!known) {
              problems.push(
                `${api}：\`${cell}\` 写进了「${title}」节，但代码里它不是${
                  kind === 'slots' ? '插槽' : ' part'
                }`,
              );
            }
          }
        }
      }
    },
  },
  {
    /* 「例子按 api.md 的属性来、内容按插槽来、内部样式按 part 来」—— 代码里有的属性 / 事件 / 插槽 /
       part 都至少要有一个演示用到它（插槽与事件过去是盲区）。同一维度的变体合一条照样算覆盖。 */
    type: 'custom',
    id: 'demo-covers-api',
    title: '组件文档 · 演示覆盖 api.md 的属性、事件、插槽与 part',
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
        for (const name of c.facts.union.events) {
          const bound = new RegExp(`on:${name}\\b|addEventListener\\(\\s*['"]${name}['"]`);
          if (!bound.test(text)) {
            problems.push(
              dir + '：事件 `' + name + '` 在组件代码里有，演示里一次都没监听（on:' + name + '）',
            );
          }
        }
        /* 有事件的组件必须有一节「事件回调」：光在别的演示里顺带绑一下不算 —— 事件的用法（载荷形状、
           什么时候发）得有一节自己的地方说（`mc-input` 的 input / change 一度只藏在「可清除」演示里）。 */
        if (c.facts.union.events.size) {
          const page = `packages/${c.slug}/page.html`;
          if (io.exists(page) && !/<h3>\s*事件回调\s*<\/h3>/.test(io.read(page))) {
            problems.push(
              page +
                '：有事件却没有「事件回调」演示区（' +
                [...c.facts.union.events].join(' / ') +
                '）—— 事件要在页面上演一遍',
            );
          }
        }
        for (const slot of c.facts.union.slots) {
          if (slot === '(默认)') continue; // 无名的默认插槽静态判不出来，也不值得判
          const quoted = ['slot="' + slot + '"', "slot='" + slot + "'"];
          if (!quoted.some((needle) => text.includes(needle))) {
            problems.push(
              dir +
                '：插槽 `' +
                slot +
                '` 在组件代码里有，演示里一次都没往里面放东西（slot="' +
                slot +
                '"）',
            );
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
       `'sm' | 'md' | 'lg'`（竖线在 md 表格里按 GFM 转义 `\|`，引擎 1.0.3 起认得）。
       只查 `名称 | 值 | 默认` 这种表（属性 / 配置），别的表不管。 */
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
    /* 「参考节只有表」的机械口径：四个参考节里只允许**表**，以及「后面跟着表的 h3」（多标签组件用它
       标哪张表属于哪个标签）。解释句的正当去向：机制 → 单元 README / 组件文件头；事实 → 并进表里。 */
    type: 'custom',
    id: 'api-tables-only',
    title: '组件文档 · API 规范的参考节里只有表',
    run: ({ io, components, problems }) => {
      const SECTIONS = new Set(['属性', '事件', '插槽', 'part']);
      for (const c of components) {
        const api = `packages/${c.slug}/api.md`;
        if (!io.exists(api)) continue;
        let inSection = false;
        let h3 = null; // { line, title }
        let tablesUnderH3 = 0;
        const closeH3 = () => {
          if (h3 && tablesUnderH3 === 0) {
            problems.push(
              `${api}:${h3.line}：「### ${h3.title}」下面没有表 —— 参考节里只放表` +
                `（解释句回单元 README / 组件文件头）`,
            );
          }
          h3 = null;
          tablesUnderH3 = 0;
        };
        io.read(api)
          .split('\n')
          .forEach((line, index) => {
            const h2 = line.match(/^##\s+(.+?)\s*$/);
            if (h2) {
              closeH3();
              inSection = SECTIONS.has(h2[1].replace(/`/g, '').trim());
              return;
            }
            if (!inSection) return;
            const h3Match = line.match(/^###\s+(.+?)\s*$/);
            if (h3Match) {
              closeH3();
              h3 = { line: index + 1, title: h3Match[1] };
              return;
            }
            if (!line.trim()) return;
            if (line.trimStart().startsWith('|')) {
              tablesUnderH3 += 1;
              return;
            }
            problems.push(
              `${api}:${index + 1}：参考节里只有表 —— 这一行是解释句` +
                `（机制回单元 README / 组件文件头，事实并进表里，坑进演示导语）`,
            );
          });
        closeH3();
      }
    },
  },
  {
    /* 多标签组件的 `属性` 节用 h3 分了标签，`插槽` / `part` 两节没有 —— 而引擎的 api-spec 对的是**并集**：
       两个标签各有默认插槽时名字会去重成一个 `（默认）`，整条漏掉也没人报。这条要求逐个标签点名。 */
    type: 'custom',
    id: 'api-multitag-slots-parts',
    title: '组件文档 · 多标签组件的插槽 / part 节要点名每个标签',
    run: ({ io, components, problems }) => {
      for (const c of components) {
        if (c.facts.perTag.size < 2) continue;
        const api = `packages/${c.slug}/api.md`;
        if (!io.exists(api)) continue;
        const text = io.read(api);
        const marks = [...text.matchAll(/^##\s+(.+?)\s*$/gm)];
        const sectionOf = (title) => {
          const at = marks.findIndex((mark) => mark[1].replace(/`/g, '').trim() === title);
          if (at < 0) return null;
          const end = at + 1 < marks.length ? marks[at + 1].index : text.length;
          return text.slice(marks[at].index, end);
        };
        for (const [title, kind, word] of [
          ['插槽', 'slots', '插槽'],
          ['part', 'parts', 'part'],
        ]) {
          const tags = [...c.facts.perTag]
            .filter(([, facet]) => facet[kind].size > 0)
            .map(([tag]) => tag);
          if (!tags.length) continue;
          const body = sectionOf(title) ?? '';
          for (const tag of tags) {
            /* `\b…(?![\w-])`：别让 `mc-collapse` 被 `mc-collapse-item` 顶包 */
            if (!new RegExp(`\\b${tag}(?![\\w-])`).test(body)) {
              problems.push(
                `${api}：「${title}」一节里没点到 \`${tag}\` —— 它有 ${word}，` +
                  `多标签组件要在说明里点名（并集对账看不出漏，见这条规则的注释）`,
              );
            }
          }
        }
      }
    },
  },
  {
    /* 组件单元的 README 是**入口卡**（目录里有什么、状态、相邻单元分工），不是接口文档。三件事：
       ① 有 api.md 的单元必须有 README.md（反之亦然）；② README 里不许出现接口节标题；③ 状态与 site-map 对账。 */
    type: 'custom',
    id: 'unit-readme',
    title: '组件单元 · README 入口卡（存在 / 不写接口事实 / 状态对账）',
    run: ({ io, components, problems }) => {
      /* ② README 里不许出现**接口**节标题 —— 属性 / 事件 / 插槽 / part 归 api.md（`方法` / `配置` /
         `插槽与 part` 是旧节名或别名），写了就是第二份会漂移的副本。⚠️ **令牌是唯一例外**，归 README。 */
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

      /* ④ 组件本体不许再长篇大论：头注释只留一行定位 + 指针，设计说明归 README 的「设计取舍」——
         这份文件是要经 CDN 发给使用者的产物，注释会一起发出去。行内注释不在其列（那些解释「这一行为什么这么写」）。 */
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
      /* 文档里的 `[…](…)` 链接，目标不存在就是断链 —— 坏链是**静默**的（读者点了没反应）。
         一条豁免：**代码块里的不算**（示例路径是给读者复制到别处的）；http(s) / mailto / 锚点不查。 */
      /* ⚠️ `io.listFiles` 收**单个** glob：传数组会拿到空列表 —— 规则变成「什么都不查还全绿」。 */
      const GLOBS = ['packages/**/*.md', 'docs/**/*.md', 'README.md'];
      const files = GLOBS.flatMap((g) => io.listFiles(g));

      for (const file of files) {
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
            /* 走 posix，不用 `path.resolve`：后者在 Windows 上给绝对路径（`D:\mosaic\…`），再拿去
               `io.exists` 拼一遍就变成 `D:\mosaic/D:\mosaic\…` —— 存在的链接全被报成断链。 */
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
    /* `mc-loading-bar` 默认**钉在视口顶部**，而组件文档页会把演示**一起渲染出来**：除了那一条，其余都
       必须 `position="static"`，否则永远压在整页顶上、还互相盖住（踩过一次，像「点完成不消失」）。 */
    type: 'custom',
    id: 'page-single-fixed-bar',
    title: '组件文档 · 钉在视口顶部的加载条最多一条',
    run: ({ io, components, problems }) => {
      for (const c of components) {
        /* ⚠️ `c.facts.files` 只有组件本体（页面与演示不在里面）—— 页面按约定、演示走 glob */
        const files = [
          `packages/${c.slug}/page.html`,
          ...io.listFiles(`packages/${c.slug}/demos/*.html`),
        ].filter((f) => io.exists(f));
        const fixed = [];
        for (const file of files) {
          for (const tag of io.read(file).matchAll(/<mc-loading-bar\b[^>]*>/g)) {
            if (!/position="static"/.test(tag[0])) fixed.push(file);
          }
        }
        if (fixed.length > 1) {
          problems.push(
            `packages/${c.slug}：钉在视口顶部的加载条有 ${fixed.length} 条 —— 一页只该有一条，` +
              `其余写 \`position="static"\` 放进演示区（涉及 ${[...new Set(fixed)].join('、')}）`,
          );
        }
      }
    },
  },
];

/** check:docs 的总组数 = 每个面一条 + 每条规则一条 + 自检一条；文档里写「N 组全绿」按它对账。
 *  ⚠️ 加 / 删面或规则时，`tests/site/13-docs-drift.mjs` 的 `EXPECTED_GROUPS` 要同步（故意不从这里推）。 */
const GROUP_COUNT = [apiSpec, unitTokens, pageSkeleton, pageDemos].length + rules.length + 1;

export default {
  code,
  // `page-api`（页面手写参考表格 ↔ 代码）已随 S3 删除；接口事实由 `api-spec` 守，防回潮由 rules 里两条 custom 守。
  surfaces: [apiSpec, unitTokens, pageSkeleton, pageDemos],
  rules,
};
