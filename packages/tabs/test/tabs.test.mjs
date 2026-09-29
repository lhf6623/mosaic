/**
 * mc-tabs / mc-tab · 标签页：初始值、点击切换、value property、方向键、change 载荷、
 * aria 与 roving tabindex、禁用不可选（packages/tabs）。
 */

export default async function run({ page, visit, check }) {
  /* ------------------------------------------------------------------ *
   * 文档页：注册两个标签（页面自己的 <l-m>），再往页面里搭探针
   * ------------------------------------------------------------------ */
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?tabs=1#/packages/tabs/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-tabs') && !!customElements.get('mc-tab'), {
      timeout: 8000,
    })
    .catch(() => {});

  /* 现搭现拆探针：页面自己的演示不保证有禁用项，量完最后一个 evaluate 删掉 */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'tabs-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;width:520px';
    host.innerHTML = `
      <mc-tabs id="p-tabs" default-value="b">
        <mc-tab id="p-tab-a" value="a">标签 A</mc-tab>
        <mc-tab id="p-tab-b" value="b">标签 B</mc-tab>
        <mc-tab id="p-tab-c" value="c" disabled>标签 C</mc-tab>
        <div id="p-panel-a" slot="panel" value="a">面板 A</div>
        <div id="p-panel-b" slot="panel" value="b">面板 B</div>
        <div id="p-panel-c" slot="panel" value="c">面板 C</div>
      </mc-tabs>`;
    document.body.append(host);
    window.__tabsChanges = [];
    document.addEventListener('change', (e) => window.__tabsChanges.push(e.data?.value));
  });
  await page
    .waitForFunction(
      () => {
        const tabs = document.querySelector('#p-tabs');
        return (
          tabs?.shadowRoot &&
          [...tabs.querySelectorAll('mc-tab')].every(
            (tab) => tab.shadowRoot?.querySelector('.mc-base'),
          )
        );
      },
      { timeout: 8000 },
    )
    .catch(() => {});
  /* 指示条是 transition 出来的：量 rect 要等目标值写上、过渡走完，否则拿到的是动画中间值。
     断言看的是组件写进 style 的目标值（确定），不是过渡中的渲染值。 */
  await page
    .waitForFunction(
      () => {
        const indicator = document.querySelector('#p-tabs')?.shadowRoot?.querySelector('.mc-indicator');
        return !!indicator && parseFloat(indicator.style.width) > 0;
      },
      { timeout: 5000 },
    )
    .catch(() => {});
  await page.waitForTimeout(300);

  /** 探针当前状态：标签 / 面板 / aria 三处一起读，避免只对了一半 */
  const snapshot = () =>
    page.evaluate(() => {
      const tabs = document.querySelector('#p-tabs');
      const tabEls = [...tabs.querySelectorAll('mc-tab')];
      const panelEls = [...tabs.querySelectorAll('[slot="panel"]')];
      const bases = tabEls.map((tab) => tab.shadowRoot.querySelector('.mc-base'));
      const indicator = tabs.shadowRoot.querySelector('.mc-indicator');
      return {
        value: tabs.value,
        upgraded: !!tabs.shadowRoot && tabEls.every((tab) => !!tab.shadowRoot),
        selected: tabEls.map((tab) => tab.hasAttribute('selected')),
        hidden: panelEls.map((panel) => panel.hasAttribute('hidden')),
        display: panelEls.map((panel) => getComputedStyle(panel).display),
        ariaSelected: bases.map((base) => base.getAttribute('aria-selected')),
        tabIndex: bases.map((base) => base.tabIndex),
        role: bases.map((base) => base.getAttribute('role')),
        controls: bases.map((base) => base.getAttribute('aria-controls')),
        panelRole: panelEls.map((panel) => panel.getAttribute('role')),
        panelCount: panelEls.length,
        disabled: bases.map((base) => base.disabled),
        indicatorBox: indicator
          ? {
              width: Math.round(parseFloat(indicator.style.width)),
              x: Math.round(parseFloat((indicator.style.transform.match(/-?[\d.]+/) ?? ['0'])[0])),
            }
          : null,
        activeBox: (() => {
          const base = bases[tabEls.findIndex((tab) => tab.hasAttribute('selected'))];
          const box = base?.getBoundingClientRect();
          const list = tabs.shadowRoot.querySelector('.mc-list')?.getBoundingClientRect();
          return box && list
            ? { width: Math.round(box.width), x: Math.round(box.left - list.left) }
            : null;
        })(),
        changes: window.__tabsChanges.slice(),
      };
    });

  const initial = await snapshot();
  check(
    'mc-tabs / mc-tab 注册并渲染（容器与标签都有 shadow root）',
    initial.upgraded,
    JSON.stringify({ upgraded: initial.upgraded, value: initial.value }),
  );
  check(
    'default-value="b"：b 被选中、只有 b 的面板可见（非激活的挂 hidden，但仍在 DOM 里）',
    initial.value === 'b' &&
      JSON.stringify(initial.selected) === JSON.stringify([false, true, false]) &&
      JSON.stringify(initial.hidden) === JSON.stringify([true, false, true]) &&
      JSON.stringify(initial.display) === JSON.stringify(['none', 'block', 'none']) &&
      initial.panelCount === 3,
    JSON.stringify({
      selected: initial.selected,
      hidden: initial.hidden,
      display: initial.display,
    }),
  );
  check(
    'aria：role=tab/tabpanel、aria-selected、aria-controls→面板 id、roving tabindex（只有选中项是 0）',
    JSON.stringify(initial.role) === JSON.stringify(['tab', 'tab', 'tab']) &&
      JSON.stringify(initial.ariaSelected) === JSON.stringify(['false', 'true', 'false']) &&
      JSON.stringify(initial.tabIndex) === JSON.stringify([-1, 0, -1]) &&
      initial.controls.every((id) => typeof id === 'string' && id.length > 0) &&
      new Set(initial.controls).size === 3 &&
      JSON.stringify(initial.panelRole) === JSON.stringify(['tabpanel', 'tabpanel', 'tabpanel']),
    JSON.stringify(initial),
  );
  check(
    '指示条跟着激活项：宽度 / 位移就是选中标签内部那颗 button 的宽度与左偏移',
    initial.indicatorBox !== null &&
      initial.activeBox !== null &&
      Math.abs(initial.indicatorBox.width - initial.activeBox.width) <= 1 &&
      Math.abs(initial.indicatorBox.x - initial.activeBox.x) <= 1,
    JSON.stringify({ indicator: initial.indicatorBox, active: initial.activeBox }),
  );

  /* ---------- 真实点击：切到 a，change 只在这时发 ---------- */
  await page.locator('#p-tab-a button').click();
  await page.waitForFunction(() => document.querySelector('#p-tabs').value === 'a', {
    timeout: 3000,
  }).catch(() => {});
  await page.waitForTimeout(300); // 等指示条的过渡走完再读目标值
  const clicked = await snapshot();
  check(
    '点击标签切换面板，并在 mc-tabs 上发 change（载荷 { value }，composed 冒到 document）',
    clicked.value === 'a' &&
      JSON.stringify(clicked.selected) === JSON.stringify([true, false, false]) &&
      JSON.stringify(clicked.display) === JSON.stringify(['block', 'none', 'none']) &&
      JSON.stringify(clicked.changes) === JSON.stringify(['a']),
    JSON.stringify({ value: clicked.value, changes: clicked.changes }),
  );

  /* ---------- value property：立刻切换、读回当前值、不发 change ---------- */
  const byProp = await page.evaluate(() => {
    const tabs = document.querySelector('#p-tabs');
    tabs.value = 'b';
    return {
      read: tabs.value,
      selected: [...tabs.querySelectorAll('mc-tab')].map((tab) => tab.hasAttribute('selected')),
      hasAttr: tabs.hasAttribute('value'),
      changes: window.__tabsChanges.slice(),
    };
  });
  check(
    'el.value = "b" 立刻生效、读回当前值、不反射成属性、不发 change',
    byProp.read === 'b' &&
      JSON.stringify(byProp.selected) === JSON.stringify([false, true, false]) &&
      !byProp.hasAttr &&
      JSON.stringify(byProp.changes) === JSON.stringify(['a']),
    JSON.stringify(byProp),
  );

  /* ---------- 键盘：方向键移动并激活，跳过禁用项，Home / End 到头尾 ---------- */
  await page.locator('#p-tab-b button').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#p-tabs').value === 'a', {
    timeout: 3000,
  }).catch(() => {});
  const afterRight = await page.evaluate(() => ({
    value: document.querySelector('#p-tabs').value,
    focused: [...document.querySelectorAll('#p-tabs mc-tab')].map(
      (tab) => tab.shadowRoot.activeElement?.tagName ?? null,
    ),
    changes: window.__tabsChanges.slice(),
  }));
  await page.keyboard.press('Home');
  await page.waitForTimeout(120);
  await page.keyboard.press('End');
  await page.waitForTimeout(120);
  const afterEnd = await page.evaluate(() => ({
    value: document.querySelector('#p-tabs').value,
    active: [...document.querySelectorAll('#p-tabs mc-tab')].findIndex(
      (tab) => !!tab.shadowRoot.activeElement,
    ),
    changes: window.__tabsChanges.slice(),
  }));
  check(
    'ArrowRight 从 b 跳过禁用的 c 绕回 a：值、焦点、change 三者一致',
    afterRight.value === 'a' &&
      afterRight.focused[0] === 'BUTTON' &&
      JSON.stringify(afterRight.changes) === JSON.stringify(['a', 'a']),
    JSON.stringify(afterRight),
  );
  check(
    'Home / End 落到头尾那个可用标签（c 禁用，所以 End 是 b 而不是 c）',
    afterEnd.value === 'b' && afterEnd.active === 1,
    JSON.stringify(afterEnd),
  );

  /* ---------- 禁用项：原生 button 就是 disabled，点不动也选不上 ---------- */
  const disabled = await page.evaluate(() => {
    const tabs = document.querySelector('#p-tabs');
    const tab = document.querySelector('#p-tab-c');
    const before = tabs.value;
    tab.shadowRoot.querySelector('.mc-base').click();
    return {
      disabled: tab.shadowRoot.querySelector('.mc-base').disabled,
      before,
      after: tabs.value,
      selected: tab.hasAttribute('selected'),
    };
  });
  check(
    'disabled 标签：内部原生 button 就是 disabled，点击不改值、也不会被选中',
    disabled.disabled && disabled.after === disabled.before && !disabled.selected,
    JSON.stringify(disabled),
  );

  /* ---------- 面板常驻 DOM：切走再切回来还是同一批节点 ---------- */
  const persisted = await page.evaluate(() => {
    const tabs = document.querySelector('#p-tabs');
    const before = [...tabs.querySelectorAll('[slot="panel"]')];
    tabs.value = tabs.value === 'a' ? 'b' : 'a';
    const after = [...tabs.querySelectorAll('[slot="panel"]')];
    return {
      count: after.length,
      same: before.length === after.length && before.every((node, i) => node === after[i]),
    };
  });
  check(
    '非激活面板用 hidden 常驻 DOM（节点不被删/重建）',
    persisted.count === 3 && persisted.same,
    JSON.stringify(persisted),
  );

  /* ---------- 动态创建（P31 那条路径）：attrs 不含保留名、构造期不写宿主属性 ---------- */
  const created = await page.evaluate(async () => {
    const tabs = document.createElement('mc-tabs');
    tabs.innerHTML =
      '<mc-tab value="x">X</mc-tab><div slot="panel" value="x">面板 X</div>';
    document.body.append(tabs);
    await new Promise((r) => setTimeout(r, 300));
    const out = {
      shadow: !!tabs.shadowRoot,
      value: tabs.value,
      hidden: tabs.querySelector('[slot="panel"]').hasAttribute('hidden'),
      display: getComputedStyle(tabs.querySelector('[slot="panel"]')).display,
    };
    tabs.remove();
    return out;
  });
  check(
    'document.createElement 创建（未写任何属性）也照常初始化：回落到第一个可用标签',
    created.shadow && created.value === 'x' && !created.hidden && created.display === 'block',
    JSON.stringify(created),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('tabs-probe')?.remove());
  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('mc-tabs 文档页没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
