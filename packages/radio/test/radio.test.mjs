/**
 * mc-radio + mc-radio-group · 单选项：点选互斥、组 value property 写完立刻生效、
 * change payload（document 级记账，且只发一次）、方向键在组内切换并把焦点带走、
 * 组禁用 / 单格禁用都不选中、尺寸靠继承、part 既存在又真的能被 ::part() 改到。
 * 探针现搭现拆，跑法 node tests/smoke.mjs radio。
 */

export default async function run({ page, visit, check }) {
  /* 单选项文档页：两个标签都由页里的 <l-m> 注册 */
  await visit(page, '/index.html?radio=1#/packages/radio/page.html');
  await page
    .waitForFunction(
      () => !!customElements.get('mc-radio') && !!customElements.get('mc-radio-group'),
      { timeout: 8000 },
    )
    .catch(() => {});

  /* 搭探针：五个组覆盖各种组合，量完由最后一个 evaluate 拆掉 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'radio-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-direction:column;gap:10px;width:420px';
    host.innerHTML = `
      <mc-radio-group id="rg-a" name="plan" default-value="b">
        <mc-radio id="r-a" value="a">A</mc-radio>
        <mc-radio id="r-b" value="b">B</mc-radio>
        <mc-radio id="r-c" value="c">C</mc-radio>
      </mc-radio-group>
      <mc-radio-group id="rg-part" name="part">
        <mc-radio id="r-p1" value="a">可用</mc-radio>
        <mc-radio id="r-p2" value="b" disabled>不可用</mc-radio>
        <mc-radio id="r-p3" value="c">可用</mc-radio>
      </mc-radio-group>
      <mc-radio-group id="rg-off" name="off" disabled default-value="a">
        <mc-radio id="r-o1" value="a">A</mc-radio>
        <mc-radio id="r-o2" value="b">B</mc-radio>
      </mc-radio-group>
      <mc-radio-group id="rg-sm" name="sm" size="sm" direction="column" default-value="a">
        <mc-radio id="r-sm" value="a">小</mc-radio>
      </mc-radio-group>
      <mc-radio-group id="rg-lg" name="lg" size="lg" default-value="a">
        <mc-radio id="r-lg" value="a">大</mc-radio>
      </mc-radio-group>
    `;
    document.body.append(host);

    /* 组自己把子项的原生 change 收上来、转发成一个 composed 的 change（P19）——
       挂 document 级监听记账，能收到才说明真的穿过 shadow 冒上来了 */
    window.__radioChanges = [];
    document.addEventListener('change', (event) => {
      window.__radioChanges.push({ id: event.target.id, data: event.data ?? null });
    });

    /* part 从页面侧真的能改到内部（自定义属性一定会赢，直接属性也验一下） */
    const style = document.createElement('style');
    style.id = 'radio-part-style';
    style.textContent =
      '#r-a::part(circle) { --mc-radio-circle: 1.5em; border-radius: 2px; }' +
      '#rg-a::part(base) { gap: 24px; }';
    document.head.append(style);
  });

  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('#radio-probe mc-radio')].every((el) => !!el.shadowRoot) &&
        [...document.querySelectorAll('#radio-probe mc-radio-group')].every(
          (el) => !!el.shadowRoot,
        ),
      { timeout: 5000 },
    )
    .catch(() => {});

  const snap = () =>
    page.evaluate(() => ({
      value: document.getElementById('rg-a').value,
      attr: document.getElementById('rg-a').getAttribute('value'),
      a: document.getElementById('r-a').checked,
      b: document.getElementById('r-b').checked,
      c: document.getElementById('r-c').checked,
      changes: window.__radioChanges.slice(),
    }));

  /* ---------- 初始值来自 default-value ---------- */
  const initial = await snap();
  check(
    'default-value="b" 在挂载时选中对应子项；组 value property 读得到，初始不发 change',
    initial.b === true &&
      initial.a === false &&
      initial.c === false &&
      initial.value === 'b' &&
      initial.changes.length === 0,
    JSON.stringify(initial),
  );

  /* ---------- 真实点击：互斥 + 一次 change ---------- */
  await page.locator('#r-a').click();
  const clicked = await snap();
  check(
    '点 A：A 选中、B 取消（原生跨 shadow root 不成组，互斥由组做）',
    clicked.a === true && clicked.b === false && clicked.c === false && clicked.value === 'a',
    JSON.stringify(clicked),
  );
  check(
    'change 只在组上发一次，载荷 { value } 且冒到 document',
    clicked.changes.length === 1 &&
      clicked.changes[0].id === 'rg-a' &&
      clicked.changes[0].data?.value === 'a',
    JSON.stringify(clicked.changes),
  );

  /* ---------- 运行时值：property 写完（不 await）当次就读得到 ---------- */
  const immediate = await page.evaluate(() => {
    const group = document.getElementById('rg-a');
    const count = window.__radioChanges.length;
    group.value = 'c';
    const out = {
      prop: group.value,
      attr: group.getAttribute('value'),
      a: document.getElementById('r-a').checked,
      b: document.getElementById('r-b').checked,
      c: document.getElementById('r-c').checked,
      nativeC: document.getElementById('r-c').shadowRoot.querySelector('input').checked,
      emitted: window.__radioChanges.length - count,
    };
    group.value = ''; // 空串 = 一个都不选
    out.cleared = { a: document.getElementById('r-a').checked, c: document.getElementById('r-c').checked };
    group.value = 'c';
    return out;
  });
  check(
    'group.value = "c" 当次生效：宿主 property / 子项 checked / 内部原生 input 一起到位；空串清空选中',
    immediate.prop === 'c' &&
      immediate.attr === 'c' &&
      immediate.a === false &&
      immediate.c === true &&
      immediate.nativeC === true &&
      immediate.cleared.a === false &&
      immediate.cleared.c === false,
    JSON.stringify(immediate),
  );
  check(
    '程序化改 value 不发 change（跟原生 input.value 一个口径），事件只由用户交互产生',
    immediate.emitted === 0,
    `多发了 ${immediate.emitted} 条`,
  );

  /* ---------- 方向键：组内换选中 + 焦点跟着走 ---------- */
  await page.evaluate(() => {
    document.getElementById('r-a').shadowRoot.querySelector('input').focus();
  });
  await page.keyboard.press('ArrowDown');
  const byArrow = await page.evaluate(() => {
    const group = document.getElementById('rg-a');
    const b = document.getElementById('r-b');
    return {
      value: group.value,
      b: b.checked,
      focused: b.shadowRoot.activeElement === b.shadowRoot.querySelector('input'),
      changes: window.__radioChanges.slice(-1),
    };
  });
  check(
    '方向键在同一组内切换：选中下一格、焦点也交给它的内部原生 radio，并发一次 change',
    byArrow.value === 'b' &&
      byArrow.b === true &&
      byArrow.focused === true &&
      byArrow.changes[0]?.id === 'rg-a' &&
      byArrow.changes[0]?.data?.value === 'b',
    JSON.stringify(byArrow),
  );

  await page.keyboard.press('ArrowUp');
  const wrap = await page.evaluate(() => document.getElementById('rg-a').value);
  check('方向键反向切换（ArrowUp 回到上一格）', wrap === 'a', `现在是 ${wrap}`);

  /* ---------- 禁用：组禁用 / 单格禁用都不选中 ---------- */
  const beforeDisabled = await page.evaluate(() => window.__radioChanges.length);
  await page.locator('#r-p2').click({ force: true });
  const partDisabled = await page.evaluate((before) => {
    const radio = document.getElementById('r-p2');
    return {
      checked: radio.checked,
      groupValue: document.getElementById('rg-part').value,
      nativeDisabled: radio.shadowRoot.querySelector('input').disabled,
      emitted: window.__radioChanges.length - before,
      cursor: getComputedStyle(radio.shadowRoot.querySelector('.mc-base')).cursor,
    };
  }, beforeDisabled);
  check(
    '子项自己 disabled：内部原生 input 被禁用、点半格不选中也不发 change',
    partDisabled.checked === false &&
      partDisabled.groupValue === '' &&
      partDisabled.nativeDisabled === true &&
      partDisabled.emitted === 0 &&
      partDisabled.cursor === 'not-allowed',
    JSON.stringify(partDisabled),
  );

  await page.locator('#r-o1').click({ force: true });
  const groupDisabled = await page.evaluate(() => {
    const one = document.getElementById('r-o1');
    const two = document.getElementById('r-o2');
    return {
      groupValue: document.getElementById('rg-off').value,
      one: one.checked,
      nativeOne: one.shadowRoot.querySelector('input').disabled,
      nativeTwo: two.shadowRoot.querySelector('input').disabled,
      opacity: getComputedStyle(one).opacity,
      mirror: one.hasAttribute('data-group-disabled'),
    };
  });
  check(
    '组 disabled：整组转发原生 disabled（不是只 opacity）、点了也不改选中',
    groupDisabled.groupValue === 'a' &&
      groupDisabled.one === true &&
      groupDisabled.nativeOne === true &&
      groupDisabled.nativeTwo === true &&
      groupDisabled.opacity === '0.5' &&
      groupDisabled.mirror === true,
    JSON.stringify(groupDisabled),
  );

  /* 组禁用解除后要恢复可点（镜像与原生 disabled 都得跟着回来） */
  await page.evaluate(() => document.getElementById('rg-off').removeAttribute('disabled'));
  await page
    .waitForFunction(
      () => !document.getElementById('r-o2').shadowRoot.querySelector('input').disabled,
      undefined,
      { timeout: 4000 },
    )
    .catch(() => {});
  const reEnabled = await page.evaluate(() => ({
    nativeTwo: document.getElementById('r-o2').shadowRoot.querySelector('input').disabled,
    mirror: document.getElementById('r-o2').hasAttribute('data-group-disabled'),
  }));
  check(
    '组解除 disabled：子项的原生 input 与宿主镜像一起恢复',
    reEnabled.nativeTwo === false && reEnabled.mirror === false,
    JSON.stringify(reEnabled),
  );

  /* ---------- 键盘可达 / 读屏语义 ---------- */
  const a11y = await page.evaluate(() => {
    const group = document.getElementById('rg-a');
    const input = document.getElementById('r-a').shadowRoot.querySelector('input');
    return {
      tag: input.tagName,
      type: input.type,
      name: input.name,
      partName: document.getElementById('r-p1').shadowRoot.querySelector('input').name,
      role: group.getAttribute('role'),
      orientation: group.getAttribute('aria-orientation'),
      columnOrientation: document.getElementById('rg-sm').getAttribute('aria-orientation'),
    };
  });
  check(
    '语义白拿：内部是原生 input[type=radio]、共享组的 name；组补 role="radiogroup" + aria-orientation',
    a11y.tag === 'INPUT' &&
      a11y.type === 'radio' &&
      a11y.name === 'plan' &&
      a11y.partName === 'part' &&
      a11y.role === 'radiogroup' &&
      a11y.orientation === 'horizontal' &&
      a11y.columnOrientation === 'vertical',
    JSON.stringify(a11y),
  );

  /* ---------- 方向与尺寸：组的 size 靠自定义属性继承给子项 ---------- */
  const geometry = await page.evaluate(() => {
    const h = (id) => Math.round(document.getElementById(id).getBoundingClientRect().height);
    const font = (id) => getComputedStyle(document.getElementById(id)).fontSize;
    const dir = (id) =>
      getComputedStyle(document.getElementById(id).shadowRoot.querySelector('.mc-base'))
        .flexDirection;
    return {
      h: { sm: h('r-sm'), md: h('r-a'), lg: h('r-lg') },
      font: { sm: font('r-sm'), md: font('r-a'), lg: font('r-lg') },
      row: dir('rg-a'),
      column: dir('rg-sm'),
    };
  });
  check(
    '组的 size 继承到子项：28 / 36 / 44（--mc-control-h-*）与 12 / 14 / 16px（--mc-text-*）',
    geometry.h.sm === 28 &&
      geometry.h.md === 36 &&
      geometry.h.lg === 44 &&
      geometry.font.sm === '12px' &&
      geometry.font.md === '14px' &&
      geometry.font.lg === '16px',
    JSON.stringify({ h: geometry.h, font: geometry.font }),
  );
  check(
    'direction="column" 真的竖排（默认 row）',
    geometry.row === 'row' && geometry.column === 'column',
    JSON.stringify({ row: geometry.row, column: geometry.column }),
  );

  /* ---------- part：组的 base、子项的 base/circle/label，且 ::part() 真的改得到 ---------- */
  const parts = await page.evaluate(() => {
    const g = document.getElementById('rg-a').shadowRoot;
    const r = document.getElementById('r-a').shadowRoot;
    const circle = getComputedStyle(r.querySelector('[part="circle"]'));
    const base = getComputedStyle(g.querySelector('[part="base"]'));
    return {
      groupBase: !!g.querySelector('[part="base"]'),
      radioBase: !!r.querySelector('[part="base"]'),
      circle: !!r.querySelector('[part="circle"]'),
      label: !!r.querySelector('[part="label"]'),
      circleWidth: circle.width,
      circleRadius: circle.borderTopLeftRadius,
      groupGap: base.columnGap,
    };
  });
  check(
    'part="base"（组与子项）/ "circle" / "label" 都在，且 ::part() 真的改到了内部（圆圈变大 + 圆角变方）',
    parts.groupBase &&
      parts.radioBase &&
      parts.circle &&
      parts.label &&
      parts.circleWidth === '21px' &&
      parts.circleRadius === '2px' &&
      parts.groupGap === '24px',
    JSON.stringify(parts),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => {
    document.getElementById('radio-probe')?.remove();
    document.getElementById('radio-part-style')?.remove();
  });
}
