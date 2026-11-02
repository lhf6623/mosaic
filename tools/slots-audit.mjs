/**
 * slots-audit.mjs —— 「插槽声明 ↔ 模板 <slot> ↔ 宿主 data-has-*」的 repo 特有校验。
 *
 * 四条硬规则（config 里的 custom 规则直接调这里）：
 *   ① 声明是 opt-in：不需要运行时能力的纯渲染组件不写 slots（多一层包装只会把 config 整体缩进一格，
 *      换不来任何行为）。所以「模板有槽但没声明」不报。
 *   ② 一旦声明，就得和模板对得上：声明了模板里没有的槽 = 死声明。
 *   ③ `$slots.has/node/nodes/elements('x')` 的实参必须是声明过的槽 —— 名字打错不会抛错，
 *      只会安静地拿到 false / null，只能静态拦。
 *   ④ 声明里给了 `reflect: 'x'`，本文件的 CSS 里就得有 `:host([data-has-x]` 消费它；
 *      组件里也不许再自己 `shadow.$('slot…')` / `shadow.all('slot')`（那是 boot/options.js 的活）。
 *
 * 说明文字不在这里 —— 插槽表的说明仍是 api.md 的手写内容（Reference 的唯一手写源），
 * 引擎的 `api-spec` 面负责「模板 ↔ api.md」；这里管的是「声明 ↔ 模板 ↔ 调用点」。
 */

import { ADAPTERS, topLevelPairs } from './doc-drift/lib/parse.mjs';

/** 与 doc-drift 的 slot 抽取产物保持一致（半角括号） */
const DEFAULT_LABEL = '(默认)';
const SLOT_NAME = /^[a-z][a-z0-9-]*$/;

const labelOf = (name) => (name === 'default' ? DEFAULT_LABEL : name);
const keyOf = (label) => (label === DEFAULT_LABEL ? 'default' : label);

/**
 * 从 `{` 起找到配对的 `}`。
 * ⚠️ 不能用引擎的 matchBrace：它只认单双引号，组件里有反引号模板（选择器 / 拼串），
 * 模板里的撇号会把状态卡在字符串里，扫到文件尾都回不到 0（table.html 实测）。
 */
function matchObject(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
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

/**
 * 从源码里读 `withOptions({ …, slots: { … } })` 的声明。
 * 找的是包装器调用之后**第一个** `slots: {` —— 组件里还有 `colorAttr({ slots: [...] })`
 * 那种同名形参（方括号，且都在包装器之前），不会被误当成声明。
 *
 * @returns {Map<string, { reflect: string | null }>}
 */
export function slotsSpec(text) {
  const wired = text.search(/\b(?:withOptions|withEmits)\s*\(/);
  if (wired < 0) return new Map();

  const decl = /\bslots\s*:\s*\{/.exec(text.slice(wired));
  if (!decl) return new Map();
  const open = wired + decl.index + decl[0].length - 1;
  const end = matchObject(text, open);
  if (end < 0) return new Map();

  const out = new Map();
  for (const entry of topLevelPairs(text.slice(open + 1, end))) {
    const name = entry.key.replace(/^['"]|['"]$/g, '');
    if (!name) continue;
    const reflect = entry.value.match(/\breflect\s*:\s*['"]([\w-]+)['"]/)?.[1] ?? null;
    out.set(name, { reflect });
  }
  return out;
}

/** 抹掉注释但保留长度与换行，行号不变（报错能指到原行） */
export function maskComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** 一个组件文件的声明 / 取值点 / 反射消费检查 */
export function auditComponent(file, text) {
  const problems = [];
  const declared = slotsSpec(text);
  const rendered = ADAPTERS.slotElement(text);

  // 声明了就必须渲染：多出来的名字是死声明（反方向不查 —— 纯渲染组件不写声明）
  for (const name of declared.keys()) {
    if (!rendered.has(labelOf(name)))
      problems.push(`${file}：slots 声明了 \`${name}\`，模板里没有对应 <slot>（死声明）`);
  }

  for (const [name, meta] of declared) {
    if (name !== 'default' && !SLOT_NAME.test(name)) {
      problems.push(`${file}：slots 的键 \`${name}\` 不合法 —— 小写短横线（§1.6）`);
    }
    if (meta.reflect === null) continue;
    if (!SLOT_NAME.test(meta.reflect)) {
      problems.push(`${file}：slots.${name}.reflect 的 \`${meta.reflect}\` 不合法 —— 小写短横线`);
      continue;
    }
    // 只认 `:host([data-has-x]` 前缀：CSS 里后面常接 `:not(…)` / 其他属性选择器
    const sel = `:host([data-has-${meta.reflect}]`;
    if (!text.includes(sel)) {
      problems.push(
        `${file}：slots.${name}.reflect 写的是 '${meta.reflect}'，但 CSS 里没有 ${sel}…)`,
      );
    }
  }

  // 调用点：$slots 只认声明过的名字，打错不会抛错，只能静态拦
  const masked = maskComments(text);
  for (const match of masked.matchAll(
    /\$slots\.(?:has|node|nodes|elements)\(\s*['"]([\w-]+)['"]/g,
  )) {
    if (!declared.has(match[1])) {
      problems.push(
        `${file}:${lineOf(text, match.index)}：$slots 用了未声明的槽 '${match[1]}' —— 先在 slots 里声明`,
      );
    }
  }

  for (const [label, re] of [
    ["shadow.$('slot…')", /shadow\s*\??\.\s*\$\(\s*['"`]slot/g],
    ["shadow.all('slot')", /shadow\s*\.\s*all\(\s*['"`]slot/g],
  ]) {
    for (const match of masked.matchAll(re)) {
      problems.push(
        `${file}:${lineOf(text, match.index)}：还在手写 ${label} —— 槽引用走 this.$slots.node(name)`,
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
        `插槽守卫自检「${label}」不成立：得到 ${JSON.stringify(got)}，期望 ${JSON.stringify(want)}`,
      );
    }
  };

  const ok = `<template component>
  <style>:host([data-has-content]) .x { display: block; }</style>
  <slot></slot>
  <slot name="prefix"></slot>
  <script>
    export default async () =>
      withOptions({
        tag: 'x-demo',
        emits: { change: { data: ['value'] } },
        slots: { default: { reflect: 'content' }, prefix: {} },
      });
  </script>
</template>`;

  eq('合法组件', auditComponent('x.html', ok), []);

  // opt-in：模板有槽但没声明不算错（纯渲染组件不写声明）
  eq('未声明的槽不报', auditComponent('x.html', ok.replace('prefix: {}', '')), []);
  eq(
    '$slots 用了未声明的槽',
    auditComponent(
      'x.html',
      ok.replace('slots: {', "ready() { this.$slots.has('suffix'); },\n        slots: {"),
    ).some((p) => p.includes('未声明的槽')),
    true,
  );
  eq(
    '死声明',
    auditComponent('x.html', ok.replace('prefix: {}', 'prefix: {}, icon: {}')).some((p) =>
      p.includes('死声明'),
    ),
    true,
  );
  eq(
    '反射没人消费',
    auditComponent(
      'x.html',
      ok.replace(':host([data-has-content]) .x { display: block; }', ''),
    ).some((p) => p.includes('CSS 里没有')),
    true,
  );
  eq(
    '手写槽引用',
    auditComponent(
      'x.html',
      ok.replace(
        'slots: {',
        'ready() { this._s = this.shadow.$(\'slot[name="prefix"]\'); },\n        slots: {',
      ),
    ).some((p) => p.includes('$slots.node')),
    true,
  );
  eq(
    '槽名不合法',
    auditComponent(
      'x.html',
      ok
        .replace('<slot name="prefix"></slot>', '<slot name="Prefix"></slot>')
        .replace('prefix: {}', "'Prefix': {}"),
    ).some((p) => p.includes('不合法')),
    true,
  );

  // 解析器自身的回归：包装器之外的 `slots: [...]` 不许被当成声明
  eq(
    '忽略色板形参',
    [
      ...slotsSpec(`withOptions({ tag: 'x', attrs: {}, proto: {} });
      const color = colorAttr({ slots: ['fill', 'accent'] });`).keys(),
    ],
    [],
  );
  eq('读到声明键', [...slotsSpec(ok).keys()], ['default', 'prefix']);
  eq('读到 reflect', slotsSpec(ok).get('default'), { reflect: 'content' });

  return problems;
}
