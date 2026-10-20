/**
 * emits-audit.mjs —— 「emits 声明 ↔ $emit 调用点 ↔ api.md」的 repo 特有校验。
 *
 * 三条硬规则（config 里的两条 custom 规则直接调这里）：
 *   ① 组件里只认 `this.$emit('name', payload)`：名字必须字面量（或三元列全）、必须在 emits 里；
 *      声明了必须有调用点；禁止裸 `this.emit` / `new CustomEvent` / `dispatchEvent`。
 *   ② `emits` 非空 ⇔ 组件定义包了 `withEmits(...)`。
 *   ③ api.md 的事件表：通道（data / detail / native）与载荷键必须跟声明一致；internal 事件不许进表。
 *
 * 引擎只负责「事件名」的集合对账；这里管写法、通道与载荷——所以它属于仓库，不属于通用引擎。
 */

import { withEmits } from '../packages/boot/emits.js';
import { emitsSpec, mdTables } from './doc-drift/lib/parse.mjs';

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** 抹掉注释但保留长度与换行，行号不变（报错能指到原行） */
export function maskComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/** 从 '(' 开始切顶层参数；只切到配对的 ')' */
function splitCall(text, open) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = open + 1;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) {
        parts.push(text.slice(start, i));
        return parts;
      }
    } else if (ch === ',' && depth === 1) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function literalNames(expr) {
  const out = [];
  for (const m of expr.matchAll(/'([\w-]+)'|"([\w-]+)"/g)) out.push(m[1] ?? m[2]);
  return out;
}

/** 对象字面量的顶层键；不是对象字面量返回 null（调用方据此跳过载荷键校验） */
export function payloadKeysOf(expr) {
  const t = String(expr ?? '').trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return null;
  const body = t.slice(1, -1);
  const chunks = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (ch === quote && body[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) {
      chunks.push(body.slice(start, i));
      start = i + 1;
    }
  }
  chunks.push(body.slice(start));
  const keys = [];
  for (const chunk of chunks) {
    const c = chunk.trim();
    if (!c || c.startsWith('...')) continue;
    const at = c.indexOf(':');
    const key = (at < 0 ? c : c.slice(0, at)).trim().replace(/^['"]|['"]$/g, '');
    if (IDENT.test(key)) keys.push(key);
  }
  return keys;
}

/** `$emit(...)` 调用：名字 / 是否动态 / 载荷键 / 原位置 */
export function emitCalls(text) {
  const masked = maskComments(text);
  const out = [];
  for (const m of masked.matchAll(/\$emit\s*\(/g)) {
    const open = masked.indexOf('(', m.index);
    const parts = splitCall(masked, open);
    const first = (parts[0] ?? '').trim();
    let names = [];
    let dynamic = false;
    if (/^['"][\w-]+['"]$/.test(first)) names = literalNames(first);
    else if (first.includes('?') && literalNames(first).length >= 2) names = literalNames(first);
    else dynamic = true;
    const hasPayload = parts.length > 1 && parts[1].trim() !== '';
    out.push({
      names,
      dynamic,
      hasPayload,
      payloadKeys: hasPayload ? payloadKeysOf(parts[1]) : null,
      at: m.index,
    });
  }
  return out;
}

/** 组件文件里还在手写的派发口（this.emit / CustomEvent / dispatchEvent） */
export function rawDispatches(text) {
  const masked = maskComments(text);
  const out = [];
  for (const [label, re] of [
    ['this.emit(...)', /\bthis\.emit\s*\(/g],
    ['new CustomEvent(...)', /\bnew\s+CustomEvent\s*\(/g],
    ['dispatchEvent(...)', /\bdispatchEvent\s*\(/g],
  ]) {
    for (const m of masked.matchAll(re)) out.push({ label, at: m.index });
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const sameKeys = (a, b) => [...a].sort().join(',') === [...b].sort().join(',');

/** 一个组件文件的声明 / 调用点检查 */
export function auditComponent(file, text) {
  const problems = [];
  const declared = emitsSpec(text);
  const wired = /\bwithEmits\s*\(/.test(maskComments(text));
  if (declared.size && !wired)
    problems.push(`${file}：声明了 emits，但组件定义没有用 withEmits(...) 包起来 —— 声明不会生效`);
  if (wired && !declared.size) problems.push(`${file}：用了 withEmits(...) 却没有 emits 声明`);

  for (const raw of rawDispatches(text)) {
    problems.push(
      `${file}:${lineOf(text, raw.at)}：还在手写 ${raw.label} —— 统一走 this.$emit('name', payload)`,
    );
  }

  const calls = emitCalls(text);
  const emitted = new Set();
  for (const call of calls) {
    if (call.dynamic) {
      problems.push(
        `${file}:${lineOf(text, call.at)}：$emit 的事件名必须是字面量（或用三元列全），否则守卫看不见`,
      );
      continue;
    }
    for (const name of call.names) {
      emitted.add(name);
      const meta = declared.get(name);
      if (!meta) {
        problems.push(`${file}:${lineOf(text, call.at)}：$emit('${name}') 没有在 emits 里声明`);
        continue;
      }
      if (meta.payload === true) continue;
      if (!call.hasPayload) {
        if (Array.isArray(meta.payload) && meta.payload.length) {
          problems.push(
            `${file}:${lineOf(text, call.at)}：$emit('${name}') 少了载荷（声明了 {${meta.payload.join(
              ', ',
            )}}）`,
          );
        }
        continue;
      }
      if (call.payloadKeys === null) continue;
      if (!sameKeys(call.payloadKeys, meta.payload)) {
        problems.push(
          `${file}:${lineOf(text, call.at)}：$emit('${name}') 的载荷键是 {${call.payloadKeys.join(
            ', ',
          )}}，emits 声明是 {${meta.payload.join(', ')}}`,
        );
      }
    }
  }

  for (const name of declared.keys()) {
    if (!emitted.has(name)) {
      problems.push(
        `${file}：emits 声明了 '${name}'，但文件里没有 $emit('${name}') 调用（死声明）`,
      );
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ *
 * api.md 侧：通道 / 载荷键
 * ------------------------------------------------------------------ */

function matchBraceAt(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** TS 对象类型里的顶层键：`{ value: string; error: unknown }` → ['value','error'] */
function typeKeys(body) {
  const chunks = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  const openCh = new Set(['{', '[', '(']);
  const closeCh = new Set(['}', ']', ')']);
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (ch === quote && body[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '<') depth += 1;
    else if (ch === '>') depth -= 1;
    else if (openCh.has(ch)) depth += 1;
    else if (closeCh.has(ch)) depth -= 1;
    else if ((ch === ';' || ch === ',') && depth === 0) {
      chunks.push(body.slice(start, i));
      start = i + 1;
    }
  }
  chunks.push(body.slice(start));
  const keys = [];
  for (const chunk of chunks) {
    const m = chunk.trim().match(/^([A-Za-z_$][\w$]*|'[^']+'|"[^"]+")\s*\??\s*:/);
    if (m) keys.push(m[1].replace(/^['"]|['"]$/g, ''));
  }
  return keys;
}

function typePayloadKeys(type, channel) {
  let open = -1;
  if (channel === 'detail') {
    const lt = type.indexOf('<');
    if (lt < 0) return null;
    open = type.indexOf('{', lt);
  } else {
    const at = type.search(/\bdata\s*:\s*\{/);
    if (at < 0) return null;
    open = type.indexOf('{', at);
  }
  if (open < 0) return null;
  const end = matchBraceAt(type, open);
  if (end < 0) return null;
  return typeKeys(type.slice(open + 1, end));
}

/** 一个 api.md 的事件表检查；declared 是整单元（可能多标签）的并集 */
export function auditDocs(file, text, declared) {
  const problems = [];
  const section = text.split(/^## /m).find((s) => s.startsWith('事件'));
  if (!section) return problems;
  const tables = mdTables(section);
  const table = tables.find(
    (t) => t.header[0] === '名称' && t.header[1] === '类型' && t.header[2] === '说明',
  );
  if (!table) return problems;

  const internalNames = new Set(
    [...declared].filter(([, meta]) => meta.internal).map(([name]) => name),
  );
  for (const row of table.rows) {
    const name = (row.cells[0] ?? '').replace(/`/g, '').trim();
    const type = (row.cells[1] ?? '').replace(/`/g, '').trim();
    if (!name || name === '名称' || /^[-: ]+$/.test(name)) continue;
    if (/\(/.test(name)) continue; // 方法行
    if (internalNames.has(name)) {
      problems.push(`${file}:${row.line}：内部事件 '${name}' 不该写进 api.md`);
      continue;
    }
    const meta = declared.get(name);
    if (!meta) continue; // 文档多出来的名字由引擎的 events 面报，免得重复

    const channelOk =
      meta.channel === 'detail'
        ? /CustomEvent\s*</.test(type)
        : meta.channel === 'native'
          ? !/\bdata\s*:/.test(type) && !/CustomEvent\s*</.test(type)
          : meta.payload.length > 0
            ? /\bdata\s*:/.test(type) && /Event\s*&/.test(type)
            : !/\bdata\s*:/.test(type) && !/CustomEvent\s*</.test(type);
    if (!channelOk) {
      problems.push(
        `${file}:${row.line}：事件 '${name}' 声明的是 ${meta.channel} 通道，类型列写的是 ${type}`,
      );
      continue;
    }

    if (meta.payload === true || !Array.isArray(meta.payload) || meta.payload.length === 0)
      continue;
    const keys = typePayloadKeys(type, meta.channel);
    if (keys && !sameKeys(keys, meta.payload)) {
      problems.push(
        `${file}:${row.line}：事件 '${name}' 的载荷键在文档里是 {${keys.join(
          ', ',
        )}}，emits 声明是 {${meta.payload.join(', ')}}`,
      );
    }
  }
  return problems;
}

/** 守卫自检：确保上面几把尺子真的在判，而不是安静全绿 */
export function auditSelfTest() {
  const problems = [];
  const eq = (label, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(
        `事件守卫自检「${label}」不成立：得到 ${JSON.stringify(got)}，期望 ${JSON.stringify(want)}`,
      );
    }
  };

  const ok = `export default async () => withEmits({
    tag: 'x-demo',
    emits: { change: { data: ['value'] } },
  });
  function f() { this.$emit('change', { value }); }`;
  eq('合法组件', auditComponent('x.html', ok), []);

  const missing = ok.replace("change: { data: ['value'] }", 'other: { data: ["value"] }');
  eq(
    '调用点缺声明',
    auditComponent('x.html', missing).some((p) => p.includes('没有在 emits 里声明')),
    true,
  );

  const dynamic = ok.replace("this.$emit('change', { value })", 'this.$emit(type)');
  eq(
    '动态事件名',
    auditComponent('x.html', dynamic).some((p) => p.includes('必须是字面量')),
    true,
  );

  const raw = ok + "\n function g() { this.emit('change', {}); }";
  eq(
    '裸 this.emit',
    auditComponent('x.html', raw).some((p) => p.includes('this.emit')),
    true,
  );

  const noPayload = ok.replace("this.$emit('change', { value })", "this.$emit('change')");
  eq(
    '载荷缺失',
    auditComponent('x.html', noPayload).some((p) => p.includes('少了载荷')),
    true,
  );

  const wrongKeys = ok.replace('{ value }', '{ other: 1 }');
  eq(
    '载荷键不一致',
    auditComponent('x.html', wrongKeys).some((p) => p.includes('载荷键')),
    true,
  );

  const dead = ok.replace("this.$emit('change', { value });", '');
  eq(
    '死声明',
    auditComponent('x.html', dead).some((p) => p.includes('死声明')),
    true,
  );

  const unwired = ok.replace('withEmits({', '({');
  eq(
    '声明没接 withEmits',
    auditComponent('x.html', unwired).some((p) => p.includes('withEmits')),
    true,
  );

  const docOk = `## 事件

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| \`change\` | \`(event: Event & { data: { value: string } }) => void\` | x |
`;
  eq(
    '文档通道/载荷一致',
    auditDocs(
      'x/api.md',
      docOk,
      new Map([
        ['change', { channel: 'data', payload: ['value'], cancelable: false, internal: false }],
      ]),
    ),
    [],
  );
  eq(
    '文档通道不一致',
    auditDocs(
      'x/api.md',
      docOk,
      new Map([
        ['change', { channel: 'detail', payload: ['value'], cancelable: false, internal: false }],
      ]),
    ).length,
    1,
  );

  eq(
    '文档载荷键不一致',
    auditDocs(
      'x/api.md',
      docOk,
      new Map([
        ['change', { channel: 'data', payload: ['other'], cancelable: false, internal: false }],
      ]),
    ).some((p) => p.includes('载荷键')),
    true,
  );

  // ⚠️ 回归：$emit 必须挂在 proto 上，且 withEmits 不能 spread proto（getter 会提前求值）
  let getterRead = false;
  const proto = {
    get _ele() {
      return 'ok';
    },
    get panel() {
      getterRead = true;
      return 'panel';
    },
  };
  const wired = withEmits({ emits: { change: { data: ['value'] } }, proto });
  eq('withEmits 不读 proto getter', getterRead, false);
  eq('$emit 挂在 proto 上', Object.hasOwn(wired.proto, '$emit'), true);
  const instance = Object.create(wired.proto);
  instance.ele = { dispatchEvent: () => true };
  let saw = null;
  instance.emit = (name, options) => {
    saw = { name, options };
  };
  instance.$emit('change', { value: 1 });
  eq('$emit 走 ofa emit', saw, {
    name: 'change',
    options: { bubbles: true, composed: true, data: { value: 1 } },
  });
  eq('proto getter 在实例上照常工作', instance.panel, 'panel');

  return problems;
}
