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
          if (!box || !list) return null;
          /* line 档期望值 = button 矩形扣掉左右内边距（指示条贴文字实际宽度） */
          const cs = getComputedStyle(base);
          const padL = parseFloat(cs.paddingLeft) || 0;
          const padR = parseFloat(cs.paddingRight) || 0;
          return {
            width: Math.round(box.width - padL - padR),
            x: Math.round(box.left - list.left + padL),
          };
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
    '指示条跟着激活项：line 档贴文字实际宽度（button 矩形扣掉左右内边距），位移也跟着内缩',
    initial.indicatorBox !== null &&
      initial.activeBox !== null &&
      Math.abs(initial.indicatorBox.width - initial.activeBox.width) <= 1 &&
      Math.abs(initial.indicatorBox.x - initial.activeBox.x) <= 1,
    JSON.stringify({ indicator: initial.indicatorBox, expect: initial.activeBox }),
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
        indicatorWidth: Math.round(parseFloat(indicator.style.width) || 0),
        indicatorBg: css(indicator).backgroundColor,
        display: css(list).display,
        borderBottom: css(list).borderBottomWidth,
        padding: css(list).paddingTop,
        radius: css(list).borderRadius,
        selectedBg: css(bases[0]).backgroundColor,
        idleBg: css(bases[1]).backgroundColor,
        selectedShadow: css(bases[0]).boxShadow,
        height: Math.round(bases[0].getBoundingClientRect().height),
        /* 轨道宽 / 容器宽：segmented 档应收缩到内容宽，line 档横贯整行 */
        listWidth: Math.round(list.getBoundingClientRect().width),
        hostWidth: Math.round(tabs.getBoundingClientRect().width),
      };
    };
    const out = { line: read(line), segmented: read(segmented) };
    for (const host of document.querySelectorAll('.tabs-look-probe')) host.remove();
    return out;
  });
  check(
    '默认档 line：下划线指示条在、标签条横贯整行、选中项透明',
    looks.line.indicator !== 'none' &&
      looks.line.borderBottom === '1px' &&
      looks.line.selectedBg === 'rgba(0, 0, 0, 0)' &&
      Math.abs(looks.line.listWidth - looks.line.hostWidth) <= 1,
    JSON.stringify(looks.line),
  );
  check(
    'variant="segmented"：分段切换器 —— 轨道收缩到内容宽不撑满整行、指示条当滑动浮块（量到激活标签的宽、自己带选中底色）、标签不再自画选中样式、标签变矮',
    looks.segmented.value === 'a' &&
      looks.segmented.indicator !== 'none' &&
      looks.segmented.indicatorWidth > 0 &&
      looks.segmented.indicatorBg !== 'rgba(0, 0, 0, 0)' &&
      looks.segmented.borderBottom === '0px' &&
      looks.segmented.display === 'flex' && // inline-flex 作为外壳 flex 子项被 blockification 成 flex，尺寸看 flex: 0 1 auto
      looks.segmented.listWidth < looks.segmented.hostWidth &&
      looks.segmented.padding === '2px' &&
      looks.segmented.radius === '6px' &&
      looks.segmented.selectedBg === 'rgba(0, 0, 0, 0)' &&
      looks.segmented.idleBg === 'rgba(0, 0, 0, 0)' &&
      looks.segmented.selectedShadow === 'none' &&
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

  /* ---------- 溢出：子项总宽超过容器 → 标签条横向滚动、激活项滚进可视区、指示条跟准 ---------- */
  const overflow = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.className = 'tabs-overflow-probe';
    host.style.width = '180px';
    host.innerHTML =
      '<mc-tabs id="p-tabs-of" default-value="a">' +
      ['一', '二', '三', '四', '五']
        .map((n, i) => `<mc-tab value="t${i}" name="第${n}个很长的标签">面板 ${n}</mc-tab>`)
        .join('') +
      '</mc-tabs>';
    document.body.append(host);
    await new Promise((r) => setTimeout(r, 400));
    const tabs = host.querySelector('#p-tabs-of');
    const list = tabs.shadowRoot.querySelector('.mc-list');
    const read = () => ({
      scrollWidth: list.scrollWidth,
      clientWidth: list.clientWidth,
      scrollLeft: list.scrollLeft,
      hostWidth: Math.round(host.getBoundingClientRect().width),
      hostScrollWidth: host.scrollWidth, // 页面没被撑破
    });
    const before = read();
    /* 点最后一个（在可视区外）标签 */
    const last = [...tabs.querySelectorAll('mc-tab')].pop();
    last.shadowRoot.querySelector('.mc-base').click();
    await new Promise((r) => setTimeout(r, 300));
    const after = read();
    /* 指示条写在内容系上：期望值 = 激活按钮视口差 + scrollLeft + 左内边距（line 档贴文字） */
    const base = last.shadowRoot.querySelector('.mc-base');
    const rect = base.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const padL = parseFloat(getComputedStyle(base).paddingLeft) || 0;
    const expectX = Math.round(rect.left - listRect.left + list.scrollLeft + padL);
    const indicator = tabs.shadowRoot.querySelector('.mc-indicator');
    const indicatorX = Math.round(
      parseFloat((indicator.style.transform.match(/-?[\d.]+/) ?? ['0'])[0]),
    );
    host.remove();
    return {
      before,
      after,
      indicatorX,
      expectX,
      indicatorWidth: Math.round(parseFloat(indicator.style.width) || 0),
      baseWidth: Math.round(rect.width),
    };
  });
  check(
    '子项总宽超出容器：标签条自身横向滚动不撑破布局，激活项自动滚进可视区，指示条在内容系上跟准激活项',
    overflow.before.scrollWidth > overflow.before.clientWidth &&
      overflow.before.hostWidth === 180 &&
      overflow.before.scrollLeft === 0 &&
      overflow.after.scrollLeft > 0 &&
      overflow.after.hostScrollWidth <= 181 &&
      overflow.indicatorWidth > 0 &&
      Math.abs(overflow.indicatorX - overflow.expectX) <= 1,
    JSON.stringify(overflow),
  );

  /* ---------- 溢出导航：默认左右箭头，prefix / suffix 插槽可替换，点击滚动 ---------- */
  const navProbe = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.className = 'tabs-nav-probe';
    host.style.width = '180px';
    /* 标签取中等宽度：明显放不下一屏（触发溢出），又明显窄于一屏（不踩「比可视区还宽」的边界） */
    host.innerHTML =
      '<mc-tabs id="p-tabs-nav" default-value="a">' +
      '<span slot="prefix" id="p-nav-custom">«自定义</span>' +
      ['一', '二', '三', '四', '五', '六']
        .map((n, i) => `<mc-tab value="t${i}" name="第${n}个标签">面板 ${n}</mc-tab>`)
        .join('') +
      '</mc-tabs>' +
      '<mc-tabs id="p-tabs-nav-fit" default-value="a">' +
      '<mc-tab value="a" name="A">面板 A</mc-tab><mc-tab value="b" name="B">面板 B</mc-tab>' +
      '</mc-tabs>';
    document.body.append(host);
    await new Promise((r) => setTimeout(r, 400));
    const tabs = host.querySelector('#p-tabs-nav');
    const list = tabs.shadowRoot.querySelector('.mc-list');
    const startNav = tabs.shadowRoot.querySelector('.mc-nav.is-start');
    const endNav = tabs.shadowRoot.querySelector('.mc-nav.is-end');
    const fitTabs = host.querySelector('#p-tabs-nav-fit');
    /* smooth 滚动是异步的：等到 scrollLeft 连续两拍不变（或超时）再读 */
    const waitScrollSettled = async () => {
      for (let i = 0, last = NaN; i < 40; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        const now = list.scrollLeft;
        if (now === last) break;
        last = now;
      }
    };
    const initial = {
      overflow: list.scrollWidth > list.clientWidth,
      scrollLeft: Math.round(list.scrollLeft),
      startHidden: startNav.hidden,
      startEdge: startNav.classList.contains('is-edge'),
      endHidden: endNav.hidden,
      endEdge: endNav.classList.contains('is-edge'),
      /* prefix 塞了自定义内容：默认箭头隐藏（display:none），end 侧默认箭头照常显示。
         插槽内容是 light DOM（仍在 mc-tabs 元素下），只能从宿主上查。 */
      startDefaultHidden:
        getComputedStyle(startNav.querySelector('.mc-nav-btn')).display === 'none' &&
        !!tabs.querySelector('#p-nav-custom'),
      endDefaultShown: getComputedStyle(endNav.querySelector('.mc-nav-btn')).display !== 'none',
      /* 贴左缘时 start 侧在边上，但那边是自定义插槽内容 —— 自定义内容不跟着禁用：
         不淡、不被 pointer-events 挡住（外壳自己不设禁用态，只禁内置箭头） */
      startCustomNormal: (() => {
        const custom = tabs.querySelector('#p-nav-custom');
        const cs = getComputedStyle(custom);
        return Number(cs.opacity) === 1 && cs.pointerEvents !== 'none';
      })(),
      startBtnDisabled: startNav.querySelector('.mc-nav-btn').disabled,
      endBtnDisabled: endNav.querySelector('.mc-nav-btn').disabled,
      /* 不溢出的那颗：导航整侧隐藏 */
      fitNavHidden: fitTabs.shadowRoot.querySelector('.mc-nav.is-start').hidden,
    };
    /* 点右侧默认箭头 → 向后滚 */
    endNav.querySelector('.mc-nav-btn').click();
    await waitScrollSettled();
    const scrolled = {
      scrollLeft: Math.round(list.scrollLeft),
      startEdgeAfter: startNav.classList.contains('is-edge'),
    };
    /* 点自定义插槽内容 → 同样触发滚动（外壳统一接管；light DOM 上的点击冒泡穿透 slot） */
    const before = Math.round(list.scrollLeft);
    tabs.querySelector('#p-nav-custom').click();
    await waitScrollSettled();
    const customClick = { before, after: Math.round(list.scrollLeft) };
    /* 拖到最右：end 侧内置箭头淡出禁用而不是消失（按钮还在、变淡、disabled） */
    list.scrollLeft = list.scrollWidth;
    await waitScrollSettled();
    const atEnd = {
      endEdge: endNav.classList.contains('is-edge'),
      endBtnDisabled: endNav.querySelector('.mc-nav-btn').disabled,
      endBtnFaded: Number(getComputedStyle(endNav.querySelector('.mc-nav-btn')).opacity) < 1,
      endNavVisible:
        getComputedStyle(endNav).display !== 'none' &&
        getComputedStyle(endNav).visibility !== 'hidden',
      startDisabled: startNav.querySelector('.mc-nav-btn').disabled,
    };
    host.remove();
    return { initial, scrolled, customClick, atEnd };
  });
  check(
    '溢出导航：两侧箭头溢出才出现（不溢出隐藏）、prefix 插槽替换默认箭头、点箭头/自定义内容都能滚动、初始贴左缘',
    navProbe.initial.overflow &&
      navProbe.initial.scrollLeft === 0 &&
      !navProbe.initial.startHidden &&
      navProbe.initial.startEdge &&
      !navProbe.initial.endHidden &&
      !navProbe.initial.endEdge &&
      navProbe.initial.startDefaultHidden &&
      navProbe.initial.endDefaultShown &&
      navProbe.initial.fitNavHidden &&
      navProbe.scrolled.scrollLeft > navProbe.initial.scrollLeft &&
      !navProbe.scrolled.startEdgeAfter &&
      navProbe.customClick.after < navProbe.customClick.before,
    JSON.stringify(navProbe),
  );
  check(
    '到边那侧只禁内置箭头、不隐藏也不碰自定义内容：箭头淡出 + disabled 且占位还在，prefix 插槽内容照常可点',
    navProbe.initial.startCustomNormal &&
      navProbe.initial.startBtnDisabled &&
      !navProbe.initial.endBtnDisabled &&
      navProbe.atEnd.endEdge &&
      navProbe.atEnd.endNavVisible &&
      navProbe.atEnd.endBtnFaded &&
      navProbe.atEnd.endBtnDisabled &&
      !navProbe.atEnd.startDisabled,
    JSON.stringify({
      initial: navProbe.initial,
      atEnd: navProbe.atEnd,
    }),
  );

  /* ---------- 悬停：不铺底色，文字变主题色（与选中项同色） ---------- */
  const hoverProbe = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'tabs-hover-probe';
    host.style.cssText =
      'position:fixed;left:0;top:240px;z-index:99999;background:#fff;padding:8px;width:420px';
    host.innerHTML =
      '<mc-tabs id="p-tabs-hover" default-value="a">' +
      '<mc-tab id="p-hover-a" value="a" name="编辑">面板 A</mc-tab>' +
      '<mc-tab id="p-hover-b" value="b" name="预览">面板 B</mc-tab>' +
      '</mc-tabs>';
    document.body.append(host);
    await new Promise((r) => setTimeout(r, 400));
    const read = (id) => {
      const base = document.getElementById(id)?.shadowRoot?.querySelector('.mc-base');
      const cs = getComputedStyle(base);
      return { color: cs.color, bg: cs.backgroundColor };
    };
    return { idle: read('p-hover-b'), active: read('p-hover-a') };
  });
  await page.hover('#p-hover-b');
  await new Promise((r) => setTimeout(r, 400)); // 等 color 的 transition 落定
  const hovered = await page.evaluate(() => {
    const base = document.getElementById('p-hover-b')?.shadowRoot?.querySelector('.mc-base');
    const cs = getComputedStyle(base);
    return { color: cs.color, bg: cs.backgroundColor };
  });
  await page.evaluate(() => document.getElementById('tabs-hover-probe')?.remove());
  check(
    '悬停：标签不铺底色，文字变主题色（与选中项同色）',
    hoverProbe.idle.bg === 'rgba(0, 0, 0, 0)' &&
      hovered.bg === 'rgba(0, 0, 0, 0)' &&
      hovered.color === hoverProbe.active.color &&
      hovered.color !== hoverProbe.idle.color,
    JSON.stringify({ ...hoverProbe, hovered }),
  );

  /* ---------- 光标：可点区只有标签按钮，子项之间的 gap 不继承外层的 pointer ---------- */
  const cursorProbe = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'tabs-cursor-probe';
    // 外层设 pointer 模拟「可点击卡片 / 文档示例壳」，组件不能把这段继承进标签条缝隙
    host.style.cssText = 'cursor:pointer;width:420px;background:#fff;padding:8px';
    host.innerHTML =
      '<mc-tabs id="p-tabs-cursor" default-value="a">' +
      '<mc-tab value="a" name="编辑">面板 A</mc-tab>' +
      '<mc-tab value="b" name="预览">面板 B</mc-tab>' +
      '</mc-tabs>' +
      '<mc-tabs id="p-tabs-cursor-seg" variant="segmented" no-panel default-value="a">' +
      '<mc-tab value="a" name="编辑"></mc-tab>' +
      '<mc-tab value="b" name="预览"></mc-tab>' +
      '</mc-tabs>';
    document.body.append(host);
    await new Promise((r) => setTimeout(r, 400));
    const read = (id) => {
      const tabs = document.getElementById(id);
      const list = tabs.shadowRoot.querySelector('.mc-list');
      const base = tabs.querySelector('mc-tab[value="b"]').shadowRoot.querySelector('.mc-base');
      return { list: getComputedStyle(list).cursor, base: getComputedStyle(base).cursor };
    };
    return { host: getComputedStyle(host).cursor, line: read('p-tabs-cursor'), seg: read('p-tabs-cursor-seg') };
  });
  await page.evaluate(() => document.getElementById('tabs-cursor-probe')?.remove());
  check(
    '光标：外层 pointer 不会被标签条的 gap 继承（两档缝隙都是箭头，标签按钮仍是手型）',
    cursorProbe.host === 'pointer' &&
      cursorProbe.line.list === 'default' &&
      cursorProbe.line.base === 'pointer' &&
      cursorProbe.seg.list === 'default' &&
      cursorProbe.seg.base === 'pointer',
    JSON.stringify(cursorProbe),
  );

  /* ---------- 收摊 ---------- */
  await page.evaluate(() => document.getElementById('tabs-probe')?.remove());
  page.off('response', onResponse);
  page.off('pageerror', onError);
}
