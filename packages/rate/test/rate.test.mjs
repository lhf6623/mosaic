/**
 * mc-rate · 评分：默认未评分、value / default-value 两种初值、
 * value property 当次生效 + 区间夹紧 + 按 step 归一、
 * 点星（整星与半星的左右半边）、悬停预览只画不改值、键盘 Arrow / Home / End、
 * input / change 载荷 { value } 且穿透 shadow（原生 input 那条被拦掉）、
 * max 重建星条、disabled、尺寸三档、语义色 / hex 色槽、两个 part 与 ::part() 定制、
 * 焦点环、mc-form 集成。探针现搭现拆，跑法 node tests/smoke.mjs rate。
 */

export default async function run({ page, visit, check }) {
  /* rate 文档页：组件本体在页里 <l-m> 引入 */
  await visit(page, '/index.html?rate=1#/packages/rate/page.html');
  const pageRegistered = await page
    .waitForFunction(() => !!customElements.get('mc-rate'), { timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  /* 搭探针：一个固定容器装一排独立实例；鼠标动作量的是 item 的真实几何 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'rate-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-direction:column;gap:8px;width:420px';
    document.body.append(host);

    const put = (id, attrs = {}) => {
      const el = document.createElement('mc-rate');
      el.id = id;
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      host.append(el);
      return el;
    };

    put('rt-plain');
    put('rt-value', { value: '3' });
    put('rt-default', { 'default-value': '4' });
    put('rt-half', { 'allow-half': '', value: '2' });
    put('rt-key', { value: '2' });
    put('rt-key-half', { 'allow-half': '', value: '2' });
    put('rt-max', { value: '4' });
    put('rt-click', { value: '0' });
    put('rt-clear', { clearable: '', value: '3' });
    put('rt-no-clear', { value: '3' });
    put('rt-hover', { value: '2' });
    put('rt-disabled', { disabled: '', value: '2' });
    put('rt-sm', { size: 'sm' });
    put('rt-md');
    put('rt-lg', { size: 'lg' });
    put('rt-num', { size: '40' });
    put('rt-primary', { color: 'primary', value: '2' });
    put('rt-success', { color: 'success', value: '2' });
    put('rt-hex', { color: '#1a7f5a', value: '2' });
    put('rt-part', { value: '2' });
    put('rt-focus-a', { value: '1' });
    put('rt-focus-b', { value: '2' });

    /* document 级记账：既查载荷，也查「原生 input 那条有没有被拦掉」 */
    window.__rtEvents = [];
    for (const type of ['input', 'change']) {
      document.addEventListener(type, (event) => {
        window.__rtEvents.push({
          type,
          id: event.target?.id ?? '',
          data: event.data ?? null,
          composed: event.composed,
        });
      });
    }

    /* part 从页面侧真的改得动内部 */
    const style = document.createElement('style');
    style.id = 'rate-part-style';
    style.textContent =
      '#rt-part::part(item) { width: 30px; height: 30px; }' +
      '#rt-part::part(base) { padding: 7px 9px; }';
    document.head.append(style);
  });

  await page
    .waitForFunction(
      () => [...document.querySelectorAll('#rate-probe mc-rate')].every((el) => !!el.shadowRoot),
      { timeout: 5000 },
    )
    .catch(() => {});

  /* ---------- 语义：原生 range + 透明命中层，不写 role / aria ---------- */
  const semantics = await page.evaluate(() => {
    const el = document.getElementById('rt-plain');
    const root = el.shadowRoot;
    const input = root.querySelector('input');
    const base = root.querySelector('[part="base"]').getBoundingClientRect();
    const hit = input.getBoundingClientRect();
    const items = [...root.querySelectorAll('.mc-item')];
    return {
      tag: input.tagName,
      type: input.type,
      role: input.getAttribute('role'),
      aria: [...input.attributes].filter((a) => a.name.startsWith('aria-')).map((a) => a.name),
      pointerEvents: getComputedStyle(input).pointerEvents,
      opacity: getComputedStyle(input).opacity,
      coversBase:
        Math.abs(hit.left - base.left) <= 1 &&
        Math.abs(hit.top - base.top) <= 1 &&
        Math.abs(hit.width - base.width) <= 1 &&
        Math.abs(hit.height - base.height) <= 1,
      min: input.min,
      max: input.max,
      step: input.step,
      stars: items.length,
      fills: items.map((item) => item.getAttribute('data-fill')),
      parts: [...new Set([...root.querySelectorAll('[part]')].map((node) => node.getAttribute('part')))].sort(),
      hostH: Math.round(el.getBoundingClientRect().height),
      starW: Math.round(items[0]?.getBoundingClientRect().width ?? 0),
    };
  });
  check(
    '文档页注册 mc-rate；内部是原生 input[type=range]（pointer-events: none、不写 role / aria、透明铺满 base）；裸实例 5 颗星、min=0/max=5/step=1、全部 data-fill=empty',
    pageRegistered &&
      semantics.tag === 'INPUT' &&
      semantics.type === 'range' &&
      semantics.role === null &&
      semantics.aria.length === 0 &&
      semantics.pointerEvents === 'none' &&
      semantics.opacity === '0' &&
      semantics.coversBase &&
      semantics.min === '0' &&
      semantics.max === '5' &&
      semantics.step === '1' &&
      semantics.stars === 5 &&
      semantics.fills.every((fill) => fill === 'empty') &&
      JSON.stringify(semantics.parts) === JSON.stringify(['base', 'item']) &&
      semantics.hostH === 36 &&
      semantics.starW === 20,
    JSON.stringify({ pageRegistered, semantics }),
  );

  /* ---------- 初值：默认 0（未评分）；value / default-value 两种写法 ---------- */
  const initial = await page.evaluate(() => {
    const snap = (id) => {
      const el = document.getElementById(id);
      const input = el.shadowRoot.querySelector('input');
      return {
        prop: el.value,
        native: input.value,
        attr: el.getAttribute('value'),
        stars: el.shadowRoot.querySelectorAll('.mc-item').length,
        fills: [...el.shadowRoot.querySelectorAll('.mc-item')].map((item) => item.getAttribute('data-fill')),
      };
    };
    return { plain: snap('rt-plain'), value: snap('rt-value'), def: snap('rt-default') };
  });
  check(
    '初值：裸 <mc-rate> 是 0（未评分）、5 颗全空；value="3" 落到内部 range 且 value 属性同步；default-value="4" 只落内部值（不写 value 属性）',
    initial.plain.prop === 0 &&
      initial.plain.native === '0' &&
      initial.plain.attr === null &&
      initial.plain.stars === 5 &&
      initial.value.prop === 3 &&
      initial.value.native === '3' &&
      initial.value.attr === '3' &&
      JSON.stringify(initial.value.fills) === JSON.stringify(['full', 'full', 'full', 'empty', 'empty']) &&
      initial.def.prop === 4 &&
      initial.def.native === '4' &&
      initial.def.attr === null &&
      JSON.stringify(initial.def.fills) === JSON.stringify(['full', 'full', 'full', 'full', 'empty']),
    JSON.stringify(initial),
  );

  const lateDefault = await page.evaluate(async () => {
    const el = document.getElementById('rt-default');
    const before = el.value;
    el.setAttribute('default-value', '1');
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { before, after: el.value };
  });
  check(
    'default-value 只在挂载时读一次：挂载后再补属性不再生效（值仍是 4）',
    lateDefault.before === 4 && lateDefault.after === 4,
    JSON.stringify(lateDefault),
  );

  /* ---------- value property：写完当次就读得到 + 区间夹紧 + 按 step 归一 ---------- */
  const immediate = await page.evaluate(() => {
    const el = document.getElementById('rt-value');
    const input = el.shadowRoot.querySelector('input');
    const snap = () => ({ prop: el.value, native: input.value, attr: el.getAttribute('value') });
    el.value = 2.5; // step=1 时落在两档中间 → 3
    const tie = snap();
    el.value = 99;
    const high = snap();
    el.value = -5;
    const low = snap();
    return { tie, high, low };
  });
  check(
    'el.value 写完当次就读得到（property / 内部 range / value 属性同步，不 await）；超区间夹到 max / min（99→5、-5→0）；按 step 归一（step=1 时 2.5→3）',
    immediate.tie.prop === 3 &&
      immediate.tie.native === '3' &&
      immediate.tie.attr === '3' &&
      immediate.high.prop === 5 &&
      immediate.high.attr === '5' &&
      immediate.low.prop === 0 &&
      immediate.low.attr === '0',
    JSON.stringify(immediate),
  );

  const halfSetter = await page.evaluate(() => {
    const el = document.getElementById('rt-half');
    const input = el.shadowRoot.querySelector('input');
    const snap = () => ({ prop: el.value, native: input.value, attr: el.getAttribute('value') });
    el.value = 3.7;
    const snap37 = snap();
    el.value = 0.3;
    const snap03 = snap();
    el.value = 99;
    const high = snap();
    el.value = -5;
    const low = snap();
    return { step: input.step, snap37, snap03, high, low };
  });
  check(
    'allow-half 时内部 step=0.5，程序化写值按 0.5 归一（3.7→3.5、0.3→0.5），超区间照样夹到 max / min（99→5、-5→0）',
    halfSetter.step === '0.5' &&
      halfSetter.snap37.prop === 3.5 &&
      halfSetter.snap37.attr === '3.5' &&
      halfSetter.snap03.prop === 0.5 &&
      halfSetter.high.prop === 5 &&
      halfSetter.low.prop === 0,
    JSON.stringify(halfSetter),
  );

  /* ---------- 点星：点第几颗就是几分，发 input + change ---------- */
  const centersOf = (id) =>
    page.evaluate((target) => {
      const el = document.getElementById(target);
      return [...el.shadowRoot.querySelectorAll('.mc-item')].map((item) => {
        const rect = item.getBoundingClientRect();
        return { left: rect.left, width: rect.width, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
      });
    }, id);

  const pick = (id) =>
    page.evaluate((target) => {
      const el = document.getElementById(target);
      return {
        value: el.value,
        native: el.shadowRoot.querySelector('input').value,
        attr: el.getAttribute('value'),
        fills: [...el.shadowRoot.querySelectorAll('.mc-item')].map((item) => item.getAttribute('data-fill')),
        events: window.__rtEvents.splice(0),
      };
    }, id);

  const hasPayload = (action, id) => {
    const inputs = action.events.filter((event) => event.type === 'input');
    const changes = action.events.filter((event) => event.type === 'change');
    return (
      action.events.map((event) => event.type).join() === 'input,change' &&
      inputs.length === 1 &&
      changes.length === 1 &&
      inputs[0].id === id &&
      changes[0].id === id &&
      typeof inputs[0].data?.value === 'number' &&
      typeof changes[0].data?.value === 'number' &&
      inputs[0].data.value === action.value &&
      changes[0].data.value === action.value &&
      inputs[0].composed === true &&
      changes[0].composed === true
    );
  };

  const clickCenters = await centersOf('rt-click');
  await page.evaluate(() => {
    window.__rtEvents = [];
  });
  await page.mouse.click(clickCenters[2].cx, clickCenters[2].cy);
  await page.waitForTimeout(120);
  const clickThird = await pick('rt-click');
  await page.mouse.click(clickCenters[4].cx, clickCenters[4].cy);
  await page.waitForTimeout(120);
  const clickFifth = await pick('rt-click');
  check(
    '真实鼠标点第 3 / 5 颗星中心 → value=3 / 5，fills 前 3 / 5 颗 full；每个动作在 document 上恰好一条带 data 的 input + 一条 change（原生 input 被 stopPropagation），载荷 { value: number }、composed',
    clickThird.value === 3 &&
      clickThird.attr === '3' &&
      JSON.stringify(clickThird.fills) === JSON.stringify(['full', 'full', 'full', 'empty', 'empty']) &&
      hasPayload(clickThird, 'rt-click') &&
      clickFifth.value === 5 &&
      clickFifth.attr === '5' &&
      clickFifth.fills.every((fill) => fill === 'full') &&
      hasPayload(clickFifth, 'rt-click'),
    JSON.stringify({ clickThird, clickFifth }),
  );

  /* ---------- 快速取消：开了 clearable 再点当前分值所在的星 → 清回 0 ---------- */
  const clearCenters = await centersOf('rt-clear');
  await page.evaluate(() => {
    window.__rtEvents = [];
  });
  await page.mouse.click(clearCenters[2].cx, clearCenters[2].cy);
  await page.waitForTimeout(150);
  const cleared = await pick('rt-clear');

  const keepCenters = await centersOf('rt-no-clear');
  await page.evaluate(() => {
    window.__rtEvents = [];
  });
  await page.mouse.click(keepCenters[2].cx, keepCenters[2].cy);
  await page.waitForTimeout(150);
  const kept = await pick('rt-no-clear');

  check(
    '快速取消：clearable 下点当前分值所在的星 → 清回 0（fills 全 empty，恰好一条 input + 一条 change、载荷 0）；没开 clearable 时重复点同一颗星不变、也不发事件',
    cleared.value === 0 &&
      cleared.attr === '0' &&
      cleared.fills.every((fill) => fill === 'empty') &&
      hasPayload(cleared, 'rt-clear') &&
      kept.value === 3 &&
      kept.events.length === 0,
    JSON.stringify({ cleared, kept }),
  );

  /* ---------- 半星：点第 3 颗的左 / 右半边 ---------- */
  const halfCenters = await centersOf('rt-half');
  await page.evaluate(() => {
    window.__rtEvents = [];
  });
  await page.mouse.click(halfCenters[2].left + halfCenters[2].width * 0.25, halfCenters[2].cy);
  await page.waitForTimeout(120);
  const halfLeft = await pick('rt-half');
  await page.mouse.click(halfCenters[2].left + halfCenters[2].width * 0.75, halfCenters[2].cy);
  await page.waitForTimeout(120);
  const halfRight = await pick('rt-half');
  check(
    'allow-half：点第 3 颗左半边 → 2.5（data-fill = full/full/half/empty/empty），右半边 → 3（full/full/full/empty/empty）；两次都发 input + change',
    halfLeft.value === 2.5 &&
      halfLeft.attr === '2.5' &&
      JSON.stringify(halfLeft.fills) === JSON.stringify(['full', 'full', 'half', 'empty', 'empty']) &&
      hasPayload(halfLeft, 'rt-half') &&
      halfRight.value === 3 &&
      JSON.stringify(halfRight.fills) === JSON.stringify(['full', 'full', 'full', 'empty', 'empty']) &&
      hasPayload(halfRight, 'rt-half'),
    JSON.stringify({ halfLeft, halfRight }),
  );

  /* ---------- 悬停预览：只画、不改值、不发事件 ---------- */
  const hoverCenters = await centersOf('rt-hover');
  await page.evaluate(() => {
    window.__rtEvents = [];
  });
  await page.mouse.move(hoverCenters[3].cx, hoverCenters[3].cy);
  await page.waitForTimeout(120);
  const hover = await pick('rt-hover');
  await page.mouse.move(600, 500);
  await page.waitForTimeout(200);
  const hoverOut = await pick('rt-hover');
  check(
    '悬停预览：鼠标移到第 4 颗星上不点 → 前 4 颗 data-fill=full，但 value 仍是 2 且不发事件；移开后回到真实值（前 2 颗 full）',
    hover.value === 2 &&
      hover.events.length === 0 &&
      JSON.stringify(hover.fills) === JSON.stringify(['full', 'full', 'full', 'full', 'empty']) &&
      hoverOut.value === 2 &&
      hoverOut.events.length === 0 &&
      JSON.stringify(hoverOut.fills) === JSON.stringify(['full', 'full', 'empty', 'empty', 'empty']),
    JSON.stringify({ hover, hoverOut }),
  );

  /* ---------- 键盘：方向键按 step、End / Home 到两端 ---------- */
  const keyAction = async (id, key) => {
    await page.evaluate((target) => {
      window.__rtEvents = [];
      document.getElementById(target).shadowRoot.querySelector('input').focus();
    }, id);
    await page.keyboard.press(key);
    await page.waitForTimeout(100);
    return page.evaluate((target) => {
      const el = document.getElementById(target);
      return {
        id: target,
        value: el.value,
        native: el.shadowRoot.querySelector('input').value,
        events: window.__rtEvents.splice(0),
      };
    }, id);
  };
  const keyRight = await keyAction('rt-key', 'ArrowRight');
  const keyEnd = await keyAction('rt-key', 'End');
  const keyHome = await keyAction('rt-key', 'Home');
  const keyHalfRight = await keyAction('rt-key-half', 'ArrowRight');
  const keyHalfLeft = await keyAction('rt-key-half', 'ArrowLeft');
  check(
    '键盘：ArrowRight +1（2→3）、End 到 max（5）、Home 到 0；allow-half 时 ArrowRight / ArrowLeft 按 0.5 走（2↔2.5）；每次调整恰好一条 input + 一条 change',
    keyRight.value === 3 &&
      keyEnd.value === 5 &&
      keyHome.value === 0 &&
      keyHalfRight.value === 2.5 &&
      keyHalfLeft.value === 2 &&
      [keyRight, keyEnd, keyHome, keyHalfRight, keyHalfLeft].every((action) =>
        hasPayload(action, action.id),
      ),
    JSON.stringify({ keyRight, keyEnd, keyHome, keyHalfRight, keyHalfLeft }),
  );

  /* ---------- max：重建星条并把超上限的值夹回 ---------- */
  const maxBefore = await page.evaluate(() => {
    const el = document.getElementById('rt-max');
    const input = el.shadowRoot.querySelector('input');
    return {
      stars: el.shadowRoot.querySelectorAll('.mc-item').length,
      value: el.value,
      native: input.value,
      min: input.min,
      max: input.max,
    };
  });
  const maxSmaller = await page.evaluate(async () => {
    const el = document.getElementById('rt-max');
    el.setAttribute('max', '3');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const input = el.shadowRoot.querySelector('input');
    return {
      stars: el.shadowRoot.querySelectorAll('.mc-item').length,
      value: el.value,
      native: input.value,
      max: input.max,
      fills: [...el.shadowRoot.querySelectorAll('.mc-item')].map((item) => item.getAttribute('data-fill')),
    };
  });
  const maxBigger = await page.evaluate(async () => {
    const el = document.getElementById('rt-max');
    el.setAttribute('max', '8');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const input = el.shadowRoot.querySelector('input');
    return {
      stars: el.shadowRoot.querySelectorAll('.mc-item').length,
      value: el.value,
      native: input.value,
      max: input.max,
    };
  });
  check(
    '改 max 会重建星条并把超上限的值夹回：max 5→3 时星数 5→3、value 4→3；再改 8 时星数变 8、value 仍是 3；内部 range 的 max 跟着变',
    maxBefore.stars === 5 &&
      maxBefore.value === 4 &&
      maxBefore.max === '5' &&
      maxSmaller.stars === 3 &&
      maxSmaller.value === 3 &&
      maxSmaller.native === '3' &&
      maxSmaller.max === '3' &&
      JSON.stringify(maxSmaller.fills) === JSON.stringify(['full', 'full', 'full']) &&
      maxBigger.stars === 8 &&
      maxBigger.value === 3 &&
      maxBigger.max === '8',
    JSON.stringify({ maxBefore, maxSmaller, maxBigger }),
  );

  /* ---------- 尺寸：宿主高 / 星标直径三件套 ---------- */
  const sizes = await page.evaluate(() => {
    const read = (id) => {
      const el = document.getElementById(id);
      const item = el.shadowRoot.querySelector('.mc-item');
      return {
        size: el.getAttribute('size') ?? 'md',
        host: Math.round(el.getBoundingClientRect().height),
        starW: Math.round(item.getBoundingClientRect().width),
        starH: Math.round(item.getBoundingClientRect().height),
      };
    };
    return [read('rt-sm'), read('rt-md'), read('rt-lg')];
  });
  check(
    'size 三档：宿主高 28 / 36 / 44px、星标 16 / 20 / 24px 一起变',
    JSON.stringify(sizes) ===
      JSON.stringify([
        { size: 'sm', host: 28, starW: 16, starH: 16 },
        { size: 'md', host: 36, starW: 20, starH: 20 },
        { size: 'lg', host: 44, starW: 24, starH: 24 },
      ]),
    JSON.stringify(sizes),
  );

  /* ---------- 尺寸：数字按 px 写宿主令牌；切回档位内联令牌交还 CSS ---------- */
  const numericSize = await page.evaluate(async () => {
    const el = document.getElementById('rt-num');
    const read = () => {
      const item = el.shadowRoot.querySelector('.mc-item');
      return {
        host: Math.round(el.getBoundingClientRect().height),
        star: Math.round(item.getBoundingClientRect().width),
        token: el.style.getPropertyValue('--mc-rate-star').trim(),
      };
    };
    const num = read();
    el.setAttribute('size', 'sm');
    await new Promise((resolve) => setTimeout(resolve, 120));
    return { num, back: read() };
  });
  check(
    'size 收纯数字：size="40" → 星标直径 40px、宿主高 max(36, 40)=40px，宿主 style 上写 --mc-rate-star=40px；改回 size="sm" → 16 / 28 且内联令牌被移除',
    numericSize.num.star === 40 &&
      numericSize.num.host === 40 &&
      numericSize.num.token === '40px' &&
      numericSize.back.star === 16 &&
      numericSize.back.host === 28 &&
      numericSize.back.token === '',
    JSON.stringify(numericSize),
  );

  /* ---------- color：默认 warning，语义名走 CSS，hex 走共享接线器写 --mc-rate-fill ---------- */
  const colors = await page.evaluate(() => {
    const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const rgb = (name) => 'rgb(' + read(name).split(/\s+/).join(', ') + ')';
    const fillOf = (id) =>
      getComputedStyle(document.getElementById(id).shadowRoot.querySelector('.mc-on .mc-star path')).fill;
    const strokeOf = (id) =>
      getComputedStyle(document.getElementById(id).shadowRoot.querySelector('.mc-item > .mc-star path')).stroke;
    const inlineSlot = (id) => document.getElementById(id).style.getPropertyValue('--mc-rate-fill').trim();
    return {
      warning: rgb('--mc-color-warning'),
      success: rgb('--mc-color-success'),
      empty: rgb('--mc-color-border-strong'),
      defaultFill: fillOf('rt-md'),
      defaultStroke: strokeOf('rt-md'),
      successFill: fillOf('rt-success'),
      successSlot: inlineSlot('rt-success'),
      hexFill: fillOf('rt-hex'),
      hexSlot: inlineSlot('rt-hex'),
    };
  });
  check(
    'color：默认实心星 = --mc-color-warning（空星描边走 --mc-color-border-strong）；color="success" = --mc-color-success（语义名不写内联槽）；color="#1a7f5a" 由接线器把 --mc-rate-fill 写成 26 127 90',
    colors.defaultFill === colors.warning &&
      colors.defaultStroke === colors.empty &&
      colors.successFill === colors.success &&
      colors.successSlot === '' &&
      colors.hexFill === 'rgb(26, 127, 90)' &&
      colors.hexSlot.split(/\s+/).join(',') === '26,127,90',
    JSON.stringify(colors),
  );

  /* ---------- disabled：转发给原生 range，点不动 ---------- */
  const disabledCenters = await centersOf('rt-disabled');
  await page.evaluate(() => {
    window.__rtEvents = [];
  });
  await page.mouse.click(disabledCenters[3].cx, disabledCenters[3].cy);
  await page.waitForTimeout(150);
  const disabled = await page.evaluate(() => {
    const el = document.getElementById('rt-disabled');
    const input = el.shadowRoot.querySelector('input');
    return {
      nativeDisabled: input.disabled,
      opacity: getComputedStyle(el).opacity,
      cursor: getComputedStyle(el).cursor,
      baseCursor: getComputedStyle(el.shadowRoot.querySelector('[part="base"]')).cursor,
      value: el.value,
      events: window.__rtEvents.splice(0),
    };
  });
  check(
    'disabled 转发给内部原生 range：点不动、光标 not-allowed、宿主 opacity 0.5、不发 input / change',
    disabled.nativeDisabled === true &&
      disabled.opacity === '0.5' &&
      disabled.cursor === 'not-allowed' &&
      disabled.baseCursor === 'not-allowed' &&
      disabled.value === 2 &&
      disabled.events.length === 0,
    JSON.stringify(disabled),
  );

  /* ---------- part：base / item 都在，::part() 改得动 ---------- */
  const parts = await page.evaluate(() => {
    const root = document.getElementById('rt-part').shadowRoot;
    const base = root.querySelector('[part="base"]');
    const item = root.querySelector('[part="item"]');
    const baseStyle = getComputedStyle(base);
    return {
      base: !!base,
      item: !!item,
      itemCount: root.querySelectorAll('[part="item"]').length,
      itemW: item.getBoundingClientRect().width,
      itemH: item.getBoundingClientRect().height,
      paddingLeft: baseStyle.paddingLeft,
      paddingTop: baseStyle.paddingTop,
    };
  });
  check(
    'part="base" / "item" 都在（item 颗数跟着 max）；::part(item) 改成 30×30、::part(base) 改内边距 7px 9px 都生效',
    parts.base &&
      parts.item &&
      parts.itemCount === 5 &&
      parts.itemW === 30 &&
      parts.itemH === 30 &&
      parts.paddingLeft === '9px' &&
      parts.paddingTop === '7px',
    JSON.stringify(parts),
  );

  /* ---------- 焦点环：用 ring 令牌画在那一排星上 ---------- */
  await page.evaluate(() => {
    document.getElementById('rt-focus-a').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.getElementById('rt-focus-b');
    const root = el.shadowRoot;
    const input = root.querySelector('input');
    const items = getComputedStyle(root.querySelector('.mc-items'));
    const ring = getComputedStyle(document.documentElement)
      .getPropertyValue('--mc-color-ring')
      .trim()
      .split(/\s+/)
      .join(',');
    return {
      active: root.activeElement === input,
      focusVisible: input.matches(':focus-visible'),
      outlineColor: (items.outlineColor.match(/\d+/g) ?? []).slice(0, 3).join(','),
      outlineStyle: items.outlineStyle,
      outlineWidth: items.outlineWidth,
      ring,
    };
  });
  check(
    'Tab 到 rate：焦点落在内部原生 range 上，焦点环画在那一排星上、颜色取 --mc-color-ring（2px solid，不是 currentColor）',
    focus.active &&
      focus.focusVisible &&
      focus.outlineColor === focus.ring &&
      focus.outlineStyle === 'solid' &&
      focus.outlineWidth === '2px',
    JSON.stringify(focus),
  );

  /* ---------- mc-form 集成：值按字符串收 ----------
     rate 文档页没有注册 mc-form，这里自己用 <l-m> 引来（同页面注册组件的方式），不依赖演示区。 */
  await page.evaluate(() => {
    for (const src of ['/packages/form/form.html', '/packages/form/form-item.html']) {
      const loader = document.createElement('l-m');
      loader.setAttribute('src', src);
      document.body.append(loader);
    }
  });
  await page
    .waitForFunction(() => !!customElements.get('mc-form') && !!customElements.get('mc-form-item'), {
      timeout: 10000,
    })
    .catch(() => {});
  const form = await page.evaluate(async () => {
    const el = document.createElement('mc-form');
    el.innerHTML = '<mc-form-item name="x"><mc-rate default-value="4"></mc-rate></mc-form-item>';
    document.body.append(el);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const rate = el.querySelector('mc-rate');
    const before = { collected: el.getValue(), rate: rate.value };
    rate.value = 2;
    const after = { collected: el.getValue(), rate: rate.value };
    el.remove();
    return { before, after };
  });
  check(
    'mc-form 集成：rate 的值按字符串收（default-value="4" → getValue().x === "4"，改成 2 后 === "2"）',
    form.before.rate === 4 &&
      form.before.collected.x === '4' &&
      form.after.rate === 2 &&
      form.after.collected.x === '2',
    JSON.stringify(form),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => {
    document.getElementById('rate-probe')?.remove();
    document.getElementById('rate-part-style')?.remove();
  });
}
