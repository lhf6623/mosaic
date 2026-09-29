/**
 * mc-grid / mc-grid-item · 栅格：cols 分列、gap 三档映射令牌、min-item-width 自适应、
 * span 跨列（packages/grid）。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?grid=1#/packages/grid/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-grid') && !!customElements.get('mc-grid-item'), {
      timeout: 8000,
    })
    .catch(() => {});

  /* 现搭现拆探针：固定宽度 600px，量完最后一个 evaluate 删掉 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'grid-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;width:600px';
    host.innerHTML = `
      <mc-grid id="p-grid" cols="3">
        <mc-grid-item id="p-i0">0</mc-grid-item>
        <mc-grid-item id="p-i1">1</mc-grid-item>
        <mc-grid-item id="p-i2">2</mc-grid-item>
        <mc-grid-item id="p-i3">3</mc-grid-item>
        <mc-grid-item id="p-i4">4</mc-grid-item>
        <mc-grid-item id="p-i5">5</mc-grid-item>
      </mc-grid>
      <mc-grid id="p-gap-sm" gap="sm"><mc-grid-item>s</mc-grid-item><mc-grid-item>s</mc-grid-item></mc-grid>
      <mc-grid id="p-gap-md"><mc-grid-item>m</mc-grid-item><mc-grid-item>m</mc-grid-item></mc-grid>
      <mc-grid id="p-gap-lg" gap="lg"><mc-grid-item>l</mc-grid-item><mc-grid-item>l</mc-grid-item></mc-grid>
      <mc-grid id="p-span" cols="4" style="width:400px">
        <mc-grid-item id="p-s0" span="2">跨两列</mc-grid-item>
        <mc-grid-item id="p-s1">1</mc-grid-item>
        <mc-grid-item id="p-s2">2</mc-grid-item>
      </mc-grid>
      <mc-grid id="p-min" min-item-width="200px" style="width:500px">
        <mc-grid-item>a</mc-grid-item>
        <mc-grid-item>b</mc-grid-item>
        <mc-grid-item>c</mc-grid-item>
      </mc-grid>
      <div id="p-tok-sm" style="position:fixed;left:-9999px;display:grid;gap:var(--mc-space-2)"></div>
      <div id="p-tok-md" style="position:fixed;left:-9999px;display:grid;gap:var(--mc-space-4)"></div>
      <div id="p-tok-lg" style="position:fixed;left:-9999px;display:grid;gap:var(--mc-space-6)"></div>`;
    document.body.append(host);
  });
  await page
    .waitForFunction(() => {
      const grid = document.getElementById('p-grid');
      return grid && getComputedStyle(grid).gridTemplateColumns.split(' ').length === 3;
    }, { timeout: 8000 })
    .catch(() => {});

  const metrics = () =>
    page.evaluate(() => {
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      const grid = document.getElementById('p-grid');
      const items = ['p-i0', 'p-i1', 'p-i2', 'p-i3', 'p-i4', 'p-i5'].map(box);
      /* 令牌要按**像素**比：rem 令牌直接和 gap 比字符串是比不出来的（0.5rem ≠ 8px） */
      const token = (id) => getComputedStyle(document.getElementById(id)).gap;
      const gapOf = (id) => getComputedStyle(document.getElementById(id)).gap;
      const span = document.getElementById('p-span');
      const min = document.getElementById('p-min');
      return {
        display: getComputedStyle(grid).display,
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        tops: items.map((item) => Math.round(item.top)),
        widths: items.map((item) => Math.round(item.width)),
        gapTokens: { sm: token('p-tok-sm'), md: token('p-tok-md'), lg: token('p-tok-lg') },
        gaps: { sm: gapOf('p-gap-sm'), md: gapOf('p-gap-md'), lg: gapOf('p-gap-lg') },
        span: {
          gridColumn: getComputedStyle(document.getElementById('p-s0')).gridColumn,
          width0: Math.round(box('p-s0').width),
          width1: Math.round(box('p-s1').width),
          gap: getComputedStyle(span).gap,
          tops: ['p-s0', 'p-s1', 'p-s2'].map((id) => Math.round(box(id).top)),
        },
        min: {
          template: getComputedStyle(min).gridTemplateColumns,
          tops: [...min.querySelectorAll('mc-grid-item')].map((item) =>
            Math.round(item.getBoundingClientRect().top),
          ),
        },
      };
    });

  const m = await metrics();
  check(
    'mc-grid / mc-grid-item 注册并渲染：宿主是 display: grid，cols=3 分出三列',
    m.display === 'grid' && m.columns === 3,
    JSON.stringify({ display: m.display, columns: m.columns }),
  );
  check(
    'cols=3：前三个子项同一行（top 相同），第四个换行',
    m.tops[0] === m.tops[1] &&
      m.tops[1] === m.tops[2] &&
      m.tops[3] > m.tops[2] &&
      m.widths[0] === m.widths[1] &&
      m.widths[1] === m.widths[2],
    JSON.stringify({ tops: m.tops, widths: m.widths }),
  );
  check(
    'gap 三档 = --mc-space-2 / --mc-space-4 / --mc-space-6 解析出来的像素值（8 / 16 / 24）',
    m.gaps.sm === m.gapTokens.sm &&
      m.gaps.md === m.gapTokens.md &&
      m.gaps.lg === m.gapTokens.lg &&
      m.gaps.sm !== m.gaps.md &&
      m.gaps.md !== m.gaps.lg,
    JSON.stringify({ gaps: m.gaps, tokens: m.gapTokens }),
  );
  check(
    'span=2：grid-column 是 span 2，宽度约等于两列 + 一个 gap，且和后面的项同一行',
    m.span.gridColumn.includes('span 2') &&
      Math.abs(m.span.width0 - (m.span.width1 * 2 + parseFloat(m.span.gap))) <= 2 &&
      m.span.tops[0] === m.span.tops[1],
    JSON.stringify(m.span),
  );
  check(
    'min-item-width="200px" 在 500px 容器里排成两列（auto-fill），第三项换行',
    m.min.template.split(' ').length === 2 &&
      m.min.tops[0] === m.min.tops[1] &&
      m.min.tops[2] > m.min.tops[1],
    JSON.stringify(m.min),
  );

  /* 运行时改 cols：立刻换列数；删掉它回到 1 列兜底 */
  const runtime = await page.evaluate(async () => {
    const grid = document.getElementById('p-grid');
    grid.setAttribute('cols', '2');
    await new Promise((r) => setTimeout(r, 200));
    const two = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    grid.removeAttribute('cols');
    await new Promise((r) => setTimeout(r, 200));
    const one = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const inline = grid.style.getPropertyValue('--mc-grid-cols');
    return { two, one, inline };
  });
  check(
    '运行时改 cols 换列数；回到默认时不留下内部变量（用者的 style 覆盖不会被盖住）',
    runtime.two === 2 && runtime.one === 1 && runtime.inline === '',
    JSON.stringify(runtime),
  );

  /* 对照组：span=1 的项不该跨列 */
  const plainSpan = await page.evaluate(() => {
    const item = document.getElementById('p-s1');
    return { gridColumn: getComputedStyle(item).gridColumn, inline: item.style.getPropertyValue('--mc-grid-span') };
  });
  check(
    'span=1（默认）不写内部变量，交给 CSS 兜底 span 1',
    plainSpan.inline === '' && plainSpan.gridColumn.replace(/\s+/g, ' ').includes('span 1'),
    JSON.stringify(plainSpan),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('grid-probe')?.remove());
  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('mc-grid 文档页没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
