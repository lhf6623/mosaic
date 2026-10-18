/**
 * mc-skeleton · 骨架屏：size 三档（控件高）、rect / text / circle 形状、宽高精确覆盖、
 * 底色 / 圆角令牌可覆盖、扫光在 prefers-reduced-motion 下关闭、不写 role / aria-*。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?skeleton=1#/packages/skeleton/page.html');
  await page
    .waitForFunction(() => window.__deepAll('mc-skeleton').length >= 8, { timeout: 8000 })
    .catch(() => {});

  /* 现搭现拆探针：固定 160px 容器（font-size 16px 让 text 的 1em 可预期）里量尺寸 / 圆角 / 令牌 */
  const probe = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const host = document.createElement('div');
        host.id = 'skeleton-probe';
        host.style.cssText =
          'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px';
        host.innerHTML = `
          <div style="width: 160px; font-size: 16px">
            <div id="ref-md" style="border-radius: var(--mc-radius-md)"></div>
            <div id="ref-sm" style="border-radius: var(--mc-radius-sm)"></div>
            <div id="ref-full" style="border-radius: var(--mc-radius-full)"></div>
            <div id="ref-bg" style="background-color: rgb(var(--mc-color-surface-sunken))"></div>
            <mc-skeleton id="sk-default"></mc-skeleton>
            <mc-skeleton id="sk-sm" size="sm"></mc-skeleton>
            <mc-skeleton id="sk-lg" size="lg"></mc-skeleton>
            <mc-skeleton id="sk-text" variant="text" width="120px"></mc-skeleton>
            <mc-skeleton id="sk-text-lg" variant="text" size="lg" width="120px"></mc-skeleton>
            <mc-skeleton id="sk-circle" variant="circle" width="40px" height="40px"></mc-skeleton>
            <mc-skeleton id="sk-circle-size" variant="circle" size="lg"></mc-skeleton>
            <mc-skeleton id="sk-override" size="lg" height="20px"></mc-skeleton>
            <mc-skeleton id="sk-num" size="24"></mc-skeleton>
            <mc-skeleton id="sk-num-height" size="24" height="30px"></mc-skeleton>
            <mc-skeleton id="sk-token" style="--mc-skeleton-bg: 1 2 3"></mc-skeleton>
            <mc-skeleton id="sk-static" no-animation></mc-skeleton>
            <mc-skeleton id="sk-false" no-animation="false"></mc-skeleton>
          </div>`;
        document.body.append(host);

        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const el = (id) => document.getElementById(id);
            const box = (id) => {
              const rect = el(id).getBoundingClientRect();
              return { w: Math.round(rect.width), h: Math.round(rect.height) };
            };
            const bone = (id) => el(id).shadowRoot.querySelector('.bone');
            const styleOf = (node, pseudo) => getComputedStyle(node, pseudo);
            const root = el('sk-default').shadowRoot;
            resolve({
              overview: {
                upgraded: root instanceof ShadowRoot,
                /* <style> / <link> 是样式资源，不算渲染结构 */
                children: [...root.children]
                  .filter((n) => n.tagName !== 'STYLE' && n.tagName !== 'LINK')
                  .map((n) => n.className),
                slots: root.querySelectorAll('slot').length,
                parts: root.querySelectorAll('[part]').length,
                aria: ['role', 'aria-busy', 'aria-label'].filter((a) =>
                  el('sk-default').hasAttribute(a),
                ),
              },
              sizes: {
                default: box('sk-default'),
                sm: box('sk-sm'),
                lg: box('sk-lg'),
                text: box('sk-text'),
                textLg: box('sk-text-lg'),
                circle: box('sk-circle'),
                circleSize: box('sk-circle-size'),
                override: box('sk-override'),
                num: box('sk-num'),
                numHeight: box('sk-num-height'),
              },
              sizeTokens: {
                num: el('sk-num').style.getPropertyValue('--mc-skeleton-h').trim(),
                numHeight: el('sk-num-height').style.getPropertyValue('--mc-skeleton-h').trim(),
              },
              radii: {
                default: styleOf(bone('sk-default')).borderRadius,
                text: styleOf(bone('sk-text')).borderRadius,
                circle: styleOf(bone('sk-circle')).borderRadius,
                md: styleOf(el('ref-md')).borderRadius,
                sm: styleOf(el('ref-sm')).borderRadius,
                full: styleOf(el('ref-full')).borderRadius,
              },
              colors: {
                default: styleOf(bone('sk-default')).backgroundColor,
                token: styleOf(bone('sk-token')).backgroundColor,
                ref: styleOf(el('ref-bg')).backgroundColor,
              },
              shine: {
                animation: styleOf(bone('sk-default'), '::after').animationName,
                gradient: styleOf(bone('sk-default'), '::after').backgroundImage.includes(
                  'linear-gradient',
                ),
              },
              animation: {
                staticAnim: styleOf(bone('sk-static'), '::after').animationName,
                staticAttr: el('sk-static').hasAttribute('no-animation'),
                falseAnim: styleOf(bone('sk-false'), '::after').animationName,
                falseAttr: el('sk-false').hasAttribute('no-animation'),
              },
            });
          }),
        );
      }),
  );

  check(
    'mc-skeleton 注册并渲染：shadow 里只有一个 .bone，没有插槽 / part',
    probe.overview.upgraded &&
      probe.overview.children.length === 1 &&
      probe.overview.children[0] === 'bone' &&
      probe.overview.slots === 0 &&
      probe.overview.parts === 0,
    JSON.stringify(probe.overview),
  );
  check(
    '不写 role / aria-*：骨架屏是纯装饰，不冒充内容',
    probe.overview.aria.length === 0,
    JSON.stringify(probe.overview.aria),
  );
  check(
    '默认 size=md：宽 100%（容器 160px）、高 36px',
    probe.sizes.default.w === 160 && probe.sizes.default.h === 36,
    JSON.stringify(probe.sizes.default),
  );
  check(
    'size 三档 = 控件高：sm 28 / lg 44',
    probe.sizes.sm.h === 28 && probe.sizes.lg.h === 44,
    JSON.stringify({ sm: probe.sizes.sm, lg: probe.sizes.lg }),
  );
  check(
    'width / height 盖过 size：height="20px" → 20；width="120px" → 120',
    probe.sizes.override.h === 20 &&
      probe.sizes.override.w === 160 &&
      probe.sizes.text.w === 120,
    JSON.stringify({ override: probe.sizes.override, text: probe.sizes.text }),
  );
  check(
    'size 收纯数字：size="24" → 宿主高 24px，宿主 style 上写 --mc-skeleton-h=24px；显式 height 仍优先（size="24" + height="30px" 时实际高 30px）',
    probe.sizes.num.h === 24 &&
      probe.sizes.num.w === 160 &&
      probe.sizes.numHeight.h === 30 &&
      probe.sizeTokens.num === '24px' &&
      probe.sizeTokens.numHeight === '24px',
    JSON.stringify({ num: probe.sizes.num, numHeight: probe.sizes.numHeight, tokens: probe.sizeTokens }),
  );
  check(
    'variant="text" 按一行字高 1em（16px），不认 size',
    probe.sizes.text.h === 16 && probe.sizes.textLg.h === 16,
    JSON.stringify({ text: probe.sizes.text, textLg: probe.sizes.textLg }),
  );
  check(
    'variant="circle"：显式宽高 40×40；不写宽高时取高度当宽度（size=lg → 44×44 正圆）',
    probe.sizes.circle.w === 40 &&
      probe.sizes.circle.h === 40 &&
      probe.sizes.circleSize.w === 44 &&
      probe.sizes.circleSize.h === 44,
    JSON.stringify({ circle: probe.sizes.circle, circleSize: probe.sizes.circleSize }),
  );
  check(
    '形状三档的圆角：rect = radius-md、text = radius-sm、circle = radius-full',
    probe.radii.default === probe.radii.md &&
      probe.radii.text === probe.radii.sm &&
      probe.radii.circle === probe.radii.full,
    JSON.stringify(probe.radii),
  );
  check(
    '底色默认取 surface-sunken；--mc-skeleton-bg 可直接覆盖',
    probe.colors.default === probe.colors.ref && probe.colors.token === 'rgb(1, 2, 3)',
    JSON.stringify(probe.colors),
  );
  check(
    '扫光：::after 上有 shimmer 动画与渐变',
    probe.shine.animation === 'mc-skeleton-shimmer' && probe.shine.gradient,
    JSON.stringify(probe.shine),
  );
  check(
    'no-animation 关掉扫光（静态占位）',
    probe.animation.staticAnim === 'none' && probe.animation.staticAttr,
    JSON.stringify(probe.animation),
  );
  check(
    'no-animation="false" 归一化：属性摘掉、动画照常',
    !probe.animation.falseAttr && probe.animation.falseAnim === 'mc-skeleton-shimmer',
    JSON.stringify(probe.animation),
  );

  /* 减弱动效：同一条探针再量一次（量完把媒体模拟恢复，免得影响同一 context 的其他套件） */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => {
    const el = document.getElementById('sk-default');
    return getComputedStyle(el.shadowRoot.querySelector('.bone'), '::after').animationName;
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check('prefers-reduced-motion: reduce 下扫光动画关闭', reduced === 'none', reduced);

  /* 数字 ↔ 档位：内联令牌只由纯数字写，切回档位交还 CSS */
  const numericSwitch = await page.evaluate(async () => {
    const el = document.getElementById('sk-num');
    const read = () => ({
      h: Math.round(el.getBoundingClientRect().height),
      token: el.style.getPropertyValue('--mc-skeleton-h').trim(),
    });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 120));
    el.setAttribute('size', 'lg');
    await settle();
    const lg = read();
    el.setAttribute('size', '24');
    await settle();
    return { lg, back: read() };
  });
  check(
    'size 数字 ↔ 档位：切回 size="lg" → 44px 且 --mc-skeleton-h 内联令牌被移除；再写 size="24" → 24px 且令牌写回',
    numericSwitch.lg.h === 44 &&
      numericSwitch.lg.token === '' &&
      numericSwitch.back.h === 24 &&
      numericSwitch.back.token === '24px',
    JSON.stringify(numericSwitch),
  );

  await page.evaluate(() => document.getElementById('skeleton-probe')?.remove());

  /* 回归：flex 行里骨架屏不能被「贪婪兄弟」挤扁 —— 宽高是属性给的，不是 flex 算的 */
  const flexProbe = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const host = document.createElement('div');
        host.id = 'skeleton-flex-probe';
        host.style.cssText = 'display:flex;width:300px;position:fixed;left:0;top:0;background:#fff';
        host.innerHTML =
          '<mc-skeleton id="sk-flex-circle" variant="circle" width="40px" height="40px"></mc-skeleton>' +
          '<div style="flex:1"></div>';
        document.body.append(host);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const rect = document.getElementById('sk-flex-circle').getBoundingClientRect();
            resolve({ w: Math.round(rect.width), h: Math.round(rect.height) });
          }),
        );
      }),
  );
  check(
    'flex 行里宽度不被挤扁：circle 仍是 40×40',
    flexProbe.w === 40 && flexProbe.h === 40,
    JSON.stringify(flexProbe),
  );
  await page.evaluate(() => document.getElementById('skeleton-flex-probe')?.remove());

  check('骨架屏文档页没有 404 / 运行时报错', failed.length === 0, failed.join('\n') || '无');

  page.off('response', onResponse);
  page.off('pageerror', onError);
}
