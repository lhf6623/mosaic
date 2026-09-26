/**
 * mc-alert · 页内提示条：三个维度正交（color / variant + icon 与 closable 两个状态布尔）、
 * 6 色 × 3 外观的色槽、heading 属性与 title 插槽的优先级与空内容折叠、icon 内置图形与 icon 插槽、
 * closable 的 ×（32×32 命中区、负外边距不撑高、close 冒泡 + composed、组件不删 DOM）、
 * 键盘关闭、运行时 property / 属性驱动与 P31 动态创建
 */

export default async function run({ page, visit, check }) {
  /** rgb(r, g, b) → rgba(r, g, b, a)：state layer 就是「当前配色 + 一个 alpha」 */
  const withAlpha = (rgb, alpha) => `rgba(${rgb.slice(4, -1)}, ${alpha})`;

  const alert = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?alert=1#/packages/alert/page.html');
    await page
      .waitForFunction(
        () => {
          const alerts = window.__deepAll('mc-alert');
          return alerts.length >= 25 && alerts.every((a) => !!a.shadowRoot);
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    /** 令牌解析：组件内部的颜色都是 rgb(var(--mc-…))，期望值要按当前主题算 */
    const tokens = await page.evaluate(() => {
      const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const rgb = (name) => `rgb(${read(name).split(/\s+/).join(', ')})`;
      return {
        primary: rgb('--mc-color-primary'),
        primarySubtle: rgb('--mc-color-primary-subtle'),
        primaryFg: rgb('--mc-color-primary-fg'),
        info: rgb('--mc-color-info'),
        infoSubtle: rgb('--mc-color-info-subtle'),
        infoFg: rgb('--mc-color-info-fg'),
        success: rgb('--mc-color-success'),
        successSubtle: rgb('--mc-color-success-subtle'),
        warning: rgb('--mc-color-warning'),
        warningSubtle: rgb('--mc-color-warning-subtle'),
        danger: rgb('--mc-color-danger'),
        dangerSubtle: rgb('--mc-color-danger-subtle'),
        dangerFg: rgb('--mc-color-danger-fg'),
        neutral: rgb('--mc-color-neutral'),
        neutralFg: rgb('--mc-color-neutral-fg'),
        fg: rgb('--mc-color-fg'),
        fgMuted: rgb('--mc-color-fg-muted'),
        surfaceSunken: rgb('--mc-color-surface-sunken'),
        ring: rgb('--mc-color-ring'),
      };
    });

    /** 全局：实例数、升级、每实例的原生控件（只该有 × 那一个按钮） */
    const overview = await page.evaluate(() => {
      const alerts = window.__deepAll('mc-alert');
      const rows = alerts.map((el) => {
        const root = el.shadowRoot;
        return {
          upgraded: !!root,
          buttons: [...root.querySelectorAll('button')].map((b) => b.className),
          innerLinks: root.querySelectorAll('a, input, select, textarea').length,
          glyphs: root.querySelectorAll('.mc-glyph').length,
          glyphsHidden: root.querySelector('.mc-glyphs').getAttribute('aria-hidden'),
        };
      });
      return {
        total: alerts.length,
        upgraded: rows.every((r) => r.upgraded),
        buttonSets: [...new Set(rows.map((r) => r.buttons.join('+')).filter(Boolean))],
        innerLinks: rows.reduce((n, r) => n + r.innerLinks, 0),
        glyphSets: [...new Set(rows.map((r) => r.glyphs))],
        glyphsHidden: [...new Set(rows.map((r) => r.glyphsHidden))],
      };
    });

    /** 语义色（demo-alert-colors，六条都是默认的 subtle）：底 = 浅底槽，字/图标 = 强调色 */
    const colors = await page.evaluate(() => {
      const box = window.__deepAll('demo-alert-colors')[0].shadowRoot;
      return window.__deepAll('mc-alert', box).map((el) => {
        const cs = getComputedStyle(el);
        const icon = el.shadowRoot.querySelector('.mc-icon');
        return {
          color: el.getAttribute('color') ?? 'primary',
          variant: el.getAttribute('variant') ?? 'subtle',
          bg: cs.backgroundColor,
          fg: cs.color,
          borderWidth: cs.borderTopWidth,
          iconColor: getComputedStyle(icon).color,
        };
      });
    });

    /** 外观（demo-alert-variants，同色三档）：只换色槽贴到哪儿，1px 边框恒定 */
    const variants = await page.evaluate(() => {
      const box = window.__deepAll('demo-alert-variants')[0].shadowRoot;
      const read = (el) => {
        const cs = getComputedStyle(el);
        return {
          variant: el.getAttribute('variant') ?? 'subtle',
          bg: cs.backgroundColor,
          fg: cs.color,
          borderWidth: cs.borderTopWidth,
          borderColor: cs.borderTopColor,
          bodyColor: getComputedStyle(el.shadowRoot.querySelector('.mc-body')).color,
        };
      };
      const alerts = window.__deepAll('mc-alert', box);
      return {
        subtle: read(alerts[0]),
        solid: read(alerts[1]),
        outline: read(alerts[2]),
      };
    });

    /** 标题（demo-alert-heading）：heading 属性、空标题折叠、title 插槽、插槽压过属性 */
    const titles = await page.evaluate(() => {
      const box = window.__deepAll('demo-alert-heading')[0].shadowRoot;
      const read = (el) => {
        const root = el.shadowRoot;
        const slot = root.querySelector('slot[name="title"]');
        const slotted = el.querySelector('[slot="title"]');
        return {
          heading: el.getAttribute('heading'),
          hasTitle: el.hasAttribute('data-has-title'),
          titleDisplay: getComputedStyle(root.querySelector('.mc-title')).display,
          /** ⚠️ 兜底内容始终留在 shadow 里（分到节点时只是不渲染），所以这个值不能当「渲染了什么」用 */
          titleText: (root.querySelector('.mc-title').textContent ?? '').replace(/\s+/g, ' ').trim(),
          assigned: slot.assignedNodes().length,
          slottedText: slotted?.textContent?.trim() ?? null,
          slottedVisible: slotted ? slotted.getBoundingClientRect().width > 0 : false,
          height: Math.round(el.getBoundingClientRect().height),
        };
      };
      const alerts = window.__deepAll('mc-alert', box);
      return {
        heading: read(alerts[0]),
        plain: read(alerts[1]),
        slot: read(alerts[2]),
        both: read(alerts[3]),
      };
    });

    /** 图标（demo-alert-icon）：icon 打开才有，图形按 color 切换；内置图形带 aria-hidden */
    const icons = await page.evaluate(() => {
      const box = window.__deepAll('demo-alert-icon')[0].shadowRoot;
      return window.__deepAll('mc-alert', box).map((el) => {
        const root = el.shadowRoot;
        const icon = root.querySelector('.mc-icon');
        const iconDisplay = getComputedStyle(icon).display;
        /* 整块藏起来时，内部图形的 computed display 仍是 block —— 判定要连祖先一起看 */
        const shown =
          iconDisplay === 'none'
            ? []
            : [...root.querySelectorAll('.mc-glyph')].filter(
                (g) => getComputedStyle(g).display !== 'none',
              );
        return {
          color: el.getAttribute('color') ?? 'primary',
          icon: el.hasAttribute('icon'),
          iconDisplay,
          iconBox: Math.round(icon.getBoundingClientRect().width),
          visible: shown.map((g) => g.getAttribute('class').replace('mc-glyph ', '')),
        };
      });
    });

    /** 自定义图标（demo-alert-icon-custom）：icon 插槽有内容，内置图形让位 */
    const iconSlots = await page.evaluate(() => {
      const box = window.__deepAll('demo-alert-icon-custom')[0].shadowRoot;
      return window.__deepAll('mc-alert', box).map((el) => {
        const root = el.shadowRoot;
        const slotted = el.querySelector('[slot="icon"]');
        return {
          hasIconData: el.hasAttribute('data-has-icon'),
          glyphsDisplay: getComputedStyle(root.querySelector('.mc-glyphs')).display,
          iconDisplay: getComputedStyle(root.querySelector('.mc-icon')).display,
          slottedText: slotted?.textContent?.trim() ?? null,
          slottedVisible: slotted ? slotted.getBoundingClientRect().width > 0 : false,
        };
      });
    });

    /** closable（demo-alert-closable）：× 的命中区 / 无障碍名 / 负外边距；不可关的实例里 × 是隐藏的 */
    const closable = await page.evaluate(() => {
      const read = (el) => {
        const btn = el.shadowRoot.querySelector('.mc-close');
        const cs = getComputedStyle(btn);
        const r = btn.getBoundingClientRect();
        return {
          display: cs.display,
          tag: btn.tagName,
          type: btn.type,
          ariaLabel: btn.getAttribute('aria-label'),
          part: btn.getAttribute('part'),
          marginTop: cs.marginTop,
          width: Math.round(r.width),
          height: Math.round(r.height),
          alertHeight: Math.round(el.getBoundingClientRect().height),
          closable: el.hasAttribute('closable'),
        };
      };
      const box = window.__deepAll('demo-alert-closable')[0].shadowRoot;
      const headingBox = window.__deepAll('demo-alert-heading')[0].shadowRoot;
      const colorBox = window.__deepAll('demo-alert-colors')[0].shadowRoot;
      const closableAlerts = window.__deepAll('mc-alert', box);
      return {
        closable: closableAlerts.map(read),
        /** 单行、不可关、没有标题的那条（demo-alert-heading 的第二条）：对照「× 不会把提示条撑高」 */
        singleLinePlain: Math.round(
          window.__deepAll('mc-alert', headingBox)[1].getBoundingClientRect().height,
        ),
        closeHidden: read(window.__deepAll('mc-alert', colorBox)[0]),
      };
    });

    /** 点 ×：冒泡 + composed 的 close、不删 DOM；删掉的是 demo 自己那半 */
    const closeEvent = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-alert-closable')[0].shadowRoot;
      const [first] = window.__deepAll('mc-alert', box);
      const seen = [];
      first.addEventListener('close', (e) =>
        seen.push({ bubbles: e.bubbles, composed: e.composed, isSelf: e.target === first }),
      );
      const before = window.__deepAll('mc-alert', box).length;
      first.shadowRoot.querySelector('.mc-close').click();
      await wait(300);
      return {
        seen,
        before,
        after: window.__deepAll('mc-alert', box).length,
        removed: !first.isConnected,
        lastClosed: box.querySelector('strong')?.textContent?.trim() ?? null,
      };
    });

    /** 键盘：× 是原生按钮，聚焦后 Enter 就能关；焦点环用 --mc-color-ring */
    const keyboard = await (async () => {
      await page.evaluate(async () => {
        const el = document.createElement('mc-alert');
        el.setAttribute('heading', '键盘');
        el.setAttribute('closable', '');
        el.textContent = '回车关闭';
        el.id = 'kb-alert';
        window.__kbSeen = [];
        el.addEventListener('close', (e) =>
          window.__kbSeen.push({ bubbles: e.bubbles, composed: e.composed }),
        );
        document.body.append(el);
        await new Promise((r) => setTimeout(r, 300));
        el.shadowRoot.querySelector('.mc-close').focus();
      });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      return page.evaluate(() => {
        const el = document.querySelector('#kb-alert');
        const btn = el.shadowRoot.querySelector('.mc-close');
        const cs = getComputedStyle(btn);
        return {
          focused: el.shadowRoot.activeElement === btn,
          focusVisible: btn.matches(':focus-visible'),
          outlineWidth: cs.outlineWidth,
          outlineColor: cs.outlineColor,
          seen: window.__kbSeen,
        };
      });
    })();

    /** 运行时：P31 动态创建、属性驱动显隐、heading 的增删、宿主令牌覆盖 */
    const runtime = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const el = document.createElement('mc-alert');
      const atCreate = el.getAttributeNames();
      el.setAttribute('heading', '运行时标题');
      el.setAttribute('icon', '');
      el.setAttribute('closable', '');
      el.textContent = '运行时正文';
      document.body.append(el);
      await wait(300);

      const root = el.shadowRoot;
      const read = () => ({
        hasTitle: el.hasAttribute('data-has-title'),
        hasBody: el.hasAttribute('data-has-body'),
        titleDisplay: getComputedStyle(root.querySelector('.mc-title')).display,
        bodyDisplay: getComputedStyle(root.querySelector('.mc-body')).display,
        iconDisplay: getComputedStyle(root.querySelector('.mc-icon')).display,
        closeDisplay: getComputedStyle(root.querySelector('.mc-close')).display,
      });

      const out = {
        atCreate,
        shadow: !!root,
        withHeading: read(),
        glyph: [...root.querySelectorAll('.mc-glyph')]
          .filter((g) => getComputedStyle(g).display !== 'none')
          .map((g) => g.getAttribute('class').replace('mc-glyph ', '')),
      };

      /* 去掉 heading：标题块要折掉，不留空行 */
      el.removeAttribute('heading');
      await wait(200);
      out.afterRemoveHeading = read();

      /* 再给回去：watch 要把它接回来 */
      el.setAttribute('heading', '回来了');
      await wait(200);
      out.afterSetHeading = read();

      /* 空正文：body 块也要折掉 */
      el.textContent = '';
      await wait(200);
      out.afterEmptyBody = read();

      /* icon 是属性开关 */
      el.removeAttribute('icon');
      await wait(200);
      out.iconAfterRemove = getComputedStyle(root.querySelector('.mc-icon')).display;

      /* 宿主 style 覆盖 L3 令牌（外部样式的两级 API） */
      el.style.setProperty('--mc-alert-pad-x', '32px');
      el.style.setProperty('--mc-alert-radius', '16px');
      await wait(150);
      const cs = getComputedStyle(el);
      out.customize = { padX: cs.paddingLeft, radius: cs.borderTopLeftRadius };

      /* 清空所有内容与状态：整条只剩内边距，三个 data-has-* 都不该在 */
      el.removeAttribute('closable');
      el.removeAttribute('heading');
      await wait(200);
      out.empty = {
        attrs: el.getAttributeNames().filter((n) => n.startsWith('data-has-')),
        height: Math.round(el.getBoundingClientRect().height),
      };

      el.remove();
      return out;
    });

    /** part 定制（demo-alert-part）：只有开了口的内部节点改得动 */
    const parts = await page.evaluate(() => {
      const box = window.__deepAll('demo-alert-part')[0].shadowRoot;
      const [custom, plain] = window.__deepAll('mc-alert', box);
      const read = (el) => {
        const root = el.shadowRoot;
        return {
          gap: getComputedStyle(root.querySelector('.mc-base')).columnGap,
          titleSize: getComputedStyle(root.querySelector('.mc-title')).fontSize,
          bodyColor: getComputedStyle(root.querySelector('.mc-body')).color,
          closeColor: getComputedStyle(root.querySelector('.mc-close')).color,
        };
      };
      return { custom: read(custom), plain: read(plain) };
    });

    /** × 的 state layer：hover 叠当前配色的 8%，实心那条叠 on-fill（设计规范第五节的统一状态）。
        ⚠️ 这条要跑在 closeEvent 之后 —— demo 的第一条已经被它自己 remove 了，剩下 0=subtle、1=solid。 */
    const hover = await (async () => {
      const pointOf = (index) =>
        page.evaluate(async (i) => {
          const box = window.__deepAll('demo-alert-closable')[0].shadowRoot;
          const el = window.__deepAll('mc-alert', box)[i];
          el.scrollIntoView({ block: 'center' });
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const r = el.shadowRoot.querySelector('.mc-close').getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, index);
      const readClose = (index) =>
        page.evaluate((i) => {
          const box = window.__deepAll('demo-alert-closable')[0].shadowRoot;
          const btn = window.__deepAll('mc-alert', box)[i].shadowRoot.querySelector('.mc-close');
          return {
            hovered: btn.matches(':hover'),
            bg: getComputedStyle(btn).backgroundColor,
          };
        }, index);

      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      const out = { subtle: { before: await readClose(0) }, solid: { before: await readClose(1) } };
      /* 期望的叠加色：层色 + 8%，跟组件里的 rgb(var(--mc-alert-layer-color) / var(--mc-alert-layer)) 对齐 */
      const expected = {
        subtle: withAlpha(tokens.fg, 0.08),
        solid: withAlpha(tokens.dangerFg, 0.08),
      };

      for (const [name, index] of [
        ['subtle', 0],
        ['solid', 1],
      ]) {
        const point = await pointOf(index);
        await page.mouse.move(point.x, point.y);
        /* 等到叠加色**真的**到位再读：这是过渡值，固定 sleep 在并行满载时会读到中间色（Tag 套件
           实测读到过 96% 的中间色）。等不到就放行，让断言拿真实值去报错。 */
        await page
          .waitForFunction(
            ({ i, want }) => {
              const box = window.__deepAll('demo-alert-closable')[0].shadowRoot;
              const btn = window.__deepAll('mc-alert', box)[i].shadowRoot.querySelector('.mc-close');
              return btn.matches(':hover') && getComputedStyle(btn).backgroundColor === want;
            },
            { i: index, want: expected[name] },
            { timeout: 3000 },
          )
          .catch(() => {});
        out[name].after = await readClose(index);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
      }
      return out;
    })();

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return {
      tokens,
      overview,
      colors,
      variants,
      titles,
      icons,
      iconSlots,
      closable,
      closeEvent,
      hover,
      keyboard,
      runtime,
      parts,
      failed,
    };
  })();

  check(
    'mc-alert 注册并渲染出实例，每个实例只有一个原生按钮（×），内部没有别的控件，4 个内置图形都在 DOM 里且容器 aria-hidden',
    alert.overview.upgraded &&
      alert.overview.total >= 25 &&
      alert.overview.innerLinks === 0 &&
      JSON.stringify(alert.overview.buttonSets) === JSON.stringify(['mc-close']) &&
      JSON.stringify(alert.overview.glyphSets) === JSON.stringify([4]) &&
      JSON.stringify(alert.overview.glyphsHidden) === JSON.stringify(['true']),
    `${alert.overview.total} 条 · 按钮=${JSON.stringify(alert.overview.buttonSets)} · 图形=${JSON.stringify(alert.overview.glyphSets)}`,
  );

  check(
    'color 六色（subtle）：底 = 该色浅底槽、文字与图标 = 强调色；neutral 用下沉面色 + fg-muted',
    alert.colors.length === 6 &&
      alert.colors[0].color === 'primary' &&
      alert.colors[0].bg === alert.tokens.primarySubtle &&
      alert.colors[0].fg === alert.tokens.primary &&
      alert.colors[1].bg === alert.tokens.infoSubtle &&
      alert.colors[2].bg === alert.tokens.successSubtle &&
      alert.colors[3].bg === alert.tokens.warningSubtle &&
      alert.colors[4].bg === alert.tokens.dangerSubtle &&
      alert.colors[5].color === 'neutral' &&
      alert.colors[5].bg === alert.tokens.surfaceSunken &&
      alert.colors[5].fg === alert.tokens.fgMuted &&
      alert.colors.every((c) => c.iconColor === c.fg) &&
      alert.colors.every((c) => c.borderWidth === '1px'),
    JSON.stringify(alert.colors),
  );

  check(
    'variant：subtle 浅底 / solid 实心（正文跟着 on-fill）/ outline 透明 + 描边，三档都是 1px 边框',
    alert.variants.subtle.bg === alert.tokens.primarySubtle &&
      alert.variants.subtle.fg === alert.tokens.primary &&
      alert.variants.solid.bg === alert.tokens.primary &&
      alert.variants.solid.fg === alert.tokens.primaryFg &&
      alert.variants.solid.bodyColor === alert.tokens.primaryFg &&
      alert.variants.outline.bg === 'rgba(0, 0, 0, 0)' &&
      alert.variants.outline.fg === alert.tokens.primary &&
      alert.variants.outline.borderColor === alert.tokens.primary &&
      [alert.variants.subtle, alert.variants.solid, alert.variants.outline].every(
        (v) => v.borderWidth === '1px',
      ),
    JSON.stringify(alert.variants),
  );

  check(
    '标题：heading 属性渲染成标题行；没有标题时标题块折掉、不占位（data-has-title 不出现）',
    alert.titles.heading.titleText === '属性给纯文本标题' &&
      alert.titles.heading.hasTitle === true &&
      alert.titles.heading.titleDisplay === 'block' &&
      alert.titles.heading.height === 66 &&
      alert.titles.plain.hasTitle === false &&
      alert.titles.plain.titleDisplay === 'none' &&
      alert.titles.plain.height === 46,
    JSON.stringify({ heading: alert.titles.heading, plain: alert.titles.plain }),
  );

  check(
    'title 插槽：插槽内容渲染成标题，插槽优先于 heading（属性只当兜底，不同时渲染两条）',
    alert.titles.slot.assigned === 1 &&
      alert.titles.slot.slottedText === '插槽标题' &&
      alert.titles.slot.slottedVisible === true &&
      alert.titles.both.heading === '这个属性标题不会出现' &&
      alert.titles.both.assigned === 1 &&
      alert.titles.both.slottedText === '插槽优先' &&
      alert.titles.both.slottedVisible === true &&
      alert.titles.both.height === 66,
    JSON.stringify({ slot: alert.titles.slot, both: alert.titles.both }),
  );

  check(
    'icon：不加属性就没有图标；各色切换内置图形（primary / info / neutral 共用信息圆），图标盒与标题行等高',
    alert.icons.length === 5 &&
      alert.icons.every((i) => i.iconDisplay === (i.icon ? 'flex' : 'none')) &&
      alert.icons[4].icon === false &&
      JSON.stringify(alert.icons.slice(0, 4).map((i) => i.visible[0])) ===
        JSON.stringify([
          'mc-glyph-info',
          'mc-glyph-success',
          'mc-glyph-warning',
          'mc-glyph-danger',
        ]) &&
      alert.icons.slice(0, 4).every((i) => i.visible.length === 1) &&
      alert.icons[4].visible.length === 0 &&
      alert.icons[0].iconBox > 0,
    JSON.stringify(alert.icons),
  );

  check(
    'icon 插槽有内容时内置图形让位（data-has-icon + .mc-glyphs 隐藏），插槽内容照常渲染',
    alert.iconSlots.every((s) => s.hasIconData && s.iconDisplay === 'flex') &&
      alert.iconSlots.every((s) => s.glyphsDisplay === 'none' && s.slottedVisible) &&
      JSON.stringify(alert.iconSlots.map((s) => s.slottedText)) === JSON.stringify(['⏳', '🎉']),
    JSON.stringify(alert.iconSlots),
  );

  check(
    'closable 的 ×：part="close" 的原生按钮、aria-label="关闭"、命中区 32×32，负外边距让它不把提示条撑高',
    alert.closable.closeHidden.closable === false &&
      alert.closable.closeHidden.display === 'none' &&
      alert.closable.closable.every((c) => c.closable && c.display === 'flex') &&
      alert.closable.closable.every(
        (c) => c.tag === 'BUTTON' && c.type === 'button' && c.ariaLabel === '关闭' && c.part === 'close',
      ) &&
      alert.closable.closable.every((c) => c.width === 32 && c.height === 32) &&
      alert.closable.closable.every((c) => c.marginTop === '-6px') &&
      alert.closable.closable[2].alertHeight === 46 &&
      alert.closable.singleLinePlain === 46,
    JSON.stringify(alert.closable),
  );

  check(
    '点 × 发冒泡 + composed 的 close 且组件自己不删 DOM；demo 里那条是 demo 自己 remove 的',
    alert.closeEvent.seen.length === 1 &&
      alert.closeEvent.seen[0].bubbles === true &&
      alert.closeEvent.seen[0].composed === true &&
      alert.closeEvent.seen[0].isSelf === true &&
      alert.closeEvent.before === alert.closeEvent.after + 1 &&
      alert.closeEvent.removed === true &&
      alert.closeEvent.lastClosed === '可关闭',
    JSON.stringify(alert.closeEvent),
  );

  check(
    '× 的 state layer：hover 叠当前配色的 8%（实心那条叠 on-fill），移开后回到透明',
    alert.hover.subtle.before.hovered === false &&
      alert.hover.subtle.before.bg === 'rgba(0, 0, 0, 0)' &&
      alert.hover.subtle.after.hovered === true &&
      alert.hover.subtle.after.bg === withAlpha(alert.tokens.fg, 0.08) &&
      alert.hover.solid.before.bg === 'rgba(0, 0, 0, 0)' &&
      alert.hover.solid.after.hovered === true &&
      alert.hover.solid.after.bg === withAlpha(alert.tokens.dangerFg, 0.08),
    JSON.stringify(alert.hover),
  );

  check(
    '键盘：× 聚焦后 Enter 能关，焦点环 2px 且用 --mc-color-ring（不是 currentColor）',
    alert.keyboard.focused === true &&
      alert.keyboard.focusVisible === true &&
      alert.keyboard.outlineWidth === '2px' &&
      alert.keyboard.outlineColor === alert.tokens.ring &&
      alert.keyboard.seen.length === 1 &&
      alert.keyboard.seen[0].bubbles === true &&
      alert.keyboard.seen[0].composed === true,
    JSON.stringify(alert.keyboard),
  );

  check(
    '运行时：P31 创建时宿主零属性、属性驱动显隐、heading / 正文增删都跟着折或接回来、宿主令牌可覆盖',
    JSON.stringify(alert.runtime.atCreate) === JSON.stringify([]) &&
      alert.runtime.shadow === true &&
      alert.runtime.withHeading.hasTitle === true &&
      alert.runtime.withHeading.hasBody === true &&
      alert.runtime.withHeading.titleDisplay === 'block' &&
      alert.runtime.withHeading.iconDisplay === 'flex' &&
      alert.runtime.withHeading.closeDisplay === 'flex' &&
      JSON.stringify(alert.runtime.glyph) === JSON.stringify(['mc-glyph-info']) &&
      alert.runtime.afterRemoveHeading.hasTitle === false &&
      alert.runtime.afterRemoveHeading.titleDisplay === 'none' &&
      alert.runtime.afterSetHeading.hasTitle === true &&
      alert.runtime.afterSetHeading.titleDisplay === 'block' &&
      alert.runtime.afterEmptyBody.hasBody === false &&
      alert.runtime.afterEmptyBody.bodyDisplay === 'none' &&
      alert.runtime.iconAfterRemove === 'none' &&
      alert.runtime.customize.padX === '32px' &&
      alert.runtime.customize.radius === '16px' &&
      JSON.stringify(alert.runtime.empty.attrs) === JSON.stringify([]) &&
      /* 内容全空 = 上下内边距 + 上下边框，一个像素都不多 */
      alert.runtime.empty.height === 26,
    JSON.stringify(alert.runtime),
  );

  check(
    '::part() 只改得动开了口的内部节点：base 的间距、title 的字号、body 的颜色、close 的颜色',
    alert.parts.custom.gap === '16px' &&
      alert.parts.custom.titleSize === '16px' &&
      alert.parts.custom.closeColor === alert.tokens.danger &&
      alert.parts.custom.bodyColor !== alert.parts.plain.bodyColor &&
      alert.parts.plain.titleSize === '14px',
    JSON.stringify(alert.parts),
  );

  check('mc-alert 文档页没有 404 / 运行时报错', alert.failed.length === 0, alert.failed.join(' | ') || '无');
}
