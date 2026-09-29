/**
 * mc-textarea · 多行输入框：值的读写（default-value 属性 vs property value）、input / change 的
 * data.value、rows 转发、auto-resize 把高度写成 scrollHeight（关掉即恢复）、
 * 字数统计只在给了 maxlength 时出现且实时更新、状态布尔与 aria 转发、前后缀插槽。
 * 探针现搭现拆（page.evaluate 建 #textarea-probe，跑完删掉），要等就 waitForFunction。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onPageError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onPageError);

  await visit(page, '/index.html?textarea=1#/packages/textarea/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-textarea'), { timeout: 8000 })
    .catch(() => {});

  /* ---------- 探针 ---------- */
  const probe = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'textarea-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-direction:column;gap:8px;width:420px';
    host.innerHTML = ['sizes', 'value', 'resize', 'counter', 'states', 'affix']
      .map((id) => `<div id="row-${id}" style="display:flex;gap:8px;align-items:center"></div>`)
      .join('');
    document.body.append(host);

    const put = (row, id, attrs = {}) => {
      const el = document.createElement('mc-textarea');
      el.id = id;
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      document.getElementById(`row-${row}`).append(el);
      return el;
    };

    put('sizes', 't-sm', { size: 'sm', rows: '1' });
    put('sizes', 't-md', { rows: '1' });
    put('sizes', 't-lg', { size: 'lg', rows: '1' });
    put('sizes', 't-rows', { rows: '6' });

    put('value', 't-value', {});
    const init = put('value', 't-init', { 'default-value': '初始文案' });

    put('resize', 't-auto', { 'auto-resize': '', rows: '1' });
    put('resize', 't-auto-init', { 'auto-resize': '', rows: '1', 'default-value': '1\n2\n3' });
    put('resize', 't-fixed', { rows: '1' });

    put('counter', 't-count', { maxlength: '10', rows: '2' });
    put('counter', 't-count-init', { maxlength: '8', 'default-value': 'abc', rows: '2' });
    put('counter', 't-nocount', { rows: '2' });

    put('states', 't-disabled', { disabled: '', rows: '2' });
    put('states', 't-readonly', { readonly: '', rows: '2' });
    put('states', 't-invalid', { invalid: '', rows: '2' });
    put('states', 't-required', { required: '', rows: '2' });

    const affix = put('affix', 't-affix', { rows: '2' });
    affix.innerHTML = '<span slot="prefix" id="ta-prefix">#</span><span slot="suffix">条</span>';
    put('affix', 't-plain', { rows: '2' });

    /* 全在构造期 createElement 出来的：P31 一旦踩中，这里连 shadowRoot 都没有 */
    return {
      initAttr: init.getAttribute('default-value'),
      upgraded: [...document.querySelectorAll('#textarea-probe mc-textarea')].every(
        (el) => !!el.shadowRoot,
      ),
      /* auto-resize 的默认值是 null：裸属性不写回宿主，所以 :host([auto-resize]) 是可信的 */
      autoAttr: put('resize', 't-auto-attr', { rows: '1' }).hasAttribute('auto-resize'),
    };
  });

  /* ---------- 尺寸与 rows：min-height 三档 + rows 逐字转发 ---------- */
  const sizes = await page.evaluate(() => {
    const read = (id) => {
      const el = document.getElementById(id);
      const cs = getComputedStyle(el);
      const inner = el.shadowRoot.querySelector('.mc-input');
      return {
        minHeight: cs.minHeight,
        fontSize: cs.fontSize,
        paddingInline: cs.paddingLeft,
        rows: inner.rows,
        box: Math.round(el.getBoundingClientRect().height),
      };
    };
    return { sm: read('t-sm'), md: read('t-md'), lg: read('t-lg'), rows: read('t-rows') };
  });
  check(
    '动态创建的实例都升级了（P31）；size 三档 = min-height 28 / 36 / 44（字号与内边距跟着走），rows 逐字转发给内部原生 textarea',
    probe.upgraded &&
      probe.autoAttr === false &&
      sizes.sm.minHeight === '28px' &&
      sizes.sm.fontSize === '12px' &&
      sizes.sm.paddingInline === '12px' &&
      sizes.md.minHeight === '36px' &&
      sizes.md.fontSize === '14px' &&
      sizes.md.paddingInline === '16px' &&
      sizes.lg.minHeight === '44px' &&
      sizes.lg.fontSize === '16px' &&
      sizes.lg.paddingInline === '20px' &&
      sizes.rows.rows === 6 &&
      sizes.rows.box > sizes.md.box,
    JSON.stringify({ ...sizes, autoAttr: probe.autoAttr, upgraded: probe.upgraded }),
  );

  /* ---------- 值的读写 + 事件 ---------- */
  const value = await page.evaluate(() => {
    const el = document.getElementById('t-value');
    const inner = el.shadowRoot.querySelector('.mc-input');
    const out = { init: document.getElementById('t-init').value };
    out.before = el.value;
    out.innerBefore = inner.value;
    el.value = '第一行\n第二行';
    out.afterWrite = el.value;
    out.innerAfterWrite = inner.value;
    out.reflected = el.getAttribute('value');
    inner.value = '内部改的';
    out.afterInnerWrite = el.value;
    return out;
  });
  check(
    'default-value 是初始值（createElement 之后再写属性也算）、property value 是运行时值：写立刻进内部原生 textarea，读也读它，且不反射成属性（换行照原样）',
    probe.initAttr === '初始文案' &&
      value.init === '初始文案' &&
      value.before === '' &&
      value.innerBefore === '' &&
      value.afterWrite === '第一行\n第二行' &&
      value.innerAfterWrite === '第一行\n第二行' &&
      value.reflected === null &&
      value.afterInnerWrite === '内部改的',
    JSON.stringify({ initAttr: probe.initAttr, ...value }),
  );

  /* ---------- 事件：真实键盘输入 + 失焦 ---------- */
  await page.evaluate(() => {
    window.__taEvents = [];
    const push = (e) =>
      window.__taEvents.push({
        type: e.type,
        id: e.target?.id ?? null,
        data: e.data?.value,
        targetValue: e.target?.value,
        bubbles: e.bubbles,
        composed: e.composed,
      });
    document.addEventListener('input', push);
    document.addEventListener('change', push);
    // 上一个断言把它改成了「内部改的」：从空开始敲，事件序列才是确定的
    document.getElementById('t-value').value = '';
    document.getElementById('t-value').shadowRoot.querySelector('.mc-input').focus();
  });
  await page.keyboard.type('xy');
  await page.evaluate(() =>
    document.getElementById('t-value').shadowRoot.querySelector('.mc-input').blur(),
  );
  await page
    .waitForFunction(() => window.__taEvents.some((e) => e.type === 'change'), { timeout: 3000 })
    .catch(() => {});
  const events = await page.evaluate(() => window.__taEvents.filter((e) => e.id === 't-value'));
  check(
    'input 与 change 各从组件发一条（原生那条没有 data 的已被拦掉）：带 data.value、bubbles + composed，$event.target.value 也读得到',
    JSON.stringify(events.map((e) => `${e.type}:${e.data}`)) ===
      JSON.stringify(['input:x', 'input:xy', 'change:xy']) &&
      events.every((e) => e.bubbles === true && e.composed === true && e.targetValue === e.data),
    JSON.stringify(events),
  );

  /* ---------- auto-resize：高度 = scrollHeight；去掉属性即恢复 ---------- */
  await page.evaluate(() =>
    document.getElementById('t-auto').shadowRoot.querySelector('.mc-input').focus(),
  );
  await page.keyboard.type('1\n2\n3\n4');
  await page.evaluate(() => {
    const fixed = document.getElementById('t-fixed');
    fixed.value = '1\n2\n3\n4'; // 同样四行，但没开 auto-resize —— 对照
  });
  await page
    .waitForFunction(
      () => {
        const ta = document.getElementById('t-auto').shadowRoot.querySelector('.mc-input');
        return ta.style.height !== '' && ta.style.height === `${ta.scrollHeight}px`;
      },
      { timeout: 3000 },
    )
    .catch(() => {});
  /* 初始就带多行内容的那条：attached() 可能早于布局，写 0px 会把内容裁掉（实测踩过） */
  await page
    .waitForFunction(
      () => {
        const ta = document.getElementById('t-auto-init').shadowRoot.querySelector('.mc-input');
        return ta.style.height !== '' && ta.style.height !== '0px';
      },
      { timeout: 3000 },
    )
    .catch(() => {});
  const resize = await page.evaluate(() => {
    const read = (id) => {
      const el = document.getElementById(id);
      const inner = el.shadowRoot.querySelector('.mc-input');
      return {
        inline: inner.style.height,
        box: Math.round(el.getBoundingClientRect().height),
        innerBox: Math.round(inner.getBoundingClientRect().height),
        scrollHeight: inner.scrollHeight,
        overflow: getComputedStyle(inner).overflow,
        resize: getComputedStyle(inner).resize,
      };
    };
    return {
      auto: read('t-auto'),
      initial: read('t-auto-init'),
      fixed: read('t-fixed'),
    };
  });
  /* 去掉 auto-resize：监听要摘掉、写进去的高度要清掉 */
  await page.evaluate(() =>
    document.getElementById('t-auto').removeAttribute('auto-resize'),
  );
  const unbound = await page
    .waitForFunction(
      () => document.getElementById('t-auto').shadowRoot.querySelector('.mc-input').style.height === '',
      { timeout: 3000 },
    )
    .then(() => true)
    .catch(() => false);
  check(
    'auto-resize：高度被写成 scrollHeight（不再滚动），没开的对照保持原样；去掉属性后监听摘掉、高度清空',
    resize.auto.inline !== '' &&
      resize.auto.inline === `${resize.auto.scrollHeight}px` &&
      resize.auto.innerBox === resize.auto.scrollHeight &&
      resize.auto.box > resize.fixed.box &&
      resize.auto.overflow === 'hidden' &&
      resize.auto.resize === 'none' &&
      resize.fixed.inline === '' &&
      /* 初始就带三行内容的那条：必须是量出来的 60px，不是把内容裁掉的 0px */
      resize.initial.inline === `${resize.initial.scrollHeight}px` &&
      resize.initial.scrollHeight > 20 &&
      resize.initial.innerBox === resize.initial.scrollHeight &&
      unbound,
    JSON.stringify({ ...resize, unbound }),
  );

  /* ---------- 字数统计：只有 maxlength 才有 ---------- */
  await page.evaluate(() =>
    document.getElementById('t-count').shadowRoot.querySelector('.mc-input').focus(),
  );
  await page.keyboard.type('abc');
  await page
    .waitForFunction(
      () => document.getElementById('t-count').shadowRoot.querySelector('.mc-counter').textContent === '3/10',
      { timeout: 3000 },
    )
    .catch(() => {});
  const counter = await page.evaluate(() => {
    const read = (id) => {
      const root = document.getElementById(id).shadowRoot;
      const box = root.querySelector('.mc-counter');
      return {
        display: getComputedStyle(box).display,
        text: box.textContent,
        part: box.getAttribute('part'),
        value: document.getElementById(id).value,
      };
    };
    return { count: read('t-count'), init: read('t-count-init'), none: read('t-nocount') };
  });
  check(
    '字数统计：给了 maxlength 才显示「当前/上限」（初始值也计入、随输入更新），没给就整块不占位',
    counter.count.display === 'block' &&
      counter.count.text === '3/10' &&
      counter.count.value === 'abc' &&
      counter.count.part === 'counter' &&
      counter.init.display === 'block' &&
      counter.init.text === '3/8' &&
      counter.none.display === 'none',
    JSON.stringify(counter),
  );

  /* ---------- 状态转发 + 前后缀插槽 ---------- */
  await page.evaluate(() => {
    window.__taDangerRgb = getComputedStyle(document.documentElement)
      .getPropertyValue('--mc-color-danger')
      .trim()
      .split(/\s+/)
      .join(',');
  });
  await page
    .waitForFunction(
      () =>
        (
          getComputedStyle(document.getElementById('t-invalid')).borderTopColor.match(/\d+/g) ?? []
        )
          .slice(0, 3)
          .join(',') === window.__taDangerRgb,
      { timeout: 3000 },
    )
    .catch(() => {});
  const states = await page.evaluate(() => {
    const inner = (id) => document.getElementById(id).shadowRoot.querySelector('.mc-input');
    const box = (node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right };
    };
    const el = document.getElementById('t-affix');
    const plain = document.getElementById('t-plain');
    const input = box(el.shadowRoot.querySelector('.mc-input'));
    const prefix = box(el.querySelector('#ta-prefix'));
    const suffix = box(el.querySelector('[slot="suffix"]'));
    return {
      disabled: inner('t-disabled').disabled,
      disabledAttr: inner('t-disabled').getAttribute('disabled'),
      disabledCursor: getComputedStyle(document.getElementById('t-disabled')).cursor,
      readonly: inner('t-readonly').readOnly,
      ariaRequired: inner('t-required').getAttribute('aria-required'),
      ariaInvalid: inner('t-invalid').getAttribute('aria-invalid'),
      ariaRequiredOff: inner('t-plain').getAttribute('aria-required'),
      invalidBorder: (getComputedStyle(document.getElementById('t-invalid')).borderTopColor.match(/\d+/g) ?? [])
        .slice(0, 3)
        .join(','),
      danger: window.__taDangerRgb,
      order: prefix.right <= input.left + 1 && suffix.left >= input.right - 1,
      plainPrefix: getComputedStyle(plain.shadowRoot.querySelector('.mc-prefix')).display,
      plainSuffix: getComputedStyle(plain.shadowRoot.querySelector('.mc-suffix')).display,
    };
  });
  check(
    '状态与插槽：disabled / readonly 用原生 property（禁用态光标 not-allowed）、required / invalid 进 aria-*、invalid 边框取 --mc-color-danger；前后缀落在输入区两侧，空插槽不占位',
    states.disabled === true &&
      states.disabledAttr !== null &&
      states.disabledCursor === 'not-allowed' &&
      states.readonly === true &&
      states.ariaRequired === 'true' &&
      states.ariaInvalid === 'true' &&
      states.ariaRequiredOff === 'false' &&
      states.invalidBorder === states.danger &&
      states.order &&
      states.plainPrefix === 'none' &&
      states.plainSuffix === 'none',
    JSON.stringify(states),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('textarea-probe')?.remove());

  page.off('response', onResponse);
  page.off('pageerror', onPageError);
  check('mc-textarea 文档页没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
