/**
 * mc-dialog · 模态对话框：原生 popover（manual）+ 遮罩 + 焦点陷阱的几条不变量。
 *
 * 跑法：node tests/smoke.mjs dialog（需先 pnpm dev）
 *
 * ⚠️ 这份套件盯的都是「静默失效」型问题 —— 面板照样渲染，只是关不掉 / 焦点跑掉 /
 * 铺不满视口，肉眼很难当场发现：
 *   · `popover="manual"` 的 Esc 与点遮罩都得自己接（浏览器只白送 `auto` 那一档）
 *   · 作者样式压得过 UA 的 `[popover]:not(:popover-open){display:none}` —— 关着也可能常显
 *   · UA 给 `[popover]` 的 `width: fit-content` 会让 `inset: 0` 铺不满视口
 *   · 焦点陷阱必须按扁平树收元素：插槽内容不在 shadow 树里
 *
 * 探针现搭现拆（`#dialog-probe`，固定在视口左上），量完最后一个 evaluate 删掉。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?dialog=1#/packages/dialog/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-dialog'), { timeout: 8000 })
    .catch(() => {});
  await page
    .waitForFunction(() => !!customElements.get('mc-button'), { timeout: 8000 })
    .catch(() => {});
  const defined = await page.evaluate(() => !!customElements.get('mc-dialog'));
  check('mc-dialog 注册成功', defined === true, String(defined));

  /* ------------------------------------------------------------------ *
   * 探针：一个宿主里放齐所有要量的实例
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'dialog-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:12px;display:flex;flex-direction:column;gap:8px';
    host.innerHTML =
      '<div id="dlg-row" style="display:flex;gap:8px">' +
      '<button id="dlg-open">打开</button>' +
      '<button id="dlg-open-plain">打开（不可点遮罩关）</button>' +
      '</div><div id="dlg-sizes" style="display:flex;gap:8px"></div>';
    document.body.append(host);

    /** 造一个对话框并给触发按钮绑好「点一下 = open 属性」 */
    const make = (id, triggerId, attrs, inner) => {
      const dlg = document.createElement('mc-dialog');
      dlg.id = id;
      for (const [k, v] of Object.entries(attrs)) dlg.setAttribute(k, v);
      dlg.innerHTML = inner;
      host.append(dlg);
      document.getElementById(triggerId).addEventListener('click', () => {
        dlg.open = true;
      });
      return dlg;
    };

    make(
      'dlg',
      'dlg-open',
      { heading: '确认删除', closable: '', 'mask-closable': '' },
      '<p>正文</p><input id="dlg-input"><button id="dlg-confirm">确定</button>',
    );
    make('dlg-plain', 'dlg-open-plain', { heading: '不可点遮罩关' }, '<p>正文</p>');

    for (const size of ['sm', 'md', 'lg']) {
      const btn = document.createElement('button');
      btn.id = `dlg-open-${size}`;
      btn.textContent = size;
      document.getElementById('dlg-sizes').append(btn);
      make(`dlg-${size}`, btn.id, { size, heading: size }, '<p>正文</p>');
    }

    // 初始就带 open 的那条路（构造期还没连上文档时不能炸）
    const initial = document.createElement('mc-dialog');
    initial.id = 'dlg-initial';
    initial.setAttribute('heading', '初始打开');
    initial.setAttribute('open', '');
    initial.innerHTML = '<p>正文</p>';
    host.append(initial);
  });
  await page
    .waitForFunction(() => !!document.getElementById('dlg')?.shadowRoot, { timeout: 8000 })
    .catch(() => {});

  /** 面板状态 + 一路钻进 shadow root 的当前焦点 */
  const state = (id = 'dlg') =>
    page.evaluate((sel) => {
      const dlg = document.getElementById(sel);
      const root = dlg.shadowRoot.querySelector('.mc-root');
      const panel = dlg.shadowRoot.querySelector('.mc-panel');
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      const box = root.getBoundingClientRect();
      return {
        open: root.matches(':popover-open'),
        attr: dlg.hasAttribute('open'),
        focused: el?.id || el?.className || el?.tagName || null,
        /* 「铺满视口」对的是布局视口（不含滚动条）—— 只写 position: fixed; inset: 0
           会被 UA 的 width: fit-content 缩成内容宽，这条就是冲它来的 */
        fillsViewport:
          Math.abs(box.width - document.documentElement.clientWidth) <= 1 &&
          Math.abs(box.height - document.documentElement.clientHeight) <= 1,
        panel: panel.getBoundingClientRect().toJSON(),
      };
    }, id);

  const activeId = () =>
    page.evaluate(() => {
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      return el?.id || el?.className || el?.tagName || null;
    });

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

  /** 一个触发按钮的命中点（顺带断言它真的在指针下 —— 环境一变就当场红，而不是测了个寂寞） */
  const pointOf = (id) =>
    page.evaluate((sel) => {
      const el = document.getElementById(sel);
      const box = el.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      return { x, y, hit: document.elementFromPoint(x, y)?.id ?? null };
    }, id);

  /* ------------------------------------------------------------------ *
   * 1. 初始 open 属性这条路（它有遮罩，先验完先拆，否则挡住后面所有点击）
   * ------------------------------------------------------------------ */
  await page
    .waitForFunction(
      () =>
        document
          .getElementById('dlg-initial')
          ?.shadowRoot?.querySelector('.mc-root')
          ?.matches(':popover-open') === true,
      undefined,
      { timeout: 4000 },
    )
    .catch(() => {});
  const initial = await state('dlg-initial');
  check(
    '初始就写 open 的实例：连上文档后自动打开（构造期碰不到 showPopover 也不炸）',
    initial.open === true && initial.attr === true,
    JSON.stringify(initial),
  );
  await page.evaluate(() => document.getElementById('dlg-initial')?.remove());

  /* ------------------------------------------------------------------ *
   * 2. 触发元素 → open property → 原生 popover 打开
   * ------------------------------------------------------------------ */
  const hit = await pointOf('dlg-open');
  await page.mouse.click(hit.x, hit.y);
  await waitOpen('dlg', true);
  const opened = await state('dlg');
  check(
    '点触发元素打开：open property 写上即开，面板铺满视口（top layer，不靠 z-index）',
    hit.hit === 'dlg-open' && opened.open === true && opened.attr === true && opened.fillsViewport,
    JSON.stringify({ ...hit, ...opened }),
  );

  const a11y = await page.evaluate(() => {
    const dlg = document.getElementById('dlg');
    const root = dlg.shadowRoot.querySelector('.mc-root');
    const panel = dlg.shadowRoot.querySelector('.mc-panel');
    const labelled = dlg.shadowRoot.getElementById(panel.getAttribute('aria-labelledby'));
    return {
      popover: root.getAttribute('popover'),
      display: getComputedStyle(root).display,
      role: panel.getAttribute('role'),
      modal: panel.getAttribute('aria-modal'),
      labelled: labelled?.textContent?.trim() ?? null,
      closeDisplay: getComputedStyle(dlg.shadowRoot.querySelector('.mc-close')).display,
    };
  });
  check(
    'a11y：popover="manual" + role=dialog + aria-modal + aria-labelledby 指向头部；closable 的 × 可见',
    a11y.popover === 'manual' &&
      a11y.display === 'flex' &&
      a11y.role === 'dialog' &&
      a11y.modal === 'true' &&
      a11y.labelled === '确认删除' &&
      a11y.closeDisplay === 'flex',
    JSON.stringify(a11y),
  );

  /* 遮罩是「半透明灰压在页面上」还是「压在 UA 给 [popover] 的那张白纸上」，肉眼差别巨大：
     后者整块屏一片均匀的灰、背后的页面一点不露（实测 computed 是 rgb(255,255,255)）。
     两条一起断言，免得以后 UA 默认值变化时没人看得出来。 */
  const overlayPaint = await page.evaluate(() => {
    const dlg = document.getElementById('dlg');
    const root = dlg.shadowRoot.querySelector('.mc-root');
    const overlay = dlg.shadowRoot.querySelector('.mc-overlay');
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
    overlayPaint.rootAlpha === 0 &&
      overlayPaint.overlayAlpha > 0 &&
      overlayPaint.overlayAlpha < 1,
    JSON.stringify(overlayPaint),
  );

  /* ------------------------------------------------------------------ *
   * 3. 焦点：打开时进面板、Tab / Shift+Tab 在面板内循环
   *    正文里的控件写在**插槽（light DOM）**里 —— 陷阱按扁平树收元素才数得到它们
   * ------------------------------------------------------------------ */
  const focusSeq = [await activeId()];
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Tab');
    focusSeq.push(await activeId());
  }
  await page.keyboard.press('Shift+Tab');
  focusSeq.push(await activeId());
  check(
    '打开时焦点进面板；Tab 依次走 × → 正文控件 → 底部，末尾回到 ×；Shift+Tab 反向绕回（不逃出面板）',
    focusSeq.join(' > ') ===
      'mc-close > dlg-input > dlg-confirm > mc-close > dlg-confirm',
    focusSeq.join(' > '),
  );

  /* ------------------------------------------------------------------ *
   * 4. Esc 关闭 + 焦点归还触发元素 + open / close 事件
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__dlgEvents = [];
    const dlg = document.getElementById('dlg');
    for (const type of ['open', 'close']) {
      dlg.addEventListener(type, (e) =>
        window.__dlgEvents.push(`${type}:${e.bubbles}:${e.composed}`),
      );
    }
  });
  await page.keyboard.press('Escape');
  await waitOpen('dlg', false);
  const closed = await state('dlg');
  check(
    'Esc 关闭（manual 不白送这条，组件自己接）+ 焦点归还打开它的那个按钮',
    closed.open === false && closed.attr === false && closed.focused === 'dlg-open',
    JSON.stringify(closed),
  );

  // 再开一次，验事件（open 在上一条里已经发过一轮，这里从干净的两条开始）
  await page.evaluate(() => {
    window.__dlgEvents = [];
  });
  await page.locator('#dlg-open').click();
  await waitOpen('dlg', true);
  await page.keyboard.press('Escape');
  await waitOpen('dlg', false);
  const events = await page.evaluate(() => window.__dlgEvents);
  check(
    'open / close 各一条，且 bubbles + composed（挂在 document 上也能收到）',
    events.join('|') === 'open:true:true|close:true:true',
    JSON.stringify(events),
  );

  /* ------------------------------------------------------------------ *
   * 5. 点遮罩：mask-closable 才关
   * ------------------------------------------------------------------ */
  await page.locator('#dlg-open').click();
  await waitOpen('dlg', true);
  await page.mouse.click(4, 4);
  await waitOpen('dlg', false);
  check(
    'mask-closable：真实指针点遮罩就关',
    (await state('dlg')).open === false,
    JSON.stringify(await state('dlg')),
  );

  const plainHit = await pointOf('dlg-open-plain');
  await page.mouse.click(plainHit.x, plainHit.y);
  await waitOpen('dlg-plain', true);
  await page.mouse.click(4, 4);
  // 停一拍再看：同步那条路当场就该有结论，这里是防「异步误关」的兜底
  await page.waitForTimeout(200);
  check(
    '没写 mask-closable：点遮罩不关（防误触），Esc 仍然关',
    plainHit.hit === 'dlg-open-plain' && (await state('dlg-plain')).open === true,
    JSON.stringify({ ...plainHit, state: await state('dlg-plain') }),
  );
  await page.keyboard.press('Escape');
  await waitOpen('dlg-plain', false);

  /* ------------------------------------------------------------------ *
   * 6. closable 的 ×（原生按钮，真实指针点得到）
   * ------------------------------------------------------------------ */
  await page.locator('#dlg-open').click();
  await waitOpen('dlg', true);
  const closePoint = await page.evaluate(() => {
    const dlg = document.getElementById('dlg');
    const box = dlg.shadowRoot.querySelector('.mc-close').getBoundingClientRect();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    /* ⚠️ `document.elementFromPoint` 只到宿主那一层（shadow 内部看不见），要用 shadowRoot 的那个 */
    const inner = dlg.shadowRoot.elementFromPoint(x, y);
    return {
      x,
      y,
      inner: inner?.className ?? null,
      host: document.elementFromPoint(x, y)?.id ?? null,
    };
  });
  await page.mouse.click(closePoint.x, closePoint.y);
  await waitOpen('dlg', false);
  const noClose = await page.evaluate(() =>
    getComputedStyle(
      document.getElementById('dlg-plain').shadowRoot.querySelector('.mc-close'),
    ).display,
  );
  check(
    'closable 的 × 是原生按钮：真实指针点得到、点了就关；没写 closable 时它不出现',
    /close/.test(closePoint.inner ?? '') &&
      closePoint.host === 'dlg' &&
      (await state('dlg')).open === false &&
      noClose === 'none',
    JSON.stringify({ closePoint, noClose }),
  );

  /* ------------------------------------------------------------------ *
   * 7. size 三档 = 22 / 32 / 44rem 的面板宽度
   * ------------------------------------------------------------------ */
  const rem = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).fontSize),
  );
  const widths = {};
  for (const size of ['sm', 'md', 'lg']) {
    const point = await pointOf(`dlg-open-${size}`);
    await page.mouse.click(point.x, point.y);
    await waitOpen(`dlg-${size}`, true);
    widths[size] = await page.evaluate(
      (s) =>
        Math.round(
          document.getElementById(`dlg-${s}`).shadowRoot.querySelector('.mc-panel')
            .getBoundingClientRect().width,
        ),
      size,
    );
    await page.keyboard.press('Escape');
    await waitOpen(`dlg-${size}`, false);
  }
  check(
    'size 三档：面板宽度 22 / 32 / 44rem，且真的逐档变宽',
    widths.sm === Math.round(rem * 22) &&
      widths.md === Math.round(rem * 32) &&
      widths.lg === Math.round(rem * 44) &&
      widths.sm < widths.md &&
      widths.md < widths.lg,
    JSON.stringify({ ...widths, rem }),
  );

  /* ------------------------------------------------------------------ *
   * 8. 收摊：删掉探针（它的遮罩会挡住后面的文档页检查）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => document.getElementById('dialog-probe')?.remove());

  /* ------------------------------------------------------------------ *
   * 9. 文档页本身：演示渲染出来了，点演示的按钮真的弹（顺带让依赖地图记下 page.html 这条边）
   * ------------------------------------------------------------------ */
  const docPage = await page.evaluate(async () => {
    const demo = window.__deep('demo-dialog-basic');
    const buttons = [...(demo?.shadowRoot?.querySelectorAll('mc-button') ?? [])];
    const heading = window.__deep('.doc-body h1')?.textContent?.trim() ?? null;
    const sections = window.__deepAll('section.doc-demo').length;
    buttons[0]?.click();
    await new Promise((r) => setTimeout(r, 400));
    const dialog = demo?.shadowRoot?.querySelector('mc-dialog');
    return {
      heading,
      sections,
      buttons: buttons.length,
      opened:
        dialog?.shadowRoot?.querySelector('.mc-root')?.matches(':popover-open') ?? false,
    };
  });
  check(
    '文档页：标题与六个演示都在，点演示按钮真的弹出对话框',
    /^Dialog/.test(docPage.heading ?? '') &&
      docPage.sections >= 6 &&
      docPage.buttons >= 2 &&
      docPage.opened === true,
    JSON.stringify(docPage),
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('dialog 相关页面没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
