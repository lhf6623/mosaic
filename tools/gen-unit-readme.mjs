/**
 * 生成组件单元的 README.md（跑：`node tools/gen-unit-readme.mjs`）—— **入口卡**，不是接口文档：接口事实的
 * 唯一手写源是 api.md；README 放目录里有什么 + 设计取舍 + 不进文档页的东西（令牌 / 实现约束）。**两段式**：
 * 脚本只替换 `<!-- hand:start/end -->` 外面的生成区，手写区第一次播种后原样保留，否则重跑就把它冲掉了。
 */
import fs from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { SITE } from '../docs/site-map.js';

const flat = [];
(function walk(nodes) {
  for (const n of nodes) {
    flat.push(n);
    if (n.children) walk(n.children);
  }
})(SITE);

/** 手写区种子：相邻单元的分工 —— 每条都有出处（api.md 或组件头注释），不许编 */
const NEIGHBORS = {
  alert: [
    '与 [`message()`](../message/) 的分工：alert 是**页内静态**的一块面（跟着内容流排版、不抢焦点、不会自己消失），message 是**命令式浮层**（自己进场、自己走、不占版面）—— 两者都要「把状态告诉使用者」，但一个在文档流里、一个在层级最上面。',
    "内部 `await load('../icon/icon.html')`：左侧图形跟着 `color` 变，所以只引 `mc-alert` 的使用者会连带取一次 `icon.html`。",
  ],
  breadcrumb: [
    '与 [`mc-menu`](../menu/) 同一条理由：**交互元素由使用者写在插槽里**，组件不造链接 —— 站内链接要经 ofa 的 `olink` 带部署前缀，而 `olink` 只作用于页面模板（light DOM）里的元素。',
  ],
  button: [
    '消费 [`mc-icon`](../icon/)：槽里的图标字号走 `--mc-button-icon-size`（比按钮文字大一档）、颜色强制跟随按钮文字色 —— 按钮内部的 `mc-icon` **自己的 `color` 属性会被压掉**。',
  ],
  card: [
    '**不做交互**：组件里没有盖层、没有「铺满整卡」、没有 hover / cursor 规则 —— 操作元素由使用者写在插槽里，宿主固定 `position: relative` 给「整卡可点」那条 `::after` 当包含块。理由见上面「设计取舍」。',
  ],
  code: [
    '**唯一带可选外部依赖的单元**：highlight.js 按需从 CDN 懒加载，失败即降级为纯文本 —— 它不进 shadow root 之外的任何地方，也不影响排版 / 行号 / 主题跟随。',
  ],
  collapse: [
    '与 [`mc-menu`](../menu/) / [`mc-breadcrumb`](../breadcrumb/) 同族：**容器 + 子项**两个标签，容器管外框与尺寸（靠 `--mc-collapse-*` 继承给子项），子项管自己那格。',
  ],
  icon: [
    '被 [`mc-alert`](../alert/) 与 [`message()`](../message/) 在运行时 `load()`，被 `mc-button` 在模板里消费；`mc-icon-*` 类名也被 `mc-button` 的 loading 指示器、`mc-collapse-item` 的折叠箭头**直接当类名用**（零请求）。',
  ],
  menu: [
    '与 [`mc-breadcrumb`](../breadcrumb/) 同一条理由：**交互元素由使用者写在插槽里**，组件不造链接、也不改使用者的 DOM；状态（当前项 / 禁用）写在使用者的元素上，组件只按属性给外观。',
  ],
  message: [
    '与 [`mc-alert`](../alert/) 的分工：alert 是页内静态的一块面，message 是命令式浮层；**没有标签入口** —— 容器由模块自己挂到 `document.body` 末尾，图层问题（`position: fixed` 会被宿主页面的 `transform` / `filter` / `contain` 困住）就是在这里验的。',
    "内部 `await load('../icon/icon.html')`：类型图标跟着 `type` 走。",
  ],
  popover: [
    '与将来那批浮层（`mc-dialog` / `mc-dropdown` / `mc-tooltip`，草案见 [`packages/README.md`](../README.md)）的分工：popover 是**通用容器**，那几个只是在它上面固定住内容形态与交互的预设 —— 共用同一套定位与层级。',
    '图层问题的结论在这里定型：**一律用原生 `popover` 进 top layer**，不挂 `document.body`、不用 `z-index` 令牌；开合时浏览器顺手滚页面那一下由 `packages/boot/scroll-pin.js` 钉住。',
  ],
  tag: [
    '与 [`mc-badge`](../badge/) 的分工：badge 是「挂在别的元素上」的徽标（计数、圆点、本就不交互），tag 是「内容本身」的标签 —— 它才有关闭与选中。',
  ],
};

const HAND_START = '<!-- hand:start -->';
const HAND_END = '<!-- hand:end -->';

/* 单元清单从 site-map 派生，不在这里硬编码 —— 加组件只要往 site-map 挂一条带 tagName 的节点，
   跑一次脚本就有（否则 forgotten 一次就是一份缺失的 README）。⚠️ 只收 `packages/` 下有 tagName 的节点。 */
const SLUGS = flat
  .filter((n) => (n.path ?? '').startsWith('packages/') && n.tagName)
  .map((n) => n.path.split('/')[1]);

for (const slug of SLUGS) {
  const dir = `packages/${slug}`;
  const node = flat.find((n) => (n.path ?? '').startsWith(`packages/${slug}/`));
  if (!node) throw new Error(`site-map.js 里没有 ${slug}`);

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const bodyFiles = entries.filter(
    (e) => e.isFile() && e.name.endsWith('.html') && e.name !== 'page.html',
  );
  const otherFiles = entries
    .filter((e) => e.isFile() && !e.name.endsWith('.html'))
    .map((e) => e.name)
    .filter((n) => n !== 'api.md' && n !== 'README.md');
  const demoCount = entries.some((e) => e.name === 'demos')
    ? fs.readdirSync(`${dir}/demos`).length
    : 0;
  const testCount = entries.some((e) => e.name === 'test')
    ? fs.readdirSync(`${dir}/test`).length
    : 0;

  const rows = [];
  const main = bodyFiles.find((e) => e.name === `${slug}.html`);
  if (main)
    rows.push(`| \`${main.name}\` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它） |`);
  for (const f of bodyFiles.filter((e) => e.name !== `${slug}.html`)) {
    rows.push(`| \`${f.name}\` | 同族子标签，随本体一起引入 |`);
  }
  rows.push(
    `| \`page.html\` | **入口二**：文档站加载（注册在 [\`docs/site-map.js\`](../../docs/site-map.js)） |`,
  );
  rows.push(`| \`api.md\` | 接口规范 —— 由 \`<doc-spec>\` 渲染进页面参考区 |`);
  if (demoCount)
    rows.push(
      `| \`demos/\` | ${demoCount} 个演示（页面上的活样例与 \`<mc-code src>\` 引用**同一个文件**） |`,
    );
  if (testCount) rows.push(`| \`test/\` | 组件自己的冒烟套件（${testCount} 个文件） |`);
  for (const f of otherFiles) rows.push(`| \`${f}\` | 构建产物 / 附属文件 |`);

  // 手写区：已存在就原样保留，否则播种子
  const readmePath = `${dir}/README.md`;
  let hand = null;
  if (fs.existsSync(readmePath)) {
    const old = fs.readFileSync(readmePath, 'utf8');
    const m = old.match(new RegExp(`${HAND_START}([\\s\\S]*?)${HAND_END}`));
    if (m) hand = m[1].replace(/^\n+/, '').replace(/\n+$/, '');
  }
  if (hand === null) {
    hand = [
      '## 设计取舍',
      '',
      '（组件本体里的设计说明搬到这一节；改代码时看这里 —— 组件文件只留一行定位与指针）',
      '',
      '## 令牌',
      '',
      '（api.md 里不渲染的部分搬到这一节：令牌 / 实现约束 / 刻意不做的，都不进文档页）',
      '',
      '## 相邻单元',
      '',
      NEIGHBORS[slug]?.map((line) => `- ${line}`).join('\n\n') ??
        '- （还没写相邻单元的分工 —— 补在这里：和谁像、边界在哪、为什么不是同一个组件）',
    ].join('\n');
  }

  const tag = node.tagName ?? `mc-${slug}`;
  const zh = node.zh ? `（${node.zh}）` : '';

  const text = `# ${tag}${zh}

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [\`api.md\`](./api.md) —— 它由 \`<doc-spec>\` 渲染进 [\`page.html\`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · ${node.stage ?? '—'} · 标签 \`${tag}\` · 目录 \`${dir}/\`

${node.summary ?? ''}

## 单元里有什么

| 文件 | 角色 |
| --- | --- |
${rows.join('\n')}

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **\`page.html\`（文档站加载）**；其余是单元内部资产。

${HAND_START}
${hand}
${HAND_END}

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[\`packages/README.md\`](../README.md)
`;

  /* ⚠️ 落盘前过一遍 prettier：模板里的 markdown 表不补空格，直接写出去这些 README 会永远停在「未格式化」。
     ⚠️ `format()` 不读配置文件（只给 `filepath` 会退回 printWidth 80），要 `resolveConfig` 取一次再传。 */
  const cfg = await resolveConfig(readmePath);
  const out = await format(text, { ...cfg, filepath: readmePath });
  fs.writeFileSync(readmePath, out);
  console.log(`${readmePath}  (${out.split('\n').length} 行)`);
}
