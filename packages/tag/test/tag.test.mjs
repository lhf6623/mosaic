/**
 * mc-tag · 分类标签：三个维度正交（color / variant / size）、
 * closable 的关闭按钮与 close 事件（只发事件不删 DOM）、checkable 的原生切换按钮与 change 事件、
 * selected 覆盖 variant、disabled 归零、运行时 property（el.selected）与 P31 动态创建
 */

export default async function run({ page, visit, check }) {
  const tag = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?tag=1#/packages/tag/page.html');
    await page
      .waitForFunction(
        () => {
          const tags = window.__deepAll('mc-tag');
          return tags.length >= 15 && tags.every((t) => !!t.shadowRoot);
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
        success: rgb('--mc-color-success'),
        successSubtle: rgb('--mc-color-success-subtle'),
        danger: rgb('--mc-color-danger'),
        dangerFg: rgb('--mc-color-danger-fg'),
        neutral: rgb('--mc-color-neutral'),
        neutralFg: rgb('--mc-color-neutral-fg'),
        fgMuted: rgb('--mc-color-fg-muted'),
        surfaceSunken: rgb('--mc-color-surface-sunken'),
        ring: rgb('--mc-color-ring'),
      };
    });

    /** 全局：实例数、升级、原生按钮的个数（每实例最多两个） */
    const overview = await page.evaluate(() => {
      const tags = window.__deepAll('mc-tag');
      const read = (el) => {
        const root = el.shadowRoot;
        const buttons = [...root.querySelectorAll('button')];
        return {
          upgraded: !!root,
          buttons: buttons.map((b) => b.className),
          innerLinks: root.querySelectorAll('a, input, select, textarea').length,
        };
      };
      const rows = tags.map(read);
      return {
        total: tags.length,
        upgraded: rows.every((r) => r.upgraded),
        buttonSets: [...new Set(rows.map((r) => r.buttons.join('+')).filter(Boolean))],
        innerLinks: rows.reduce((n, r) => n + r.innerLinks, 0),
      };
    });

    /** 颜色：subtle（默认外观）的底色/文字与色槽令牌一致；neutral 用下沉面色 */
    const colors = await page.evaluate(() => {
      const box = window.__deepAll('demo-tag-colors')[0].shadowRoot;
      return window.__deepAll('mc-tag', box).map((el) => {
        const cs = getComputedStyle(el);
        return {
          color: el.getAttribute('color') ?? 'neutral',
          variant: el.getAttribute('variant') ?? 'subtle',
          bg: cs.backgroundColor,
          fg: cs.color,
          borderWidth: cs.borderTopWidth,
          borderColor: cs.borderTopColor,
        };
      });
    });

    /** 外观：subtle / solid / outline 只换色槽贴到哪儿，1px 边框恒定 */
    const variants = await page.evaluate(() => {
      const box = window.__deepAll('demo-tag-variants')[0].shadowRoot;
      const read = (el) => {
        const cs = getComputedStyle(el);
        return {
          variant: el.getAttribute('variant') ?? 'subtle',
          color: el.getAttribute('color') ?? 'neutral',
          bg: cs.backgroundColor,
          fg: cs.color,
          borderWidth: cs.borderTopWidth,
          borderColor: cs.borderTopColor,
        };
      };
      const tags = window.__deepAll('mc-tag', box);
      return {
        subtle: read(tags[0]),
        solid: read(tags[1]),
        outline: read(tags[2]),
        dangerSolid: read(tags[4]),
      };
    });

    /** 尺寸：只改字号与左右内边距，高度 = 行高 + 上下内边距 + 上下 1px 边框 */
    const sizes = await page.evaluate(() => {
      const box = window.__deepAll('demo-tag-sizes')[0].shadowRoot;
      return window.__deepAll('mc-tag', box).map((el) => {
        const cs = getComputedStyle(el);
        return {
          size: el.getAttribute('size'),
          fontSize: cs.fontSize,
          lineHeight: cs.lineHeight,
          padX: cs.paddingLeft,
          padY: cs.paddingTop,
          height: Math.round(el.getBoundingClientRect().height),
        };
      });
    });

    /** closable：关闭按钮的显隐、命中区、无障碍名、宿主压暗；不可关的实例里它是隐藏的 */
    const closable = await page.evaluate(() => {
      const colorBox = window.__deepAll('demo-tag-colors')[0].shadowRoot;
      const closeBox = window.__deepAll('demo-tag-closable')[0].shadowRoot;
      const read = (el) => {
        const btn = el.shadowRoot.querySelector('.mc-close');
        const cs = getComputedStyle(btn);
        const r = btn.getBoundingClientRect();
        /* 关闭图形是内置图标（静态图标直接用类，不引 icon.html） */
        const glyph = el.shadowRoot.querySelector('.mc-close .mc-icon-close');
        return {
          display: cs.display,
          glyphMask: glyph ? getComputedStyle(glyph).maskImage !== 'none' : false,
          glyphSize: glyph ? Math.round(glyph.getBoundingClientRect().width) : 0,
          ariaLabel: btn.getAttribute('aria-label'),
          part: btn.getAttribute('part'),
          disabledProp: btn.disabled,
          width: Math.round(r.width),
          height: Math.round(r.height),
          tagHeight: Math.round(el.getBoundingClientRect().height),
        };
      };
      const tags = window.__deepAll('mc-tag', closeBox);
      return {
        plain: read(window.__deepAll('mc-tag', colorBox)[0]),
        closable: read(tags[0]),
        disabled: read(tags.find((t) => t.hasAttribute('disabled'))),
      };
    });

    /** 禁用态不响应 hover（设计规范第五节）：真实鼠标压到 × 上比一比 */
    const hover = await (async () => {
      const points = await page.evaluate(async () => {
        const root = window.__deepAll('demo-tag-closable')[0].shadowRoot;
        const tags = window.__deepAll('mc-tag', root);
        tags.find((t) => !t.hasAttribute('disabled')).scrollIntoView({ block: 'center' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const center = (el) => {
          const r = el.shadowRoot.querySelector('.mc-close').getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };
        return {
          enabled: center(tags.find((t) => !t.hasAttribute('disabled'))),
          disabled: center(tags.find((t) => t.hasAttribute('disabled'))),
        };
      });

      const read = (which) =>
        page.evaluate((pick) => {
          const root = window.__deepAll('demo-tag-closable')[0].shadowRoot;
          const tags = window.__deepAll('mc-tag', root);
          const el =
            pick === 'disabled'
              ? tags.find((t) => t.hasAttribute('disabled'))
              : tags.find((t) => !t.hasAttribute('disabled'));
          const close = el.shadowRoot.querySelector('.mc-close');
          return {
            hovered: close.matches(':hover'),
            bg: getComputedStyle(close).backgroundColor,
            cursor: getComputedStyle(close).cursor,
            layer: getComputedStyle(el.shadowRoot.querySelector('.mc-layer')).opacity,
          };
        }, which);

      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      await page.mouse.move(points.enabled.x, points.enabled.y);
      await page.waitForTimeout(250);
      const enabled = await read('enabled');
      await page.mouse.move(points.disabled.x, points.disabled.y);
      await page.waitForTimeout(250);
      const disabled = await read('disabled');
      await page.mouse.move(0, 0);
      return { enabled, disabled };
    })();

    /** 点 ×：冒泡 + composed 的 close，不删 DOM（删不删是使用者那一半） */
    const closeEvent = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-tag-closable')[0].shadowRoot;
      const [first] = window.__deepAll('mc-tag', box);
      const seen = [];
      first.addEventListener('close', (e) =>
        seen.push({ bubbles: e.bubbles, composed: e.composed, isTag: e.target === first }),
      );
      const before = window.__deepAll('mc-tag', box).length;
      first.shadowRoot.querySelector('.mc-close').click();
      await wait(300);

      /** 禁用实例：宿主 disabled → 两个原生按钮都 :disabled，点不出事件 */
      const off = window.__deepAll('mc-tag', box).find((t) => t.hasAttribute('disabled'));
      const offSeen = [];
      off.addEventListener('close', () => offSeen.push('close'));
      off.shadowRoot.querySelector('.mc-close').click();
      await wait(150);

      return {
        seen,
        before,
        after: window.__deepAll('mc-tag', box).length,
        removed: !first.isConnected,
        offSeen,
        offSelected: off.hasAttribute('selected'),
        lastClosed: box.querySelector('strong')?.textContent?.trim() ?? null,
        cursor: getComputedStyle(off).cursor,
        opacity: getComputedStyle(off).opacity,
        offToggleDisabled: off.shadowRoot.querySelector('.mc-toggle').disabled,
      };
    });

    /** checkable：原生 <button aria-pressed> 铺满宿主，名字来自插槽文本 */
    const checkable = await page.evaluate(() => {
      const box = window.__deepAll('demo-tag-checkable')[0].shadowRoot;
      const read = (el) => {
        const toggle = el.shadowRoot.querySelector('.mc-toggle');
        const root = el.getBoundingClientRect();
        const box2 = toggle.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          checkable: el.hasAttribute('checkable'),
          selected: el.hasAttribute('selected'),
          tagName: toggle.tagName,
          type: toggle.type,
          ariaPressed: toggle.getAttribute('aria-pressed'),
          ariaLabel: toggle.getAttribute('aria-label'),
          disabledProp: toggle.disabled,
          /** 透明层铺满宿主（绝对定位的包含块是宿主的**内边距盒**，所以比宿主窄两个边框） */
          cover:
            Math.abs(box2.width - (root.width - 2)) <= 1 &&
            Math.abs(box2.height - (root.height - 2)) <= 1,
          cursor: cs.cursor,
          bg: cs.backgroundColor,
          fg: cs.color,
          layer: cs.getPropertyValue('--mc-tag-layer').trim(),
        };
      };
      return window.__deepAll('mc-tag', box).map(read);
    });

    /** 点 toggle：立刻写宿主属性 + change（$event.data.selected），aria-pressed 跟着走 */
    const toggleClicks = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      /* 读 bg/fg 前要等这次颜色过渡**真的**走完：固定 sleep 在 4 个套件并行满载时会读到 96% 的
         中间色（实测读到 rgb(119,77,238)，期望 rgb(114,70,237)）。属性/文本不需要等，只有样式要。 */
      const settle = (node) =>
        new Promise((resolve) => {
          const done = () => {
            node.removeEventListener('transitionend', done);
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(done, 1000); // 兜底：没触发过渡（或时长被压到 1ms）也要放行
          node.addEventListener('transitionend', done);
        });
      const box = window.__deepAll('demo-tag-checkable')[0].shadowRoot;
      const el = window.__deepAll('mc-tag', box)[1]; // 未选中的那个
      const seen = [];
      el.addEventListener('change', (e) =>
        seen.push({ selected: e.data?.selected, bubbles: e.bubbles, composed: e.composed }),
      );
      const toggle = el.shadowRoot.querySelector('.mc-toggle');

      toggle.click();
      /** 属性是当次就位的（规范 1.4）；底色有 120ms 过渡，读样式得等它走完 */
      const selectedAttrRightAway = el.hasAttribute('selected');
      await settle(el);
      const attrsAfterSelect = {
        selected: el.hasAttribute('selected'),
        bg: getComputedStyle(el).backgroundColor,
        fg: getComputedStyle(el).color,
      };
      const pressedAfterSelect = toggle.getAttribute('aria-pressed');
      const wordAfterSelect = box.querySelector('strong')?.textContent?.trim() ?? null;

      toggle.click();
      const selectedAfterSecond = el.hasAttribute('selected');
      await wait(200);
      const pressedAfterSecond = toggle.getAttribute('aria-pressed');
      const wordAfterSecond = box.querySelector('strong')?.textContent?.trim() ?? null;

      return {
        seen,
        selectedAttrRightAway,
        attrsAfterSelect,
        pressedAfterSelect,
        wordAfterSelect,
        selectedAfterSecond,
        pressedAfterSecond,
        wordAfterSecond,
      };
    });

    /** 可关 + 可选同时开：点 × 只发 close，不该顺带切换选中 */
    const closeBeatsToggle = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-tag-checkable')[0].shadowRoot;
      const el = window.__deepAll('mc-tag', box).find((t) => t.hasAttribute('closable'));
      const changes = [];
      const closes = [];
      el.addEventListener('change', () => changes.push('change'));
      el.addEventListener('close', () => closes.push('close'));
      el.shadowRoot.querySelector('.mc-close').click();
      await wait(250);
      return { changes, closes, removed: !el.isConnected };
    });

    /** 键盘：原生按钮，Space 可切换（焦点环用 ring 令牌） */
    const keyboard = await (async () => {
      await page.evaluate(() => {
        const box = window.__deepAll('demo-tag-checkable')[0].shadowRoot;
        const el = window.__deepAll('mc-tag', box).find(
          (t) => t.hasAttribute('checkable') && !t.hasAttribute('selected'),
        );
        el.shadowRoot.querySelector('.mc-toggle').focus();
      });
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);
      return page.evaluate(() => {
        const box = window.__deepAll('demo-tag-checkable')[0].shadowRoot;
        /** 焦点在标签**自己的** shadow root 里，所以逐实例问它的 activeElement */
        const el = window.__deepAll('mc-tag', box).find((t) => t.shadowRoot.activeElement);
        const toggle = el.shadowRoot.activeElement;
        const cs = getComputedStyle(toggle);
        return {
          focused: toggle.tagName === 'BUTTON',
          selected: el.hasAttribute('selected'),
          ariaPressed: toggle.getAttribute('aria-pressed'),
          focusVisible: toggle.matches(':focus-visible'),
          outlineWidth: cs.outlineWidth,
          outlineColor: cs.outlineColor,
        };
      });
    })();

    /** 运行时：property 访问器立即生效、属性驱动显隐、P31 动态创建 */
    const runtime = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const el = document.createElement('mc-tag');
      const atCreate = el.getAttributeNames();
      el.textContent = '动态';
      document.body.append(el);
      await wait(300);

      const out = {
        atCreate,
        shadow: !!el.shadowRoot,
        label: el.shadowRoot.querySelector('.mc-toggle').getAttribute('aria-label'),
        closeDisplay: getComputedStyle(el.shadowRoot.querySelector('.mc-close')).display,
        toggleDisplay: getComputedStyle(el.shadowRoot.querySelector('.mc-toggle')).display,
      };

      /** 规范 1.4：运行时状态走 property，写完立刻读得到（P4 的异步那一拍不适用于属性本身） */
      el.selected = true;
      out.selectedAfterProp = el.hasAttribute('selected');
      out.selectedProp = el.selected;
      await wait(150);
      out.pressedAfterProp = el.shadowRoot.querySelector('.mc-toggle').getAttribute('aria-pressed');
      el.selected = false;
      out.selectedAfterReset = el.hasAttribute('selected');

      /** 属性是开关：closable / checkable 加上去，内部元素跟着显形 */
      el.setAttribute('closable', '');
      await wait(150);
      out.closeAfterAttr = getComputedStyle(el.shadowRoot.querySelector('.mc-close')).display;
      el.setAttribute('checkable', '');
      await wait(150);
      out.toggleAfterAttr = getComputedStyle(el.shadowRoot.querySelector('.mc-toggle')).display;
      out.cursorAfterAttr = getComputedStyle(el).cursor;

      el.remove();
      return out;
    });

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return {
      tokens,
      overview,
      colors,
      variants,
      sizes,
      closable,
      hover,
      closeEvent,
      checkable,
      toggleClicks,
      closeBeatsToggle,
      keyboard,
      runtime,
      failed,
    };
  })();

  check(
    'mc-tag 注册并渲染出实例，每个实例最多两个原生按钮（toggle / close），没有别的控件',
    tag.overview.upgraded &&
      tag.overview.total >= 15 &&
      tag.overview.innerLinks === 0 &&
      JSON.stringify(tag.overview.buttonSets) === JSON.stringify(['mc-toggle+mc-close']),
    `${tag.overview.total} 个标签 · 按钮组合=${JSON.stringify(tag.overview.buttonSets)}`,
  );

  check(
    'color 六个色族：subtle 的底色/文字就是各自的浅底与强调色，中性色用下沉面色',
    tag.colors.length === 6 &&
      tag.colors[0].color === 'primary' &&
      tag.colors[0].variant === 'subtle' &&
      tag.colors[0].bg === tag.tokens.primarySubtle &&
      tag.colors[0].fg === tag.tokens.primary &&
      tag.colors[2].bg === tag.tokens.successSubtle &&
      tag.colors[2].fg === tag.tokens.success &&
      tag.colors[5].color === 'neutral' &&
      tag.colors[5].bg === tag.tokens.surfaceSunken &&
      tag.colors[5].fg === tag.tokens.fgMuted &&
      tag.colors.every((c) => c.borderWidth === '1px'),
    JSON.stringify(tag.colors),
  );

  check(
    'variant：subtle 浅底 / solid 实心 / outline 透明 + 描边，三档都是 1px 边框',
    tag.variants.subtle.bg === tag.tokens.primarySubtle &&
      tag.variants.subtle.fg === tag.tokens.primary &&
      tag.variants.solid.bg === tag.tokens.primary &&
      tag.variants.solid.fg === tag.tokens.primaryFg &&
      tag.variants.outline.bg === 'rgba(0, 0, 0, 0)' &&
      tag.variants.outline.fg === tag.tokens.primary &&
      tag.variants.outline.borderColor === tag.tokens.primary &&
      tag.variants.dangerSolid.bg === tag.tokens.danger &&
      tag.variants.dangerSolid.fg === tag.tokens.dangerFg &&
      [tag.variants.subtle, tag.variants.solid, tag.variants.outline].every(
        (v) => v.borderWidth === '1px',
      ),
    JSON.stringify(tag.variants),
  );

  check(
    'size 三档：字号 12/14/16、行高 16/20/24、左右内边距 8/12/16，高度由字号撑',
    JSON.stringify(tag.sizes.map((s) => [s.fontSize, s.lineHeight, s.padX, s.padY])) ===
      JSON.stringify([
        ['12px', '16px', '8px', '4px'],
        ['14px', '20px', '12px', '4px'],
        ['16px', '24px', '16px', '4px'],
      ]) &&
      JSON.stringify(tag.sizes.map((s) => s.height)) === JSON.stringify([26, 30, 34]),
    JSON.stringify(tag.sizes),
  );

  check(
    'closable 才有 ×：默认隐藏；× 是 part="close" 的原生按钮、aria-label="移除"、命中区 24×24 且不把标签撑高',
    tag.closable.plain.display === 'none' &&
      tag.closable.plain.width === 0 &&
      tag.closable.closable.display === 'flex' &&
      tag.closable.disabled.display === 'flex' &&
      tag.closable.closable.ariaLabel === '移除' &&
      tag.closable.closable.glyphMask &&
      tag.closable.closable.glyphSize > 0 &&
      tag.closable.closable.part === 'close' &&
      tag.closable.closable.disabledProp === false &&
      tag.closable.disabled.disabledProp === true &&
      tag.closable.closable.width === 24 &&
      tag.closable.closable.height === 24 &&
      tag.closable.closable.tagHeight === 30 &&
      tag.closable.disabled.tagHeight === 30,
    JSON.stringify(tag.closable),
  );

  check(
    '禁用态不响应 hover：× 不变底色、光标 not-allowed；可用实例的 × 有 hover 反馈、标签本身无叠层',
    tag.hover.enabled.hovered === true &&
      tag.hover.enabled.bg !== 'rgba(0, 0, 0, 0)' &&
      tag.hover.enabled.cursor === 'pointer' &&
      tag.hover.enabled.layer === '0' &&
      tag.hover.disabled.hovered === true &&
      tag.hover.disabled.bg === 'rgba(0, 0, 0, 0)' &&
      tag.hover.disabled.cursor === 'not-allowed' &&
      tag.hover.disabled.layer === '0',
    JSON.stringify(tag.hover),
  );

  check(
    '点 × 发冒泡 + composed 的 close 且不删 DOM；禁用实例的两个原生按钮都进 :disabled，点不出事件',
    tag.closeEvent.seen.length === 1 &&
      tag.closeEvent.seen[0].bubbles === true &&
      tag.closeEvent.seen[0].composed === true &&
      tag.closeEvent.seen[0].isTag === true &&
      tag.closeEvent.before === tag.closeEvent.after + 1 &&
      tag.closeEvent.removed === true &&
      tag.closeEvent.offSeen.length === 0 &&
      tag.closeEvent.offToggleDisabled === true &&
      tag.closeEvent.offSelected === false &&
      tag.closeEvent.cursor === 'not-allowed' &&
      Number(tag.closeEvent.opacity) < 1 &&
      tag.closeEvent.lastClosed === '设计',
    JSON.stringify(tag.closeEvent),
  );

  check(
    'checkable 的整块可点是原生 <button type="button" aria-pressed>，铺满宿主、光标变手型，名字来自插槽文本',
    tag.checkable.every((c) => c.checkable) &&
      tag.checkable.every((c) => c.tagName === 'BUTTON' && c.type === 'button') &&
      tag.checkable.every((c) => c.cover && c.cursor === 'pointer') &&
      tag.checkable.every((c) => c.layer === '0.08') &&
      JSON.stringify(tag.checkable.map((c) => c.ariaLabel)) ===
        JSON.stringify(['已实现', '待建', '已废弃', '可关也可选']) &&
      JSON.stringify(tag.checkable.map((c) => c.ariaPressed)) ===
        JSON.stringify(['true', 'false', 'false', 'false']),
    JSON.stringify(tag.checkable),
  );

  check(
    'selected 覆盖 variant：选中的标签是选中色的实心（底 = fill、字 = on-fill）',
    tag.checkable[0].selected === true &&
      tag.checkable[0].bg === tag.tokens.primary &&
      tag.checkable[0].fg === tag.tokens.primaryFg &&
      tag.checkable[1].bg === tag.tokens.primarySubtle,
    JSON.stringify({ 选中: tag.checkable[0], 未选: tag.checkable[1] }),
  );

  check(
    '点 toggle：当次就写宿主 selected 属性、发 change($event.data.selected)，aria-pressed 跟着翻转',
    tag.toggleClicks.seen.length === 2 &&
      tag.toggleClicks.seen[0].selected === true &&
      tag.toggleClicks.seen[0].bubbles === true &&
      tag.toggleClicks.seen[0].composed === true &&
      tag.toggleClicks.seen[1].selected === false &&
      tag.toggleClicks.selectedAttrRightAway === true &&
      tag.toggleClicks.attrsAfterSelect.selected === true &&
      tag.toggleClicks.attrsAfterSelect.bg === tag.tokens.primary &&
      tag.toggleClicks.attrsAfterSelect.fg === tag.tokens.primaryFg &&
      tag.toggleClicks.pressedAfterSelect === 'true' &&
      tag.toggleClicks.wordAfterSelect === '待建 → 选中' &&
      tag.toggleClicks.selectedAfterSecond === false &&
      tag.toggleClicks.pressedAfterSecond === 'false' &&
      tag.toggleClicks.wordAfterSecond === '待建 → 取消',
    JSON.stringify(tag.toggleClicks),
  );

  check(
    '可关 + 可选同时开：点 × 只发 close，不触发 change（× 在 toggle 层上面，z-index 分开）',
    tag.closeBeatsToggle.closes.length === 1 &&
      tag.closeBeatsToggle.changes.length === 0 &&
      tag.closeBeatsToggle.removed === true,
    JSON.stringify(tag.closeBeatsToggle),
  );

  check(
    '键盘：Space 能切换，焦点环用 --mc-color-ring（不是 currentColor）',
    tag.keyboard.focused === true &&
      tag.keyboard.selected === true &&
      tag.keyboard.ariaPressed === 'true' &&
      tag.keyboard.focusVisible === true &&
      tag.keyboard.outlineWidth === '2px' &&
      tag.keyboard.outlineColor === tag.tokens.ring,
    JSON.stringify(tag.keyboard),
  );

  check(
    '运行时：el.selected 立即生效、closable / checkable 属性驱动内部元素显形，P31 动态创建正常',
    JSON.stringify(tag.runtime.atCreate) === JSON.stringify([]) &&
      tag.runtime.shadow === true &&
      tag.runtime.label === '动态' &&
      tag.runtime.closeDisplay === 'none' &&
      tag.runtime.toggleDisplay === 'none' &&
      tag.runtime.selectedAfterProp === true &&
      tag.runtime.selectedProp === true &&
      tag.runtime.pressedAfterProp === 'true' &&
      tag.runtime.selectedAfterReset === false &&
      tag.runtime.closeAfterAttr === 'flex' &&
      tag.runtime.toggleAfterAttr === 'block' &&
      tag.runtime.cursorAfterAttr === 'pointer',
    JSON.stringify(tag.runtime),
  );

  check('mc-tag 文档页没有 404 / 运行时报错', tag.failed.length === 0, tag.failed.join(' | ') || '无');
}
