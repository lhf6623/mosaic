/** mc-button：语义色 × 外观 × 尺寸、状态、插槽、原生点击穿透；探针按钮现搭现拆，跑法 node tests/smoke.mjs button。 */

export default async function run({ page, visit, check }) {
  /* 按钮文档页：组件与令牌都就位（组件本体在 docs/layout 之外的页里 <l-m> 引入） */
  await visit(page, '/index.html?button=1#/packages/button/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-button'), { timeout: 8000 })
    .catch(() => {});
  /* 插槽探针用的是 mc-icon（站点外壳在 layout.html 里全局注册）—— 等它升级完再搭探针，
     否则未升级的自定义元素是 0 宽，位置/顺序断言会假红 */
  await page.waitForFunction(() => !!customElements.get('mc-icon'), { timeout: 8000 }).catch(() => {});

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
      'row-hex',
      'row-sizes',
      'row-inline',
      'row-aria',
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

    /* color 也能直接给 hex：语义名走 CSS，hex 走 color-attr（见 packages/boot/color-attr.js）。
       hex-bad 用的不是 hex → 只该有一条控制台警告，一个槽都不写 */
    put('row-hex', 'hex-filled', { color: '#fff000' });
    put('row-hex', 'hex-outline', { variant: 'outline', color: '#fff000' });
    put('row-hex', 'hex-short', { color: '#fc0' });
    put('row-hex', 'hex-bad', { color: 'notahex' });

    put('row-sizes', 's-sm', { size: 'sm' });
    put('row-sizes', 's-md', {});
    put('row-sizes', 's-lg', { size: 'lg' });

    put('row-inline', 'in-sm', { variant: 'ghost', inline: true, size: 'sm' }, '小字');
    put('row-inline', 'in-md', { variant: 'ghost', inline: true }, '常规');
    put('row-inline', 'in-lg', { variant: 'ghost', inline: true, size: 'lg' }, '大字');
    put('row-inline', 'in-plain', { variant: 'ghost' }, '对照');

    put('row-aria', 'ar-forward', {}, '转发');

    put('row-states', 'st-default', {});
    put('row-states', 'st-disabled', { disabled: true, id: 'st-disabled' });
    put('row-states', 'st-loading', { loading: true });
    put('row-states', 'st-submit', { type: 'submit' });

    put('row-slots', 'sl-slots', {}, '');
    document.getElementById('sl-slots').innerHTML =
      '<mc-icon slot="prefix" id="sl-prefix" name="search"></mc-icon>搜索' +
      '<mc-icon slot="suffix" id="sl-suffix" name="arrow-right"></mc-icon>';

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

  /* ---------- color 收 hex：三个槽 + 自动文字色；非法值不写槽、不降级 ---------- */
  const hex = await page.evaluate(async () => {
    const rgbOf = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).join(',');
    const cs = (id) => getComputedStyle(document.getElementById(id));
    const inline = (id) => document.getElementById(id).style.cssText;
    const snap = {
      filled: { bg: rgbOf(cs('hex-filled').backgroundColor), fg: rgbOf(cs('hex-filled').color) },
      outline: {
        bg: rgbOf(cs('hex-outline').backgroundColor),
        fg: rgbOf(cs('hex-outline').color),
        border: rgbOf(cs('hex-outline').borderTopColor),
      },
      short: { bg: rgbOf(cs('hex-short').backgroundColor), fg: rgbOf(cs('hex-short').color) },
      bad: { inline: inline('hex-bad'), bg: rgbOf(cs('hex-bad').backgroundColor) },
      primary: getComputedStyle(document.documentElement)
        .getPropertyValue('--mc-color-primary')
        .trim()
        .replace(/\s+/g, ','),
    };

    /* 运行时改回语义名：我们写过的槽必须清干净，交回 CSS */
    const el = document.getElementById('hex-filled');
    el.setAttribute('color', 'danger');
    await new Promise((r) => setTimeout(r, 80));
    snap.afterBackToSemantic = {
      inline: el.style.cssText,
      bg: rgbOf(getComputedStyle(el).backgroundColor),
      danger: getComputedStyle(document.documentElement)
        .getPropertyValue('--mc-color-danger')
        .trim()
        .replace(/\s+/g, ','),
    };
    return snap;
  });
  check(
    'color 收 hex：filled / outline 两个槽都跟上，三位 hex 也认，文字色按对比度自动给（#fff000 → 黑字）',
    hex.filled.bg === '255,240,0' &&
      hex.filled.fg === '0,0,0' &&
      hex.outline.bg === '0,0,0' &&
      hex.outline.fg === '255,240,0' &&
      hex.outline.border === '255,240,0' &&
      hex.short.bg === '255,204,0' &&
      hex.short.fg === '0,0,0',
    JSON.stringify(hex),
  );
  check(
    'color 收 hex：非法值一个槽都不写（保持 CSS 默认），改回语义名时把写过的槽清干净',
    hex.bad.inline === '' &&
      hex.bad.bg === hex.primary &&
      hex.afterBackToSemantic.inline === '' &&
      hex.afterBackToSemantic.bg === hex.afterBackToSemantic.danger,
    JSON.stringify({ bad: hex.bad, after: hex.afterBackToSemantic }),
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

  /* ---------- inline 形态：盒子交给文字，size 只选字号 ---------- */
  const inline = await page.evaluate(() => {
    const row = (id) => {
      const el = document.getElementById(id);
      const cs = getComputedStyle(el);
      return {
        高: Math.round(el.getBoundingClientRect().height),
        字: parseFloat(cs.fontSize),
        左内边距: parseFloat(cs.paddingLeft),
        行高: Math.round(parseFloat(cs.lineHeight)),
        对齐: cs.verticalAlign,
      };
    };
    return { sm: row('in-sm'), md: row('in-md'), lg: row('in-lg'), plain: row('in-plain') };
  });
  check(
    'inline 形态：盒子交给文字（无控制高度 / 左右无内边距），size 只换字号与配对行高',
    inline.sm.左内边距 === 0 &&
      inline.md.左内边距 === 0 &&
      inline.lg.左内边距 === 0 &&
      inline.sm.字 === 12 &&
      inline.md.字 === 14 &&
      inline.lg.字 === 16 &&
      inline.md.行高 === 20 &&
      inline.sm.行高 === 16 &&
      inline.lg.行高 === 24 &&
      inline.md.高 < inline.plain.高 &&
      Math.abs(inline.sm.高 - inline.lg.高) <= 1 &&
      inline.md.对齐 === 'baseline',
    JSON.stringify(inline),
  );
  check(
    'inline 的命中区凑到 24px（行高 + 上下透明内边距，WCAG 2.5.8）',
    inline.sm.高 >= 24 && inline.md.高 >= 24 && inline.lg.高 >= 24,
    `sm ${inline.sm.高} · md ${inline.md.高} · lg ${inline.lg.高}`
  );
  /* ⚠️ 这里用显式坐标 mouse.move，不用 page.hover(selector)：探针挂在 fixed 的宿主里，
     page.hover 的可交互检查在并行满载时会判定「收不到事件」而把鼠标停在别处 ——
     实测 isHover=false、叠层 opacity 读到 0（假红）。 */
  const inlineAt = await page.evaluate(() => {
    const r = document.getElementById('in-md').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(inlineAt.x, inlineAt.y);
  await page.waitForTimeout(250); // 叠层有 transition，等它走完再读
  const inlineHover = await page.evaluate(() => {
    const el = document.getElementById('in-md');
    const layer = el.shadowRoot.querySelector('.mc-layer');
    return {
      悬停中: el.matches(':hover'),
      下划线: getComputedStyle(el).textDecorationLine,
      叠层透明度: getComputedStyle(layer).opacity,
      叠层左: parseFloat(getComputedStyle(layer).left),
    };
  });
  check(
    'inline 悬停走按钮那套 state layer（不是下划线 —— 是按钮不是链接），叠层左右外扩',
    inlineHover.悬停中 &&
      inlineHover.下划线 === 'none' &&
      inlineHover.叠层透明度 === '0.08' &&
      inlineHover.叠层左 < 0,
    JSON.stringify(inlineHover),
  );

  /* ---------- 无障碍名：可见文字是插槽内容，与原生 button 是兄弟 ---------- */
  const axSession = await page.context().newCDPSession(page);
  await axSession.send('Accessibility.enable');
  const { nodes: axNodes } = await axSession.send('Accessibility.getFullAXTree');
  await axSession.detach();
  const axButtons = axNodes
    .filter((n) => n.role?.value === 'button' && !n.ignored)
    .map((n) => n.name?.value ?? '');
  check(
    '无障碍名：插槽里的文字真正成为原生 button 的名字（修之前 40 个按钮 39 个无名）',
    axButtons.length > 0 &&
      axButtons.every((name) => name) &&
      axButtons.includes('按钮') &&
      axButtons.includes('A'),
    `命名 ${axButtons.filter((n) => n).length}/${axButtons.length} · 例：${[...new Set(axButtons)].slice(0, 6).join(' / ')}`,
  );

  /* ---------- aria 转发：宿主上的 aria-* 要落到内部那个原生 button 上 ---------- */
  const ariaFwd = await page.evaluate(async () => {
    const b = document.getElementById('ar-forward');
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'true');
    b.setAttribute('aria-current', 'page');
    await new Promise((r) => setTimeout(r, 60));
    const native = b.shadowRoot.querySelector('.mc-native');
    const before = {
      haspopup: native.getAttribute('aria-haspopup'),
      expanded: native.getAttribute('aria-expanded'),
      current: native.getAttribute('aria-current'),
      labelledby: native.getAttribute('aria-labelledby'),
    };
    b.setAttribute('aria-label', '显式名字');
    await new Promise((r) => setTimeout(r, 60));
    const after = { label: native.getAttribute('aria-label'), labelledby: native.getAttribute('aria-labelledby') };
    return { before, after };
  });
  check(
    '宿主上的 aria-* 转发给内部原生 button（无障碍节点是它，写在宿主上它看不到）',
    ariaFwd.before.haspopup === 'menu' &&
      ariaFwd.before.expanded === 'true' &&
      ariaFwd.before.current === 'page',
    JSON.stringify(ariaFwd.before),
  );
  check(
    '宿主显式给了 aria-label 就用它（并摘掉模板上的 aria-labelledby，否则按优先级它仍然赢）',
    ariaFwd.after.label === '显式名字' && ariaFwd.after.labelledby === 'mc-btn-label',
    JSON.stringify(ariaFwd.after),
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
    const button = document.getElementById('sl-slots');
    const box = (el) => el.getBoundingClientRect();
    return {
      // 宿主是 inline-flex，插槽元素被块级化成 flex —— flex / inline-flex 都算对
      prefixDisplay: getComputedStyle(prefix).display,
      suffixDisplay: getComputedStyle(suffix).display,
      prefixInside: box(prefix).left >= host.left - 1 && box(prefix).right <= host.right + 1,
      suffixInside: box(suffix).right <= host.right + 1,
      order: box(prefix).left < box(suffix).left,
      /* 图标特调：按钮里的图标比文字大一档，且颜色必须跟按钮文字色（不靠碰巧继承） */
      labelFontSize: getComputedStyle(button).fontSize,
      labelColor: getComputedStyle(button).color,
      iconFontSize: getComputedStyle(prefix).fontSize,
      iconColor: getComputedStyle(prefix).color,
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
  check(
    '按钮里的图标特调：比文字大一档（--mc-button-icon-size），颜色跟按钮文字色一致',
    parseFloat(slots.iconFontSize) > parseFloat(slots.labelFontSize) &&
      slots.iconColor === slots.labelColor,
    `文字 ${slots.labelFontSize}/${slots.labelColor} · 图标 ${slots.iconFontSize}/${slots.iconColor}`,
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
