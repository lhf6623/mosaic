/**
 * mc-pagination · 分页：页码序列与省略号折叠、上一页/下一页可用态、点击翻页与 change 载荷、
 * property 写入（不发事件、越界夹回）、disabled、键盘移动焦点、prefix/suffix 插槽、part、尺寸三档、
 * blocks 数组（顺序 / 显隐 / 告警）（packages/pagination）。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  /* 组件自己 console.warn 的问题（未知块 / 交叉 / 布尔并存）也要收，不然「说了没说不清」 */
  const warns = [];
  const onConsole = (msg) => {
    if (msg.type() === 'warning' && msg.text().includes('[mc-pagination]')) warns.push(msg.text());
  };
  page.on('response', onResponse);
  page.on('pageerror', onError);
  page.on('console', onConsole);

  await visit(page, '/index.html?pagination=1#/packages/pagination/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-pagination'), { timeout: 8000 })
    .catch(() => {});

  /* 现搭现拆探针：位置固定在左上，量完最后一个 evaluate 删掉 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'pagination-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;display:flex;flex-direction:column;gap:8px';
    host.innerHTML = `
      <mc-pagination id="p-main" total="85" page-size="10" default-current="3" blocks='["prev","pages","next"]'></mc-pagination>
      <mc-pagination id="p-small" total="30" page-size="10" default-current="2" blocks='["prev","pages","next"]'></mc-pagination>
      <mc-pagination id="p-zero" total="0" blocks='["prev","pages","next"]'></mc-pagination>
      <mc-pagination id="p-over" total="85" page-size="10" default-current="99" blocks='["prev","pages","next"]'></mc-pagination>
      <mc-pagination id="p-disabled" total="42" page-size="10" default-current="2" disabled blocks='["prev","pages","next","jumper","sizer"]'></mc-pagination>
      <mc-pagination id="p-jump" total="85" page-size="10" default-current="2" blocks='["prev","pages","next","jumper"]'></mc-pagination>
      <mc-pagination id="p-sizer" total="85" page-size="10" default-current="3" sizer></mc-pagination>
      <mc-pagination id="p-sizer-custom" total="5000" page-size="25" default-current="5" sizer page-sizes="10,50"></mc-pagination>
      <mc-pagination id="p-size-sm" total="30" page-size="10" size="sm" blocks='["prev","pages","next"]'></mc-pagination>
      <mc-pagination id="p-size-md" total="30" page-size="10" blocks='["prev","pages","next"]'></mc-pagination>
      <mc-pagination id="p-size-lg" total="30" page-size="10" size="lg" blocks='["prev","pages","next"]'></mc-pagination>
      <mc-pagination id="p-default" total="85" page-size="10"></mc-pagination>
      <mc-pagination id="p-slots" total="85" page-size="10" blocks='["prefix","prev","pages","next","suffix"]'>
        <span id="p-prefix" slot="prefix">共 85 条</span>
        <span id="p-suffix" slot="suffix">每页 10 条</span>
      </mc-pagination>
      <mc-pagination id="p-blocks" total="85" page-size="10" default-current="3" blocks='["sizer","prev","pages","next","jumper"]'></mc-pagination>
      <mc-pagination id="p-blocks-bare" total="85" page-size="10" blocks='["pages","prev","next"]'></mc-pagination>
      <mc-pagination id="p-blocks-empty" total="85" page-size="10" blocks='[]'></mc-pagination>
      <mc-pagination id="p-blocks-cross" total="85" page-size="10" blocks='["prev","sizer","pages"]'></mc-pagination>
      <mc-pagination id="p-blocks-bad" total="85" page-size="10" blocks='["prev","nope","prev","pages"]'></mc-pagination>
      <mc-pagination id="p-blocks-prop" total="85" page-size="10"></mc-pagination>`;
    document.body.append(host);
    window.__pgChanges = [];
    for (const id of ['p-main', 'p-jump', 'p-sizer']) {
      document.getElementById(id).addEventListener('change', (event) => {
        window.__pgChanges.push(event.data);
      });
    }
  });
  await page
    .waitForFunction(
      () => {
        const el = document.getElementById('p-main');
        return !!el?.shadowRoot?.querySelector('button[part="item"]');
      },
      { timeout: 8000 },
    )
    .catch(() => {});

  /** 一台分页的当前视图：页码按钮文案 / 当前页 / 省略号数 / 前后可用态 / 各 part 是否在 */
  const snap = (id) =>
    page.evaluate((hostId) => {
      const el = document.getElementById(hostId);
      const root = el.shadowRoot;
      const items = [...root.querySelectorAll('button[part="item"]')];
      const buttons = [...root.querySelectorAll('button')];
      const jumpInput = root.querySelector('input[part="input"]');
      const sizerSelect = root.querySelector('select[part="select"]');
      /* 3 位数（第 123 / 999 页那种）会不会被输入框裁掉：临时填满再量滚动宽度 */
      const keepValue = jumpInput.value;
      jumpInput.value = '999';
      const threeDigitsFit = jumpInput.scrollWidth <= jumpInput.clientWidth + 1;
      jumpInput.value = keepValue;
      return {
        labels: items.map((b) => b.textContent.trim()),
        current: items.find((b) => b.hasAttribute('data-current'))?.textContent.trim() ?? null,
        ellipsis: root.querySelectorAll('.mc-ellipsis').length,
        isButtonEllipsis: [...root.querySelectorAll('.mc-ellipsis')].some(
          (node) => node.tagName === 'BUTTON',
        ),
        prevDisabled: root.querySelector('button[part="prev"]')?.disabled ?? null,
        nextDisabled: root.querySelector('button[part="next"]')?.disabled ?? null,
        allDisabled: buttons.every((b) => b.disabled),
        itemHeight: Math.round(items[0].getBoundingClientRect().height),
        itemWidth: Math.round(items[0].getBoundingClientRect().width),
        parts: ['list', 'item', 'prev', 'next', 'jumper', 'input'].filter((name) =>
          root.querySelector(`[part="${name}"]`),
        ).length,
        jumperDisplay: getComputedStyle(root.querySelector('[part="jumper"]')).display,
        jumpWidth: Math.round(jumpInput.getBoundingClientRect().width),
        jumpHeight: Math.round(jumpInput.getBoundingClientRect().height),
        threeDigitsFit,
        jumpDisabled: jumpInput.disabled,
        jumpPlaceholder: jumpInput.placeholder,
        sizerDisplay: getComputedStyle(root.querySelector('[part="sizer"]')).display,
        sizerOptions: [...sizerSelect.options].map((option) => option.value),
        sizerValue: sizerSelect.value,
        sizerDisabled: sizerSelect.disabled,
      };
    }, id);

  /* ---------- ① 页码序列：页数少全列、多了折叠 ---------- */
  const main = await snap('p-main');
  const small = await snap('p-small');
  check(
    'total=85 / page-size=10 → 9 页；当前第 3 页时列 1 2 3 4 … 9（两侧各 1 个，中间折叠）',
    main.labels.join(',') === '1,2,3,4,9' &&
      main.ellipsis === 1 &&
      main.current === '3' &&
      !main.isButtonEllipsis,
    JSON.stringify(main),
  );
  check(
    '页数不多时不折叠：total=30 / page-size=10 → 1 2 3 全列，无省略号',
    small.labels.join(',') === '1,2,3' && small.ellipsis === 0 && small.current === '2',
    JSON.stringify(small),
  );

  /* ---------- ② 上一页 / 下一页：按当前页禁用 ---------- */
  const edges = await page.evaluate(async () => {
    const el = document.getElementById('p-main');
    const next = () => el.shadowRoot.querySelector('button[part="next"]');
    const prev = () => el.shadowRoot.querySelector('button[part="prev"]');
    const first = { prev: prev().disabled, next: next().disabled };
    el.current = 1;
    await new Promise((r) => setTimeout(r, 50));
    const atFirst = { prev: prev().disabled, next: next().disabled };
    el.current = 9;
    await new Promise((r) => setTimeout(r, 50));
    const atLast = { prev: prev().disabled, next: next().disabled };
    return { first, atFirst, atLast };
  });
  check(
    '首页禁用「上一页」、末页禁用「下一页」，中间的页两边都能点',
    edges.first.prev === false &&
      edges.first.next === false &&
      edges.atFirst.prev === true &&
      edges.atFirst.next === false &&
      edges.atLast.prev === false &&
      edges.atLast.next === true,
    JSON.stringify(edges),
  );

  /* ---------- ③ 点击翻页：页码与 change 载荷 ---------- */
  const clicked = await page.evaluate(async () => {
    const el = document.getElementById('p-main');
    el.current = 3;
    await new Promise((r) => setTimeout(r, 50));
    window.__pgChanges.length = 0;
    const item = [...el.shadowRoot.querySelectorAll('button[part="item"]')].find(
      (b) => b.textContent.trim() === '4',
    );
    item.click();
    await new Promise((r) => setTimeout(r, 50));
    const afterItem = {
      current: el.current,
      changes: JSON.parse(JSON.stringify(window.__pgChanges)),
    };
    el.shadowRoot.querySelector('button[part="next"]').click();
    await new Promise((r) => setTimeout(r, 50));
    const afterNext = {
      current: el.current,
      changes: JSON.parse(JSON.stringify(window.__pgChanges)),
    };
    /* 点当前页：不发事件 */
    const same = [...el.shadowRoot.querySelectorAll('button[part="item"]')].find(
      (b) => b.textContent.trim() === '5',
    );
    same.click();
    await new Promise((r) => setTimeout(r, 50));
    return { afterItem, afterNext, sameCount: window.__pgChanges.length };
  });
  check(
    '点页码 4 → current=4 且发 change（载荷 { current: 4, pageSize: 10 }）；点「下一页」→ 5',
    clicked.afterItem.current === 4 &&
      JSON.stringify(clicked.afterItem.changes) ===
        JSON.stringify([{ current: 4, pageSize: 10 }]) &&
      clicked.afterNext.current === 5 &&
      clicked.afterNext.changes.length === 2,
    JSON.stringify(clicked),
  );
  check(
    '点当前页不发 change（页码没变就不发）',
    clicked.sameCount === 2,
    `change 次数 ${clicked.sameCount}（应为 2）`,
  );

  /* ---------- ④ property 写入：不发事件、越界夹回 ---------- */
  const prop = await page.evaluate(async () => {
    const el = document.getElementById('p-main');
    window.__pgChanges.length = 0;
    el.current = 8;
    await new Promise((r) => setTimeout(r, 50));
    const at8 = {
      current: el.current,
      shown: el.shadowRoot.querySelector('button[part="item"][data-current]')?.textContent.trim(),
      changes: window.__pgChanges.length,
    };
    el.current = 99;
    await new Promise((r) => setTimeout(r, 50));
    const over = { current: el.current };
    el.current = -3;
    await new Promise((r) => setTimeout(r, 50));
    return { at8, over, under: el.current };
  });
  check(
    '写 property current：立刻生效、不发 change；越界夹回 [1, 总页数]',
    prop.at8.current === 8 &&
      prop.at8.shown === '8' &&
      prop.at8.changes === 0 &&
      prop.over.current === 9 &&
      prop.under === 1,
    JSON.stringify(prop),
  );

  /* ---------- ⑤ default-current 越界 ---------- */
  const over = await snap('p-over');
  check(
    'default-current=99（只有 9 页）→ 落在最后一页，且「下一页」禁用',
    over.current === '9' && over.nextDisabled === true,
    JSON.stringify(over),
  );

  /* ---------- ⑥ 空数据 + 禁用 ---------- */
  const zero = await snap('p-zero');
  const disabled = await snap('p-disabled');
  check(
    'total=0 → 仍有一条页码条（只有 1），前后都禁用',
    zero.labels.join(',') === '1' && zero.prevDisabled === true && zero.nextDisabled === true,
    JSON.stringify(zero),
  );
  check(
    'disabled：所有按钮都禁用（原生 disabled），翻页事件不发',
    disabled.allDisabled === true && disabled.prevDisabled && disabled.nextDisabled,
    JSON.stringify(disabled),
  );
  const disabledClick = await page.evaluate(async () => {
    const el = document.getElementById('p-disabled');
    window.__pgChanges.length = 0;
    el.shadowRoot.querySelector('button[part="item"]')?.click();
    await new Promise((r) => setTimeout(r, 50));
    return { current: el.current, changes: window.__pgChanges.length };
  });
  check(
    'disabled 时点页码无反应、不发 change',
    disabledClick.current === 2 && disabledClick.changes === 0,
    JSON.stringify(disabledClick),
  );

  /* ---------- ⑦ 运行时改 page-size / sibling-count ---------- */
  const runtime = await page.evaluate(async () => {
    const small = document.getElementById('p-small');
    small.setAttribute('page-size', '5');
    await new Promise((r) => setTimeout(r, 50));
    const sixPages = [...small.shadowRoot.querySelectorAll('button[part="item"]')].map((b) =>
      b.textContent.trim(),
    );
    const main = document.getElementById('p-main');
    main.setAttribute('sibling-count', '0');
    main.current = 3;
    await new Promise((r) => setTimeout(r, 50));
    const dense = [...main.shadowRoot.querySelectorAll('button[part="item"]')].map((b) =>
      b.textContent.trim(),
    );
    const gaps = main.shadowRoot.querySelectorAll('.mc-ellipsis').length;
    main.setAttribute('sibling-count', '1');
    main.removeAttribute('sibling-count');
    return { sixPages, dense, gaps };
  });
  check(
    '改 page-size → 总页数跟着变（30 条每页 5 条 = 6 页全列）',
    runtime.sixPages.join(',') === '1,2,3,4,5,6',
    JSON.stringify(runtime.sixPages),
  );
  check(
    'sibling-count=0 → 当前第 3 页只剩 1 … 3 … 9（两个省略号）',
    runtime.dense.join(',') === '1,3,9' && runtime.gaps === 2,
    JSON.stringify({ dense: runtime.dense, gaps: runtime.gaps }),
  );

  /* ---------- ⑧ 键盘：方向键 / Home / End 在可用按钮之间移动焦点 ---------- */
  const keyboard = await page.evaluate(async () => {
    const el = document.getElementById('p-main');
    el.current = 3;
    await new Promise((r) => setTimeout(r, 50));
    const focusLabel = () => {
      const active = el.shadowRoot.activeElement;
      /* 页码按钮的文字是页码，前后两枚按钮里只有图标，靠 data-step 认 */
      return active?.textContent?.trim() || active?.getAttribute('data-step') || null;
    };
    const buttons = [...el.shadowRoot.querySelectorAll('button')];
    buttons[1].focus();
    const start = focusLabel();
    const press = (key) =>
      el.shadowRoot
        .activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    press('ArrowRight');
    await new Promise((r) => setTimeout(r, 30));
    const right = focusLabel();
    press('End');
    await new Promise((r) => setTimeout(r, 30));
    const end = focusLabel();
    press('Home');
    await new Promise((r) => setTimeout(r, 30));
    return { start, right, end, home: focusLabel() };
  });
  check(
    '键盘：方向键右移到下一颗按钮，End 到最后一颗、Home 回第一颗',
    keyboard.start === '1' &&
      keyboard.right === '2' &&
      keyboard.end === 'next' &&
      keyboard.home === 'prev',
    JSON.stringify(keyboard),
  );

  /* ---------- ⑨ 插槽与 part ---------- */
  const slots = await page.evaluate(() => {
    const el = document.getElementById('p-slots');
    const box = (id) => document.getElementById(id)?.getBoundingClientRect();
    const prefix = box('p-prefix');
    const suffix = box('p-suffix');
    const list = el.shadowRoot.querySelector('button[part="prev"]').getBoundingClientRect();
    return {
      prefix: !!prefix && prefix.width > 0 && prefix.right <= list.left,
      suffix: !!suffix && suffix.width > 0 && suffix.left >= list.right,
      width: { prefix: prefix?.width, suffix: suffix?.width },
      text: [el.querySelector('[slot="prefix"]')?.textContent, el.querySelector('[slot="suffix"]')?.textContent],
    };
  });
  check(
    'prefix / suffix 插槽渲染在页码条两侧（都可见，prefix 在左、suffix 在右）',
    slots.prefix && slots.suffix && slots.text[0] === '共 85 条' && slots.text[1] === '每页 10 条',
    JSON.stringify(slots),
  );
  check(
    'part 六个都在：list / item / prev / next / jumper / input',
    main.parts === 6,
    `找到 ${main.parts} 个 part（应为 6）`,
  );

  /* ---------- ⑪ 输入跳转 ---------- */
  const jumpBox = await snap('p-jump');
  const jumpVisibility = { off: main.jumperDisplay, on: jumpBox.jumperDisplay };
  check(
    'jumper 关着时整格不显示（display: none），加了 jumper 才出现',
    // 宿主是 inline-flex，label 作为 flex item 会被块化：inline-flex 计算成 flex
    jumpVisibility.off === 'none' && jumpVisibility.on === 'flex',
    JSON.stringify(jumpVisibility),
  );
  check(
    '跳页输入框比页码按钮小一号，且 3 位数不被裁（md：33×28 vs 按钮 36×36）',
    jumpBox.jumpWidth < jumpBox.itemWidth &&
      jumpBox.jumpHeight < jumpBox.itemHeight &&
      jumpBox.threeDigitsFit === true,
    JSON.stringify({
      input: `${jumpBox.jumpWidth}×${jumpBox.jumpHeight}`,
      item: `${jumpBox.itemWidth}×${jumpBox.itemHeight}`,
      threeDigitsFit: jumpBox.threeDigitsFit,
    }),
  );

  const jump = await page.evaluate(async () => {
    const el = document.getElementById('p-jump');
    const input = () => el.shadowRoot.querySelector('input[part="input"]');
    window.__pgChanges.length = 0;
    const initial = {
      placeholder: input().placeholder,
      value: input().value,
      max: input().max,
    };
    /* 提交两条路：原生 change（失焦）与 Enter */
    const submit = async (value, viaEnter) => {
      input().value = value;
      if (viaEnter) {
        input().dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
        );
      } else {
        /* 原生 change 不冒泡、也不 composed（照真实行为来）：组件把监听挂在输入框自己身上 */
        input().dispatchEvent(new Event('change'));
      }
      await new Promise((r) => setTimeout(r, 50));
      return { current: el.current, value: input().value, placeholder: input().placeholder };
    };
    const change = await submit('7', false);
    const enter = await submit('5', true);
    const over = await submit('99', false);
    const under = await submit('0', false);
    /* number 的原生 spinner（上下箭头）应该被 CSS 关掉：appearance 会落在 textfield */
    const spin = getComputedStyle(input(), '::-webkit-inner-spin-button');
    const spinOuter = getComputedStyle(input(), '::-webkit-outer-spin-button');
    return {
      initial,
      change,
      enter,
      over,
      under,
      changes: JSON.parse(JSON.stringify(window.__pgChanges)),
      spinner: { inner: spin.appearance, outer: spinOuter.appearance, margin: spin.margin },
    };
  });
  check(
    '输入框初始：placeholder 是当前页（2）、值是空的、max 跟着总页数（9）',
    jump.initial.placeholder === '2' && jump.initial.value === '' && jump.initial.max === '9',
    JSON.stringify(jump.initial),
  );
  check(
    '跳页：失焦（change）与回车（Enter）都提交，提交后清空输入、placeholder 顶回当前页',
    jump.change.current === 7 &&
      jump.change.value === '' &&
      jump.change.placeholder === '7' &&
      jump.enter.current === 5 &&
      jump.enter.placeholder === '5',
    JSON.stringify({ change: jump.change, enter: jump.enter }),
  );
  check(
    '输入框里没有原生上下箭头（number 的 spinner 已关掉）',
    jump.spinner.inner === 'textfield' &&
      jump.spinner.outer === 'textfield' &&
      jump.spinner.margin === '0px',
    JSON.stringify(jump.spinner),
  );
  check(
    '跳页越界夹回：99 → 最后一页（9），0 → 第一页（1）',
    jump.over.current === 9 && jump.under.current === 1,
    JSON.stringify({ over: jump.over, under: jump.under }),
  );
  check(
    '跳页发的 change 与点页码同形：{ current, pageSize }，且页码没变的那次不发',
    JSON.stringify(jump.changes) ===
      JSON.stringify([
        { current: 7, pageSize: 10 },
        { current: 5, pageSize: 10 },
        { current: 9, pageSize: 10 },
        { current: 1, pageSize: 10 },
      ]),
    JSON.stringify(jump.changes),
  );
  check(
    'disabled 时跳页输入框同样禁用',
    disabled.jumpDisabled === true && disabled.jumpPlaceholder === '2',
    JSON.stringify({ jumpDisabled: disabled.jumpDisabled, placeholder: disabled.jumpPlaceholder }),
  );

  /* ---------- ⑫ 每页条数 ---------- */
  const sizerOn = await snap('p-sizer');
  const sizerCustom = await snap('p-sizer-custom');
  check(
    'sizer 关着时整格不显示（display: none），加了 sizer 才出现',
    main.sizerDisplay === 'none' && sizerOn.sizerDisplay === 'flex',
    JSON.stringify({ off: main.sizerDisplay, on: sizerOn.sizerDisplay }),
  );
  check(
    '候选项来自 page-sizes（默认 10 / 20 / 50 / 100），select.value 跟着 page-size',
    sizerOn.sizerOptions.join(',') === '10,20,50,100' && sizerOn.sizerValue === '10',
    JSON.stringify({ options: sizerOn.sizerOptions, value: sizerOn.sizerValue }),
  );
  check(
    '当前 page-size 不在 page-sizes 里时补进候选项并排序（25 + 10,50 → 10,25,50）',
    sizerCustom.sizerOptions.join(',') === '10,25,50' && sizerCustom.sizerValue === '25',
    JSON.stringify({ options: sizerCustom.sizerOptions, value: sizerCustom.sizerValue }),
  );

  const sizerPicked = await page.evaluate(async () => {
    const el = document.getElementById('p-sizer');
    const select = () => el.shadowRoot.querySelector('select[part="select"]');
    window.__pgChanges.length = 0;
    select().value = '20';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    const twenty = {
      attr: el.getAttribute('page-size'),
      current: el.current,
      pages: [...el.shadowRoot.querySelectorAll('button[part="item"]')].map((b) =>
        b.textContent.trim(),
      ),
      value: select().value,
      changes: JSON.parse(JSON.stringify(window.__pgChanges)),
    };
    /* 换到超大条数：总页数塌成 1，当前页被夹回第一页，照样发 change */
    select().value = '100';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    const hundred = {
      attr: el.getAttribute('page-size'),
      current: el.current,
      changes: JSON.parse(JSON.stringify(window.__pgChanges)),
    };
    /* 选同一档：page-size 没变，不发事件 */
    select().dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    return { twenty, hundred, sameCount: window.__pgChanges.length };
  });
  check(
    '换每页条数：写回 page-size、总页数跟着变、当前页保持不变并发 change',
    sizerPicked.twenty.attr === '20' &&
      sizerPicked.twenty.current === 3 &&
      sizerPicked.twenty.pages.join(',') === '1,2,3,4,5' &&
      sizerPicked.twenty.value === '20' &&
      JSON.stringify(sizerPicked.twenty.changes) === JSON.stringify([{ current: 3, pageSize: 20 }]),
    JSON.stringify(sizerPicked.twenty),
  );
  check(
    '换条数后当前页越界会被夹回（10 → 100 条只剩 1 页，current 落回 1），change 用的是夹回后的值',
    sizerPicked.hundred.attr === '100' &&
      sizerPicked.hundred.current === 1 &&
      JSON.stringify(sizerPicked.hundred.changes) ===
        JSON.stringify([
          { current: 3, pageSize: 20 },
          { current: 1, pageSize: 100 },
        ]),
    JSON.stringify(sizerPicked.hundred),
  );
  check(
    '选择器没变（选了同一档）不发 change',
    sizerPicked.sameCount === 2,
    `change 次数 ${sizerPicked.sameCount}（应为 2）`,
  );
  check(
    'disabled 时每页条数选择器同样禁用',
    disabled.sizerDisabled === true,
    JSON.stringify({ sizerDisabled: disabled.sizerDisabled }),
  );

  /* ---------- ⑩ 尺寸三档 ---------- */
  const heights = {
    sm: (await snap('p-size-sm')).itemHeight,
    md: (await snap('p-size-md')).itemHeight,
    lg: (await snap('p-size-lg')).itemHeight,
  };
  check(
    '尺寸三档：按钮高度 sm < md < lg',
    heights.sm < heights.md && heights.md < heights.lg,
    JSON.stringify(heights),
  );

  /* ---------- ⑪ blocks：默认值 / 顺序 / 显隐 / 告警 ---------- */
  /* 默认（不写 blocks）：页码是主体，上一页 / 下一页不带 —— 要就点名 */
  const defaults = await page.evaluate(async () => {
    const el = document.getElementById('p-default');
    await new Promise((r) => requestAnimationFrame(() => r()));
    const root = el.shadowRoot;
    return {
      flag: el.getAttribute('data-blocks'),
      pages: root.querySelectorAll('button[part="item"]').length,
      prevWidth: Math.round(root.querySelector('[data-block="prev"]').getBoundingClientRect().width),
      nextWidth: Math.round(root.querySelector('[data-block="next"]').getBoundingClientRect().width),
    };
  });
  check(
    '不写 blocks：默认只渲染页码主体，上一页 / 下一页不出现',
    defaults.flag === 'pages' &&
      defaults.pages > 0 &&
      defaults.prevWidth === 0 &&
      defaults.nextWidth === 0,
    JSON.stringify(defaults),
  );

  const sizerOnly = await page.evaluate(() => ({
    flag: document.getElementById('p-sizer').getAttribute('data-blocks'),
    custom: document.getElementById('p-sizer-custom').getAttribute('data-blocks'),
  }));
  check(
    '不写 blocks 时 sizer 仍按捷径追加在页码之后（pages sizer）',
    sizerOnly.flag === 'pages sizer' && sizerOnly.custom === 'pages sizer',
    JSON.stringify(sizerOnly),
  );

  /** 一台分页的横向排布：各块的 left 与宽度（display:none 的块宽高为 0） */
  const layout = (id) =>
    page.evaluate((hostId) => {
      const el = document.getElementById(hostId);
      const root = el.shadowRoot;
      const box = (sel) => {
        const node = root.querySelector(sel);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { left: Math.round(rect.left), width: Math.round(rect.width) };
      };
      const hostRect = el.getBoundingClientRect();
      return {
        flag: el.getAttribute('data-blocks'),
        size: { w: Math.round(hostRect.width), h: Math.round(hostRect.height) },
        list: box('.mc-list'),
        prev: box('[data-block="prev"]'),
        next: box('[data-block="next"]'),
        page: box('[data-block="pages"]'),
        sizer: box('.mc-sizer'),
        jumper: box('.mc-jumper'),
      };
    }, id);

  const blocksWide = await layout('p-blocks');
  check(
    'blocks：数组顺序写进 data-blocks，sizer 排到页码条之前、jumper 排到之后',
    blocksWide.flag === 'sizer prev pages next jumper' &&
      blocksWide.sizer.width > 0 &&
      blocksWide.sizer.left < blocksWide.list.left &&
      blocksWide.jumper.width > 0 &&
      blocksWide.jumper.left > blocksWide.list.left,
    JSON.stringify(blocksWide),
  );

  const blocksBare = await layout('p-blocks-bare');
  check(
    'blocks：prev / next 能在页码条内部换到 pages 后面，没列出来的 sizer / jumper 不渲染',
    blocksBare.flag === 'pages prev next' &&
      blocksBare.page.left < blocksBare.prev.left &&
      blocksBare.prev.width > 0 &&
      blocksBare.next.width > 0 &&
      blocksBare.sizer.width === 0 &&
      blocksBare.jumper.width === 0,
    JSON.stringify(blocksBare),
  );

  const blocksEmpty = await layout('p-blocks-empty');
  check(
    'blocks 空数组：一块都不渲染（宿主高度塌成 0，各块宽度都是 0）',
    blocksEmpty.flag === '' &&
      blocksEmpty.size.h === 0 &&
      [blocksEmpty.list, blocksEmpty.sizer, blocksEmpty.jumper].every((box) => box.width === 0),
    JSON.stringify(blocksEmpty),
  );

  const blocksCross = await layout('p-blocks-cross');
  check(
    'blocks：插进页码条内部的块被整体挪到页码条之后，并 warn 一次（不静默挪位）',
    blocksCross.sizer.width > 0 &&
      blocksCross.sizer.left > blocksCross.list.left &&
      warns.some((text) => text.includes('不能插在页码条内部')),
    JSON.stringify({ blocksCross, warns }),
  );

  const blocksBad = await layout('p-blocks-bad');
  check(
    'blocks：未知键与重复键被忽略，只留合法且首次出现的',
    blocksBad.flag === 'prev pages' &&
      warns.some((text) => text.includes('不是可用的块')) &&
      warns.some((text) => text.includes('出现多次')),
    JSON.stringify({ blocksBad, warns }),
  );

  const blocksProp = await page.evaluate(async () => {
    const el = document.getElementById('p-blocks-prop');
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    el.blocks = ['jumper', 'pages'];
    await raf();
    const root = el.shadowRoot;
    const box = (sel) => {
      const node = root.querySelector(sel);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { left: Math.round(rect.left), width: Math.round(rect.width) };
    };
    return {
      flag: el.getAttribute('data-blocks'),
      shown: el.blocks,
      jumper: box('.mc-jumper'),
      page: box('[data-block="pages"]'),
      prev: box('[data-block="prev"]'),
      next: box('[data-block="next"]'),
    };
  });
  check(
    'blocks：property 通道实时生效，不在数组里的 prev / next 立刻消失',
    blocksProp.flag === 'jumper pages' &&
      JSON.stringify(blocksProp.shown) === '["jumper","pages"]' &&
      blocksProp.page.left > blocksProp.jumper.left &&
      blocksProp.prev.width === 0 &&
      blocksProp.next.width === 0,
    JSON.stringify(blocksProp),
  );

  /* 挂载前赋 property + 与布尔并存：数组说了算，布尔被忽略并 warn */
  const blocksPreset = await page.evaluate(async () => {
    const el = document.createElement('mc-pagination');
    el.setAttribute('total', '85');
    el.setAttribute('sizer', '');
    el.blocks = ['pages'];
    document.getElementById('pagination-probe').append(el);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const root = el.shadowRoot;
    const sizer = root.querySelector('.mc-sizer');
    const result = {
      flag: el.getAttribute('data-blocks'),
      sizerWidth: Math.round(sizer.getBoundingClientRect().width),
    };
    el.remove();
    return result;
  });
  check(
    'blocks：挂载前赋 property 也认；与 sizer 布尔并存时只认数组（选择器不显示）并 warn',
    blocksPreset.flag === 'pages' &&
      blocksPreset.sizerWidth === 0 &&
      warns.some((text) => text.includes('布尔被忽略')),
    JSON.stringify({ blocksPreset, warns }),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('pagination-probe')?.remove());
  page.off('response', onResponse);
  page.off('pageerror', onError);
  page.off('console', onConsole);
}
