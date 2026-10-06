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
      <mc-table id="p-table-preset"></mc-table>
      <mc-table id="p-table-slots">
        <div slot="empty" id="p-slot-empty">自定义空态</div>
        <div slot="loading" id="p-slot-loading">自定义加载中</div>
      </mc-table>`;
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

    /* 命名插槽：两个槽都放了东西，空态 / 加载态该显示它们而不是兜底文案 */
    const slots = document.getElementById('p-table-slots');
    slots.columns = [{ key: 'n', title: 'N' }];
    slots.data = [];
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
        emptyText: root.querySelector('.mc-empty mc-empty')?.getAttribute('description') ?? null,
        loadingDisplay: getComputedStyle(root.querySelector('.mc-loading')).display,
        loadingSpinner: !!root.querySelector('.mc-loading mc-spinner')?.shadowRoot,
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

  /* ---------- 空态：data=[] → empty 插槽可见，兜底是 mc-empty（description = empty-text） ---------- */
  const empty = await page.evaluate(async () => {
    const table = document.getElementById('p-table-state');
    table.data = [];
    await new Promise((r) => setTimeout(r, 300));
    const root = table.shadowRoot;
    /** 兜底那个 mc-empty：它常驻 shadow 树（有 slot="empty" 内容时只是不投影），所以直接查得到 */
    const fallback = () => root.querySelector('.mc-empty mc-empty');
    /** mc-empty 自己的文案在它的 shadow 里；[part="description"] 的 textContent 就是渲染出来的那句 */
    const rendered = () =>
      fallback()?.shadowRoot?.querySelector('[part="description"]')?.textContent.trim() ?? null;
    const read = () => ({
      description: fallback()?.getAttribute('description') ?? null,
      rendered: rendered(),
      hasGraphic: !!fallback()?.shadowRoot?.querySelector('[part="image"]'),
      upgrade: !!fallback()?.shadowRoot,
    });
    const before = {
      ...read(),
      display: getComputedStyle(root.querySelector('.mc-empty')).display,
      loading: getComputedStyle(root.querySelector('.mc-loading')).display,
    };
    table.setAttribute('empty-text', '没有数据');
    await new Promise((r) => setTimeout(r, 300));
    before.after = read();
    return before;
  });
  check(
    '空态：默认由 mc-empty 兜底（description = empty-text「暂无数据」、带内置图形），改 empty-text 跟着换；此时不显示 loading',
    empty.upgrade &&
      empty.hasGraphic &&
      empty.description === '暂无数据' &&
      empty.rendered === '暂无数据' &&
      empty.display === 'block' &&
      empty.loading === 'none' &&
      empty.after.description === '没有数据' &&
      empty.after.rendered === '没有数据',
    JSON.stringify(empty),
  );

  /* ---------- loading：那一层盖在表格上、空态让位、兜底是 mc-spinner ---------- */
  const loading = await page.evaluate(async () => {
    const table = document.getElementById('p-table-state');
    const root = () => table.shadowRoot;
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height)];
    };
    const tableBoxBefore = box(root().querySelector('table'));

    table.setAttribute('loading', '');
    await new Promise((r) => setTimeout(r, 300));
    const layer = root().querySelector('.mc-loading');
    const spinner = layer.querySelector('mc-spinner');
    const out = {
      ariaBusy: root().querySelector('table').getAttribute('aria-busy'),
      loadingDisplay: getComputedStyle(layer).display,
      /* 盖在表格上 = 绝对定位、正好铺满 .mc-wrap（也就是表格那块地方） */
      position: getComputedStyle(layer).position,
      layerBox: box(layer),
      wrapBox: box(root().querySelector('.mc-wrap')),
      emptyDisplay: getComputedStyle(root().querySelector('.mc-empty')).display,
      /* 兜底加载态 = mc-spinner(size=sm) + 一行「加载中…」：spinner 已升级、盒宽 = 表格字号（14px） */
      spinnerUpgraded: !!spinner?.shadowRoot,
      spinnerBox: spinner ? Math.round(spinner.getBoundingClientRect().width) : 0,
      fallbackText: layer.querySelector('.mc-loading-text')?.textContent.trim() ?? null,
    };
    table.removeAttribute('loading');
    await new Promise((r) => setTimeout(r, 250));
    out.afterAriaBusy = root().querySelector('table').getAttribute('aria-busy');
    out.tableBoxAfter = box(root().querySelector('table'));
    out.tableBoxBefore = tableBoxBefore;
    return out;
  });
  check(
    'loading：表格不写 aria-busy；那一层**盖在表格上**（absolute 且铺满 .mc-wrap，表格自己的盒子不动）、空态让位；兜底是 mc-spinner +「加载中…」；摘掉后仍是 null',
    loading.ariaBusy === null &&
      loading.loadingDisplay === 'flex' &&
      loading.position === 'absolute' &&
      JSON.stringify(loading.layerBox) === JSON.stringify(loading.wrapBox) &&
      JSON.stringify(loading.tableBoxAfter) === JSON.stringify(loading.tableBoxBefore) &&
      loading.emptyDisplay === 'none' &&
      loading.spinnerUpgraded &&
      loading.spinnerBox === 14 &&
      loading.fallbackText === '加载中…' &&
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

  /* ---------- bordered：整块一圈外框 + 圆角（单元格横线照旧） ---------- */
  const bordered = await page.evaluate(async () => {
    const plain = document.getElementById('p-table');
    const el = document.createElement('mc-table');
    el.setAttribute('bordered', '');
    el.columns = [{ key: 'v', title: 'V' }];
    el.data = [{ v: '一' }];
    document.body.append(el);
    await new Promise((r) => setTimeout(r, 300));
    const cs = getComputedStyle(el);
    /* 拿表头格：tbody 最后一行那条横线本来就被抹掉了（见「表格不合并边框」），别拿它当证据 */
    const head = getComputedStyle(el.shadowRoot.querySelector('th'));
    const out = {
      width: cs.borderTopWidth,
      style: cs.borderTopStyle,
      radius: cs.borderTopLeftRadius,
      overflow: cs.overflow,
      /* 外框是**加**上去的，单元格那条横线照旧 */
      headBorder: head.borderBottomWidth,
      /* 不写 bordered 的实例没有外框 */
      plainWidth: getComputedStyle(plain).borderTopWidth,
    };
    el.remove();
    return out;
  });
  check(
    'bordered：整块一圈描边 + 圆角 + 裁切（单元格横线照旧）；不写则没有外框',
    bordered.width === '1px' &&
      bordered.style === 'solid' &&
      bordered.radius === '6px' &&
      bordered.overflow === 'hidden' &&
      bordered.headBorder === '1px' &&
      bordered.plainWidth === '0px',
    JSON.stringify(bordered),
  );

  /* ---------- size：密度三档只动字号与单元格内边距，行高不动 ---------- */
  const sizes = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'size-probe';
    host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff';
    host.innerHTML =
      '<mc-table id="s-sm" size="sm"></mc-table>' +
      '<mc-table id="s-md"></mc-table>' +
      '<mc-table id="s-lg" size="lg"></mc-table>';
    document.body.append(host);
    await new Promise((r) => setTimeout(r, 300));
    for (const id of ['s-sm', 's-md', 's-lg']) {
      const el = document.getElementById(id);
      el.columns = [{ key: 'v', title: 'V' }];
      el.data = [{ v: '一' }];
    }
    await new Promise((r) => setTimeout(r, 300));
    const read = (id) => {
      const el = document.getElementById(id);
      const th = el.shadowRoot.querySelector('th');
      const thCs = getComputedStyle(th);
      return {
        font: getComputedStyle(el).fontSize,
        padX: thCs.paddingLeft,
        padY: thCs.paddingTop,
        /* 宿主上的行高：三档都该是 shadow-base 给的 24px（size 不动它） */
        lineHeight: getComputedStyle(el).lineHeight,
        rowHeight: Math.round(th.getBoundingClientRect().height),
      };
    };
    const out = { sm: read('s-sm'), md: read('s-md'), lg: read('s-lg') };
    host.remove();
    return out;
  });
  check(
    'size 三档：字号 12 / 14 / 16px、内边距 12×4 / 16×8 / 20×12px、表头行 33 / 41 / 49px；行高三档都是 24px（不跟字号走）',
    JSON.stringify(sizes) ===
      JSON.stringify({
        sm: { font: '12px', padX: '12px', padY: '4px', lineHeight: '24px', rowHeight: 33 },
        md: { font: '14px', padX: '16px', padY: '8px', lineHeight: '24px', rowHeight: 41 },
        lg: { font: '16px', padX: '20px', padY: '12px', lineHeight: '24px', rowHeight: 49 },
      }),
    JSON.stringify(sizes),
  );

  /* ---------- 命名插槽：给了内容就顶掉兜底（mc-empty 兜底空态 / 内置「加载中…」） ---------- */
  const slotsUi = await page.evaluate(async () => {
    const table = document.getElementById('p-table-slots');
    const height = (id) => document.getElementById(id).getBoundingClientRect().height;
    const assigned = (id) => !!document.getElementById(id).assignedSlot;

    await new Promise((r) => setTimeout(r, 250));
    const out = {
      emptyVisible: height('p-slot-empty') > 0,
      loadingVisible: height('p-slot-loading') > 0,
      emptyAssigned: assigned('p-slot-empty'),
      emptyText: document.getElementById('p-slot-empty').textContent.trim(),
      /* 兜底那个 mc-empty 还在 shadow 树里，只是没被投影 —— 投影进去的只有使用者的节点 */
      emptyAssignedText: (() => {
        const slot = table.shadowRoot.querySelector('.mc-empty slot');
        return [...slot.assignedNodes()]
          .map((node) => node.textContent ?? '')
          .join('')
          .trim();
      })(),
      fallbackPresent: !!table.shadowRoot.querySelector('.mc-empty mc-empty'),
    };

    table.setAttribute('loading', '');
    await new Promise((r) => setTimeout(r, 250));
    out.whileLoading = {
      emptyVisible: height('p-slot-empty') > 0,
      loadingVisible: height('p-slot-loading') > 0,
      loadingText: document.getElementById('p-slot-loading').textContent.trim(),
    };
    table.removeAttribute('loading');
    return out;
  });
  check(
    '命名插槽接手空态 / 加载态：内容是你的，mc-empty 兜底让位（两个槽都真的投影进去了）',
    slotsUi.emptyAssigned &&
      slotsUi.emptyVisible &&
      !slotsUi.loadingVisible &&
      slotsUi.emptyText === '自定义空态' &&
      slotsUi.emptyAssignedText === '自定义空态' &&
      slotsUi.fallbackPresent &&
      !slotsUi.whileLoading.emptyVisible &&
      slotsUi.whileLoading.loadingVisible &&
      slotsUi.whileLoading.loadingText === '自定义加载中',
    JSON.stringify(slotsUi),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('table-probe')?.remove());
  page.off('response', onResponse);
  page.off('pageerror', onError);}
