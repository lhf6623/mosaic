/**
 * 站点 · 右栏「本页目录」（<doc-toc>）：
 * 扫标题生成、h3 缩进、点击滚到标题（且不改地址栏 hash）、滚动时高亮跟着走、窄屏收掉右栏
 *
 * ⚠️ <doc-toc> 现在是 ofa 组件模板、自带 shadow root：条目（mc-menu / a）都在它的 shadow 里，
 * 所以下面取到宿主后一律走 `host.shadowRoot` 再查（`window.__deep` 只负责找到宿主本身）。
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
    const root = el?.shadowRoot ?? el;
    const links = root ? [...root.querySelectorAll('a')] : [];
    // 标题在子页面（被 slot 投影进来的那一页）的 shadow root 里，不在目录元素自己的 root 里
    const page = [...window.__deepAll('o-page')].at(-1);
    const allHeadings = page ? [...page.shadowRoot.querySelectorAll('h2, h3')] : [];
    /* 与 docs/components/toc.html 的 SKIP_TITLES 同一条规则：组件页骨架的第一节「例子」不进目录 */
    const headings = allHeadings.filter((h) => h.textContent.trim() !== '例子');
    const levels = links.map((a) => a.dataset.tocId);
    return {
      exists: !!el,
      links: links.length,
      headings: headings.length,
      first: links[0]?.textContent?.trim() ?? null,
      current: root?.querySelector('a[aria-current]')?.textContent?.trim() ?? null,
      currentValue: root?.querySelector('a[aria-current]')?.getAttribute('aria-current') ?? null,
      idsMatch: links.every((a, i) => levels[i] === headings[i]?.id),
      indents: links.map((a) => getComputedStyle(a).textIndent),
      headingLevels: headings.map((h) => h.tagName),
      allHeadings: allHeadings.length,
      mainOver: main.scrollHeight - main.clientHeight,
      menuUpgraded: !!root?.querySelector('mc-menu')?.shadowRoot,
    };
  });

  check(
    '组件页右栏有本页目录，项数 = 页面 h2/h3 数，且顺序 / id 一一对应',
    toc.exists && toc.links > 4 && toc.links === toc.headings && toc.idsMatch,
    `${toc.links} 项 / ${toc.headings} 个标题 · 对应=${toc.idsMatch}`,
  );
  check(
    '目录用 mc-menu 渲染（不是自己造的一套），且**级别拉平**：h2/h3 一视同仁、缩进一致',
    toc.menuUpgraded &&
      toc.headingLevels.includes('H2') &&
      toc.headingLevels.includes('H3') &&
      new Set(toc.indents).size === 1,
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
    const root = el?.shadowRoot ?? el;
    const before = root.querySelector('a[aria-current]')?.dataset.tocId ?? null;
    // 滚动在顶栏下面的正文带里（window 不可滚）
    const main = window.__deep('.doc-main');
    main.scrollTop = Math.round(main.scrollHeight * 0.5);
    await new Promise((r) => setTimeout(r, 250));
    const after = root.querySelector('a[aria-current]')?.dataset.tocId ?? null;
    const host = [...root.querySelectorAll('mc-menu-item')].filter((i) => i.hasAttribute('data-current'));
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
    const tocs = window.__deep('doc-toc');
    const root = tocs?.shadowRoot ?? tocs;
    const links = [...root.querySelectorAll('a')];
    const a = links[Math.min(2, links.length - 1)];
    return { id: a.dataset.tocId, text: a.textContent.trim(), hash: location.hash };
  });
  await page.evaluate((id) => {
    const hits = window.__deep('doc-toc');
    const root = hits?.shadowRoot ?? hits;
    const links = [...root.querySelectorAll('a')];
    links.find((a) => a.dataset.tocId === id).click();
  }, target.id);
  await page.waitForTimeout(1200); // 平滑滚动

  const jumped = await page.evaluate((id) => {
    const heading = window.__deepAll(`#${id}`)[0];
    const topbar = window.__deep('.doc-top');
    const el = window.__deep('doc-toc');
    return {
      hash: location.hash,
      // 顶栏是 sticky，标题要落在它下面（scroll-margin-top 那条）
      topbarBottom: Math.round(topbar.getBoundingClientRect().bottom),
      headingTop: heading ? Math.round(heading.getBoundingClientRect().top) : null,
      current: (el?.shadowRoot ?? el).querySelector('a[aria-current]')?.dataset.tocId ?? null,
    };
  }, target.id);

  check(
    '点目录项：内容滚到那个标题（落在顶栏下方、不被压住）',
    jumped.headingTop !== null &&
      jumped.headingTop >= jumped.topbarBottom - 1 &&
      jumped.headingTop < jumped.topbarBottom + 120 &&
      jumped.current === target.id,
    `「${target.text}」标题 top=${jumped.headingTop}px · 顶栏底 ${jumped.topbarBottom}px · 当前项=${jumped.current}`,
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
    const content = window.__deep('.doc-split > .doc-content');
    const cs = getComputedStyle(content);
    return {
      display: getComputedStyle(el).display,
      // 右栏收掉后，正文右侧给它的占位也要跟着去掉；左栏还在，左侧占位要留着
      paddingRight: cs.paddingRight,
      paddingLeft: cs.paddingLeft,
      navFixed: getComputedStyle(window.__deep('doc-nav')).position,
    };
  });
  check(
    '中档宽度收起右栏，正文右侧的占位也去掉',
    narrow.display === 'none' &&
      narrow.paddingRight === '0px' &&
      narrow.paddingLeft !== '0px' &&
      narrow.navFixed === 'fixed',
    `目录 display=${narrow.display} · 中栏 padding ${narrow.paddingLeft}/${narrow.paddingRight} · 左栏 position=${narrow.navFixed}`,
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
    const root = el.shadowRoot;
    const items = [...root.querySelectorAll('a')].map((a) => a.textContent.trim());
    const pageRoot = [...window.__deepAll('o-page')].at(-1)?.shadowRoot;
    const headings = pageRoot
      ? [...pageRoot.querySelectorAll('h2, h3')].map((h) => h.textContent.trim())
      : [];
    return {
      items,
      count: items.length,
      headings,
      current: root.querySelector('a[aria-current]')?.dataset.tocId ?? null,
    };
  });

  check(
    '组件页：「例子」那一节不进目录（标题在正文里、目录里没有），首项从第一个演示开始',
    onButton.headings.includes('例子') &&
      !onButton.items.includes('例子') &&
      onButton.items.length === onButton.headings.length - 1,
    `${onButton.headings.length} 个标题（含「例子」）→ ${onButton.items.length} 项目录 · 首项「${onButton.items[0]}」`,
  );

  await goHash('packages/menu/page.html');
  await page.waitForTimeout(1200);
  const onMenu = await page.evaluate(() => {
    const el = window.__deep('doc-toc');
    const items = [...(el?.shadowRoot?.querySelectorAll('a') ?? [])].map((a) =>
      a.textContent.trim(),
    );
    return {
      same: el?.__probeId === 'toc-1',
      items,
      count: items.length,
      current: el?.shadowRoot?.querySelector('a[aria-current]')?.dataset.tocId ?? null,
    };
  });

  check(
    '换页后目录跟着换：元素跨页存活，内容扫的是新页的标题',
    onMenu.same &&
      onButton.count > 4 &&
      onMenu.count > 4 &&
      onMenu.items.join('|') !== onButton.items.join('|') &&
      onMenu.current !== null,
    `同元素=${onMenu.same} · button ${onButton.items.slice(0, 3).join(' / ')}(${onButton.count}) · menu ${onMenu.items.slice(0, 3).join(' / ')}(${onMenu.count})`,
  );

  /* ------------------------------------------------------------------ *
   * 单列页面（没有分栏、也就没放 <doc-toc>）：不该凭空长出右栏
   * ------------------------------------------------------------------ */

  await goHash('docs/pages/guide.html');
  await page.waitForTimeout(900);
  const single = await page.evaluate(() => {
    const main = window.__deep('.doc-main');
    return {
      toc: window.__deepAll('doc-toc').length,
      split: window.__deepAll('.doc-split').length,
      mainOver: main.scrollHeight - main.clientHeight,
      leftPad: getComputedStyle(window.__deep('.doc-body')).paddingLeft,
    };
  });
  check(
    '单列页面没有分栏也没有目录，正文照旧在正文带里滚',
    single.toc === 0 && single.split === 0 && single.mainOver > 0 && single.leftPad !== '0px',
    `doc-toc=${single.toc} · doc-split=${single.split} · 正文带可滚 ${single.mainOver}px`,
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('本页目录相关页面没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
