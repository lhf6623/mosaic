/**
 * mc-tabs / mc-tab · 标签页：初始值、点击切换、value property、方向键、change 载荷、
 * roving tabindex、禁用不可选、name 标签 + 面板搬家、外观两档（line / segmented）、no-panel（packages/tabs）。
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
        <mc-tab id="p-tab-a" value="a" name="标签 A">面板 A</mc-tab>
        <mc-tab id="p-tab-b" value="b" name="标签 B">面板 B</mc-tab>
        <mc-tab id="p-tab-c" value="c" name="标签 C" disabled>面板 C</mc-tab>
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
          ) &&
          tabs.querySelectorAll('[slot="panel"]').length === 3
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

  /** 探针当前状态：标签 / 面板 / tabindex 三处一起读，避免只对了一半 */
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
        labels: bases.map((base) => base.textContent.trim()),
        tabText: tabEls.map((tab) => tab.textContent.trim()),
        panelTexts: panelEls.map((panel) => panel.textContent.trim()),
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
    'name 渲染成标签文案；mc-tab 默认插槽内容被搬进自动生成的 panel 包装节点（仍在 light DOM）',
    JSON.stringify(initial.labels) === JSON.stringify(['标签 A', '标签 B', '标签 C']) &&
      JSON.stringify(initial.tabText) === JSON.stringify(['', '', '']) &&
      initial.panelTexts.includes('面板 A') &&
      initial.panelTexts.includes('面板 B') &&
      initial.panelTexts.includes('面板 C'),
    JSON.stringify({ labels: initial.labels, tabText: initial.tabText, panels: initial.panelTexts }),
  );
  check(
    '不写 role / aria-*：roving tabindex 仍然只有选中项是 0',
    initial.role.every((r) => r === null) &&
      initial.ariaSelected.every((v) => v === null) &&
      initial.controls.every((v) => v === null) &&
      initial.panelRole.every((v) => v === null) &&
      JSON.stringify(initial.tabIndex) === JSON.stringify([-1, 0, -1]),
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

  /* ---------- 后加内容：mc-tab 里新增的节点也会被搬进面板包装 ---------- */
  const appended = await page.evaluate(async () => {
    const tab = document.querySelector('#p-tabs mc-tab[value="c"]');
    const extra = document.createElement('span');
    extra.id = 'p-late';
    extra.textContent = '后加的内容';
    tab.append(extra);
    await new Promise((r) => setTimeout(r, 300));
    const panel = document.querySelector('#p-tabs > [slot="panel"][value="c"]');
    return {
      tabText: tab.textContent.trim(),
      moved: !!panel?.querySelector('#p-late'),
      panelText: panel?.textContent.trim() ?? '',
    };
  });
  check(
    '后加进 mc-tab 的内容也会被搬进面板：mc-tab 自身不残留文本，面板里能拿到',
    appended.tabText === '' &&
      appended.moved &&
      appended.panelText.includes('后加的内容'),
    JSON.stringify(appended),
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
    tabs.innerHTML = '<mc-tab value="x" name="X">面板 X</mc-tab>';
    document.body.append(tabs);
    await new Promise((r) => setTimeout(r, 300));
    const panel = tabs.querySelector('[slot="panel"]');
    const out = {
      shadow: !!tabs.shadowRoot,
      value: tabs.value,
      label: tabs.querySelector('mc-tab').shadowRoot.querySelector('.mc-base').textContent.trim(),
      hidden: panel.hasAttribute('hidden'),
      display: getComputedStyle(panel).display,
      panelText: panel.textContent.trim(),
    };
    tabs.remove();
    return out;
  });
  check(
    'document.createElement 创建（未写任何属性）也照常初始化：label / 面板都接上，回落到第一个可用标签',
    created.shadow &&
      created.value === 'x' &&
      created.label === 'X' &&
      !created.hidden &&
      created.display === 'block' &&
      created.panelText === '面板 X',
    JSON.stringify(created),
  );

  /* ---------- 外观档：variant 只换标签条的样子，line（默认）与 segmented 两档 ---------- */
  const looks = await page.evaluate(async () => {
    const mount = (variant) => {
      const host = document.createElement('div');
      host.className = 'tabs-look-probe';
      host.innerHTML =
        '<mc-tabs' +
        (variant ? ' variant="' + variant + '"' : '') +
        ' default-value="a">' +
        '<mc-tab value="a" name="编辑">面板 A</mc-tab>' +
        '<mc-tab value="b" name="预览">面板 B</mc-tab>' +
        '</mc-tabs>';
      document.body.append(host);
      return host.querySelector('mc-tabs');
    };
    const line = mount('');
    const segmented = mount('segmented');
    await new Promise((r) => setTimeout(r, 400));
    const read = (tabs) => {
      const list = tabs.shadowRoot.querySelector('.mc-list');
      const indicator = tabs.shadowRoot.querySelector('.mc-indicator');
      const bases = [...tabs.querySelectorAll('mc-tab')].map((tab) =>
        tab.shadowRoot?.querySelector('.mc-base'),
      );
      const css = (el) => (el ? getComputedStyle(el) : null);
      return {
        value: tabs.value,
        indicator: css(indicator).display,
        display: css(list).display,
        borderBottom: css(list).borderBottomWidth,
        padding: css(list).paddingTop,
        radius: css(list).borderRadius,
        selectedBg: css(bases[0]).backgroundColor,
        idleBg: css(bases[1]).backgroundColor,
        selectedShadow: css(bases[0]).boxShadow,
        height: Math.round(bases[0].getBoundingClientRect().height),
      };
    };
    const out = { line: read(line), segmented: read(segmented) };
    for (const host of document.querySelectorAll('.tabs-look-probe')) host.remove();
    return out;
  });
  check(
    '默认档 line：下划线指示条在、标签条有下边线、选中项透明',
    looks.line.indicator !== 'none' &&
      looks.line.borderBottom === '1px' &&
      looks.line.selectedBg === 'rgba(0, 0, 0, 0)',
    JSON.stringify(looks.line),
  );
  check(
    'variant="segmented"：分段切换器 —— 指示条收起、轨道浅底、选中项浮起、标签变矮',
    looks.segmented.value === 'a' &&
      looks.segmented.indicator === 'none' &&
      looks.segmented.borderBottom === '0px' &&
      looks.segmented.display === 'inline-flex' &&
      looks.segmented.padding === '2px' &&
      looks.segmented.radius === '6px' &&
      looks.segmented.selectedBg !== 'rgba(0, 0, 0, 0)' &&
      looks.segmented.idleBg === 'rgba(0, 0, 0, 0)' &&
      looks.segmented.selectedShadow !== 'none' &&
      looks.segmented.height < looks.line.height,
    JSON.stringify(looks),
  );

  /* ---------- no-panel：只要一颗分段切换器，不渲染面板区 ---------- */
  const noPanel = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.className = 'tabs-nopanel-probe';
    host.innerHTML =
      '<mc-tabs id="p-tabs-np" variant="segmented" no-panel default-value="a">' +
      '<mc-tab value="a" name="编辑">这段不显示</mc-tab>' +
      '<mc-tab value="b" name="预览">也不显示</mc-tab>' +
      '</mc-tabs>';
    document.body.append(host);
    await new Promise((r) => setTimeout(r, 400));
    const tabs = host.querySelector('#p-tabs-np');
    const hostPanel = tabs.shadowRoot.querySelector('.mc-panel');
    const tabEls = [...tabs.querySelectorAll('mc-tab')];
    const before = {
      panelDisplay: getComputedStyle(hostPanel).display,
      panelCount: tabs.querySelectorAll('[slot="panel"]').length,
      labels: tabEls.map((tab) => tab.shadowRoot?.querySelector('.mc-base')?.textContent.trim()),
      contentKept: tabEls.map((tab) => tab.textContent.trim()),
    };
    tabEls[1].shadowRoot.querySelector('.mc-base').click();
    await new Promise((r) => setTimeout(r, 200));
    const after = {
      value: tabs.value,
      selected: tabEls.map((tab) => tab.hasAttribute('selected')),
    };
    host.remove();
    return { before, after };
  });
  check(
    'no-panel：面板区不显示、不生成面板包装；标签照常切换（纯分段切换器）',
    noPanel.before.panelDisplay === 'none' &&
      noPanel.before.panelCount === 0 &&
      JSON.stringify(noPanel.before.labels) === JSON.stringify(['编辑', '预览']) &&
      JSON.stringify(noPanel.before.contentKept) === JSON.stringify(['这段不显示', '也不显示']) &&
      noPanel.after.value === 'b' &&
      JSON.stringify(noPanel.after.selected) === JSON.stringify([false, true]),
    JSON.stringify(noPanel),
  );

  /* ---------- no-panel="false"（ofa 布尔绑定的写法）要归一化摘掉，面板照常渲染 ---------- */
  const noPanelOff = await page.evaluate(async () => {
    const tabs = document.createElement('mc-tabs');
    tabs.setAttribute('no-panel', 'false');
    tabs.innerHTML = '<mc-tab value="a" name="A">面板 A</mc-tab>';
    document.body.append(tabs);
    await new Promise((r) => setTimeout(r, 300));
    const out = {
      hasAttr: tabs.hasAttribute('no-panel'),
      panelDisplay: getComputedStyle(tabs.shadowRoot.querySelector('.mc-panel')).display,
      panelCount: tabs.querySelectorAll('[slot="panel"]').length,
    };
    tabs.remove();
    return out;
  });
  check(
    'no-panel="false" 归一化摘掉：面板区照常渲染（P31）',
    !noPanelOff.hasAttr && noPanelOff.panelDisplay === 'block' && noPanelOff.panelCount === 1,
    JSON.stringify(noPanelOff),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('tabs-probe')?.remove());
  page.off('response', onResponse);
  page.off('pageerror', onError);
}
