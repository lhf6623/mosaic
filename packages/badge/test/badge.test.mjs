/**
 * mc-badge · 徽标：三个维度正交（color / variant / size），
 * dot 与内容互斥（圆点模式 + 正圆）、max 对纯数字内容的截断（slotchange 与运行时 max 都走同一个入口）、
 * color 收 hex、以及尺寸走宿主令牌（覆盖 --mc-badge-h 就跟着变）
 */

export default async function run({ page, visit, check }) {
  const badge = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?badge=1#/packages/badge/page.html');
    await page
      .waitForFunction(
        () => {
          const badges = window.__deepAll('mc-badge');
          return badges.length >= 25 && badges.every((b) => !!b.shadowRoot);
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
        success: rgb('--mc-color-success'),
        successSubtle: rgb('--mc-color-success-subtle'),
        warning: rgb('--mc-color-warning'),
        warningSubtle: rgb('--mc-color-warning-subtle'),
        danger: rgb('--mc-color-danger'),
        dangerSubtle: rgb('--mc-color-danger-subtle'),
        dangerFg: rgb('--mc-color-danger-fg'),
      };
    });

    /** 全局：实例数、升级、内部有没有交互控件、有没有开口的 part */
    const overview = await page.evaluate(() => {
      const badges = window.__deepAll('mc-badge');
      return {
        total: badges.length,
        upgraded: badges.every((b) => !!b.shadowRoot),
        innerControls: badges.reduce(
          (n, b) => n + b.shadowRoot.querySelectorAll('button, a, input, select, textarea').length,
          0,
        ),
        slotCounts: [...new Set(badges.map((b) => b.shadowRoot.querySelectorAll('slot').length))],
        parts: [
          ...new Set(
            badges.flatMap((b) =>
              [...b.shadowRoot.querySelectorAll('[part]')].map((n) => n.getAttribute('part')),
            ),
          ),
        ],
      };
    });

    /** 语义色（demo-badge-colors，五条都是默认的 subtle）：底 = 浅底槽，字 = 强调色 */
    const colors = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-colors')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => {
        const cs = getComputedStyle(el);
        return {
          color: el.getAttribute('color') ?? 'primary',
          variant: el.getAttribute('variant') ?? 'subtle',
          bg: cs.backgroundColor,
          fg: cs.color,
          borderWidth: cs.borderTopWidth,
        };
      });
    });

    /** 外观（demo-badge-variants，同色三档 + 危险色两档）：只换色槽贴到哪儿，1px 边框恒定 */
    const variants = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-variants')[0].shadowRoot;
      const read = (el) => {
        const cs = getComputedStyle(el);
        return {
          variant: el.getAttribute('variant') ?? 'subtle',
          color: el.getAttribute('color') ?? 'primary',
          bg: cs.backgroundColor,
          fg: cs.color,
          borderWidth: cs.borderTopWidth,
          borderColor: cs.borderTopColor,
        };
      };
      const badges = window.__deepAll('mc-badge', box);
      return {
        subtle: read(badges[0]),
        solid: read(badges[1]),
        outline: read(badges[2]),
        dangerSolid: read(badges[3]),
        dangerOutline: read(badges[4]),
      };
    });

    /** 尺寸（demo-badge-sizes）：高度/字号/内边距两档 */
    const sizes = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-sizes')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => {
        const cs = getComputedStyle(el);
        return {
          size: el.getAttribute('size'),
          fontSize: cs.fontSize,
          padX: cs.paddingLeft,
          height: Math.round(el.getBoundingClientRect().height),
        };
      });
    });

    /** 圆点（demo-badge-dot）：圆点显示、内容整块隐藏；开了 dot 的实例是正圆 */
    const dots = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-dot')[0].shadowRoot;
      const colorBox = window.__deepAll('demo-badge-colors')[0].shadowRoot;
      const read = (el) => {
        const root = el.shadowRoot;
        const r = el.getBoundingClientRect();
        return {
          dot: el.hasAttribute('dot'),
          dotDisplay: getComputedStyle(root.querySelector('.mc-dot')).display,
          contentDisplay: getComputedStyle(root.querySelector('.mc-content')).display,
          maxText: root.querySelector('.mc-text').textContent,
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      };
      return {
        dots: window.__deepAll('mc-badge', box).map(read),
        plain: read(window.__deepAll('mc-badge', colorBox)[0]),
      };
    });

    /** 数值上限（demo-badge-max）：纯数字超上限才截断 */
    const maxes = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-max')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => {
        const root = el.shadowRoot;
        return {
          max: el.getAttribute('max'),
          content: el.textContent.trim(),
          overflow: el.hasAttribute('data-overflow'),
          maxText: root.querySelector('.mc-text').textContent,
          contentDisplay: getComputedStyle(root.querySelector('.mc-content')).display,
        };
      });
    });

    /* 探针：宿主令牌覆盖（尺寸确实走 --mc-badge-h）、非法 hex、max 的运行时两条路 */
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'badge-probe';
      host.style.cssText =
        'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
        'display:flex;gap:8px;align-items:center';
      host.innerHTML =
        '<mc-badge id="b-override" style="--mc-badge-h: 40px">高</mc-badge>' +
        '<mc-badge id="b-bad" color="notahex">非法</mc-badge>' +
        '<mc-badge id="b-runtime" max="99">5</mc-badge>';
      document.body.append(host);
    });
    await page
      .waitForFunction(
        () =>
          ['b-override', 'b-bad', 'b-runtime'].every((id) => !!document.getElementById(id)?.shadowRoot),
        { timeout: 5000 },
      )
      .catch(() => {});
    await page.waitForTimeout(320); // 底色有 120ms 过渡，等它落定再读

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const rgb = (style) => (style.match(/\d+/g) ?? []).slice(0, 3).join(',');
      return {
        override: Math.round(el('b-override').getBoundingClientRect().height),
        /* 非 hex：一个槽都不写，回落到默认的 primary 浅底 */
        badInline: el('b-bad').style.cssText,
        badBg: rgb(getComputedStyle(el('b-bad')).backgroundColor),
        primarySubtle: rgb(
          getComputedStyle(document.documentElement).getPropertyValue('--mc-color-primary-subtle'),
        ),
      };
    });

    /** max 的运行时：内容变（slotchange）与 max 变都要重算 —— 两条路都走 applyMax */
    const runtime = await (async () => {
      await page.evaluate(() => {
        document.getElementById('b-runtime').textContent = '500';
      });
      await page
        .waitForFunction(
          () =>
            document.getElementById('b-runtime').shadowRoot.querySelector('.mc-text').textContent ===
            '99+',
          { timeout: 3000 },
        )
        .catch(() => {});
      const afterGrow = await page.evaluate(() => {
        const el = document.getElementById('b-runtime');
        return {
          overflow: el.hasAttribute('data-overflow'),
          maxText: el.shadowRoot.querySelector('.mc-text').textContent,
          contentDisplay: getComputedStyle(el.shadowRoot.querySelector('.mc-content')).display,
        };
      });

      await page.evaluate(() => {
        document.getElementById('b-runtime').setAttribute('max', '999');
      });
      await page
        .waitForFunction(() => !document.getElementById('b-runtime').hasAttribute('data-overflow'), {
          timeout: 3000,
        })
        .catch(() => {});
      const afterMax = await page.evaluate(() => {
        const el = document.getElementById('b-runtime');
        return {
          overflow: el.hasAttribute('data-overflow'),
          maxText: el.shadowRoot.querySelector('.mc-text').textContent,
          contentDisplay: getComputedStyle(el.shadowRoot.querySelector('.mc-content')).display,
        };
      });
      return { afterGrow, afterMax };
    })();

    /** color 收 hex（demo-badge-hex）：浅底按主题混、实心上的文字色按对比度自动给 */
    const hex = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-hex')[0].shadowRoot;
      const read = (el) => {
        const cs = getComputedStyle(el);
        const slot = (name) =>
          el.style
            .getPropertyValue(name)
            .trim()
            .replace(/\s+/g, ',');
        return {
          fill: slot('--mc-badge-fill'),
          subtleFill: slot('--mc-badge-subtle-fill'),
          bg: (cs.backgroundColor.match(/\d+/g) ?? []).slice(0, 3).join(','),
          fg: (cs.color.match(/\d+/g) ?? []).slice(0, 3).join(','),
          border: (cs.borderTopColor.match(/\d+/g) ?? []).slice(0, 3).join(','),
        };
      };
      const badges = window.__deepAll('mc-badge', box);
      return {
        yellow: read(badges[0]),
        yellowSolid: read(badges[1]),
        short: read(badges[2]),
        outline: read(badges[3]),
      };
    });

    await page.evaluate(() => document.getElementById('badge-probe')?.remove());

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { tokens, overview, colors, variants, sizes, dots, maxes, probe, runtime, hex, failed };
  })();

  check(
    'mc-badge 注册并渲染；内部没有交互控件、没有 part（视觉全在 :host 上）；五个语义色的浅底/文字就是各自的令牌',
    badge.overview.upgraded &&
      badge.overview.total >= 25 &&
      badge.overview.innerControls === 0 &&
      JSON.stringify(badge.overview.slotCounts) === JSON.stringify([1]) &&
      JSON.stringify(badge.overview.parts) === JSON.stringify([]) &&
      badge.colors.length === 5 &&
      badge.colors.every((c) => c.variant === 'subtle' && c.borderWidth === '1px') &&
      badge.colors[0].color === 'primary' &&
      badge.colors[0].bg === badge.tokens.primarySubtle &&
      badge.colors[0].fg === badge.tokens.primary &&
      badge.colors[1].bg === badge.tokens.infoSubtle &&
      badge.colors[2].bg === badge.tokens.successSubtle &&
      badge.colors[2].fg === badge.tokens.success &&
      badge.colors[3].bg === badge.tokens.warningSubtle &&
      badge.colors[4].bg === badge.tokens.dangerSubtle &&
      badge.colors[4].fg === badge.tokens.danger &&
      badge.failed.length === 0,
    `${badge.overview.total} 个徽标 · 控件 ${badge.overview.innerControls} · ${JSON.stringify(badge.colors)} · ${badge.failed.join(' | ') || '无 404 / 报错'}`,
  );

  check(
    'variant：subtle 浅底 / solid 实心（字 = on-fill）/ outline 透明 + 描边，三档都是 1px 边框，且与 color 正交',
    badge.variants.subtle.bg === badge.tokens.primarySubtle &&
      badge.variants.subtle.fg === badge.tokens.primary &&
      badge.variants.solid.bg === badge.tokens.primary &&
      badge.variants.solid.fg === badge.tokens.primaryFg &&
      badge.variants.outline.bg === 'rgba(0, 0, 0, 0)' &&
      badge.variants.outline.fg === badge.tokens.primary &&
      badge.variants.outline.borderColor === badge.tokens.primary &&
      badge.variants.dangerSolid.bg === badge.tokens.danger &&
      badge.variants.dangerSolid.fg === badge.tokens.dangerFg &&
      badge.variants.dangerOutline.borderColor === badge.tokens.danger &&
      [
        badge.variants.subtle,
        badge.variants.solid,
        badge.variants.outline,
        badge.variants.dangerSolid,
        badge.variants.dangerOutline,
      ].every((v) => v.borderWidth === '1px'),
    JSON.stringify(badge.variants),
  );

  check(
    'size 两档 = 16 / 20px、字号 10 / 12px、左右内边距 4 / 8px；尺寸走 --mc-badge-h（宿主覆盖 40px 就变 40）',
    JSON.stringify(badge.sizes.map((s) => [s.size, s.fontSize, s.padX, s.height])) ===
      JSON.stringify([
        ['sm', '10px', '4px', 16],
        ['md', '12px', '8px', 20],
        ['sm', '10px', '4px', 16],
        ['md', '12px', '8px', 20],
      ]) && badge.probe.override === 40,
    JSON.stringify({ sizes: badge.sizes, override: badge.probe.override }),
  );

  check(
    'dot：圆点显示、插槽内容整块不渲染，整块变成正圆（宽 == 高）；没开 dot 的实例圆点是隐藏的',
    badge.dots.dots.length === 7 &&
      badge.dots.dots.every((d) => d.dot && d.dotDisplay === 'block' && d.contentDisplay === 'none') &&
      badge.dots.dots.every((d) => d.width === d.height && d.width === d.height) &&
      badge.dots.dots.slice(0, 5).every((d) => d.height === 20) &&
      badge.dots.dots[5].height === 16 &&
      badge.dots.dots[6].maxText === '' &&
      badge.dots.plain.dot === false &&
      badge.dots.plain.dotDisplay === 'none' &&
      badge.dots.plain.contentDisplay === 'flex',
    JSON.stringify(badge.dots),
  );

  check(
    'max：纯数字超过上限才换成 `${max}+`（内容显示与 max 运行时改都重算）；混了文字的内容不截断',
    badge.maxes.length === 4 &&
      badge.maxes[0].overflow === true &&
      badge.maxes[0].maxText === '99+' &&
      badge.maxes[0].contentDisplay === 'none' &&
      badge.maxes[1].overflow === false &&
      badge.maxes[1].maxText === '' &&
      badge.maxes[1].contentDisplay === 'flex' &&
      badge.maxes[2].maxText === '999+' &&
      badge.maxes[3].overflow === false &&
      badge.runtime.afterGrow.overflow === true &&
      badge.runtime.afterGrow.maxText === '99+' &&
      badge.runtime.afterGrow.contentDisplay === 'none' &&
      badge.runtime.afterMax.overflow === false &&
      badge.runtime.afterMax.maxText === '' &&
      badge.runtime.afterMax.contentDisplay === 'flex',
    JSON.stringify({ maxes: badge.maxes, runtime: badge.runtime }),
  );

  check(
    'color 收 hex：浅底 = 按主题混出的 -subtle-fill、实心文字按对比度自动给（#fff000 → 黑字）；非法值一个槽都不写',
    badge.hex.yellow.bg === badge.hex.yellow.subtleFill &&
      badge.hex.yellow.fg === '255,240,0' &&
      badge.hex.yellowSolid.bg === '255,240,0' &&
      badge.hex.yellowSolid.fg === '0,0,0' &&
      badge.hex.short.fill === '255,204,0' &&
      badge.hex.outline.border === '26,127,90' &&
      badge.probe.badInline === '' &&
      badge.probe.badBg === badge.probe.primarySubtle,
    JSON.stringify({ hex: badge.hex, bad: badge.probe }),
  );
}
