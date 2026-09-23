/**
 * 站点 · 右栏「本页目录」（<doc-toc>）：
 * 扫标题生成、h3 缩进、点击滚到标题（且不改地址栏 hash）、滚动时高亮跟着走、窄屏收掉右栏
 */

export default async function run({ page, goTop, goHash, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  /* ------------------------------------------------------------------ *
   * 目录是扫页面自己的 h2/h3 生成的：项数、顺序、id 都要对得上
   * ------------------------------------------------------------------ */

  await goTop('组件');
  await page.waitForTimeout(1500);

  const toc = await page.evaluate(() => {
    const el = window.__deep('doc-toc');
    const main = window.__deep('.doc-main');
    const links = el ? [...el.querySelectorAll('a')] : [];
    // 标题在子页面（被 slot 投影进来的那一页）的 shadow root 里，不在目录元素自己的 root 里
    const page = [...window.__deepAll('o-page')].at(-1);
    const headings = page ? [...page.shadowRoot.querySelectorAll('h2, h3')] : [];
    const levels = links.map((a) => a.dataset.tocId);
    return {
      exists: !!el,
      links: links.length,
      headings: headings.length,
      first: links[0]?.textContent?.trim() ?? null,
      current: el?.querySelector('a[aria-current]')?.textContent?.trim() ?? null,
      currentValue: el?.querySelector('a[aria-current]')?.getAttribute('aria-current') ?? null,
      idsMatch: links.every((a, i) => levels[i] === headings[i]?.id),
      indents: links.map((a) => getComputedStyle(a).textIndent),
      headingLevels: headings.map((h) => h.tagName),
      mainOver: main.scrollHeight - main.clientHeight,
      menuUpgraded: !!el?.querySelector('mc-menu')?.shadowRoot,
    };
  });

  check(
    '组件页右栏有本页目录，项数 = 页面 h2/h3 数，且顺序 / id 一一对应',
    toc.exists && toc.links > 4 && toc.links === toc.headings && toc.idsMatch,
    `${toc.links} 项 / ${toc.headings} 个标题 · 对应=${toc.idsMatch}`,
  );
  check(
    '目录用 mc-menu 渲染（不是自己造的一套），h3 比 h2 缩进一档',
    toc.menuUpgraded &&
      toc.headingLevels.includes('H2') &&
      toc.headingLevels.includes('H3') &&
      toc.indents.some((v) => v !== toc.indents[0]),
    `升级=${toc.menuUpgraded} · 层级=${[...new Set(toc.headingLevels)].join('/')} · 缩进 ${[...new Set(toc.indents)].join(' / ')}`,
  );
  check(
    '首屏高亮第一个标题（aria-current="location"，mc-menu 再镜像成 data-current）',
    toc.current === toc.first && toc.currentValue === 'location',
    `当前项「${toc.current}」/ 第一项「${toc.first}」· aria-current=${toc.currentValue}`,
  );

  /* ------------------------------------------------------------------ *
   * 滚动 → 高亮跟着走
   * ------------------------------------------------------------------ */

  const spy = await page.evaluate(async () => {
    const el = window.__deep('doc-toc');
    const main = window.__deep('.doc-main');
    const before = el.querySelector('a[aria-current]')?.dataset.tocId ?? null;
    main.scrollTop = Math.round(main.scrollHeight * 0.5);
    await new Promise((r) => setTimeout(r, 250));
    const after = el.querySelector('a[aria-current]')?.dataset.tocId ?? null;
    const host = [...el.querySelectorAll('mc-menu-item')].filter((i) => i.hasAttribute('data-current'));
    return { before, after, hostCurrent: host.length };
  });
  check(
    '滚动到页面中部后，当前项跟着换（宿主 data-current 也同步）',
    spy.before !== null && spy.after !== null && spy.before !== spy.after && spy.hostCurrent === 1,
    `${spy.before} → ${spy.after} · data-current 的项 ${spy.hostCurrent} 个`,
  );

  /* ------------------------------------------------------------------ *
   * 点击目录项：滚到标题（顶栏下方），且**不动地址栏 hash**
   * —— hash 归 ofa 路由器所有，页面正文又在 shadow root 里，URL fragment 进不去
   * ------------------------------------------------------------------ */

  const target = await page.evaluate(() => {
    // 挑中段的项：接近页尾的标题滚不到顶，位置断言不成立
    const links = [...window.__deep('doc-toc').querySelectorAll('a')];
    const a = links[Math.min(2, links.length - 1)];
    return { id: a.dataset.tocId, text: a.textContent.trim(), hash: location.hash };
  });
  await page.evaluate((id) => {
    const links = [...window.__deep('doc-toc').querySelectorAll('a')];
    links.find((a) => a.dataset.tocId === id).click();
  }, target.id);
  await page.waitForTimeout(1200); // 平滑滚动

  const jumped = await page.evaluate((id) => {
    const heading = window.__deepAll(`#${id}`)[0];
    const main = window.__deep('.doc-main');
    const el = window.__deep('doc-toc');
    return {
      hash: location.hash,
      mainTop: Math.round(main.getBoundingClientRect().top),
      headingTop: heading ? Math.round(heading.getBoundingClientRect().top) : null,
      current: el.querySelector('a[aria-current]')?.dataset.tocId ?? null,
    };
  }, target.id);

  check(
    '点目录项：内容滚到那个标题（落在顶栏下方、不被压住）',
    jumped.headingTop !== null &&
      jumped.headingTop > jumped.mainTop &&
      jumped.headingTop < jumped.mainTop + 120 &&
      jumped.current === target.id,
    `「${target.text}」标题 top=${jumped.headingTop}px · 正文带顶 ${jumped.mainTop}px · 当前项=${jumped.current}`,
  );
  check(
    '点目录项不改地址栏 hash（路由仍归路由器管）',
    jumped.hash === target.hash,
    `${target.hash} → ${jumped.hash}`,
  );

  /* ------------------------------------------------------------------ *
   * 窄屏：中档宽度先收右栏（退化成左菜单 + 正文两栏）
   * ------------------------------------------------------------------ */

  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(400);
  const narrow = await page.evaluate(() => {
    const el = window.__deep('doc-toc');
    const split = window.__deep('.doc-split');
    return {
      display: getComputedStyle(el).display,
      columns: getComputedStyle(split).gridTemplateColumns.split(' ').length,
    };
  });
  check(
    '中档宽度收起右栏，退回两栏',
    narrow.display === 'none' && narrow.columns === 2,
    `目录 display=${narrow.display} · 分栏数=${narrow.columns}`,
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);

  /* ------------------------------------------------------------------ *
   * 换页：目录住在分区布局页里、跨页存活，内容换成新页的标题
   * ------------------------------------------------------------------ */

  await goHash('packages/button/page.html');
  await page.waitForTimeout(1200);
  const onButton = await page.evaluate(() => {
    const el = window.__deep('doc-toc');
    el.__probeId = 'toc-1';
    return {
      first: el.querySelector('a')?.textContent?.trim() ?? null,
      count: el.querySelectorAll('a').length,
      current: el.querySelector('a[aria-current]')?.dataset.tocId ?? null,
    };
  });

  await goHash('packages/menu/page.html');
  await page.waitForTimeout(1200);
  const onMenu = await page.evaluate(() => {
    const el = window.__deep('doc-toc');
    return {
      same: el?.__probeId === 'toc-1',
      first: el?.querySelector('a')?.textContent?.trim() ?? null,
      count: el?.querySelectorAll('a').length ?? 0,
      current: el?.querySelector('a[aria-current]')?.dataset.tocId ?? null,
    };
  });

  check(
    '换页后目录跟着换：元素跨页存活，内容扫的是新页的标题',
    onMenu.same && onButton.count > 4 && onMenu.count > 4 && onMenu.first !== onButton.first && onMenu.current !== null,
    `同元素=${onMenu.same} · 首项 ${onButton.first}(${onButton.count}) → ${onMenu.first}(${onMenu.count})`,
  );

  /* ------------------------------------------------------------------ *
   * 单列页面（没有分栏、也就没放 <doc-toc>）：不该凭空长出右栏
   * ------------------------------------------------------------------ */

  await goHash('docs/pages/guide.html');
  await page.waitForTimeout(900);
  const single = await page.evaluate(() => ({
    toc: window.__deepAll('doc-toc').length,
    split: window.__deepAll('.doc-split').length,
    mainOver: window.__deep('.doc-main').scrollHeight - window.__deep('.doc-main').clientHeight,
  }));
  check(
    '单列页面没有分栏也没有目录，正文照旧在外壳正文带里滚',
    single.toc === 0 && single.split === 0 && single.mainOver > 0,
    `doc-toc=${single.toc} · doc-split=${single.split} · 正文带溢出 ${single.mainOver}px`,
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('本页目录相关页面没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
