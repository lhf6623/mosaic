/**
 * mc-spinner · 加载指示：三档尺寸随继承字号缩放（1em / 1.5em / 2em）、
 * color 默认 current 继承父级文字色（shadow-base 的 :host reset 会掐断继承，这条守着）、
 * 语义色 == 令牌、label → aria-label（宿主 role="status"、图形 aria-hidden）、
 * 动画时长走 --mc-spinner-duration（宿主覆盖就跟着变）
 */

export default async function run({ page, visit, check }) {
  const spinner = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?spinner=1#/packages/spinner/page.html');
    await page
      .waitForFunction(
        () => {
          const all = window.__deepAll('mc-spinner');
          return all.length >= 12 && all.every((s) => !!s.shadowRoot);
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
        info: rgb('--mc-color-info'),
        success: rgb('--mc-color-success'),
        warning: rgb('--mc-color-warning'),
        danger: rgb('--mc-color-danger'),
        fgMuted: rgb('--mc-color-fg-muted'),
      };
    });

    /** 全局：实例数、升级、图形是唯一子元素且对读屏隐藏、没有插槽 / part */
    const overview = await page.evaluate(() => {
      const all = window.__deepAll('mc-spinner');
      const read = (el) => {
        const root = el.shadowRoot;
        const glyph = root.querySelector('.mc-spinner');
        return {
          upgraded: !!root,
          role: el.getAttribute('role'),
          slots: root.querySelectorAll('slot').length,
          parts: root.querySelectorAll('[part]').length,
          /* <style> 是 ofa 编译进来的，不算结构：只看真元素 */
          children: [...root.children].filter((n) => n.tagName !== 'STYLE').map((n) => n.className),
          glyphHidden: glyph?.getAttribute('aria-hidden'),
          innerControls: root.querySelectorAll('button, a, input').length,
        };
      };
      const rows = all.map(read);
      return {
        total: all.length,
        upgraded: rows.every((r) => r.upgraded),
        roles: [...new Set(rows.map((r) => r.role))],
        slots: [...new Set(rows.map((r) => r.slots))],
        parts: [...new Set(rows.map((r) => r.parts))],
        children: [...new Set(rows.map((r) => r.children.join('+')))],
        glyphHidden: [...new Set(rows.map((r) => r.glyphHidden))],
        innerControls: rows.reduce((n, r) => n + r.innerControls, 0),
      };
    });

    /** 探针：三档尺寸在两种父字号下的表现；current 继承；令牌覆盖；label 的运行时改动 */
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'spinner-probe';
      host.style.cssText =
        'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
        'display:flex;gap:10px;align-items:center';
      host.innerHTML =
        '<div id="sp-20" style="font-size:20px;color:rgb(12,34,56);display:flex;gap:10px;align-items:center">' +
        '<mc-spinner id="s-sm" size="sm"></mc-spinner>' +
        '<mc-spinner id="s-md"></mc-spinner>' +
        '<mc-spinner id="s-lg" size="lg"></mc-spinner>' +
        '<mc-spinner id="s-current"></mc-spinner>' +
        '</div>' +
        '<div id="sp-10" style="font-size:10px;display:flex;gap:10px;align-items:center">' +
        '<mc-spinner id="t-sm" size="sm"></mc-spinner>' +
        '<mc-spinner id="t-md"></mc-spinner>' +
        '<mc-spinner id="t-lg" size="lg"></mc-spinner>' +
        '</div>' +
        '<mc-spinner id="s-primary" color="primary"></mc-spinner>' +
        '<mc-spinner id="s-info" color="info"></mc-spinner>' +
        '<mc-spinner id="s-success" color="success"></mc-spinner>' +
        '<mc-spinner id="s-warning" color="warning"></mc-spinner>' +
        '<mc-spinner id="s-danger" color="danger"></mc-spinner>' +
        '<mc-spinner id="s-neutral" color="neutral"></mc-spinner>' +
        '<mc-spinner id="s-label" label="正在同步"></mc-spinner>' +
        '<mc-spinner id="s-token" style="--mc-spinner-duration: 5s"></mc-spinner>';
      document.body.append(host);
    });
    await page
      .waitForFunction(
        () =>
          ['s-sm', 's-md', 's-lg', 't-sm', 't-md', 't-lg', 's-token'].every(
            (id) => !!document.getElementById(id)?.shadowRoot,
          ),
        { timeout: 5000 },
      )
      .catch(() => {});

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const box = (id) => {
        const r = el(id).getBoundingClientRect();
        return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
      };
      const cs = (id) => getComputedStyle(el(id));
      const glyph = (id) => getComputedStyle(el(id).shadowRoot.querySelector('.mc-spinner'));
      return {
        font20: { fontSize: cs('s-sm').fontSize, sm: box('s-sm'), md: box('s-md'), lg: box('s-lg') },
        font10: { fontSize: cs('t-sm').fontSize, sm: box('t-sm'), md: box('t-md'), lg: box('t-lg') },
        current: { color: cs('s-current').color, inherited: cs('sp-20').color },
        semantic: {
          primary: cs('s-primary').color,
          info: cs('s-info').color,
          success: cs('s-success').color,
          warning: cs('s-warning').color,
          danger: cs('s-danger').color,
          neutral: cs('s-neutral').color,
        },
        labels: {
          default: window.__deepAll('mc-spinner')[0].getAttribute('aria-label'),
          custom: el('s-label').getAttribute('aria-label'),
        },
        token: {
          name: glyph('s-token').animationName,
          duration: glyph('s-token').animationDuration,
        },
      };
    });

    /** label 是活的：watch 里改宿主 aria-label；清空就不留一个没名字的 status */
    const labelWatch = await (async () => {
      await page.evaluate(() => {
        document.getElementById('s-label').setAttribute('label', '换了个名字');
      });
      await page
        .waitForFunction(
          () => document.getElementById('s-label').getAttribute('aria-label') === '换了个名字',
          { timeout: 3000 },
        )
        .catch(() => {});
      const changed = await page.evaluate(() => ({
        ariaLabel: document.getElementById('s-label').getAttribute('aria-label'),
        shown: document.getElementById('s-label').textContent.trim(),
      }));
      await page.evaluate(() => {
        document.getElementById('s-label').setAttribute('label', '');
      });
      await page
        .waitForFunction(() => !document.getElementById('s-label').hasAttribute('aria-label'), {
          timeout: 3000,
        })
        .catch(() => {});
      const empty = await page.evaluate(() => ({
        hasAriaLabel: document.getElementById('s-label').hasAttribute('aria-label'),
        role: document.getElementById('s-label').getAttribute('role'),
      }));
      return { changed, empty };
    })();

    await page.evaluate(() => document.getElementById('spinner-probe')?.remove());

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { tokens, overview, probe, labelWatch, failed };
  })();

  check(
    'mc-spinner 注册并渲染：宿主 role="status"、图形是唯一子元素且 aria-hidden、没有插槽也没有 part',
    spinner.overview.upgraded &&
      spinner.overview.total >= 12 &&
      JSON.stringify(spinner.overview.roles) === JSON.stringify(['status']) &&
      JSON.stringify(spinner.overview.slots) === JSON.stringify([0]) &&
      JSON.stringify(spinner.overview.parts) === JSON.stringify([0]) &&
      JSON.stringify(spinner.overview.children) === JSON.stringify(['mc-spinner']) &&
      JSON.stringify(spinner.overview.glyphHidden) === JSON.stringify(['true']) &&
      spinner.overview.innerControls === 0 &&
      spinner.failed.length === 0,
    `${spinner.overview.total} 个 · ${JSON.stringify(spinner.overview)} · ${spinner.failed.join(' | ') || '无 404 / 报错'}`,
  );

  check(
    'size 三档 = 1em / 1.5em / 2em，随继承字号缩放：父级 20px → 20/30/40，父级 10px → 10/15/20',
    JSON.stringify(spinner.probe.font20) ===
      JSON.stringify({
        fontSize: '20px',
        sm: { w: 20, h: 20 },
        md: { w: 30, h: 30 },
        lg: { w: 40, h: 40 },
      }) &&
      JSON.stringify(spinner.probe.font10) ===
        JSON.stringify({
          fontSize: '10px',
          sm: { w: 10, h: 10 },
          md: { w: 15, h: 15 },
          lg: { w: 20, h: 20 },
        }),
    JSON.stringify({ font20: spinner.probe.font20, font10: spinner.probe.font10 }),
  );

  check(
    'color：默认 current 继承父级文字色（不是 reset 的 fg）；五个语义色 == 令牌，neutral 用 fg-muted',
    spinner.probe.current.color === 'rgb(12, 34, 56)' &&
      spinner.probe.current.color === spinner.probe.current.inherited &&
      spinner.probe.semantic.primary === spinner.tokens.primary &&
      spinner.probe.semantic.info === spinner.tokens.info &&
      spinner.probe.semantic.success === spinner.tokens.success &&
      spinner.probe.semantic.warning === spinner.tokens.warning &&
      spinner.probe.semantic.danger === spinner.tokens.danger &&
      spinner.probe.semantic.neutral === spinner.tokens.fgMuted,
    JSON.stringify({ ...spinner.probe.current, ...spinner.probe.semantic }),
  );

  check(
    'label → 宿主的 aria-label（默认「加载中」，改属性立刻跟上；清空就不留一个没有名字的 status）',
    spinner.probe.labels.default === '加载中' &&
      spinner.probe.labels.custom === '正在同步' &&
      spinner.labelWatch.changed.ariaLabel === '换了个名字' &&
      spinner.labelWatch.changed.shown === '' &&
      spinner.labelWatch.empty.hasAriaLabel === false &&
      spinner.labelWatch.empty.role === 'status',
    JSON.stringify({ ...spinner.probe.labels, ...spinner.labelWatch }),
  );

  check(
    '旋转动画的时长走 --mc-spinner-duration（宿主覆盖 5s 就是 5s，不是写死的秒数）',
    spinner.probe.token.name === 'mc-spinner-rotate' && spinner.probe.token.duration === '5s',
    JSON.stringify(spinner.probe.token),
  );
}
