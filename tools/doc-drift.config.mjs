/**
 * Mosaic 的「文档 ↔ 代码」约定 —— 就是把仓库的规矩写成数据。
 *
 * 引擎在 `tools/doc-drift/`（从 skill 拷进来的通用副本，零仓库知识）。
 * **改这里的约定（文件放哪、表头叫什么、什么算豁免、哪些数字要对账）只动这份配置**；
 * 除非出现全新的代码写法，才需要动引擎（见 SKILL.md）。
 *
 * 跑：`pnpm check:docs`（= `node tools/doc-drift/drift.mjs`）。
 */

import { READY, slugOf } from '../docs/site-map.js';
import { componentSuites, siteSuites } from '../tests/lib/suites.mjs';

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

/** 开发文档：组件 API 规范（agent/api/<slug>.md），每组件一份 */
const apiSpec = {
  id: 'api-spec',
  title: '开发文档 · 逐组件 API 规范（agent/api/*.md ↔ 组件代码）',
  kind: 'markdown',
  files: 'agent/api/{slug}.md',
  missing: '已实现的组件在 API 规范里必须逐组件一份',
  tables: [
    { header: ['名称', '值', '默认'], facet: 'attrs', name: 0, default: 2 },
    // 令牌表在这仓里有两种形状（`令牌 / 默认 / 作用` 与 `令牌 / 作用`）——
    // 表头按前缀匹配，所以只声明第一列就两种都收
    { header: ['令牌'], facet: 'tokens', name: 0 },
    { header: ['名称', '类型', '说明'], facet: 'events', name: 0 },
    // 插槽与 part 同一张表：裸名字按代码事实归类，省得猜错种类
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

/** 组件文档：参考区表格 ↔ 代码 */
const pageApi = {
  id: 'page-api',
  title: '组件文档 · 参考区表格 ↔ 组件代码',
  kind: 'html',
  files: 'packages/{slug}/page.html',
  // 多标签包（collapse / menu / breadcrumb）用 <h3>mc-x</h3> 分节
  tagSections: '^mc-[\\w-]+$',
  sections: {
    属性: { header: ['名称', '值', '默认', '说明'], facet: 'attrs', name: 0, default: 2 },
    事件: { header: ['名称', '类型', '说明'], facet: 'events', name: 0 },
    '插槽与 part': {
      header: ['名称', '说明'],
      facet: 'slotsParts',
      name: 0,
      bareNames: 'codeFacts',
    },
    插槽: { header: ['名称', '说明'], facet: 'slotsParts', name: 0, bareNames: 'sectionTitle' },
    part: { header: ['名称', '说明'], facet: 'slotsParts', name: 0, bareNames: 'sectionTitle' },
  },
  // 「标题说实话」：只有 part 就不能写成「插槽与 part」
  slotPartTitle: true,
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
    skipFiles: ['agent/docs-refactor.md', 'agent/research/*'],
    historyWords: '已删|删掉|删了|曾是|曾经|原来|以前|不再|去掉|旧版|history',
    placeholder: '[{}<>*…$|@=()!?#]',
    placeholderSegment: '^(?:x|y|z|n|xxx|yyy|name|slug|foo|bar|baz)$',
    topDirs: ['packages', 'tools', 'docs', 'tests', 'agent'],
    // 规范里给「还没实现的组件」写文件名，是在定接口，不算脱节
    plannedSpec: { filePattern: '^agent/api/([\\w-]+)\\.md$' },
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
        pattern: '(\\d+)\\s*个站点套件',
        files: ['agent/**/*.md', 'README.md', 'tests/smoke.mjs', 'tests/select.mjs'],
        actual: () => siteSuites().length,
      },
      {
        label: '个组件套件',
        pattern: '(\\d+)\\s*个组件套件',
        files: ['agent/**/*.md', 'README.md', 'tests/smoke.mjs', 'tests/select.mjs'],
        actual: () => componentSuites().length,
      },
    ],
  },
];

export default {
  code,
  surfaces: [apiSpec, pageSkeleton, pageApi, pageDemos],
  rules,
};
