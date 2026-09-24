/**
 * mc-code · 代码展示组件：高亮、行号、限高滚动、降级、主题跟随（packages/code）
 */

import { pageHelpers } from '../../../tests/lib/harness.mjs';

export default async function run({ page, visit, goHash, check, problems, chromium, BASE, CHANNEL, newPage }) {
/* ------------------------------------------------------------------ *
 * 11.2 mc-code —— 代码展示组件（三条线：高亮 / 配色必须等于 hljs 官方主题声明的值 / 高亮库不可达时降级；另守 P7、P31：proto 方法叫 refresh/sync、attrs 键叫 wrap 都会让 createElement 静默坏掉）
 * ------------------------------------------------------------------ */

const codePage = await newPage();
const codeProblems = [];
const codeWarnings = [];
codePage.on('pageerror', (e) => codeProblems.push(String(e)));
codePage.on('console', (m) => {
  if (m.type() === 'warning') codeWarnings.push(m.text());
});

await visit(codePage, '/index.html#/packages/code/page.html');
await codePage
  .waitForFunction(
    () => {
      return window.__deepAll('mc-code').length >= 10;
    },
    { timeout: 15000 },
  )
  .catch(() => {});
await codePage.waitForTimeout(1200);

const codeState = await codePage.evaluate(() => {
  const rows = window.__deepAll('mc-code').map((el) => {
    const sr = el.shadowRoot;
    const block = sr.querySelector('.mc-block');
    const body = sr.querySelector('.mc-body');
    const html = block.innerHTML;
    return {
      lang: el.getAttribute('language'),
      tokens: block.querySelectorAll('span[class*="hljs-"]').length,
      balanced: (html.match(/<span/g) || []).length === (html.match(/<\/span>/g) || []).length,
      lines: sr.querySelectorAll('.mc-line').length,
      sourceLines: el.code.split('\n').length,
      linesAriaHidden: [...sr.querySelectorAll('.mc-ln')].every(
        (n) => n.getAttribute('aria-hidden') === 'true',
      ),
      scrolls: body.scrollHeight > body.clientHeight + 1,
      whiteSpace: getComputedStyle(sr.querySelector('.mc-pre')).whiteSpace,
      // adopt 进来的表里有没有 hljs 的 token 规则 = 官方主题表到位了
      themed: sr.adoptedStyleSheets.some((sheet) =>
        [...sheet.cssRules].some((rule) => rule.selectorText?.includes('.hljs-keyword')),
      ),
    };
  });
  return { count: rows.length, rows };
});

check('mc-code 文档页渲染出全部演示实例', codeState.count >= 10, `${codeState.count} 个实例`);
check(
  '带 language 的实例都产出了高亮标签，且跨行切分的 span 配平',
  codeState.rows
    .filter((r) => r.lang && r.lang !== 'text')
    .every((r) => r.tokens > 0 && r.balanced),
  codeState.rows.map((r) => `${r.lang || '-'}:${r.tokens}${r.balanced ? '' : '(未配平)'}`).join(' '),
);
const numberedRows = codeState.rows.filter((r) => r.lines > 0);
check(
  'line-numbers 实例按行渲染（行数 = 源码行数），行号带 aria-hidden',
  numberedRows.length >= 1 &&
    numberedRows.every((r) => r.lines === r.sourceLines && r.lines > 1 && r.linesAriaHidden),
  numberedRows
    .map((r) => `源码 ${r.sourceLines} 行 → 渲染 ${r.lines} 行 aria-hidden=${r.linesAriaHidden}`)
    .join(' · '),
);
check(
  'max-height 实例内容超出时在组件内部滚动',
  codeState.rows.some((r) => r.scrolls),
  codeState.rows.map((r) => `${r.lang || '-'}:${r.scrolls ? '滚动' : '不滚动'}`).join(' '),
);
check(
  'soft-wrap 让代码折行（white-space: pre-wrap）',
  codeState.rows.some((r) => r.whiteSpace === 'pre-wrap'),
  codeState.rows.map((r) => `${r.lang || '-'}:${r.whiteSpace}`).join(' '),
);
/* 代码文本的四个入口：code 属性 / :code 绑定 / setAttribute / el.code（property） */
const codeSources = await codePage.evaluate(async () => {
  const textOf = (el) => el.shadowRoot.querySelector('.mc-block').textContent;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const byAttr = window.__deepAll('mc-code').find((el) => (el.getAttribute('code') || '').includes('byAttr'));
  const bound = window.__deepAll('mc-code').find((el) => textOf(el).includes('mc-code :code'));

  const holder = document.createElement('div');
  holder.innerHTML =
    '<mc-code language="javascript" code="const fromAttr = 1;">const fromText = 2;</mc-code>';
  document.body.append(holder);
  await wait(700);
  const mixedEl = holder.querySelector('mc-code');
  const mixed = textOf(mixedEl); // 必须在移除之前读：移除后组件会走 teardown

  const target = window.__deepAll('mc-code')[0];
  target.setAttribute('code', 'const viaAttr = 1;');
  await wait(500); // P4：setAttribute 异步生效
  const viaAttr = {
    text: textOf(target),
    tokens: target.shadowRoot.querySelectorAll('span[class*="hljs-"]').length,
  };

  target.code = 'const viaProp = 2;';
  const viaPropNow = textOf(target); // property 写入应当立刻生效，不等 ofa 那一拍
  const reflected = target.getAttribute('code');
  const readBack = target.code;

  // createElement 之后、挂载之前赋值（构造期不能写宿主属性，见 P31）
  const preset = document.createElement('mc-code');
  preset.setAttribute('language', 'javascript');
  preset.code = 'const preset = 3;';
  document.body.append(preset);
  await wait(700);
  const presetState = { text: textOf(preset), attr: preset.getAttribute('code') };

  holder.remove();
  preset.remove();
  return {
    byAttr: byAttr ? textOf(byAttr) : null,
    bound: bound ? textOf(bound) : null,
    mixed,
    viaAttr,
    viaPropNow,
    reflected,
    readBack,
    presetState,
  };
});
check(
  'code 属性传值：内容直接来自属性',
  codeSources.byAttr === "const byAttr = 'code 属性传进来的';",
  JSON.stringify(codeSources.byAttr),
);
check(
  'ofa :code 绑定：内容来自页面 data（:prop 只对 attrs 里声明过的键生效）',
  !!codeSources.bound && codeSources.bound.includes('mc-code :code'),
  JSON.stringify(codeSources.bound),
);
check(
  'code 属性优先于标签内文本',
  codeSources.mixed.includes('fromAttr') && !codeSources.mixed.includes('fromText'),
  JSON.stringify(codeSources.mixed),
);
check(
  '运行时 setAttribute("code", …) 重渲染并重新高亮（P4）',
  codeSources.viaAttr.text.includes('viaAttr') && codeSources.viaAttr.tokens > 0,
  JSON.stringify(codeSources.viaAttr),
);
check(
  '运行时 el.code = … 立刻生效，并反射回属性；读回是去缩进后的原文',
  codeSources.viaPropNow.includes('viaProp') &&
    codeSources.reflected === 'const viaProp = 2;' &&
    codeSources.readBack.includes('viaProp'),
  `立刻=${JSON.stringify(codeSources.viaPropNow)} 属性=${JSON.stringify(codeSources.reflected)} 读回=${JSON.stringify(codeSources.readBack)}`,
);
check(
  'createElement 后、挂载前赋 el.code 也能渲染并补上属性（P31）',
  codeSources.presetState.text.includes('preset') &&
    codeSources.presetState.attr === 'const preset = 3;',
  JSON.stringify(codeSources.presetState),
);

check(
  '每个实例都 adopt 了 highlight.js 官方主题表（内含 .hljs-* token 规则）',
  codeState.rows.every((r) => r.themed),
  `${codeState.rows.filter((r) => r.themed).length}/${codeState.rows.length}`,
);

/* 滚轮不该被代码块「锁住」：① `.mc-body` 上的 overscroll-behavior: contain 会让「没得滚」的块也变滚动陷阱；
   ② 限高块在 scroll latching 下块内滚到底后，同一次手势的后续滚轮会被吞（实测第 3 次不动、第 4 次才动）。
   现在的实现：不写 contain + 边界那一下手动把位移转给最近的可滚动祖先。
   「外层」= 外壳的 .doc-main：整页只有它一个滚动容器（见 docs/content.css 的分栏注释）。 */
const wheelChain = await (async () => {
  /* 只看演示里的块：抽屉里那块在收起的折叠面板里（尺寸 0），当滚轮落点永远滚不动页面 */
  const snapshot = () =>
    codePage.evaluate(() => {
      // ofa.js 会把声明过的字符串属性以**空值**写到宿主上（每个 mc-code 都有 hljs-base="" / max-height=""），
      // 所以必须看属性值，不能只看 hasAttribute
      const codes = window.__deepAll('mc-code').filter((el) => !el.closest('.doc-demo-code'));
      const limited = codes.findIndex(
        (el) => (el.getAttribute('max-height') || '').trim() !== '',
      );
      const inner = codes[limited].shadowRoot.querySelector('.mc-body');
      const outer = window.__deepAll('.doc-main')[0];
      return {
        limited,
        inner: Math.round(inner.scrollTop),
        innerMax: inner.scrollHeight - inner.clientHeight,
        outer: Math.round(outer.scrollTop),
        outerMax: outer.scrollHeight - outer.clientHeight,
      };
    });
  const boxAt = (index) =>
    codePage.evaluate((i) => {
      const el = window.__deepAll('mc-code').filter((c) => !c.closest('.doc-demo-code'))[i];
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + Math.min(r.width / 2, 300), y: r.y + r.height / 2 };
    }, index);
  const resetOuter = () =>
    codePage.evaluate(() => {
      window.__deepAll('.doc-main')[0].scrollTop = 0;
    });

  // ① 内容不超高的块：滚轮直接带动页面
  await resetOuter();
  const plainBox = await boxAt(0);
  const beforePlain = (await snapshot()).outer;
  await codePage.mouse.move(plainBox.x, plainBox.y);
  await codePage.mouse.wheel(0, 300);
  await codePage.waitForTimeout(400);
  const afterPlain = (await snapshot()).outer;

  // ② 限高块：块内先滚到底，紧接着的那一次滚轮必须带动页面
  const base = await snapshot();
  const innerBox = await boxAt(base.limited);
  await codePage.evaluate((i) => {
    const body = window.__deepAll('mc-code')
      .filter((c) => !c.closest('.doc-demo-code'))
      [i].shadowRoot.querySelector('.mc-body');
    body.scrollTop = body.scrollHeight;
  }, base.limited);
  const atEnd = await snapshot();
  await codePage.mouse.move(innerBox.x, innerBox.y);
  await codePage.mouse.wheel(0, 60);
  await codePage.waitForTimeout(400);
  const afterEnd = await snapshot();

  return { beforePlain, afterPlain, atEnd, afterEnd, outerMax: base.outerMax };
})();
check(
  '滚轮在代码块上不会被"锁住"（不超高、没得滚的块要直接滚页面）',
  wheelChain.afterPlain - wheelChain.beforePlain >= 200,
  `.doc-main ${wheelChain.beforePlain} → ${wheelChain.afterPlain}（可滚范围 ${wheelChain.outerMax}）`,
);
check(
  '限高块滚到底后，紧接着那一次滚轮就带动页面（不是被吞掉）',
  wheelChain.atEnd.innerMax > 0 && // 先确认选中的块真的有内部滚动，否则是假通过
    wheelChain.atEnd.inner === wheelChain.atEnd.innerMax &&
    wheelChain.afterEnd.outer - wheelChain.atEnd.outer >= 40,
  `块内 ${wheelChain.atEnd.inner}/${wheelChain.atEnd.innerMax} · .doc-main ${wheelChain.atEnd.outer} → ${wheelChain.afterEnd.outer}`,
);

const readKeywordColor = () =>
  codePage.evaluate(() => {
    const el = window.__deepAll('mc-code').find((c) => c.getAttribute('language') === 'javascript');
    const kw = el?.shadowRoot.querySelector('.hljs-keyword');
    return kw ? getComputedStyle(kw).color : null;
  });

/* 配色必须"等于 highlight.js 主题里声明的值"：直接在同一份 adopted 表里找 .hljs-keyword 规则比对 */
const themeColor = await codePage.evaluate(() => {
  const el = window.__deepAll('mc-code').find((c) => c.getAttribute('language') === 'javascript');
  const sr = el.shadowRoot;
  const sheet = sr.adoptedStyleSheets.find((s) =>
    [...s.cssRules].some((r) => r.selectorText?.includes('.hljs-keyword')),
  );
  let declared = null;
  for (const rule of sheet?.cssRules ?? []) {
    const sels = (rule.selectorText || '').split(',').map((x) => x.trim());
    if (sels.includes('.hljs-keyword')) declared = rule.style.color;
  }
  return {
    declared,
    computed: getComputedStyle(sr.querySelector('.hljs-keyword')).color,
    scheme: getComputedStyle(el).colorScheme,
  };
});
check(
  '语法配色就是官方主题里声明的颜色（组件没有覆盖它）',
  !!themeColor.declared && themeColor.computed === themeColor.declared,
  `主题声明 ${themeColor.declared} · 实际 ${themeColor.computed} · color-scheme=${themeColor.scheme}`,
);

/* 切到暗色：应该换成官方暗色主题那张表（颜色随之变化），切回来还原 */
const keywordLight = await readKeywordColor();
await codePage.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await codePage
  .waitForFunction(
    (prev) => {
      const el = window.__deepAll('mc-code').find((c) => c.getAttribute('language') === 'javascript');
      const kw = el?.shadowRoot.querySelector('.hljs-keyword');
      return !!kw && getComputedStyle(kw).color !== prev;
    },
    keywordLight,
    { timeout: 8000 },
  )
  .catch(() => {});
const keywordDark = await readKeywordColor();
const darkScheme = await codePage.evaluate(() => {
  return getComputedStyle(window.__deepAll('mc-code')[0]).colorScheme;
});
await codePage.evaluate(() => document.documentElement.removeAttribute('data-theme'));
await codePage
  .waitForFunction(
    (prev) => {
      const el = window.__deepAll('mc-code').find((c) => c.getAttribute('language') === 'javascript');
      const kw = el?.shadowRoot.querySelector('.hljs-keyword');
      return !!kw && getComputedStyle(kw).color === prev;
    },
    keywordLight,
    { timeout: 8000 },
  )
  .catch(() => {});
check(
  '切暗色换成官方暗色主题（颜色变），切回来还原',
  keywordLight && keywordDark && keywordLight !== keywordDark &&
    (await readKeywordColor()) === keywordLight,
  `亮 ${keywordLight} → 暗 ${keywordDark} · color-scheme=${darkScheme}`,
);

/* 运行时改属性：language 换语言、line-numbers 换行号模式 */
const codeRuntime = await codePage.evaluate(async () => {
  const el = window.__deepAll('mc-code').find((c) => c.getAttribute('language') === 'html');
  const block = () => el.shadowRoot.querySelector('.mc-block');
  const tokens = () => block().querySelectorAll('span[class*="hljs-"]').length;
  const before = tokens();
  el.setAttribute('language', 'css');
  /* 语言包是**按需从 CDN 取**的：睡固定一拍会在网慢时假红（实测同一份代码有一次 165/166）。
     这里等条件、不等时间。 */
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && tokens() === 0) await new Promise((r) => setTimeout(r, 100));
  const after = { tokens: tokens(), hasCssToken: tokens() > 0 };
  const sourceLines = el.code.split('\n').length;
  el.setAttribute('line-numbers', '');
  await new Promise((r) => setTimeout(r, 400));
  const lines = el.shadowRoot.querySelectorAll('.mc-line').length;
  el.removeAttribute('line-numbers');
  await new Promise((r) => setTimeout(r, 400));
  return { before, after, sourceLines, lines, back: el.shadowRoot.querySelectorAll('.mc-line').length };
});
check(
  '改 language 会重新高亮（语言包从 CDN 取，等的是条件不是固定一拍）',
  codeRuntime.after.hasCssToken && codeRuntime.after.tokens > 0,
  `切换前 token ${codeRuntime.before} → 切换后 ${codeRuntime.after.tokens}`,
);
check(
  '运行中加 / 去 line-numbers 会按行重渲染（行数 = 源码行数）',
  codeRuntime.lines === codeRuntime.sourceLines && codeRuntime.lines > 1 && codeRuntime.back === 0,
  `源码 ${codeRuntime.sourceLines} 行 · 加行号后 ${codeRuntime.lines} 行 / 去掉后 ${codeRuntime.back} 行`,
);

/* P31 回归：动态 createElement 的实例也必须能初始化 —— attrs 里出现 ofa.js 保留名（wrap），
   或 ready() 里往宿主写属性（自定义元素构造期不允许带属性），都会让这一步静默坏掉 */
const codeCreate = await codePage.evaluate(async () => {
  const el = document.createElement('mc-code');
  el.setAttribute('language', 'javascript');
  el.textContent = 'const a = 1;';
  document.body.append(el);
  await new Promise((r) => setTimeout(r, 800));
  const out = {
    shadow: !!el.shadowRoot,
    text: el.shadowRoot?.querySelector('.mc-block')?.textContent ?? null,
    tokens: el.shadowRoot?.querySelectorAll('span[class*="hljs-"]').length ?? 0,
  };
  el.remove();
  return out;
});
check(
  'createElement 创建的实例也能初始化（P31：attrs 不含保留名 + 不写宿主属性）',
  codeCreate.shadow && codeCreate.text === 'const a = 1;' && codeCreate.tokens > 0,
  JSON.stringify(codeCreate),
);
check(
  '组件注册没有撞 $.fn 保留名（ofa.js 只会在控制台留一条 warning）',
  !codeWarnings.some((w) => w.includes('already occupied')) && codeProblems.length === 0,
  [...codeWarnings, ...codeProblems].join(' | ') || '无 warning / 无异常',
);

/* 迁移完成：文档站的代码块全部由 mc-code 渲染，`.doc-code` 样式已退场。
   这条走主 page，先把它带到站点入口 —— 单飞跑本套件时主 page 还停在 about:blank，__deepAll 是 goto 才注入的 */
await visit(page, '/index.html');
await goHash('docs/pages/guide.html');
// 其中一块走 src（片段文件异步到达），等所有块都渲染出内容再断言
await page
  .waitForFunction(
    () => {
      const codes = window.__deepAll('mc-code');
      return (
        codes.length >= 3 &&
        codes.every((el) => el.shadowRoot?.querySelector('.mc-block')?.textContent.trim())
      );
    },
    { timeout: 8000 },
  )
  .catch(() => {});
const migrated = await page.evaluate(() => {
  const codes = window.__deepAll('mc-code');
  return {
    legacy: document.querySelectorAll('.doc-code').length,
    count: codes.length,
    rendered: codes.filter((el) => el.shadowRoot?.querySelector('.mc-block')?.textContent.trim())
      .length,
  };
});
check(
  '文档站的代码块已迁到 mc-code（不再有 .doc-code，且每个块都渲染出内容）',
  migrated.legacy === 0 && migrated.count >= 3 && migrated.rendered === migrated.count,
  JSON.stringify(migrated),
);

/* src：内容 = 片段文件本身（不用实体转义），并按后缀推断语言 */
const srcSnippet = await (async () => {
  const fileText = await (await fetch(`${BASE}/docs/snippets/quick-start.html`)).text();
  const state = await page.evaluate(() => {
    const codes = window.__deepAll('mc-code');
    const el = codes.find((c) => (c.getAttribute('src') || '').includes('quick-start'));
    if (!el) return null;
    const block = el.shadowRoot.querySelector('.mc-block');
    return {
      text: block.textContent,
      tokens: block.querySelectorAll('span[class*="hljs-"]').length,
    };
  });
  return { expected: fileText.trim(), ...state };
})();
check(
  'src 从片段文件读内容（文件里是真 HTML，不用实体转义），并自动高亮',
  !!srcSnippet.text &&
    srcSnippet.text === srcSnippet.expected &&
    srcSnippet.tokens > 0,
  `片段 ${srcSnippet.expected?.length ?? 0} 字符 · 渲染 ${srcSnippet.text?.length ?? 0} 字符 · token ${srcSnippet.tokens ?? 0}`,
);

/* 降级：高亮库不可达时"没有颜色"而不是"没有代码"。单独起一个浏览器实例 ——
   同一进程里的 HTTP 缓存是共享的，否则掐不掉 */
const degradedCode = await (async () => {
  const b = await chromium.launch({ channel: CHANNEL });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await ctx.addInitScript(pageHelpers);
  const problems = [];
  const warnings = [];
  p.on('pageerror', (e) => problems.push(String(e)));
  p.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await p.route('**/highlightjs/**', (r) => r.abort());
  await visit(p, '/index.html#/packages/code/page.html');
  await p.waitForTimeout(1500);
  const state = await p.evaluate(() => {
    const el = window.__deepAll('mc-code')[0];
    const sr = el.shadowRoot;
    return {
      text: sr.querySelector('.mc-block').textContent.trim().slice(0, 30),
      tokens: sr.querySelectorAll('span[class*="hljs-"]').length,
      themed: sr.adoptedStyleSheets.some((sheet) =>
        [...sheet.cssRules].some((rule) => rule.selectorText?.includes('.hljs-keyword')),
      ),
    };
  });
  await b.close();
  return { state, problems, warned: warnings.some((w) => w.includes('[mosaic]')) };
})();
check(
  '高亮库不可达时退化为纯文本（内容照常渲染，只是没有颜色）',
  degradedCode.state.text.length > 0 && degradedCode.state.tokens === 0 && !degradedCode.state.themed,
  JSON.stringify(degradedCode.state),
);
check(
  '退化路径只留 [mosaic] 警告，不抛异常',
  degradedCode.warned && degradedCode.problems.length === 0,
  degradedCode.problems.join(' | ') || '无异常',
);
}
