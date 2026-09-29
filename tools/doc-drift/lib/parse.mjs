/**
 * parse.mjs —— 文档 / 代码的通用解析原语。**零仓库知识**：
 * 这里只认「Markdown 表」「HTML 页」「JS/HTML 组件源码」三种形态，
 * 具体是哪些文件、表头叫什么、怎么抽事实，全部由调用方（config）说了算。
 *
 * 分成三块：
 *   ① glob / 路径：把 config 里的 pattern 变成真实文件清单；
 *   ② 文档：Markdown 表、HTML 页结构（标题 + 表格 + 所属节）；
 *   ③ 代码：按 adapter 名字从组件源码里抽接口事实（attrs / events / slots / parts / tokens）。
 *
 * adapter 是这份文件里唯一「认代码长什么样」的地方：每种写法一个小函数。
 * 新增一种写法 ≈ 加 5 行，这是引擎里唯一可能因**代码形态**变化而要动的地方；
 * 文档侧的约定（表头、节标题、豁免）都在 config 里，改约定不动这里。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';

/* ================================================================== *
 * ① glob 与路径
 * ================================================================== */

/** glob → RegExp：支持 `*`（段内）、`**`（跨段）、`?`、`{a,b}`；其余字符按字面量 */
export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        // `**/` 连目录一起吃掉；`**` 收尾则匹配剩余全部
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else out += '[^/]*';
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      continue;
    }
    if (ch === '{') {
      const end = glob.indexOf('}', i);
      if (end > 0) {
        out += `(?:${glob
          .slice(i + 1, end)
          .split(',')
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|')})`;
        i = end;
        continue;
      }
    }
    out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.dsh']);

/** 递归列目录下的条目（仓库相对路径）；filter(kind, rel) 收 */
function walkEntries(root, dir, filter, out = []) {
  const abs = dir ? `${root}/${dir}` : root;
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (filter('dir', rel)) out.push(rel);
      walkEntries(root, rel, filter, out);
    } else if (filter('file', rel)) out.push(rel);
  }
  return out;
}

/** 仓库里匹配 glob 的**文件**清单 */
export function listFiles(root, glob) {
  const re = globToRegExp(glob);
  return walkEntries(root, '', (kind, rel) => kind === 'file' && re.test(rel));
}

/** 仓库里匹配 glob 的**目录**清单 */
export function listDirs(root, glob) {
  const re = globToRegExp(glob);
  return walkEntries(root, '', (kind, rel) => kind === 'dir' && re.test(rel));
}

/** 仓库里所有条目（文件 + 目录）——「只写了半截路径」的散文引用兜底用 */
export function listAllEntries(root) {
  return walkEntries(root, '', () => true);
}

/** `..` / `./` 归一；爬出仓库返回 null */
export function resolveFrom(fromFile, target) {
  const base = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/')) : '';
  const out = posix.normalize(posix.join(base, target));
  return out.startsWith('..') ? null : out;
}

/* ================================================================== *
 * ② 文档解析
 * ================================================================== */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** HTML 片段 → 纯文本（去注释 / 去标签 / 解实体 / 压空白） */
export const plain = (html) =>
  String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (whole, name) => ENTITIES[name] ?? whole)
    .replace(/\s+/g, ' ')
    .trim();

/**
 * `| a | b |` → ['a', 'b']（首尾的竖线不算单元格）。
 * 支持 GFM 的转义竖线 `\|`：单元格里写 TS 联合类型（`'sm' \| 'md'`）时，
 * 原来的 `split('|')` 会把它拆成两格、后面的列整体挤位。
 */
const splitRow = (line) => {
  const cells = [];
  let cell = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') {
      cell += '|';
      i += 1;
    } else if (ch === '|') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map((item) => item.trim());
};

/** Markdown 表格：`| … |` 行 + 紧跟的分隔行才算一张表 */
export function mdTables(text) {
  const lines = text.split('\n');
  const tables = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith('|')) continue;
    if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) continue;
    const rows = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].trim().startsWith('|'); j += 1) {
      rows.push({ cells: splitRow(lines[j]), line: j + 1 });
    }
    tables.push({ header: splitRow(lines[i]).map(plain), rows, line: i + 1 });
    i = j - 1;
  }
  return tables;
}

/**
 * HTML 页面结构：h2/h3 清单 + 每张表（带所属 h2/h3 与源码行号）。
 * 表头取 `<th>`（无 `<th>` 时取第一行 `<td>`），行只保留有单元格的。
 */
export function pageStructure(text) {
  const lineOf = (index) => text.slice(0, index).split('\n').length;
  const headings = [...text.matchAll(/<h([1-6])>([\s\S]*?)<\/h\1>/g)].map((m) => ({
    level: Number(m[1]),
    title: plain(m[2]),
    index: m.index,
  }));

  const nearest = (index) => {
    let h2 = null;
    let h3 = null;
    for (const heading of headings) {
      if (heading.index > index) break;
      if (heading.level === 2) {
        h2 = heading.title;
        h3 = null;
      } else if (heading.level === 3) h3 = heading.title;
    }
    return { h2, h3 };
  };

  const tables = [];
  const TABLE_RE = /<table[^>]*>([\s\S]*?)<\/table>/g;
  let match;
  while ((match = TABLE_RE.exec(text))) {
    const inner = match[1];
    let header = [...inner.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => plain(m[1]));
    const bodyAt = inner.indexOf('<tbody');
    const body = bodyAt >= 0 ? inner.slice(bodyAt) : inner;
    const offset = match.index + (bodyAt >= 0 ? bodyAt : 0);
    let rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => ({
      cells: [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => plain(cell[1])),
      line: lineOf(offset + row.index),
    }));
    rows = rows.filter((row) => row.cells.length > 0);
    if (!header.length && rows.length && /<th/.test(body)) {
      // 表头写在 <tbody> 里的怪表：第一行当表头
      header = rows[0].cells;
      rows = rows.slice(1);
    }
    tables.push({ header, rows, line: lineOf(match.index), ...nearest(match.index) });
  }
  return { headings, tables };
}

/* ================================================================== *
 * ③ 代码事实：adapter 注册表
 * ================================================================== */

export const kebab = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

/** 从 `open` 处的 `{` 找到配对的 `}`（跳过字符串里的括号） */
export function matchBrace(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 顶层 `key: value` 对（按逗号切，字符串 / 括号里的逗号不算） */
export function topLevelPairs(body) {
  const chunks = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      current += ch;
      if (ch === quote && body[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      chunks.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  chunks.push(current);
  return chunks
    .map((chunk) => {
      const at = chunk.indexOf(':');
      return at < 0 ? null : { key: chunk.slice(0, at).trim(), value: chunk.slice(at + 1).trim() };
    })
    .filter(Boolean);
}

export const stripJsComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** 字面量默认值；表达式一律 kind: 'expr'（不参与默认值对账） */
export function literalOf(value) {
  const text = value.trim();
  const str = text.match(/^'([^']*)'$/) ?? text.match(/^"([^"]*)"$/);
  if (str) return { kind: 'string', value: str[1] };
  if (text === 'null') return { kind: 'null' };
  if (text === 'true' || text === 'false') return { kind: 'bool', value: text };
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { kind: 'number', value: text };
  return { kind: 'expr', value: text };
}

/**
 * 括号配对地取一次调用 / 块的原文。
 * `start` 是**已经跨过开括号**的位置（如 `emit(` 之后），所以深度从 1 起算 ——
 * 从 0 起算会让第一个 `)` 把深度压到 -1、然后一路吃到后面某个括号才收手，
 * 于是把不相干的字符串一起吞进来（实测：凭空多出一个 `disabled` 事件）。
 */
function balanced(text, start, openCh = '(', closeCh = ')') {
  let depth = 1;
  let quote = null;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === openCh) depth += 1;
    else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i);
    }
  }
  return text.slice(start);
}

/**
 * adapter 注册表：每个适配器收 (text, ctx) 返回事实。
 * ctx 里有 `slug` / `kebabAttrs` / 等，方便按组件名过滤（如令牌前缀）。
 */
export const ADAPTERS = {
  /** `attrs: { … }` 顶层键 → Map(name → { default }) */
  attrsObject(text, ctx) {
    const at = text.search(/\battrs\s*:\s*\{/);
    if (at < 0) return new Map();
    const open = text.indexOf('{', at);
    const end = matchBrace(text, open);
    if (end < 0) return new Map();
    const out = new Map();
    for (const pair of topLevelPairs(stripJsComments(text.slice(open + 1, end)))) {
      if (!/^[A-Za-z_$][\w$]*$/.test(pair.key)) continue;
      const name = ctx.kebabAttrs ? kebab(pair.key) : pair.key;
      out.set(name, { default: literalOf(pair.value) });
    }
    return out;
  },

  /** `this.emit('name', …)` 里的字面量（含三元 `isOpen ? 'open' : 'close'`） */
  emitCall(text) {
    const out = new Set();
    for (const match of text.matchAll(/\bemit\s*\(/g)) {
      const call = balanced(text, match.index + match[0].length);
      for (const quoted of call.matchAll(/'([\w-]+)'/g)) out.add(quoted[1]);
    }
    return out;
  },

  /** `new Event('name')` / `new CustomEvent('name')` */
  newEvent(text) {
    const out = new Set();
    for (const match of text.matchAll(/new\s+(?:Custom)?Event\(\s*'([\w-]+)'/g)) out.add(match[1]);
    return out;
  },

  /** `<slot>` / `<slot name="x">`；无名插槽记成 `(默认)` */
  slotElement(text) {
    const out = new Set();
    for (const match of text.matchAll(/<slot([^>]*)>/g)) {
      const name = match[1].match(/\bname="([^"]+)"/);
      out.add(name ? name[1] : '(默认)');
    }
    return out;
  },

  /** `part="a b"` */
  partAttribute(text) {
    const out = new Set();
    for (const match of text.matchAll(/\bpart="([^"]+)"/g)) {
      for (const name of match[1].split(/\s+/).filter(Boolean)) out.add(name);
    }
    return out;
  },

  /** `el.setAttribute('part', 'x')` */
  setAttributePart(text) {
    const out = new Set();
    for (const match of text.matchAll(/setAttribute\(\s*['"]part['"]\s*,\s*['"`]([^'"`]+)['"`]/g)) {
      for (const name of match[1].split(/\s+/).filter(Boolean)) out.add(name);
    }
    return out;
  },

  /** `el.part = 'x'` */
  partProperty(text) {
    const out = new Set();
    for (const match of text.matchAll(/\.part\s*=\s*['"`]([^'"`]+)['"`]/g)) {
      for (const name of match[1].split(/\s+/).filter(Boolean)) out.add(name);
    }
    return out;
  },

  /** `--mc-<slug>-*` 形式的组件令牌（末尾带 `-` 的通配提及丢掉） */
  tokenPrefix(text, ctx) {
    const prefix = String(ctx.tokenPrefix ?? '--mc-{slug}-').replace('{slug}', ctx.slug);
    const out = new Set();
    for (const match of text.matchAll(/--[\w-]+/g)) {
      const token = match[0];
      if (token.endsWith('-')) continue;
      if (token.startsWith(prefix)) out.add(token);
    }
    return out;
  },
};

/** 默认的 facet → adapter 搭配（config 可覆盖） */
export const DEFAULT_ADAPTERS = {
  attrs: ['attrsObject'],
  events: ['emitCall', 'newEvent'],
  slots: ['slotElement'],
  parts: ['partAttribute', 'setAttributePart', 'partProperty'],
  tokens: ['tokenPrefix'],
};

/** 合成一套事实（同一个标签的多个 adapter 结果合并） */
function mergeFacet(kind, results) {
  if (kind === 'attrs') {
    const out = new Map();
    for (const result of results)
      for (const [name, meta] of result) if (!out.has(name)) out.set(name, meta);
    return out;
  }
  const out = new Set();
  for (const result of results) for (const name of result) out.add(name);
  return out;
}

/**
 * 这条令牌是不是「内部实现」：看它所在**声明**里有没有内部标记。
 *
 * 为什么不是简单的「同一行」：格式化工具（prettier 之类）会把长声明折行，
 * 尾部的 `/* @internal *​/` 会被挪到下一行的 `);` 后面 —— 按行判就会突然失灵
 * （真踩过：`pnpm format` 之后守卫开始报三条本来已经标好的令牌）。
 * 所以取「上一个语句边界 → 本语句结束那一行的行尾」这一段来判定，折行不影响。
 */
export function statementHasMarker(text, index, marker) {
  const boundary = Math.max(
    text.lastIndexOf(';', index),
    text.lastIndexOf('{', index),
    text.lastIndexOf('}', index),
  );
  // 从「上一条语句结束那一行的**下一行**」起：尾注 `… ; /* @internal */` 属于上一条语句，
  // 不能算进这一条
  let before = 0;
  if (boundary >= 0) {
    const newline = text.indexOf('\n', boundary);
    before = newline < 0 ? boundary + 1 : newline + 1;
  }
  const semi = text.indexOf(';', index);
  let end;
  if (semi < 0) end = text.indexOf('\n', index);
  else end = text.indexOf('\n', semi + 1);
  if (end < 0) end = text.length;
  return text.slice(before, end).includes(marker);
}

/**
 * 读一个组件目录，产出「按标签分的事实 + 整包并集 + 令牌 + 内部令牌 + 模块源码」。
 * 具体扫哪些文件、用什么 adapter，全来自 config。
 */
export function codeFacts({ root, dir, slug, code }) {
  const entryGlobs = code.entry ?? [];
  const files = [];
  for (const pattern of entryGlobs) {
    for (const rel of listFiles(root, `${dir}/${pattern.replace('{slug}', slug)}`)) {
      if (!files.includes(rel) && !rel.endsWith('page.html')) files.push(rel);
    }
  }

  const empty = () => ({ attrs: new Map(), events: new Set(), slots: new Set(), parts: new Set() });
  const facts = {
    slug,
    dir,
    files,
    perTag: new Map(),
    union: empty(),
    tags: [],
    tokens: new Set(),
    internal: new Set(),
    moduleText: '',
    moduleFiles: [],
    defaultsKeys: new Set(),
    lines: [],
  };

  const tagRe = new RegExp(code.tagPattern ?? "tag:\\s*'([\\w-]+)'");
  const adapters = { ...DEFAULT_ADAPTERS, ...(code.facets ?? {}) };
  const tokenPrefix = String(code.tokenPrefix ?? '--mc-{slug}-').replace('{slug}', slug);
  const internalMarker = code.internalMarker ?? '@internal';

  for (const rel of files) {
    const text = readFileSync(`${root}/${rel}`, 'utf8');
    facts.lines.push(...text.split('\n'));

    // 令牌：整包一次，按前缀过滤；所在声明里标了内部标记的那些单独记
    for (const match of text.matchAll(/--[\w-]+/g)) {
      const token = match[0];
      if (token.endsWith('-') || !token.startsWith(tokenPrefix)) continue;
      facts.tokens.add(token);
      if (statementHasMarker(text, match.index, internalMarker)) facts.internal.add(token);
    }

    if (!/<template\s+component>/i.test(text)) continue;
    const tag = text.match(tagRe)?.[1];
    if (!tag) continue;
    const ctx = { slug, tag, tokenPrefix, kebabAttrs: code.kebabAttrs !== false };
    const tagFacts = { tag, file: rel };
    for (const kind of ['attrs', 'events', 'slots', 'parts']) {
      const results = (adapters[kind] ?? []).map((name) => {
        const adapter = ADAPTERS[name];
        if (!adapter)
          throw new Error(`未知的 adapter：${kind} → ${name}（见 parse.mjs 的 ADAPTERS）`);
        return adapter(text, ctx);
      });
      tagFacts[kind] = mergeFacet(kind, results);
    }
    facts.perTag.set(tag, tagFacts);
    facts.tags.push(tag);

    for (const [name, meta] of tagFacts.attrs)
      if (!facts.union.attrs.has(name)) facts.union.attrs.set(name, meta);
    for (const name of tagFacts.events) facts.union.events.add(name);
    for (const name of tagFacts.slots) facts.union.slots.add(name);
    for (const name of tagFacts.parts) facts.union.parts.add(name);
  }

  // 命令式组件：模块源码（.js）单独收，给「方法 / 配置」对账用
  const modules = [];
  for (const pattern of code.module ?? []) {
    for (const rel of listFiles(root, `${dir}/${pattern.replace('{slug}', slug)}`))
      modules.push(rel);
  }
  facts.moduleFiles = modules;
  facts.moduleText = modules.map((rel) => readFileSync(`${root}/${rel}`, 'utf8')).join('\n');
  facts.defaultsKeys = defaultsKeysOf(facts.moduleText);
  return facts;
}

/** 源码里 `const <name> = { … }` 的顶层键（默认找 DEFAULTS） */
export function defaultsKeysOf(source, name = 'DEFAULTS') {
  const at = source.search(new RegExp(`\\b${name}\\s*=\\s*\\{`));
  if (at < 0) return new Set();
  const open = source.indexOf('{', at);
  const end = matchBrace(source, open);
  if (end < 0) return new Set();
  return new Set(
    topLevelPairs(stripJsComments(source.slice(open + 1, end))).map((pair) =>
      pair.key.replace(/['"]/g, ''),
    ),
  );
}
