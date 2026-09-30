/**
 * docs/lib/md-spec.mjs 的单测（纯 node，不进浏览器套件）：
 *   node tests/lib/md-spec.test.mjs
 *
 * 盯的是 docs/lib/md-spec.mjs 的两条边界规则 —— 它们是「哪些内容会被渲染出去」的唯一约定，
 * 错一条就是「内部说明被摊给了使用者」或「参考区少一节」。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSpecMd, resolveLink, SECTIONS } from '../../docs/lib/md-spec.mjs';

const SAMPLE = [
  '# mc-button',
  '',
  '> 共用约定见 [packages/README.md](../README.md)',
  '',
  '```html',
  '<mc-button color="danger">删除</mc-button>',
  '```',
  '',
  '---',
  '',
  '## 属性',
  '',
  '| 名称 | 值 | 默认 | 说明 |',
  '| --- | --- | --- | --- |',
  '| `color` | `primary` `info` | `primary` | 语义色 |',
  '',
  '## 插槽',
  '',
  '| 名称 | 说明 |',
  '| --- | --- |',
  '| `prefix` | 前置图标 |',
  '',
  '## 令牌',
  '',
  '| 令牌 | 作用 |',
  '| --- | --- |',
  '| `--mc-button-fill` | 底色 |',
  '',
  '## 实现约束',
  '',
  '- 内部令牌不要对外',
].join('\n');

test('只渲染白名单四节', () => {
  const { html, sections } = parseSpecMd(SAMPLE);
  assert.deepEqual(sections, ['属性', '插槽']);
  assert.match(html, /<h2>属性<\/h2>/);
  assert.match(html, /<h2>插槽<\/h2>/);
});

test('第一个 --- 之上的开场白不渲染', () => {
  const { html } = parseSpecMd(SAMPLE);
  assert.doesNotMatch(html, /共用约定/);
  assert.doesNotMatch(html, /mc-button color/);
});

test('白名单外的节连它的内容一起丢（实现约束 / 内部令牌）', () => {
  const { html } = parseSpecMd(SAMPLE);
  assert.doesNotMatch(html, /实现约束/);
  assert.doesNotMatch(html, /内部令牌/);
});

test('白名单外的节（令牌 / 实现约束）不渲染，但记进 skipped', () => {
  const { html, skipped } = parseSpecMd(SAMPLE);
  assert.doesNotMatch(html, /<h2>令牌<\/h2>/);
  assert.doesNotMatch(html, /mc-button-fill/);
  assert.deepEqual(skipped, ['令牌', '实现约束']);
});

test('表格渲染成站点口径的 .doc-table（thead + tbody，第一栏不加工）', () => {
  const { html } = parseSpecMd(SAMPLE);
  assert.match(html, /<table class="doc-table">/);
  assert.match(html, /<thead><tr><th>名称<\/th><th>值<\/th><th>默认<\/th><th>说明<\/th><\/tr><\/thead>/);
  // 行内 code 要变成 <code>，分隔符行不能变成 <tr>
  assert.match(html, /<td><code>color<\/code><\/td>/);
  assert.doesNotMatch(html, /<td>---<\/td>/);
});

test('表格里的转义竖线不当列分隔：TS 联合类型能写进单元格', () => {
  const md = [
    '---',
    '',
    '## 属性',
    '',
    '| 名称 | 值 | 默认 | 说明 |',
    '| --- | --- | --- | --- |',
    "| `size` | `'sm' \\| 'md' \\| 'lg'` | `md` | 尺寸 |",
  ].join('\n');
  const { html } = parseSpecMd(md);
  assert.match(html, /<td><code>'sm' \| 'md' \| 'lg'<\/code><\/td>/);
  assert.match(html, /<td><code>md<\/code><\/td>/);
});

test('标签名与尖括号转义（<mc-button> 不能变成真标签）', () => {
  const md = ['---', '', '## 属性', '', '| 名称 | 说明 |', '| --- | --- |', '| `<mc-button>` | 按钮 |'].join('\n');
  const { html } = parseSpecMd(md);
  assert.match(html, /<code>&lt;mc-button&gt;<\/code>/);
  assert.doesNotMatch(html, /<mc-button>/);
});

test('行内粗体与事件签名里的 & > 都能安全落地', () => {
  const md = [
    '---',
    '',
    '## 事件',
    '',
    '| 名称 | 类型 | 说明 |',
    '| --- | --- | --- |',
    '| `select` | `(event: Event & { data: { value: string } }) => void` | **选中** |',
  ].join('\n');
  const { html } = parseSpecMd(md);
  // 事件签名里的 & 与 > 都要转义（`&amp;` / `&gt;`），否则 TS 签名会截断表格
  assert.match(html, /\(event: Event &amp; \{ data: \{ value: string \} \}\)/);
  assert.match(html, /=&gt;\s*void/);
  assert.match(html, /<strong>选中<\/strong>/);
});

test('多标签组件的 h3 子标题跟着节走', () => {
  const md = ['---', '', '## 插槽与 part', '', '### mc-collapse', '', '| 名称 | 说明 |', '| --- | --- |', '| `header` | 头部 |'].join('\n');
  const { html } = parseSpecMd(md);
  assert.match(html, /<h2>插槽与 part<\/h2>\n<h3>mc-collapse<\/h3>/);
});

test('白名单节之外的 h3 / 段落一律丢弃', () => {
  const md = ['---', '', '## 刻意不做的', '', '- 不做 XX', '', '### 子标题'].join('\n');
  const { html, sections } = parseSpecMd(md);
  assert.equal(html, '');
  assert.deepEqual(sections, []);
});

test('md 里的相对链接改写成 GitHub（站点上是 404）', () => {
  // md 住在组件单元里（packages/<slug>/api.md），指向仓库里其它文件要往上两级
  const base = 'http://localhost:8642/packages/button/api.md';
  assert.equal(
    resolveLink('../../packages/color/README.md', base),
    'https://github.com/lhf6623/mosaic/blob/main/packages/color/README.md',
  );
  // Pages 的 /mosaic 子路径前缀不算仓库路径
  assert.equal(
    resolveLink('../../packages/README.md', 'https://lhf6623.github.io/mosaic/packages/button/api.md'),
    'https://github.com/lhf6623/mosaic/blob/main/packages/README.md',
  );
  // 绝对链接与锚点原样
  assert.equal(resolveLink('https://ofajs.com', base), 'https://ofajs.com');
  assert.equal(resolveLink('#top', base), '#top');
});

test('没有 --- 时，全文按白名单过滤（不整页吐出去）', () => {
  const md = ['## 属性', '', '| 名称 | 说明 |', '| --- | --- |', '| `size` | 尺寸 |'].join('\n');
  const { html } = parseSpecMd(md);
  assert.match(html, /<h2>属性<\/h2>/);
  assert.match(html, /<code>size<\/code>/);
});

test('SECTIONS 是方案里定的那七节（含命令式组件的「方法 / 配置」）', () => {
  assert.deepEqual(SECTIONS, ['属性', '方法', '事件', '配置', '插槽与 part', '插槽', 'part']);
});
