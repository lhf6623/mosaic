/**
 * mc-switch · 开关：点击 / 键盘 Space 切换、change payload（document 级记账）、
 * checked property 写完立刻生效、disabled 转发到内部原生 input、
 * 滑块几何（行程由令牌算出来）、尺寸与令牌、part 既存在又真的能被 ::part() 改到。
 * 探针现搭现拆，跑法 node tests/smoke.mjs switch。
 */

export default async function run({ page, visit, check }) {
  /* 开关文档页：组件本体在页里 <l-m> 引入 */
  await visit(page, '/index.html?switch=1#/packages/switch/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-switch'), { timeout: 8000 })
    .catch(() => {});

  /* 搭探针：量几何的那几个把 --mc-duration-base 压成 0ms —— 不跟过渡动画赛跑 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'switch-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-direction:column;gap:6px;width:360px';
    document.body.append(host);

    const put = (id, attrs = {}, text = '开关', style = '') => {
      const el = document.createElement('mc-switch');
      el.id = id;
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      if (style) el.setAttribute('style', style);
      el.textContent = text;
      host.append(el);
      return el;
    };

    const instant = '--mc-duration-base: 0ms';
    put('sw-plain', {}, '未打开', instant);
    put('sw-checked', { checked: true }, '已打开', instant);
    put('sw-geo', {}, '量几何', instant);
    put('sw-disabled', { disabled: true }, '禁用', instant);
    put('sw-sm', { size: 'sm' }, '小', instant);
    put('sw-md', {}, '中', instant);
    put('sw-lg', { size: 'lg' }, '大', instant);
    put('sw-part', { checked: true }, 'part', instant);

    /* 组件自己把原生 change 转发成 composed 事件（P19）—— 挂 document 级监听记账 */
    window.__swChanges = [];
    document.addEventListener('change', (event) => {
      window.__swChanges.push({ id: event.target.id, data: event.data ?? null });
    });

    /* part 从页面侧真的能改到内部：改轨道三条令牌 + 直接改圆角 */
    const style = document.createElement('style');
    style.id = 'switch-part-style';
    style.textContent =
      '#sw-part::part(track) { --mc-switch-track-w: 3.5rem; --mc-switch-track-h: 1.75rem; --mc-switch-thumb: 1.375rem; }' +
      '#sw-part::part(thumb) { border-radius: 2px; }' +
      '#sw-part::part(base) { padding-inline: var(--mc-space-1); }';
    document.head.append(style);
  });

  await page
    .waitForFunction(
      () => [...document.querySelectorAll('#switch-probe mc-switch')].every((el) => !!el.shadowRoot),
      { timeout: 5000 },
    )
    .catch(() => {});

  /* ---------- 点一下：切换 + 事件载荷 ---------- */
  await page.locator('#sw-plain').click();
  const clicked = await page.evaluate(() => {
    const el = document.getElementById('sw-plain');
    return {
      prop: el.checked,
      native: el.shadowRoot.querySelector('input').checked,
      attr: el.hasAttribute('checked'),
      changes: window.__swChanges.slice(),
    };
  });
  check(
    '点一下：宿主 property / 内部原生 input / checked 属性三处一起变成打开',
    clicked.prop === true && clicked.native === true && clicked.attr === true,
    JSON.stringify(clicked),
  );
  check(
    'change 带 { checked } 且穿透 shadow 冒到 document，且只发一次（原生 change 穿不出来，必须转发）',
    clicked.changes.length === 1 &&
      clicked.changes[0].id === 'sw-plain' &&
      clicked.changes[0].data?.checked === true,
    JSON.stringify(clicked.changes),
  );

  await page.locator('#sw-plain').click();
  const clickedAgain = await page.evaluate(() => {
    const el = document.getElementById('sw-plain');
    return { prop: el.checked, changes: window.__swChanges.slice(-1) };
  });
  check(
    '再点一下关回去，并再发一次 change（checked: false）',
    clickedAgain.prop === false && clickedAgain.changes[0]?.data?.checked === false,
    JSON.stringify(clickedAgain),
  );

  /* ---------- 键盘：焦点在内部原生 input 上，Space 一样能切 ---------- */
  await page.evaluate(() => {
    document.getElementById('sw-plain').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('Space');
  const byKeyboard = await page.evaluate(() => {
    const el = document.getElementById('sw-plain');
    return { prop: el.checked, changes: window.__swChanges.slice(-1) };
  });
  check(
    '键盘 Space 切换（可交互元素是原生 input，键盘与读屏白拿）',
    byKeyboard.prop === true && byKeyboard.changes[0]?.data?.checked === true,
    JSON.stringify(byKeyboard),
  );

  /* ---------- checked property 写完立刻生效（不等 ofa 那一拍，P4） ---------- */
  const immediate = await page.evaluate(() => {
    const el = document.getElementById('sw-checked');
    const input = el.shadowRoot.querySelector('input');
    const snap = () => ({ prop: el.checked, native: input.checked, attr: el.hasAttribute('checked') });
    el.checked = false; // 同步读，不 await
    const off = snap();
    el.checked = true;
    return { off, on: snap() };
  });
  check(
    'el.checked = false / true 写完当次就读得到（属性 + 内部原生 input 一起到位）',
    immediate.off.prop === false &&
      immediate.off.native === false &&
      immediate.off.attr === false &&
      immediate.on.prop === true &&
      immediate.on.native === true,
    JSON.stringify(immediate),
  );

  /* ---------- 语义与禁用 ---------- */
  const semantics = await page.evaluate(() => {
    const el = document.getElementById('sw-disabled');
    const input = el.shadowRoot.querySelector('input');
    return {
      tag: input.tagName,
      type: input.type,
      role: input.getAttribute('role'),
      native: input.disabled,
      cursor: getComputedStyle(el.shadowRoot.querySelector('.mc-base')).cursor,
      opacity: getComputedStyle(el).opacity,
    };
  });
  check(
    '语义白拿：内部是原生 input[type=checkbox][role=switch]',
    semantics.tag === 'INPUT' && semantics.type === 'checkbox' && semantics.role === 'switch',
    JSON.stringify(semantics),
  );

  await page.locator('#sw-disabled').click({ force: true });
  const disabled = await page.evaluate(() => ({
    checked: document.getElementById('sw-disabled').checked,
    emitted: window.__swChanges.filter((item) => item.id === 'sw-disabled').length,
  }));
  check(
    '禁用转发给内部原生 input（不是只有 opacity）：点不动、光标 not-allowed',
    semantics.native === true &&
      semantics.cursor === 'not-allowed' &&
      semantics.opacity === '0.5' &&
      disabled.checked === false &&
      disabled.emitted === 0,
    JSON.stringify({ semantics, disabled }),
  );

  /* ---------- 滑块几何：行程 = 轨道宽 − 滑块宽 − 两侧内边距 ---------- */
  const geometryOf = (id) =>
    page.evaluate((target) => {
      const el = document.getElementById(target);
      const track = el.shadowRoot.querySelector('[part="track"]');
      const thumb = el.shadowRoot.querySelector('[part="thumb"]');
      const t = track.getBoundingClientRect();
      const h = thumb.getBoundingClientRect();
      return {
        offset: Math.round((h.left - t.left) * 10) / 10,
        trackW: Math.round(t.width),
        thumbW: Math.round(h.width),
        inside: h.left >= t.left - 0.5 && h.right <= t.right + 0.5,
      };
    }, id);

  const off = await geometryOf('sw-geo');
  await page.locator('#sw-geo').click();
  const on = await geometryOf('sw-geo');
  const travel = Math.round((on.offset - off.offset) * 10) / 10;
  check(
    '滑块位移 = 轨道宽 − 滑块宽 − 2×内边距（md：36 − 16 − 4 = 16px），且始终不越出轨道',
    off.inside &&
      on.inside &&
      travel === off.trackW - off.thumbW - 4 &&
      travel === 16 &&
      off.offset === 2,
    JSON.stringify({ off, on, travel }),
  );

  /* ---------- 尺寸与颜色都走令牌 ---------- */
  const tokens = await page.evaluate(() => {
    const rgbOf = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).join(',');
    const read = (name) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
        .replace(/\s+/g, ',');
    const h = (id) => Math.round(document.getElementById(id).getBoundingClientRect().height);
    const font = (id) => getComputedStyle(document.getElementById(id)).fontSize;
    const trackW = (id) =>
      Math.round(
        document.getElementById(id).shadowRoot.querySelector('[part="track"]').getBoundingClientRect()
          .width,
      );
    const checked = document.getElementById('sw-checked');
    return {
      h: { sm: h('sw-sm'), md: h('sw-md'), lg: h('sw-lg') },
      font: { sm: font('sw-sm'), md: font('sw-md'), lg: font('sw-lg') },
      track: { sm: trackW('sw-sm'), md: trackW('sw-md'), lg: trackW('sw-lg') },
      trackFill: rgbOf(
        getComputedStyle(checked.shadowRoot.querySelector('[part="track"]')).backgroundColor,
      ),
      primary: read('--mc-color-primary'),
    };
  });
  check(
    'size 三档 = 28 / 36 / 44（--mc-control-h-*）、字号 12 / 14 / 16px、轨道 28 / 36 / 44px 一起变',
    tokens.h.sm === 28 &&
      tokens.h.md === 36 &&
      tokens.h.lg === 44 &&
      tokens.font.sm === '12px' &&
      tokens.font.md === '14px' &&
      tokens.font.lg === '16px' &&
      tokens.track.sm === 28 &&
      tokens.track.md === 36 &&
      tokens.track.lg === 44,
    JSON.stringify(tokens),
  );
  check(
    '打开的轨道填充色就是 --mc-color-primary（组件里没有写死的颜色）',
    tokens.trackFill === tokens.primary,
    `轨道 ${tokens.trackFill} ≠ 令牌 ${tokens.primary}`,
  );

  /* ---------- part：三个都在，且 ::part() 真的改得动 ---------- */
  const parts = await page.evaluate(() => {
    const root = document.getElementById('sw-part').shadowRoot;
    const found = (name) => !!root.querySelector(`[part="${name}"]`);
    const track = getComputedStyle(root.querySelector('[part="track"]'));
    const thumb = getComputedStyle(root.querySelector('[part="thumb"]'));
    return {
      base: found('base'),
      track: found('track'),
      thumb: found('thumb'),
      trackWidth: track.width,
      thumbRadius: thumb.borderTopLeftRadius,
    };
  });
  check(
    'part="base" / "track" / "thumb" 都在；::part(track) 改了长宽、::part(thumb) 改了圆角',
    parts.base &&
      parts.track &&
      parts.thumb &&
      parts.trackWidth === '56px' &&
      parts.thumbRadius === '2px',
    JSON.stringify(parts),
  );

  /* ---------- 焦点环：用 ring 令牌，不用 currentColor（P16） ----------
     先程序化聚焦前一个，再用真实 Tab 走到下一个 —— 键盘移动过焦点，:focus-visible 才可靠 */
  await page.evaluate(() => {
    document.getElementById('sw-plain').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.getElementById('sw-checked');
    const input = el.shadowRoot.querySelector('input');
    const track = el.shadowRoot.querySelector('[part="track"]');
    const ring = getComputedStyle(document.documentElement)
      .getPropertyValue('--mc-color-ring')
      .trim()
      .replace(/\s+/g, ',');
    return {
      active: el.shadowRoot.activeElement === input,
      focusVisible: input.matches(':focus-visible'),
      outline: (getComputedStyle(track).outlineColor.match(/\d+/g) ?? []).slice(0, 3).join(','),
      ring,
    };
  });
  check(
    'Tab 走到下一个开关：焦点环画在轨道上、颜色取 --mc-color-ring（不是 currentColor）',
    focus.active && focus.focusVisible && focus.outline === focus.ring,
    JSON.stringify(focus),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => {
    document.getElementById('switch-probe')?.remove();
    document.getElementById('switch-part-style')?.remove();
  });
}
