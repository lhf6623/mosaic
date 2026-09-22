/**
 * mc-collapse · 折叠面板：开合、事件、互斥、禁用、尺寸、键盘（packages/collapse）
 *
 * 从 harness 拿 browser / page / check / visit 这些（见 tests/lib/harness.mjs）。
 */

export default async function run({ page, visit, check }) {
  /* ------------------------------------------------------------------ *
   * 11.4 mc-collapse —— 折叠面板
   *
   * 开合本身是原生 <details>/<summary> 的，所以这里不测"浏览器会不会开合"，
   * 只测组件自己那部分契约：
   *   · open 属性既是初始值也是运行时状态 —— 用户点击 / property / setAttribute
   *     三条路最后都落到同一个属性上，`el.open` 永远能读到真相
   *   · 原生 toggle 要反射回属性，并发 open / close（composed，容器才收得到）
   *   · 容器 accordion 互斥；收别人走 property（同步，不再叠一层延迟）
   *   · disabled 三件套：aria-disabled + tabindex=-1 + 头部不吃指针
   *   · 尺寸只在容器上写一次，靠 CSS 变量继承进子项的 shadow root（两个 shadow 唯一的通道）
   * ------------------------------------------------------------------ */

  const collapse = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?collapse=1#/packages/collapse/page.html');
    await page
      .waitForFunction(
        () => {
          const items = window.__deepAll('mc-collapse-item');
          return items.length >= 10 && items.every((i) => i.shadowRoot?.querySelector('details'));
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    // 事件统一从 document 收：open / close 是 composed 的，会穿出页面自己的 shadow root
    await page.evaluate(() => {
      window.__collapseEvents = [];
      for (const type of ['open', 'close']) {
        document.addEventListener(type, (e) =>
          window.__collapseEvents.push({ type, name: e.data?.name ?? '' }),
        );
      }
    });

    /** 初始状态：属性 / property / 内部 details 三者必须一致（查「基本用法」那个例子） */
    const initial = await page.evaluate(() => {
      // 例子的 DOM 住在各自的 shadow root 里，所以从例子宿主往下穿透查
      const items = [
        ...window.__deepAll(
          'mc-collapse-item',
          window.__deepAll('demo-collapse-basic')[0].shadowRoot,
        ),
      ];
      return {
        total: window.__deepAll('mc-collapse-item').length,
        collapses: window.__deepAll('mc-collapse').length,
        upgraded: window.__deepAll('mc-collapse-item').every((i) => !!i.shadowRoot),
        states: items.map((i) => ({
          attr: i.hasAttribute('open'),
          prop: i.open,
          details: i.shadowRoot.querySelector('details').open,
        })),
      };
    });

    // 尺寸：例子里摆了 sm / md / lg 三个容器，量头部实际高度
    const sizes = await page.evaluate(() => {
      const box = window.__deepAll('demo-collapse-size')[0].shadowRoot;
      return window
        .__deepAll('mc-collapse', box)
        .map((c) =>
          Math.round(
            c
              .querySelector('mc-collapse-item')
              .shadowRoot.querySelector('.mc-header')
              .getBoundingClientRect().height,
          ),
        );
    });

    // 真实点击：展开再收起第一组第 3 项
    const headers = page.locator('demo-collapse-basic .mc-header');
    await headers.nth(2).click();
    await page.waitForTimeout(150);
    const opened = await page.evaluate(() => {
      const items = [
        ...window.__deepAll(
          'mc-collapse-item',
          window.__deepAll('demo-collapse-basic')[0].shadowRoot,
        ),
      ];
      return {
        open: items.map((i) => i.open),
        attr: items[2].hasAttribute('open'),
        details: items[2].shadowRoot.querySelector('details').open,
        events: window.__collapseEvents.slice(),
      };
    });

    await headers.nth(2).click();
    await page.waitForTimeout(150);
    const closed = await page.evaluate(() => {
      const items = [
        ...window.__deepAll(
          'mc-collapse-item',
          window.__deepAll('demo-collapse-basic')[0].shadowRoot,
        ),
      ];
      return {
        open: items.map((i) => i.open),
        attr: items[2].hasAttribute('open'),
        last: window.__collapseEvents.at(-1),
      };
    });

    // 手风琴：点第 3 项，前两项必须收起来
    const accordion = await page.evaluate(async () => {
      const c = window.__deepAll(
        'mc-collapse',
        window.__deepAll('demo-collapse-accordion')[0].shadowRoot,
      )[0];
      const items = [...c.querySelectorAll('mc-collapse-item')];
      const before = items.map((i) => i.open);
      items[2].shadowRoot.querySelector('.mc-header').click();
      await new Promise((r) => setTimeout(r, 250));
      return {
        before,
        after: items.map((i) => i.open),
        details: items.map((i) => i.shadowRoot.querySelector('details').open),
      };
    });

    // 收别人那条路是同步的（property），不再等 ofa 那一拍（P4）
    const syncClose = await page.evaluate(() => {
      const c = window.__deepAll(
        'mc-collapse',
        window.__deepAll('demo-collapse-accordion')[0].shadowRoot,
      )[0];
      const items = [...c.querySelectorAll('mc-collapse-item')];
      items[2].open = false;
      return {
        attr: items[2].hasAttribute('open'),
        details: items[2].shadowRoot.querySelector('details').open,
      };
    });

    // 禁用：读屏能感知、键盘进不来、鼠标点不动（键盘激活最终也是一次可取消 click）
    const disabled = await page.evaluate(async () => {
      const items = [
        ...window.__deepAll(
          'mc-collapse-item',
          window.__deepAll('demo-collapse-disabled')[0].shadowRoot,
        ),
      ];
      const header = items[1].shadowRoot.querySelector('.mc-header');
      const state = {
        aria: header.getAttribute('aria-disabled'),
        tabIndex: header.tabIndex,
        pointerEvents: getComputedStyle(header).pointerEvents,
      };
      header.click();
      await new Promise((r) => setTimeout(r, 150));
      items[0].open = true; // 对照组：可用项照常能开
      return { ...state, afterClick: items[1].open, sibling: items[0].open };
    });

    // 键盘：焦点在 summary 上时 Enter / 空格都能开合（激活最终也是一次可取消 click）
    const keyboard = await (async () => {
      const header = page.locator('demo-collapse-basic .mc-header').nth(0);
      await header.focus();
      const focused = await page.evaluate(() => {
        const item = window.__deepAll(
          'mc-collapse-item',
          window.__deepAll('demo-collapse-basic')[0].shadowRoot,
        )[0];
        return item.shadowRoot.activeElement === item.shadowRoot.querySelector('.mc-header');
      });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      const afterEnter = await page.evaluate(() => {
        const item = window.__deepAll(
          'mc-collapse-item',
          window.__deepAll('demo-collapse-basic')[0].shadowRoot,
        )[0];
        return item.open;
      });
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      const afterSpace = await page.evaluate(() => {
        const item = window.__deepAll(
          'mc-collapse-item',
          window.__deepAll('demo-collapse-basic')[0].shadowRoot,
        )[0];
        return {
          open: item.open,
          stillFocused: item.shadowRoot.activeElement?.tagName === 'SUMMARY',
        };
      });
      return { focused, afterEnter, afterSpace };
    })();

    // 两条入口：property 立刻生效，setAttribute 那条跟着 ofa 异步更新（P4）
    const paths = await page.evaluate(async () => {
      const item = window.__deepAll(
        'mc-collapse-item',
        window.__deepAll('demo-collapse-basic')[0].shadowRoot,
      )[0];
      item.open = true;
      const byProp = {
        attr: item.hasAttribute('open'),
        details: item.shadowRoot.querySelector('details').open,
      };
      item.removeAttribute('open');
      await new Promise((r) => setTimeout(r, 150));
      const byAttr = {
        attr: item.hasAttribute('open'),
        details: item.shadowRoot.querySelector('details').open,
      };
      return { byProp, byAttr };
    });

    // 事件演示段：容器上的 on:open 把 $event.data.name 写进页面数据
    const eventText = await (async () => {
      await page.locator('demo-collapse-events .mc-header').nth(1).click();
      await page.waitForTimeout(300);
      return page.evaluate(() => {
        const host = window.__deepAll('demo-collapse-events')[0];
        return host.shadowRoot.querySelector('p')?.textContent.trim() ?? '';
      });
    })();

    // 动态创建（P31 那条路径：attrs 不含保留名、构造期不写宿主属性）
    const created = await page.evaluate(async () => {
      const c = document.createElement('mc-collapse');
      const item = document.createElement('mc-collapse-item');
      item.setAttribute('header', '动态创建');
      item.textContent = '内容';
      c.append(item);
      document.body.append(c);
      item.open = true;
      await new Promise((r) => setTimeout(r, 400)); // header 文案是异步渲染的（P4）
      const out = {
        shadows: !!c.shadowRoot && !!item.shadowRoot,
        header: item.shadowRoot.querySelector('.mc-header').textContent.trim(),
        details: item.shadowRoot.querySelector('details').open,
        display: getComputedStyle(c).display,
      };
      c.remove();
      return out;
    });

    // 嵌套手风琴：内层子项的开合不能把外层已展开的分支误关掉
    const nested = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const outer = document.createElement('mc-collapse');
      outer.setAttribute('accordion', '');
      const o1 = document.createElement('mc-collapse-item');
      o1.setAttribute('header', '外层 A');
      const o2 = document.createElement('mc-collapse-item');
      o2.setAttribute('header', '外层 B');
      const inner = document.createElement('mc-collapse');
      inner.setAttribute('accordion', '');
      const i1 = document.createElement('mc-collapse-item');
      i1.setAttribute('header', '内层 1');
      const i2 = document.createElement('mc-collapse-item');
      i2.setAttribute('header', '内层 2');
      inner.append(i1, i2);
      o1.append(inner);
      outer.append(o1, o2);
      document.body.append(outer);
      await wait(300); // 等容器把 open 监听挂上（attached 是异步的）

      o1.open = true;
      i1.open = true;
      await wait(150);
      i2.open = true; // 打开内层第 2 项
      await wait(250);
      const out = { outer: [o1.open, o2.open], inner: [i1.open, i2.open] };
      outer.remove();
      return out;
    });

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return {
      initial,
      sizes,
      opened,
      closed,
      accordion,
      syncClose,
      disabled,
      keyboard,
      paths,
      eventText,
      created,
      nested,
      failed,
    };
  })();

  check(
    'mc-collapse / mc-collapse-item 注册并渲染出实例',
    collapse.initial.upgraded && collapse.initial.total >= 10 && collapse.initial.collapses >= 5,
    `${collapse.initial.collapses} 个容器 / ${collapse.initial.total} 个子项 · 全部升级=${collapse.initial.upgraded}`,
  );

  check(
    '初始 open 的三种表示一致（宿主属性 / DOM property / 内部 details）',
    collapse.initial.states.length >= 3 &&
      collapse.initial.states[1].attr &&
      collapse.initial.states[1].prop &&
      collapse.initial.states[1].details &&
      collapse.initial.states.every((s) => s.attr === s.prop && s.prop === s.details),
    JSON.stringify(collapse.initial.states),
  );

  check(
    'size 写在容器上，靠 CSS 变量继承进子项的 shadow root（sm/md/lg = 28/36/44）',
    JSON.stringify(collapse.sizes) === JSON.stringify([28, 36, 44]),
    JSON.stringify(collapse.sizes),
  );

  check(
    '点击头部展开：属性、内部 details、open 事件三者一致',
    JSON.stringify(collapse.opened.open) === JSON.stringify([false, true, true]) &&
      collapse.opened.attr &&
      collapse.opened.details &&
      collapse.opened.events.some((e) => e.type === 'open'),
    JSON.stringify(collapse.opened),
  );

  check(
    '点击头部收起：属性被摘掉，close 事件发出',
    JSON.stringify(collapse.closed.open) === JSON.stringify([false, true, false]) &&
      !collapse.closed.attr &&
      collapse.closed.last?.type === 'close',
    JSON.stringify(collapse.closed),
  );

  check(
    'accordion 互斥：打开一项时同容器的其它项都收起来',
    JSON.stringify(collapse.accordion.before) === JSON.stringify([true, false, false]) &&
      JSON.stringify(collapse.accordion.after) === JSON.stringify([false, false, true]) &&
      JSON.stringify(collapse.accordion.details) === JSON.stringify([false, false, true]),
    JSON.stringify(collapse.accordion),
  );

  check(
    '收别人走 property：写完立刻生效，不等 ofa 那一拍（P4）',
    !collapse.syncClose.attr && !collapse.syncClose.details,
    JSON.stringify(collapse.syncClose),
  );

  check(
    'disabled 三件套：aria-disabled + tabindex=-1 + 头部不吃指针，且拦截激活',
    collapse.disabled.aria === 'true' &&
      collapse.disabled.tabIndex === -1 &&
      collapse.disabled.pointerEvents === 'none' &&
      collapse.disabled.afterClick === false &&
      collapse.disabled.sibling === true,
    JSON.stringify(collapse.disabled),
  );

  check(
    '键盘开合：焦点在 summary 上，Enter 展开、空格收起，焦点不跑',
    collapse.keyboard.focused &&
      collapse.keyboard.afterEnter === true &&
      collapse.keyboard.afterSpace.open === false &&
      collapse.keyboard.afterSpace.stillFocused,
    JSON.stringify(collapse.keyboard),
  );

  check(
    'open 的两条入口：property 立刻生效，setAttribute 也跟着更新',
    collapse.paths.byProp.attr &&
      collapse.paths.byProp.details &&
      !collapse.paths.byAttr.attr &&
      !collapse.paths.byAttr.details,
    JSON.stringify(collapse.paths),
  );

  check(
    '容器上的 on:open 收到子项的 $event.data.name',
    collapse.eventText.includes('安全 展开'),
    collapse.eventText.slice(0, 60),
  );

  check(
    'document.createElement 创建的实例照常初始化（P31）',
    collapse.created.shadows &&
      collapse.created.header === '动态创建' &&
      collapse.created.details &&
      collapse.created.display === 'block',
    JSON.stringify(collapse.created),
  );

  check(
    '嵌套手风琴互不误伤：内层子项开合不影响外层已展开的分支，内层自己互斥',
    JSON.stringify(collapse.nested.outer) === JSON.stringify([true, false]) &&
      JSON.stringify(collapse.nested.inner) === JSON.stringify([false, true]),
    JSON.stringify(collapse.nested),
  );

  check(
    'mc-collapse 文档页没有 404 / 运行时报错',
    collapse.failed.length === 0,
    collapse.failed.join(' | ') || '无',
  );
}
