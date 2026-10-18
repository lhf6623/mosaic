/**
 * mc-slider · 滑动选择：默认值落 min、value / default-value 两种初值、
 * value property 当次生效与区间夹紧、step 转发、键盘方向键 / Home / End、
 * input / change 载荷 { value } 且穿透 shadow（原生 input 那条被拦掉）、
 * 鼠标点轨道改值、disabled 转发、尺寸三档、语义色 / hex 色槽、
 * 滑块与填充几何、四个 part 与 ::part() 定制、焦点环、mc-form 集成。
 * 探针现搭现拆，跑法 node tests/smoke.mjs slider。
 */

export default async function run({ page, visit, check }) {
  /* slider 文档页：组件本体在页里 <l-m> 引入 */
  await visit(page, '/index.html?slider=1#/packages/slider/page.html');
  const pageRegistered = await page
    .waitForFunction(() => !!customElements.get('mc-slider'), { timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  /* 搭探针：量几何的实例把 --mc-duration-* 压成 0ms —— 不跟过渡动画赛跑 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'slider-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-direction:column;gap:8px;width:420px';
    document.body.append(host);

    const instant =
      'width:300px;--mc-duration-base:0ms;--mc-duration-fast:0ms;--mc-duration-slow:0ms';
    const put = (id, attrs = {}) => {
      const el = document.createElement('mc-slider');
      el.id = id;
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      el.setAttribute('style', instant);
      host.append(el);
      return el;
    };

    put('sl-plain');
    put('sl-value', { value: '30' });
    put('sl-default', { 'default-value': '60' });
    put('sl-range', { min: '10', max: '90', step: '10' });
    put('sl-key', { value: '30', step: '10' });
    put('sl-step', { value: '37', step: '10' });
    put('sl-step-default', { 'default-value': '37', step: '10' });
    put('sl-geo-min', { value: '0' });
    put('sl-geo-half', { value: '50' });
    put('sl-geo-max', { value: '100' });
    put('sl-disabled', { disabled: '', value: '20' });
    put('sl-sm', { size: 'sm' });
    put('sl-md');
    put('sl-lg', { size: 'lg' });
    put('sl-primary', { value: '50' });
    put('sl-success', { color: 'success', value: '50' });
    put('sl-hex', { color: '#1a7f5a', value: '50' });
    put('sl-part', { value: '50' });
    put('sl-focus-a', { value: '20' });
    put('sl-focus-b', { value: '50' });

    /* document 级记账：既查载荷，也查「原生 input 那条有没有被拦掉」 */
    window.__slEvents = [];
    for (const type of ['input', 'change']) {
      document.addEventListener(type, (event) => {
        window.__slEvents.push({
          type,
          id: event.target?.id ?? '',
          data: event.data ?? null,
          composed: event.composed,
        });
      });
    }

    /* part 从页面侧真的改得动内部（外层 ::part 规则优先于 shadow 内样式） */
    const style = document.createElement('style');
    style.id = 'slider-part-style';
    style.textContent =
      '#sl-part::part(track) { height: 10px; background-color: rgb(1, 2, 3); }' +
      '#sl-part::part(thumb) { border-radius: 2px; }' +
      '#sl-part::part(fill) { background-color: rgb(4, 5, 6); }';
    document.head.append(style);
  });

  await page
    .waitForFunction(
      () => [...document.querySelectorAll('#slider-probe mc-slider')].every((el) => !!el.shadowRoot),
      { timeout: 5000 },
    )
    .catch(() => {});

  /* ---------- 语义：原生 range + 透明命中层，不写 role / aria ---------- */
  const semantics = await page.evaluate(() => {
    const el = document.getElementById('sl-plain');
    const root = el.shadowRoot;
    const input = root.querySelector('input');
    const base = root.querySelector('[part="base"]').getBoundingClientRect();
    const hit = input.getBoundingClientRect();
    return {
      tag: input.tagName,
      type: input.type,
      role: input.getAttribute('role'),
      aria: [...input.attributes].filter((a) => a.name.startsWith('aria-')).map((a) => a.name),
      opacity: getComputedStyle(input).opacity,
      coversRow:
        Math.abs(hit.left - base.left) <= 1 &&
        Math.abs(hit.top - base.top) <= 1 &&
        Math.abs(hit.width - base.width) <= 1 &&
        Math.abs(hit.height - base.height) <= 1,
      parts: [...root.querySelectorAll('[part]')].map((node) => node.getAttribute('part')).sort(),
    };
  });
  check(
    '文档页注册 mc-slider；内部是原生 input[type=range]、不写 role / aria；透明 input 铺满整行当命中区',
    pageRegistered &&
      semantics.tag === 'INPUT' &&
      semantics.type === 'range' &&
      semantics.role === null &&
      semantics.aria.length === 0 &&
      semantics.opacity === '0' &&
      semantics.coversRow &&
      JSON.stringify(semantics.parts) === JSON.stringify(['base', 'fill', 'thumb', 'track']),
    JSON.stringify({ pageRegistered, semantics }),
  );

  /* ---------- 初值：默认落 min；value 属性 / default-value 两种写法 ---------- */
  const initial = await page.evaluate(() => {
    const snap = (id) => {
      const el = document.getElementById(id);
      const input = el.shadowRoot.querySelector('input');
      return {
        prop: el.value,
        native: Number(input.value),
        attr: el.getAttribute('value'),
        min: input.min,
        max: input.max,
        step: input.step,
      };
    };
    return {
      plain: snap('sl-plain'),
      value: snap('sl-value'),
      def: snap('sl-default'),
      range: snap('sl-range'),
    };
  });
  check(
    '默认值 = min：裸 <mc-slider> 是 0、min="10" 时是 10（不是原生 range 的中点 50）；value / default-value 两种初值都落到内部 input',
    initial.plain.prop === 0 &&
      initial.plain.native === 0 &&
      initial.plain.min === '0' &&
      initial.value.prop === 30 &&
      initial.value.native === 30 &&
      initial.value.attr === '30' &&
      initial.def.prop === 60 &&
      initial.def.native === 60 &&
      initial.def.attr === null &&
      initial.range.prop === 10 &&
      initial.range.native === 10 &&
      initial.range.min === '10' &&
      initial.range.max === '90' &&
      initial.range.step === '10',
    JSON.stringify(initial),
  );

  const lateDefault = await page.evaluate(async () => {
    const el = document.getElementById('sl-default');
    const before = el.value;
    el.setAttribute('default-value', '10');
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { before, after: el.value };
  });
  check(
    'default-value 只在挂载时读一次：挂载后再补属性不再生效（值仍是 60）',
    lateDefault.before === 60 && lateDefault.after === 60,
    JSON.stringify(lateDefault),
  );

  /* ---------- value property：写完当次就读得到 + 区间夹紧 ---------- */
  const immediate = await page.evaluate(() => {
    const el = document.getElementById('sl-value');
    const input = el.shadowRoot.querySelector('input');
    const snap = () => ({ prop: el.value, native: input.value, attr: el.getAttribute('value') });
    el.value = 40;
    const mid = snap();
    el.value = 999;
    const high = snap();
    el.value = -5;
    const low = snap();
    return { mid, high, low };
  });
  check(
    'el.value 写完当次就读得到（property / 内部原生 input 同步，不 await）；超区间夹到 max / min（999→100、-5→0）',
    immediate.mid.prop === 40 &&
      immediate.mid.native === '40' &&
      immediate.mid.attr === '40' &&
      immediate.high.prop === 100 &&
      immediate.low.prop === 0,
    JSON.stringify(immediate),
  );

  /* ---------- value 属性也是绑定通道：运行时改属性立刻铺下去并重绘填充 ---------- */
  const bound = await page.evaluate(async () => {
    const el = document.getElementById('sl-value');
    el.setAttribute('value', '80');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const track = el.shadowRoot.querySelector('[part="track"]').getBoundingClientRect();
    const thumb = el.shadowRoot.querySelector('[part="thumb"]').getBoundingClientRect();
    const fill = el.shadowRoot.querySelector('[part="fill"]').getBoundingClientRect();
    return {
      prop: el.value,
      fill: Math.round(fill.width * 10) / 10,
      want: Math.round(((track.width - thumb.width) * 0.8 + thumb.width / 2) * 10) / 10,
    };
  });
  check(
    'value 是绑定通道：运行时 setAttribute("value", 80) 立刻铺到内部 input 并把填充重绘到 80% 的比例',
    bound.prop === 80 && Math.abs(bound.fill - bound.want) <= 0.5,
    JSON.stringify(bound),
  );

  /* ---------- min / max / step 转发 + 改 max 夹回当前值 ---------- */
  const range = await page.evaluate(async () => {
    const el = document.getElementById('sl-range');
    el.value = 70;
    const before = el.value;
    el.setAttribute('max', '50');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const after = el.value;
    el.setAttribute('step', '5');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const input = el.shadowRoot.querySelector('input');
    return { before, after, nativeMax: input.max, nativeStep: input.step, nativeValue: input.value };
  });
  check(
    '改 max 后当前值被夹回区间（70 → 50）；min / max / step 都转发到内部原生 input',
    range.before === 70 &&
      range.after === 50 &&
      range.nativeMax === '50' &&
      range.nativeStep === '5' &&
      range.nativeValue === '50',
    JSON.stringify(range),
  );

  /* ---------- 程序化写值也按 step 归一，归一后 value 属性被同步成实际值 ---------- */
  const stepMount = await page.evaluate(() => {
    const el = document.getElementById('sl-step');
    const numeric = {
      prop: el.value,
      native: el.shadowRoot.querySelector('input').value,
      attr: el.getAttribute('value'),
    };
    el.value = 37;
    const written = {
      prop: el.value,
      native: el.shadowRoot.querySelector('input').value,
      attr: el.getAttribute('value'),
    };
    const fromDefault = document.getElementById('sl-step-default');
    return {
      numeric,
      written,
      fromDefault: {
        prop: fromDefault.value,
        native: fromDefault.shadowRoot.querySelector('input').value,
        attr: fromDefault.getAttribute('value'),
      },
    };
  });
  await page.evaluate(() => {
    document.getElementById('sl-step').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('ArrowRight');
  const stepUp = await page.evaluate(() => document.getElementById('sl-step').value);
  await page.keyboard.press('ArrowLeft');
  const stepDown = await page.evaluate(() => document.getElementById('sl-step').value);
  check(
    '程序化写值也按 step 归一（value="37" / default-value="37" 配 step="10" 都落到 40）且宿主 value 属性同步成 "40"；键盘再按 step 走（→50→40）',
    stepMount.numeric.prop === 40 &&
      stepMount.numeric.native === '40' &&
      stepMount.numeric.attr === '40' &&
      stepMount.written.prop === 40 &&
      stepMount.written.native === '40' &&
      stepMount.written.attr === '40' &&
      stepMount.fromDefault.prop === 40 &&
      stepMount.fromDefault.native === '40' &&
      stepMount.fromDefault.attr === null &&
      stepUp === 50 &&
      stepDown === 40,
    JSON.stringify({ ...stepMount, stepUp, stepDown }),
  );

  /* ---------- 键盘：方向键按 step、End / Home 到两端 ---------- */
  await page.evaluate(() => {
    window.__slEvents = [];
    document.getElementById('sl-key').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('ArrowRight');
  const arrow = await page.evaluate(() => ({
    value: document.getElementById('sl-key').value,
    events: window.__slEvents.splice(0),
  }));
  await page.keyboard.press('End');
  const end = await page.evaluate(() => ({
    value: document.getElementById('sl-key').value,
    events: window.__slEvents.splice(0),
  }));
  await page.keyboard.press('Home');
  const home = await page.evaluate(() => ({
    value: document.getElementById('sl-key').value,
    events: window.__slEvents.splice(0),
  }));
  check(
    '键盘：ArrowRight 按 step 增加（30→40）、End 到 max（100）、Home 到 min（0）',
    arrow.value === 40 && end.value === 100 && home.value === 0,
    JSON.stringify({ arrow: arrow.value, end: end.value, home: home.value }),
  );

  /* ---------- 事件：每条动作恰好一条带 data 的 input + 一条 change ---------- */
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
  check(
    '键盘每次调整恰好发一条带 data 的 input + 一条 change（原生 input 那条被 stopPropagation），载荷 { value: number }、composed 穿透到 document',
    [arrow, end, home].every((action) => hasPayload(action, 'sl-key')),
    JSON.stringify({ arrow: arrow.events, end: end.events, home: home.events }),
  );

  await page.evaluate(() => {
    window.__slEvents = [];
  });
  const plainBox = await page.locator('#sl-plain').boundingBox();
  await page.mouse.click(plainBox.x + plainBox.width * 0.75, plainBox.y + plainBox.height / 2);
  await page.waitForTimeout(120);
  const mouse = await page.evaluate(() => ({
    value: document.getElementById('sl-plain').value,
    events: window.__slEvents.splice(0),
  }));
  check(
    '鼠标在轨道 75% 处点一下会改值（≈76）并发 input / change，载荷同为 { value }',
    mouse.value >= 70 && mouse.value <= 80 && hasPayload(mouse, 'sl-plain'),
    JSON.stringify(mouse),
  );

  /* ---------- disabled：转发给原生 input，点不动 ---------- */
  const disabledBox = await page.locator('#sl-disabled').boundingBox();
  await page.evaluate(() => {
    window.__slEvents = [];
  });
  await page.mouse.click(disabledBox.x + disabledBox.width / 2, disabledBox.y + disabledBox.height / 2);
  await page.waitForTimeout(150);
  const disabled = await page.evaluate(() => {
    const el = document.getElementById('sl-disabled');
    const input = el.shadowRoot.querySelector('input');
    return {
      nativeDisabled: input.disabled,
      cursor: getComputedStyle(el).cursor,
      inputCursor: getComputedStyle(input).cursor,
      opacity: getComputedStyle(el).opacity,
      value: el.value,
      events: window.__slEvents.splice(0),
    };
  });
  check(
    'disabled 转发给内部原生 input：点不动、光标 not-allowed、宿主 opacity 0.5、不发 input / change',
    disabled.nativeDisabled === true &&
      disabled.cursor === 'not-allowed' &&
      disabled.inputCursor === 'not-allowed' &&
      disabled.opacity === '0.5' &&
      disabled.value === 20 &&
      disabled.events.length === 0,
    JSON.stringify(disabled),
  );

  /* ---------- 尺寸：宿主高 / 轨道高 / 滑块直径三件套 ---------- */
  const sizes = await page.evaluate(() => {
    const read = (id) => {
      const el = document.getElementById(id);
      const root = el.shadowRoot;
      return {
        size: el.getAttribute('size') ?? 'md',
        host: Math.round(el.getBoundingClientRect().height),
        track: Math.round(root.querySelector('[part="track"]').getBoundingClientRect().height),
        thumb: Math.round(root.querySelector('[part="thumb"]').getBoundingClientRect().height),
      };
    };
    return [read('sl-sm'), read('sl-md'), read('sl-lg')];
  });
  check(
    'size 三档：宿主高 28 / 36 / 44px、轨道高 4 / 6 / 8px、滑块直径 12 / 16 / 20px 一起变',
    JSON.stringify(sizes) ===
      JSON.stringify([
        { size: 'sm', host: 28, track: 4, thumb: 12 },
        { size: 'md', host: 36, track: 6, thumb: 16 },
        { size: 'lg', host: 44, track: 8, thumb: 20 },
      ]),
    JSON.stringify(sizes),
  );

  /* ---------- color：语义名走 CSS，hex 走共享接线器写色槽 ---------- */
  const colors = await page.evaluate(() => {
    const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const rgb = (name) => 'rgb(' + read(name).split(/\s+/).join(', ') + ')';
    const fillBg = (id) =>
      getComputedStyle(document.getElementById(id).shadowRoot.querySelector('[part="fill"]'))
        .backgroundColor;
    const inlineSlot = (id) =>
      document.getElementById(id).style.getPropertyValue('--mc-slider-fill').trim();
    return {
      primary: rgb('--mc-color-primary'),
      success: rgb('--mc-color-success'),
      defaultFill: fillBg('sl-primary'),
      successFill: fillBg('sl-success'),
      successSlot: inlineSlot('sl-success'),
      hexFill: fillBg('sl-hex'),
      hexSlot: inlineSlot('sl-hex'),
    };
  });
  check(
    'color：默认填充 = --mc-color-primary；color="success" = --mc-color-success（语义名不写内联槽）；color="#1a7f5a" 由接线器把 --mc-slider-fill 写成 26 127 90',
    colors.defaultFill === colors.primary &&
      colors.successFill === colors.success &&
      colors.successSlot === '' &&
      colors.hexFill === 'rgb(26, 127, 90)' &&
      colors.hexSlot.split(/\s+/).join(',') === '26,127,90',
    JSON.stringify(colors),
  );

  /* ---------- 几何：滑块两端贴边、50% 居中、填充条到滑块中心 ---------- */
  const geometry = await page.evaluate(() => {
    const read = (id) => {
      const el = document.getElementById(id);
      const root = el.shadowRoot;
      const track = root.querySelector('[part="track"]').getBoundingClientRect();
      const thumb = root.querySelector('[part="thumb"]').getBoundingClientRect();
      const fill = root.querySelector('[part="fill"]').getBoundingClientRect();
      const n = (value) => Math.round(value * 100) / 100;
      return {
        value: el.value,
        track: { left: n(track.left), right: n(track.right), width: n(track.width) },
        thumb: {
          left: n(thumb.left),
          right: n(thumb.right),
          center: n(thumb.left + thumb.width / 2),
        },
        fill: { width: n(fill.width), right: n(fill.right) },
        inside: thumb.left >= track.left - 0.5 && thumb.right <= track.right + 0.5,
      };
    };
    return { min: read('sl-geo-min'), half: read('sl-geo-half'), max: read('sl-geo-max') };
  });
  const near = (a, b) => Math.abs(a - b) <= 0.5;
  const geoOk = [geometry.min, geometry.half, geometry.max].every(
    (row) => row.inside && near(row.fill.width, row.thumb.center - row.track.left) && near(row.fill.right, row.thumb.center),
  );
  check(
    '几何：min 时滑块贴轨道左缘、max 时贴右缘、50% 时滑块中心 ≈ 轨道中心；填充条宽 = 滑块中心到轨道左缘，滑块始终不越出轨道',
    geoOk &&
      geometry.min.value === 0 &&
      near(geometry.min.thumb.left, geometry.min.track.left) &&
      geometry.max.value === 100 &&
      near(geometry.max.thumb.right, geometry.max.track.right) &&
      geometry.half.value === 50 &&
      near(geometry.half.thumb.center, geometry.half.track.left + geometry.half.track.width / 2),
    JSON.stringify(geometry),
  );

  /* ---------- part：四个都在，::part() 改得动 ---------- */
  const parts = await page.evaluate(() => {
    const root = document.getElementById('sl-part').shadowRoot;
    const found = (name) => !!root.querySelector('[part="' + name + '"]');
    const track = getComputedStyle(root.querySelector('[part="track"]'));
    const thumb = getComputedStyle(root.querySelector('[part="thumb"]'));
    const fill = getComputedStyle(root.querySelector('[part="fill"]'));
    return {
      base: found('base'),
      track: found('track'),
      fill: found('fill'),
      thumb: found('thumb'),
      trackH: track.height,
      trackBg: track.backgroundColor,
      thumbRadius: thumb.borderTopLeftRadius,
      fillBg: fill.backgroundColor,
    };
  });
  check(
    'part="base" / "track" / "fill" / "thumb" 都在；::part(track) 改高与底色、::part(thumb) 改圆角、::part(fill) 改底色都生效',
    parts.base &&
      parts.track &&
      parts.fill &&
      parts.thumb &&
      parts.trackH === '10px' &&
      parts.trackBg === 'rgb(1, 2, 3)' &&
      parts.thumbRadius === '2px' &&
      parts.fillBg === 'rgb(4, 5, 6)',
    JSON.stringify(parts),
  );

  /* ---------- 焦点环：用 ring 令牌画在滑块上（原生 input 是视觉隐藏的） ---------- */
  await page.evaluate(() => {
    document.getElementById('sl-focus-a').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.getElementById('sl-focus-b');
    const root = el.shadowRoot;
    const input = root.querySelector('input');
    const thumb = getComputedStyle(root.querySelector('[part="thumb"]'));
    const ring = getComputedStyle(document.documentElement)
      .getPropertyValue('--mc-color-ring')
      .trim()
      .split(/\s+/)
      .join(',');
    return {
      active: root.activeElement === input,
      focusVisible: input.matches(':focus-visible'),
      outlineColor: (thumb.outlineColor.match(/\d+/g) ?? []).slice(0, 3).join(','),
      outlineStyle: thumb.outlineStyle,
      outlineWidth: thumb.outlineWidth,
      ring,
    };
  });
  check(
    'Tab 到 slider：焦点落在内部原生 input 上，焦点环画在滑块上、颜色取 --mc-color-ring（不是 currentColor）',
    focus.active &&
      focus.focusVisible &&
      focus.outlineColor === focus.ring &&
      focus.outlineStyle === 'solid' &&
      focus.outlineWidth === '2px',
    JSON.stringify(focus),
  );

  /* ---------- mc-form 集成：数字控件的值按字符串收 ----------
     slider 文档页没有注册 mc-form，这里自己用 <l-m> 引来（同页面注册组件的方式），不依赖演示区。 */
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
    el.innerHTML = '<mc-form-item name="x"><mc-slider default-value="30"></mc-slider></mc-form-item>';
    document.body.append(el);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const slider = el.querySelector('mc-slider');
    const before = { collected: el.getValue(), slider: slider.value };
    slider.value = 70;
    const after = { collected: el.getValue(), slider: slider.value };
    el.remove();
    return { before, after };
  });
  check(
    'mc-form 集成：数字控件的 value 按字符串收（default-value="30" → getValue().x === "30"，改成 70 后 === "70"）',
    form.before.slider === 30 &&
      form.before.collected.x === '30' &&
      form.after.slider === 70 &&
      form.after.collected.x === '70',
    JSON.stringify(form),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => {
    document.getElementById('slider-probe')?.remove();
    document.getElementById('slider-part-style')?.remove();
  });
}
