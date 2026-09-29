/**
 * mc-input · 单行输入框：值的读写（default-value 属性 vs property value，真相在内部原生 input）、
 * input / change 的 data.value 与「原生那条已被拦掉」、clearable 的 ×（显隐 / 三事件）、
 * 四个状态布尔与 maxlength 转发给内部原生元素、prefix / suffix 插槽位置与空插槽不占位。
 * 探针现搭现拆（page.evaluate 建 #input-probe，跑完删掉），不依赖固定 sleep。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onPageError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onPageError);

  await visit(page, '/index.html?input=1#/packages/input/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-input'), { timeout: 8000 })
    .catch(() => {});

  /* ---------- 探针：每个断言要的元素都在这里，跑完由最后一段 evaluate 拆掉 ---------- */
  const probe = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'input-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-direction:column;gap:8px;width:420px';
    host.innerHTML = ['sizes', 'value', 'events', 'clear', 'states', 'affix']
      .map((id) => `<div id="row-${id}" style="display:flex;gap:8px;align-items:center"></div>`)
      .join('');
    document.body.append(host);

    const put = (row, id, attrs = {}) => {
      const el = document.createElement('mc-input');
      el.id = id;
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      document.getElementById(`row-${row}`).append(el);
      return el;
    };

    put('sizes', 'i-sm', { size: 'sm' });
    put('sizes', 'i-md', {});
    put('sizes', 'i-lg', { size: 'lg' });
    put('sizes', 'i-style', { style: 'height: 48px' });

    put('value', 'i-value', {});
    const init = put('value', 'i-init', { 'default-value': '初始值' });

    put('events', 'i-ev', {});

    put('clear', 'i-clear', { clearable: '' });
    put('clear', 'i-noclear', { 'default-value': '没有 clearable' });
    put('clear', 'i-clear-disabled', { clearable: '', disabled: '', 'default-value': '有内容' });

    put('states', 'i-disabled', { disabled: '' });
    put('states', 'i-readonly', { readonly: '' });
    put('states', 'i-invalid', { invalid: '' });
    put('states', 'i-required', { required: '' });
    put('states', 'i-max', { maxlength: '5' });
    put('states', 'i-nomax', {});

    const affix = put('affix', 'i-affix', {});
    affix.innerHTML = '<span slot="prefix" id="affix-prefix">¥</span><span slot="suffix">元</span>';
    put('affix', 'i-plain', {});

    /* 全在构造期 createElement 出来的：P31 一旦踩中，这里连 shadowRoot 都没有 */
    return {
      initAttr: init.getAttribute('default-value'),
      upgraded: [...document.querySelectorAll('#input-probe mc-input')].every((el) => !!el.shadowRoot),
    };
  });

  /* ---------- 尺寸：三档高度 + 宿主 style 精确覆盖 ---------- */
  const geometry = await page.evaluate(() => {
    const height = (id) => Math.round(document.getElementById(id).getBoundingClientRect().height);
    return { sm: height('i-sm'), md: height('i-md'), lg: height('i-lg'), styled: height('i-style') };
  });
  check(
    '动态创建的实例都升级了（P31）；size 三档 = 28 / 36 / 44，宿主 style="height:48px" 直接压过去',
    probe.upgraded &&
      geometry.sm === 28 &&
      geometry.md === 36 &&
      geometry.lg === 44 &&
      geometry.styled === 48,
    JSON.stringify({ ...geometry, upgraded: probe.upgraded }),
  );

  /* ---------- 值的读写：初始值走 default-value，运行时走 property value ---------- */
  const value = await page.evaluate(() => {
    const el = document.getElementById('i-value');
    const inner = el.shadowRoot.querySelector('.mc-input');
    const out = { init: document.getElementById('i-init').value };
    out.before = el.value;
    out.innerBefore = inner.value;
    el.value = '张三';
    out.afterWrite = el.value;
    out.innerAfterWrite = inner.value;
    out.reflected = el.getAttribute('value');
    /* 真相在内部原生元素：从里面改，宿主读出来也要跟着变 */
    inner.value = '内部改的';
    out.afterInnerWrite = el.value;
    return out;
  });
  check(
    'default-value 是初始值（createElement 之后再写属性也算）、property value 是运行时值：写立刻进内部原生 input，读也读它，且不反射成属性',
    probe.initAttr === '初始值' &&
      value.init === '初始值' &&
      value.before === '' &&
      value.innerBefore === '' &&
      value.afterWrite === '张三' &&
      value.innerAfterWrite === '张三' &&
      value.reflected === null &&
      value.afterInnerWrite === '内部改的',
    JSON.stringify({ initAttr: probe.initAttr, ...value }),
  );

  /* ---------- 事件：真实的键盘输入 + 失焦，document 级记账 ---------- */
  await page.evaluate(() => {
    window.__inputEvents = [];
    const push = (e) =>
      window.__inputEvents.push({
        type: e.type,
        id: e.target?.id ?? null,
        data: e.data?.value,
        targetValue: e.target?.value,
        bubbles: e.bubbles,
        composed: e.composed,
      });
    document.addEventListener('input', push);
    document.addEventListener('change', push);
    document.getElementById('i-ev').shadowRoot.querySelector('.mc-input').focus();
  });
  await page.keyboard.type('ab');
  await page.evaluate(() => document.getElementById('i-ev').shadowRoot.querySelector('.mc-input').blur());
  await page
    .waitForFunction(() => window.__inputEvents.some((e) => e.type === 'change'), { timeout: 3000 })
    .catch(() => {});

  /* maxlength 的真实截断：再敲 6 个字符进 maxlength=5 的那个 */
  await page.evaluate(() =>
    document.getElementById('i-max').shadowRoot.querySelector('.mc-input').focus(),
  );
  await page.keyboard.type('abcdef');
  const truncation = await page.evaluate(() => ({
    value: document.getElementById('i-max').value,
    inner: document.getElementById('i-max').shadowRoot.querySelector('.mc-input').value,
  }));

  const events = await page.evaluate(() =>
    window.__inputEvents.filter((e) => e.id === 'i-ev'),
  );
  check(
    'input 与 change 各从组件发一条（原生那条没有 data 的已被拦掉）：带 data.value、bubbles + composed，$event.target.value 也读得到',
    JSON.stringify(events.map((e) => `${e.type}:${e.data}`)) ===
      JSON.stringify(['input:a', 'input:ab', 'change:ab']) &&
      events.every((e) => e.bubbles === true && e.composed === true && e.targetValue === e.data),
    JSON.stringify({ events, truncation }),
  );

  /* ---------- clearable：× 只在「可清 + 有内容 + 没被禁用」时出现 ---------- */
  const clear = await page.evaluate(() => {
    const el = document.getElementById('i-clear');
    const root = el.shadowRoot;
    const btn = root.querySelector('.mc-clear');
    const shown = (id) =>
      getComputedStyle(document.getElementById(id).shadowRoot.querySelector('.mc-clear'))
        .display !== 'none';
    const seen = [];
    el.addEventListener('clear', (e) => seen.push(`clear:bubbles=${e.bubbles},composed=${e.composed}`));
    el.addEventListener('input', (e) => seen.push(`input:${e.data?.value}`));
    el.addEventListener('change', (e) => seen.push(`change:${e.data?.value}`));

    const emptyShown = shown('i-clear');
    el.value = '要清掉的';
    const filledShown = shown('i-clear');
    btn.click();
    return {
      emptyShown,
      filledShown,
      afterClickShown: shown('i-clear'),
      value: el.value,
      innerValue: root.querySelector('.mc-input').value,
      seen,
      tag: btn.tagName,
      type: btn.type,
      aria: btn.getAttribute('aria-label'),
      noClearableShown: shown('i-noclear'),
      disabledShown: shown('i-clear-disabled'),
    };
  });
  check(
    'clearable 的 ×：有内容且可清才出现（没有 clearable、或禁用时都不在）；点击清空并依次发 clear / input / change',
    clear.emptyShown === false &&
      clear.filledShown === true &&
      clear.afterClickShown === false &&
      clear.value === '' &&
      clear.innerValue === '' &&
      JSON.stringify(clear.seen) ===
        JSON.stringify(['clear:bubbles=true,composed=true', 'input:', 'change:']) &&
      clear.tag === 'BUTTON' &&
      clear.type === 'button' &&
      clear.aria === '清除' &&
      clear.noClearableShown === false &&
      clear.disabledShown === false,
    JSON.stringify(clear),
  );

  /* ---------- 状态与转发：四个布尔 + maxlength 都进内部原生元素 ---------- */
  await page.evaluate(() => {
    const rgb = (name) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
        .split(/\s+/)
        .join(',');
    window.__dangerRgb = rgb('--mc-color-danger');
  });
  await page
    .waitForFunction(
      () => {
        const c = getComputedStyle(document.getElementById('i-invalid')).borderTopColor;
        return (c.match(/\d+/g) ?? []).slice(0, 3).join(',') === window.__dangerRgb;
      },
      { timeout: 3000 },
    )
    .catch(() => {});
  const states = await page.evaluate(() => {
    const inner = (id) => document.getElementById(id).shadowRoot.querySelector('.mc-input');
    const rgbOf = (id) =>
      (getComputedStyle(document.getElementById(id)).borderTopColor.match(/\d+/g) ?? [])
        .slice(0, 3)
        .join(',');
    return {
      disabled: inner('i-disabled').disabled,
      disabledAttr: inner('i-disabled').getAttribute('disabled'),
      disabledCursor: getComputedStyle(document.getElementById('i-disabled')).cursor,
      readonly: inner('i-readonly').readOnly,
      ariaRequired: inner('i-required').getAttribute('aria-required'),
      ariaInvalid: inner('i-invalid').getAttribute('aria-invalid'),
      ariaRequiredOff: inner('i-nomax').getAttribute('aria-required'),
      invalidBorder: rgbOf('i-invalid'),
      danger: window.__dangerRgb,
      max: inner('i-max').maxLength,
      noMax: inner('i-nomax').maxLength,
      maxValue: document.getElementById('i-max').value,
      maxInner: inner('i-max').value,
    };
  });
  check(
    '状态与转发：disabled / readonly 用原生 property，required / invalid 进 aria-*，invalid 边框取 --mc-color-danger；maxlength 逐字转发并真的截断',
    states.disabled === true &&
      states.disabledAttr !== null &&
      states.disabledCursor === 'not-allowed' &&
      states.readonly === true &&
      states.ariaRequired === 'true' &&
      states.ariaInvalid === 'true' &&
      states.ariaRequiredOff === 'false' &&
      states.invalidBorder === states.danger &&
      states.max === 5 &&
      states.noMax === -1 &&
      states.maxValue === 'abcde' &&
      states.maxInner === 'abcde',
    JSON.stringify(states),
  );

  /* ---------- 插槽：前后缀落在输入区两侧；空插槽不占位 ---------- */
  const affix = await page.evaluate(() => {
    const box = (node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    };
    const el = document.getElementById('i-affix');
    const plain = document.getElementById('i-plain');
    const host = box(el);
    const input = box(el.shadowRoot.querySelector('.mc-input'));
    const prefix = box(el.querySelector('#affix-prefix'));
    const suffix = box(el.querySelector('[slot="suffix"]'));
    return {
      order: prefix.right <= input.left + 1 && suffix.left >= input.right - 1,
      inside: prefix.left >= host.left - 1 && suffix.right <= host.right + 1,
      plainPrefix: getComputedStyle(plain.shadowRoot.querySelector('.mc-prefix')).display,
      plainSuffix: getComputedStyle(plain.shadowRoot.querySelector('.mc-suffix')).display,
      plainWidth: box(plain).width,
      affixWidth: host.width,
    };
  });
  check(
    'prefix / suffix 插槽分别落在输入区两侧；空插槽不占位（容器 display:none，带插槽的实例更宽）',
    affix.order &&
      affix.inside &&
      affix.plainPrefix === 'none' &&
      affix.plainSuffix === 'none' &&
      affix.plainWidth < affix.affixWidth,
    JSON.stringify(affix),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('input-probe')?.remove());

  page.off('response', onResponse);
  page.off('pageerror', onPageError);
  check('mc-input 文档页没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
