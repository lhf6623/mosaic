/** mc-button：语义色 × 外观 × 尺寸、状态、插槽、原生点击穿透；探针按钮现搭现拆，跑法 node tests/smoke.mjs button。 */

export default async function run({ page, visit, check }) {
  /* 按钮文档页：组件与令牌都就位（组件本体在 docs/layout 之外的页里 <l-m> 引入） */
  await visit(page, '/index.html?button=1#/packages/button/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-button'), { timeout: 8000 })
    .catch(() => {});

  /* 搭探针：每个断言要的元素都在这里，量完由最后一个 evaluate 拆掉 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'btn-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-direction:column;gap:6px;width:360px';
    host.innerHTML = [
      'row-colors',
      'row-variants',
      'row-sizes',
      'row-states',
      'row-slots',
    ]
      .map((id) => `<div id="${id}" style="display:flex;gap:6px;align-items:center"></div>`)
      .join('') + '<div id="row-block" style="display:block;width:300px"></div>';
    document.body.append(host);

    const put = (row, id, attrs = {}, text = '按钮') => {
      const b = document.createElement('mc-button');
      b.id = id;
      for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
      b.textContent = text;
      document.getElementById(row).append(b);
      return b;
    };

    for (const color of ['primary', 'info', 'success', 'warning', 'danger', 'neutral']) {
      put('row-colors', `c-${color}`, { color });
    }
    put('row-variants', 'v-outline', { variant: 'outline', color: 'primary' });
    put('row-variants', 'v-outline-danger', { variant: 'outline', color: 'danger' });
    put('row-variants', 'v-ghost', { variant: 'ghost', color: 'info' });

    put('row-sizes', 's-sm', { size: 'sm' });
    put('row-sizes', 's-md', {});
    put('row-sizes', 's-lg', { size: 'lg' });

    put('row-states', 'st-default', {});
    put('row-states', 'st-disabled', { disabled: true, id: 'st-disabled' });
    put('row-states', 'st-loading', { loading: true });
    put('row-states', 'st-submit', { type: 'submit' });

    put('row-slots', 'sl-slots', {}, '');
    document.getElementById('sl-slots').innerHTML =
      '<span slot="prefix" id="sl-prefix">🔍</span>搜索<span slot="suffix" id="sl-suffix">→</span>';

    put('row-block', 'bk-block', { block: true }, '撑满');

    // 精确覆盖 + 键盘焦点：单独两个，Tab 从 a 走到 b
    const a = put('row-block', 'kb-a', {}, 'A');
    const b = put('row-block', 'kb-b', {}, 'B');
    b.setAttribute('style', 'height: 48px');
    a.focus();

    // 原生 click 是否穿透 shadow：挂一个 document 级监听记账
    window.__btnClicks = [];
    document.addEventListener('click', (e) => window.__btnClicks.push(e.target.id || e.target.tagName));
    put('row-block', 'cl-click', {}, '点我');
  });

  /* ---------- 语义色：色槽的值必须就是令牌的值 ---------- */
  const colors = await page.evaluate(() => {
    const rgbOf = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).join(',');
    const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/\s+/g, ',');
    return ['primary', 'info', 'success', 'warning', 'danger', 'neutral'].map((color) => ({
      color,
      actual: rgbOf(getComputedStyle(document.getElementById(`c-${color}`)).backgroundColor),
      expected: token(`--mc-color-${color}`),
    }));
  });
  check(
    '六个语义色的填充色就是对应令牌（组件没写死颜色）',
    colors.length === 6 && colors.every((c) => c.actual === c.expected),
    colors.map((c) => `${c.color}:${c.actual === c.expected ? '✓' : `${c.actual}≠${c.expected}`}`).join(' '),
  );

  /* ---------- 外观 × 颜色正交 ---------- */
  const variants = await page.evaluate(() => {
    const rgbOf = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).join(',');
    const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/\s+/g, ',');
    const cs = (id) => getComputedStyle(document.getElementById(id));
    return {
      outline: {
        bg: rgbOf(cs('v-outline').backgroundColor),
        fg: rgbOf(cs('v-outline').color),
        border: rgbOf(cs('v-outline').borderTopColor),
        primary: token('--mc-color-primary'),
      },
      outlineDanger: {
        fg: rgbOf(cs('v-outline-danger').color),
        danger: token('--mc-color-danger'),
      },
      ghost: {
        bg: rgbOf(cs('v-ghost').backgroundColor),
        border: rgbOf(cs('v-ghost').borderTopColor),
        fg: rgbOf(cs('v-ghost').color),
        info: token('--mc-color-info'),
      },
    };
  });
  check(
    'variant 与 color 正交：描边的危险按钮是「outline × danger」而不是另一个枚举',
    variants.outline.bg === '0,0,0' &&
      variants.outline.fg === variants.outline.primary &&
      variants.outline.border === variants.outline.primary &&
      variants.outlineDanger.fg === variants.outlineDanger.danger,
    JSON.stringify(variants),
  );
  check(
    'ghost：透明底、透明描边、文字取强调色',
    variants.ghost.bg === '0,0,0' && variants.ghost.border === '0,0,0' && variants.ghost.fg === variants.ghost.info,
    JSON.stringify(variants.ghost),
  );

  /* ---------- 三档尺寸 / block / style 覆盖 ---------- */
  const geometry = await page.evaluate(() => ({
    sm: Math.round(document.getElementById('s-sm').getBoundingClientRect().height),
    md: Math.round(document.getElementById('s-md').getBoundingClientRect().height),
    lg: Math.round(document.getElementById('s-lg').getBoundingClientRect().height),
    blockWidth: Math.round(document.getElementById('bk-block').getBoundingClientRect().width),
    parentWidth: Math.round(document.getElementById('row-block').getBoundingClientRect().width),
    overrideHeight: Math.round(document.getElementById('kb-b').getBoundingClientRect().height),
    defaultHeight: Math.round(document.getElementById('kb-a').getBoundingClientRect().height),
  }));
  check(
    'size 三档 = 28 / 36 / 44（--mc-control-h-*）',
    geometry.sm === 28 && geometry.md === 36 && geometry.lg === 44,
    JSON.stringify(geometry),
  );
  check(
    'block 撑满父容器；style="height:48px" 精确覆盖属性给的默认值',
    Math.abs(geometry.blockWidth - geometry.parentWidth) <= 1 && geometry.overrideHeight === 48,
    `block ${geometry.blockWidth}/${geometry.parentWidth} · style 覆盖 ${geometry.overrideHeight}（默认 ${geometry.defaultHeight}）`,
  );

  /* ---------- 状态：转发给内部原生 button ---------- */
  const states = await page.evaluate(() => {
    const native = (id) => document.getElementById(id).shadowRoot.querySelector('.mc-native');
    const loader = document.getElementById('st-loading').shadowRoot.querySelector('.mc-loader');
    return {
      disabled: native('st-disabled').disabled,
      disabledCursor: getComputedStyle(document.getElementById('st-disabled')).cursor,
      disabledOpacity: getComputedStyle(document.getElementById('st-disabled')).opacity,
      loading: native('st-loading').disabled,
      loaderDisplay: getComputedStyle(loader).display,
      submitType: native('st-submit').type,
      defaultType: native('st-default').type,
    };
  });
  check(
    'disabled / loading 都转发给内部原生 button（键盘与读屏可感知，不只靠 opacity）',
    states.disabled &&
      states.loading &&
      states.disabledCursor === 'not-allowed' &&
      states.disabledOpacity === '0.5' &&
      states.loaderDisplay !== 'none',
    JSON.stringify(states),
  );
  check(
    'type 逐字转发（submit / reset / button），默认 button',
    states.submitType === 'submit' && states.defaultType === 'button',
    JSON.stringify(states),
  );

  /* ---------- 插槽 ---------- */
  const slots = await page.evaluate(() => {
    const host = document.getElementById('sl-slots').getBoundingClientRect();
    const prefix = document.getElementById('sl-prefix');
    const suffix = document.getElementById('sl-suffix');
    const box = (el) => el.getBoundingClientRect();
    return {
      // 宿主是 inline-flex，插槽元素被块级化成 flex —— flex / inline-flex 都算对
      prefixDisplay: getComputedStyle(prefix).display,
      suffixDisplay: getComputedStyle(suffix).display,
      prefixInside: box(prefix).left >= host.left - 1 && box(prefix).right <= host.right + 1,
      suffixInside: box(suffix).right <= host.right + 1,
      order: box(prefix).left < box(suffix).left,
    };
  });
  check(
    'prefix / suffix 插槽渲染成行内 flex（::slotted 生效），且排在文字两侧',
    ['flex', 'inline-flex'].includes(slots.prefixDisplay) &&
      ['flex', 'inline-flex'].includes(slots.suffixDisplay) &&
      slots.prefixInside &&
      slots.suffixInside &&
      slots.order,
    JSON.stringify(slots),
  );

  /* ---------- 原生 click 穿透 shadow（composed） ---------- */
  await page.locator('#cl-click').click();
  const clicks = await page.evaluate(() => window.__btnClicks ?? []);
  check(
    '原生 click 自带 composed，会穿透 shadow 冒到 document（不用自定义事件）',
    clicks.includes('cl-click'),
    JSON.stringify(clicks),
  );

  /* ---------- 键盘焦点环用 ring 令牌 ----------
     宿主不可聚焦，tab 序里的是 shadow 里的原生 button —— 先把焦点放进 kb-a 的原生 button，再按 Tab 走到 kb-b */
  await page.evaluate(() => {
    document.getElementById('kb-a').shadowRoot.querySelector('.mc-native').focus();
  });
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const native = document.getElementById('kb-b').shadowRoot.querySelector('.mc-native');
    const focused = document.getElementById('kb-b').shadowRoot.activeElement === native;
    return {
      focused,
      focusVisible: native.matches(':focus-visible'),
      outline: getComputedStyle(native).outlineColor,
      ring: getComputedStyle(document.documentElement).getPropertyValue('--mc-color-ring').trim(),
    };
  });
  const outlineRgb = (focus.outline.match(/\d+/g) ?? []).slice(0, 3).join(',');
  check(
    'Tab 聚焦：内部原生 button 拿到 :focus-visible，焦点环用 ring 令牌（不是 currentColor）',
    focus.focused && focus.focusVisible && outlineRgb === focus.ring.replace(/\s+/g, ','),
    JSON.stringify(focus),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('btn-probe')?.remove());
}
