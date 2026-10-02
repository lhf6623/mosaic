/**
 * mc-checkbox · 复选框：真实点击 / 键盘切换、change payload（document 级记账）、
 * checked property 写完立刻生效、indeterminate 与 disabled 转发到内部原生 input、
 * 尺寸与令牌、part 既存在又真的能被 ::part() 改到。
 * 探针现搭现拆，跑法 node tests/smoke.mjs checkbox。
 */

export default async function run({ page, visit, check }) {
  /* 复选框文档页：组件本体在页里 <l-m> 引入，顺带确认文档页起得来 */
  await visit(page, '/index.html?checkbox=1#/packages/checkbox/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-checkbox'), { timeout: 8000 })
    .catch(() => {});

  /* 搭探针：每个断言要的元素都在这里，量完由最后一个 evaluate 拆掉。
     fixed + 高 z-index：不参与文档流，也不被文档页的排版影响 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'checkbox-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-direction:column;gap:6px;width:360px';
    document.body.append(host);

    const put = (id, attrs = {}, text = '选项') => {
      const box = document.createElement('mc-checkbox');
      box.id = id;
      for (const [key, value] of Object.entries(attrs)) box.setAttribute(key, value);
      box.textContent = text;
      host.append(box);
      return box;
    };

    put('cb-checked', { value: 'a', checked: true }, '已选中');
    put('cb-plain', { value: 'b' }, '未选中');
    put('cb-indeterminate', { value: 'c', indeterminate: true }, '半选');
    put('cb-disabled', { value: 'd', disabled: true }, '禁用');
    put('cb-invalid', { value: 'f', invalid: true }, '校验失败');
    put('cb-sm', { size: 'sm' }, '小');
    put('cb-md', {}, '中');
    put('cb-lg', { size: 'lg' }, '大');

    /* 组件自己把原生 change 转发成 composed 事件（P19）—— 挂 document 级监听记账，
       能收到才说明真的穿过 shadow 冒上来了 */
    window.__cbChanges = [];
    document.addEventListener('change', (event) => {
      window.__cbChanges.push({ id: event.target.id, data: event.data ?? null });
    });

    /* ::part(box) 从页面侧真的能改到内部方框（只是「有这个 part」还不够） */
    const style = document.createElement('style');
    style.id = 'checkbox-part-style';
    style.textContent = '#cb-md::part(box) { border-radius: 9999px; }';
    document.head.append(style);
  });

  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('#checkbox-probe mc-checkbox')].every(
          (el) => !!el.shadowRoot,
        ),
      { timeout: 5000 },
    )
    .catch(() => {});

  /* ---------- 点一下：切换 + 事件载荷 ---------- */
  await page.locator('#cb-plain').click();
  const clicked = await page.evaluate(() => {
    const el = document.getElementById('cb-plain');
    return {
      prop: el.checked,
      native: el.shadowRoot.querySelector('input').checked,
      attr: el.hasAttribute('checked'),
      changes: window.__cbChanges.slice(),
    };
  });
  check(
    '点一下标签：宿主 property / 内部原生 input / checked 属性三处一起变成选中',
    clicked.prop === true && clicked.native === true && clicked.attr === true,
    JSON.stringify(clicked),
  );
  check(
    'change 事件带 { checked, value } 且穿透 shadow 冒到 document（原生 change 穿不出来，必须转发）',
    clicked.changes.length === 1 &&
      clicked.changes[0].id === 'cb-plain' &&
      clicked.changes[0].data?.checked === true &&
      clicked.changes[0].data?.value === 'b',
    JSON.stringify(clicked.changes),
  );

  await page.locator('#cb-plain').click();
  const clickedAgain = await page.evaluate(() => {
    const el = document.getElementById('cb-plain');
    return {
      prop: el.checked,
      attr: el.hasAttribute('checked'),
      changes: window.__cbChanges.slice(-1),
    };
  });
  check(
    '再点一下切回来，并再发一次 change（checked: false）',
    clickedAgain.prop === false &&
      clickedAgain.attr === false &&
      clickedAgain.changes[0]?.data?.checked === false,
    JSON.stringify(clickedAgain),
  );

  /* ---------- 键盘：焦点在内部原生 input 上，Space 一样能切 ---------- */
  await page.evaluate(() => {
    document.getElementById('cb-plain').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('Space');
  const byKeyboard = await page.evaluate(() => {
    const el = document.getElementById('cb-plain');
    return { prop: el.checked, changes: window.__cbChanges.slice(-1) };
  });
  check(
    '键盘 Space 切换（可交互元素是原生 input，键盘白拿）',
    byKeyboard.prop === true && byKeyboard.changes[0]?.data?.checked === true,
    JSON.stringify(byKeyboard),
  );

  /* ---------- checked / indeterminate property 写完立刻生效（不等 ofa 那一拍，P4） ---------- */
  const immediate = await page.evaluate(() => {
    const el = document.getElementById('cb-checked');
    const input = el.shadowRoot.querySelector('input');
    const snap = () => ({ prop: el.checked, native: input.checked, attr: el.hasAttribute('checked') });
    el.checked = false; // 同步读，不 await
    const off = snap();
    el.checked = true;
    const on = snap();
    el.indeterminate = true; // 半选也是同一个通道
    const half = {
      prop: el.indeterminate,
      native: input.indeterminate,
      attr: el.hasAttribute('indeterminate'),
    };
    el.indeterminate = false;
    return { off, on, half, halfOff: input.indeterminate };
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
  check(
    'el.indeterminate = true / false 同样当次生效（跟原生一样：半选也能用 property 读写）',
    immediate.half.prop === true &&
      immediate.half.native === true &&
      immediate.half.attr === true &&
      immediate.halfOff === false,
    JSON.stringify(immediate.half),
  );

  /* ---------- indeterminate：转发到内部原生 .indeterminate（原生没有对应的 HTML 属性） ---------- */
  const indNative = () =>
    page.evaluate(() => {
      const el = document.getElementById('cb-indeterminate');
      const input = el.shadowRoot.querySelector('input');
      return { native: input.indeterminate, checked: input.checked };
    });
  /* 等原生状态跟上属性 —— 等「值」而不是数帧（P4：属性到数据的同步有一拍） */
  const waitIndeterminate = (want) =>
    page
      .waitForFunction(
        (expected) =>
          document.getElementById('cb-indeterminate').shadowRoot.querySelector('input')
            .indeterminate === expected,
        want,
        { timeout: 4000 },
      )
      .catch(() => {});

  const indInitial = await indNative();
  await page.evaluate(() =>
    document.getElementById('cb-indeterminate').removeAttribute('indeterminate'),
  );
  await waitIndeterminate(false);
  const indRemoved = await indNative();
  await page.evaluate(() =>
    document.getElementById('cb-indeterminate').setAttribute('indeterminate', ''),
  );
  await waitIndeterminate(true);
  const indBack = await indNative();
  check(
    'indeterminate 双向转发到内部原生 .indeterminate（属性 → 原生，去掉属性 → 原生）',
    indInitial.native === true &&
      indInitial.checked === false &&
      indRemoved.native === false &&
      indBack.native === true,
    JSON.stringify({ indInitial, indRemoved, indBack }),
  );

  await page.locator('#cb-indeterminate').click();
  const afterIndeterminateClick = await page.evaluate(() => {
    const el = document.getElementById('cb-indeterminate');
    const input = el.shadowRoot.querySelector('input');
    return {
      native: input.indeterminate,
      attr: el.hasAttribute('indeterminate'),
      checked: el.checked,
    };
  });
  check(
    '点半选项：半选被清掉、变成明确选中（跟原生 checkbox 一个行为）',
    afterIndeterminateClick.native === false &&
      afterIndeterminateClick.attr === false &&
      afterIndeterminateClick.checked === true,
    JSON.stringify(afterIndeterminateClick),
  );

  /* ---------- disabled：转发给内部原生 input，点不动 ---------- */
  const beforeDisabledClick = await page.evaluate(
    () => document.getElementById('cb-disabled').checked,
  );
  await page.locator('#cb-disabled').click({ force: true });
  const disabled = await page.evaluate((before) => {
    const el = document.getElementById('cb-disabled');
    const input = el.shadowRoot.querySelector('input');
    return {
      before,
      after: el.checked,
      native: input.disabled,
      cursor: getComputedStyle(el.shadowRoot.querySelector('.mc-base')).cursor,
      opacity: getComputedStyle(el).opacity,
    };
  }, beforeDisabledClick);
  check(
    '禁用转发给内部原生 input（不是只有 opacity）：点不动、光标 not-allowed',
    disabled.after === false &&
      disabled.native === true &&
      disabled.cursor === 'not-allowed' &&
      disabled.opacity === '0.5',
    JSON.stringify(disabled),
  );

  /* ---------- invalid：只换危险色，不写 aria-* ---------- */
  const state = await page.evaluate(() => {
    const rgbOf = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).join(',');
    const token = (name) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
        .replace(/\s+/g, ',');
    const invalidEl = document.getElementById('cb-invalid');
    const invalid = invalidEl.shadowRoot.querySelector('input');
    return {
      invalidAria: invalid.getAttribute('aria-invalid'),
      boxBorder: rgbOf(
        getComputedStyle(invalidEl.shadowRoot.querySelector('.mc-box')).borderTopColor,
      ),
      danger: token('--mc-color-danger'),
    };
  });
  check(
    'invalid 的方框换成危险色令牌，且不写 aria-*',
    state.invalidAria === null &&
      state.boxBorder === state.danger,
    JSON.stringify(state),
  );

  /* ---------- 尺寸与颜色都走令牌，没有写死的值 ---------- */
  const tokens = await page.evaluate(() => {
    const rgbOf = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).join(',');
    const read = (name) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
        .replace(/\s+/g, ',');
    const h = (id) => Math.round(document.getElementById(id).getBoundingClientRect().height);
    const fontSize = (id) => getComputedStyle(document.getElementById(id)).fontSize;
    const checked = document.getElementById('cb-checked');
    const box = getComputedStyle(checked.shadowRoot.querySelector('.mc-box'));
    return {
      h: { sm: h('cb-sm'), md: h('cb-md'), lg: h('cb-lg') },
      font: {
        sm: fontSize('cb-sm'),
        md: fontSize('cb-md'),
        lg: fontSize('cb-lg'),
      },
      boxFill: rgbOf(box.backgroundColor),
      primary: read('--mc-color-primary'),
      ring: read('--mc-color-ring'),
    };
  });
  check(
    'size 三档 = 28 / 36 / 44（--mc-control-h-*），字号 = 12 / 14 / 16px（--mc-text-*）',
    tokens.h.sm === 28 &&
      tokens.h.md === 36 &&
      tokens.h.lg === 44 &&
      tokens.font.sm === '12px' &&
      tokens.font.md === '14px' &&
      tokens.font.lg === '16px',
    JSON.stringify({ h: tokens.h, font: tokens.font }),
  );
  check(
    '选中的方框填充色就是 --mc-color-primary（组件里没有写死的颜色）',
    tokens.boxFill === tokens.primary,
    `方框 ${tokens.boxFill} ≠ 令牌 ${tokens.primary}`,
  );

  /* ---------- part：三个都在，且 ::part() 真的改得动 ---------- */
  const parts = await page.evaluate(() => {
    const root = document.getElementById('cb-md').shadowRoot;
    const found = (name) => !!root.querySelector(`[part="${name}"]`);
    return {
      base: found('base'),
      box: found('box'),
      label: found('label'),
      radius: getComputedStyle(root.querySelector('[part="box"]')).borderTopLeftRadius,
    };
  });
  check(
    'part="base" / "box" / "label" 都在；页面侧 ::part(box) 真的改到了内部方框（圆角变 9999px）',
    parts.base && parts.box && parts.label && parts.radius === '9999px',
    JSON.stringify(parts),
  );

  /* ---------- 焦点环：用 ring 令牌，不用 currentColor（P16） ----------
     先程序化聚焦前一个，再用真实 Tab 走到下一个 —— 键盘移动过焦点，:focus-visible 才可靠 */
  await page.evaluate(() => {
    document.getElementById('cb-plain').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.getElementById('cb-indeterminate');
    const input = el.shadowRoot.querySelector('input');
    const box = el.shadowRoot.querySelector('.mc-box');
    const ring = getComputedStyle(document.documentElement)
      .getPropertyValue('--mc-color-ring')
      .trim()
      .replace(/\s+/g, ',');
    return {
      active: el.shadowRoot.activeElement === input,
      focusVisible: input.matches(':focus-visible'),
      outline: (getComputedStyle(box).outlineColor.match(/\d+/g) ?? []).slice(0, 3).join(','),
      ring,
    };
  });
  check(
    'Tab 走到下一个复选框：焦点环画在方框上、颜色取 --mc-color-ring（不是 currentColor）',
    focus.active && focus.focusVisible && focus.outline === focus.ring,
    JSON.stringify(focus),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => {
    document.getElementById('checkbox-probe')?.remove();
    document.getElementById('checkbox-part-style')?.remove();
  });
}
