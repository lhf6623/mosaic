/**
 * 站点 · 右栏「本页目录」（<doc-toc>）：
 * 扫标题生成（h2/h3 一条不漏）、两级大纲（h2 = 节 / h3 = 子项缩进）、每项都放得下不被截断、
 * 点击滚到标题（且不改地址栏 hash）、滚动时高亮跟着走、窄屏收掉右栏
 *
 * ⚠️ <doc-toc> 现在是 ofa 组件模板、自带 shadow root：条目（mc-menu / a）都在它的 shadow 里，
 * 所以下面取到宿主后一律走 `host.shadowRoot` 再查（`window.__deep` 只负责找到宿主本身）。
 */

/**
 * 量一遍右栏的每一项：级别 / 缩进 / 余量。
 * 余量 = 可点宽度 − 缩进 − 文字宽度：条目是单行 + `overflow: hidden`，
 * 余量为负就是被截成了省略号 —— 右栏宽度与缩进量就是按这条预算定的（见 docs/doc-layout.html）。
 */
const readTocRows = (page) =>
  page.evaluate(() => {
    const el = window.__deep('doc-toc');
    const root = el?.shadowRoot ?? el;
    const links = root ? [...root.querySelectorAll('a')] : [];
    return links.map((a) => {
      const item = a.closest('mc-menu-item');
      const range = document.createRange();
      range.selectNodeContents(a);
      const indent = parseFloat(getComputedStyle(a).textIndent) || 0;
      return {
        text: a.textContent.trim(),
        deep: item?.hasAttribute('data-level') ?? false,
        indent,
        slack: Math.round(
          a.getBoundingClientRect().width - indent - range.getBoundingClientRect().width,
        ),
      };
    });
  });

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
    // 目录是正文大纲的**镜像**：h2/h3 一条不漏，两边数量必须相等
    const headings = page ? [...page.shadowRoot.querySelectorAll('h2, h3')] : [];
    const levels = links.map((a) => a.dataset.tocId);
    return {
      exists: !!el,
      links: links.length,
      headings: headings.length,
      first: links[0]?.textContent?.trim() ?? null,
      current: root?.querySelector('a[aria-current]')?.textContent?.trim() ?? null,
      currentValue: root?.querySelector('a[aria-current]')?.getAttribute('aria-current') ?? null,
      idsMatch: links.every((a, i) => levels[i] === headings[i]?.id),
      headingLevels: headings.map((h) => h.tagName),
      mainOver: main.scrollHeight - main.clientHeight,
      menuUpgraded: !!root?.querySelector('mc-menu')?.shadowRoot,
    };
  });
  const rows = await readTocRows(page);
  const shallowIndent = rows.find((r) => !r.deep)?.indent ?? null;

  check(
    '组件页右栏有本页目录，项数 = 页面 h2/h3 数（一条不漏），且顺序 / id 一一对应',
    toc.exists && toc.links > 4 && toc.links === toc.headings && toc.idsMatch,
    `${toc.links} 项 / ${toc.headings} 个标题 · 对应=${toc.idsMatch}`,
  );
  check(
    '目录用 mc-menu 渲染（不是自己造的一套），且**两级**：h2 = 节不缩进、h3 = 子项深一档',
    toc.menuUpgraded &&
      toc.headingLevels.includes('H2') &&
      toc.headingLevels.includes('H3') &&
      rows.every((r, i) => r.deep === (toc.headingLevels[i] === 'H3')) &&
      rows.every((r) => !r.deep || r.indent > shallowIndent) &&
      new Set(rows.filter((r) => !r.deep).map((r) => r.indent)).size === 1,
    `升级=${toc.menuUpgraded} · 层级=${[...new Set(toc.headingLevels)].join('/')} · 缩进 ${[...new Set(rows.map((r) => `${r.deep ? '子项' : '节'}=${r.indent}px`))].join(' ')}`,
  );
  check(
    '每一项都放得下：缩进吃了可点宽度，但没有一项被省略号截断',
    rows.length > 0 && rows.every((r) => r.slack >= 0),
    `最小余量 ${rows.length ? Math.min(...rows.map((r) => r.slack)) : '—'}px`,
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

  /* 页尾收尾：判定带只有滚动区顶部 30%，最后一节可能整节都在带下面 —— 不单独收尾就永远点不亮 */

  const tail = await page.evaluate(async () => {
    const el = window.__deep('doc-toc');
    const root = el?.shadowRoot ?? el;
    const links = [...root.querySelectorAll('a')];
    const main = window.__deep('.doc-main');
    main.scrollTop = main.scrollHeight;
    await new Promise((r) => setTimeout(r, 250));
    return {
      current: root.querySelector('a[aria-current]')?.dataset.tocId ?? null,
      last: links.at(-1)?.dataset.tocId ?? null,
      lastText: links.at(-1)?.textContent.trim() ?? null,
    };
  });
  check(
    '滚到底：当前项落到最后一条（页尾那几节在判定带以外，必须单独收尾）',
    tail.last !== null && tail.current === tail.last,
    `当前=${tail.current} · 最后一项=${tail.last}（${tail.lastText}）`,
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
    '组件页：「例子」也在目录里（目录 = 正文大纲的镜像），首项就是它',
    onButton.headings[0] === '例子' &&
      onButton.items[0] === '例子' &&
      onButton.items.length === onButton.headings.length,
    `${onButton.headings.length} 个标题 → ${onButton.items.length} 项目录 · 首项「${onButton.items[0]}」`,
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
  /* menu 页装着全站最长的那个标题（「卡片外观（variant="surface"）」），
     右栏宽度 / 缩进量的预算就是按它定的 —— 这里量一次，别让宽度在别处被悄悄改窄 */
  const menuRows = await readTocRows(page);
  const tightest = menuRows.reduce((a, b) => (b.slack < a.slack ? b : a), menuRows[0]);

  check(
    '换页后目录跟着换：元素跨页存活，内容扫的是新页的标题',
    onMenu.same &&
      onButton.count > 4 &&
      onMenu.count > 4 &&
      onMenu.items.join('|') !== onButton.items.join('|') &&
      onMenu.current !== null,
    `同元素=${onMenu.same} · button ${onButton.items.slice(0, 3).join(' / ')}(${onButton.count}) · menu ${onMenu.items.slice(0, 3).join(' / ')}(${onMenu.count})`,
  );
  check(
    '全站最长的那条也放得下（menu 页）：右栏宽度 = 「最长标题 + 缩进」反算出来的',
    menuRows.length > 0 && menuRows.every((r) => r.slack >= 0),
    `最小余量 ${tightest.slack}px ·「${tightest.text}」`,
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
