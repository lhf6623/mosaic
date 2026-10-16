/**
 * 站点 · 顶栏搜索（docs/components/search.html）
 *
 * 形态是「输入才出列表」：输入框常驻顶栏，空查询不挂列表、也不列全量。
 * 覆盖：空查询不弹、按名字 / 中文名过滤、无匹配空态、键盘与指针都能选中跳页、点空白收口后能挂回来、原地跳不卡加载条。
 */

export default async function run({ page, visit, check, routerReady }) {
  await visit(page, '/index.html#/packages/button/page.html');
  await routerReady();
  await page
    .waitForFunction(() => !!window.__deep('doc-search')?.shadowRoot?.querySelector('#field'), {
      timeout: 15000,
    })
    .catch(() => {});

  const state = () =>
    page.evaluate(() => {
      const root = window.__deep('doc-search').shadowRoot;
      const panel = root.querySelector('#panel');
      const field = root.querySelector('#field');
      const rows = [...root.querySelectorAll('.row')];
      return {
        open: !!panel?.matches(':popover-open'),
        value: field?.shadowRoot?.querySelector('[part="input"]')?.value ?? null,
        rows: rows.length,
        first: rows[0]?.textContent.replace(/\s+/g, ' ').trim() ?? null,
        active: rows.findIndex((row) => row.hasAttribute('data-active')),
        empty: !!root.querySelector('.empty'),
        focused: root.activeElement?.tagName ?? null,
        hash: decodeURIComponent(location.hash),
      };
    });

  /** 直接写原生 input + 派发 input：走的是 mc-input 转发的同一个事件，不必真敲键盘 */
  const type = async (value) => {
    await page.evaluate((text) => {
      const field = window.__deep('doc-search').shadowRoot.querySelector('#field');
      const native = field.shadowRoot.querySelector('[part="input"]');
      native.focus();
      native.value = text;
      native.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }, value);
    await page.waitForTimeout(150);
  };

  const fieldBox = () =>
    page.evaluate(() => {
      const native = window
        .__deep('doc-search')
        .shadowRoot.querySelector('#field')
        .shadowRoot.querySelector('[part="input"]');
      const box = native.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });

  /* ------------------------------------------------------------------ *
   * 1. 常驻输入框 + 空查询不挂列表
   * ------------------------------------------------------------------ */
  check(
    '顶栏有常驻搜索输入框（带内置 search 图标）',
    await page.evaluate(() => {
      const search = window.__deep('doc-search');
      return !!search?.shadowRoot?.querySelector('#field mc-icon[name="search"]');
    }),
  );

  const idle = await state();
  check(
    '空查询不挂列表、也不列全量',
    !idle.open && idle.rows === 0 && idle.value === '',
    JSON.stringify(idle),
  );

  /* ------------------------------------------------------------------ *
   * 2. 输入才出列表：按中文名 / 英文名过滤
   * ------------------------------------------------------------------ */
  await type('下拉');
  const select = await state();
  check(
    '输入后挂出列表并只列命中（下拉 → 下拉选择 / 下拉菜单）',
    select.open && select.rows === 2 && select.first.startsWith('下拉选择'),
    JSON.stringify(select),
  );

  await type('zzzz');
  const none = await state();
  check('没有匹配时列表挂着、内容是空态', none.open && none.rows === 0 && none.empty, JSON.stringify(none));

  /* ------------------------------------------------------------------ *
   * 3. 键盘：↑↓ 移动当前项，回车跳页
   * ------------------------------------------------------------------ */
  await type('下拉');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(120);
  check('方向键把「当前项」往下挪一格', (await state()).active === 1, JSON.stringify(await state()));

  await type('安装');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const jumped = await state();
  check(
    '回车选中 → 跳到那一页，输入框清空、列表收起',
    jumped.hash === '#/docs/pages/install.html' && !jumped.open && jumped.value === '',
    JSON.stringify(jumped),
  );

  /* ------------------------------------------------------------------ *
   * 4. 指针：点结果行跳页
   * ------------------------------------------------------------------ */
  await type('滚动条');
  await page.evaluate(() => window.__deep('doc-search').shadowRoot.querySelector('.row').click());
  await page.waitForTimeout(900);
  const clicked = await state();
  check(
    '点结果行 → 跳到那一页，输入框清空、列表收起',
    clicked.hash === '#/packages/scroll-bar/page.html' && !clicked.open && clicked.value === '',
    JSON.stringify(clicked),
  );

  /* ------------------------------------------------------------------ *
   * 5. 收口：清空输入收列表；点空白收、再聚焦能挂回来（面板是 popover="manual"，这条路是本站自己接的）
   * ------------------------------------------------------------------ */
  await type('下拉');
  await type('');
  const cleared = await state();
  check('清空输入 → 列表收起', !cleared.open && cleared.rows === 0, JSON.stringify(cleared));

  await type('下拉');
  await page.mouse.click(400, 500);
  await page.waitForTimeout(250);
  const dismissed = await state();
  check('点空白 → 列表收起', !dismissed.open && dismissed.value === '下拉', JSON.stringify(dismissed));

  await page.evaluate(() => {
    window.__deep('doc-search').shadowRoot.querySelector('#field').shadowRoot.querySelector('[part="input"]').focus();
  });
  await page.waitForTimeout(250);
  check('再聚焦 → 输入框里还有字就把列表挂回来', (await state()).open, JSON.stringify(await state()));

  /* ------------------------------------------------------------------ *
   * 6. 真实指针点输入框不收起列表（popover="auto" 的 light dismiss 会误伤这一下，所以本站用 manual）
   * ------------------------------------------------------------------ */
  const box = await fieldBox();
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(250);
  check(
    '真实点击输入框（只想挪光标）不收起列表',
    (await state()).open,
    JSON.stringify(await state()),
  );

  /* ------------------------------------------------------------------ *
   * 7. 原地跳：选中的就是当前页 —— 不发导航，也不能留下收不了尾的加载条
   * ------------------------------------------------------------------ */
  await type('滚动条');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  const samePage = await state();
  const bar = await page.evaluate(
    () => document.querySelector('body > mc-loading-bar')?.getAttribute('state') ?? null,
  );
  check(
    '选中的就是当前页时不发导航、也不卡加载条',
    bar !== 'loading' && samePage.hash === '#/packages/scroll-bar/page.html' && !samePage.open,
    JSON.stringify(samePage) + ' bar=' + bar,
  );
}
