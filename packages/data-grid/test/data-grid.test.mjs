/**
 * mc-data-grid · 数据网格：property 通道（columns / data / selected）、复选与全选（受控 + select-change）、
 * 三态排序（只发事件）、单元格事件（click / dblclick / data-action）、行 key、HTML 单元格通道、
 * 空态 / 加载态与插槽、固定高度表头吸顶、500 行渲染耗时
 */

export default async function run({ page, visit, check }) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push('console: ' + message.text());
  });

  await visit(page, '/index.html?data-grid=1#/packages/data-grid/page.html');
  await page
    .waitForFunction(() => window.__deepAll('mc-data-grid').length >= 4, { timeout: 8000 })
    .catch(() => {});

  const demos = await page.evaluate(() => {
    const grids = window.__deepAll('mc-data-grid');
    const demo = window.__deep('demo-data-grid-basic');
    const demoGrid = demo?.shadowRoot?.querySelector('mc-data-grid');
    return {
      count: grids.length,
      demoRows: demoGrid?.shadowRoot?.querySelectorAll('tbody tr').length,
      defined: !!customElements.get('mc-data-grid'),
    };
  });
  check('文档页演示区渲染出多张网格', demos.count >= 4 && demos.defined, JSON.stringify(demos));
  check('基本用法演示有数据行', demos.demoRows === 3, String(demos.demoRows));

  /* 现搭现拆探针：property 通道 + 属性 JSON 通道 + 预设 property（P31） */
  const probe = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'dg-probe';
    host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;width:900px';
    document.body.append(host);

    const grid = document.createElement('mc-data-grid');
    grid.setAttribute('selectable', '');
    grid.setAttribute('sortable', '');
    grid.setAttribute('row-key', 'no');
    grid.style.height = '240px';
    host.append(grid);
    await customElements.whenDefined('mc-data-grid');
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));

    const events = [];
    for (const name of ['select-change', 'sort-change', 'cell-click', 'cell-dblclick', 'cell-action']) {
      grid.addEventListener(name, (event) => events.push({ name, data: event.data, detail: event.detail }));
    }

    grid.columns = [
      { key: 'no', title: '编号', width: '120px', sortable: true },
      { key: 'customer', title: '客户' },
      { key: 'amount', title: '金额', align: 'right' },
      { key: 'ops', title: '操作' },
    ];
    grid.data = [
      { no: 'A-1', customer: '华东金属', amount: '¥1.00', cells: { ops: '<button data-action="edit">编辑</button>' } },
      { no: 'A-2', customer: '远洋物流', amount: '¥2.00', cells: { ops: '<button data-action="edit">编辑</button>' } },
      { no: 'A-3', customer: '中盛建材', amount: '¥3.00', cells: { ops: '<button data-action="edit">编辑</button>' } },
    ];
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));
    const root = grid.shadowRoot;

    const snapshot = () => ({
      heads: root.querySelectorAll('thead th').length,
      rows: root.querySelectorAll('tbody tr').length,
      rowKey: root.querySelector('tbody tr')?.getAttribute('data-row-key'),
      amountAlign: root.querySelector('tbody td[data-col="amount"]')?.getAttribute('data-align'),
      actionButton: !!root.querySelector('tbody button[data-action="edit"]'),
      selected: grid.selected,
      checkboxes: root.querySelectorAll('tbody input[data-pick]').length,
    });

    /* 选一行 */
    root.querySelector('tbody input[data-pick]').click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    const afterPick = snapshot();

    /* 全选 + 清空 */
    root.querySelector('[data-select-all]').click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    const afterAll = { selected: grid.selected.length, head: !!root.querySelector('[data-select-all]').checked };
    grid.clearSelection();

    /* 排序三态（表头重渲染会换节点，每次重新取按钮） */
    const clickSort = async () => {
      root.querySelector('th[data-sortable] .mc-sort').click();
      await new Promise((resolve) => setTimeout(resolve, 30));
    };
    await clickSort();
    const sortAsc = root.querySelector('th[data-sort="asc"]') ? 'asc' : 'none';
    await clickSort();
    const sortDesc = root.querySelector('th[data-sort="desc"]') ? 'desc' : 'none';
    await clickSort();
    const sortNone = root.querySelector('th[data-sort]') ? 'some' : 'none';

    /* 单元格点击 / 双击 / 行内按钮 */
    const customerCell = root.querySelector('tbody td[data-col="customer"]');
    customerCell.click();
    customerCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    root.querySelector('tbody button[data-action="edit"]').click();
    await new Promise((resolve) => setTimeout(resolve, 30));

    /* 空态 / 加载态 */
    grid.data = [];
    await new Promise((resolve) => setTimeout(resolve, 40));
    const emptyShown = !!root.querySelector('.mc-empty[data-visible]');
    grid.setAttribute('loading', '');
    await new Promise((resolve) => setTimeout(resolve, 40));
    const loadingShown = !!root.querySelector('.mc-loading[data-visible]');
    grid.removeAttribute('loading');

    /* 固定高度 + sticky */
    grid.data = Array.from({ length: 200 }, (_, index) => ({
      no: 'B-' + index,
      customer: 'C' + index,
      amount: index,
      ops: '',
    }));
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
    const wrap = root.querySelector('.mc-wrap');
    wrap.scrollTop = 120;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const headTop = root.querySelector('thead th').getBoundingClientRect().top;
    const wrapTop = wrap.getBoundingClientRect().top;

    /* 预设 property（挂载前赋值） */
    const preset = document.createElement('mc-data-grid');
    preset.columns = [{ key: 'a', title: 'A' }];
    preset.data = [{ a: '预设' }];
    host.append(preset);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
    const presetText = preset.shadowRoot?.querySelector('tbody td')?.textContent;

    /* 属性 JSON 通道 */
    const byAttr = document.createElement('mc-data-grid');
    byAttr.setAttribute('columns', JSON.stringify([{ key: 'b', title: 'B' }]));
    byAttr.setAttribute('data', JSON.stringify([{ b: '来自属性' }]));
    host.append(byAttr);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
    const attrText = byAttr.shadowRoot?.querySelector('tbody td')?.textContent;

    /* 500 行耗时 */
    const start = performance.now();
    grid.data = Array.from({ length: 500 }, (_, index) => ({ no: 'P-' + index, customer: 'C' + index }));
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100)));
    const render500 = performance.now() - start;

    host.remove();

    return {
      snapshot,
      initial: { heads: 5, rows: 3 },
      afterPick,
      afterAll,
      sortAsc,
      sortDesc,
      sortNone,
      emptyShown,
      loadingShown,
      sticky: Math.abs(headTop - wrapTop) <= 1,
      events: events.map((event) => event.name),
      eventPayloads: events.slice(0, 2),
      presetText,
      attrText,
      render500: Number(render500.toFixed(1)),
    };
  }).catch((error) => ({ fatal: String(error && error.stack ? error.stack : error) }));

  if (probe.fatal) {
    check('探针执行成功', false, probe.fatal);
    return;
  }

  check(
    'property 通道：4 列 + 复选列、3 行、row-key 生效',
    probe.afterPick.heads === 5 && probe.afterPick.rows === 3 && probe.afterPick.rowKey === 'A-1',
    JSON.stringify(probe.afterPick),
  );
  check('列对齐 / HTML 单元格通道', probe.afterPick.amountAlign === 'right' && probe.afterPick.actionButton);
  check(
    '勾选一行：selected 读回 key、发 select-change',
    probe.afterPick.selected.length === 1 && probe.afterPick.selected[0] === 'A-1' && probe.events.length > 0,
    JSON.stringify({ selected: probe.afterPick.selected, events: probe.events }),
  );
  check(
    '全选：3 个 key、表头复选框选中',
    probe.afterAll.selected === 3 && probe.afterAll.head,
    JSON.stringify(probe.afterAll),
  );
  check(
    '排序三态 asc → desc → 取消，表头 data-sort 跟着走',
    probe.sortAsc === 'asc' && probe.sortDesc === 'desc' && probe.sortNone === 'none',
    JSON.stringify({ asc: probe.sortAsc, desc: probe.sortDesc, none: probe.sortNone }),
  );
  check(
    '单元格事件：click / dblclick / cell-action 都发',
    ['cell-click', 'cell-dblclick', 'cell-action'].every((name) => probe.events.includes(name)),
    JSON.stringify(probe.events),
  );
  check('空态 / 加载态出现', probe.emptyShown && probe.loadingShown);
  check('固定高度下滑动时表头吸顶', probe.sticky);
  check('挂载前赋的 property 生效（P31）', probe.presetText === '预设', String(probe.presetText));
  check('属性 JSON 通道生效', probe.attrText === '来自属性', String(probe.attrText));
  check('500 行渲染 < 3000ms', probe.render500 < 3000, probe.render500 + 'ms');
  /* 排序箭头只在「宿主 sortable + 列 sortable」时出现：列表页关掉排序后表头必须是纯文字 */
  const iconDisplay = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#fff';
    const plainGrid = document.createElement('mc-data-grid');
    plainGrid.columns = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B', sortable: true },
    ];
    plainGrid.data = [{ a: 1, b: 2 }];
    const sortGrid = document.createElement('mc-data-grid');
    sortGrid.setAttribute('sortable', '');
    sortGrid.columns = [{ key: 'b', title: 'B', sortable: true }];
    sortGrid.data = [{ b: 2 }];
    host.append(plainGrid, sortGrid);
    document.body.append(host);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 150)));
    const icon = (grid, index) => {
      const ths = [...grid.shadowRoot.querySelectorAll('thead th')];
      return getComputedStyle(ths[index].querySelector('.mc-sort-icon'), '::before').display;
    };
    const out = {
      plain: icon(plainGrid, 0),
      sortableColWithoutHost: icon(plainGrid, 1),
      sortableWithHost: icon(sortGrid, 0),
    };
    host.remove();
    return out;
  });
  check(
    '排序箭头只在「宿主 sortable + 列 sortable」时出现：普通表头 / 只声明列都不画箭头',
    iconDisplay.plain === 'none' &&
      iconDisplay.sortableColWithoutHost === 'none' &&
      iconDisplay.sortableWithHost === 'inline-block',
    JSON.stringify(iconDisplay),
  );

  /* 冻结列 = 左右两个独立容器（三张同源表格），阴影由容器投，滚动状态控制显隐 */
  const fixedProbe = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#fff;padding:8px';
    host.innerHTML = '<mc-data-grid id="p-fixed" selectable style="width:360px;height:160px"></mc-data-grid>';
    document.body.append(host);
    const grid = host.querySelector('#p-fixed');
    grid.columns = [
      { key: 'no', title: 'No', width: '80px', fixed: 'left' },
      { key: 'name', title: 'Name', width: '160px' },
      { key: 'amount', title: 'Amount', width: '120px', align: 'right' },
      { key: 'ops', title: 'Ops', width: '70px', fixed: 'right' },
    ];
    grid.data = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      no: 'P-' + index,
      name: '名称-' + index + ' ' + '长文本'.repeat(24),
      amount: index * 10,
      ops: '编辑',
    }));
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 250)));
    const root = grid.shadowRoot;
    const wrap = root.querySelector('.mc-wrap');
    const left = root.querySelector('.mc-pane-left');
    const main = root.querySelector('.mc-pane-main');
    const right = root.querySelector('.mc-pane-right');
    const box = (el) => el.getBoundingClientRect();
    const rect = (el) => ({ l: Math.round(box(el).left), r: Math.round(box(el).right) });
    const headers = (pane) =>
      pane ? [...pane.querySelectorAll('thead th')].map((th) => th.textContent.trim()) : [];
    const snapshot = () => ({
      attrs: {
        left: grid.hasAttribute('data-fixed-shadow-left'),
        right: grid.hasAttribute('data-fixed-shadow-right'),
      },
      leftRect: rect(left),
      rightRect: rect(right),
      wrapRect: rect(wrap),
      leftShadow: getComputedStyle(left).boxShadow,
      rightShadow: getComputedStyle(right).boxShadow,
    });
    const max = wrap.scrollWidth - wrap.clientWidth;
    const start = snapshot();
    wrap.scrollLeft = Math.round(max / 2);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
    const middle = snapshot();
    wrap.scrollLeft = max;
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
    const end = snapshot();
    const lists = [left, main, right].filter(Boolean).map((pane) => [...pane.querySelectorAll('tbody tr')]);
    const count = Math.max(...lists.map((rows) => rows.length));
    let rowsAligned = true;
    for (let index = 0; index < count; index += 1) {
      const heights = lists.map((rows) => rows[index]?.offsetHeight ?? 0);
      if (new Set(heights).size > 1) rowsAligned = false;
    }
    const out = {
      panes: { left: !!left, main: !!main, right: !!right },
      headers: { left: headers(left), main: headers(main), right: headers(right) },
      overflow: max,
      start,
      middle,
      end,
      rowsAligned,
      overlays: root.querySelectorAll('.mc-fixed-shadow').length,
    };
    host.remove();
    return out;
  });
  check(
    '冻结列 = 左右两个容器：左（复选框+固定列）/ 中间 / 右，三表逐行等高，容器阴影随滚动显隐',
    fixedProbe.panes.left &&
      fixedProbe.panes.main &&
      fixedProbe.panes.right &&
      JSON.stringify(fixedProbe.headers.left) === JSON.stringify(['', 'No']) &&
      JSON.stringify(fixedProbe.headers.right) === JSON.stringify(['Ops']) &&
      fixedProbe.headers.main.includes('Name') &&
      fixedProbe.overflow > 0 &&
      fixedProbe.rowsAligned &&
      fixedProbe.overlays === 0 &&
      fixedProbe.start.attrs.left === false &&
      fixedProbe.start.attrs.right === true &&
      fixedProbe.start.leftShadow === 'none' &&
      fixedProbe.start.rightShadow !== 'none' &&
      fixedProbe.middle.attrs.left === true &&
      fixedProbe.middle.attrs.right === true &&
      fixedProbe.end.attrs.left === true &&
      fixedProbe.end.attrs.right === false &&
      fixedProbe.end.rightShadow === 'none' &&
      fixedProbe.end.leftShadow !== 'none' &&
      Math.abs(fixedProbe.start.leftRect.l - fixedProbe.start.wrapRect.l) <= 1 &&
      Math.abs(fixedProbe.end.leftRect.l - fixedProbe.end.wrapRect.l) <= 1 &&
      Math.abs(fixedProbe.start.rightRect.r - fixedProbe.start.wrapRect.r) <= 1,
    JSON.stringify(fixedProbe),
  );

  /* 合计行：表内 tfoot，与列表列对齐；sticky 在滚动区底部；当前页数据由页面求和后传入 */
  const summaryProbe = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#fff;padding:8px';
    host.innerHTML =
      '<mc-data-grid id="p-summary" style="width:420px;height:140px"></mc-data-grid>';
    document.body.append(host);
    const grid = host.querySelector('#p-summary');
    grid.columns = [
      { key: 'name', title: '名称', width: '160px' },
      { key: 'amount', title: '金额', width: '120px', align: 'right' },
    ];
    grid.data = [
      { id: 1, name: '一', amount: 10 },
      { id: 2, name: '二', amount: 20 },
    ];
    grid.summary = { amount: '¥30.00' };
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 200)));
    const root = grid.shadowRoot;
    const foot = root.querySelector('tfoot tr.mc-summary-row');
    const headers = root.querySelectorAll('thead th');
    const out = {
      hasFoot: !!foot,
      label: foot?.querySelector('[data-summary-label]')?.textContent.trim() ?? null,
      value: foot?.querySelector('[data-summary="amount"]')?.textContent.trim() ?? null,
      cells: foot ? foot.children.length : 0,
      headers: headers.length,
      position: foot ? getComputedStyle(foot.children[0]).position : null,
      bar: root.querySelectorAll('.mc-summary-bar').length,
      spacer: root.querySelectorAll('tbody.mc-layout-spacer').length,
    };
    grid.summary = {};
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 120)));
    out.afterClear = !!root.querySelector('tfoot tr');
    host.remove();
    return out;
  });
  check(
    '合计行：表内 tfoot 与列对齐（首列「合计」、金额列显示值），sticky 在底部，清空后消失',
    summaryProbe.hasFoot &&
      summaryProbe.label === '合计' &&
      summaryProbe.value === '¥30.00' &&
      summaryProbe.cells === summaryProbe.headers &&
      summaryProbe.position === 'sticky' &&
      summaryProbe.bar === 0 &&
      summaryProbe.spacer === 1 &&
      summaryProbe.afterClear === false,
    JSON.stringify(summaryProbe),
  );

  /* 布局矩阵：短内容（spacer 顶底）/ 长内容（spacer=0、合计 sticky）/ hover 只认数据行 */
  const layoutProbe = await page.evaluate(async () => {
    const build = async ({ height, rows }) => {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#fff;padding:8px';
      host.innerHTML =
        '<mc-data-grid style="width:420px;height:' + height + 'px"></mc-data-grid>';
      document.body.append(host);
      const grid = host.querySelector('mc-data-grid');
      grid.columns = [
        { key: 'no', title: 'No', width: '80px' },
        { key: 'amount', title: 'Amount', width: '120px', align: 'right' },
      ];
      grid.data = Array.from({ length: rows }, (_, index) => ({
        id: index + 1,
        no: 'P-' + index,
        amount: index * 10,
      }));
      grid.summary = { amount: '¥' + rows * 10 + '.00' };
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 220)));
      const root = grid.shadowRoot;
      const wrap = root.querySelector('.mc-wrap');
      const panes = root.querySelector('.mc-panes');
      const summaryTd = root.querySelector('tfoot.mc-summary td[data-summary="amount"]');
      const spacerTd = root.querySelector('tbody.mc-layout-spacer td');
      const dataRows = root.querySelectorAll('tbody.mc-body tr');
      const rect = (el) => {
        const box = el.getBoundingClientRect();
        return { top: Math.round(box.top), bottom: Math.round(box.bottom) };
      };
      const out = {
        dataRows: dataRows.length,
        spacerHeight: spacerTd ? Math.round(spacerTd.getBoundingClientRect().height) : 0,
        summaryBottom: rect(summaryTd).bottom,
        wrapBottom: Math.round(wrap.getBoundingClientRect().bottom),
        wrapperContent: panes.offsetHeight,
        wrapClient: wrap.clientHeight,
        scrollHeight: wrap.scrollHeight,
        fitY: wrap.hasAttribute('data-fit-y'),
      };
      /* hover：数据行触发 data-hover，spacer 不触发 */
      dataRows[0]?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      out.dataHover = root.querySelectorAll('tbody.mc-body tr[data-hover]').length;
      spacerTd?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      out.afterSpacerHover = root.querySelectorAll('tr[data-hover]').length;
      host.remove();
      return out;
    };
    return {
      short: await build({ height: 320, rows: 3 }),
      long: await build({ height: 200, rows: 20 }),
    };
  });
  check(
    '布局矩阵：内容不足时 spacer 顶住合计行且不响应 hover；内容超出时 spacer=0、合计 sticky 在底部',
    layoutProbe.short.dataRows === 3 &&
      layoutProbe.short.spacerHeight > 0 &&
      Math.abs(layoutProbe.short.summaryBottom - layoutProbe.short.wrapBottom) <= 2 &&
      layoutProbe.short.fitY === true &&
      layoutProbe.short.dataHover === 1 &&
      layoutProbe.short.afterSpacerHover === 0 &&
      layoutProbe.long.dataRows === 20 &&
      layoutProbe.long.spacerHeight === 0 &&
      Math.abs(layoutProbe.long.summaryBottom - layoutProbe.long.wrapBottom) <= 2 &&
      layoutProbe.long.fitY === false &&
      layoutProbe.long.dataHover === 1 &&
      layoutProbe.long.afterSpacerHover === 0 &&
      layoutProbe.long.scrollHeight > layoutProbe.long.wrapClient,
    JSON.stringify(layoutProbe),
  );

  check('全程无 pageerror / console 错误', problems.length === 0, problems.slice(0, 3).join(' | '));
}