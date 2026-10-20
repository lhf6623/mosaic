/**
 * mc-date-picker · 日期选择：月历浮层（原生 popover + CSS 锚点定位）、值读写、键盘导航、
 * min / max、清除、状态、part 定制。
 *
 * 跑法：node tests/smoke.mjs date-picker（需先 pnpm dev）
 *
 * ⚠️ 这份套件盯的都是「静默失效」型问题 —— 面板照样渲染、只是点了没用 / 值不跟着走：
 *   · 日期必须按本地日历日算（Date.parse('YYYY-MM-DD') 在东八区会退一天）
 *   · 值必须走宿主 DOM property（P18）：事件里 e.target.value 能读到
 *   · 浮层用 popover="manual" 自己管开合（auto 的 light dismiss 会在 pointerdown 上先关）
 *   · 面板必须真的开出 top layer（:popover-open），不是靠 display 假装
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(r.status() + ' ' + r.url());
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?date-picker=1#/packages/date-picker/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-date-picker'), { timeout: 8000 })
    .catch(() => {});
  check(
    'mc-date-picker 注册成功（页面模块的 <l-m> 生效）',
    await page.evaluate(() => !!customElements.get('mc-date-picker')),
    'customElements.get("mc-date-picker") 为 false',
  );

  /* 深链 + 刷新也注册得到（P44：深链打开时首页不一定渲染过，靠本页自己的 <l-m>） */
  await page.reload({ waitUntil: 'load' });
  await page
    .waitForFunction(() => !!customElements.get('mc-date-picker'), { timeout: 8000 })
    .catch(() => {});
  check(
    '深链 + 刷新后 mc-date-picker 仍然注册成功（P44）',
    await page.evaluate(() => !!customElements.get('mc-date-picker')),
    '刷新后 customElements.get("mc-date-picker") 为 false',
  );

  /* ------------------------------------------------------------------ *
   * 现搭现拆的探针：固定定位在视口左上，避开站点外壳
   * ------------------------------------------------------------------ */
  const setupProbe = () =>
    page.evaluate(() => {
      document.getElementById('date-probe')?.remove();
      document.getElementById('date-outside')?.remove();
      const probe = document.createElement('div');
      probe.id = 'date-probe';
      probe.style.cssText = 'position: fixed; left: 16px; top: 60px; z-index: 9999;';
      const outside = document.createElement('div');
      outside.id = 'date-outside';
      outside.style.cssText =
        'position: fixed; left: 16px; top: 460px; width: 80px; height: 40px; z-index: 9999;' +
        'background-color: rgb(0 0 0 / 0.04);';
      document.body.append(probe, outside);
      window.__probe = probe;

      window.__make = (attrs) => {
        document.getElementById('probe-date')?.remove();
        const host = document.createElement('mc-date-picker');
        host.id = 'probe-date';
        for (const [key, value] of Object.entries(attrs || {})) host.setAttribute(key, value);
        window.__probe.append(host);
        return host.id;
      };

      window.__dp = () => {
        const host = document.getElementById('probe-date');
        const root = host.shadowRoot;
        return {
          host,
          root,
          control: root.querySelector('.mc-control'),
          panel: root.querySelector('.mc-panel'),
          grid: root.querySelector('.mc-grid'),
          title: root.querySelector('.mc-title'),
          value: root.querySelector('.mc-value'),
          days: [...root.querySelectorAll('.mc-day')],
        };
      };

      window.__point = (el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };

      window.__watch = () => {
        window.__events = [];
        const host = window.__dp().host;
        if (host.__watched) return;
        host.__watched = true;
        for (const type of ['change', 'clear', 'open', 'close']) {
          host.addEventListener(type, (event) => {
            window.__events.push({
              type,
              data: event.data ? JSON.parse(JSON.stringify(event.data)) : null,
            });
          });
        }
      };
    });

  const pointOf = (selector) =>
    page.evaluate((sel) => {
      const d = window.__dp();
      const el = sel === ':host' ? d.host : d.root.querySelector(sel);
      return el ? window.__point(el) : null;
    }, selector);

  const click = async (selector) => {
    const at = await pointOf(selector);
    if (!at) throw new Error('找不到可点的元素：' + selector);
    await page.mouse.click(at.x, at.y);
  };

  const isOpen = () => page.evaluate(() => window.__dp().panel.matches(':popover-open'));
  const waitOpen = (want) =>
    page
      .waitForFunction(
        (open) => window.__dp().panel.matches(':popover-open') === open,
        want,
        { timeout: 3000 },
      )
      .catch(() => {});
  const waitValue = (value) =>
    page
      .waitForFunction((want) => window.__dp().host.value === want, value, { timeout: 3000 })
      .catch(() => {});
  const activeDp = () =>
    page.evaluate(() => {
      const d = window.__dp();
      const day = d.days.find((item) => item.hasAttribute('data-active'));
      return {
        active: day?.dataset.date ?? null,
        title: d.title.textContent,
        month: d.days.filter((item) => !item.hasAttribute('data-outside')).length,
      };
    });

  await setupProbe();

  /* ------------------------------------------------------------------ *
   * 1. 初值 + 点击打开：原生 popover 进 top layer、锚点贴合、42 格、part 齐
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__make({ 'default-value': '2026-03-15' }));
  await page.waitForTimeout(200);
  const initial = await page.evaluate(() => {
    const d = window.__dp();
    return {
      value: d.host.value,
      text: d.value.textContent,
      filled: d.host.hasAttribute('data-filled'),
      empty: d.host.hasAttribute('data-empty'),
    };
  });
  check(
    'default-value 是初始值：property 读得到「2026-03-15」，显示同步、data-filled 亮起',
    initial.value === '2026-03-15' &&
      initial.text === '2026-03-15' &&
      initial.filled === true &&
      initial.empty === false,
    JSON.stringify(initial),
  );

  await click('.mc-control');
  await waitOpen(true);
  const opened = await page.evaluate(() => {
    const d = window.__dp();
    const c = d.control.getBoundingClientRect();
    const p = d.panel.getBoundingClientRect();
    return {
      open: d.panel.matches(':popover-open'),
      popover: d.panel.getAttribute('popover'),
      display: getComputedStyle(d.panel).display,
      title: d.title.textContent,
      days: d.days.length,
      inside: d.days.filter((item) => !item.hasAttribute('data-outside')).length,
      selected: d.days.find((item) => item.hasAttribute('data-selected'))?.dataset.date ?? null,
      parts: [...new Set(d.days.map((item) => item.getAttribute('part')))],
      basePart: d.control.getAttribute('part'),
      panelPart: d.panel.getAttribute('part'),
      headerPart: d.root.querySelector('.mc-header').getAttribute('part'),
      gridPart: d.grid.getAttribute('part'),
      weekdays: d.root.querySelectorAll('.mc-weekdays span').length,
      below: p.top >= c.bottom - 1,
      aligned: Math.abs(p.left - c.left) <= 1.5,
      wideEnough: p.width >= c.width - 1,
      hostOpen: d.host.hasAttribute('data-open'),
    };
  });
  check(
    '点触发框打开面板：原生 popover 进 top layer，锚点定位贴在触发框下方、不窄于触发框',
    opened.open === true &&
      opened.popover === 'manual' &&
      opened.display !== 'none' &&
      opened.below === true &&
      opened.aligned === true &&
      opened.wideEnough === true &&
      opened.hostOpen === true,
    JSON.stringify(opened),
  );
  check(
    '月历是 6 × 7 = 42 格（含相邻月份补位），标题 / 选中态 / 星期行都对',
    opened.days === 42 &&
      opened.inside === 31 &&
      opened.title === '2026 年 3 月' &&
      opened.selected === '2026-03-15' &&
      opened.weekdays === 7,
    JSON.stringify(opened),
  );
  check(
    'part 齐：base / panel / header / grid / day',
    opened.basePart === 'base' &&
      opened.panelPart === 'panel' &&
      opened.headerPart === 'header' &&
      opened.gridPart === 'grid' &&
      opened.parts.length === 1 &&
      opened.parts[0] === 'day',
    JSON.stringify(opened),
  );

  /* ------------------------------------------------------------------ *
   * 2. 点某一天：value property + 显示 + change payload + 收起
   * ------------------------------------------------------------------ */
  await page.keyboard.press('Escape');
  await waitOpen(false);
  await page.evaluate(() => window.__watch());
  await click('.mc-control');
  await waitOpen(true);
  await click('[data-date="2026-03-20"]');
  await waitValue('2026-03-20');
  await page.waitForFunction(() => window.__events.length >= 3, { timeout: 3000 }).catch(() => {});
  const picked = await page.evaluate(() => {
    const d = window.__dp();
    const control = d.root.querySelector('.mc-control');
    return {
      value: d.host.value,
      text: d.value.textContent,
      open: d.panel.matches(':popover-open'),
      filled: d.host.hasAttribute('data-filled'),
      focused: d.root.activeElement === control,
      events: window.__events.slice(),
    };
  });
  check(
    '点日期：value property 变成 2026-03-20、显示文案跟着走、change payload 是 { value }、面板收起并还焦点',
    picked.value === '2026-03-20' &&
      picked.text === '2026-03-20' &&
      picked.open === false &&
      picked.filled === true &&
      picked.focused === true &&
      JSON.stringify(picked.events) ===
        JSON.stringify([
          { type: 'open', data: null },
          { type: 'change', data: { value: '2026-03-20' } },
          { type: 'close', data: null },
        ]),
    JSON.stringify(picked),
  );

  /* ------------------------------------------------------------------ *
   * 3. 键盘：方向键逐日 / 逐周、PageUp / PageDown 换月、Home / End、Enter、Esc
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__make({ 'default-value': '2026-03-15' });
    window.__sel = window.__dp();
    window.__sel.control.focus();
  });
  await page.keyboard.press('ArrowDown');
  await waitOpen(true);
  const nav0 = await activeDp();
  await page.keyboard.press('ArrowRight');
  const nav1 = await activeDp();
  await page.keyboard.press('ArrowDown');
  const nav2 = await activeDp();
  await page.keyboard.press('PageDown');
  const nav3 = await activeDp();
  await page.keyboard.press('Home');
  const nav4 = await activeDp();
  await page.keyboard.press('End');
  const nav5 = await activeDp();
  await page.keyboard.press('PageUp');
  const nav6 = await activeDp();
  await page.keyboard.press('PageUp');
  await page.keyboard.press('Enter');
  await waitValue('2026-02-26');
  const committed = await page.evaluate(() => {
    const d = window.__dp();
    return {
      value: d.host.value,
      open: d.panel.matches(':popover-open'),
      focused: d.root.activeElement === d.control,
    };
  });
  check(
    '键盘：ArrowDown 打开，← / → 逐日、↑ / ↓ 逐周、PageDown / PageUp 换月、Home / End 到周首尾',
    nav0.active === '2026-03-15' &&
      nav1.active === '2026-03-16' &&
      nav2.active === '2026-03-23' &&
      nav3.active === '2026-04-23' &&
      nav4.active === '2026-04-20' &&
      nav5.active === '2026-04-26' &&
      nav6.active === '2026-03-26' &&
      committed.value === '2026-02-26' &&
      committed.open === false &&
      committed.focused === true,
    JSON.stringify({ nav0, nav1, nav2, nav3, nav4, nav5, nav6, committed }),
  );

  await page.evaluate(() => {
    window.__make({ 'default-value': '2026-03-15' });
    window.__dp().control.focus();
  });
  await page.keyboard.press('ArrowDown');
  await waitOpen(true);
  await page.keyboard.press('Escape');
  await waitOpen(false);
  const escaped = await page.evaluate(() => {
    const d = window.__dp();
    return {
      open: d.panel.matches(':popover-open'),
      openHook: d.host.hasAttribute('data-open'),
      focused: d.root.activeElement === d.control,
    };
  });
  check(
    'Esc 关闭面板并把焦点还给触发框（data-open 收回）',
    escaped.open === false && escaped.openHook === false && escaped.focused === true,
    JSON.stringify(escaped),
  );

  /* 点外部关闭（真指针） */
  await click('.mc-control');
  await waitOpen(true);
  const outsideHit = await page.evaluate(() => {
    const target = document.getElementById('date-outside');
    const at = window.__point(target);
    return { ...at, hit: document.elementFromPoint(at.x, at.y)?.id ?? null };
  });
  await page.mouse.click(outsideHit.x, outsideHit.y);
  await waitOpen(false);
  check(
    '点组件外部（真指针）关掉面板；判定走 composedPath（P20）',
    outsideHit.hit === 'date-outside' && (await isOpen()) === false,
    JSON.stringify(outsideHit),
  );

  /* ------------------------------------------------------------------ *
   * 4. min / max：范围外置灰、点不动、键盘 Enter 也不提交
   * ------------------------------------------------------------------ */
  await page.evaluate(() =>
    window.__make({ min: '2026-03-10', max: '2026-03-20', 'default-value': '2026-03-15' }),
  );
  await click('.mc-control');
  await waitOpen(true);
  const range = await page.evaluate(() => {
    const d = window.__dp();
    const day = (date) => d.days.find((item) => item.dataset.date === date);
    return {
      before: { hook: day('2026-03-09')?.getAttribute('data-disabled') },
      first: { hook: day('2026-03-10')?.getAttribute('data-disabled') },
      last: { hook: day('2026-03-20')?.getAttribute('data-disabled') },
      after: { hook: day('2026-03-21')?.getAttribute('data-disabled') },
    };
  });
  await click('[data-date="2026-03-09"]');
  await page.waitForTimeout(150);
  const blocked = await page.evaluate(() => {
    const d = window.__dp();
    return { value: d.host.value, open: d.panel.matches(':popover-open') };
  });
  await click('[data-date="2026-03-20"]');
  await waitValue('2026-03-20');
  check(
    'min / max 是闭区间：范围外置灰（data-disabled）、点了不改值也不关；范围内可选中',
    range.before.hook === 'true' &&
      range.first.hook === null &&
      range.last.hook === null &&
      range.after.hook === 'true' &&
      blocked.value === '2026-03-15' &&
      blocked.open === true &&
      (await page.evaluate(() => window.__dp().host.value)) === '2026-03-20',
    JSON.stringify({ range, blocked }),
  );

  /* ------------------------------------------------------------------ *
   * 5. 清除：value 清空 + clear / change 两个事件（clear 在前）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__make({ clearable: '', 'default-value': '2026-03-15' });
    window.__watch();
  });
  await click('.mc-clear');
  await waitValue('');
  await page.waitForFunction(() => window.__events.length >= 2, { timeout: 3000 }).catch(() => {});
  const cleared = await page.evaluate(() => {
    const d = window.__dp();
    return {
      value: d.host.value,
      text: d.value.textContent,
      empty: d.host.hasAttribute('data-empty'),
      events: window.__events.map((event) => event.type),
      changeData: window.__events.find((event) => event.type === 'change')?.data ?? null,
    };
  });
  check(
    'clearable：点 × 清空 value（发 clear + change），空值回到占位文案',
    cleared.value === '' &&
      cleared.text === '请选择日期' &&
      cleared.empty === true &&
      JSON.stringify(cleared.events) === JSON.stringify(['clear', 'change']) &&
      JSON.stringify(cleared.changeData) === JSON.stringify({ value: '' }),
    JSON.stringify(cleared),
  );

  /* ------------------------------------------------------------------ *
   * 6. disabled / readonly / invalid / size
   * ------------------------------------------------------------------ */
  const disabledState = await page.evaluate(async () => {
    window.__make({ disabled: '', invalid: '', 'default-value': '2026-03-15' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const d = window.__dp();
    const danger = getComputedStyle(document.documentElement)
      .getPropertyValue('--mc-color-danger')
      .trim()
      .split(/\s+/)
      .join(', ');
    const out = {
      controlDisabled: d.control.disabled,
      hostDisabled: d.host.hasAttribute('disabled'),
      hostInvalid: d.host.hasAttribute('invalid'),
      border: getComputedStyle(d.control).borderTopColor,
      danger: 'rgb(' + danger + ')',
    };
    d.control.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    out.open = d.panel.matches(':popover-open');
    return out;
  });
  check(
    'disabled：原生 button 真的 disabled、宿主属性在、点了不弹面板；invalid 只换边框色',
    disabledState.controlDisabled === true &&
      disabledState.hostDisabled === true &&
      disabledState.hostInvalid === true &&
      disabledState.border === disabledState.danger &&
      disabledState.open === false,
    JSON.stringify(disabledState),
  );

  const readonlyState = await page.evaluate(async () => {
    window.__make({ readonly: '', 'default-value': '2026-03-15' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const d = window.__dp();
    d.control.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      readonly: d.host.hasAttribute('readonly'),
      open: d.panel.matches(':popover-open'),
    };
  });
  check(
    'readonly：宿主属性在、可以聚焦，但面板不打开',
    readonlyState.readonly === true && readonlyState.open === false,
    JSON.stringify(readonlyState),
  );

  const sizes = await page.evaluate(async () => {
    const read = async (size) => {
      window.__make(size ? { size } : {});
      await new Promise((resolve) => setTimeout(resolve, 120));
      return Math.round(window.__dp().control.getBoundingClientRect().height);
    };
    return { sm: await read('sm'), md: await read('md'), lg: await read('lg') };
  });
  check(
    'size 三档只动控件高度（sm 28 / md 36 / lg 44）',
    sizes.sm === 28 && sizes.md === 36 && sizes.lg === 44,
    JSON.stringify(sizes),
  );

  /* ------------------------------------------------------------------ *
   * 7. ::part(base / panel / header / grid / day) 定制生效
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__make({ 'default-value': '2026-03-15' });
    const style = document.createElement('style');
    style.id = 'date-part-style';
    style.textContent = [
      '#date-probe mc-date-picker::part(base) { border-radius: 0px; }',
      '#date-probe mc-date-picker::part(panel) { border-radius: 0px; }',
      '#date-probe mc-date-picker::part(header) { background-color: rgb(1, 2, 3); }',
      '#date-probe mc-date-picker::part(grid) { gap: 0px; }',
      '#date-probe mc-date-picker::part(day) { text-decoration: underline; }',
      '#date-probe mc-date-picker::part(cell) { font-style: italic; }',
    ].join('\n');
    document.head.append(style);
  });
  await click('.mc-control');
  await waitOpen(true);
  const parts = await page.evaluate(() => {
    const d = window.__dp();
    const plain = d.days.find(
      (item) => !item.hasAttribute('data-selected') && !item.hasAttribute('data-outside'),
    );
    return {
      base: getComputedStyle(d.control).borderTopLeftRadius,
      panel: getComputedStyle(d.panel).borderTopLeftRadius,
      header: getComputedStyle(d.root.querySelector('.mc-header')).backgroundColor,
      grid: getComputedStyle(d.grid).columnGap,
      day: getComputedStyle(plain).textDecorationLine,
    };
  });
  check(
    '::part(base / panel / header / grid / day) 都能从外面改（自定义点真的通）',
    parts.base === '0px' &&
      parts.panel === '0px' &&
      parts.header === 'rgb(1, 2, 3)' &&
      parts.grid === '0px' &&
      parts.day.includes('underline'),
    JSON.stringify(parts),
  );

  const cellPart = await page.evaluate(async () => {
    window.__make({ type: 'month', 'default-value': '2026-10' });
    await new Promise((resolve) => setTimeout(resolve, 180));
    const d = window.__dp();
    d.control.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const cell = d.root.querySelector('.mc-cell');
    return cell ? getComputedStyle(cell).fontStyle : null;
  });
  check('::part(cell) 能改月 / 年网格（自定义点真的通）', cellPart === 'italic', String(cellPart));

  /* ------------------------------------------------------------------ *
   * 8. 绑定通道：value 属性 ↔ 选中值；property 写值会回写成属性
   * ------------------------------------------------------------------ */
  const binding = await page.evaluate(async () => {
    const el = document.createElement('mc-date-picker');
    el.setAttribute('default-value', '2026-01-02');
    document.body.append(el);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const initial = el.value;
    el.setAttribute('value', '2026-02-03');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const byAttr = el.value;
    el.value = '2026-05-06';
    const afterWrite = { value: el.value, attr: el.getAttribute('value') };
    el.value = '2026-02-30';
    const invalid = { value: el.value, attr: el.getAttribute('value') };
    el.remove();
    return { initial, byAttr, afterWrite, invalid };
  });
  check(
    '绑定通道：default-value 是初值；写 value 属性会重选；改 property 会回写属性；非法日期当空',
    binding.initial === '2026-01-02' &&
      binding.byAttr === '2026-02-03' &&
      binding.afterWrite.value === '2026-05-06' &&
      binding.afterWrite.attr === '2026-05-06' &&
      binding.invalid.value === '' &&
      binding.invalid.attr === '',
    JSON.stringify(binding),
  );

  /* ------------------------------------------------------------------ *
   * 9. 宽度固定：占位 / 值 / clearable / 长格式化文本都不能把宿主撑大缩小
   * ------------------------------------------------------------------ */
  const widths = await page.evaluate(async () => {
    const inner = () => window.__dp().control.getBoundingClientRect().width;
    window.__make({ placeholder: '选择日期' });
    await new Promise((resolve) => setTimeout(resolve, 180));
    const placeholder = inner();
    const host = window.__dp().host;
    host.value = '2026-10-19';
    await new Promise((resolve) => setTimeout(resolve, 120));
    const withValue = inner();
    host.value = '';
    await new Promise((resolve) => setTimeout(resolve, 120));
    const cleared = inner();
    window.__make({
      clearable: '',
      format: 'YYYY 年 M 月 D 日',
      'default-value': '2026-10-19',
    });
    await new Promise((resolve) => setTimeout(resolve, 180));
    const longValue = inner();
    window.__dp().host.style.width = '320px';
    const override = inner();
    return { placeholder, withValue, cleared, longValue, override };
  });
  check(
    '宽度固定：占位 / 有值 / 清空 / clearable + 长格式化文本都不让宿主变宽或变窄；宿主 style="width:…" 可覆盖',
    Math.round(widths.placeholder) === Math.round(widths.withValue) &&
      Math.round(widths.placeholder) === Math.round(widths.cleared) &&
      Math.round(widths.placeholder) === Math.round(widths.longValue) &&
      Math.round(widths.override) === 320,
    JSON.stringify(widths),
  );

  /* 溢出提示：多选 / 长格式化文本被固定宽度裁掉时，hover 弹完整文案；面板打开时收起 */
  const overflowState = await page.evaluate(async () => {
    window.__make({
      multiple: '',
      format: 'YYYY 年 M 月 D 日',
      'default-value': '2026-03-10,2026-03-15,2026-03-20',
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const d = window.__dp();
    const value = d.root.querySelector('.mc-value');
    const box = d.host.getBoundingClientRect();
    return {
      flagged: d.host.hasAttribute('data-overflow'),
      clipped: value.scrollWidth > value.clientWidth + 1,
      text: value.textContent,
      at: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    };
  });
  await page.mouse.move(400, 700);
  await page.waitForTimeout(80);
  await page.mouse.move(overflowState.at.x, overflowState.at.y);
  await page.waitForTimeout(220);
  const tip = await page.evaluate(() => {
    const d = window.__dp();
    const el = d.root.querySelector('.mc-overflow-tip');
    return { exists: !!el, text: el?.textContent ?? null, open: el ? el.matches(':popover-open') : false };
  });
  await click('.mc-control');
  await waitOpen(true);
  const tipWhileOpen = await page.evaluate(() => {
    const d = window.__dp();
    const el = d.root.querySelector('.mc-overflow-tip');
    return { open: el ? el.matches(':popover-open') : false, flagged: d.host.hasAttribute('data-overflow') };
  });
  await page.keyboard.press('Escape');
  await waitOpen(false);
  await page.mouse.move(400, 700);
  check(
    '溢出提示：多选长文本把 .mc-value 裁掉时 data-overflow 亮起，hover 弹完整文案，面板打开时收起',
    overflowState.flagged === true &&
      overflowState.clipped === true &&
      tip.exists === true &&
      tip.open === true &&
      tip.text === overflowState.text &&
      tipWhileOpen.open === false &&
      tipWhileOpen.flagged === true,
    JSON.stringify({ overflowState, tip, tipWhileOpen }),
  );

  /* ------------------------------------------------------------------ *
   * 10. 三段格式化：进 input-format / 中 format / 出 output-format
   * ------------------------------------------------------------------ */
  const formatted = await page.evaluate(async () => {
    window.__make({
      'input-format': 'DD/MM/YYYY',
      format: 'YYYY 年 M 月 D 日',
      'output-format': 'YYYYMMDD',
      'default-value': '19/10/2026',
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const d = window.__dp();
    const initial = {
      value: d.host.value,
      text: d.value.textContent,
      attr: d.host.getAttribute('value'),
    };
    window.__watch();
    d.control.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { initial, open: d.panel.matches(':popover-open'), title: d.title.textContent };
  });
  check(
    '三段格式化：进（DD/MM/YYYY 解析初值）、中（YYYY 年 M 月 D 日 显示）、出（YYYYMMDD 读取 / 回写属性）各走各的',
    formatted.initial.value === '20261019' &&
      formatted.initial.text === '2026 年 10 月 19 日' &&
      formatted.initial.attr === '20261019' &&
      formatted.open === true &&
      formatted.title === '2026 年 10 月',
    JSON.stringify(formatted),
  );

  await click('[data-date="2026-10-20"]');
  await waitValue('20261020');
  const pickedFormatted = await page.evaluate(() => {
    const d = window.__dp();
    return {
      value: d.host.value,
      text: d.value.textContent,
      attr: d.host.getAttribute('value'),
      change: window.__events.find((event) => event.type === 'change')?.data ?? null,
      open: d.panel.matches(':popover-open'),
    };
  });
  const externalFormatted = await page.evaluate(async () => {
    const d = window.__dp();
    d.host.setAttribute('value', '21/10/2026');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const input = { value: d.host.value, text: d.value.textContent };
    d.host.setAttribute('value', '20261022');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const output = { value: d.host.value, text: d.value.textContent };
    return { input, output };
  });
  check(
    '选一天后 change / 回写属性都是 output-format；外部再按 input-format 写入能解析，output-format 也能回读',
    pickedFormatted.value === '20261020' &&
      pickedFormatted.text === '2026 年 10 月 20 日' &&
      pickedFormatted.attr === '20261020' &&
      JSON.stringify(pickedFormatted.change) === JSON.stringify({ value: '20261020' }) &&
      pickedFormatted.open === false &&
      externalFormatted.input.value === '20261021' &&
      externalFormatted.input.text === '2026 年 10 月 21 日' &&
      externalFormatted.output.value === '20261022' &&
      externalFormatted.output.text === '2026 年 10 月 22 日',
    JSON.stringify({ pickedFormatted, externalFormatted }),
  );

  const rangeFormatted = await page.evaluate(async () => {
    window.__make({
      'input-format': 'DD/MM/YYYY',
      min: '05/10/2026',
      max: '25/10/2026',
      'default-value': '15/10/2026',
    });
    await new Promise((resolve) => setTimeout(resolve, 180));
    window.__dp().control.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const d = window.__dp();
    const day = (date) => d.days.find((item) => item.dataset.date === date);
    return {
      value: d.host.value,
      before: day('2026-10-04')?.getAttribute('data-disabled'),
      first: day('2026-10-05')?.getAttribute('data-disabled'),
      last: day('2026-10-25')?.getAttribute('data-disabled'),
      after: day('2026-10-26')?.getAttribute('data-disabled'),
    };
  });
  check(
    'min / max 也按 input-format 解析（05/10/2026 ~ 25/10/2026 两端可选的闭区间）',
    rangeFormatted.value === '2026-10-15' &&
      rangeFormatted.before === 'true' &&
      rangeFormatted.first === null &&
      rangeFormatted.last === null &&
      rangeFormatted.after === 'true',
    JSON.stringify(rangeFormatted),
  );

  /* ------------------------------------------------------------------ *
   * 11. 类型（周 / 月 / 年）、多选、范围
   * ------------------------------------------------------------------ */
  const types = await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms || 180));
    const out = {};
    window.__make({ type: 'week', 'default-value': '2026-W43' });
    await pause();
    let d = window.__dp();
    out.week = { value: d.host.value, text: d.value.textContent };
    d.control.click();
    await pause();
    out.week.open = d.panel.matches(':popover-open');
    out.week.title = d.title.textContent;
    out.week.selected = d.root.querySelectorAll('.mc-day[data-selected]').length;
    out.week.week = d.root.querySelector('.mc-day[data-selected]')?.dataset.week ?? null;
    out.week.weekdaysHidden = d.root.querySelector('.mc-weekdays').hidden;
    d.root.querySelector('.mc-day[data-date="2026-10-27"]')?.click();
    await pause(220);
    out.week.picked = {
      value: d.host.value,
      text: d.value.textContent,
      open: d.panel.matches(':popover-open'),
    };

    window.__make({ type: 'month', 'default-value': '2026-03' });
    await pause();
    d = window.__dp();
    out.month = { value: d.host.value, text: d.value.textContent };
    d.control.click();
    await pause();
    out.month.open = d.panel.matches(':popover-open');
    out.month.title = d.title.textContent;
    out.month.cells = d.root.querySelectorAll('.mc-cell').length;
    out.month.selected = d.root.querySelector('.mc-cell[data-selected]')?.dataset.value ?? null;
    out.month.weekdaysHidden = d.root.querySelector('.mc-weekdays').hidden;
    d.root.querySelector('.mc-cell[data-value="2026-07"]')?.click();
    await pause(220);
    out.month.picked = { value: d.host.value, text: d.value.textContent };

    window.__make({ type: 'year', 'default-value': '2026' });
    await pause();
    d = window.__dp();
    out.year = { value: d.host.value, text: d.value.textContent };
    d.control.click();
    await pause();
    out.year.open = d.panel.matches(':popover-open');
    out.year.title = d.title.textContent;
    out.year.cells = d.root.querySelectorAll('.mc-cell').length;
    out.year.selected = d.root.querySelector('.mc-cell[data-selected]')?.dataset.value ?? null;
    out.year.weekdaysHidden = d.root.querySelector('.mc-weekdays').hidden;
    d.root.querySelector('.mc-cell[data-value="2028"]')?.click();
    await pause(220);
    out.year.picked = { value: d.host.value, text: d.value.textContent };
    return out;
  });
  check(
    '类型单选：week 值 / 显示为 2026-W43，点一天选中整周；month / year 各自 12 格并按类型回写值',
    types.week.value === '2026-W43' &&
      types.week.text === '2026-W43' &&
      types.week.open === true &&
      types.week.title === '2026 年 10 月' &&
      types.week.selected === 7 &&
      types.week.week === '2026-W43' &&
      types.week.weekdaysHidden === false &&
      types.week.picked.value === '2026-W44' &&
      types.week.picked.open === false &&
      types.month.value === '2026-03' &&
      types.month.text === '2026-03' &&
      types.month.open === true &&
      types.month.title === '2026 年' &&
      types.month.cells === 12 &&
      types.month.selected === '2026-03' &&
      types.month.weekdaysHidden === true &&
      types.month.picked.value === '2026-07' &&
      types.year.value === '2026' &&
      types.year.text === '2026' &&
      types.year.open === true &&
      types.year.title === '2020 – 2031 年' &&
      types.year.cells === 12 &&
      types.year.selected === '2026' &&
      types.year.weekdaysHidden === true &&
      types.year.picked.value === '2028',
    JSON.stringify(types),
  );

  const multiple = await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms || 180));
    const out = {};
    window.__make({ multiple: '', 'default-value': '2026-03-10,2026-03-12' });
    await pause();
    let d = window.__dp();
    out.day = { value: d.host.value, text: d.value.textContent };
    d.control.click();
    await pause();
    d.root.querySelector('.mc-day[data-date="2026-03-11"]')?.click();
    await pause(120);
    out.day.added = {
      value: d.host.value,
      attr: d.host.getAttribute('value'),
      open: d.panel.matches(':popover-open'),
    };
    d.root.querySelector('.mc-day[data-date="2026-03-10"]')?.click();
    await pause(120);
    out.day.removed = { value: d.host.value, open: d.panel.matches(':popover-open') };

    window.__make({ type: 'month', multiple: '', 'default-value': '2026-01,2026-03' });
    await pause();
    d = window.__dp();
    d.control.click();
    await pause();
    d.root.querySelector('.mc-cell[data-value="2026-02"]')?.click();
    await pause(120);
    out.month = { value: d.host.value, open: d.panel.matches(':popover-open') };

    window.__make({ type: 'week', multiple: '', 'default-value': '2026-W43,2026-W45' });
    await pause();
    d = window.__dp();
    d.control.click();
    await pause();
    d.root.querySelector('.mc-day[data-date="2026-10-27"]')?.click();
    await pause(120);
    out.week = { value: d.host.value, open: d.panel.matches(':popover-open') };
    return out;
  });
  check(
    '多选：day / month / week 三种类型都能增删，面板不收起，value 是 string[]、属性是逗号串',
    JSON.stringify(multiple.day.value) === JSON.stringify(['2026-03-10', '2026-03-12']) &&
      multiple.day.text === '2026-03-10, 2026-03-12' &&
      JSON.stringify(multiple.day.added.value) ===
        JSON.stringify(['2026-03-10', '2026-03-12', '2026-03-11']) &&
      multiple.day.added.attr === '2026-03-10,2026-03-12,2026-03-11' &&
      multiple.day.added.open === true &&
      JSON.stringify(multiple.day.removed.value) ===
        JSON.stringify(['2026-03-12', '2026-03-11']) &&
      multiple.day.removed.open === true &&
      JSON.stringify(multiple.month.value) ===
        JSON.stringify(['2026-01', '2026-03', '2026-02']) &&
      multiple.month.open === true &&
      JSON.stringify(multiple.week.value) ===
        JSON.stringify(['2026-W43', '2026-W45', '2026-W44']) &&
      multiple.week.open === true,
    JSON.stringify(multiple),
  );

  const rangeModes = await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms || 180));
    const cellValues = (root, selector) =>
      [...root.querySelectorAll(selector)].map((cell) => cell.dataset.value || cell.dataset.key);
    const out = {};

    window.__make({ range: '' });
    await pause();
    let d = window.__dp();
    d.control.click();
    await pause();
    d.root.querySelector('.mc-day[data-date="2026-10-10"]')?.click();
    await pause(120);
    out.day = { first: { value: d.host.value, text: d.value.textContent, open: d.panel.matches(':popover-open') } };
    d.root.querySelector('.mc-day[data-date="2026-10-15"]')?.click();
    await pause(220);
    out.day.second = {
      value: d.host.value,
      text: d.value.textContent,
      attr: d.host.getAttribute('value'),
      open: d.panel.matches(':popover-open'),
    };
    d.control.click();
    await pause();
    out.day.reopened = {
      open: d.panel.matches(':popover-open'),
      inRange: d.root.querySelectorAll('.mc-day[data-in-range]').length,
      selected: [...d.root.querySelectorAll('.mc-day[data-selected]')].map(
        (cell) => cell.dataset.date,
      ),
    };

    window.__make({ type: 'month', range: '', 'default-value': '2026-02,2026-05' });
    await pause();
    d = window.__dp();
    d.control.click();
    await pause();
    out.month = {
      value: d.host.value,
      title: d.title.textContent,
      selected: cellValues(d.root, '.mc-cell[data-selected]'),
      inRange: cellValues(d.root, '.mc-cell[data-in-range]'),
    };

    window.__make({ type: 'year', range: '', 'default-value': '2024,2026' });
    await pause();
    d = window.__dp();
    d.control.click();
    await pause();
    out.year = {
      value: d.host.value,
      title: d.title.textContent,
      selected: cellValues(d.root, '.mc-cell[data-selected]'),
      inRange: cellValues(d.root, '.mc-cell[data-in-range]'),
    };

    window.__make({ type: 'week', range: '', 'default-value': '2026-W43,2026-W45' });
    await pause();
    d = window.__dp();
    d.control.click();
    await pause();
    const weekCells = [...d.root.querySelectorAll('.mc-day')];
    out.week = {
      value: d.host.value,
      title: d.title.textContent,
      selectedWeeks: [...new Set(d.root.querySelectorAll('.mc-day[data-selected]').length ? [...d.root.querySelectorAll('.mc-day[data-selected]')].map((cell) => cell.dataset.week) : [])],
      inRange: weekCells.filter((cell) => cell.hasAttribute('data-in-range')).length,
    };
    return out;
  });
  check(
    '范围：day 两次点击后 value 是 [起, 止]、中间 data-in-range；month / year / week 的范围渲染与端点都对',
    JSON.stringify(rangeModes.day.first.value) === JSON.stringify(['2026-10-10']) &&
      rangeModes.day.first.text === '2026-10-10 ~ …' &&
      rangeModes.day.first.open === true &&
      JSON.stringify(rangeModes.day.second.value) ===
        JSON.stringify(['2026-10-10', '2026-10-15']) &&
      rangeModes.day.second.text === '2026-10-10 ~ 2026-10-15' &&
      rangeModes.day.second.attr === '2026-10-10,2026-10-15' &&
      rangeModes.day.second.open === false &&
      rangeModes.day.reopened.open === true &&
      rangeModes.day.reopened.inRange === 4 &&
      JSON.stringify(rangeModes.day.reopened.selected) ===
        JSON.stringify(['2026-10-10', '2026-10-15']) &&
      JSON.stringify(rangeModes.month.value) === JSON.stringify(['2026-02', '2026-05']) &&
      rangeModes.month.title === '2026 年' &&
      JSON.stringify(rangeModes.month.selected) === JSON.stringify(['2026-02', '2026-05']) &&
      JSON.stringify(rangeModes.month.inRange) === JSON.stringify(['2026-03', '2026-04']) &&
      JSON.stringify(rangeModes.year.value) === JSON.stringify(['2024', '2026']) &&
      JSON.stringify(rangeModes.year.selected) === JSON.stringify(['2024', '2026']) &&
      JSON.stringify(rangeModes.year.inRange) === JSON.stringify(['2025']) &&
      JSON.stringify(rangeModes.week.value) === JSON.stringify(['2026-W43', '2026-W45']) &&
      JSON.stringify(rangeModes.week.selectedWeeks) ===
        JSON.stringify(['2026-W43', '2026-W45']) &&
      rangeModes.week.inRange === 7,
    JSON.stringify(rangeModes),
  );

  /* 收尾：拆探针 */
  await page.evaluate(() => {
    document.getElementById('date-probe')?.remove();
    document.getElementById('date-outside')?.remove();
    document.getElementById('date-part-style')?.remove();
  });

  /* ------------------------------------------------------------------ *
   * 12. 文档页：演示渲染出来了，点一下真的会弹
   * ------------------------------------------------------------------ */
  await visit(page, '/index.html?date-picker-page=' + Date.now() + '#/packages/date-picker/page.html');
  await page
    .waitForFunction(
      () =>
        !!window.__deep('demo-date-picker-basic')?.shadowRoot &&
        !!window.__deep('demo-date-picker-format')?.shadowRoot &&
        !!window.__deep('demo-date-picker-types')?.shadowRoot &&
        !!window.__deep('demo-date-picker-range-mode')?.shadowRoot,
      { timeout: 10000 },
    )
    .catch(() => {});
  const docPage = await page.evaluate(async () => {
    const demo = window.__deep('demo-date-picker-basic');
    const picker = demo?.shadowRoot?.querySelector('mc-date-picker');
    const control = picker?.shadowRoot?.querySelector('.mc-control');
    const formatDemo = window.__deep('demo-date-picker-format');
    const formatPicker = formatDemo?.shadowRoot?.querySelector('mc-date-picker');
    const formatControl = formatPicker?.shadowRoot?.querySelector('.mc-control');
    const heading = window.__deep('.doc-body h1')?.textContent?.trim() ?? null;
    const points = window.__deepAll('.doc-demo').length;
    control?.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const opened = picker?.shadowRoot?.querySelector('.mc-panel')?.matches(':popover-open') ?? false;
    formatControl?.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      heading,
      points,
      value: picker?.value ?? null,
      opened,
      formatValue: formatPicker?.value ?? null,
      formatText: formatPicker?.shadowRoot?.querySelector('.mc-value')?.textContent ?? null,
      formatOpened:
        formatPicker?.shadowRoot?.querySelector('.mc-panel')?.matches(':popover-open') ?? false,
    };
  });
  check(
    '文档页：标题 / 13 个演示段都在，基本与格式化演示点一下都能弹出面板',
    /^Date Picker/.test(docPage.heading ?? '') &&
      docPage.points >= 13 &&
      docPage.value === '2026-10-19' &&
      docPage.opened === true &&
      docPage.formatValue === '20261019' &&
      docPage.formatText === '2026 年 10 月 19 日' &&
      docPage.formatOpened === true,
    JSON.stringify(docPage),
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);
}
