/**
 * mc-select / mc-option · 下拉选择：浮层（原生 popover + CSS 锚点定位）、值读写、键盘导航、
 * 多选、清除、禁用、part 定制。
 *
 * 跑法：node tests/smoke.mjs select（需先 pnpm dev）
 *
 * ⚠️ 这份套件盯的都是「静默失效」型问题 —— 面板照样渲染、只是点了没用 / 关不掉 / 值不跟着走：
 *   · 点击外部判定必须用 composedPath（P20），contains(e.target) 必然误判
 *   · 值必须走宿主 DOM property（P18）：事件里 e.target.value 能读到
 *   · 浮层用 popover="manual" 自己管开合：auto 的 light dismiss 会在 pointerdown 上先关、
 *     click 再开回来（「点第二次关不掉」），所以这条只有**真指针**验得出来
 *   · 面板必须真的开出 top layer（:popover-open），不是靠 display 假装
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?select=1#/packages/select/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-select'), { timeout: 8000 })
    .catch(() => {});
  check(
    'mc-select 注册成功（页面模块的 <l-m> 生效）',
    await page.evaluate(() => !!customElements.get('mc-select')),
    'customElements.get("mc-select") 为 false',
  );

  /* 深链 + 刷新也注册得到（P44：深链打开时首页不一定渲染过，靠本页自己的 <l-m>） */
  await page.reload({ waitUntil: 'load' });
  await page
    .waitForFunction(
      () => !!customElements.get('mc-select') && !!customElements.get('mc-option'),
      { timeout: 8000 },
    )
    .catch(() => {});
  const afterReload = await page.evaluate(() => ({
    select: !!customElements.get('mc-select'),
    option: !!customElements.get('mc-option'),
  }));
  check(
    '深链 + 刷新后 mc-select / mc-option 仍然注册成功（P44）',
    afterReload.select === true && afterReload.option === true,
    JSON.stringify(afterReload),
  );

  /* ------------------------------------------------------------------ *
   * 现搭现拆的探针：固定定位在视口左上，避开站点外壳；量完最后一个 evaluate 删掉
   * ------------------------------------------------------------------ */
  const setupProbe = () =>
    page.evaluate(() => {
      document.getElementById('select-probe')?.remove();
      document.getElementById('select-outside')?.remove();
      const probe = document.createElement('div');
      probe.id = 'select-probe';
      probe.style.cssText = 'position: fixed; left: 16px; top: 60px; z-index: 9999;';
      const outside = document.createElement('div');
      outside.id = 'select-outside';
      outside.style.cssText =
        'position: fixed; left: 16px; top: 420px; width: 80px; height: 40px; z-index: 9999;' +
        'background-color: rgb(0 0 0 / 0.04);';
      document.body.append(probe, outside);
      window.__probe = probe;

      /** 建一个探针 select（先删旧的，坐标才不重叠） */
      window.__make = (attrs = {}, html = '') => {
        document.getElementById('probe-select')?.remove();
        const host = document.createElement('mc-select');
        host.id = 'probe-select';
        for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
        host.innerHTML = html;
        window.__probe.append(host);
        return host.id;
      };

      /** 探针内部的句柄（宿主 / shadow 内的关键节点） */
      window.__sel = () => {
        const host = document.getElementById('probe-select');
        const root = host.shadowRoot;
        return {
          host,
          root,
          control: root.querySelector('.mc-control'),
          panel: root.querySelector('.mc-panel'),
          list: root.querySelector('.mc-list'),
          rows: [...root.querySelectorAll('.mc-option')],
        };
      };

      /** 某个元素中心点的视口坐标（真指针点击用） */
      window.__point = (el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };

      /** 事件采集：change / clear / open / close 的 payload 都记下来 */
      window.__watch = () => {
        window.__events = [];
        const { host } = window.__sel();
        /* 监听只挂一次（同一个宿主上重复调用 __watch 是为了重置缓冲，不是再挂一遍） */
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

  const point = (selector) =>
    page.evaluate((sel) => {
      const { host, root } = window.__sel();
      const scope = sel === ':host' ? host : root.querySelector(sel);
      return window.__point(scope);
    }, selector);

  const click = async (selector) => {
    const at = await point(selector);
    await page.mouse.click(at.x, at.y);
  };

  const isOpen = () => page.evaluate(() => window.__sel().panel.matches(':popover-open'));
  const waitOpen = (want) =>
    page
      .waitForFunction(
        (open) => window.__sel().panel.matches(':popover-open') === open,
        want,
        { timeout: 3000 },
      )
      .catch(() => {});

  await setupProbe();

  /* ------------------------------------------------------------------ *
   * 1. 点击打开：原生 popover 进 top layer + 锚点定位贴合触发框
   * ------------------------------------------------------------------ */
  await page.evaluate(() =>
    window.__make(
      {},
      `<mc-option value="bj">北京</mc-option>
       <mc-option value="sh">上海</mc-option>
       <mc-option value="gz">广州</mc-option>
       <mc-option value="sz" disabled>深圳（禁用）</mc-option>`,
    ),
  );
  await click('.mc-control');
  await waitOpen(true);
  const opened = await page.evaluate(() => {
    const s = window.__sel();
    const c = s.control.getBoundingClientRect();
    const p = s.panel.getBoundingClientRect();
    return {
      open: s.panel.matches(':popover-open'),
      popover: s.panel.getAttribute('popover'),
      rows: s.rows.length,
      parts: s.rows.map((row) => row.getAttribute('part')),
      basePart: s.control.getAttribute('part'),
      hasPart: s.panel.getAttribute('part'),
      below: p.top >= c.bottom - 1,
      aligned: Math.abs(p.left - c.left) <= 1.5,
      /* 面板最小宽度跟着触发框（anchor-size），内容更长时才会更宽 */
      wideEnough: p.width >= c.width - 1,
      expanded: s.control.getAttribute('aria-expanded'),
      display: getComputedStyle(s.panel).display,
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
      opened.expanded === 'true',
    JSON.stringify(opened),
  );
  check(
    '选项由组件渲染（一行一个 part="option"），触发框是 part="base"、面板是 part="panel"',
    opened.rows === 4 &&
      opened.parts.every((name) => name === 'option') &&
      opened.basePart === 'base' &&
      opened.hasPart === 'panel',
    JSON.stringify(opened),
  );

  /* ------------------------------------------------------------------ *
   * 2. 点选项：value property 变化 + change payload { value } + 单选收起
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__sel().control.focus());
  await page.keyboard.press('Escape'); /* 先关掉，下面这次开合才录得到 open */
  await waitOpen(false);
  await page.evaluate(() => window.__watch());
  await click('.mc-control');
  await waitOpen(true);
  await click('.mc-option:nth-of-type(2)');
  await page.waitForFunction(() => document.getElementById('probe-select').value === 'sh', {
    timeout: 3000,
  }).catch(() => {});
  /* close 事件由原生 toggle 转发，是**排队**发的：等它到齐再断言 */
  await page.waitForFunction(() => window.__events.length >= 3, { timeout: 3000 }).catch(() => {});
  const picked = await page.evaluate(() => {
    const s = window.__sel();
    return {
      value: s.host.value,
      text: s.root.querySelector('.mc-value').textContent,
      open: s.panel.matches(':popover-open'),
      events: window.__events.slice(),
    };
  });
  check(
    '点选项：value property 变成选项值、显示文案跟着走、change payload 就是 { value }、面板收起',
    picked.value === 'sh' &&
      picked.text === '上海' &&
      picked.open === false &&
      JSON.stringify(picked.events) ===
        JSON.stringify([
          { type: 'open', data: null },
          { type: 'change', data: { value: 'sh' } },
          { type: 'close', data: null },
        ]),
    JSON.stringify(picked),
  );

  /* ------------------------------------------------------------------ *
   * 3. 键盘：ArrowDown 打开、ArrowUp / ArrowDown 移高亮、Enter 选中、Esc 关闭并还焦点
   * ------------------------------------------------------------------ */
  await page.evaluate(() =>
    window.__make(
      {},
      `<mc-option value="bj">北京</mc-option>
       <mc-option value="sh">上海</mc-option>
       <mc-option value="gz">广州</mc-option>
       <mc-option value="sz" disabled>深圳（禁用）</mc-option>`,
    ),
  );
  await page.evaluate(() => {
    window.__sel().control.focus();
    window.__watch();
  });
  await page.keyboard.press('ArrowDown');
  await waitOpen(true);
  const navFirst = await page.evaluate(() => {
    const s = window.__sel();
    return {
      open: s.panel.matches(':popover-open'),
      active: s.rows.map((row) => row.hasAttribute('data-active')),
      activeId: s.control.getAttribute('aria-activedescendant'),
      firstId: s.rows[0].id,
    };
  });
  await page.keyboard.press('ArrowDown');
  const nav = await page.evaluate(() => {
    const s = window.__sel();
    return {
      active: s.rows.map((row) => row.hasAttribute('data-active')),
      activeId: s.control.getAttribute('aria-activedescendant'),
      secondId: s.rows[1].id,
    };
  });
  await page.keyboard.press('ArrowUp');
  const navBack = await page.evaluate(() => {
    const s = window.__sel();
    return {
      active: s.rows.map((row) => row.hasAttribute('data-active')),
      activeId: s.control.getAttribute('aria-activedescendant'),
      firstId: s.rows[0].id,
    };
  });
  await page.keyboard.press('End');
  const navEnd = await page.evaluate(() => {
    const s = window.__sel();
    return { active: s.rows.map((row) => row.hasAttribute('data-active')) };
  });
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('probe-select').value === 'bj', {
    timeout: 3000,
  }).catch(() => {});
  const committed = await page.evaluate(() => {
    const s = window.__sel();
    return { value: s.host.value, open: s.panel.matches(':popover-open') };
  });
  check(
    '键盘：ArrowDown 打开并移动高亮（aria-activedescendant 跟着走）、ArrowUp / Home / End、Enter 选中',
    navFirst.open === true &&
      JSON.stringify(navFirst.active) === JSON.stringify([true, false, false, false]) &&
      navFirst.activeId === navFirst.firstId &&
      JSON.stringify(nav.active) === JSON.stringify([false, true, false, false]) &&
      nav.activeId === nav.secondId &&
      JSON.stringify(navBack.active) === JSON.stringify([true, false, false, false]) &&
      navBack.activeId === navBack.firstId &&
      /* End 落在最后一个**可用**项上（禁用项不算，所以是第 3 项） */
      JSON.stringify(navEnd.active) === JSON.stringify([false, false, true, false]) &&
      committed.value === 'bj' &&
      committed.open === false,
    JSON.stringify({ navFirst, nav, navBack, navEnd, committed }),
  );

  await page.evaluate(() => window.__sel().control.focus());
  await page.keyboard.press('ArrowDown');
  await waitOpen(true);
  await page.keyboard.press('Escape');
  await waitOpen(false);
  const escaped = await page.evaluate(() => {
    const s = window.__sel();
    return {
      open: s.panel.matches(':popover-open'),
      focused: s.root.activeElement?.className ?? null,
      expanded: s.control.getAttribute('aria-expanded'),
    };
  });
  check(
    'Esc 关闭面板并把焦点还给触发框（aria-expanded 收回 false）',
    escaped.open === false &&
      escaped.focused === 'mc-control' &&
      escaped.expanded === 'false',
    JSON.stringify(escaped),
  );

  /* ------------------------------------------------------------------ *
   * 4. 点外部关闭：必须走 composedPath（P20）
   * ------------------------------------------------------------------ */
  await click('.mc-control');
  await waitOpen(true);
  const outsideHit = await page.evaluate(() => {
    const target = document.getElementById('select-outside');
    const at = window.__point(target);
    return { ...at, hit: document.elementFromPoint(at.x, at.y)?.id ?? null };
  });
  await page.mouse.click(outsideHit.x, outsideHit.y);
  await waitOpen(false);
  const dismissed = await page.evaluate(() => ({
    open: window.__sel().panel.matches(':popover-open'),
    focused: window.__sel().root.activeElement?.className ?? null,
  }));
  check(
    '点组件外部（真指针）关掉面板；判定走 composedPath，且不抢焦点（P20）',
    outsideHit.hit === 'select-outside' && dismissed.open === false && dismissed.focused === null,
    JSON.stringify({ outsideHit, dismissed }),
  );

  /* ------------------------------------------------------------------ *
   * 5. default-value / placeholder / 清除 / 禁用选项
   * ------------------------------------------------------------------ */
  await page.evaluate(() =>
    window.__make(
      { 'default-value': 'sh', placeholder: '选择城市' },
      `<mc-option value="bj">北京</mc-option>
       <mc-option value="sh">上海</mc-option>
       <mc-option value="gz">广州</mc-option>`,
    ),
  );
  const initial = await page.evaluate(() => {
    const s = window.__sel();
    return {
      value: s.host.value,
      text: s.root.querySelector('.mc-value').textContent,
      filled: s.host.hasAttribute('data-filled'),
    };
  });
  check(
    'default-value 是初始值（property 读得到、显示文案跟着走、data-filled 亮起）',
    initial.value === 'sh' && initial.text === '上海' && initial.filled === true,
    JSON.stringify(initial),
  );

  /* 禁用项点不动 */
  await page.evaluate(() =>
    window.__make(
      {},
      `<mc-option value="bj">北京</mc-option><mc-option value="sz" disabled>深圳</mc-option>`,
    ),
  );
  await click('.mc-control');
  await waitOpen(true);
  await click('.mc-option:nth-of-type(2)');
  await page.waitForTimeout(120);
  const disabledPick = await page.evaluate(() => {
    const s = window.__sel();
    return { value: s.host.value, open: s.panel.matches(':popover-open') };
  });
  check(
    '禁用选项点不动：value 不变、面板不关',
    disabledPick.value === '' && disabledPick.open === true,
    JSON.stringify(disabledPick),
  );

  /* 清除：value 清空 + clear / change 两个事件 */
  await page.evaluate(() => {
    window.__make({ clearable: '', 'default-value': 'bj' }, '<mc-option value="bj">北京</mc-option>');
    window.__watch();
  });
  await click('.mc-clear');
  await page.waitForFunction(
    () => {
      const s = window.__sel();
      return s.host.value === '' && s.root.querySelector('.mc-value').textContent !== '北京';
    },
    { timeout: 3000 },
  ).catch(() => {});
  const cleared = await page.evaluate(() => {
    const s = window.__sel();
    return {
      value: s.host.value,
      empty: s.host.hasAttribute('data-empty'),
      events: window.__events.map((event) => event.type),
      changeData: window.__events.find((event) => event.type === 'change')?.data ?? null,
    };
  });
  check(
    'clearable：点 × 清空 value（发 clear + change），空值回到 placeholder',
    cleared.value === '' &&
      cleared.empty === true &&
      JSON.stringify(cleared.events) === JSON.stringify(['clear', 'change']) &&
      JSON.stringify(cleared.changeData) === JSON.stringify({ value: '' }),
    JSON.stringify(cleared),
  );

  /* ------------------------------------------------------------------ *
   * 6. 多选：value 是数组、default-value 是逗号分隔串、面板不自己收
   * ------------------------------------------------------------------ */
  await page.evaluate(() =>
    window.__make(
      { multiple: '', 'default-value': 'bj,sh' },
      `<mc-option value="bj">北京</mc-option>
       <mc-option value="sh">上海</mc-option>
       <mc-option value="gz">广州</mc-option>`,
    ),
  );
  const multiInit = await page.evaluate(() => {
    const s = window.__sel();
    return {
      value: s.host.value,
      selected: s.rows.map((row) => row.getAttribute('aria-selected')),
      multi: s.list.getAttribute('aria-multiselectable'),
      text: s.root.querySelector('.mc-value').textContent,
    };
  });
  await click('.mc-control');
  await waitOpen(true);
  await click('.mc-option:nth-of-type(3)');
  await page.waitForTimeout(150);
  const multiAfter = await page.evaluate(() => {
    const s = window.__sel();
    return { value: s.host.value, open: s.panel.matches(':popover-open') };
  });
  await click('.mc-option:nth-of-type(1)');
  await page.waitForTimeout(150);
  const multiToggleOff = await page.evaluate(() => window.__sel().host.value);
  check(
    'multiple：value 是 string[]、default-value 是逗号分隔串、再点一次取消选中、面板不自己收',
    JSON.stringify(multiInit.value) === JSON.stringify(['bj', 'sh']) &&
      JSON.stringify(multiInit.selected) === JSON.stringify(['true', 'true', 'false']) &&
      multiInit.multi === 'true' &&
      multiInit.text === '北京, 上海' &&
      JSON.stringify(multiAfter.value) === JSON.stringify(['bj', 'sh', 'gz']) &&
      multiAfter.open === true &&
      JSON.stringify(multiToggleOff) === JSON.stringify(['sh', 'gz']),
    JSON.stringify({ multiInit, multiAfter, multiToggleOff }),
  );

  /* ------------------------------------------------------------------ *
   * 7. disabled / readonly / required / invalid / size
   * ------------------------------------------------------------------ */
  await page.evaluate(() =>
    window.__make(
      { disabled: '', required: '', invalid: '', 'default-value': 'bj' },
      '<mc-option value="bj">北京</mc-option><mc-option value="sh">上海</mc-option>',
    ),
  );
  const stateInit = await page.evaluate(() => {
    const s = window.__sel();
    const danger = getComputedStyle(document.documentElement)
      .getPropertyValue('--mc-color-danger')
      .trim()
      .split(/\s+/)
      .join(', ');
    return {
      controlDisabled: s.control.disabled,
      required: s.control.getAttribute('aria-required'),
      invalid: s.control.getAttribute('aria-invalid'),
      disabledAria: s.control.getAttribute('aria-disabled'),
      border: getComputedStyle(s.control).borderTopColor,
      danger: `rgb(${danger})`,
    };
  });
  /* 禁用时点触发框不该开（用 mouse.click 打真实指针，坐标落在宿主上） */
  await click('.mc-control');
  await page.waitForTimeout(200);
  const disabledOpen = await isOpen();
  check(
    'disabled：原生 button 真的 disabled、aria-* 转发、点了不弹面板；invalid 只换边框色',
    stateInit.controlDisabled === true &&
      stateInit.required === 'true' &&
      stateInit.invalid === 'true' &&
      stateInit.disabledAria === 'true' &&
      stateInit.border === stateInit.danger &&
      disabledOpen === false,
    JSON.stringify({ stateInit, disabledOpen }),
  );

  await page.evaluate(() =>
    window.__make({ readonly: '' }, '<mc-option value="bj">北京</mc-option>'),
  );
  await click('.mc-control');
  await page.waitForTimeout(200);
  const readonlyOpen = await page.evaluate(() => ({
    open: window.__sel().panel.matches(':popover-open'),
    aria: window.__sel().control.getAttribute('aria-readonly'),
  }));
  check(
    'readonly：可以聚焦、aria-readonly 转发，但面板不打开',
    readonlyOpen.open === false && readonlyOpen.aria === 'true',
    JSON.stringify(readonlyOpen),
  );

  const sizes = await page.evaluate(() => {
    const read = (size) => {
      window.__make(size ? { size } : {}, '<mc-option value="bj">北京</mc-option>');
      return Math.round(window.__sel().control.getBoundingClientRect().height);
    };
    return { sm: read('sm'), md: read('md'), lg: read('lg') };
  });
  check(
    'size 三档只动控件高度（sm 28 / md 36 / lg 44）',
    sizes.sm === 28 && sizes.md === 36 && sizes.lg === 44,
    JSON.stringify(sizes),
  );

  /* ------------------------------------------------------------------ *
   * 8. ::part(base) / ::part(panel) / ::part(option) 定制生效
   * ------------------------------------------------------------------ */
  const partStyle = await page.evaluate(() => {
    window.__make({}, '<mc-option value="bj">北京</mc-option><mc-option value="sh">上海</mc-option>');
    const style = document.createElement('style');
    style.id = 'select-part-style';
    style.textContent = `
      #select-probe mc-select::part(base) { border-radius: 0px; }
      #select-probe mc-select::part(panel) { border-radius: 0px; }
      #select-probe mc-select::part(option) { color: rgb(1, 2, 3); }
    `;
    document.head.append(style);
    return true;
  });
  await click('.mc-control');
  await waitOpen(true);
  const parts = await page.evaluate(() => {
    const s = window.__sel();
    return {
      base: getComputedStyle(s.control).borderTopLeftRadius,
      panel: getComputedStyle(s.panel).borderTopLeftRadius,
      option: getComputedStyle(s.rows[0]).color,
    };
  });
  check(
    '::part(base) / ::part(panel) / ::part(option) 都能从外面改（自定义点真的通）',
    partStyle === true &&
      parts.base === '0px' &&
      parts.panel === '0px' &&
      parts.option === 'rgb(1, 2, 3)',
    JSON.stringify(parts),
  );

  /* 收尾：拆探针（量完最后删掉） */
  await page.evaluate(() => {
    document.getElementById('select-probe')?.remove();
    document.getElementById('select-outside')?.remove();
    document.getElementById('select-part-style')?.remove();
  });

  /* ------------------------------------------------------------------ *
   * 9. 文档页：演示渲染出来了，点一下真的会弹（顺带让依赖地图记下这条边）
   * ------------------------------------------------------------------ */
  await visit(page, `/index.html?select-page=${Date.now()}#/packages/select/page.html`);
  await page
    .waitForFunction(() => !!window.__deep('demo-select-basic')?.shadowRoot, { timeout: 10000 })
    .catch(() => {});
  const docPage = await page.evaluate(async () => {
    const demo = window.__deep('demo-select-basic');
    const select = demo?.shadowRoot?.querySelector('mc-select');
    const control = select?.shadowRoot?.querySelector('.mc-control');
    const heading = window.__deep('.doc-body h1')?.textContent?.trim() ?? null;
    const points = window.__deepAll('.doc-demo').length;
    control?.click();
    await new Promise((r) => setTimeout(r, 300));
    return {
      heading,
      points,
      options: select?.querySelectorAll('mc-option').length ?? 0,
      opened: select?.shadowRoot?.querySelector('.mc-panel')?.matches(':popover-open') ?? false,
    };
  });
  check(
    '文档页：标题 / 演示段都在，点演示里的触发框真的弹出面板',
    /^Select/.test(docPage.heading ?? '') &&
      docPage.points >= 5 &&
      docPage.options >= 2 &&
      docPage.opened === true,
    JSON.stringify(docPage),
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);}
