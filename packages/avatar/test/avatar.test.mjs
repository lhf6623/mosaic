/**
 * mc-avatar · 头像：图片优先 + 兜底（name 首字母 / 默认插槽）、size 三档、shape、语义色 / hex、
 * 图片失败回退、alt 回退 name、无 part / role / aria。
 */

export default async function run({ page, visit, check }) {
  const avatar = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(r.status() + ' ' + r.url());
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?avatar=1#/packages/avatar/page.html');
    await page
      .waitForFunction(
        () => {
          const list = window.__deepAll('mc-avatar');
          return list.length >= 20 && list.every((el) => !!el.shadowRoot);
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    /** 令牌解析：组件内部的颜色都是 rgb(var(--mc-…))，期望值要按当前主题算 */
    const tokens = await page.evaluate(() => {
      const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const rgb = (name) => 'rgb(' + read(name).split(' ').join(', ') + ')';
      return {
        surfaceSunken: rgb('--mc-color-surface-sunken'),
        fgMuted: rgb('--mc-color-fg-muted'),
        primarySubtle: rgb('--mc-color-primary-subtle'),
        primary: rgb('--mc-color-primary'),
      };
    });

    /** 全局：实例数、插槽 / part / 控件 / aria */
    const overview = await page.evaluate(() => {
      const list = window.__deepAll('mc-avatar');
      return {
        total: list.length,
        upgraded: list.every((el) => !!el.shadowRoot),
        slotCounts: [...new Set(list.map((el) => el.shadowRoot.querySelectorAll('slot').length))],
        parts: [
          ...new Set(
            list.flatMap((el) =>
              [...el.shadowRoot.querySelectorAll('[part]')].map((n) => n.getAttribute('part')),
            ),
          ),
        ],
        controls: list.reduce(
          (n, el) => n + el.shadowRoot.querySelectorAll('button, a, input, select, textarea').length,
          0,
        ),
        aria: list.some(
          (el) =>
            el.hasAttribute('role') ||
            [...el.attributes].some((attr) => attr.name.indexOf('aria-') === 0),
        ),
      };
    });

    /** 现搭现拆探针：尺寸 / 圆角 / 色槽 / 首字母 / 插槽兜底 / 图片加载与失败 */
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'avatar-probe';
      host.style.cssText =
        'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
        'display:flex;gap:8px;align-items:center';
      host.innerHTML = [
        '<div id="ref-full" style="border-radius: var(--mc-radius-full)"></div>',
        '<div id="ref-md" style="border-radius: var(--mc-radius-md)"></div>',
        '<mc-avatar id="a-default"></mc-avatar>',
        '<mc-avatar id="a-sm" size="sm" name="张三"></mc-avatar>',
        '<mc-avatar id="a-lg" size="lg" name="张三"></mc-avatar>',
        '<mc-avatar id="a-num" size="48" name="张三"></mc-avatar>',
        '<mc-avatar id="a-bad-size" size="12px" name="张三"></mc-avatar>',
        '<mc-avatar id="a-square" shape="square" name="张三"></mc-avatar>',
        '<mc-avatar id="a-primary" color="primary" name="张三"></mc-avatar>',
        '<mc-avatar id="a-hex" color="#1a7f5a" name="张三"></mc-avatar>',
        '<mc-avatar id="a-cn" name="张三"></mc-avatar>',
        '<mc-avatar id="a-latin" name="John Doe"></mc-avatar>',
        '<mc-avatar id="a-one" name="alice"></mc-avatar>',
        '<mc-avatar id="a-slot" name="张三"><span>@</span></mc-avatar>',
        '<mc-avatar id="a-override" style="--mc-avatar-size: 3rem" name="自定义"></mc-avatar>',
        '<mc-avatar id="a-img" src="./packages/avatar/demos/avatar.svg" name="头像"></mc-avatar>',
        '<mc-avatar id="a-alt" src="./packages/avatar/demos/avatar.svg" alt="Alt 文本" name="头像"></mc-avatar>',
        '<mc-avatar id="a-broken" src="data:image/png;base64,AAAA" name="坏图"></mc-avatar>',
      ].join('');
      document.body.append(host);
    });
    await page
      .waitForFunction(
        () => {
          const ids = [
            'a-default', 'a-sm', 'a-lg', 'a-num', 'a-bad-size', 'a-square', 'a-primary', 'a-hex', 'a-cn',
            'a-latin', 'a-one', 'a-slot', 'a-override', 'a-img', 'a-alt', 'a-broken',
          ];
          return ids.every((id) => !!document.getElementById(id)?.shadowRoot);
        },
        { timeout: 5000 },
      )
      .catch(() => {});
    await page
      .waitForFunction(() => document.getElementById('a-img')?.hasAttribute('data-has-image'), {
        timeout: 5000,
      })
      .catch(() => {});
    await page.waitForTimeout(400); // 坏图的 error 事件

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const root = (id) => el(id).shadowRoot;
      const box = (id) => {
        const rect = el(id).getBoundingClientRect();
        return { w: Math.round(rect.width), h: Math.round(rect.height) };
      };
      const initials = (id) => root(id).querySelector('.mc-initials').textContent;
      const initialsDisplay = (id) => getComputedStyle(root(id).querySelector('.mc-initials')).display;
      const fallbackDisplay = (id) => getComputedStyle(root(id).querySelector('.mc-fallback')).display;
      const cs = (id) => getComputedStyle(el(id));
      const slot = (id, name) =>
        el(id).style.getPropertyValue(name).trim().split(' ').join(',');
      return {
        sizes: {
          default: box('a-default'),
          sm: box('a-sm'),
          lg: box('a-lg'),
          num: box('a-num'),
          badSize: box('a-bad-size'),
          override: box('a-override'),
        },
        radii: {
          circle: cs('a-default').borderTopLeftRadius,
          square: cs('a-square').borderTopLeftRadius,
          full: getComputedStyle(el('ref-full')).borderTopLeftRadius,
          md: getComputedStyle(el('ref-md')).borderTopLeftRadius,
        },
        colors: {
          neutralBg: cs('a-default').backgroundColor,
          neutralFg: cs('a-default').color,
          primaryBg: cs('a-primary').backgroundColor,
          primaryFg: cs('a-primary').color,
          hexFill: slot('a-hex', '--mc-avatar-subtle-fill'),
          hexAccent: slot('a-hex', '--mc-avatar-accent'),
          hexBg: (cs('a-hex').backgroundColor.match(/[0-9]+/g) ?? []).slice(0, 3).join(','),
        },
        initials: {
          cn: initials('a-cn'),
          latin: initials('a-latin'),
          one: initials('a-one'),
          empty: initials('a-default'),
        },
        slot: {
          has: el('a-slot').hasAttribute('data-has-fallback'),
          initialsDisplay: initialsDisplay('a-slot'),
        },
        image: {
          has: el('a-img').hasAttribute('data-has-image'),
          display: getComputedStyle(root('a-img').querySelector('.mc-image')).display,
          fallbackDisplay: fallbackDisplay('a-img'),
          alt: root('a-img').querySelector('.mc-image').alt,
          altCustom: root('a-alt').querySelector('.mc-image').alt,
          brokenHas: el('a-broken').hasAttribute('data-has-image'),
          brokenFallback: fallbackDisplay('a-broken'),
          brokenText: initials('a-broken'),
        },
      };
    });

    /** 运行时：清空 src 回到兜底、再写回有效地址图片回来；name 变首字母跟着变 */
    const runtime = await (async () => {
      await page.evaluate(() => {
        document.getElementById('a-img').setAttribute('src', '');
      });
      await page
        .waitForFunction(
          () =>
            !document.getElementById('a-img').hasAttribute('data-has-image') &&
            getComputedStyle(
              document.getElementById('a-img').shadowRoot.querySelector('.mc-fallback'),
            ).display !== 'none',
          { timeout: 3000 },
        )
        .catch(() => {});
      const cleared = await page.evaluate(() => {
        const el = document.getElementById('a-img');
        return {
          has: el.hasAttribute('data-has-image'),
          fallbackDisplay: getComputedStyle(
            el.shadowRoot.querySelector('.mc-fallback'),
          ).display,
        };
      });

      await page.evaluate(() => {
        document.getElementById('a-img').setAttribute('src', './packages/avatar/demos/avatar.svg');
      });
      await page
        .waitForFunction(() => document.getElementById('a-img').hasAttribute('data-has-image'), {
          timeout: 5000,
        })
        .catch(() => {});
      const restored = await page.evaluate(() => ({
        has: document.getElementById('a-img').hasAttribute('data-has-image'),
      }));

      await page.evaluate(() => {
        document.getElementById('a-cn').setAttribute('name', '李四');
      });
      await page
        .waitForFunction(
          () =>
            document
              .getElementById('a-cn')
              .shadowRoot.querySelector('.mc-initials').textContent === '李',
          { timeout: 3000 },
        )
        .catch(() => {});
      const renamed = await page.evaluate(() => ({
        text: document.getElementById('a-cn').shadowRoot.querySelector('.mc-initials').textContent,
      }));

      /* size 在数字与三档之间切换：内联变量只由纯数字写，切回 sm 要交还 CSS */
      await page.evaluate(() => {
        document.getElementById('a-num').setAttribute('size', 'sm');
      });
      await page
        .waitForFunction(
          () => Math.round(document.getElementById('a-num').getBoundingClientRect().width) === 24,
          { timeout: 3000 },
        )
        .catch(() => {});
      const shrunk = await page.evaluate(() => ({
        w: Math.round(document.getElementById('a-num').getBoundingClientRect().width),
      }));

      await page.evaluate(() => {
        document.getElementById('a-num').setAttribute('size', '48');
      });
      await page
        .waitForFunction(
          () => Math.round(document.getElementById('a-num').getBoundingClientRect().width) === 48,
          { timeout: 3000 },
        )
        .catch(() => {});
      const regrown = await page.evaluate(() => ({
        w: Math.round(document.getElementById('a-num').getBoundingClientRect().width),
      }));

      return { cleared, restored, renamed, shrunk, regrown };
    })();

    await page.evaluate(() => document.getElementById('avatar-probe')?.remove());

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { tokens, overview, probe, runtime, failed };
  })();

  check(
    'mc-avatar 注册并渲染：一个默认插槽、没有 part / 交互控件 / role / aria-*',
    avatar.overview.upgraded &&
      avatar.overview.total >= 20 &&
      JSON.stringify(avatar.overview.slotCounts) === JSON.stringify([1]) &&
      JSON.stringify(avatar.overview.parts) === JSON.stringify([]) &&
      avatar.overview.controls === 0 &&
      avatar.overview.aria === false &&
      avatar.failed.length === 0,
    JSON.stringify(avatar.overview) + ' · ' + (avatar.failed.join(' | ') || '无 404 / 报错'),
  );

  check(
    'size 三档 = 24 / 32 / 40px；纯数字按 px（48 → 48×48）、非法值回落 md；--mc-avatar-size 可覆盖（3rem = 48px）',
    avatar.probe.sizes.default.w === 32 &&
      avatar.probe.sizes.default.h === 32 &&
      avatar.probe.sizes.sm.w === 24 &&
      avatar.probe.sizes.sm.h === 24 &&
      avatar.probe.sizes.lg.w === 40 &&
      avatar.probe.sizes.lg.h === 40 &&
      avatar.probe.sizes.num.w === 48 &&
      avatar.probe.sizes.num.h === 48 &&
      avatar.probe.sizes.badSize.w === 32 &&
      avatar.probe.sizes.override.w === 48 &&
      avatar.probe.sizes.override.h === 48,
    JSON.stringify(avatar.probe.sizes),
  );

  check(
    'shape：默认 circle = radius-full，square = radius-md',
    avatar.probe.radii.circle === avatar.probe.radii.full &&
      avatar.probe.radii.square === avatar.probe.radii.md,
    JSON.stringify(avatar.probe.radii),
  );

  check(
    '兜底色：默认 neutral = surface-sunken + fg-muted；primary = 浅底 + 强调色；hex 填同一组槽',
    avatar.probe.colors.neutralBg === avatar.tokens.surfaceSunken &&
      avatar.probe.colors.neutralFg === avatar.tokens.fgMuted &&
      avatar.probe.colors.primaryBg === avatar.tokens.primarySubtle &&
      avatar.probe.colors.primaryFg === avatar.tokens.primary &&
      avatar.probe.colors.hexAccent === '26,127,90' &&
      avatar.probe.colors.hexBg === avatar.probe.colors.hexFill,
    JSON.stringify(avatar.probe.colors),
  );

  check(
    '首字母：非拉丁名取第一个字、拉丁名取前两个词的首字母、单次取首个字母、没有 name 就是空',
    avatar.probe.initials.cn === '张' &&
      avatar.probe.initials.latin === 'JD' &&
      avatar.probe.initials.one === 'A' &&
      avatar.probe.initials.empty === '',
    JSON.stringify(avatar.probe.initials),
  );

  check(
    '默认插槽优先：有自定义兜底内容时不显示首字母（data-has-fallback）',
    avatar.probe.slot.has === true && avatar.probe.slot.initialsDisplay === 'none',
    JSON.stringify(avatar.probe.slot),
  );

  check(
    '图片：加载成功切到 img（兜底让位）、alt 回退 name；坏地址回到兜底',
    avatar.probe.image.has === true &&
      avatar.probe.image.display === 'block' &&
      avatar.probe.image.fallbackDisplay === 'none' &&
      avatar.probe.image.alt === '头像' &&
      avatar.probe.image.altCustom === 'Alt 文本' &&
      avatar.probe.image.brokenHas === false &&
      avatar.probe.image.brokenFallback !== 'none' &&
      avatar.probe.image.brokenText === '坏',
    JSON.stringify(avatar.probe.image),
  );

  check(
    '运行时：清空 src 回兜底、写回有效地址图片回来；name 变首字母跟着变；size 数字 ↔ 三档互切',
    avatar.runtime.cleared.has === false &&
      avatar.runtime.cleared.fallbackDisplay !== 'none' &&
      avatar.runtime.restored.has === true &&
      avatar.runtime.renamed.text === '李' &&
      avatar.runtime.shrunk.w === 24 &&
      avatar.runtime.regrown.w === 48,
    JSON.stringify(avatar.runtime),
  );
}
