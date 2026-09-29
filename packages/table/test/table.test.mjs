/**
 * mc-table · 数据表格：property 传对象、columns 决定表头、striped / hoverable、
 * loading / empty-text、属性 JSON 兼容、真 <table> 与 part（packages/table）。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?table=1#/packages/table/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-table'), { timeout: 8000 })
    .catch(() => {});

  /* 现搭现拆探针：一个走 property、一个走属性 JSON、一个待会儿验空/加载态 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'table-probe';
    host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px';
    host.innerHTML = `
      <mc-table id="p-table"></mc-table>
      <mc-table id="p-table-attr" columns='[{"key":"a","title":"A"}]' data='[{"a":"来自属性"}]'></mc-table>
      <mc-table id="p-table-state" striped hoverable></mc-table>
      <mc-table id="p-table-preset"></mc-table>`;
    document.body.append(host);

    const table = document.getElementById('p-table');
    table.columns = [
      { key: 'name', title: '姓名', width: '40%' },
      { key: 'age', title: '年龄' },
    ];
    table.data = [
      { id: 1, name: '张三', age: 20 },
      { id: 2, name: '李四', age: 30 },
    ];

    const state = document.getElementById('p-table-state');
    state.columns = [{ key: 'n', title: 'N' }];
    state.data = [
      { id: 1, n: '一' },
      { id: 2, n: '二' },
      { id: 3, n: '三' },
    ];

    /* 挂载前就赋 property：走的是「宿主上的普通属性 → 构造期收下」那条路（P31 一族） */
    const preset = document.getElementById('p-table-preset');
    preset.columns = [{ key: 'p', title: 'P' }];
    preset.data = [{ p: '预设' }];
  });
  await page
    .waitForFunction(
      () => document.querySelector('#p-table')?.shadowRoot?.querySelectorAll('tbody tr').length === 2,
      { timeout: 8000 },
    )
    .catch(() => {});

  const readTable = (id) =>
    page.evaluate((tableId) => {
      const table = document.getElementById(tableId);
      const root = table.shadowRoot;
      if (!root) return { missing: true };
      return {
        missing: false,
        tableTag: root.querySelector('table')?.tagName ?? null,
        tablePart: root.querySelector('table')?.getAttribute('part') ?? null,
        ths: [...root.querySelectorAll('th')].map((th) => th.textContent),
        thScope: [...root.querySelectorAll('th')].map((th) => th.getAttribute('scope')),
        thPart: [...root.querySelectorAll('th')].map((th) => th.getAttribute('part')),
        thWidth: root.querySelector('th')?.style.width ?? null,
        rowCount: root.querySelectorAll('tbody tr').length,
        rowsInTbody: [...root.querySelectorAll('tbody tr')].every((tr) => !!tr.closest('tbody')),
        trPart: [...root.querySelectorAll('tbody tr')].map((tr) => tr.getAttribute('part')),
        tds: [...root.querySelectorAll('td')].map((td) => td.textContent),
        tdPart: [...root.querySelectorAll('td')].map((td) => td.getAttribute('part')),
        backgrounds: [...root.querySelectorAll('tbody tr')].map(
          (tr) => getComputedStyle(tr).backgroundColor,
        ),
        ariaBusy: root.querySelector('table')?.getAttribute('aria-busy') ?? null,
        emptyDisplay: getComputedStyle(root.querySelector('.mc-empty')).display,
        emptyText: root.querySelector('.mc-empty').textContent.trim(),
        loadingDisplay: getComputedStyle(root.querySelector('.mc-loading')).display,
      };
    }, id);

  /* ---------- property 传值：真 <table> + th scope + 行/单元格 ---------- */
  const basic = await readTable('p-table');
  check(
    'property 传 columns / data：真 <table>、<th scope="col">、两行四格都对上',
    !basic.missing &&
      basic.tableTag === 'TABLE' &&
      basic.tablePart === 'table' &&
      JSON.stringify(basic.ths) === JSON.stringify(['姓名', '年龄']) &&
      JSON.stringify(basic.thScope) === JSON.stringify(['col', 'col']) &&
      basic.rowCount === 2 &&
      basic.rowsInTbody &&
      JSON.stringify(basic.tds) === JSON.stringify(['张三', '20', '李四', '30']),
    JSON.stringify(basic),
  );
  check(
    'part：table / row / cell 三个都在，th 的 width 来自 columns.width',
    basic.tablePart === 'table' &&
      JSON.stringify(basic.trPart) === JSON.stringify(['row', 'row']) &&
      basic.thPart.every((part) => part === 'cell') &&
      basic.tdPart.every((part) => part === 'cell') &&
      basic.thWidth === '40%',
    JSON.stringify({
      tablePart: basic.tablePart,
      trPart: basic.trPart,
      thPart: basic.thPart,
      thWidth: basic.thWidth,
    }),
  );
  /* ---------- columns 决定表头：换一份 columns，表头与单元格一起换 ---------- */
  const afterColumns = await page.evaluate(async () => {
    const table = document.getElementById('p-table');
    table.columns = [{ key: 'age', title: '年龄（岁）' }];
    await new Promise((r) => setTimeout(r, 250));
    const root = table.shadowRoot;
    return {
      ths: [...root.querySelectorAll('th')].map((th) => th.textContent),
      tds: [...root.querySelectorAll('td')].map((td) => td.textContent),
    };
  });
  check(
    'columns 决定表头：换成只剩一列后，表头 1 个、每行 1 格',
    JSON.stringify(afterColumns.ths) === JSON.stringify(['年龄（岁）']) &&
      JSON.stringify(afterColumns.tds) === JSON.stringify(['20', '30']),
    JSON.stringify(afterColumns),
  );

  /* ---------- 属性写法（JSON 兼容）：不写 property 也认 ---------- */
  const byAttr = await readTable('p-table-attr');
  check(
    "属性写法 columns='[…]' / data='[…]' 也认（JSON 兼容入口）",
    !byAttr.missing &&
      JSON.stringify(byAttr.ths) === JSON.stringify(['A']) &&
      JSON.stringify(byAttr.tds) === JSON.stringify(['来自属性']),
    JSON.stringify(byAttr),
  );

  /* ---------- 挂载前赋 property（P31 那条路径） ---------- */
  const preset = await readTable('p-table-preset');
  check(
    '挂载前赋 property（createElement → el.columns / el.data → append）照常渲染',
    !preset.missing &&
      JSON.stringify(preset.ths) === JSON.stringify(['P']) &&
      JSON.stringify(preset.tds) === JSON.stringify(['预设']),
    JSON.stringify(preset),
  );

  /* ---------- striped / hoverable ---------- */
  const striped = await readTable('p-table-state');
  check(
    'striped：偶数行底色与奇数行不同（第 2 行是 --mc-table-stripe-bg）',
    striped.backgrounds.length === 3 &&
      striped.backgrounds[0] !== striped.backgrounds[1] &&
      striped.backgrounds[0] === striped.backgrounds[2],
    JSON.stringify(striped.backgrounds),
  );
  await page.locator('#p-table-state tbody tr').nth(0).hover();
  await page.waitForTimeout(120);
  const hovered = await page.evaluate(() => {
    const rows = [...document.getElementById('p-table-state').shadowRoot.querySelectorAll('tbody tr')];
    return rows.map((tr) => getComputedStyle(tr).backgroundColor);
  });
  check(
    'hoverable：鼠标停在第一行时它的底色变了（其余行不变）',
    hovered[0] !== striped.backgrounds[0] && hovered[1] === striped.backgrounds[1],
    JSON.stringify({ before: striped.backgrounds, hovered }),
  );

  /* ---------- 空态：data=[] → empty 插槽可见、文案是 empty-text ---------- */
  const empty = await page.evaluate(async () => {
    const table = document.getElementById('p-table-state');
    table.data = [];
    await new Promise((r) => setTimeout(r, 250));
    const root = table.shadowRoot;
    const before = {
      text: root.querySelector('.mc-empty').textContent.trim(),
      display: getComputedStyle(root.querySelector('.mc-empty')).display,
      loading: getComputedStyle(root.querySelector('.mc-loading')).display,
    };
    table.setAttribute('empty-text', '没有数据');
    await new Promise((r) => setTimeout(r, 250));
    before.afterAttr = root.querySelector('.mc-empty').textContent.trim();
    return before;
  });
  check(
    '空态：默认文案「暂无数据」，改 empty-text 跟着换；此时不显示 loading',
    empty.text === '暂无数据' &&
      empty.display === 'block' &&
      empty.loading === 'none' &&
      empty.afterAttr === '没有数据',
    JSON.stringify(empty),
  );

  /* ---------- loading：aria-busy + loading 插槽可见、空态让位 ---------- */
  const loading = await page.evaluate(async () => {
    const table = document.getElementById('p-table-state');
    table.setAttribute('loading', '');
    await new Promise((r) => setTimeout(r, 250));
    const root = table.shadowRoot;
    const out = {
      ariaBusy: root.querySelector('table').getAttribute('aria-busy'),
      loadingDisplay: getComputedStyle(root.querySelector('.mc-loading')).display,
      emptyDisplay: getComputedStyle(root.querySelector('.mc-empty')).display,
    };
    table.removeAttribute('loading');
    await new Promise((r) => setTimeout(r, 250));
    out.afterAriaBusy = root.querySelector('table').getAttribute('aria-busy');
    return out;
  });
  check(
    'loading：表格 aria-busy="true"、loading 插槽显示、空态让位；摘掉属性后恢复',
    loading.ariaBusy === 'true' &&
      loading.loadingDisplay === 'block' &&
      loading.emptyDisplay === 'none' &&
      loading.afterAriaBusy === null,
    JSON.stringify(loading),
  );

  /* ---------- 值里带 < 不能破结构（单元格走 :html 通道，转义在组件里） ---------- */
  const escaped = await page.evaluate(async () => {
    const table = document.createElement('mc-table');
    table.columns = [{ key: 'v', title: 'V' }];
    table.data = [{ v: '<b>粗</b> & <script>' }];
    document.body.append(table);
    await new Promise((r) => setTimeout(r, 300));
    const root = table.shadowRoot;
    const out = {
      text: root.querySelector('td')?.textContent ?? null,
      boldTags: root.querySelectorAll('td b').length,
    };
    table.remove();
    return out;
  });
  check(
    '单元格文本被转义：显示的是字面量，不生成标签',
    escaped.text === '<b>粗</b> & <script>' && escaped.boldTags === 0,
    JSON.stringify(escaped),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('table-probe')?.remove());
  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('mc-table 文档页没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
