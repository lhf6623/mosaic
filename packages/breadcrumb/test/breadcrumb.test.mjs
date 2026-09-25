/**
 * mc-breadcrumb / mc-breadcrumb-item · 面包屑：语义（nav + ol + listitem）、分隔符两条通道、
 * 当前项与 aria-current、链接的悬停 / 焦点 / 导航、令牌定制、窄栏换行、
 * 以及文档站里 <doc-crumb> 确实换成这个组件渲染
 */

export default async function run({ page, visit, check }) {
/* ------------------------------------------------------------------ *
 * mc-breadcrumb —— 交互元素是插槽里的原生 <a>，所以这里盯的是组件契约：
 *   容器语义（nav / ol / aria-label）、分隔符（属性与令牌两条通道、第一项没有）、
 *   当前项（current → aria-current + 字色字重）、链接的悬停 / 焦点环 / 真实点击导航、
 *   令牌定制、窄栏自动换行、动态创建不炸（P31）
 * ------------------------------------------------------------------ */

const crumb = await (async () => {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?breadcrumb=1#/packages/breadcrumb/page.html');
  await page
    .waitForFunction(
      () => {
        const bars = window.__deepAll('mc-breadcrumb');
        const items = window.__deepAll('mc-breadcrumb-item');
        // 4 个演示（5 个容器）+ 页面头部的 doc-crumb，全部升级完成
        return (
          bars.length >= 6 &&
          bars.every((b) => b.shadowRoot) &&
          items.length >= 18 &&
          items.every((i) => i.shadowRoot)
        );
      },
      { timeout: 8000 },
    )
    .catch(() => {});

  /** 基础演示：语义 / 分隔符 / 当前项 / 链接外观 */
  const basic = await page.evaluate(() => {
    const box = window.__deepAll('demo-breadcrumb-basic')[0].shadowRoot;
    const bar = window.__deepAll('mc-breadcrumb', box)[0];
    const items = window.__deepAll('mc-breadcrumb-item', box);
    const cs = (el, pe) => getComputedStyle(el, pe);
    const nav = bar.shadowRoot.querySelector('nav');
    const ol = bar.shadowRoot.querySelector('ol');
    /** L2 令牌存的是 "R G B" 三元组，转成计算样式的写法才能逐字对比 */
    const tokenRgb = (name) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v ? `rgb(${v.split(/\s+/).join(', ')})` : null;
    };
    return {
      upgraded: !!bar.shadowRoot && items.every((i) => i.shadowRoot),
      tag: bar.tagName.toLowerCase(),
      navTag: nav.tagName,
      partBase: nav.getAttribute('part'),
      ariaLabel: nav.getAttribute('aria-label'),
      listTag: ol.tagName,
      listRole: ol.getAttribute('role'),
      listPart: ol.getAttribute('part'),
      listWrap: cs(ol).flexWrap,
      gap: cs(ol).gap,
      roles: items.map((i) => i.getAttribute('role')),
      aria: items.map((i) => i.getAttribute('aria-current')),
      colors: items.map((i) => cs(i).color),
      weights: items.map((i) => cs(i).fontWeight),
      fontSizes: items.map((i) => cs(i).fontSize),
      before: items.map((i) => cs(i, '::before').content),
      beforeColor: items.map((i) => cs(i, '::before').color),
      anchorColor: items.map((i) => (i.querySelector('a') ? cs(i.querySelector('a')).color : null)),
      anchorDecoration: items.map((i) =>
        i.querySelector('a') ? cs(i.querySelector('a')).textDecorationLine : null,
      ),
      tokens: { item: tokenRgb('--mc-color-fg-muted'), hover: tokenRgb('--mc-color-fg') },
    };
  });

  /** 悬停：真实鼠标打在第一级的链接上，颜色变实 + 出下划线 */
  await page.locator('demo-breadcrumb-basic mc-breadcrumb-item a').first().hover();
  await page.waitForTimeout(300);
  const hover = await page.evaluate(() => {
    const box = window.__deepAll('demo-breadcrumb-basic')[0].shadowRoot;
    const item = window.__deepAll('mc-breadcrumb-item', box)[0];
    const a = item.querySelector('a');
    return {
      hovered: item.matches(':hover'),
      color: getComputedStyle(a).color,
      decoration: getComputedStyle(a).textDecorationLine,
    };
  });

  /** 键盘：Tab 从第一级到第二级，焦点环用 ring 令牌（P16） */
  const keyboard = await (async () => {
    await page.locator('demo-breadcrumb-basic mc-breadcrumb-item a').first().focus();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    return page.evaluate(() => {
      const box = window.__deepAll('demo-breadcrumb-basic')[0].shadowRoot;
      const active = box.activeElement;
      const ring = getComputedStyle(document.documentElement).getPropertyValue('--mc-color-ring').trim();
      return {
        text: active?.textContent?.trim() ?? null,
        focusVisible: !!active?.matches?.(':focus-visible'),
        outlineWidth: active ? getComputedStyle(active).outlineWidth : null,
        outlineColor: active ? getComputedStyle(active).outlineColor : null,
        ringExpected: ring ? `rgb(${ring.split(/\s+/).join(', ')})` : null,
      };
    });
  })();

  /** 分隔符演示：属性（&gt;）与令牌（·）两条通道各一条，第一项都没有分隔符 */
  const separator = await page.evaluate(() => {
    const box = window.__deepAll('demo-breadcrumb-separator')[0].shadowRoot;
    const cs = (el, pe) => getComputedStyle(el, pe);
    return window.__deepAll('mc-breadcrumb', box).map((bar) => {
      const items = [...bar.querySelectorAll('mc-breadcrumb-item')];
      return {
        attr: bar.getAttribute('separator'),
        before: items.map((i) => cs(i, '::before').content),
      };
    });
  });

  /** 定制演示：令牌（色 + 间距 + 分隔符）整组生效。三条色令牌用的值互不相同，
      所以「分隔符用了分隔符色、不是当前项色」这件事真的被验到 */
  const customize = await page.evaluate(() => {
    const box = window.__deepAll('demo-breadcrumb-customize')[0].shadowRoot;
    const bar = window.__deepAll('mc-breadcrumb', box)[0];
    const own = [...bar.querySelectorAll('mc-breadcrumb-item')];
    const cs = (el, pe) => getComputedStyle(el, pe);
    const tokenRgb = (name) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v ? `rgb(${v.split(/\s+/).join(', ')})` : null;
    };
    return {
      before: own.map((i) => cs(i, '::before').content),
      sepColor: cs(own[1], '::before').color,
      gap: cs(bar.shadowRoot.querySelector('ol')).gap,
      normalColor: cs(own[0]).color,
      currentColor: cs(own[2]).color,
      expected: {
        sep: tokenRgb('--mc-color-fg'),
        normal: tokenRgb('--mc-color-fg-subtle'),
        current: tokenRgb('--mc-color-primary'),
      },
    };
  });

  /** 窄栏换行：容器限宽，整行高度超过单级行高 */
  const long = await page.evaluate(() => {
    const box = window.__deepAll('demo-breadcrumb-long')[0].shadowRoot;
    const bar = window.__deepAll('mc-breadcrumb', box)[0];
    const own = [...bar.querySelectorAll('mc-breadcrumb-item')];
    const rect = (el) => el.getBoundingClientRect();
    return {
      items: own.length,
      barHeight: Math.round(rect(bar).height),
      rowHeight: Math.round(rect(own[0]).height),
      beforeCount: own.filter((i) => getComputedStyle(i, '::before').content !== 'none').length,
    };
  });

  /** 动态创建（P31）+ separator 属性与令牌两条通道互不踩踏 + current 运行时切换 +
      使用者自己的 role / aria-current 不被改写 */
  const dynamic = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const cs = (el, pe) => getComputedStyle(el, pe);
    const makeItem = (text, attrs = {}) => {
      const item = document.createElement('mc-breadcrumb-item');
      for (const [k, v] of Object.entries(attrs)) item.setAttribute(k, v);
      item.textContent = text;
      return item;
    };

    const bar = document.createElement('mc-breadcrumb');
    // 先量「构造期有没有往宿主写属性」，再写自己的令牌（P31）
    const atCreate = bar.getAttributeNames().length;
    bar.style.setProperty('--mc-breadcrumb-sep', "'~'");
    const items = [makeItem('一'), makeItem('二', { current: '' })];
    // 使用者自己写了 role / aria-current：组件只补缺，不改写
    const ownRole = makeItem('三', { role: 'presentation' });
    const ownAria = makeItem('四', { 'aria-current': 'step' });
    bar.append(...items, ownRole, ownAria);
    document.body.append(bar);
    await wait(400);

    const contents = () => items.map((i) => cs(i, '::before').content);
    const out = {
      atCreate,
      shadow: !!bar.shadowRoot,
      itemShadows: items.every((i) => i.shadowRoot),
      roles: items.map((i) => i.getAttribute('role')),
      aria: items.map((i) => i.getAttribute('aria-current')),
      ownRole: ownRole.getAttribute('role'),
      ownAria: ownAria.getAttribute('aria-current'),
      token: contents(),
    };

    // 属性优先
    bar.setAttribute('separator', '>');
    await wait(250);
    out.attrWins = contents();

    // 属性回默认：内部变量被清掉，使用者的令牌要原样生效（回归）
    bar.removeAttribute('separator');
    await wait(250);
    out.tokenBack = contents();

    // 公开 API label → <nav aria-label>
    bar.setAttribute('label', 'Breadcrumb');
    await wait(250);
    out.navLabel = bar.shadowRoot.querySelector('nav').getAttribute('aria-label');

    // current 运行时切换 → aria-current 跟着走
    items[0].setAttribute('current', '');
    await wait(250);
    out.afterSet = items[0].getAttribute('aria-current');
    items[0].removeAttribute('current');
    await wait(250);
    out.afterRemove = items[0].getAttribute('aria-current');

    bar.remove();
    return out;
  });

  /** 文档站集成：页面头部的 <doc-crumb> 由 <mc-breadcrumb> 渲染（本页就是「组件 / Breadcrumb」） */
  const docCrumb = await page.evaluate(() => {
    const trail = window.__deep('doc-crumb');
    const bar = trail?.querySelector('mc-breadcrumb');
    const items = bar ? [...bar.querySelectorAll('mc-breadcrumb-item')] : [];
    return {
      component: !!bar,
      nav: bar?.shadowRoot?.querySelector('nav')?.tagName ?? null,
      levels: items.length,
      texts: items.map((i) => i.textContent.trim()),
      href: items[0]?.querySelector('a')?.getAttribute('href') ?? null,
      current: items.at(-1)?.getAttribute('aria-current') ?? null,
    };
  });

  /** 真实点击第二级链接（组件）：路由跟着走（原生 <a>，组件不拦） */
  const hashBefore = await page.evaluate(() => location.hash);
  await page.locator('demo-breadcrumb-basic mc-breadcrumb-item a').nth(1).click();
  await page.waitForTimeout(400);
  const hashAfter = await page.evaluate(() => location.hash);

  page.off('response', onResponse);
  page.off('pageerror', onError);
  return {
    basic,
    hover,
    keyboard,
    separator,
    customize,
    long,
    dynamic,
    docCrumb,
    hashBefore,
    hashAfter,
    failed,
  };
})();

check(
  'mc-breadcrumb / mc-breadcrumb-item 注册并渲染出实例（全部升级）',
  crumb.basic.upgraded && crumb.basic.roles.length === 3,
  `升级=${crumb.basic.upgraded} · 基础演示 ${crumb.basic.roles.length} 级`,
);

check(
  '容器语义：nav[part=base] + ol[part=list] role=list，无障碍名默认「面包屑」，列表可换行',
  crumb.basic.navTag === 'NAV' &&
    crumb.basic.partBase === 'base' &&
    crumb.basic.ariaLabel === '面包屑' &&
    crumb.basic.listTag === 'OL' &&
    crumb.basic.listRole === 'list' &&
    crumb.basic.listPart === 'list' &&
    crumb.basic.listWrap === 'wrap' &&
    crumb.basic.gap === '8px',
  JSON.stringify({
    nav: crumb.basic.navTag,
    aria: crumb.basic.ariaLabel,
    list: crumb.basic.listRole,
    wrap: crumb.basic.listWrap,
    gap: crumb.basic.gap,
  }),
);

check(
  '每一级 role=listitem，字号跟着容器走（不落回 shadow-base 的 text-base）',
  crumb.basic.roles.every((r) => r === 'listitem') &&
    crumb.basic.fontSizes.every((s) => s === '14px'),
  JSON.stringify({ roles: crumb.basic.roles, fontSizes: crumb.basic.fontSizes }),
);

check(
  '分隔符画在每一项的 ::before 上：第一项没有，其余是默认 /',
  JSON.stringify(crumb.basic.before) === JSON.stringify(['none', '"/"', '"/"']),
  JSON.stringify(crumb.basic.before),
);

check(
  'separator 属性与 --mc-breadcrumb-sep 令牌两条通道都能换分隔符',
  JSON.stringify(crumb.separator[0]?.before) === JSON.stringify(['none', '">"', '">"']) &&
    JSON.stringify(crumb.separator[1]?.before) === JSON.stringify(['none', '"·"', '"·"']),
  JSON.stringify(crumb.separator.map((s) => s.before)),
);

check(
  '当前项：current → aria-current="page"，字色更实、字重更重；普通级不带 aria-current',
  JSON.stringify(crumb.basic.aria) === JSON.stringify([null, null, 'page']) &&
    crumb.basic.colors[2] !== crumb.basic.colors[0] &&
    Number(crumb.basic.weights[2]) > Number(crumb.basic.weights[0]),
  JSON.stringify({ aria: crumb.basic.aria, colors: crumb.basic.colors, weights: crumb.basic.weights }),
);

check(
  '链接外观：默认无下划线，颜色就是 --mc-color-fg-muted 令牌（不是 UA 的蓝）',
  crumb.basic.anchorDecoration[0] === 'none' &&
    crumb.basic.anchorDecoration[1] === 'none' &&
    crumb.basic.anchorColor[0] === crumb.basic.colors[0] &&
    crumb.basic.colors[0] === crumb.basic.tokens.item,
  JSON.stringify({
    decoration: crumb.basic.anchorDecoration,
    color: crumb.basic.anchorColor,
    token: crumb.basic.tokens.item,
  }),
);

check(
  '悬停：文字变成 --mc-color-fg 令牌 + 出下划线（真实鼠标）',
  crumb.hover.hovered &&
    crumb.hover.decoration === 'underline' &&
    crumb.hover.color === crumb.basic.tokens.hover &&
    crumb.hover.color !== crumb.basic.colors[0],
  JSON.stringify({ ...crumb.hover, token: crumb.basic.tokens.hover }),
);

check(
  '键盘：Tab 走到下一级且焦点环用 ring 令牌（2px + --mc-color-ring）',
  crumb.keyboard.text === '组件' &&
    crumb.keyboard.focusVisible &&
    parseFloat(crumb.keyboard.outlineWidth) === 2 &&
    crumb.keyboard.outlineColor === crumb.keyboard.ringExpected,
  JSON.stringify(crumb.keyboard),
);

check(
  '窄栏自动换行：限宽后整行高度超过单级行高，分隔符个数 = 级数 - 1',
  crumb.long.items === 4 &&
    crumb.long.barHeight > crumb.long.rowHeight &&
    crumb.long.beforeCount === 3,
  JSON.stringify(crumb.long),
);

check(
  '令牌定制整组生效：分隔符 / 分隔符色 / 间距 / 普通色 / 当前色（逐条对令牌值）',
  JSON.stringify(crumb.customize.before) === JSON.stringify(['none', '"→"', '"→"']) &&
    crumb.customize.gap === '12px' &&
    crumb.customize.sepColor === crumb.customize.expected.sep &&
    crumb.customize.normalColor === crumb.customize.expected.normal &&
    crumb.customize.currentColor === crumb.customize.expected.current,
  JSON.stringify(crumb.customize),
);

check(
  'document.createElement 创建的实例照常初始化（P31：构造期没往宿主写属性）',
  crumb.dynamic.atCreate === 0 &&
    crumb.dynamic.shadow &&
    crumb.dynamic.itemShadows &&
    JSON.stringify(crumb.dynamic.roles) === JSON.stringify(['listitem', 'listitem']),
  JSON.stringify({
    atCreate: crumb.dynamic.atCreate,
    shadow: crumb.dynamic.shadow,
    roles: crumb.dynamic.roles,
  }),
);

check(
  '使用者自己的 role / aria-current 不被改写（组件只补缺）',
  crumb.dynamic.ownRole === 'presentation' && crumb.dynamic.ownAria === 'step',
  JSON.stringify({ ownRole: crumb.dynamic.ownRole, ownAria: crumb.dynamic.ownAria }),
);

check(
  'label 属性落到 <nav aria-label>（运行时改也生效）',
  crumb.dynamic.navLabel === 'Breadcrumb',
  `aria-label=${crumb.dynamic.navLabel}`,
);

check(
  '属性优先于令牌，且属性回默认后令牌原样生效（两条通道互不踩踏）',
  JSON.stringify(crumb.dynamic.token) === JSON.stringify(['none', '"~"']) &&
    JSON.stringify(crumb.dynamic.attrWins) === JSON.stringify(['none', '">"']) &&
    JSON.stringify(crumb.dynamic.tokenBack) === JSON.stringify(['none', '"~"']),
  JSON.stringify({
    token: crumb.dynamic.token,
    attrWins: crumb.dynamic.attrWins,
    tokenBack: crumb.dynamic.tokenBack,
  }),
);

check(
  'current 运行时切换：aria-current 跟着加 / 摘',
  crumb.dynamic.aria[1] === 'page' &&
    crumb.dynamic.afterSet === 'page' &&
    crumb.dynamic.afterRemove === null,
  JSON.stringify({
    aria: crumb.dynamic.aria,
    afterSet: crumb.dynamic.afterSet,
    afterRemove: crumb.dynamic.afterRemove,
  }),
);

check(
  '文档站的 <doc-crumb> 已经换成 mc-breadcrumb 渲染（组件 / Breadcrumb）',
  crumb.docCrumb.component &&
    crumb.docCrumb.nav === 'NAV' &&
    crumb.docCrumb.levels === 2 &&
    JSON.stringify(crumb.docCrumb.texts) === JSON.stringify(['组件', 'Breadcrumb']) &&
    (crumb.docCrumb.href ?? '').includes('docs/pages/components.html') &&
    crumb.docCrumb.current === 'page',
  JSON.stringify(crumb.docCrumb),
);

check(
  '真实点击链接：路由跟着走（组件不拦原生 <a>）',
  crumb.hashBefore !== crumb.hashAfter && crumb.hashAfter.includes('docs/pages/components.html'),
  `${crumb.hashBefore} → ${crumb.hashAfter}`,
);

check(
  'mc-breadcrumb 文档页没有 404 / 运行时报错',
  crumb.failed.length === 0,
  crumb.failed.join(' | ') || '无',
);
}
