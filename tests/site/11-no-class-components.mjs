/**
 * 站点 · 组件写法守卫（node-only）：
 * `docs/` 与 `packages/` 里**不允许手写 `class … extends HTMLElement`** —— 组件一律
 * `<template component>`（理由与逐条对照见 agent/authoring.md §四「ofa.js 组件骨架」）。
 *
 * 背景：`docs/` 下曾经有四个手写元素（doc-nav / doc-crumb / doc-pager / doc-toc），
 * 它们各自重做了框架已经给的东西：el() 建 DOM、自己挂 hashchange/router-change、
 * 自己维护「内容没变就别重建」的守卫、自己在 disconnectedCallback 里摘监听。
 * 全部迁成组件模板后删掉了 docs/dom.js，这条守卫防止回退。
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

export default async function run({ check }) {
  const files = TREES.flatMap((tree) => walk(`${ROOT}${tree}`));
  const hits = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/class\s+(\w+)\s+extends\s+HTMLElement/g)) {
      const line = text.slice(0, match.index).split('\n').length;
      hits.push(`${file.replace(ROOT, '')}:${line} → class ${match[1]}`);
    }
  }

  check(
    `没有手写 class 组件（扫了 ${files.length} 个文件：组件一律 <template component>）`,
    hits.length === 0,
    hits.join('\n        ') ||
      `docs/ 与 packages/ 均为 0 处 —— 写法见 agent/authoring.md §四（迁移配方见 docs-refactor.md §4.0）`,
  );
}
