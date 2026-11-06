export const SECTIONS = ['属性', '事件', '插槽', 'part'];

export const GITHUB_BLOB = 'https://github.com/lhf6623/mosaic/blob/main';

const RE_H2 = /^##\s+(.+?)\s*$/;
const RE_H3 = /^###\s+(.+?)\s*$/;
const RE_HR = /^\s*---+\s*$/;
const RE_UL = /^\s*[-*]\s+(.*)$/;
const RE_FENCE = /^\s*```/;
const RE_SEP_CELL = /^:?-{1,}:?$/;

/** @param {unknown} text @returns {string} */
const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {unknown} href
 * @param {string} [baseUrl] md 自身的 URL（解析相对链接要用）
 * @returns {string}
 */
export function resolveLink(href, baseUrl) {
  const raw = String(href ?? '').trim();
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('#') || raw.startsWith('/')) {
    return raw;
  }
  if (!/\.md([#?].*)?$/i.test(raw) || !baseUrl) return raw;
  try {
    const path = new URL(raw, baseUrl).pathname.replace(/^\/mosaic\//, '/');
    return GITHUB_BLOB + path;
  } catch {
    return raw;
  }
}

/**
 * @param {unknown} text
 * @param {string} [baseUrl]
 * @returns {string}
 */
export function inline(text, baseUrl = '') {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = resolveLink(href, baseUrl);
    return `<a href="${escapeHtml(url)}">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
}

/**
 * @param {string} line
 * @returns {string[]}
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

/** @param {string[]} cells @returns {boolean} */
const isSeparator = (cells) => cells.length > 0 && cells.every((c) => RE_SEP_CELL.test(c));

/**
 * @param {string[]} rows 表格的原始行（含表头与分隔行）
 * @param {string} baseUrl
 * @returns {string}
 */
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
 * @param {unknown} text
 * @param {{ baseUrl?: string }} [options]
 * @returns {{ html: string, sections: string[], skipped: string[] }}
 */
export function parseSpecMd(text, { baseUrl = '' } = {}) {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  let start = lines.findIndex((line) => RE_HR.test(line));
  start = start < 0 ? 0 : start + 1;

  const out = [];
  const sections = [];
  const skipped = [];
  /**
   * @type {string | null}
   */
  let current = null;
  /** @type {string[]} */
  let para = [];
  /** @type {string[]} */
  let list = [];
  /** @type {string[]} */
  let table = [];
  /** @type {string[] | null} */
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

  for (let k = start; k < lines.length; k++) {
    const line = lines[k];

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

    para.push(line.replace(/^\s*>\s?/, ''));
  }

  flush();
  if (fence !== null && current !== null) {
    out.push(`<pre class="doc-pre"><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  }

  return { html: out.join('\n'), sections, skipped };
}
