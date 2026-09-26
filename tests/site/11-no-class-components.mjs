/**
 * 站点 · 写法守卫（node-only）：两条结构不变量，都在 `docs/` + `packages/` 里扫源码。
 *
 * ① **不允许手写 `class … extends HTMLElement`** —— 组件一律 `<template component>`
 *    （理由与逐条对照见 agent/authoring.md §四「ofa.js 组件骨架」）。
 *    背景：`docs/` 下曾经有四个手写元素（doc-nav / doc-crumb / doc-pager / doc-toc），
 *    它们各自重做了框架已经给的东西：el() 建 DOM、自己挂 hashchange/router-change、
 *    自己维护「内容没变就别重建」的守卫、自己在 disconnectedCallback 里摘监听。
 *    全部迁成组件模板后删掉了 docs/dom.js，这条守卫防止回退。
 *
 * ② **`<o-fill>` / `<x-fill>` 的模板只能有一个根子元素**（`o-if` + `o-else` 这种成对写法
 *    正是最常踩的多根）。多根时 ofa 会把模板包进 `<div style="display: contents">` ——
 *    包裹本身无害（不生成盒子），但每次渲染都打一条 `temp_multi_child` 的 console 警告，
 *    刷屏且容易让人以为站点坏了。要渲染多块时，自己把那段包成一个根（同一层 display:contents）。
 *
 * 不需要浏览器：直接读文件，跑得飞快。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 仓库根（本文件在 tests/site/ 下） */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** 只看这两棵源树（产物与依赖不扫） */
const TREES = ['docs', 'packages'];
const SKIP = new Set(['node_modules', '.git', 'dist']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(html|js|mjs)$/.test(entry.name)) out.push(path);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * ② 的解析：极简标签扫描（够用即可 —— 要处理自闭合与 HTML 的 void 标签）
 * ------------------------------------------------------------------ */

const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const VOID = new Set([
  'area', 'base', 'br', 'col', 'circle', 'ellipse', 'embed', 'hr', 'img', 'input',
  'line', 'link', 'meta', 'path', 'polygon', 'polyline', 'rect', 'source', 'stop',
  'track', 'use', 'wbr',
]);

/** 一个 fill 块的内部：数 depth-0 的元素子节点，并看 depth-0 有没有裸文本 */
function analyzeFill(inner) {
  let depth = 0;
  let roots = 0;
  let text = false;
  const bump = (chunk) => {
    if (depth === 0 && chunk.replace(/<!--[\s\S]*?-->/g, '').trim() !== '') text = true;
  };
  TAG_RE.lastIndex = 0;
  let last = 0;
  let m;
  while ((m = TAG_RE.exec(inner))) {
    bump(inner.slice(last, m.index));
    last = TAG_RE.lastIndex;
    const [full, slash, rawName] = m;
    const selfClosing = full.endsWith('/>') || VOID.has(rawName.toLowerCase());
    if (slash) depth = Math.max(0, depth - 1);
    else {
      if (depth === 0) roots += 1;
      if (!selfClosing) depth += 1;
    }
  }
  bump(inner.slice(last));
  return { roots, text };
}

/** 找出文件里所有 fill 块（返回每个块的内部 HTML 与行号） */
function fillBlocks(text) {
  const out = [];
  const stack = [];
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(text))) {
    const [full, slash, rawName] = m;
    const name = rawName.toLowerCase();
    const isFill = name === 'o-fill' || name === 'x-fill';
    const selfClosing = full.endsWith('/>') || VOID.has(name);
    if (slash) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === name) {
          const frame = stack[i];
          if (frame.isFill) {
            out.push({
              inner: text.slice(frame.start, m.index),
              line: text.slice(0, frame.start).split('\n').length,
            });
          }
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (!selfClosing) stack.push({ name, isFill, start: TAG_RE.lastIndex });
  }
  return out;
}

export default async function run({ check }) {
  const files = TREES.flatMap((tree) => walk(`${ROOT}${tree}`));
  const classHits = [];
  const fillHits = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/class\s+(\w+)\s+extends\s+HTMLElement/g)) {
      const line = text.slice(0, match.index).split('\n').length;
      classHits.push(`${file.replace(ROOT, '')}:${line} → class ${match[1]}`);
    }
    if (!file.endsWith('.html')) continue;
    for (const block of fillBlocks(text)) {
      const { roots, text: hasText } = analyzeFill(block.inner);
      if (roots > 1 || (roots === 0 && hasText)) {
        fillHits.push(
          `${file.replace(ROOT, '')}:${block.line} → 根元素 ${roots}${roots === 0 ? '（模板是裸文本）' : ''}`,
        );
      }
    }
  }

  check(
    `没有手写 class 组件（扫了 ${files.length} 个文件：组件一律 <template component>）`,
    classHits.length === 0,
    classHits.join('\n        ') ||
      `docs/ 与 packages/ 均为 0 处 —— 写法见 agent/authoring.md §四（迁移配方见 docs-refactor.md §4.0）`,
  );

  check(
    `每个 o-fill 模板都只有一个根子元素（多根会让 ofa 包一层 div 并打控制台警告）`,
    fillHits.length === 0,
    fillHits.join('\n        ') ||
      '两个成对分支（o-if / o-else）请自己包成一层 <div style="display: contents">，见 docs/components/nav.html 的注释',
  );
}
