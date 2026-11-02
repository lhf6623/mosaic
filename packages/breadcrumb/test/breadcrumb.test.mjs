/**
 * mc-breadcrumb / mc-breadcrumb-item · 面包屑：结构（nav + ol + part）、分隔符两条通道、
 * 当前项（current 属性）、链接的悬停 / 焦点 / 导航、令牌定制、窄栏换行
 */

export default async function run({ page, visit, check }) {
/* ------------------------------------------------------------------ *
 * mc-breadcrumb —— 交互元素是插槽里的原生 <a>，所以这里盯的是组件契约：
 *   容器结构（nav / ol / part）、分隔符（属性与令牌两条通道、第一项没有）、
 *   当前项（current 属性 → 字色字重）、链接的悬停 / 焦点环 / 真实点击导航、
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

  /* 分隔符画在**级自己的 shadow** 里（`.mc-sep`），不是容器的 ::slotted::before —— 这样级被
     o-fill / o-if 包着也照样有分隔符。全套件统一从这两个助手读，别再直接摸宿主的 ::before。
     「有没有分隔符」= 盒子显不显示（容器按文档顺序写 data-sep）；文本再从盒子的 ::before 取。 */
  await page.addInitScript(() => {
    window.__sepBox = (item) => item.shadowRoot?.querySelector('.mc-sep') ?? null;
    window.__sepText = (item) => {
      const box = window.__sepBox(item);
      if (!box) return 'missing';
      return getComputedStyle(box).display === 'none'
        ? 'none'
        : getComputedStyle(box, '::before').content;
    };
  });

  await visit(page, '/index.html?breadcrumb=1#/packages/breadcrumb/page.html');
  await page
    .waitForFunction(
      () => {
        const bars = window.__deepAll('mc-breadcrumb');
        const items = window.__deepAll('mc-breadcrumb-item');
        // 演示区里的容器与级全部升级完成（含动态创建那条用例所需的宿主）
        return (
          bars.length >= 7 &&
          bars.every((b) => b.shadowRoot) &&
          items.length >= 25 &&
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
    const sepBox = (item) => item.shadowRoot.querySelector('.mc-sep');
    const nav = bar.shadowRoot.querySelector('nav');
    const ol = bar.shadowRoot.querySelector('ol');
    /** L2 令牌存的是 "R G B" 三元组，转成计算样式的写法才能逐字对比 */
    const tokenRgb = (name) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v ? `rgb(${v.split(/\s+/).join(', ')})` : null;
    };
    return {
      upgraded: !!bar.shadowRoot && items.every((i) => i.shadowRoot),
      itemCount: items.length,
      tag: bar.tagName.toLowerCase(),
      navTag: nav.tagName,
      partBase: nav.getAttribute('part'),
      listTag: ol.tagName,
      listPart: ol.getAttribute('part'),
      listWrap: cs(ol).flexWrap,
      gap: cs(ol).gap,
      currentFlags: items.map((i) => i.hasAttribute('current')),
      colors: items.map((i) => cs(i).color),
      weights: items.map((i) => cs(i).fontWeight),
      fontSizes: items.map((i) => cs(i).fontSize),
      /* 分隔符画在级自己的 shadow 里（.mc-sep），不是容器的 ::slotted::before：
         级被 o-fill / o-if 包着时也算数 —— 所以这里统一读 .mc-sep */
      before: items.map((i) => window.__sepText(i)),
      beforeColor: items.map((i) => cs(sepBox(i), '::before').color),
      sepShown: items.map((i) => cs(sepBox(i)).display !== 'none'),
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
      const sepBox = (item) => item.shadowRoot.querySelector('.mc-sep');
      return {
        attr: bar.getAttribute('separator'),
        before: items.map((i) => window.__sepText(i)),
        shown: items.map((i) => cs(sepBox(i)).display !== 'none'),
      };
    });
  });

  /** 数据渲染：固定的第一级 + o-fill 里的几级。级**不是容器的直接子元素**（o-fill 是
      display: contents 的包裹元素），分隔符仍按文档顺序数：第一级不画，其余都画。
      这也是 CSS 的 :first-of-type 判不了的那种情况 —— o-fill 里第一个本来就是 :first-of-type，
      靠容器写的 data-sep 纠正回来 */
  const dataDriven = await page.evaluate(() => {
    const box = window.__deepAll('demo-breadcrumb-data')[0].shadowRoot;
    const bar = box.querySelector('mc-breadcrumb');
    const items = [...bar.querySelectorAll('mc-breadcrumb-item')];
    const fill = bar.querySelector('o-fill');
    return {
      itemCount: items.length,
      parents: items.map((i) => i.parentElement.tagName),
      fillIsChild: fill?.parentElement === bar,
      fillDisplay: fill ? getComputedStyle(fill).display : null,
      labels: items.map((i) => i.textContent.trim()),
      sepText: items.map((i) => window.__sepText(i)),
      sepAttrs: items.map((i) => i.hasAttribute('data-sep')),
      currentFlags: items.map((i) => i.hasAttribute('current')),
      firstInFillIsFirstOfType: items[1]?.matches(':first-of-type') ?? null,
      weights: items.map((i) => getComputedStyle(i).fontWeight),
      /* 字号 / 行高：o-fill 自己是一个渲染过的组件，基座样式 `:host { font-size: var(--mc-text-base) }`
         会把继承链打断 —— 级必须读容器的令牌，否则这两级会变成 16px / 24px（实测踩过） */
      fontSizes: items.map((i) => getComputedStyle(i).fontSize),
      lineHeights: items.map((i) => getComputedStyle(i).lineHeight),
    };
  });

  /** 分隔符插槽：写一次分发到每一级（第一级不画），原节点留在容器里不渲染，文本那条让位 */
  const separatorSlot = await page.evaluate(() => {
    const box = window.__deepAll('demo-breadcrumb-separator')[0].shadowRoot;
    const bar = window.__deepAll('mc-breadcrumb', box)[2];
    const items = [...bar.querySelectorAll('mc-breadcrumb-item')];
    const source = bar.querySelector('[slot="separator"]');
    const cs = (el, pe) => getComputedStyle(el, pe);
    const rect = source?.getBoundingClientRect();
    const seal = (item) => item.shadowRoot.querySelector('.mc-sep');
    const tokenRgb = (name) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v ? `rgb(${v.split(/\s+/).join(', ')})` : null;
    };
    return {
      sourceTag: source?.tagName.toLowerCase() ?? null,
      sourceInBar: source?.parentElement === bar,
      sourceHidden: !!rect && rect.width === 0 && rect.height === 0,
      /* data-sep 是容器按文档顺序写的「这一级要画分隔符」；第一级没有 */
      attrs: items.map((i) => i.hasAttribute('data-sep')),
      before: items.map((i) => window.__sepText(i)),
      sepDisplay: items.map((i) => cs(seal(i)).display),
      iconNames: items.map((i) => seal(i).querySelector('mc-icon')?.getAttribute('name') ?? null),
      iconCount: items.map((i) => seal(i).querySelectorAll('mc-icon').length),
      sepColor: cs(seal(items[1])).color,
      sepMargin: cs(seal(items[1])).marginInlineEnd,
      expectedColor: tokenRgb('--mc-color-fg-subtle'),
    };
  });

  /** 定制演示：令牌（色 + 间距 + 分隔符）整组生效。三条色令牌用的值互不相同，
      所以「分隔符用了分隔符色、不是当前项色」这件事真的被验到 */
  const customize = await page.evaluate(() => {
    const box = window.__deepAll('demo-breadcrumb-customize')[0].shadowRoot;
    const bar = window.__deepAll('mc-breadcrumb', box)[0];
    const own = [...bar.querySelectorAll('mc-breadcrumb-item')];
    const cs = (el, pe) => getComputedStyle(el, pe);
    const sepBox = (item) => item.shadowRoot.querySelector('.mc-sep');
    const tokenRgb = (name) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v ? `rgb(${v.split(/\s+/).join(', ')})` : null;
    };
    return {
      before: own.map((i) => window.__sepText(i)),
      sepColor: cs(sepBox(own[1]), '::before').color,
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
      beforeCount: own.filter(
        (i) =>
          getComputedStyle(i.shadowRoot.querySelector('.mc-sep')).display !== 'none' &&
          getComputedStyle(i.shadowRoot.querySelector('.mc-sep'), '::before').content !== 'none',
      ).length,
    };
  });

  /** 动态创建（P31）+ separator 属性与令牌两条通道互不踩踏 + current 运行时切换 */
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
    bar.append(...items);
    document.body.append(bar);
    await wait(400);

    const contents = () => items.map((i) => window.__sepText(i));
    const out = {
      atCreate,
      shadow: !!bar.shadowRoot,
      itemShadows: items.every((i) => i.shadowRoot),
      currentFlags: items.map((i) => i.hasAttribute('current')),
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

    // current 运行时切换 → CSS 状态跟着加 / 摘
    out.weightBefore = cs(items[0]).fontWeight;
    items[0].setAttribute('current', '');
    await wait(250);
    out.afterSet = items[0].hasAttribute('current');
    out.weightAfterSet = cs(items[0]).fontWeight;
    items[0].removeAttribute('current');
    await wait(250);
    out.afterRemove = items[0].hasAttribute('current');
    out.weightAfterRemove = cs(items[0]).fontWeight;

    bar.remove();
    return out;
  });

  /** 分隔符插槽运行时插上 / 摘掉：内容通道 ↔ 文本通道来回切，不叠加、不残留。
      内容写在**最前面**（prepend）—— 第一级的判定按文档顺序数，不会被挤成第二个 */
  const separatorDynamic = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const cs = (el, pe) => getComputedStyle(el, pe);
    const bar = document.createElement('mc-breadcrumb');
    const items = ['一', '二', '三'].map((text) => {
      const item = document.createElement('mc-breadcrumb-item');
      item.textContent = text;
      return item;
    });
    bar.append(...items);
    document.body.append(bar);
    await wait(400);

    const seal = (item) => item.shadowRoot.querySelector('.mc-sep');
    const snapshot = () => ({
      before: items.map((i) => window.__sepText(i)),
      attrs: items.map((i) => i.hasAttribute('data-sep')),
      sep: items.map((i) => cs(seal(i)).display),
      icons: items.map((i) => seal(i).querySelectorAll('mc-icon').length),
    });
    const out = { text: snapshot(), itemShadows: items.every((i) => i.shadowRoot) };

    const icon = document.createElement('mc-icon');
    icon.setAttribute('slot', 'separator');
    icon.setAttribute('name', 'chevron-right');
    bar.prepend(icon);
    await wait(400);
    out.slot = snapshot();
    out.sourceInBar = icon.parentElement === bar;
    out.sourceHidden = icon.getBoundingClientRect().width === 0;

    icon.remove();
    await wait(400);
    out.removed = snapshot();

    // <template> 那种写法：取 content 里的节点（它自己克隆出来是空的）
    const tpl = document.createElement('template');
    tpl.setAttribute('slot', 'separator');
    tpl.innerHTML = '<span>»</span><span class="sep-b">·</span>';
    bar.prepend(tpl);
    await wait(400);
    out.template = {
      sepChildren: items.map((i) => seal(i).childElementCount),
      attrs: items.map((i) => i.hasAttribute('data-sep')),
      before: items.map((i) => window.__sepText(i)),
      text: seal(items[2])?.textContent ?? null,
    };
    tpl.remove();

    bar.remove();
    return out;
  });


  /** 真实点击第二级链接（组件）：路由跟着走（原生 <a>，组件不拦）。
      落到链接目标（第一个组件页）之后再从**左栏**切一次，顺带验「顶栏与左栏一起更新」——
      两者各自订阅同一个 store；若 docs/state/route.js 被实例化成两份（ESM 没去重），
      这里就会停在旧值 */
  const hashBefore = await page.evaluate(() => location.hash);
  await page.locator('demo-breadcrumb-basic mc-breadcrumb-item a').nth(1).click();
  await page.waitForTimeout(900);
  const hashAfter = await page.evaluate(() => location.hash);
  const afterNav = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window
      .__inside('doc-nav', 'a')
      /* 整棵子树里还有隐藏的「全部菜单」浮层副本同文案，只点看得见的那条 */
      .find((a) => a.textContent.includes('Button') && a.getClientRects().length > 0)
      ?.click();
    await wait(1200);
    return {
      hash: location.hash,
      top:
        window.__deepAll('.doc-top-nav mc-button')
          .find((b) => b.hasAttribute('data-current'))
          ?.textContent.trim() ?? null,
      /* 当前项挂在**行**上（mc-menu-item[data-current]，见 menu-item 的状态镜像出口）：
         options 重做之后内置 <a> 只是行里的控件，它身上没有 data-current —— 老选择器恒为 null。
         行由 mc-menu 渲染在第二层 shadow 里，所以取全部当前项的 label 一起判（顺序不保证）。 */
      nav:
        window
          .__inside('doc-nav', 'mc-menu-item[data-current]')
          .map((row) => row.getAttribute('label') ?? '')
          .filter(Boolean)
          .join(' / ') || null,
    };
  });

  page.off('response', onResponse);
  page.off('pageerror', onError);
  return {
    basic,
    hover,
    keyboard,
    separator,
    dataDriven,
    separatorSlot,
    separatorDynamic,
    customize,
    long,
    dynamic,
    hashBefore,
    hashAfter,
    afterNav,
    failed,
  };
})();

check(
  'mc-breadcrumb / mc-breadcrumb-item 注册并渲染出实例（全部升级）',
  crumb.basic.upgraded && crumb.basic.itemCount === 3,
  `升级=${crumb.basic.upgraded} · 基础演示 ${crumb.basic.itemCount} 级`,
);

check(
  '容器结构：nav[part=base] + ol[part=list]，列表可换行（nav / ol 保留原生语义）',
  crumb.basic.navTag === 'NAV' &&
    crumb.basic.partBase === 'base' &&
    crumb.basic.listTag === 'OL' &&
    crumb.basic.listPart === 'list' &&
    crumb.basic.listWrap === 'wrap' &&
    crumb.basic.gap === '8px',
  JSON.stringify({
    nav: crumb.basic.navTag,
    list: crumb.basic.listPart,
    wrap: crumb.basic.listWrap,
    gap: crumb.basic.gap,
  }),
);

check(
  '每一级字号跟着容器走（不落回 shadow-base 的 text-base）',
  crumb.basic.fontSizes.every((s) => s === '14px'),
  JSON.stringify({ fontSizes: crumb.basic.fontSizes }),
);

check(
  '分隔符画在每一级自己的 .mc-sep 上：第一级没有，其余是默认 /',
  JSON.stringify(crumb.basic.before) === JSON.stringify(['none', '"/"', '"/"']),
  JSON.stringify(crumb.basic.before),
);

/* 分隔符盒子的 computed display 是 flex 不是 inline-flex：它是宿主（inline-flex）的 flex 项，
   行内级 display 会被 blockify（CSS Display 3.7）—— 断言按 flex 判 */
check(
  '分隔符插槽：写一次分发到每一级（第一级不画），原节点留在容器里不渲染，文本分隔符让位',
  crumb.separatorSlot.sourceTag === 'mc-icon' &&
    crumb.separatorSlot.sourceInBar &&
    crumb.separatorSlot.sourceHidden &&
    JSON.stringify(crumb.separatorSlot.attrs) === JSON.stringify([false, true, true]) &&
    JSON.stringify(crumb.separatorSlot.before) === JSON.stringify(['none', 'none', 'none']) &&
    JSON.stringify(crumb.separatorSlot.sepDisplay) ===
      JSON.stringify(['none', 'flex', 'flex']) &&
    JSON.stringify(crumb.separatorSlot.iconNames) ===
      JSON.stringify([null, 'chevron-right', 'chevron-right']) &&
    JSON.stringify(crumb.separatorSlot.iconCount) === JSON.stringify([0, 1, 1]),
  JSON.stringify(crumb.separatorSlot),
);

check(
  '分隔符插槽与文本通道共用间距 / 颜色：副本用 --mc-breadcrumb-gap 与 --mc-breadcrumb-sep-color',
  crumb.separatorSlot.sepMargin === '8px' &&
    crumb.separatorSlot.sepColor === crumb.separatorSlot.expectedColor,
  JSON.stringify({
    margin: crumb.separatorSlot.sepMargin,
    color: crumb.separatorSlot.sepColor,
    expected: crumb.separatorSlot.expectedColor,
  }),
);

check(
  '分隔符插槽运行时插上 / 摘掉：内容通道 ↔ 文本通道来回切（不叠加、不残留）',
  crumb.separatorDynamic.itemShadows &&
    JSON.stringify(crumb.separatorDynamic.text.before) === JSON.stringify(['none', '"/"', '"/"']) &&
    JSON.stringify(crumb.separatorDynamic.text.attrs) === JSON.stringify([false, true, true]) &&
    crumb.separatorDynamic.sourceInBar &&
    crumb.separatorDynamic.sourceHidden &&
    JSON.stringify(crumb.separatorDynamic.slot.before) === JSON.stringify(['none', 'none', 'none']) &&
    JSON.stringify(crumb.separatorDynamic.slot.attrs) === JSON.stringify([false, true, true]) &&
    JSON.stringify(crumb.separatorDynamic.slot.sep) ===
      JSON.stringify(['none', 'flex', 'flex']) &&
    JSON.stringify(crumb.separatorDynamic.slot.icons) === JSON.stringify([0, 1, 1]) &&
    JSON.stringify(crumb.separatorDynamic.removed.before) ===
      JSON.stringify(['none', '"/"', '"/"']) &&
    JSON.stringify(crumb.separatorDynamic.removed.attrs) ===
      JSON.stringify([false, true, true]) &&
    JSON.stringify(crumb.separatorDynamic.removed.icons) === JSON.stringify([0, 0, 0]) &&
    JSON.stringify(crumb.separatorDynamic.template.sepChildren) === JSON.stringify([0, 2, 2]) &&
    JSON.stringify(crumb.separatorDynamic.template.attrs) === JSON.stringify([false, true, true]) &&
    JSON.stringify(crumb.separatorDynamic.template.before) ===
      JSON.stringify(['none', 'none', 'none']) &&
    crumb.separatorDynamic.template.text === '»·',
  JSON.stringify(crumb.separatorDynamic),
);

check(
  '数据渲染（o-fill 包一层）：级不是容器的子元素也照样有分隔符，第一级按文档顺序判',
  crumb.dataDriven.itemCount === 3 &&
    JSON.stringify(crumb.dataDriven.parents) ===
      JSON.stringify(['MC-BREADCRUMB', 'O-FILL', 'O-FILL']) &&
    crumb.dataDriven.fillIsChild &&
    crumb.dataDriven.fillDisplay === 'contents' &&
    JSON.stringify(crumb.dataDriven.labels) === JSON.stringify(['首页', '组件', '面包屑']) &&
    JSON.stringify(crumb.dataDriven.sepText) === JSON.stringify(['none', '"/"', '"/"']) &&
    JSON.stringify(crumb.dataDriven.sepAttrs) === JSON.stringify([false, true, true]) &&
    JSON.stringify(crumb.dataDriven.currentFlags) === JSON.stringify([false, false, true]) &&
    /* o-fill 里第一个本来是 :first-of-type，CSS 兜底想藏它 —— data-sep 要压回来 */
    crumb.dataDriven.firstInFillIsFirstOfType === true &&
    /* 字号 / 行高跟着容器令牌走，不被包裹层的基座样式（16px / 24px）顶掉 */
    crumb.dataDriven.fontSizes.every((s) => s === '14px') &&
    crumb.dataDriven.lineHeights.every((h) => h === '20px') &&
    Number(crumb.dataDriven.weights[2]) > Number(crumb.dataDriven.weights[0]),
  JSON.stringify(crumb.dataDriven),
);

check(
  'separator 属性与 --mc-breadcrumb-sep 令牌两条通道都能换分隔符',
  JSON.stringify(crumb.separator[0]?.before) === JSON.stringify(['none', '">"', '">"']) &&
    JSON.stringify(crumb.separator[1]?.before) === JSON.stringify(['none', '"·"', '"·"']),
  JSON.stringify(crumb.separator.map((s) => s.before)),
);

check(
  '当前项：current 属性点亮字色更实、字重更重；普通级不带 current',
  JSON.stringify(crumb.basic.currentFlags) === JSON.stringify([false, false, true]) &&
    crumb.basic.colors[2] !== crumb.basic.colors[0] &&
    Number(crumb.basic.weights[2]) > Number(crumb.basic.weights[0]),
  JSON.stringify({
    currentFlags: crumb.basic.currentFlags,
    colors: crumb.basic.colors,
    weights: crumb.basic.weights,
  }),
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
    JSON.stringify(crumb.dynamic.currentFlags) === JSON.stringify([false, true]),
  JSON.stringify({
    atCreate: crumb.dynamic.atCreate,
    shadow: crumb.dynamic.shadow,
    currentFlags: crumb.dynamic.currentFlags,
  }),
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
  'current 运行时切换：字重跟着加 / 摘（current 只驱动 CSS）',
  crumb.dynamic.currentFlags[1] === true &&
    crumb.dynamic.afterSet === true &&
    Number(crumb.dynamic.weightAfterSet) > Number(crumb.dynamic.weightBefore) &&
    crumb.dynamic.afterRemove === false &&
    crumb.dynamic.weightAfterRemove === crumb.dynamic.weightBefore,
  JSON.stringify({
    currentFlags: crumb.dynamic.currentFlags,
    before: crumb.dynamic.weightBefore,
    afterSet: crumb.dynamic.weightAfterSet,
    afterRemove: crumb.dynamic.weightAfterRemove,
  }),
);


check(
  '真实点击链接：路由跟着走（组件不拦原生 <a>）',
  crumb.hashBefore !== crumb.hashAfter && crumb.hashAfter.includes('packages/button/page.html'),
  `${crumb.hashBefore} → ${crumb.hashAfter}`,
);

check(
  '客户端切页后顶栏与左栏一起更新（route store 是同一份实例）',
  crumb.afterNav.top === '组件' &&
    /* 左栏是「中文（英文）」对照（按钮（Button）），顶栏仍用单语言 label ——
       这里是两套显示名的交界处，所以左栏按 includes 判 */
    crumb.afterNav.nav?.includes('Button'),
  JSON.stringify(crumb.afterNav),
);
}
