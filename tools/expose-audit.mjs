/**
 * expose-audit.mjs —— 「对外方法只许在 withOptions.expose 里声明」的 repo 校验。
 *
 * 两条规则：
 *  ① 组件里不再手写方法挂载（Object.defineProperty(this.ele, 'x', { value: fn })）；
 *     受控 property 的 get/set 不在此列。
 *  ② withOptions.expose 的名字集合 ↔ api.md「方法」表的集合必须一致。
 */

/** 对象字面量的 body（大括号内部）；找不到返回 null */
function objectBody(text, key) {
  const re = new RegExp('\\b' + key + '\\s*:\\s*\\{');
  const match = re.exec(text);
  if (!match) return null;
  let i = text.indexOf('{', match.index) + 1;
  let depth = 1;
  const start = i;
  for (; i < text.length && depth > 0; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') depth -= 1;
  }
  return text.slice(start, i - 1);
}

/** 从 expose: { ... } 抽顶层键 */
export function exposeKeys(text) {
  const body = objectBody(text, 'expose');
  if (!body) return new Set();
  const keys = new Set();
  let depth = 0;
  let quote = null;
  let lineStart = true;
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
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    if (lineStart && depth === 0) {
      const match = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(body.slice(i));
      if (match) {
        keys.add(match[1]);
        i += match[0].length - 1;
        lineStart = false;
        continue;
      }
    }
    if (ch === '\n') lineStart = true;
    else if (!/\s/.test(ch)) lineStart = false;
  }
  return keys;
}

/** 手写方法挂载：defineProperty(this.ele, 'x', { value: fn })；有 get/set 的是受控 property，放行 */
function manualMethodNames(text) {
  const out = [];
  const re = /Object\.defineProperty\(this\.ele,\s*['"]([\w$]+)['"]\s*,\s*\{/g;
  let match;
  while ((match = re.exec(text))) {
    const start = text.indexOf('{', match.index);
    let depth = 1;
    let i = start + 1;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
    }
    const body = text.slice(start + 1, i - 1);
    if (/\bvalue\s*:/.test(body) && !/\bget\s*:/.test(body) && !/\bset\s*:/.test(body)) {
      out.push(match[1]);
    }
  }
  return out;
}

export function auditComponent(file, text) {
  const problems = [];
  const declared = exposeKeys(text);
  for (const name of manualMethodNames(text)) {
    if (!declared.has(name))
      problems.push(
        file + '：手写挂载方法 ' + name + ' —— 改到 withOptions.expose 声明，别绕过声明面',
      );
  }
  return problems;
}

/** api.md「方法」表的第一个单元格：方法名（去掉反引号和调用参数） */
function methodNamesFromDoc(md) {
  const lines = md.split('\n');
  const names = new Set();
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+方法\s*$/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection || !line.trim().startsWith('|')) continue;
    if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const cell = line.split('|')[1] ?? '';
    const match = /([A-Za-z_$][\w$]*)\s*\(/.exec(cell.replace(/\`/g, ''));
    if (match) names.add(match[1]);
  }
  return names;
}

export function auditDocs(file, md, declared) {
  const problems = [];
  const documented = methodNamesFromDoc(md);
  for (const name of declared) {
    if (!documented.has(name)) problems.push(file + '：expose.' + name + ' 没有写进「方法」表');
  }
  for (const name of documented) {
    if (!declared.has(name))
      problems.push(file + '：方法表里的 ' + name + ' 没有 expose 声明（死文档）');
  }
  return problems;
}

export function auditSelfTest() {
  const problems = [];
  const eq = (label, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(
        'expose 守卫自检「' +
          label +
          '」不成立：得到 ' +
          JSON.stringify(got) +
          '，期望 ' +
          JSON.stringify(want),
      );
    }
  };
  const ok =
    "export default async () => withOptions({\n tag: 'x-demo',\n expose: { ping: {} },\n proto: { ping() {} },\n});";
  eq('合法声明', auditComponent('x.html', ok), []);
  const bad =
    ok + "\nObject.defineProperty(this.ele, 'pong', { configurable: true, value: () => {} });";
  eq('漏声明的手写方法', auditComponent('x.html', bad).length, 1);
  return problems;
}
