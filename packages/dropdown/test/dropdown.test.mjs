/**
 * mc-dropdown · 下拉菜单：浮层（原生 popover + CSS 锚点定位）、三种开合入口
 * （触发元素 / 点外部 / Esc）、open 属性受控、placement、复用 mc-menu-item。
 *
 * 跑法：node tests/smoke.mjs dropdown（需先 pnpm dev）
 *
 * ⚠️ 盯的都是「静默失效」型问题：
 *   · 点外部判定必须用 composedPath（P20），contains(e.target) 必然误判
 *   · 面板必须真的开出 top layer（:popover-open）；anchor-name 必须设在 shadow 内的容器上
 *   · open 属性是唯一真相：property / attribute 两条路都要收敛到同一个原生状态（P5 的首触发）
 *   · 点第二次关不掉是「真指针」才验得出来的那个坑（合成 click 不触发 light dismiss）
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?dropdown=1#/packages/dropdown/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-dropdown'), { timeout: 8000 })
    .catch(() => {});
  check(
    'mc-dropdown 注册成功（页面模块的 <l-m> 生效）',
    await page.evaluate(() => !!customElements.get('mc-dropdown')),
    'customElements.get("mc-dropdown") 为 false',
  );

  /* 深链 + 刷新也注册得到（P44） */
  await page.reload({ waitUntil: 'load' });
  await page
    .waitForFunction(
      () => !!customElements.get('mc-dropdown') && !!customElements.get('mc-menu-item'),
      { timeout: 8000 },
    )
    .catch(() => {});
  const afterReload = await page.evaluate(() => ({
    dropdown: !!customElements.get('mc-dropdown'),
    item: !!customElements.get('mc-menu-item'),
  }));
  check(
    '深链 + 刷新后 mc-dropdown 与复用的 mc-menu-item 都注册成功（P44）',
    afterReload.dropdown === true && afterReload.item === true,
    JSON.stringify(afterReload),
  );

  /* ------------------------------------------------------------------ *
   * 现搭现拆探针
   * ------------------------------------------------------------------ */
  const setupProbe = () =>
    page.evaluate(() => {
      document.getElementById('dropdown-probe')?.remove();
      document.getElementById('dropdown-outside')?.remove();
      const probe = document.createElement('div');
      probe.id = 'dropdown-probe';
      probe.style.cssText =
        'position: fixed; left: 120px; top: 200px; z-index: 9999; display: flex; gap: 24px;';
      const outside = document.createElement('div');
      outside.id = 'dropdown-outside';
      outside.style.cssText =
        'position: fixed; left: 16px; top: 560px; width: 80px; height: 40px; z-index: 9999;' +
        'background-color: rgb(0 0 0 / 0.04);';
      document.body.append(probe, outside);
      window.__probe = probe;

      window.__make = (attrs = {}, trigger = '<button type="button">打开菜单</button>') => {
        document.getElementById('probe-dropdown')?.remove();
        const host = document.createElement('mc-dropdown');
        host.id = 'probe-dropdown';
        for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
        host.innerHTML =
          `<span slot="trigger">${trigger}</span>` +
          `<mc-menu-item><button type="button">个人资料</button></mc-menu-item>` +
          `<mc-menu-item><button type="button">账号设置</button></mc-menu-item>` +
          `<mc-menu-item><button type="button" disabled>退出登录</button></mc-menu-item>`;
        window.__probe.append(host);
        return host.id;
      };

      window.__dd = () => {
        const host = document.getElementById('probe-dropdown');
        const root = host.shadowRoot;
        return {
          host,
          root,
          panel: root.querySelector('.mc-panel'),
          anchor: root.querySelector('.mc-anchor'),
          trigger: host.querySelector('[slot="trigger"] button'),
          items: [...host.querySelectorAll('mc-menu-item')],
        };
      };

      window.__point = (el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };

      window.__watch = () => {
        window.__events = [];
        const { host } = window.__dd();
        /* 监听只挂一次（同一个宿主上重复调用 __watch 是为了重置缓冲，不是再挂一遍） */
        if (host.__watched) return;
        host.__watched = true;
        for (const type of ['open', 'close']) {
          host.addEventListener(type, () => window.__events.push(type));
        }
      };
    });

  const clickOn = async (pick) => {
    const at = await page.evaluate(pick);
    await page.mouse.click(at.x, at.y);
    return at;
  };

  const clickTrigger = () =>
    clickOn(() => {
      const s = window.__dd();
      const el = s.host.querySelector('[slot="trigger"] button');
      return window.__point(el);
    });

  const isOpen = () => page.evaluate(() => window.__dd().panel.matches(':popover-open'));
  const waitOpen = (want) =>
    page
      .waitForFunction((open) => window.__dd().panel.matches(':popover-open') === open, want, {
        timeout: 3000,
      })
      .catch(() => {});

  await setupProbe();

  /* ------------------------------------------------------------------ *
   * 1. 点触发元素打开：top layer + 默认 bottom-start（贴触发元素下方、左对齐）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__make({ trigger: 'click' }));
  await page.evaluate(() => window.__watch());
  await clickTrigger();
  await waitOpen(true);
  const opened = await page.evaluate(() => {
    const s = window.__dd();
    const trigger = s.host.querySelector('[slot="trigger"] button');
    const t = trigger.getBoundingClientRect();
    const p = s.panel.getBoundingClientRect();
    return {
      open: s.panel.matches(':popover-open'),
      popover: s.panel.getAttribute('popover'),
      part: s.panel.getAttribute('part'),
      anchorName: getComputedStyle(s.anchor).anchorName,
      below: p.top >= t.bottom - 1,
      alignedLeft: Math.abs(p.left - t.left) <= 1.5,
      /* 面板最小宽度跟着触发元素（anchor-size）：比触发元素窄就说明那句 min-width 没生效 */
      wideEnough: p.width >= t.width - 1,
      /* 菜单项的文字没有被面板挤掉（真回归过：min-width 失效时面板只剩内容宽、文案被裁成一个字） */
      rowTextFits: (() => {
        const item = s.host.querySelector('mc-menu-item button');
        return item.scrollWidth <= item.clientWidth + 1;
      })(),
      openAttr: s.host.hasAttribute('open'),
      display: getComputedStyle(s.panel).display,
      events: window.__events.slice(),
    };
  });
  check(
    '点触发元素打开面板：原生 popover 进 top layer，默认 bottom-start 贴在触发元素下方、左对齐、不窄于触发元素',
    opened.open === true &&
      opened.popover === 'manual' &&
      opened.part === 'panel' &&
      /^--/.test(opened.anchorName) &&
      opened.display !== 'none' &&
      opened.below === true &&
      opened.alignedLeft === true &&
      opened.wideEnough === true &&
      opened.rowTextFits === true &&
      opened.openAttr === true &&
      JSON.stringify(opened.events) === JSON.stringify(['open']),
    JSON.stringify(opened),
  );

  /* 再点一次要真的关掉（真指针；这条是 popover="auto" 会踩的坑） */
  await page.evaluate(() => window.__watch());
  await clickTrigger();
  await waitOpen(false);
  const toggled = await page.evaluate(() => ({
    open: window.__dd().panel.matches(':popover-open'),
    openAttr: window.__dd().host.hasAttribute('open'),
    events: window.__events.slice(),
  }));
  check(
    '再点触发元素关掉（真指针第二次点击不会被 light dismiss 吞成重开），open 属性跟着收回',
    toggled.open === false &&
      toggled.openAttr === false &&
      JSON.stringify(toggled.events) === JSON.stringify(['close']),
    JSON.stringify(toggled),
  );

  /* ------------------------------------------------------------------ *
   * 2. 点外部关闭（composedPath）
   * ------------------------------------------------------------------ */
  await clickTrigger();
  await waitOpen(true);
  const outsideHit = await page.evaluate(() => {
    const target = document.getElementById('dropdown-outside');
    const at = window.__point(target);
    return { ...at, hit: document.elementFromPoint(at.x, at.y)?.id ?? null };
  });
  await page.mouse.click(outsideHit.x, outsideHit.y);
  await waitOpen(false);
  const dismissed = await page.evaluate(() => ({
    open: window.__dd().panel.matches(':popover-open'),
    openAttr: window.__dd().host.hasAttribute('open'),
    focused: window.__dd().root.activeElement?.className ?? null,
  }));
  check(
    '点组件外部关掉面板（判定走 composedPath，不抢焦点）',
    outsideHit.hit === 'dropdown-outside' &&
      dismissed.open === false &&
      dismissed.openAttr === false &&
      dismissed.focused === null,
    JSON.stringify({ outsideHit, dismissed }),
  );

  /* ------------------------------------------------------------------ *
   * 3. Esc 关闭 + 焦点还给触发元素
   * ------------------------------------------------------------------ */
  await clickTrigger();
  await waitOpen(true);
  await page.evaluate(() => {
    window.__dd().host.querySelector('[slot="trigger"] button')?.blur();
    window.__dd().root.querySelector('.mc-panel').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
  });
  await waitOpen(false);
  const escaped = await page.evaluate(() => ({
    open: window.__dd().panel.matches(':popover-open'),
    focused: document.activeElement?.textContent?.trim() ?? null,
  }));
  check(
    'Esc 关闭面板并把焦点还给触发元素里的原生按钮',
    escaped.open === false && escaped.focused === '打开菜单',
    JSON.stringify(escaped),
  );

  /* 触发元素是**另一个组件**时，可聚焦的原生按钮住在它的 shadow root 里（还常被包一层） */
  await page.evaluate(() =>
    window.__make({}, '<mc-button variant="outline">打开菜单</mc-button>'),
  );
  const compTriggerAt = await page.evaluate(() => {
    const r = window.__dd().host.querySelector('mc-button').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(compTriggerAt.x, compTriggerAt.y);
  await waitOpen(true);
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.__dd().root.querySelector('.mc-panel').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
  });
  await waitOpen(false);
  const escapedComp = await page.evaluate(() => {
    const mb = window.__dd().host.querySelector('mc-button');
    return {
      宿主拿到焦点: document.activeElement === mb,
      内部按钮拿到焦点: mb?.shadowRoot?.activeElement?.className === 'mc-native',
    };
  });
  check(
    '触发元素是组件（mc-button）时，Esc 也要把焦点还到它内部那个原生按钮',
    escapedComp.宿主拿到焦点 && escapedComp.内部按钮拿到焦点,
    JSON.stringify(escapedComp),
  );

  /* ⚠️ 还原夹具：后面几节的用例都假设触发元素里有原生 button */
  await page.evaluate(() => window.__make({}));

  /* ------------------------------------------------------------------ *
   * 4. open 受控：property 与 attribute 两条路都收敛到同一个原生状态
   * ------------------------------------------------------------------ */
  const controlled = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const { host, panel } = window.__dd();
    window.__watch();

    host.open = true;
    await wait(200);
    const byPropOn = panel.matches(':popover-open');
    const attrOn = host.hasAttribute('open');

    host.open = false;
    await wait(200);
    const byPropOff = panel.matches(':popover-open');
    const attrOff = host.hasAttribute('open');

    host.setAttribute('open', '');
    await wait(250);
    const byAttrOn = panel.matches(':popover-open');

    host.removeAttribute('open');
    await wait(250);
    const byAttrOff = panel.matches(':popover-open');

    return { byPropOn, attrOn, byPropOff, attrOff, byAttrOn, byAttrOff, events: window.__events.slice() };
  });
  check(
    'open 受控：property 与 attribute 两条路都能开合，事件各只发一次（open / close 各两条）',
    controlled.byPropOn === true &&
      controlled.attrOn === true &&
      controlled.byPropOff === false &&
      controlled.attrOff === false &&
      controlled.byAttrOn === true &&
      controlled.byAttrOff === false &&
      JSON.stringify(controlled.events) ===
        JSON.stringify(['open', 'close', 'open', 'close']),
    JSON.stringify(controlled),
  );

  /* ------------------------------------------------------------------ *
   * 5. placement 生效：换个方向，面板到另一侧
   * ------------------------------------------------------------------ */
  const placements = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const { host, panel } = window.__dd();
    const trigger = host.querySelector('[slot="trigger"] button');
    const out = {};
    for (const placement of ['top-start', 'right-start']) {
      host.setAttribute('placement', placement);
      host.open = true;
      await wait(260);
      const t = trigger.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      out[placement] =
        placement === 'top-start'
          ? { above: p.bottom <= t.top + 1.5, alignedLeft: Math.abs(p.left - t.left) <= 1.5 }
          : { right: p.left >= t.right - 1.5, alignedTop: Math.abs(p.top - t.top) <= 1.5 };
      host.open = false;
      await wait(120);
    }
    host.setAttribute('placement', 'bottom-start');
    return out;
  });
  check(
    'placement 生效：top-start 翻到触发元素上方、right-start 贴到右侧（都零偏移）',
    placements['top-start'].above === true &&
      placements['top-start'].alignedLeft === true &&
      placements['right-start'].right === true &&
      placements['right-start'].alignedTop === true,
    JSON.stringify(placements),
  );

  /* ------------------------------------------------------------------ *
   * 6. trigger="hover"：移入开、移出关
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__make({ trigger: 'hover' }));
  const hoverPoint = await page.evaluate(() => {
    const el = window.__dd().host.querySelector('[slot="trigger"] button');
    return window.__point(el);
  });
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await waitOpen(true);
  const hoverOpened = await isOpen();
  await page.mouse.move(4, 4);
  await waitOpen(false);
  const hoverClosed = await isOpen();
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await waitOpen(true);
  /* 指针移进面板（面板是宿主的后代）不该把它关掉 */
  const panelPoint = await page.evaluate(() => {
    const item = window.__dd().host.querySelector('mc-menu-item');
    return window.__point(item);
  });
  await page.mouse.move(panelPoint.x, panelPoint.y);
  await page.waitForTimeout(300);
  const stillOpen = await isOpen();
  await page.mouse.move(4, 4);
  await waitOpen(false);
  check(
    'trigger="hover"：移入开、移出关，指针移到面板上不会误关（面板是宿主的后代）',
    hoverOpened === true && hoverClosed === false && stillOpen === true,
    JSON.stringify({ hoverOpened, hoverClosed, stillOpen }),
  );

  /* ------------------------------------------------------------------ *
   * 7. 面板里的 mc-menu-item 可点（复用的组件真的能交互）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__make({});
    window.__clicks = [];
    const { host } = window.__dd();
    /* 只记「事件路径里真的有 mc-menu-item」的那些点击（触发元素自己那一下不算） */
    host.addEventListener('click', (event) => {
      if (event.composedPath().some((node) => node?.tagName === 'MC-MENU-ITEM')) {
        window.__clicks.push(true);
      }
    });
  });
  await clickTrigger();
  await waitOpen(true);
  const itemClick = await page.evaluate(() => {
    const item = window.__dd().items[0];
    const button = item.querySelector('button');
    return window.__point(button);
  });
  await page.mouse.click(itemClick.x, itemClick.y);
  await page.waitForTimeout(200);
  const itemResult = await page.evaluate(() => {
    const { items } = window.__dd();
    return {
      clicks: window.__clicks.slice(),
      itemRole: items[0]?.getAttribute('role'),
      buttonText: items[0]?.querySelector('button')?.textContent?.trim(),
      open: window.__dd().panel.matches(':popover-open'),
    };
  });
  check(
    '面板里的 mc-menu-item 可点：点击冒泡到 mc-dropdown（composedPath 里有菜单项），面板不自己收',
    itemResult.clicks.length >= 1 &&
      itemResult.clicks.every(Boolean) &&
      itemResult.itemRole === 'listitem' &&
      itemResult.buttonText === '个人资料' &&
      itemResult.open === true,
    JSON.stringify(itemResult),
  );

  /* ------------------------------------------------------------------ *
   * 8. ::part(panel) 定制生效
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'dropdown-part-style';
    style.textContent =
      '#dropdown-probe mc-dropdown::part(panel) { border-radius: 0px; padding: 24px; }';
    document.head.append(style);
  });
  await waitOpen(true);
  const part = await page.evaluate(() => {
    const cs = getComputedStyle(window.__dd().panel);
    return { radius: cs.borderTopLeftRadius, padding: cs.paddingTop };
  });
  check(
    '::part(panel) 能从外面改（自定义点真的通）',
    part.radius === '0px' && part.padding === '24px',
    JSON.stringify(part),
  );

  await page.evaluate(() => {
    document.getElementById('dropdown-probe')?.remove();
    document.getElementById('dropdown-outside')?.remove();
    document.getElementById('dropdown-part-style')?.remove();
  });

  /* ------------------------------------------------------------------ *
   * 9. 文档页：演示渲染出来了，点一下真的会弹
   * ------------------------------------------------------------------ */
  await visit(page, `/index.html?dropdown-page=${Date.now()}#/packages/dropdown/page.html`);
  await page
    .waitForFunction(() => !!window.__deep('demo-dropdown-basic')?.shadowRoot, { timeout: 10000 })
    .catch(() => {});
  const docPage = await page.evaluate(async () => {
    const demo = window.__deep('demo-dropdown-basic');
    const dropdown = demo?.shadowRoot?.querySelector('mc-dropdown');
    const trigger = demo?.shadowRoot?.querySelector('[slot="trigger"] button, [slot="trigger"]');
    const heading = window.__deep('.doc-body h1')?.textContent?.trim() ?? null;
    trigger?.click();
    await new Promise((r) => setTimeout(r, 300));
    return {
      heading,
      points: window.__deepAll('.doc-demo').length,
      items: dropdown?.querySelectorAll('mc-menu-item').length ?? 0,
      opened: dropdown?.shadowRoot?.querySelector('.mc-panel')?.matches(':popover-open') ?? false,
    };
  });
  check(
    '文档页：标题 / 演示段都在，点演示里的触发元素真的弹出面板',
    /^Dropdown/.test(docPage.heading ?? '') &&
      docPage.points >= 4 &&
      docPage.items >= 2 &&
      docPage.opened === true,
    JSON.stringify(docPage),
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);}
