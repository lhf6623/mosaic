/**
 * mc-drawer · 侧滑抽屉：原生 popover（manual）+ 贴边 + 焦点陷阱的几条不变量。
 *
 * 跑法：node tests/smoke.mjs drawer（需先 pnpm dev）
 *
 * ⚠️ 这份套件盯的都是「静默失效」型问题 —— 面板照常渲染，只是关不掉 / 焦点跑掉 / 贴错边：
 *   · `popover="manual"` 的 Esc 与点遮罩都得自己接（浏览器只白送 `auto` 那一档）
 *   · 作者样式压得过 UA 的 `[popover]:not(:popover-open){display:none}` —— 关着也可能常年可见
 *   · UA 给 `[popover]` 的 `width: fit-content` 会让 `inset: 0` 铺不满视口
 *   · 焦点陷阱必须按扁平树收元素：插槽内容不在 shadow 树里
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  /* 抽屉有进场动画：量位置 / 点指针前把动画关掉，否则量到的是动画中的中间态 */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visit(page, '/index.html?drawer=1#/packages/drawer/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-drawer'), { timeout: 8000 })
    .catch(() => {});
  await page
    .waitForFunction(() => !!customElements.get('mc-button'), { timeout: 8000 })
    .catch(() => {});
  const defined = await page.evaluate(() => !!customElements.get('mc-drawer'));
  check('mc-drawer 注册成功', defined === true, String(defined));

  /* ------------------------------------------------------------------ *
   * 探针：一个宿主里放齐所有要量的实例
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'drawer-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:12px;display:flex;flex-direction:column;gap:8px';
    host.innerHTML =
      '<div id="drw-row" style="display:flex;gap:8px">' +
      '<button id="drw-open">打开</button>' +
      '<button id="drw-open-plain">打开（不可点遮罩关）</button>' +
      '<button id="drw-open-left">左侧</button>' +
      '</div><div id="drw-sizes" style="display:flex;gap:8px"></div>';
    document.body.append(host);

    const make = (id, triggerId, attrs, inner) => {
      const drawer = document.createElement('mc-drawer');
      drawer.id = id;
      for (const [k, v] of Object.entries(attrs)) drawer.setAttribute(k, v);
      drawer.innerHTML = inner;
      host.append(drawer);
      document.getElementById(triggerId).addEventListener('click', () => {
        drawer.open = true;
      });
      return drawer;
    };

    make(
      'drw',
      'drw-open',
      { heading: '委托单详情', closable: '', 'mask-closable': '' },
      '<p>正文</p><input id="drw-input"><button id="drw-confirm">确定</button>',
    );
    make('drw-plain', 'drw-open-plain', { heading: '不可点遮罩关' }, '<p>正文</p>');
    make('drw-left', 'drw-open-left', { heading: '左侧', placement: 'left', closable: '' }, '<p>正文</p>');

    for (const size of ['sm', 'md', 'lg']) {
      const btn = document.createElement('button');
      btn.id = `drw-open-${size}`;
      btn.textContent = size;
      document.getElementById('drw-sizes').append(btn);
      make(`drw-${size}`, btn.id, { size, heading: size }, '<p>正文</p>');
    }

    // 初始就带 open 的那条路（构造期还没连上文档时不能炸）
    const initial = document.createElement('mc-drawer');
    initial.id = 'drw-initial';
    initial.setAttribute('heading', '初始打开');
    initial.setAttribute('open', '');
    initial.innerHTML = '<p>正文</p>';
    host.append(initial);
  });
  await page
    .waitForFunction(() => !!document.getElementById('drw')?.shadowRoot, { timeout: 8000 })
    .catch(() => {});

  const state = (id = 'drw') =>
    page.evaluate((sel) => {
      const drawer = document.getElementById(sel);
      const root = drawer.shadowRoot.querySelector('.mc-root');
      const panel = drawer.shadowRoot.querySelector('.mc-panel');
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      const box = root.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      return {
        open: root.matches(':popover-open'),
        attr: drawer.hasAttribute('open'),
        focused: el?.id || el?.className || el?.tagName || null,
        fillsViewport:
          Math.abs(box.width - document.documentElement.clientWidth) <= 1 &&
          Math.abs(box.height - document.documentElement.clientHeight) <= 1,
        panelLeft: Math.round(panelBox.left),
        panelRightGap: Math.round(document.documentElement.clientWidth - panelBox.right),
        panelWidth: Math.round(panelBox.width),
        panelHeight: Math.round(panelBox.height),
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
      };
    }, id);

  const waitOpen = (id, want) =>
    page
      .waitForFunction(
        ({ sel, open }) =>
          document.getElementById(sel)?.shadowRoot?.querySelector('.mc-root')?.matches(':popover-open') ===
          open,
        { sel: id, open: want },
        { timeout: 4000 },
      )
      .catch(() => {});

  const pointOf = (id) =>
    page.evaluate((sel) => {
      const el = document.getElementById(sel);
      const box = el.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      return { x, y, hit: document.elementFromPoint(x, y)?.id ?? null };
    }, id);

  /* ------------------------------------------------------------------ *
   * 1. 初始 open：连上文档后自动打开
   * ------------------------------------------------------------------ */
  await page
    .waitForFunction(
      () =>
        document
          .getElementById('drw-initial')
          ?.shadowRoot?.querySelector('.mc-root')
          ?.matches(':popover-open') === true,
      undefined,
      { timeout: 4000 },
    )
    .catch(() => {});
  const initial = await state('drw-initial');
  check(
    '初始就写 open 的实例：连上文档后自动打开（构造期碰不到 showPopover 也不炸）',
    initial.open === true && initial.attr === true,
    JSON.stringify(initial),
  );
  await page.evaluate(() => document.getElementById('drw-initial')?.remove());

  /* ------------------------------------------------------------------ *
   * 2. 打开：铺满视口 + 面板贴右且满高
   * ------------------------------------------------------------------ */
  const hit = await pointOf('drw-open');
  await page.mouse.click(hit.x, hit.y);
  await waitOpen('drw', true);
  const opened = await state('drw');
  check(
    '点触发元素打开：open property 写上即开；浮层铺满视口、面板贴右且满高',
    hit.hit === 'drw-open' &&
      opened.open === true &&
      opened.attr === true &&
      opened.fillsViewport &&
      Math.abs(opened.panelRightGap) <= 1 &&
      Math.abs(opened.panelHeight - opened.viewportHeight) <= 1,
    JSON.stringify({ ...hit, ...opened }),
  );

  const shell = await page.evaluate(() => {
    const drawer = document.getElementById('drw');
    const root = drawer.shadowRoot.querySelector('.mc-root');
    return {
      popover: root.getAttribute('popover'),
      display: getComputedStyle(root).display,
      placement: root.getAttribute('data-placement'),
      tabindex: drawer.shadowRoot.querySelector('.mc-panel').getAttribute('tabindex'),
      closeDisplay: getComputedStyle(drawer.shadowRoot.querySelector('.mc-close')).display,
      headerDisplay: getComputedStyle(drawer.shadowRoot.querySelector('.mc-header')).display,
    };
  });
  check(
    '浮层：popover="manual"、placement 反射到 data-placement；面板 tabindex="-1"；closable 的 × 可见、有标题时头部显示',
    shell.popover === 'manual' &&
      shell.display === 'flex' &&
      shell.placement === 'right' &&
      shell.tabindex === '-1' &&
      shell.closeDisplay === 'flex' &&
      shell.headerDisplay === 'flex',
    JSON.stringify(shell),
  );

  const overlayPaint = await page.evaluate(() => {
    const drawer = document.getElementById('drw');
    const root = drawer.shadowRoot.querySelector('.mc-root');
    const overlay = drawer.shadowRoot.querySelector('.mc-overlay');
    const alpha = (color) => {
      const m = color.match(/rgba?\(([^)]+)\)/);
      const parts = m ? m[1].split(',').map((v) => Number(v.trim())) : [];
      return parts.length === 4 ? parts[3] : 1;
    };
    return {
      rootBg: getComputedStyle(root).backgroundColor,
      rootAlpha: alpha(getComputedStyle(root).backgroundColor),
      overlayAlpha: alpha(getComputedStyle(overlay).backgroundColor),
    };
  });
  check(
    '浮层本体透明、遮罩半透明：背后的页面要透出来（UA 给 [popover] 的 canvas 背景必须关掉）',
    overlayPaint.rootAlpha === 0 && overlayPaint.overlayAlpha > 0 && overlayPaint.overlayAlpha < 1,
    JSON.stringify(overlayPaint),
  );

  /* ------------------------------------------------------------------ *
   * 3. 焦点：打开时进面板；Tab 循环不逃出面板
   * ------------------------------------------------------------------ */
  const activeId = () =>
    page.evaluate(() => {
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      return el?.id || el?.className || el?.tagName || null;
    });
  const focusSeq = [await activeId()];
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Tab');
    focusSeq.push(await activeId());
  }
  await page.keyboard.press('Shift+Tab');
  focusSeq.push(await activeId());
  check(
    '打开时焦点进面板；Tab 依次走 × → 正文控件 → 底部，末尾回到 ×；Shift+Tab 反向绕回',
    focusSeq.join(' > ') === 'mc-close > drw-input > drw-confirm > mc-close > drw-confirm',
    focusSeq.join(' > '),
  );

  /* ------------------------------------------------------------------ *
   * 4. Esc 关闭 + 焦点归还 + 事件
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__drwEvents = [];
    const drawer = document.getElementById('drw');
    for (const type of ['open', 'close']) {
      drawer.addEventListener(type, (e) =>
        window.__drwEvents.push(`${type}:${e.bubbles}:${e.composed}`),
      );
    }
  });
  await page.keyboard.press('Escape');
  await waitOpen('drw', false);
  const closed = await state('drw');
  check(
    'Esc 关闭（manual 不白送这条，组件自己接）+ 焦点归还打开它的那个按钮',
    closed.open === false && closed.attr === false && closed.focused === 'drw-open',
    JSON.stringify(closed),
  );

  await page.evaluate(() => {
    window.__drwEvents = [];
  });
  await page.locator('#drw-open').click();
  await waitOpen('drw', true);
  await page.keyboard.press('Escape');
  await waitOpen('drw', false);
  const events = await page.evaluate(() => window.__drwEvents);
  check(
    'open / close 各一条，且 bubbles + composed（挂在 document 上也能收到）',
    events.join('|') === 'open:true:true|close:true:true',
    JSON.stringify(events),
  );

  /* ------------------------------------------------------------------ *
   * 5. 点遮罩：mask-closable 才关
   * ------------------------------------------------------------------ */
  await page.locator('#drw-open').click();
  await waitOpen('drw', true);
  await page.mouse.click(4, 4);
  await waitOpen('drw', false);
  const maskClosed = await state('drw');
  check('mask-closable：真实指针点遮罩就关', maskClosed.open === false, JSON.stringify(maskClosed));

  const plainHit = await pointOf('drw-open-plain');
  await page.mouse.click(plainHit.x, plainHit.y);
  await waitOpen('drw-plain', true);
  await page.mouse.click(4, 4);
  await page.waitForTimeout(200);
  check(
    '没写 mask-closable：点遮罩不关（防误触），Esc 仍然关',
    plainHit.hit === 'drw-open-plain' && (await state('drw-plain')).open === true,
    JSON.stringify({ ...plainHit, state: await state('drw-plain') }),
  );
  await page.keyboard.press('Escape');
  await waitOpen('drw-plain', false);

  /* ------------------------------------------------------------------ *
   * 6. closable 的 ×
   * ------------------------------------------------------------------ */
  await page.locator('#drw-open').click();
  await waitOpen('drw', true);
  const closePoint = await page.evaluate(() => {
    const drawer = document.getElementById('drw');
    const box = drawer.shadowRoot.querySelector('.mc-close').getBoundingClientRect();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const inner = drawer.shadowRoot.elementFromPoint(x, y);
    return { x, y, inner: inner?.className ?? null, host: document.elementFromPoint(x, y)?.id ?? null };
  });
  await page.mouse.click(closePoint.x, closePoint.y);
  await waitOpen('drw', false);
  const noClose = await page.evaluate(() =>
    getComputedStyle(document.getElementById('drw-plain').shadowRoot.querySelector('.mc-close')).display,
  );
  check(
    'closable 的 × 是原生按钮：真实指针点得到、点了就关；没写 closable 时它不出现',
    /close/.test(closePoint.inner ?? '') &&
      closePoint.host === 'drw' &&
      (await state('drw')).open === false &&
      noClose === 'none',
    JSON.stringify({ closePoint, noClose }),
  );

  /* ------------------------------------------------------------------ *
   * 7. placement=left：贴左
   * ------------------------------------------------------------------ */
  const leftHit = await pointOf('drw-open-left');
  await page.mouse.click(leftHit.x, leftHit.y);
  await waitOpen('drw-left', true);
  const leftState = await state('drw-left');
  const leftPlacement = await page.evaluate(
    () => document.getElementById('drw-left').shadowRoot.querySelector('.mc-root').getAttribute('data-placement'),
  );
  check(
    'placement="left"：data-placement 反射 + 面板贴左（left ≈ 0）',
    leftState.open === true && leftState.panelLeft <= 1 && leftPlacement === 'left',
    JSON.stringify({ ...leftState, leftPlacement }),
  );
  await page.keyboard.press('Escape');
  await waitOpen('drw-left', false);

  /* ------------------------------------------------------------------ *
   * 8. size 三档 = 20 / 26 / 34rem
   * ------------------------------------------------------------------ */
  const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const widths = {};
  for (const size of ['sm', 'md', 'lg']) {
    const point = await pointOf(`drw-open-${size}`);
    await page.mouse.click(point.x, point.y);
    await waitOpen(`drw-${size}`, true);
    widths[size] = (await state(`drw-${size}`)).panelWidth;
    await page.keyboard.press('Escape');
    await waitOpen(`drw-${size}`, false);
  }
  check(
    'size 三档：面板宽度 20 / 26 / 34rem，且真的逐档变宽',
    widths.sm === Math.round(rem * 20) &&
      widths.md === Math.round(rem * 26) &&
      widths.lg === Math.round(rem * 34) &&
      widths.sm < widths.md &&
      widths.md < widths.lg,
    JSON.stringify({ ...widths, rem }),
  );

  /* ------------------------------------------------------------------ *
   * 9. 文档页：演示渲染出来了，点演示的按钮真的打开
   * ------------------------------------------------------------------ */
  await page.evaluate(() => document.getElementById('drawer-probe')?.remove());
  const demo = await page.evaluate(async () => {
    const target = window.__deep?.('demo-drawer-basic');
    if (!target) return { found: false };
    const button = target.shadowRoot?.querySelector('mc-button');
    button?.shadowRoot?.querySelector('button')?.click();
    await new Promise((r) => setTimeout(r, 300));
    const drawer = target.shadowRoot?.querySelector('mc-drawer');
    return {
      found: true,
      open: drawer?.shadowRoot?.querySelector('.mc-root')?.matches(':popover-open') === true,
    };
  });
  check('文档页基础演示：点按钮打开抽屉', demo.found === true && demo.open === true, JSON.stringify(demo));

  page.off('response', onResponse);
  page.off('pageerror', onError);
  return failed;
}