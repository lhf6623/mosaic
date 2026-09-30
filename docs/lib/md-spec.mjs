/**
 * docs/lib/md-spec.mjs —— 组件 API 规范 md 的**受限子集**解析器。
 *
 * 只认这几样：h2 / h3、管道表、无序列表、段落、围栏代码。
 * 刻意不做一个通用 markdown 解析器 —— 页面只需要这几样，多认一种就多一种
 * 「作者随手写了、渲染出来很难看」的可能。
 *
 * **三条边界规则**：
 *   1. 第一个独占一行的 `---` 之上不渲染（开场白 + 用法片段）；
 *   2. `<!-- agent-only -->` 之下不渲染（实现约束 / 刻意不做的 / 令牌）；
 *   3. 中间只有 **白名单七节** 渲染：属性 / 方法 / 事件 / 配置 / 插槽与 part / 插槽 / part。
 *      其余节名一律丢弃 —— 白名单是硬的，将来往 md 里加新节不会误渲染出去。
 *      「方法 / 配置」是给命令式组件留的（`message()` 没有标签属性，接口事实就是方法与配置），
 *      节序与 `doc-drift.config.mjs` 的 `referenceOrder` 一致。
 *
 * 跑单测：`node tests/lib/md-spec.test.mjs`
 */

/** 渲染进页面的节名（顺序即页面参考区顺序，与 packages/README.md §一 一致） */
export const SECTIONS = ['属性', '方法', '事件', '配置', '插槽与 part', '插槽', 'part'];

/** 仓库在 GitHub 上的浏览前缀（md 里的相对链接按 md 自身 URL 解析后指到这里） */
export const GITHUB_BLOB = 'https://github.com/lhf6623/mosaic/blob/main';

const RE_H2 = /^##\s+(.+?)\s*$/;
const RE_H3 = /^###\s+(.+?)\s*$/;
const RE_HR = /^\s*---+\s*$/;
const RE_AGENT_ONLY = /^\s*<!--\s*agent-only\s*-->\s*$/;
const RE_UL = /^\s*[-*]\s+(.*)$/;
const RE_FENCE = /^\s*```/;
const RE_SEP_CELL = /^:?-{1,}:?$/;

const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * md 里的相对链接 → 站点上点得开的链接。
 * md 住在组件单元里（`packages/<slug>/api.md`），它指向仓库内其它文件的相对链接在站点上是
 * 404 —— 仓库外的读者该去 GitHub 看那份源文件（与 docs/pages/specs.html 同一口径）。
 */
export function resolveLink(href, baseUrl) {
  const raw = String(href ?? '').trim();
  // 绝对链接 / 锚点 / 站内的根相对路径：原样
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('#') || raw.startsWith('/')) {
    return raw;
  }
  if (!/\.md([#?].*)?$/i.test(raw) || !baseUrl) return raw;
  try {
    // Pages 部署在 /mosaic 子路径下（node tools/serve.mjs --prefix /mosaic），
    // 仓库里的相对路径不带这层前缀
    const path = new URL(raw, baseUrl).pathname.replace(/^\/mosaic\//, '/');
    return GITHUB_BLOB + path;
  } catch {
    return raw;
  }
}

/** 行内：先整体转义，再认 `code` / 链接 / 粗体 —— 顺序反了会让 `<mc-button>` 变成真标签 */
export function inline(text, baseUrl = '') {
  let out = escapeHtml(text);
  // 行内 code 最先认：里面的 * 不该被当强调
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = resolveLink(href, baseUrl);
    return `<a href="${escapeHtml(url)}">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
}

/**
 * `| a | b |` → ['a', 'b']（首尾的竖线不算单元格）。
 * 支持 GFM 的转义竖线 `\|`：单元格里的 TS 联合类型（`'sm' \| 'md'`）不会被拆成两格。
 */
export function splitRow(line) {
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
}

const isSeparator = (cells) => cells.length > 0 && cells.every((c) => RE_SEP_CELL.test(c));

function renderTable(rows, baseUrl) {
  const grid = rows.map(splitRow);
  const head = grid[0];
  const body = grid.slice(1).filter((cells) => !isSeparator(cells));

  const th = head.map((cell) => `<th>${inline(cell, baseUrl)}</th>`).join('');
  const trs = body
    .map((cells) => `<tr>${cells.map((c) => `<td>${inline(c, baseUrl)}</td>`).join('')}</tr>`)
    .join('');

  return (
    `<table class="doc-table">` +
    `<thead><tr>${th}</tr></thead>` +
    `<tbody>${trs}</tbody>` +
    `</table>`
  );
}

/**
 * md 全文 → 参考区 HTML。
 * @returns {{ html: string, sections: string[], skipped: string[] }}
 *   `sections` = 渲染出来的节名（按出现顺序）；`skipped` = 被白名单挡下的节名（调试用）。
 */
export function parseSpecMd(text, { baseUrl = '' } = {}) {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  // ① 第一个 --- 之上：agent 开场白
  let start = lines.findIndex((line) => RE_HR.test(line));
  start = start < 0 ? 0 : start + 1;

  // ② agent-only 之下：不渲染
  let stop = lines.length;
  for (let k = start; k < lines.length; k++) {
    if (RE_AGENT_ONLY.test(lines[k])) {
      stop = k;
      break;
    }
  }

  const out = [];
  const sections = [];
  const skipped = [];
  let current = null; // 当前节名；null = 不在白名单节里（内容丢弃）
  let para = [];
  let list = [];
  let table = [];
  let fence = null;

  const flush = () => {
    if (current === null) {
      para = [];
      list = [];
      table = [];
      return;
    }
    if (table.length) {
      out.push(renderTable(table, baseUrl));
      table = [];
    }
    if (list.length) {
      out.push(`<ul>${list.map((item) => `<li>${inline(item, baseUrl)}</li>`).join('')}</ul>`);
      list = [];
    }
    if (para.length) {
      out.push(`<p>${inline(para.join(' '), baseUrl)}</p>`);
      para = [];
    }
  };

  for (let k = start; k < stop; k++) {
    const line = lines[k];

    // 围栏代码块：整块原样收（公开区不该有，但收着比吞掉强）
    if (RE_FENCE.test(line)) {
      if (fence === null) {
        flush();
        fence = [];
      } else {
        if (current !== null) {
          out.push(`<pre class="doc-pre"><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
        }
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      fence.push(line);
      continue;
    }

    const h2 = line.match(RE_H2);
    if (h2) {
      flush();
      const name = h2[1].replace(/`/g, '').trim();
      if (SECTIONS.includes(name)) {
        current = name;
        sections.push(name);
        out.push(`<h2>${escapeHtml(name)}</h2>`);
      } else {
        if (name) skipped.push(name);
        current = null;
      }
      continue;
    }

    const h3 = line.match(RE_H3);
    if (h3) {
      flush();
      if (current !== null) out.push(`<h3>${escapeHtml(h3[1].replace(/`/g, '').trim())}</h3>`);
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    if (current === null) continue;

    if (line.trimStart().startsWith('|')) {
      if (list.length || para.length) flush();
      table.push(line);
      continue;
    }
    if (table.length) flush();

    const li = line.match(RE_UL);
    if (li) {
      if (para.length) flush();
      list.push(li[1]);
      continue;
    }
    if (list.length) flush();

    // 引用块 / 普通行一律当段落（md 的 `>` 前缀去掉）
    para.push(line.replace(/^\s*>\s?/, ''));
  }

  flush();
  if (fence !== null && current !== null) {
    out.push(`<pre class="doc-pre"><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  }

  return { html: out.join('\n'), sections, skipped };
}
