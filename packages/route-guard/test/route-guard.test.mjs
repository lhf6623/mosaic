/**
 * mc-route-guard · 路由守卫：
 * 当前路由的 olink 点击在捕获阶段被拦下（不 app.goto / hash 不变 / 发 same-route），
 * olink-force / disabled 跳过守卫；非当前链接放行；普通 `<a href>` 不在拦截范围。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(r.status() + ' ' + r.url());
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?route-guard=1#/packages/route-guard/page.html');
  await page
    .waitForFunction(
      () => {
        const guard = window.__deepAll('mc-route-guard')[0];
        const demo = window.__deepAll('demo-route-guard-basic')[0];
        const menu = demo?.shadowRoot?.querySelector('mc-menu');
        return !!guard?.shadowRoot && !!menu?.shadowRoot?.querySelector('mc-menu-item');
      },
      { timeout: 8000 },
    )
    .catch(() => {});

  /** 探针：窗口捕获阶段（守卫之后）记录 defaultPrevented；同时把真实导航拦下来，测试只看守卫的判定 */
  const setup = await page.evaluate(() => {
    const guard = window.__deepAll('mc-route-guard')[0];
    const demo = window.__deepAll('demo-route-guard-basic')[0];
    const box = demo.shadowRoot;
    const app = window.$(window.__deepAll('o-app')[0]);
    window.__guardProbe = [];
    window.addEventListener(
      'click',
      (event) => {
        const anchor = event.composedPath().find((node) => node?.localName === 'a');
        if (!anchor) return;
        const host = anchor.getRootNode?.().host;
        window.__guardProbe.push({
          id: anchor.id || host?.getAttribute?.('label') || null,
          prevented: event.defaultPrevented,
          modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        });
      },
      true,
    );
    window.__guardBlock = (event) => {
      const anchor = event.composedPath().find((node) => node?.localName === 'a');
      if (anchor) event.preventDefault();
    };
    window.addEventListener('click', window.__guardBlock, true);
    return {
      current: app.current.src,
      guards: window.__deepAll('mc-route-guard').length,
      display: getComputedStyle(guard).display,
      forceAttr: box.querySelector('#forced')?.hasAttribute('olink-force') ?? false,
    };
  });

  check(
    '守卫渲染成 display:contents（不可见）、只实例化一个，olink 目标与当前 src 对得上',
    setup.guards === 1 &&
      setup.display === 'contents' &&
      setup.current.endsWith('/packages/route-guard/page.html') &&
      setup.forceAttr === true,
    JSON.stringify(setup),
  );

  /** 当前路由：守卫拦下 + same-route 事件 + hash 不变 */
  const currentClick = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const demo = window.__deepAll('demo-route-guard-basic')[0];
    const box = demo.shadowRoot;
    const menu = box.querySelector('mc-menu');
    const row = [...menu.shadowRoot.querySelectorAll('.mc-node mc-menu-item')].find(
      (item) => item.getAttribute('label') === '当前页（守卫会拦）',
    );
    const anchor = row.shadowRoot.querySelector('a');
    const hashBefore = location.hash;
    anchor.click();
    await wait(200);
    return {
      hashBefore,
      hash: location.hash,
      log: box.querySelector('strong')?.textContent ?? null,
      probe: window.__guardProbe.at(-1) ?? null,
    };
  });

  check(
    '同路由点击：捕获阶段 preventDefault，hash 不变，发 same-route（载荷带目标地址 / 当前 src）',
    currentClick.hash === currentClick.hashBefore &&
      currentClick.probe?.id === '当前页（守卫会拦）' &&
      currentClick.probe?.prevented === true &&
      /route-guard\/page\.html/.test(currentClick.log ?? '') &&
      (currentClick.log?.match(/route-guard\/page\.html/g) ?? []).length === 2,
    JSON.stringify(currentClick),
  );

  /** olink-force：跳过守卫，不 preventDefault */
  const forceClick = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const demo = window.__deepAll('demo-route-guard-basic')[0];
    const box = demo.shadowRoot;
    const logBefore = box.querySelector('strong')?.textContent ?? null;
    box.querySelector('#forced').click();
    await wait(200);
    return {
      probe: window.__guardProbe.at(-1) ?? null,
      logBefore,
      log: box.querySelector('strong')?.textContent ?? null,
      hash: location.hash,
    };
  });

  check(
    'olink-force：跳过守卫（不 preventDefault、不发 same-route），仍由 olink 接管',
    forceClick.probe?.id === 'forced' &&
      forceClick.probe?.prevented === false &&
      forceClick.log === forceClick.logBefore &&
      forceClick.hash.endsWith('#/packages/route-guard/page.html'),
    JSON.stringify(forceClick),
  );

  /** disabled：整体停用守卫，当前路由链接不再被拦 */
  const disabledClick = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const guard = window.__deepAll('mc-route-guard')[0];
    const demo = window.__deepAll('demo-route-guard-basic')[0];
    const box = demo.shadowRoot;
    const menu = box.querySelector('mc-menu');
    const row = [...menu.shadowRoot.querySelectorAll('.mc-node mc-menu-item')].find(
      (item) => item.getAttribute('label') === '当前页（守卫会拦）',
    );
    guard.setAttribute('disabled', '');
    row.shadowRoot.querySelector('a').click();
    await wait(200);
    guard.removeAttribute('disabled');
    return { probe: window.__guardProbe.at(-1) ?? null, hash: location.hash };
  });

  check(
    'disabled：守卫停用，当前路由链接不再 preventDefault（交给 olink）',
    disabledClick.probe?.id === '当前页（守卫会拦）' &&
      disabledClick.probe?.prevented === false &&
      disabledClick.hash.endsWith('#/packages/route-guard/page.html'),
    JSON.stringify(disabledClick),
  );

  /** 修饰键：不拦（为浏览器「新标签页打开」留路） */
  const modifiedClick = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const demo = window.__deepAll('demo-route-guard-basic')[0];
    const menu = demo.shadowRoot.querySelector('mc-menu');
    const row = [...menu.shadowRoot.querySelectorAll('.mc-node mc-menu-item')].find(
      (item) => item.getAttribute('label') === '当前页（守卫会拦）',
    );
    row.shadowRoot.querySelector('a').dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ctrlKey: true }),
    );
    await wait(150);
    return window.__guardProbe.at(-1) ?? null;
  });

  check(
    'ctrl 点击：修饰键不拦（留给浏览器开新标签）',
    modifiedClick?.id === '当前页（守卫会拦）' &&
      modifiedClick?.modified === true &&
      modifiedClick?.prevented === false,
    JSON.stringify(modifiedClick),
  );

  /** 非当前路由：守卫放行；做一次真实导航再后退，验证没有误伤正常链接 */
  await page.evaluate(() => {
    window.removeEventListener('click', window.__guardBlock, true);
  });
  const hashBeforeOther = await page.evaluate(() => location.hash);
  await page.evaluate(() => {
    const demo = window.__deepAll('demo-route-guard-basic')[0];
    const menu = demo.shadowRoot.querySelector('mc-menu');
    const row = [...menu.shadowRoot.querySelectorAll('.mc-node mc-menu-item')].find(
      (item) => item.getAttribute('label') === '按钮文档（正常跳转）',
    );
    row.shadowRoot.querySelector('a').click();
  });
  await page
    .waitForFunction(() => location.hash === '#/packages/button/page.html', { timeout: 8000 })
    .catch(() => {});
  /* 等 ofa 的页面切换事务（动画 / 渲染）落定，否则紧接着的 back 会被后到的 push 覆盖 */
  await page.waitForTimeout(1000);
  const hashAfterOther = await page.evaluate(() => location.hash);
  await page.evaluate(() => history.back());
  await page.waitForTimeout(1000);
  await page
    .waitForFunction(() => location.hash === '#/packages/route-guard/page.html', { timeout: 8000 })
    .catch(() => {});
  const hashRestored = await page.evaluate(() => location.hash);

  check(
    '非当前路由：守卫放行，真实点击会换 hash；浏览器后退能回到守卫页',
    hashBeforeOther === '#/packages/route-guard/page.html' &&
      hashAfterOther === '#/packages/button/page.html' &&
      hashRestored === '#/packages/route-guard/page.html',
    JSON.stringify({ hashBeforeOther, hashAfterOther, hashRestored }),
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('页面无 404 / 报错', failed.length === 0, failed.join('\n'));
}
