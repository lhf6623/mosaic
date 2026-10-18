/**
 * mc-badge · 徽标：挂载模式（默认插槽 = 容器、content 属性、placement 四角）、独立模式、
 * 三个维度正交、dot 与内容互斥、max 截断、invisible 与空内容、part=indicator
 */

export default async function run({ page, visit, check }) {
  const badge = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(r.status() + ' ' + r.url());
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?badge=1#/packages/badge/page.html');
    await page
      .waitForFunction(
        () => {
          const badges = window.__deepAll('mc-badge');
          return badges.length >= 40 && badges.every((b) => !!b.shadowRoot);
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    /** 令牌解析：组件内部的颜色都是 rgb(var(--mc-…))，期望值要按当前主题算 */
    const tokens = await page.evaluate(() => {
      const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const rgb = (name) => 'rgb(' + read(name).split(' ').join(', ') + ')';
      return {
        primary: rgb('--mc-color-primary'),
        primarySubtle: rgb('--mc-color-primary-subtle'),
        primaryFg: rgb('--mc-color-primary-fg'),
        infoSubtle: rgb('--mc-color-info-subtle'),
        successSubtle: rgb('--mc-color-success-subtle'),
        warningSubtle: rgb('--mc-color-warning-subtle'),
        danger: rgb('--mc-color-danger'),
        dangerSubtle: rgb('--mc-color-danger-subtle'),
        dangerFg: rgb('--mc-color-danger-fg'),
      };
    });

    /** 全局：实例数、升级、shadow 里有没有交互控件、插槽 / part、两种模式各多少 */
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
        anchored: badges.filter((b) => b.hasAttribute('data-anchored')).length,
        standalone: badges.filter((b) => !b.hasAttribute('data-anchored')).length,
      };
    });

    /** 语义色（demo-badge-colors，五条都是默认的 subtle）：底 = 浅底槽，字 = 强调色 */
    const colors = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-colors')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => {
        const pill = el.shadowRoot.querySelector('.mc-badge');
        const cs = getComputedStyle(pill);
        return {
          color: el.getAttribute('color') ?? 'primary',
          variant: el.getAttribute('variant') ?? 'subtle',
          bg: cs.backgroundColor,
          fg: cs.color,
          borderWidth: cs.borderTopWidth,
        };
      });
    });

    /** 外观（demo-badge-variants）：只换色槽贴到哪儿，1px 边框恒定 */
    const variants = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-variants')[0].shadowRoot;
      const read = (el) => {
        const cs = getComputedStyle(el.shadowRoot.querySelector('.mc-badge'));
        return {
          variant: el.getAttribute('variant') ?? 'subtle',
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

    /** 尺寸（demo-badge-sizes）：高度 / 字号 / 内边距两档；独立模式下宿主盒 = 徽标块 */
    const sizes = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-sizes')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => {
        const pill = el.shadowRoot.querySelector('.mc-badge');
        const cs = getComputedStyle(pill);
        return {
          size: el.getAttribute('size'),
          fontSize: cs.fontSize,
          padX: cs.paddingLeft,
          height: Math.round(pill.getBoundingClientRect().height),
          hostEqualsPill: Math.abs(el.getBoundingClientRect().height - pill.getBoundingClientRect().height) <= 1,
          anchored: el.hasAttribute('data-anchored'),
          position: getComputedStyle(pill).position,
        };
      });
    });

    /** 圆点（demo-badge-dot）：圆点显示、文字不显示，整块变成正圆 */
    const dots = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-dot')[0].shadowRoot;
      const colorBox = window.__deepAll('demo-badge-colors')[0].shadowRoot;
      const read = (el) => {
        const root = el.shadowRoot;
        const pill = root.querySelector('.mc-badge');
        const r = pill.getBoundingClientRect();
        return {
          dot: el.hasAttribute('dot'),
          dotDisplay: getComputedStyle(root.querySelector('.mc-dot')).display,
          textDisplay: getComputedStyle(root.querySelector('.mc-text')).display,
          text: root.querySelector('.mc-text').textContent,
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      };
      return {
        dots: window.__deepAll('mc-badge', box).map(read),
        plain: read(window.__deepAll('mc-badge', colorBox)[0]),
      };
    });

    /** 数值上限（demo-badge-max）：content 是纯数字且超上限才截断 */
    const maxes = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-max')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => ({
        max: el.getAttribute('max'),
        content: el.getAttribute('content'),
        text: el.shadowRoot.querySelector('.mc-text').textContent,
        empty: el.hasAttribute('data-empty'),
      }));
    });

    /** 挂载模式几何（demo-badge-anchor）：宿主盒 = 容器盒；徽标块中心压在右上角；可点穿 */
    const anchor = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-anchor')[0].shadowRoot;
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, top: r.top, bottom: r.bottom, left: r.left };
      };
      return window.__deepAll('mc-badge', box).map((el) => {
        const pill = el.shadowRoot.querySelector('.mc-badge');
        return {
          anchored: el.hasAttribute('data-anchored'),
          host: rect(el),
          anchorEl: rect(el.querySelector('mc-button')),
          pill: rect(pill),
          position: getComputedStyle(pill).position,
          pointerEvents: getComputedStyle(pill).pointerEvents,
          text: el.shadowRoot.querySelector('.mc-text').textContent,
        };
      });
    });

    /** 点穿验证放到下面固定探针里做：doc 页有滚动容器，几何读数之后别再依赖滚动后的视口坐标 */

    /** 四角（demo-badge-placement）：徽标块中心落在对应角上 */
    const placements = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-placement')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => {
        const pill = el.shadowRoot.querySelector('.mc-badge').getBoundingClientRect();
        const host = el.getBoundingClientRect();
        return {
          placement: el.getAttribute('placement'),
          centerX: (pill.left + pill.right) / 2,
          centerY: (pill.top + pill.bottom) / 2,
          host: { left: host.left, right: host.right, top: host.top, bottom: host.bottom },
        };
      });
    });

    /** 独立模式（demo-badge-basic）：没有容器时不定位，宿主盒 = 徽标块盒 */
    const bare = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-basic')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => {
        const pill = el.shadowRoot.querySelector('.mc-badge');
        const host = el.getBoundingClientRect();
        const r = pill.getBoundingClientRect();
        return {
          anchored: el.hasAttribute('data-anchored'),
          position: getComputedStyle(pill).position,
          sameX: Math.abs(host.x - r.x) <= 1,
          sameW: Math.abs(host.width - r.width) <= 1,
          sameH: Math.abs(host.height - r.height) <= 1,
        };
      });
    });

    /** 探针：invisible / 空内容 / 运行时 property 两条路 / 运行时增删容器 */
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'badge-probe';
      host.style.cssText =
        'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
        'display:flex;gap:8px;align-items:center';
      host.innerHTML =
        '<mc-badge id="b-override" style="--mc-badge-h: 40px" content="高"></mc-badge>' +
        '<mc-badge id="b-bad" color="notahex" content="非法"></mc-badge>' +
        '<mc-badge id="b-runtime" max="99" content="5"></mc-badge>' +
        '<mc-badge id="b-empty"></mc-badge>' +
        '<mc-badge id="b-dot" dot></mc-badge>' +
        '<mc-badge id="b-inv" content="7"><button type="button">容器</button></mc-badge>' +
        '<mc-badge id="b-hit" content="5"><button id="b-hit-btn" type="button" style="width:80px;height:32px">点我</button></mc-badge>' +
        '<mc-badge id="b-dyn" content="8"></mc-badge>';
      document.body.append(host);
    });
    await page
      .waitForFunction(
        () =>
          ['b-override', 'b-bad', 'b-runtime', 'b-empty', 'b-dot', 'b-inv', 'b-dyn'].every(
            (id) => !!document.getElementById(id)?.shadowRoot,
          ),
        { timeout: 5000 },
      )
      .catch(() => {});
    await page.waitForTimeout(320); // 底色有 120ms 过渡，等它落定再读

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const pill = (id) => el(id).shadowRoot.querySelector('.mc-badge');
      const rgb = (style) => (style.match(/[0-9]+/g) ?? []).slice(0, 3).join(',');
      return {
        override: Math.round(pill('b-override').getBoundingClientRect().height),
        badInline: el('b-bad').style.cssText,
        badBg: rgb(getComputedStyle(pill('b-bad')).backgroundColor),
        primarySubtle: rgb(
          getComputedStyle(document.documentElement).getPropertyValue('--mc-color-primary-subtle'),
        ),
        empty: {
          attr: el('b-empty').hasAttribute('data-empty'),
          display: getComputedStyle(pill('b-empty')).display,
        },
        dot: {
          attr: el('b-dot').hasAttribute('data-empty'),
          display: getComputedStyle(pill('b-dot')).display,
          dotDisplay: getComputedStyle(el('b-dot').shadowRoot.querySelector('.mc-dot')).display,
        },
        inv: {
          anchored: el('b-inv').hasAttribute('data-anchored'),
          display: getComputedStyle(pill('b-inv')).display,
        },
        dyn: {
          anchored: el('b-dyn').hasAttribute('data-anchored'),
          position: getComputedStyle(pill('b-dyn')).position,
        },
        hit: (() => {
          const r = el('b-hit').getBoundingClientRect();
          const at = document.elementFromPoint(r.right - 3, r.top + 3);
          return at ? at.id || at.tagName : null;
        })(),
      };
    });

    /** max 的运行时：content 变、max 变都要重算 */
    const runtime = await (async () => {
      await page.evaluate(() => {
        document.getElementById('b-runtime').setAttribute('content', '500');
      });
      await page
        .waitForFunction(
          () => document.getElementById('b-runtime').shadowRoot.querySelector('.mc-text').textContent === '99+',
          { timeout: 3000 },
        )
        .catch(() => {});
      const afterGrow = await page.evaluate(() => {
        const el = document.getElementById('b-runtime');
        return { text: el.shadowRoot.querySelector('.mc-text').textContent };
      });

      await page.evaluate(() => {
        document.getElementById('b-runtime').setAttribute('max', '999');
      });
      await page
        .waitForFunction(
          () => document.getElementById('b-runtime').shadowRoot.querySelector('.mc-text').textContent === '500',
          { timeout: 3000 },
        )
        .catch(() => {});
      const afterMax = await page.evaluate(() => {
        const el = document.getElementById('b-runtime');
        return { text: el.shadowRoot.querySelector('.mc-text').textContent };
      });

      await page.evaluate(() => {
        document.getElementById('b-runtime').setAttribute('content', '新');
      });
      await page
        .waitForFunction(
          () => document.getElementById('b-runtime').shadowRoot.querySelector('.mc-text').textContent === '新',
          { timeout: 3000 },
        )
        .catch(() => {});
      const afterText = await page.evaluate(() => {
        const el = document.getElementById('b-runtime');
        return { text: el.shadowRoot.querySelector('.mc-text').textContent };
      });
      return { afterGrow, afterMax, afterText };
    })();

    /** 空内容 / invisible 的运行时：空内容补上就出现；invisible="false" 规范化回显示 */
    const visibility = await (async () => {
      await page.evaluate(() => {
        document.getElementById('b-empty').setAttribute('content', '5');
      });
      await page
        .waitForFunction(
          () =>
            !document.getElementById('b-empty').hasAttribute('data-empty') &&
            getComputedStyle(document.getElementById('b-empty').shadowRoot.querySelector('.mc-badge')).display !== 'none',
          { timeout: 3000 },
        )
        .catch(() => {});
      const afterFill = await page.evaluate(() => {
        const el = document.getElementById('b-empty');
        return {
          empty: el.hasAttribute('data-empty'),
          text: el.shadowRoot.querySelector('.mc-text').textContent,
        };
      });

      await page.evaluate(() => {
        document.getElementById('b-inv').setAttribute('invisible', 'false');
      });
      await page
        .waitForFunction(
          () => !document.getElementById('b-inv').hasAttribute('invisible'),
          { timeout: 3000 },
        )
        .catch(() => {});
      const normalized = await page.evaluate(() => {
        const el = document.getElementById('b-inv');
        return {
          hasAttr: el.hasAttribute('invisible'),
          display: getComputedStyle(el.shadowRoot.querySelector('.mc-badge')).display,
        };
      });

      await page.evaluate(() => {
        document.getElementById('b-inv').setAttribute('invisible', '');
      });
      await page
        .waitForFunction(
          () =>
            getComputedStyle(document.getElementById('b-inv').shadowRoot.querySelector('.mc-badge')).display === 'none',
          { timeout: 3000 },
        )
        .catch(() => {});
      const hidden = await page.evaluate(() => {
        const el = document.getElementById('b-inv');
        return {
          hasAttr: el.hasAttribute('invisible'),
          display: getComputedStyle(el.shadowRoot.querySelector('.mc-badge')).display,
        };
      });
      return { afterFill, normalized, hidden };
    })();

    /** 运行时增删容器：slotchange → data-anchored 跟着翻 */
    const dynamic = await (async () => {
      await page.evaluate(() => {
        const el = document.getElementById('b-dyn');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '后来加的容器';
        el.append(btn);
      });
      await page
        .waitForFunction(() => document.getElementById('b-dyn').hasAttribute('data-anchored'), {
          timeout: 3000,
        })
        .catch(() => {});
      const added = await page.evaluate(() => {
        const el = document.getElementById('b-dyn');
        return {
          anchored: el.hasAttribute('data-anchored'),
          position: getComputedStyle(el.shadowRoot.querySelector('.mc-badge')).position,
        };
      });

      await page.evaluate(() => {
        document.getElementById('b-dyn').querySelector('button')?.remove();
      });
      await page
        .waitForFunction(() => !document.getElementById('b-dyn').hasAttribute('data-anchored'), {
          timeout: 3000,
        })
        .catch(() => {});
      const removed = await page.evaluate(() => {
        const el = document.getElementById('b-dyn');
        return {
          anchored: el.hasAttribute('data-anchored'),
          position: getComputedStyle(el.shadowRoot.querySelector('.mc-badge')).position,
        };
      });
      return { added, removed };
    })();

    /** 内部样式（demo-badge-part）：::part(indicator) 真的改到了徽标块 */
    const part = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-part')[0].shadowRoot;
      return window.__deepAll('mc-badge', box).map((el) => ({
        shadow: getComputedStyle(el.shadowRoot.querySelector('.mc-badge')).boxShadow,
      }));
    });

    /** color 收 hex（demo-badge-hex）：浅底按主题混、实心上的文字色按对比度自动给 */
    const hex = await page.evaluate(() => {
      const box = window.__deepAll('demo-badge-hex')[0].shadowRoot;
      const read = (el) => {
        const pill = el.shadowRoot.querySelector('.mc-badge');
        const cs = getComputedStyle(pill);
        const slot = (name) =>
          el.style
            .getPropertyValue(name)
            .trim()
            .split(' ')
            .join(',');
        return {
          fill: slot('--mc-badge-fill'),
          subtleFill: slot('--mc-badge-subtle-fill'),
          bg: (cs.backgroundColor.match(/[0-9]+/g) ?? []).slice(0, 3).join(','),
          fg: (cs.color.match(/[0-9]+/g) ?? []).slice(0, 3).join(','),
          border: (cs.borderTopColor.match(/[0-9]+/g) ?? []).slice(0, 3).join(','),
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
    return {
      tokens, overview, colors, variants, sizes, dots, maxes,
      anchor, placements, bare, probe, runtime, visibility, dynamic, part, hex, failed,
    };
  })();

  check(
    'mc-badge 注册并渲染；shadow 里没有交互控件；一个默认插槽；开 part="indicator"；挂载 11 / 独立 32',
    badge.overview.upgraded &&
      badge.overview.total >= 43 &&
      badge.overview.innerControls === 0 &&
      JSON.stringify(badge.overview.slotCounts) === JSON.stringify([1]) &&
      JSON.stringify(badge.overview.parts) === JSON.stringify(['indicator']) &&
      badge.overview.anchored === 11 &&
      badge.overview.standalone === 32 &&
      badge.failed.length === 0,
    JSON.stringify(badge.overview) + ' · ' + (badge.failed.join(' | ') || '无 404 / 报错'),
  );

  check(
    '语义色：五条默认 subtle，底 = 浅底槽、字 = 强调色，1px 边框',
    badge.colors.length === 5 &&
      badge.colors.every((c) => c.variant === 'subtle' && c.borderWidth === '1px') &&
      badge.colors[0].color === 'primary' &&
      badge.colors[0].bg === badge.tokens.primarySubtle &&
      badge.colors[0].fg === badge.tokens.primary &&
      badge.colors[1].bg === badge.tokens.infoSubtle &&
      badge.colors[2].bg === badge.tokens.successSubtle &&
      badge.colors[3].bg === badge.tokens.warningSubtle &&
      badge.colors[4].bg === badge.tokens.dangerSubtle,
    JSON.stringify(badge.colors),
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
    'size 两档 = 16 / 20px、字号 10 / 12px、左右内边距 4 / 8px；尺寸走 --mc-badge-h（宿主覆盖 40px 就变 40）；独立模式宿主盒 = 徽标块',
    JSON.stringify(badge.sizes.map((s) => [s.size, s.fontSize, s.padX, s.height])) ===
      JSON.stringify([
        ['sm', '10px', '4px', 16],
        ['md', '12px', '8px', 20],
        ['sm', '10px', '4px', 16],
        ['md', '12px', '8px', 20],
      ]) &&
      badge.sizes.every((s) => s.hostEqualsPill && !s.anchored && s.position === 'static') &&
      badge.probe.override === 40,
    JSON.stringify({ sizes: badge.sizes, override: badge.probe.override }),
  );

  check(
    'dot：圆点显示、文字不显示，整块变成正圆（宽 == 高）；没开 dot 的实例圆点是隐藏的',
    badge.dots.dots.length === 7 &&
      badge.dots.dots.every((d) => d.dot && d.dotDisplay === 'block' && d.textDisplay === 'none') &&
      badge.dots.dots.every((d) => d.width === d.height) &&
      badge.dots.dots.slice(0, 5).every((d) => d.height === 20) &&
      badge.dots.dots[5].height === 16 &&
      badge.dots.dots[6].text === '' &&
      badge.dots.plain.dot === false &&
      badge.dots.plain.dotDisplay === 'none' &&
      badge.dots.plain.textDisplay === 'block',
    JSON.stringify(badge.dots),
  );

  check(
    'max：纯数字超过上限才换成 max+；content / max / 运行时再改都重算；混了文字的不截断',
    badge.maxes[0].text === '99+' &&
      badge.maxes[1].text === '5' &&
      badge.maxes[2].text === '999+' &&
      badge.maxes[3].text === '新' &&
      badge.runtime.afterGrow.text === '99+' &&
      badge.runtime.afterMax.text === '500' &&
      badge.runtime.afterText.text === '新',
    JSON.stringify({ maxes: badge.maxes, runtime: badge.runtime }),
  );

  check(
    '挂载模式几何：宿主盒 = 容器盒；徽标块 absolute、中心压在右上角、pointer-events:none；盖住的那一角点得到容器',
    badge.anchor.length === 4 &&
      badge.anchor.every(
        (a) =>
          a.anchored &&
          a.position === 'absolute' &&
          a.pointerEvents === 'none' &&
          Math.abs(a.host.x - a.anchorEl.x) <= 1 &&
          Math.abs(a.host.y - a.anchorEl.y) <= 1 &&
          Math.abs(a.host.w - a.anchorEl.w) <= 1 &&
          Math.abs(a.host.h - a.anchorEl.h) <= 1 &&
          Math.abs((a.pill.left + a.pill.right) / 2 - a.host.right) <= 1.5 &&
          Math.abs((a.pill.top + a.pill.bottom) / 2 - a.host.top) <= 1.5,
      ) &&
      badge.anchor[0].text === '5' &&
      badge.anchor[1].text === '99+' &&
      badge.anchor[2].text === '' &&
      badge.anchor[3].text === '9' &&
      badge.probe.hit === 'b-hit-btn',
    JSON.stringify(badge.anchor) + ' · hit=' + badge.probe.hit,
  );

  check(
    'placement 四角：top-end / top-start / bottom-end / bottom-start 的中心分别落在右上 / 左上 / 右下 / 左下',
    badge.placements.length === 4 &&
      badge.placements.every((p) => {
        const wantRight = p.placement === 'top-end' || p.placement === 'bottom-end';
        const wantTop = p.placement === 'top-end' || p.placement === 'top-start';
        const cx = wantRight ? p.host.right : p.host.left;
        const cy = wantTop ? p.host.top : p.host.bottom;
        return Math.abs(p.centerX - cx) <= 1.5 && Math.abs(p.centerY - cy) <= 1.5;
      }),
    JSON.stringify(badge.placements),
  );

  check(
    '独立模式：没有容器时不定位（static），宿主盒 = 徽标块盒',
    badge.bare.length === 3 &&
      badge.bare.every((b) => !b.anchored && b.position === 'static' && b.sameX && b.sameW && b.sameH),
    JSON.stringify(badge.bare),
  );

  check(
    '空内容不渲染（data-empty），dot 时空内容照常显示；补上 content 就出现；invisible="false" 规范化回显示、invisible 隐藏、容器保留',
    badge.probe.empty.attr === true &&
      badge.probe.empty.display === 'none' &&
      badge.probe.dot.attr === false &&
      badge.probe.dot.display !== 'none' &&
      badge.probe.dot.dotDisplay === 'block' &&
      badge.probe.inv.anchored === true &&
      badge.probe.inv.display !== 'none' &&
      badge.visibility.afterFill.empty === false &&
      badge.visibility.afterFill.text === '5' &&
      badge.visibility.normalized.hasAttr === false &&
      badge.visibility.normalized.display !== 'none' &&
      badge.visibility.hidden.hasAttr === true &&
      badge.visibility.hidden.display === 'none',
    JSON.stringify({ probe: badge.probe, visibility: badge.visibility }),
  );

  check(
    '运行时增删容器：data-anchored 跟着翻，徽标块在 static / absolute 之间切换',
    badge.probe.dyn.anchored === false &&
      badge.probe.dyn.position === 'static' &&
      badge.dynamic.added.anchored === true &&
      badge.dynamic.added.position === 'absolute' &&
      badge.dynamic.removed.anchored === false &&
      badge.dynamic.removed.position === 'static',
    JSON.stringify({ probe: badge.probe.dyn, dynamic: badge.dynamic }),
  );

  check(
    'part="indicator"：::part(indicator) 能从外面改到徽标块（演示给外挂那半圈挖了边）',
    badge.part.length === 2 && badge.part.every((p) => p.shadow !== 'none'),
    JSON.stringify(badge.part),
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
