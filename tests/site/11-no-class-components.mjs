/**
 * 站点 · 写法守卫（node-only）：四条结构不变量，都在 `docs/` + `packages/` 里扫源码。
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
 * ③ **演示区用到的组件必须在那一页注册得到**（站点外壳 ∪ 本页 `<l-m>` ∪ 演示自己的 `load()`）。
 *    ofa 给每个组件模板注入了 `*:not(:defined){display:none}`：没注册的标签**连同里面的
 *    文字一起被藏掉，不报错** —— 于是「演示区的按钮全不见、图标还在、控制台干干净净」。
 *    这条**不能靠首页碰巧注册过**：深链 + 刷新时首页不一定渲染，于是同一个页面时而正常、
 *    时而空白（message / popover 两页就这么炸过，见 P44）。
 *    以前只能验「演示里至少有 1 个已升级的 mc-*」，而演示里的 `mc-icon` 恰好也是 mc-* ——
 *    正是它让这条漏了过去，所以这条守卫改成**静态**的、逐页逐演示对账。
 *
 * ④ **做原生浮层的组件必须接滚动守卫**（`packages/boot/scroll-pin.js`）。
 *    实测火狐：开合原生 popover 时浏览器会顺手把页面滚一下（用户看到「点一下页面往上蹿」）——
 *    而这条在 Chrome 里**完全复现不出来**，正是「静默失效」那一类；漏接只有用户会发现。
 *    所以在这里静态拦：声明或显示原生浮层的组件文件，必须引用 scroll-pin（怎么接见那个文件头）。
 *
 * 不需要浏览器：直接读文件，跑得飞快。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { READY, slugOf } from '../../docs/site-map.js';

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

/* ------------------------------------------------------------------ *
 * ③ 的原料：把 `<l-m src>` / `load('…')` 追成「这一页能拿到哪些组件标签」
 * ------------------------------------------------------------------ */

/** 仓库相对路径的 `..` 归一（只按 URL 形态算，不碰文件系统） */
function resolveFrom(fromFile, src) {
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of src.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/** ofa 组件的注册标签：`tag: 'mc-x'` */
const tagsIn = (text) => [...text.matchAll(/tag:\s*'([\w-]+)'/g)].map((m) => m[1]);

/** 一个文件里 `<l-m src>` 指向的仓库相对路径 */
const linksIn = (file, text) =>
  [...text.matchAll(/<l-m\s+src="([^"]+)"/g)].map((m) => resolveFrom(file, m[1]));

/**
 * 加载这几个 `.html` 之后、整条链上注册得到的标签。
 * 链有两段：`<l-m>` 会连带处理组件模板内部的 `<l-m>`；组件的 `await load()` 同理
 * （如 mc-alert → mc-icon）。两条都追，才不会把「靠组件自己带进来的标签」误报成缺注册。
 */
function registeredTags(entryFiles) {
  const tags = new Set();
  const seen = new Set();
  const queue = [...entryFiles];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file) || !file.endsWith('.html')) continue;
    seen.add(file);
    let text;
    try {
      text = readFileSync(`${ROOT}${file}`, 'utf8');
    } catch {
      continue; // 追到仓库外（CDN 上的路径）就停 —— 那些不归这条守卫管
    }
    for (const tag of tagsIn(text)) tags.add(tag);
    for (const next of linksIn(file, text)) queue.push(next);
    for (const match of text.matchAll(/load\(\s*'([^']+)'\s*\)/g)) {
      queue.push(resolveFrom(file, match[1]));
    }
  }
  return tags;
}

/** 全仓项目组件标签：只有这些会被 ofa 的 `:not(:defined)` 藏掉 */
const PROJECT_TAGS = new Set(
  TREES.flatMap((tree) => walk(`${ROOT}${tree}`))
    .filter((file) => file.endsWith('.html'))
    .flatMap((file) => tagsIn(readFileSync(file, 'utf8'))),
);

/** 一个演示文件里出现的项目组件标签（文本里的同名标签会多算，只会更严、不会漏） */
const usedTagsIn = (text) =>
  new Set(
    [...text.matchAll(/<([a-z][\w-]*)[\s>]/g)]
      .map((match) => match[1])
      .filter((tag) => PROJECT_TAGS.has(tag)),
  );

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

  /* ③ 演示区的组件依赖：站点外壳注册的那批 + 本页自己的 <l-m>（含演示自己带的），
        必须盖住演示里用到的每一个项目组件。缺了不报错、只是被藏起来（P44）。 */
  const shellText = readFileSync(`${ROOT}docs/layout.html`, 'utf8');
  const shellTags = registeredTags(linksIn('docs/layout.html', shellText));
  const unregistered = [];

  for (const component of READY) {
    const slug = slugOf(component);
    const pageFile = `packages/${slug}/page.html`;
    let pageText;
    try {
      pageText = readFileSync(`${ROOT}${pageFile}`, 'utf8');
    } catch {
      continue; // 没有文档页的组件（藏在 hidden 下的）不归这条管
    }
    const pageLinks = linksIn(pageFile, pageText);
    const available = new Set([...shellTags, ...registeredTags(pageLinks)]);

    for (const demo of pageLinks.filter((link) => link.includes('/demos/'))) {
      const missing = [...usedTagsIn(readFileSync(`${ROOT}${demo}`, 'utf8'))].filter(
        (tag) => !available.has(tag),
      );
      if (missing.length) {
        unregistered.push(`${slug}/${demo.split('/').pop()} → 缺 ${missing.join(', ')}`);
      }
    }
  }

  check(
    `演示区用到的项目组件都在那一页注册得到（${READY.length} 页逐演示对账）`,
    unregistered.length === 0,
    unregistered.join('\n        ') ||
      `站点外壳注册：${[...shellTags].sort().join(' / ')} —— 其余靠各页自己的 <l-m>，见 agent/doc-pages.md §二`,
  );

  /* ④ 原生浮层 ↔ 滚动守卫：声明或显示 popover 的**组件**必须引用 scroll-pin。
        （只看组件文件：文档页 page.html 里出现「popover=」是在写正文，不是在用浮层。） */
  const popoverComponents = [];
  const missingGuard = [];
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    const text = readFileSync(file, 'utf8');
    if (!text.includes('<template component>') || !/showPopover\s*\(|popover=/.test(text)) continue;
    popoverComponents.push(file.replace(ROOT, ''));
    /* 「接了」= 真的 import 了 scroll-pin **并且**用到它的某个导出 —— 只提到名字（注释里写一句
       "见 scroll-pin.js"）不算：那样的漏接照样会在火狐上把页面滚走。 */
    const imported = /from\s*['"][^'"]*scroll-pin\.js['"]/.test(text);
    const used = /attachFloatingScrollGuard|createScrollPin|holdScroll|snapshotScroll/.test(text);
    if (!imported || !used) missingGuard.push(file.replace(ROOT, ''));
  }
  check(
    `做原生浮层的组件都接了滚动守卫（${popoverComponents.length} 个：${popoverComponents.join(' / ') || '—'}）`,
    missingGuard.length === 0,
    missingGuard.length
      ? `${missingGuard.join(' / ')} —— 浮层开合会被浏览器滚走页面（火狐），接法见 packages/boot/scroll-pin.js`
      : '组件里都能看到 scroll-pin 的引用',
  );

  /* ⑤ 语义色维度 ↔ 任意色接线器：声明了 `color` 属性的组件必须接 color-attr。
        漏接的后果特别隐蔽 —— 使用者写 `color="#fff000"` 会被**静默**当成不认识的值，
        回落到组件默认色、不报错（正是这个仓库最怕的那类失效）。
        豁免表现在是空的 —— 四个声明了 color 的组件都接了。真要豁免某个，把它加进这张表并写清理由。 */
  const NO_HEX = new Set();
  const colorComponents = [];
  const missingColorAttr = [];
  for (const file of files) {
    if (!file.endsWith('.html') || file.includes('/demos/')) continue;
    const text = readFileSync(file, 'utf8');
    if (!text.includes('<template component>')) continue;
    /* attrs 里的 `color: 'primary'` —— 行首锚定，避免误判 --mc-*-color 这类 CSS 声明 */
    if (!/^\s*color:\s*'/m.test(text)) continue;
    const rel = file.replace(ROOT, '');
    colorComponents.push(rel);
    if (NO_HEX.has(rel)) continue;
    /* 「接了」= 真的 import 了 color-attr **并且**用到 colorAttr（注释里提一句不算）*/
    const imported = /from\s*['"][^'"]*color-attr\.js['"]/.test(text);
    const used = /colorAttr\s*\(/.test(text);
    if (!imported || !used) missingColorAttr.push(rel);
  }
  check(
    `声明 color 的组件都接了任意色接线器（${colorComponents.length} 个：${colorComponents.join(' / ') || '—'}${
      NO_HEX.size ? `；豁免 ${[...NO_HEX].map((f) => f.replace('packages/', '')).join(' / ')}` : '；无豁免'
    }）`,
    missingColorAttr.length === 0,
    missingColorAttr.length
      ? `${missingColorAttr.join(' / ')} —— color="#fff000" 会被静默当成不认识的值，接法见 packages/boot/color-attr.js`
      : '组件里都能看到 color-attr 的引用',
  );
}
