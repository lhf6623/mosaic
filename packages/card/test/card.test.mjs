/**
 * mc-card · 内容承载面：两种外观、内边距四档映射、头尾常驻与分隔线（suffix / divider）、
 * **组件自己不造交互**（没有盖层 / 铺满 / hover / 光标规则，卡内元素也不被挡）、
 * 定制（令牌 + ::part）、P31 动态创建
 */

export default async function run({ page, visit, check }) {
  /* ------------------------------------------------------------------ *
   * 卡片是面不是行为：盯结构、盯不变量，也盯「它没做多余的事」
   * ------------------------------------------------------------------ */

  const card = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?card=1#/packages/card/page.html');
    await page
      .waitForFunction(
        () => {
          const cards = window.__deepAll('mc-card');
          return cards.length >= 10 && cards.every((c) => c.shadowRoot);
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    /** 令牌解析：组件内部的颜色都是 rgb(var(--mc-…))，期望值要按当前主题算 */
    const tokens = await page.evaluate(() => {
      const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const rgb = (name) => `rgb(${read(name).split(/\s+/).join(', ')})`;
      return { primary: rgb('--mc-color-primary'), borderStrong: rgb('--mc-color-border-strong') };
    });

    /** 全局：实例数、升级、四个 part，以及**组件自己没造任何交互元素** */
    const overview = await page.evaluate(() => {
      const cards = window.__deepAll('mc-card');
      const read = (el) => {
        const root = el.shadowRoot;
        return {
          parts: ['base', 'header', 'body', 'footer'].every(
            (p) => !!root.querySelector(`[part="${p}"]`),
          ),
          /** 组件内部不该有控件 / 焦点目标 —— 可点的只能是使用者塞进来的东西 */
          innerInteractive: [
            ...root.querySelectorAll('a, button, input, select, textarea, [tabindex]'),
          ].length,
          /** 也不该给自己镜像交互状态、更不该把自己变成可聚焦的 */
          mirrorAttrs: ['interactive', 'data-cover', 'data-stretch'].filter((a) =>
            el.hasAttribute(a),
          ),
          role: el.getAttribute('role'),
          tabIndex: el.tabIndex,
        };
      };
      const rows = cards.map(read);
      return {
        total: cards.length,
        upgraded: cards.every((c) => !!c.shadowRoot),
        allParts: rows.every((r) => r.parts),
        innerInteractive: rows.reduce((n, r) => n + r.innerInteractive, 0),
        mirrorAttrs: rows.flatMap((r) => r.mirrorAttrs),
        roles: rows.map((r) => r.role).filter(Boolean),
        tabIndexes: [...new Set(rows.map((r) => r.tabIndex))],
      };
    });

    /** 基本用法：头尾插槽有内容 → 宿主 data-has-*，分隔线通长 */
    const basic = await page.evaluate(() => {
      const box = window.__deepAll('demo-card-basic')[0].shadowRoot;
      const el = window.__deepAll('mc-card', box)[0];
      const root = el.shadowRoot;
      const header = root.querySelector('.mc-header');
      const body = root.querySelector('.mc-body');
      const footer = root.querySelector('.mc-footer');
      const base = root.querySelector('.mc-base');
      const cs = (n) => getComputedStyle(n);
      const rect = (n) => n.getBoundingClientRect();
      /** 槽里的内容在 light DOM，slot.textContent 是空的 —— 要从 assignedNodes 读 */
      const slotText = (n) =>
        [...n.assignedNodes()]
          .map((node) => node.textContent ?? '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
      return {
        hasHeader: el.hasAttribute('data-has-header'),
        hasFooter: el.hasAttribute('data-has-footer'),
        headerText: slotText(header.querySelector('slot')),
        bodyText: slotText(body.querySelector('slot')).slice(0, 6),
        footerTag: footer.querySelector('slot').assignedElements()[0]?.tagName ?? null,
        headerDisplay: cs(header).display,
        footerDisplay: cs(footer).display,
        headerBorder: cs(header).borderBottomWidth,
        footerBorder: cs(footer).borderTopWidth,
        bodyBorder: cs(body).borderTopWidth,
        cardW: Math.round(rect(el).width),
        headerW: Math.round(rect(header).width),
        basePad: cs(base).paddingTop,
        padToken: cs(el).getPropertyValue('--mc-card-pad').trim(),
      };
    });

    /** 内边距四档：none / sm / md / lg = 0 / 12 / 16 / 24，作用在 part=base 上 */
    const padding = await page.evaluate(() => {
      const box = window.__deepAll('demo-card-padding')[0].shadowRoot;
      const read = (el) => {
        const base = el.shadowRoot.querySelector('.mc-base');
        /** 正文里那个底色盒子：part 里只有 .mc-body 装着用户内容（头尾此时是 display:none） */
        const inner = el.shadowRoot.querySelector('.mc-body slot').assignedElements()[0];
        const cs = getComputedStyle(base);
        return {
          attr: el.getAttribute('padding'),
          top: cs.paddingTop,
          left: cs.paddingLeft,
          /** 内容相对卡片左下角的实际缩进 = 边框 + 内边距 */
          offset: Math.round(inner.getBoundingClientRect().left - el.getBoundingClientRect().left),
        };
      };
      return window.__deepAll('mc-card', box).map(read);
    });

    /** 两种外观：surface 有底色，outline 透明；两者都有 1px 描边 */
    const variants = await page.evaluate(() => {
      const box = window.__deepAll('demo-card-variants')[0].shadowRoot;
      const read = (el) => {
        const cs = getComputedStyle(el);
        return {
          attr: el.getAttribute('variant'),
          bg: cs.backgroundColor,
          border: cs.borderTopWidth,
          radius: cs.borderTopLeftRadius,
        };
      };
      const [surface, outline] = window.__deepAll('mc-card', box);
      return { surface: read(surface), outline: read(outline) };
    });

    /** 头部：suffix 贴右、divider 开关（改颜色不改宽度） */
    const sections = await page.evaluate(() => {
      const box = window.__deepAll('demo-card-sections')[0].shadowRoot;
      const read = (el) => {
        const header = el.shadowRoot.querySelector('.mc-header');
        const slot = el.shadowRoot.querySelector('slot[name="suffix"]');
        const suffix = slot.assignedElements()[0];
        const cs = getComputedStyle(header);
        const h = header.getBoundingClientRect();
        const s = suffix.getBoundingClientRect();
        return {
          divider: el.getAttribute('divider'),
          hasHeader: el.hasAttribute('data-has-header'),
          hasFooter: el.hasAttribute('data-has-footer'),
          headerDisplay: cs.display,
          borderWidth: cs.borderBottomWidth,
          borderColor: cs.borderBottomColor,
          footerBorder: getComputedStyle(el.shadowRoot.querySelector('.mc-footer')).borderTopColor,
          suffixText: suffix.textContent.trim(),
          /** suffix 右边缘贴着头部**内容**右边缘（头部的内边距不算） */
          suffixRightGap: Math.round(h.right - parseFloat(cs.paddingRight) - s.right),
          headerHeight: Math.round(h.height),
        };
      };
      return window.__deepAll('mc-card', box).map(read);
    });

    /** 外部样式：宿主 style 上的 L3 令牌（圆角、边框色；四个角的圆角也跟着走） */
    const customize = await page.evaluate(() => {
      const box = window.__deepAll('demo-card-customize')[0].shadowRoot;
      const el = window.__deepAll('mc-card', box)[0];
      const cs = (n) => getComputedStyle(n);
      const corners = (n) => [
        cs(n).borderTopLeftRadius,
        cs(n).borderTopRightRadius,
        cs(n).borderBottomRightRadius,
        cs(n).borderBottomLeftRadius,
      ];
      return {
        radius: cs(el).borderTopLeftRadius,
        border: cs(el).borderTopColor,
        headerCorners: corners(el.shadowRoot.querySelector('.mc-header')),
        footerCorners: corners(el.shadowRoot.querySelector('.mc-footer')),
        baseCorners: corners(el.shadowRoot.querySelector('.mc-base')),
      };
    });

    /** 内部样式：::part(header) / ::part(footer) —— 头尾整条的底色、字色、字重、分隔线色 */
    const part = await page.evaluate(() => {
      const box = window.__deepAll('demo-card-part')[0].shadowRoot;
      const el = window.__deepAll('mc-card', box)[0];
      const header = el.shadowRoot.querySelector('.mc-header');
      const footer = el.shadowRoot.querySelector('.mc-footer');
      const cs = (n) => getComputedStyle(n);
      return {
        headerBg: cs(header).backgroundColor,
        headerColor: cs(header).color,
        headerWeight: cs(header).fontWeight,
        headerBorder: cs(header).borderBottomColor,
        footerBg: cs(footer).backgroundColor,
      };
    });

    /** 卡片不参与交互：悬停既不动盒子也不变色，卡边没有透明交互层，卡内元素也没被挡住 */
    const inert = await (async () => {
      const readCard = (pick) =>
        page.evaluate((src) => {
          const el = eval(src);
          const r = el.getBoundingClientRect();
          return {
            hover: el.matches(':hover'),
            transform: getComputedStyle(el).transform,
            border: getComputedStyle(el).borderTopColor,
            cursor: getComputedStyle(el).cursor,
            top: Math.round(r.top * 10) / 10,
            height: Math.round(r.height * 10) / 10,
          };
        }, pick);
      const first = 'window.__deepAll("demo-card-basic")[0].shadowRoot.querySelector("mc-card")';
      /* 先把卡片滚进视口再把鼠标挪开：idle / hovered 两次读数必须在同一滚动位置，
         否则比 top 比的是滚动距离 */
      await page.locator('demo-card-basic mc-card').first().scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      const idle = await readCard(first);
      await page.locator('demo-card-basic mc-card').first().hover();
      await page.waitForTimeout(250);
      const hovered = await readCard(first);

      /** 卡内那个 mc-button 的最深命中：必须是它自己的内部按钮 —— 没有被谁盖住 */
      const innerHit = await page.evaluate(() => {
        const box = window.__deepAll('demo-card-basic')[0].shadowRoot;
        const el = window.__deepAll('mc-card', box)[0];
        const button = el.querySelector('mc-button');
        const r = button.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        let hit = document.elementFromPoint(x, y);
        for (let i = 0; i < 8 && hit?.shadowRoot; i++) {
          const inner = hit.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === hit) break;
          hit = inner;
        }
        return { tag: hit?.tagName ?? null, disabled: hit?.disabled ?? null };
      });

      /** 卡片边缘也不该藏着"看不见的一层"（曾经的盖层就在那儿） */
      const edgeHit = await page.evaluate(() => {
        const box = window.__deepAll('demo-card-basic')[0].shadowRoot;
        const el = window.__deepAll('mc-card', box)[0];
        const r = el.getBoundingClientRect();
        const hit = box.elementFromPoint(r.left + r.width * 0.5, r.bottom - 0.5);
        return { tag: hit?.tagName ?? null, cls: hit?.className ?? null };
      });

      return { idle, hovered, innerHit, edgeHit };
    })();

    /** 运行时：头尾内容增删要跟着走（宿主上的 data-has-*） */
    const dynamic = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const card = document.createElement('mc-card');
      const atCreate = card.getAttributeNames();
      card.innerHTML = '<span slot="header">标题</span>正文';
      document.body.append(card);
      await wait(300);

      const out = {
        atCreate,
        shadow: !!card.shadowRoot,
        headerFlag: card.hasAttribute('data-has-header'),
        footerFlag: card.hasAttribute('data-has-footer'),
      };

      card.querySelector('span[slot="header"]').remove();
      await wait(200);
      out.afterRemoveHeader = card.hasAttribute('data-has-header');

      /** suffix 也算头部那一行 */
      card.insertAdjacentHTML('beforeend', '<span slot="suffix">已实现</span>');
      await wait(200);
      out.afterSuffix = card.hasAttribute('data-has-header');

      card.insertAdjacentHTML('beforeend', '<span slot="footer">页脚</span>');
      await wait(200);
      out.afterFooter = card.hasAttribute('data-has-footer');
      card.remove();

      /** 没有头尾元素 → 两个标记都不写；只有注释 → 同样不算内容（元素才算） */
      const blank = document.createElement('mc-card');
      blank.innerHTML = '<!-- 只有注释 -->正文';
      document.body.append(blank);
      await wait(300);
      out.blankFlags = [
        blank.hasAttribute('data-has-header'),
        blank.hasAttribute('data-has-footer'),
      ];
      blank.remove();

      /** 有头尾元素就算内容，哪怕元素里只有空白（元素即内容，可能带边框/底色） */
      const spaced = document.createElement('mc-card');
      spaced.innerHTML = '<span slot="footer">   </span>';
      document.body.append(spaced);
      await wait(300);
      out.spacedFooter = spaced.hasAttribute('data-has-footer');
      spaced.remove();

      return out;
    });

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { overview, basic, padding, variants, sections, customize, part, inert, dynamic, tokens, failed };
  })();

  check(
    'mc-card 注册并渲染出实例，四个 part 齐全',
    card.overview.upgraded && card.overview.total >= 10 && card.overview.allParts,
    `${card.overview.total} 张卡片 · 全部升级=${card.overview.upgraded}`,
  );

  check(
    '卡片自己不造交互元素：内部没有控件 / 焦点目标，宿主不带交互属性、不可聚焦、没有 role',
    card.overview.innerInteractive === 0 &&
      card.overview.mirrorAttrs.length === 0 &&
      card.overview.roles.length === 0 &&
      JSON.stringify(card.overview.tabIndexes) === JSON.stringify([-1]),
    JSON.stringify({
      内部控件: card.overview.innerInteractive,
      镜像属性: card.overview.mirrorAttrs,
      role: card.overview.roles,
      tabIndex: card.overview.tabIndexes,
    }),
  );

  check(
    '头尾插槽有内容 → 宿主 data-has-header / data-has-footer，两条分隔线通长',
    card.basic.hasHeader &&
      card.basic.hasFooter &&
      card.basic.headerText === '项目设置' &&
      card.basic.headerDisplay === 'flex' &&
      card.basic.footerDisplay === 'block' &&
      card.basic.headerBorder === '1px' &&
      card.basic.footerBorder === '1px' &&
      card.basic.bodyBorder === '0px' &&
      Math.abs(card.basic.headerW - card.basic.cardW) <= 2,
    JSON.stringify(card.basic),
  );

  check(
    '头尾是通长的（负外边距贴到卡片边缘），正文与头尾之间只隔一个内边距',
    card.basic.basePad === '16px' && card.basic.padToken === '1rem',
    `base padding=${card.basic.basePad} · --mc-card-pad=${card.basic.padToken}`,
  );

  check(
    'padding 四档 → 0 / 12 / 16 / 24px，作用在 part=base 上',
    JSON.stringify(card.padding.map((p) => p.top)) ===
      JSON.stringify(['0px', '12px', '16px', '24px']) &&
      JSON.stringify(card.padding.map((p) => p.offset)) === JSON.stringify([1, 13, 17, 25]),
    JSON.stringify(card.padding),
  );

  check(
    'variant：surface 有底色、outline 透明，两者都是 1px 描边 + lg 圆角',
    card.variants.surface.attr === 'surface' &&
      card.variants.surface.bg !== 'rgba(0, 0, 0, 0)' &&
      card.variants.outline.attr === 'outline' &&
      card.variants.outline.bg === 'rgba(0, 0, 0, 0)' &&
      card.variants.surface.border === '1px' &&
      card.variants.outline.border === '1px' &&
      card.variants.surface.radius === card.variants.outline.radius,
    JSON.stringify(card.variants),
  );

  check(
    '头部一行：suffix 贴右边，divider="none" 只把线改成透明、宽度不变',
    card.sections[0].hasHeader &&
      card.sections[0].hasFooter &&
      card.sections[0].headerDisplay === 'flex' &&
      card.sections[0].borderWidth === '1px' &&
      card.sections[0].borderColor !== 'rgba(0, 0, 0, 0)' &&
      card.sections[0].suffixText === '已实现' &&
      card.sections[0].suffixRightGap === 0 &&
      card.sections[1].divider === 'none' &&
      card.sections[1].hasHeader &&
      card.sections[1].borderWidth === '1px' &&
      card.sections[1].borderColor === 'rgba(0, 0, 0, 0)' &&
      card.sections[1].footerBorder === 'rgba(0, 0, 0, 0)' &&
      card.sections[1].headerHeight === card.sections[0].headerHeight,
    JSON.stringify(card.sections),
  );

  check(
    '外部样式（L3 令牌）：宿主 style 的圆角与边框色生效',
    card.customize.radius === '16px' && card.customize.border === card.tokens.borderStrong,
    JSON.stringify(card.customize),
  );

  check(
    '内部样式（::part）：整条底色、字色、字重、分隔线色都生效',
    card.part.headerBg !== 'rgba(0, 0, 0, 0)' &&
      card.part.headerColor === card.tokens.primary &&
      Number(card.part.headerWeight) >= 600 &&
      card.part.headerBorder === card.tokens.primary &&
      card.part.footerBg !== 'rgba(0, 0, 0, 0)',
    JSON.stringify(card.part),
  );

  check(
    '头尾整条的圆角跟着宿主：外侧两角与卡片一致，朝向正文的两角是直角',
    card.customize.baseCorners.every((r) => r === card.customize.radius) &&
      JSON.stringify(card.customize.headerCorners) === JSON.stringify(['16px', '16px', '0px', '0px']) &&
      JSON.stringify(card.customize.footerCorners) === JSON.stringify(['0px', '0px', '16px', '16px']),
    JSON.stringify({
      卡片: card.customize.radius,
      header: card.customize.headerCorners,
      footer: card.customize.footerCorners,
    }),
  );

  check(
    '卡片不参与交互：悬停不动盒子、不变色、光标不变，卡边也没有藏一层透明交互层',
    card.inert.idle.hover === false &&
      card.inert.hovered.hover === true &&
      card.inert.hovered.transform === 'none' &&
      card.inert.hovered.top === card.inert.idle.top &&
      card.inert.hovered.height === card.inert.idle.height &&
      card.inert.hovered.border === card.inert.idle.border &&
      card.inert.hovered.cursor === 'auto' &&
      card.inert.edgeHit.tag !== 'BUTTON',
    JSON.stringify(card.inert),
  );

  check(
    '卡内元素不被挡：页脚那个 mc-button 的最深命中是它自己的原生按钮',
    card.inert.innerHit.tag === 'BUTTON' && card.inert.innerHit.disabled === false,
    JSON.stringify(card.inert.innerHit),
  );

  check(
    '运行时：头尾内容增删、suffix 也算有头，都跟着走（P10 的宿主属性）',
    card.dynamic.shadow &&
      JSON.stringify(card.dynamic.atCreate) === JSON.stringify([]) &&
      card.dynamic.headerFlag &&
      card.dynamic.footerFlag === false &&
      card.dynamic.afterRemoveHeader === false &&
      card.dynamic.afterSuffix === true &&
      card.dynamic.afterFooter === true &&
      JSON.stringify(card.dynamic.blankFlags) === JSON.stringify([false, false]) &&
      card.dynamic.spacedFooter === true,
    JSON.stringify(card.dynamic),
  );

  check(
    'mc-card 文档页没有 404 / 运行时报错',
    card.failed.length === 0,
    card.failed.join(' | ') || '无',
  );
}
