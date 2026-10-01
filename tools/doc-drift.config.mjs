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
    // 事件与方法同一张表：带调用语法的行（`show()`）按方法对账，其余按事件（`callRows`，引擎 1.1.0）
    { header: ['名称', '类型', '说明'], facet: 'events', name: 0, callRows: true },
    // 插槽与 part 各自一节、名字写裸的；归哪一类按代码事实判（`插槽与 part` 那个合并节名 2026-10 去掉）
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
    /* 下表是参考区顺序，列的是当前用到的**全部**参考节名；顺序断言由引擎 1.0.1 起真正生效
       （1.0.0 里它是恒成立的死断言）。
       加新节名（比如将来由 md 渲染出来的「令牌」）时，按位置把名字补进这张表。 */
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

/* ------------------------------------------------------------------ *
 * 仓库特有的账（声明式规则）
 * ------------------------------------------------------------------ */

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
        /* 「370 个工具类」这种数字以前没人守：改了 utilities.css 或换了图标它就悄悄过期。
           口径写死成「mosaic.css 里 **mosaic.utilities 层**以 . 开头的选择器行数」——
           与文档用词「N 条工具类规则」一一对应。⚠️ 必须限定在这一层：不限定的话
           50 条图标规则（.mc-icon-*）会被一起算进来。 */
        label: '条工具类规则',
        // 只认「当前 / 现为 / 管线（N 条…」这种**报数**的写法；
        // 别处「实测白产出过 4 条工具类规则」讲的是另一件事，别误伤
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
       **插槽与 part 各自一节**（2026-10 收起节名：api.md 只认 属性 / 事件 / 插槽 / part 四个），
       名字写裸的；代码里没有哪一类，就整节省略。
       另外盯着「名字别串节」—— 裸名字之后，插槽写进 part 节（或反过来）光看表是看不出来的。 */
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
        /* 按 h2 位置切块，别用 `(?=^##|...)` 那种正则 —— 多行模式下 `\s*$` 恒真，
           切出来的节只有一行，整条守卫会安静地失效（写这条时踩过一次）。 */
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
    /* 「例子按 api.md 的属性来、内容按插槽来、内部样式按 part 来」—— 演示和接口不许脱节：
       组件代码里有的属性 / 命名插槽 / part，都至少要有一个演示真的用到它。
       ⚠️ 插槽也是**接口的一部分**（api.md 的表里承诺了），但这一面过去是盲区：属性与 part 有覆盖线、
       插槽没有 —— `mc-table` 的 empty / loading 两个槽就一度零演示。
       ⚠️ 这是**最低覆盖线**，不是「一条演示只讲一个属性」：同一维度的变体（三档尺寸、六个颜色）
       合一条照样算覆盖；反过来，加了属性 / 插槽 / part 却没有演示，这里就红。 */
    type: 'custom',
    id: 'demo-covers-api',
    title: '组件文档 · 演示覆盖 api.md 的属性、插槽与 part',
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
    /* 「参考节只有表」过去没有守卫（README 自己写着「解释句靠落笔时自查」）—— 2026-10 清点时
       17 个文件在参考节里混了解释句 / 代码块（alert 的「没有 size」段、scroll-bar 的三条
       blockquote、message 的两个 h3 段…），而且页面上真的渲染出来。现在把它变成机械口径：
       四个参考节里只允许**表**，以及「后面跟着表的 h3」（多标签组件用它标哪张表属于哪个标签）。
       解释句的正当去向：机制 → 单元 README / 组件文件头；事实 → 并进表里或写进演示导语。 */
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
    /* 组件单元的 README 是**入口卡**（目录里有什么、状态、相邻单元分工），不是接口文档。
       三件事盯住它别越线、别烂：
         ① 有 api.md 的单元必须有 README.md（反过来也一样）；
         ② README 里不许出现任何接口节标题 —— 那些归 api.md，写了就是第二份会漂移的副本；
         ③ 状态（M 几）与 site-map.js 对账 —— 这是 README 里唯一允许重复的「事实」。 */
    type: 'custom',
    id: 'unit-readme',
    title: '组件单元 · README 入口卡（存在 / 不写接口事实 / 状态对账）',
    run: ({ io, components, problems }) => {
      /* ② README 里不许出现**接口**节标题 —— 属性 / 事件 / 插槽 / part 归 api.md（2026-10 起
         只有这四个节名；`方法` / `配置` / `插槽与 part` 也一并拦着，那是旧节名或它们的别名），
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

         一条豁免（缺了就会误报）：**代码块里的不算** —— 组件文档里的示例路径
         （`packages/badge/badge.html`）是给读者**复制到别处**用的，按当前文件解析必然不存在。
         http(s) / mailto / 纯锚点本来就不查。 */
      /* ⚠️ `io.listFiles` 收**单个** glob 字符串，不收数组 —— 传数组会拿到空列表，
         这条规则就变成「什么都不查还全绿」。逐条 flatMap，和引擎里的写法保持一致。 */
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
    /* `mc-loading-bar` 默认**钉在视口顶部**，而一个组件文档页会把它的演示**一起渲染出来** ——
       所以除了那一条（通常就在「开始与完成」那个演示里），其余每一条都必须 `position="static"`
       放进演示区。留两条 fixed 的就会永远压在整页顶上、还互相盖住：踩过一次
       （出错演示里那条交互条子默认 fixed 且一上来就 loading，整页顶部常驻一条，
       看起来就像「点了完成也不消失」——其实是另一条）。 */
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
 *  ⚠️ **在上面加 / 删面或规则时，`tests/site/13-docs-drift.mjs` 的 `EXPECTED_GROUPS` 要同步** ——
 *  那个常量是写死的，故意不从这里推（推出来那条守卫就恒成立、等于没有）；它专门抓「配置里少了
 *  一整个面 / 一条规则」。漏跟的代价就是 13 号套件一路红着（踩过：`page-notes` 与
 *  `page-single-fixed-bar` 这两条规则加进来时，常量还停在 16）。 */
const GROUP_COUNT = [apiSpec, unitTokens, pageSkeleton, pageDemos].length + rules.length + 1;

export default {
  code,
  // `page-api`（页面手写参考表格 ↔ 代码）已随 S3 一并删除：11 页全部改由 md 渲染，
  // 那一面再留着就是「对 11 页全 skip」的空转 —— 接口事实由 `api-spec` 守，
  // 「挂了 doc-spec / 不许再手抄表格」由 rules 里两条 custom 守。
  surfaces: [apiSpec, unitTokens, pageSkeleton, pageDemos],
  rules,
};
