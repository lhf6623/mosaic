#!/usr/bin/env node
/**
 * drift.mjs —— 文档 ↔ 代码 对账引擎（通用，零仓库知识，零依赖）
 *
 * 这一份是**引擎**：它只会做三件事 —— 按配置读文档、按配置读代码、把两边的事实对起来。
 * 「文档长什么样、代码长什么样、哪个文件算哪个面、什么词算豁免」全部来自仓库里的 config，
 * 所以**改仓库约定 = 改 config，不需要动这个文件**。
 *
 * 唯一需要动引擎的情况：出现了一种全新的**代码写法**（现有 adapter 抽不出来）。
 * 那时在 lib/parse.mjs 的 ADAPTERS 里加一个小函数（约 5 行），config 里选用它。
 *
 * config 形状与配方见 ../references/config.md；mosaic 的实例见 ../recipes/mosaic.config.mjs。
 *
 * CLI：
 *   node drift.mjs                     在仓库根跑，自动找 doc-drift.config.mjs
 *   node drift.mjs --repo <dir>        指定仓库根
 *   node drift.mjs --config <file>     指定配置文件
 *   node drift.mjs --json              结构化输出
 *   node drift.mjs --only api-spec     只跑指定的组
 *   node drift.mjs --list              只列组名
 *
 * 退出码：0 = 全部对齐，1 = 有脱节，2 = 用法 / 配置错误。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ADAPTERS,
  DEFAULT_ADAPTERS,
  codeFacts,
  defaultsKeysOf,
  kebab,
  listAllEntries,
  listDirs,
  listFiles,
  mdTables,
  pageStructure,
  plain,
  resolveFrom,
  statementHasMarker,
} from './lib/parse.mjs';

export { ENGINE_VERSION } from './lib/version.mjs';
import { ENGINE_VERSION } from './lib/version.mjs';

/** 自动查找配置：这三个位置里第一个存在的 */
const CONFIG_CANDIDATES = [
  'doc-drift.config.mjs',
  'doc-drift.config.js',
  'tools/doc-drift.config.mjs',
  '.doc-drift/config.mjs',
];

/* ================================================================== *
 * 一、通用小工具
 * ================================================================== */

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

export function createIO(root) {
  const read = (rel) => readFileSync(`${root}/${rel}`, 'utf8');
  const exists = (rel) => existsSync(`${root}/${rel}`);
  let entries = null;
  const allEntries = () => (entries ??= listAllEntries(root));
  return {
    root,
    read,
    exists,
    listFiles: (glob) => listFiles(root, glob),
    listDirs: (glob) => listDirs(root, glob),
    allEntries,
    /** 路径的唯一后缀命中（散文里常省略前缀，如 `research/state.md`） */
    uniqueSuffix(token) {
      return allEntries().filter((path) => path === token || path.endsWith(`/${token}`));
    },
  };
}

/* ================================================================== *
 * 二、对账：文档面 vs 代码面
 * ================================================================== */

/** 「默认」列 → 归一值（`—` / `-` / 空 → null） */ export const normalizeDefault = (cell) => {
  const text = String(cell).replace(/[`*]/g, '').trim();
  return text === '' || text === '—' || text === '-' || text === '–' ? null : text;
};

/**
 * 双向对账：代码有的必须在文档里（漏承诺），文档写的必须在代码里（死承诺），
 * 顺带对默认值 —— 只严一个方向：**代码里有非空默认，文档必须写出来且相等**。
 * 反向（代码 `''`/null、文档写一个「生效默认」，如 `hljs-theme` 的 `github`）是合法的。
 */
export function reconcile({
  label,
  doc,
  code,
  where,
  problems,
  allowDocOnly = new Set(),
  allowCodeOnly = new Set(),
}) {
  const docNames = doc instanceof Map ? new Set(doc.keys()) : new Set(doc);
  const codeNames = code instanceof Map ? new Set(code.keys()) : new Set(code);

  for (const name of codeNames) {
    if (docNames.has(name) || allowCodeOnly.has(name)) continue;
    problems.push(`${where}：代码里有 ${label} \`${name}\`，文档表里没有 —— 漏承诺`);
  }
  for (const name of docNames) {
    if (codeNames.has(name) || allowDocOnly.has(name)) continue;
    problems.push(`${where}：文档表里的 ${label} \`${name}\` 在组件代码里找不到 —— 死承诺`);
  }

  if (!(doc instanceof Map) || !(code instanceof Map)) return;
  for (const [name, meta] of code) {
    const docMeta = doc.get(name);
    if (!docMeta) continue;
    const codeDefault = meta.default;
    if (!codeDefault || codeDefault.kind === 'null' || codeDefault.kind === 'expr') continue;
    if (codeDefault.kind === 'string' && codeDefault.value === '') continue;
    if (docMeta.default === null) {
      problems.push(
        `${where}：\`${name}\` 代码默认是 \`${codeDefault.value}\`，文档「默认」列写的是 —`,
      );
    } else if (docMeta.default !== String(codeDefault.value)) {
      problems.push(
        `${where}：\`${name}\` 默认值对不上 —— 代码 \`${codeDefault.value}\`，文档 \`${docMeta.default}\``,
      );
    }
  }
}

/** 文档里的「插槽 / part」行 → { slots, parts, unresolved } */
export function slotsPartsOfRow(cell, resolveBare, markers = {}) {
  const slotWord = markers.slot ?? '插槽';
  const defaultWord = markers.default ?? '(?:插槽)?\\s*[（(]默认[）)]';
  const slots = new Set();
  const parts = new Set();
  const unresolved = new Set();

  for (const match of cell.matchAll(/part="([^"]+)"/g)) {
    for (const name of match[1].split(/\s+/).filter(Boolean)) parts.add(name);
  }
  if (new RegExp(defaultWord).test(cell)) slots.add('(默认)');
  const named = cell.match(new RegExp(`${slotWord}\\s*\`?([a-z][\\w-]*)\`?`));
  if (named) slots.add(named[1]);

  if (slots.size === 0 && parts.size === 0) {
    const bare = cell.replace(/[`*]/g, '').trim();
    if (/^[a-z][\w-]*$/.test(bare)) {
      const guess = resolveBare(bare);
      for (const name of guess.slots) slots.add(name);
      for (const name of guess.parts) parts.add(name);
      if (!guess.slots.length && !guess.parts.length) unresolved.add(bare);
    }
  }
  return { slots, parts, unresolved };
}

/** 令牌单元格 → 令牌名（含 `` `--mc-a-b` / `-c` `` 这种后缀简写） */
export function tokensOfCell(cell) {
  const out = [];
  let last = null;
  for (const raw of String(cell).split('/')) {
    const part = raw.replace(/[`*]/g, '').trim();
    const whole = part.match(/--[\w-]+/);
    if (whole) {
      const token = whole[0].replace(/-+$/, '');
      out.push(token);
      last = token;
      continue;
    }
    if (last && /^-[a-z]+$/.test(part)) out.push(last.replace(/-[a-z]+$/, part));
  }
  return out;
}

/* ================================================================== *
 * 三、文档面 → 事实
 * ================================================================== */

const emptyFacets = () => ({
  attrs: new Map(),
  events: new Set(),
  /** 方法：事件表里带调用语法的那些行（spec.callRows 打开时才收） */
  methods: new Set(),
  slots: new Set(),
  parts: new Set(),
  tokens: new Set(),
  unresolved: [],
});

/**
 * 表头匹配：**按前缀**比 —— config 只声明它关心的前几列
 * （属性表声明 `名称 / 值 / 默认`，而文档里常常还有 `说明` 一列；多出来的列不算不匹配）。
 */
export const headerMatches = (expected, actual) =>
  Array.isArray(expected) &&
  expected.length > 0 &&
  expected.every((cell, index) => actual[index] === cell);

/**
 * 按 config 的表规格，从「已经选好的表」里抽事实。
 * `spec` 决定这一列是哪个面、名字在第几列、默认值在第几列、裸名字怎么归类。
 */
function facetsFromTables(tables, specs, facts) {
  const out = emptyFacets();

  const resolveBareFor = (spec) => (name) => {
    const slot = name === '（默认）' || name === '(默认)' ? '(默认)' : name;
    if (spec.bareNames === 'sectionTitle' && spec.sectionFacet === 'slots') {
      return { slots: [slot], parts: [] };
    }
    if (spec.bareNames === 'sectionTitle' && spec.sectionFacet === 'parts') {
      return { slots: [], parts: [name] };
    }
    // codeFacts（混合节 / markdown）：按代码事实归类，省得猜错种类
    const inSlots = facts.union.slots.has(slot);
    const inParts = facts.union.parts.has(name);
    if (inSlots && inParts) return { slots: [slot], parts: [name] };
    if (inSlots) return { slots: [slot], parts: [] };
    if (inParts) return { slots: [], parts: [name] };
    return { slots: [], parts: [] };
  };

  for (const table of tables) {
    for (const spec of specs) {
      if (spec.__tableHeader && !headerMatches(spec.__tableHeader, table.header)) continue;
      const target = out;
      for (const row of table.rows) {
        const cell = row.cells[spec.name ?? 0] ?? '';
        if (spec.facet === 'attrs') {
          const name = cell.replace(/[`*]/g, '').trim();
          if (!/^[a-z][\w-]*$/.test(name)) continue;
          target.attrs.set(spec.kebab === false ? name : kebab(name), {
            default: normalizeDefault(row.cells[spec.default ?? 1] ?? ''),
            line: row.line,
          });
        } else if (spec.facet === 'events') {
          const name = cell.replace(/[`*]/g, '').trim();
          if (!name) continue;
          /* `callRows`：事件表里带调用语法的行（`` `show()` `` / `` `message(text, config?)` ``）
             是**方法**不是事件 —— 归到 methods 这一面，按源码里出现过的标识符对账。
             仓库把「方法」并进「事件」一张表，靠这个开关才不会被当成死承诺。 */
          if (spec.callRows && /\(/.test(name)) {
            for (const match of name.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g))
              target.methods.add(match[1]);
            continue;
          }
          target.events.add(name);
        } else if (spec.facet === 'tokens') {
          for (const token of tokensOfCell(cell)) target.tokens.add(token);
        } else if (spec.facet === 'slotsParts') {
          const { slots, parts, unresolved } = slotsPartsOfRow(
            cell,
            resolveBareFor(spec),
            spec.markers,
          );
          for (const name of slots) target.slots.add(name);
          for (const name of parts) target.parts.add(name);
          for (const name of unresolved) target.unresolved.push({ name, line: row.line });
        }
      }
    }
  }
  return out;
}

/** 按期望表头找表（markdown 面：同一份文件里可能有多张表，按表头认） */
function matchTablesByHeader(tables, header) {
  return tables.filter((table) => headerMatches(header, table.header));
}

/* ================================================================== *
 * 四、组件模型
 * ================================================================== */

/** 建组件清单：roots 里的每个目录 = 一个组件，entry 存在才算数 */
export function buildComponents(io, config) {
  const code = config.code ?? {};
  const componentConfig = code.components ?? {};
  const roots = componentConfig.roots ?? [];
  const dirs = [];
  for (const pattern of roots) for (const dir of io.listDirs(pattern)) dirs.push(dir);

  const slugs = [...new Set(dirs.map((dir) => dir.split('/').filter(Boolean).pop()))];
  const imperativeList = componentConfig.imperative ?? [];
  const components = [];

  for (const slug of slugs.sort()) {
    const dir = dirs.find((candidate) => candidate.endsWith(`/${slug}`)) ?? slug;
    const facts = codeFacts({
      root: io.root,
      dir,
      slug,
      // 组件发现（roots / entry / module / imperative）在 code.components 下，
      // 抽取规则（facets / tagPattern / tokenPrefix）在 code 上 —— 合起来喂给抽取器
      code: {
        ...code,
        entry: componentConfig.entry ?? [],
        module: componentConfig.module ?? [],
      },
    });
    if (!facts.files.length) continue; // 目录存在但没有组件本体（如 boot/ color/）
    components.push({
      slug,
      dir,
      facts,
      tag: facts.tags[0] ?? null,
      imperative: imperativeList.includes(slug),
      stage: componentConfig.stageOf?.(slug) ?? null,
    });
  }
  return components;
}

/** config 里写的是 `packages/{slug}/page.html` 这种模板 */
const fill = (pattern, vars) =>
  String(pattern).replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? vars[key] : whole));

/* ================================================================== *
 * 五、声明式对账：固定面 + 组件 doc 面
 * ================================================================== */

/** 原生命令事件默认不算「死承诺」（config 可覆盖） */
export const DEFAULT_NATIVE_EVENTS = new Set([
  'click',
  'input',
  'change',
  'focus',
  'blur',
  'keydown',
  'keyup',
  'submit',
  'reset',
  'scroll',
]);

/** 一个文档面（surface）对一次账 */
function runSurface({ io, config, surface, component, problems, notes }) {
  const vars = { slug: component.slug, dir: component.dir, tag: component.tag ?? '' };
  const file = fill(surface.files, vars);
  if (!io.exists(file)) {
    if (surface.missing) problems.push(`${file}：${surface.missing}`);
    return;
  }

  const text = io.read(file);
  const kind = surface.kind ?? 'markdown';
  const facts = component.facts;
  const nativeEvents = new Set(config.exemptions?.nativeEvents ?? DEFAULT_NATIVE_EVENTS);

  if (kind === 'html') {
    const { tables, headings } = pageStructure(text);
    checkSkeleton({ surface, text, headings, file, problems });
    checkDemos({ io, surface, text, file, component, problems });
    if (component.imperative || !surface.sections) return;

    const byTag = new Map(facts.tags.map((tag) => [tag, emptyFacets()]));
    const shared = emptyFacets();
    const tagSectionRe = surface.tagSections ? new RegExp(surface.tagSections) : null;

    for (const [title, raw] of Object.entries(surface.sections)) {
      const sectionTables = tables.filter((table) => table.h2 === title);
      if (!sectionTables.length) continue;
      const spec = sectionSpec(raw, title);
      const matched = matchTablesByHeader(sectionTables, spec.header);
      // 一个节里可以另有事实表（code 页的「传值方式」、menu 页的「宿主钩子」）；
      // 但至少得有一张标准口径的表，否则这一节没写成表。
      if (raw.headerRequired !== false && !matched.length) {
        problems.push(
          `${file}:${sectionTables[0].line}：「${title}」一节里没有表头为 ${spec.header.join(' / ')} 的表`,
        );
        continue;
      }
      for (const table of matched) {
        const isTagSection = Boolean(tagSectionRe && table.h3 && tagSectionRe.test(table.h3));
        if (isTagSection && !byTag.has(table.h3)) {
          problems.push(
            `${file}:${table.line}：分节标题 <h3>${table.h3}</h3> 在组件代码里没有对应标签`,
          );
          continue;
        }
        const target = isTagSection ? byTag.get(table.h3) : shared;
        mergeFacets(target, facetsFromTables([table], [spec], facts));
      }
    }

    const groups = [...byTag.entries()].filter(([, facet]) => facetSize(facet) > 0);
    runFacetGroups({
      groups,
      shared,
      facts,
      file,
      problems,
      nativeEvents,
      facets: declaredFacets(surface),
      notes,
      label: (tag) => (tag ? `${file}（${tag}）` : file),
    });

    if (!surface.slotPartTitle) return;
    // 「标题说实话」：代码里有插槽 / part，这一节的标题就得对
    const hasSlots = facts.union.slots.size > 0;
    const hasParts = facts.union.parts.size > 0;
    const want =
      hasSlots && hasParts ? '插槽与 part' : hasSlots ? '插槽' : hasParts ? 'part' : null;
    const actual = tables.find((table) => /^插槽|^part/.test(table.h2 ?? ''))?.h2;
    if (want && actual !== want) {
      problems.push(
        `${file}：这一段 <h2> 应为「${want}」（代码里${hasSlots ? '有插槽' : '没插槽'}、${hasParts ? '有 part' : '没 part'}），实际是「${actual ?? '（缺这一节）'}」`,
      );
    }
    return;
  }

  /* ---------- markdown 面 ---------- */
  const tables = mdTables(text);

  if (component.imperative && surface.imperatives) {
    for (const [key, rule] of Object.entries(surface.imperatives)) {
      const matched = matchTablesByHeader(tables, rule.header);
      if (!matched.length) continue;
      const rows = matched.flatMap((table) => table.rows);
      if (rule.source === 'module' && rule.pattern === 'call') {
        for (const row of rows) {
          const cell = plain(row.cells[rule.name ?? 0] ?? '');
          if (rule.skipRow && new RegExp(rule.skipRow).test(cell)) continue;
          for (const match of cell.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)) {
            const name = match[1];
            if (name === component.slug || name.startsWith('mc')) continue;
            if (new RegExp(`\\b${name}\\b`).test(facts.moduleText)) continue;
            problems.push(`${file}:${row.line}：文档里的方法 \`${name}\` 在模块源码里找不到`);
          }
        }
        continue;
      }
      if (rule.source === 'module' && rule.pattern === 'defaultsKeys') {
        const keys = defaultsKeysOf(facts.moduleText, rule.const ?? 'DEFAULTS');
        const documented = new Set(
          rows
            .map((row) => (row.cells[rule.name ?? 0] ?? '').replace(/[`*]/g, '').trim())
            .filter(Boolean),
        );
        for (const key of keys) {
          if (!documented.has(key)) {
            problems.push(`${file}：源码 ${rule.const ?? 'DEFAULTS'} 里有 \`${key}\`，这一节没写`);
          }
        }
        continue;
      }
      void key;
    }
    return;
  }

  if (!surface.tables) return;
  const specs = surface.tables.map((spec) => ({
    ...spec,
    __tableHeader: spec.header,
  }));
  const doc = facetsFromTables(tables, specs, facts);
  for (const item of doc.unresolved) {
    problems.push(`${file}:${item.line}：${item.name} 既不是插槽也不是 part（代码里两边都没有）`);
  }

  runFacetGroups({
    groups: [],
    shared: doc,
    facts,
    file,
    problems,
    nativeEvents,
    facets: declaredFacets(surface),
    notes,
    label: () => file,
    allowCodeOnlyTokens: facts.internal,
  });
}

/**
 * 只对账「这份文档面自己声明了的面」—— 从 sections / tables 的 facet 推出来，不用多写一个开关。
 * 于是组件文档页（没有令牌表）不会被要求把 `--mc-tag-layer` 也写进页面
 * （令牌的账归 API 规范那一面管，见 doc-pages.md §一）。
 */
function declaredFacets(surface) {
  const specs = [...Object.values(surface.sections ?? {}), ...(surface.tables ?? [])];
  const facets = new Set();
  for (const spec of specs) {
    if (spec.facet === 'slotsParts') {
      facets.add('slots');
      facets.add('parts');
    } else if (spec.facet) facets.add(spec.facet);
    if (spec.callRows) facets.add('methods');
  }
  return facets;
}

const sectionSpec = (raw, title) => ({
  header: raw.header,
  name: raw.name ?? 0,
  default: raw.default,
  facet: raw.facet,
  bareNames: raw.bareNames,
  kebab: raw.kebab,
  markers: raw.markers,
  sectionFacet: raw.facet === 'slotsParts' ? sectionFacetOfTitle(title) : undefined,
});

const sectionFacetOfTitle = (title) =>
  /part/.test(title) && !/插槽/.test(title) ? 'parts' : 'slots';

const facetSize = (facet) =>
  facet.attrs.size +
  facet.events.size +
  facet.methods.size +
  facet.slots.size +
  facet.parts.size +
  facet.tokens.size;

/**
 * 「方法」这一面的代码侧：源码里出现过的标识符。
 * 刻意**宽松**（名字在源码里出现过就算有）—— 方法名家常写成 `message.closeAll()` /
 * `handle.done()` 这种带命名空间与参数的形式，严格解析既脆又收益小；
 * 反方向（源码里每个标识符都要求写进文档）不可能成立，所以那一侧整体放行。
 */
const sourceWords = (facts) =>
  new Set(`${facts.lines.join('\n')}\n${facts.moduleText ?? ''}`.match(/[A-Za-z_$][\w$]*/g) ?? []);

function mergeFacets(target, source) {
  for (const [name, meta] of source.attrs) target.attrs.set(name, meta);
  for (const name of source.events) target.events.add(name);
  for (const name of source.methods ?? []) target.methods.add(name);
  for (const name of source.slots) target.slots.add(name);
  for (const name of source.parts) target.parts.add(name);
  for (const name of source.tokens) target.tokens.add(name);
  for (const item of source.unresolved ?? []) target.unresolved.push(item);
}

/** 对账几个固定面（属性 / 事件 / 方法 / 插槽 / part / 令牌） */
function runFacetGroups({
  groups,
  shared,
  facts,
  file,
  problems,
  nativeEvents,
  facets,
  label,
  notes = [],
  allowCodeOnlyTokens = new Set(),
}) {
  const wanted = facets ?? new Set(['attrs', 'events', 'methods', 'slots', 'parts', 'tokens']);
  for (const [labelName, key] of [
    ['属性', 'attrs'],
    ['事件', 'events'],
    ['方法', 'methods'],
    ['插槽', 'slots'],
    ['part', 'parts'],
    ['令牌', 'tokens'],
  ]) {
    if (!wanted.has(key)) continue;
    const allowDocOnly = key === 'events' ? nativeEvents : new Set();
    const allowCodeOnly =
      key === 'tokens'
        ? allowCodeOnlyTokens
        : key === 'methods'
          ? sourceWords(facts)
          : new Set();
    // **豁免要说出来**：被放行的名字逐条记进 notes，绿的时候也打在报告里 ——
    // 不然「标个 @internal 就没人再提」会悄悄吃掉本来该登记的接口。
    if (allowCodeOnly.size) {
      const docNames = new Set([
        ...shared[key],
        ...groups.flatMap(([, facet]) => [...(facet[key] ?? [])]),
      ]);
      const exempted = [...allowCodeOnly].filter(
        (name) => facts.tokens.has(name) && !docNames.has(name),
      );
      if (exempted.length) {
        notes.push(
          `${file}：${exempted.length} 个令牌按内部实现放行（不要求进文档表）：${exempted.join(' / ')}`,
        );
      }
    }
    // 这一面在页面上按标签分了节 → 逐标签对；没分节（事件那种整包一节）→ 整包并集对。
    // 这样「mc-collapse 没有 open 事件」不会被误报成一个问题。
    const tagged = groups.filter(([, facet]) => facet[key]?.size > 0);
    if (tagged.length) {
      for (const [tag, facet] of tagged) {
        const codeFacet =
          key === 'tokens' ? facts.tokens : (facts.perTag.get(tag)?.[key] ?? new Set());
        reconcile({
          label: labelName,
          doc: facet[key],
          code: codeFacet,
          where: label(tag),
          problems,
          allowDocOnly,
          allowCodeOnly,
        });
      }
      continue;
    }
    const codeFacet =
      key === 'tokens'
        ? facts.tokens
        : key === 'attrs'
          ? facts.union.attrs
          : key === 'methods'
            ? sourceWords(facts)
            : key === 'slots' || key === 'parts' || key === 'events'
              ? facts.union[key]
              : new Set();
    reconcile({
      label: labelName,
      doc: shared[key],
      code: codeFacet,
      where: label(null),
      problems,
      allowDocOnly,
      allowCodeOnly,
    });
  }
}

/* ------------------------------------------------------------------ *
 * 骨架（html 面）
 * ------------------------------------------------------------------ */

function checkSkeleton({ surface, text, headings, file, problems }) {
  const skeleton = surface.skeleton;
  if (!skeleton) return;

  if (skeleton.root && !text.startsWith(skeleton.root)) {
    problems.push(`${file}：必须以 ${skeleton.root} 开头`);
  }
  if (skeleton.link && !new RegExp(`<link[^>]+href="[^"]*${skeleton.link}"`).test(text)) {
    problems.push(`${file}：缺少指向 ${skeleton.link} 的 <link rel="stylesheet">`);
  }
  if (skeleton.requireH1Code && !/<h1>[\s\S]*?<code>[\s\S]*?<\/code>[\s\S]*?<\/h1>/.test(text)) {
    problems.push(`${file}：页首 <h1> 里要用 <code> 写出组件标签 / API 名`);
  }
  for (const needle of skeleton.require ?? []) {
    if (!text.includes(needle)) problems.push(`${file}：缺少 ${needle}`);
  }
  if (skeleton.parentExport && !text.includes(skeleton.parentExport)) {
    problems.push(
      `${file}：没有挂到分区布局页（export const parent 里应含 ${skeleton.parentExport}）`,
    );
  }

  const h2 = headings.filter((heading) => heading.level === 2).map((heading) => heading.title);
  if (h2.length) {
    if (skeleton.firstH2 && h2[0] !== skeleton.firstH2) {
      problems.push(`${file}：第一个 <h2> 必须是「${skeleton.firstH2}」，现在是「${h2[0]}」`);
    }
    if (skeleton.lastH2 && h2.at(-1) !== skeleton.lastH2) {
      problems.push(`${file}：最后一个 <h2> 必须是「${skeleton.lastH2}」，现在是「${h2.at(-1)}」`);
    }
    if (new Set(h2).size !== h2.length) problems.push(`${file}：<h2> 有重复（${h2.join(' / ')}）`);
  }

  if (skeleton.referenceOrder) {
    const order = skeleton.referenceOrder;
    /* 取文档里**实际出现的顺序**（从 h2 取），再按声明顺序排一遍，两者不同就是乱序。
       ⚠️ 别写成 `order.filter((title) => h2.includes(title))`：那样 present 由 order 而来，
       天生就是声明顺序，再 sort 必然相等 —— 断言恒成立、永远不报（1.0.0 的 bug，1.0.1 修）。 */
    const present = h2.filter((title) => order.includes(title));
    const sorted = [...present].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (present.join(' → ') !== sorted.join(' → ')) {
      problems.push(
        `${file}：参考区顺序乱了 —— 应为 ${sorted.join(' → ')}，实际 ${present.join(' → ')}`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 演示区 ↔ demos/
 * ------------------------------------------------------------------ */

function checkDemos({ io, surface, text, file, component, problems }) {
  if (!surface.demos) return;
  const dir = fill(surface.demos.dir, { slug: component.slug, dir: component.dir });
  const onDisk = io.exists(dir)
    ? readdirSync(`${io.root}/${dir}`).filter((name) => /\.html$/.test(name))
    : [];
  const pattern = new RegExp(surface.demos.pattern ?? 'demos/[\\w.-]+\\.html', 'g');
  const selfTag = surface.demos.tagPattern ?? "tag:\\s*'([\\w-]+)'";

  const referenced = new Set();
  for (const match of text.matchAll(pattern)) {
    const name = match[0].split('/').pop();
    referenced.add(name);
    const target = resolveFrom(file, `./${match[0]}`);
    if (target && !io.exists(target)) {
      problems.push(`${file}:${lineOf(text, match.index)}：引用了不存在的演示文件 \`${match[0]}\``);
    }
  }
  for (const orphan of onDisk.filter((name) => !referenced.has(name))) {
    problems.push(`${dir}/${orphan} 没有任何文档页引用 —— 孤儿演示`);
  }

  if (!surface.demos.links) return;
  for (const match of text.matchAll(/<l-m\s+src="([^"]+)"/g)) {
    const target = resolveFrom(file, match[1]);
    if (target && !io.exists(target)) {
      problems.push(
        `${file}:${lineOf(text, match.index)}：<l-m src="${match[1]}"> 指向的文件不存在`,
      );
    }
  }

  const registered = new Set(
    onDisk.map((name) => io.read(`${dir}/${name}`).match(new RegExp(selfTag))?.[1]).filter(Boolean),
  );
  for (const match of text.matchAll(/<(demo-[\w-]+)[\s>]/g)) {
    if (registered.has(match[1])) continue;
    problems.push(
      `${file}:${lineOf(text, match.index)}：用了 <${match[1]}>，但 ${dir}/ 里没有注册它的文件`,
    );
  }
}

/* ================================================================== *
 * 六、可选规则（config.rules 声明式）
 * ================================================================== */

/** 组件索引表 ↔ 磁盘 / 真实状态 */
function runIndexRule({ io, config, rule, components, problems }) {
  const text = io.read(rule.file);
  const tables = mdTables(text).filter(
    (table) => table.header.join('/') === (rule.header ?? []).join('/'),
  );
  if (!tables.length) {
    problems.push(`${rule.file}：找不到索引表（表头应为 ${(rule.header ?? []).join(' / ')}）`);
    return;
  }
  if (tables.length > 1 && rule.single) {
    problems.push(
      `${rule.file}:${tables.map((t) => t.line).join(' / ')}：索引表出现了 ${tables.length} 份 —— 只能有一份，否则两份一定漂移`,
    );
  }

  const columns = rule.columns ?? { name: 0, tag: 1, dir: 2, stage: 3, status: 4 };
  const seen = new Map();
  for (const table of tables) {
    for (const row of table.rows) {
      const cell = (index) => row.cells[index] ?? '';
      if (!cell(columns.name) || !cell(columns.tag) || !cell(columns.status)) continue;
      const at = `${rule.file}:${row.line}`;
      const tags = [...cell(columns.tag).matchAll(/`([\w()-]+)`/g)].map((m) => m[1]);
      const dir = cell(columns.dir).match(/`([\w-]+)\/?`/)?.[1];
      const status = plain(cell(columns.status));
      if (!dir) {
        problems.push(`${at}：${plain(cell(columns.name))} 的目录列里没有可识别的目录名`);
        continue;
      }
      // 同一标签可被多行共用（`mc-menu-item` 挂在 Menu 与 Dropdown 下）→ 按「标签 + 目录」判重复
      for (const tag of tags) {
        const key = `${tag}@${dir}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }

      const entry = fill(rule.entry ?? 'packages/{dir}/{dir}.html', { dir, slug: dir });
      const implemented = status.includes(rule.implemented ?? '已实现');
      if (implemented && !io.exists(entry)) {
        problems.push(`${at}：状态写「${rule.implemented}」，但 ${entry} 不存在`);
      }
      if (!implemented && io.exists(entry)) {
        problems.push(`${at}：状态是「${status}」，但 ${entry} 已经存在 —— 状态没跟上实现`);
      }

      const component = components.find((item) => item.slug === dir);
      // 命令式组件的索引行写的是函数名（`message()`），标签列里没有 mc-* —— 那条不比对标签
      const declaredTags = tags.filter((tag) => tag.startsWith(rule.tagPrefix ?? 'mc-'));
      if (
        implemented &&
        component &&
        component.tag &&
        declaredTags.length &&
        !declaredTags.includes(component.tag)
      ) {
        problems.push(
          `${at}：索引写 ${declaredTags.join(' / ')}，${entry} 里的 tag 是 ${component.tag}`,
        );
      }
      if (rule.stageLabel && component?.stage && cell(columns.stage)) {
        const stage = plain(cell(columns.stage));
        if (stage && component.stage !== stage) {
          problems.push(`${at}：${rule.stageLabel}写 ${stage}，实际是 ${component.stage}`);
        }
      }
    }
  }

  for (const [key, count] of seen) {
    if (count > 1) {
      const [tag, dir] = key.split('@');
      problems.push(`${rule.file}：\`${tag}\` 在索引里出现了 ${count} 次（目录都是 ${dir}/）`);
    }
  }

  if (rule.mustList) {
    for (const component of components) {
      if (new RegExp(`\\b${component.slug}/`).test(text)) continue;
      problems.push(
        `${rule.file}：已实现的组件 ${component.slug}（packages/${component.slug}/）没有登记进索引`,
      );
    }
  }
}

/** 散文里点名的仓库路径 ↔ 真实存在 */
function runPathsRule({ io, config, rule, components, problems }) {
  const files = (rule.files ?? []).flatMap((glob) => io.listFiles(glob));
  const skip = (rule.skipFiles ?? []).map((glob) => new RegExp(`^${glob.replace(/\*/g, '.*')}$`));
  const historyWords = rule.historyWords ? new RegExp(rule.historyWords) : null;
  const placeholder = rule.placeholder ? new RegExp(rule.placeholder) : null;
  const placeholderSegment = rule.placeholderSegment
    ? new RegExp(rule.placeholderSegment, 'i')
    : null;

  const looksLikePath = (token) => {
    if (!/[/.]/.test(token)) return false;
    if (placeholder?.test(token)) return false;
    // 只对账**仓库内**的路径：`~/…` 与 `/…` 是机器上的位置（skill 安装路径之类），不归这条管
    if (token.startsWith('-') || token.startsWith('~') || token.startsWith('/')) return false;
    if (token.startsWith('http')) return false;
    if (
      placeholderSegment &&
      token.split('/').some((segment) => placeholderSegment.test(segment.replace(/\.[a-z]+$/, '')))
    ) {
      return false;
    }
    if (rule.topDirs && new RegExp(`^(?:${rule.topDirs.join('|')})/`).test(token)) return true;
    return /\.(?:md|html|js|mjs|css|json|ts|yaml|yml)$/.test(token) && token.includes('/');
  };

  for (const file of files) {
    if (skip.some((re) => re.test(file))) continue;
    const text = io.read(file);
    const lines = text.split('\n');
    // api.md 有两个住处，正则也就有两组：packages/<slug>/api.md（已实现）与
    // agent/api/<slug>.md（未实现的草案）—— 取第一个命中的分组（group = 备选组号）。
    const specSlug = rule.plannedSpec
      ? (() => {
          const m = file.match(new RegExp(rule.plannedSpec.filePattern));
          if (!m) return null;
          const g = rule.plannedSpec.group ?? 1;
          return m[1] ?? (g > 1 ? m[g] : null);
        })()
      : null;
    const planned = specSlug && !components.some((item) => item.slug === specSlug);

    for (const match of text.matchAll(/`([^`\n]+)`/g)) {
      const line = lineOf(text, match.index);
      if (historyWords?.test(lines[line - 1] ?? '')) continue;
      for (const raw of match[1].split(/\s+/)) {
        const token = raw.replace(/^[(（]+/, '').replace(/[，。、,.;:）)]+$/, '');
        if (!looksLikePath(token)) continue;
        if (planned && token.startsWith(`packages/${specSlug}/`)) continue;

        const lineRef = token.match(/^(.*?):(\d+(?:-\d+)?)$/);
        const bare = lineRef ? lineRef[1] : token;
        const candidates = [resolveFrom(file, bare), bare].filter(Boolean);
        if (candidates.some(io.exists)) continue;
        if (rule.suffixMatch !== false && io.uniqueSuffix(bare).length === 1) continue;
        if (lineRef && rule.foreignLineRef) {
          const m = bare.match(new RegExp(rule.foreignLineRef.pattern));
          if (m && !io.exists(fill(rule.foreignLineRef.check, { segment: m[1], slug: m[1] })))
            continue;
        }
        problems.push(`${file}:${line}：文档里点名的 \`${token}\` 不存在`);
      }
    }
  }
}

/** 文档里点名的命令 ↔ package.json 脚本 / 真实文件 */
function runCommandsRule({ io, rule, problems }) {
  const pkg = io.exists('package.json') ? JSON.parse(io.read('package.json')) : { scripts: {} };
  const builtins = new Set(rule.builtins ?? []);
  for (const file of (rule.files ?? []).flatMap((glob) => io.listFiles(glob))) {
    const text = io.read(file);
    for (const match of text.matchAll(
      new RegExp(`\\b${rule.runner ?? 'pnpm'}\\s+([\\w:.-]+)`, 'g'),
    )) {
      if (match[1] in (pkg.scripts ?? {}) || builtins.has(match[1])) continue;
      problems.push(
        `${file}:${lineOf(text, match.index)}：\`${rule.runner ?? 'pnpm'} ${match[1]}\` 不是 package.json 里的脚本`,
      );
    }
    if (rule.nodePaths === false) continue;
    for (const match of text.matchAll(/\bnode\s+((?:tools|tests|scripts)\/[\w./-]+\.mjs)/g)) {
      if (io.exists(match[1])) continue;
      problems.push(`${file}:${lineOf(text, match.index)}：\`node ${match[1]}\` 指向的文件不存在`);
    }
  }
}

/** fenced 目录树里的条目 ↔ 真实存在（按缩进还原路径） */
function runTreeRule({ io, rule, problems }) {
  const text = io.read(rule.file);
  // `\r?`：仓库里 md 可能是 CRLF（Windows 上 git 的 autocrlf），不认 \r 会永远匹配不上这个块
  const block = text.match(/```(?:text)?\r?\n([\s\S]*?)```/);
  if (!block) {
    problems.push(`${rule.file}：找不到目录树代码块`);
    return;
  }
  const startLine = lineOf(text, block.index) + 1;
  const commentChars = rule.commentChars ?? '#';
  const placeholder = rule.placeholder ? new RegExp(rule.placeholder) : null;
  const parents = [];
  block[1].split('\n').forEach((line, index) => {
    const branch = line.match(/^([│ ]*)(?:├──|└──)\s*(.*)$/);
    if (!branch) return;
    const depth = Math.floor(branch[1].length / 4);
    const entry = branch[2].split(new RegExp(`[${commentChars}]`))[0].trim();
    if (!entry || /\s/.test(entry) || placeholder?.test(entry)) return;
    const isDirEntry = entry.endsWith('/');
    const parent = parents[depth] ?? '';
    const path = parent ? `${parent}/${entry.replace(/\/$/, '')}` : entry.replace(/\/$/, '');
    if (isDirEntry) {
      parents[depth + 1] = path;
      parents.length = depth + 2;
      return;
    }
    if (!/\.(?:md|html|js|mjs|css|json|ts)$/.test(path)) return;
    if (io.exists(path)) return;
    problems.push(`${rule.file}:${startLine + index}：目录树里的 \`${path}\` 不存在`);
  });
}

/** 文档里写死的数字 ↔ 实际数量（actual 是 config 里的函数） */
function runCountsRule({ io, rule, problems }) {
  for (const claim of rule.claims ?? []) {
    const actual = typeof claim.actual === 'function' ? claim.actual({ io }) : claim.actual;
    if (!Number.isFinite(actual)) {
      problems.push(`配置错误：${rule.id ?? rule.title} 的「${claim.label}」没给出可用的 actual`);
      continue;
    }
    for (const file of (claim.files ?? []).flatMap((glob) => io.listFiles(glob))) {
      const text = io.read(file);
      for (const match of text.matchAll(new RegExp(claim.pattern, 'g'))) {
        const claimed = Number(match[1]);
        if (claimed === actual) continue;
        problems.push(
          `${file}:${lineOf(text, match.index)}：写的是 ${claimed} ${claim.unit ?? ''}${claim.label}，实际是 ${actual}`,
        );
      }
    }
  }
}

const RULES = {
  index: runIndexRule,
  paths: runPathsRule,
  commands: runCommandsRule,
  tree: runTreeRule,
  counts: runCountsRule,
  /** 逃生口：仓库特有、前几类都装不下的账，config 里直接写函数。
      签名与其它规则一致，收到的是展开后的那几个字段（不是嵌套的 `api`）。 */
  custom: ({ io, config, components, rule, problems }) =>
    rule.run({ io, config, components, rule, problems }),
};

/* ================================================================== *
 * 七、守卫自检：解析规则真的在判
 * ================================================================== */

/** 引擎自带的自检：正则一坏，整份守卫会「安静地全绿」，那是它最坏的失效方向 */
export function selfTest(problems) {
  const same = (label, actual, wanted) => {
    const got = JSON.stringify(actual);
    const want = JSON.stringify(wanted);
    if (got !== want) problems.push(`自检「${label}」不成立：得到 ${got}，期望 ${want}`);
  };
  const sorted = (iterable) => [...iterable].sort();

  const component = `<template component>
    <script>export default () => ({ tag: 'mc-demo', attrs: { color: 'primary', disabled: null, hljsBase: '' } });</script>
  </template>`;

  same(
    'attrs 解析（camelCase → kebab、null 默认）',
    sorted(ADAPTERS.attrsObject(component, { kebabAttrs: true }).keys()),
    ['color', 'disabled', 'hljs-base'],
  );
  same('attrs 默认值字面量', ADAPTERS.attrsObject(component, { kebabAttrs: true }).get('color'), {
    default: { kind: 'string', value: 'primary' },
  });
  same(
    'emit（含三元）与 new CustomEvent 的事件名',
    sorted([
      ...ADAPTERS.emitCall(`this.emit(open ? 'open' : 'close', { bubbles: true });`),
      ...ADAPTERS.newEvent(`this.ele.dispatchEvent(new CustomEvent('before-open', {}));`),
    ]),
    ['before-open', 'close', 'open'],
  );
  same(
    '插槽名（含无名默认插槽）',
    sorted(ADAPTERS.slotElement(`<slot></slot><slot name="panel">`)),
    ['(默认)', 'panel'],
  );
  same(
    'part 的三种写法',
    sorted([
      ...ADAPTERS.partAttribute(`<div part="base list"></div>`),
      ...ADAPTERS.setAttributePart(`x.setAttribute('part', 'body');`),
      ...ADAPTERS.partProperty(`y.part = 'close';`),
    ]),
    ['base', 'body', 'close', 'list'],
  );

  const tokenTable = mdTables(
    '| 令牌 | 默认 | 作用 |\n| --- | --- | --- |\n| `--mc-demo-a` / `-b` | — | x |\n',
  )[0];
  same('令牌表里的 `-b` 后缀简写要展开', sorted(tokensOfCell(tokenTable.rows[0].cells[0])), [
    '--mc-demo-a',
    '--mc-demo-b',
  ]);

  same(
    '「插槽（默认）」行只算插槽',
    (() => {
      const row = slotsPartsOfRow('插槽（默认）', () => ({ slots: [], parts: [] }));
      return { slots: sorted(row.slots), parts: sorted(row.parts) };
    })(),
    { slots: ['(默认)'], parts: [] },
  );

  // 内部标记要经得起折行：格式化工具会把尾注挪到下一行的 `);` 后面（实测踩过）
  const wrapped = [
    '      content: var(',
    '        --mc-demo-token,',
    '        var(--mc-demo-other)',
    '      ); /* @internal：说明 */',
    '      color: var(--mc-demo-public);',
  ].join('\n');
  same(
    '折行后 @internal 仍然认得出（按声明判，不按行判）',
    [
      statementHasMarker(wrapped, wrapped.indexOf('--mc-demo-token'), '@internal'),
      statementHasMarker(wrapped, wrapped.indexOf('--mc-demo-other'), '@internal'),
      statementHasMarker(wrapped, wrapped.indexOf('--mc-demo-public'), '@internal'),
    ],
    [true, true, false],
  );

  const codeOnly = [];
  reconcile({
    label: '属性',
    doc: new Map(),
    code: new Map([['x', { default: { kind: 'null' } }]]),
    where: 'w',
    problems: codeOnly,
  });
  if (codeOnly.length !== 1) problems.push('自检「代码有、文档没有」这一向没报出来');
  const docOnly = [];
  reconcile({
    label: '属性',
    doc: new Map([['y', { default: null }]]),
    code: new Map(),
    where: 'w',
    problems: docOnly,
  });
  if (docOnly.length !== 1) problems.push('自检「文档有、代码没有」这一向没报出来');
}

/* ================================================================== *
 * 八、总装与报告
 * ================================================================== */

export function audit({ root, config }) {
  const io = createIO(root);
  const components = buildComponents(io, config);
  const groups = [];

  for (const surface of config.surfaces ?? []) {
    const problems = [];
    const notes = [];
    for (const component of components) {
      runSurface({ io, config, surface, component, problems, notes });
    }
    groups.push({ id: surface.id, title: surface.title, ok: !problems.length, problems, notes });
  }

  const api = { io, config, components, problems: [] };
  for (const rule of config.rules ?? []) {
    const run = RULES[rule.type];
    const problems = [];
    if (!run) {
      problems.push(`配置错误：未知的规则类型 \`${rule.type}\``);
    } else {
      run({ ...api, rule, problems });
    }
    groups.push({
      id: rule.id ?? rule.type,
      title: rule.title ?? rule.type,
      ok: !problems.length,
      problems,
    });
  }

  const selfProblems = [];
  selfTest(selfProblems);
  groups.push({
    id: 'guard-self',
    title: '守卫自检（解析规则真的在判，不是安静地全绿）',
    ok: !selfProblems.length,
    problems: selfProblems,
  });

  return groups;
}

export function formatReport(groups) {
  const lines = [];
  for (const group of groups) {
    lines.push(`${group.ok ? '✓' : '✗'} ${group.title}`);
    for (const problem of group.problems) lines.push(`    · ${problem}`);
    // 绿也把豁免打出来：放行了什么，读者有权利知道
    for (const note of group.notes ?? []) lines.push(`    ↷ ${note}`);
  }
  const failed = groups.filter((group) => !group.ok);
  lines.push('');
  lines.push(
    failed.length
      ? `${failed.length}/${groups.length} 组对不上 —— 文档和代码脱节了，逐条见上。`
      : `${groups.length} 组全部对齐：文档写的东西代码里都有，代码有的文档都写了。`,
  );
  return lines.join('\n');
}

/** 找配置文件；找不到返回 null */
export function findConfig(root, explicit) {
  if (explicit) {
    const path = isAbsolute(explicit) ? explicit : resolve(root, explicit);
    return existsSync(path) ? path : null;
  }
  for (const candidate of CONFIG_CANDIDATES) {
    if (existsSync(`${root}/${candidate}`)) return `${root}/${candidate}`;
  }
  return null;
}

export async function loadConfig(root, explicit) {
  const path = findConfig(root, explicit);
  if (!path) return { path: null, config: null };
  const mod = await import(pathToFileURL(path).href);
  return { path, config: mod.default ?? mod.config };
}

function parseArgv(argv) {
  const take = (name) => {
    const at = argv.indexOf(name);
    if (at < 0) return undefined;
    const value = argv[at + 1];
    argv.splice(at, value === undefined ? 1 : 2);
    return value;
  };
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  return {
    repo: take('--repo'),
    config: take('--config'),
    only: take('--only'),
    json: flags.has('--json'),
    list: flags.has('--list'),
    version: flags.has('--version'),
    flags,
  };
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  if (args.version) {
    process.stdout.write(`doc-code-drift engine ${ENGINE_VERSION}\n`);
    return;
  }
  const root = resolve(args.repo ?? process.cwd());
  const { path, config } = await loadConfig(root, args.config);
  if (!config) {
    process.stderr.write(
      `找不到配置。用法：node drift.mjs [--repo <dir>] [--config <file>]\n` +
        `默认会找：${CONFIG_CANDIDATES.join(' / ')}\n` +
        `配置形状见 references/config.md。\n`,
    );
    process.exit(2);
  }

  let groups = audit({ root, config });
  if (args.only) {
    const wanted = new Set(
      String(args.only)
        .split(',')
        .map((s) => s.trim()),
    );
    groups = groups.filter((group) => wanted.has(group.id));
  }

  if (args.list) {
    for (const group of groups) process.stdout.write(`${group.id}\t${group.title}\n`);
    return;
  }
  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ engine: ENGINE_VERSION, config: path, groups }, null, 2)}\n`,
    );
  } else {
    process.stdout.write(`${formatReport(groups)}\n`);
  }
  process.exit(groups.every((group) => group.ok) ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
