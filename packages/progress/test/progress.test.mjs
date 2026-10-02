/**
 * mc-progress · 进度条：确定态的宽度比例、不写 role / aria-*、
 * 不确定态内联宽度被清掉（否则会盖住 CSS 动画，P15）、
 * 语义色 == 令牌、sm/md 轨道高与宿主令牌覆盖、value / max 的 property 当次生效、::part(bar) 定制
 */

export default async function run({ page, visit, check }) {
  const progress = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?progress=1#/packages/progress/page.html');
    await page
      .waitForFunction(
        () => {
          const all = window.__deepAll('mc-progress');
          return all.length >= 15 && all.every((p) => !!p.shadowRoot);
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
        surfaceSunken: rgb('--mc-color-surface-sunken'),
        durationSlow: read('--mc-duration-slow'),
      };
    });

    /** 确定态：内联宽度 + 真实渲染比例都跟 value/max 对上（过渡走完再读） */
    const readRatios = () =>
      page.evaluate(() => {
        const read = (demo, index) => {
          const box = window.__deepAll(demo)[0].shadowRoot;
          const el = window.__deepAll('mc-progress', box)[index];
          const fill = el.shadowRoot.querySelector('.mc-fill');
          const trackWidth = el.getBoundingClientRect().width;
          const fillWidth = fill.getBoundingClientRect().width;
          return {
            inline: fill.style.width,
            ratio: trackWidth > 0 ? Math.round((fillWidth / trackWidth) * 1000) / 1000 : null,
            valuenow: el.getAttribute('aria-valuenow'),
            valuemax: el.getAttribute('aria-valuemax'),
            valuemin: el.getAttribute('aria-valuemin'),
            role: el.getAttribute('role'),
            slots: el.shadowRoot.querySelectorAll('slot').length,
            parts: [...el.shadowRoot.querySelectorAll('[part]')].map((n) => n.getAttribute('part')),
          };
        };
        return {
          zero: read('demo-progress-basic', 0),
          forty: read('demo-progress-basic', 1),
          full: read('demo-progress-basic', 2),
          max: read('demo-progress-max', 1),
          over: read('demo-progress-max', 2),
        };
      });

    /** 宽度是过渡值：等它真的到位再读（固定 sleep 在并行满载时会读到中间值） */
    await page
      .waitForFunction(
        () => {
          const ratio = (demo, index) => {
            const box = window.__deepAll(demo)[0]?.shadowRoot;
            const el = box ? window.__deepAll('mc-progress', box)[index] : null;
            if (!el?.shadowRoot) return null;
            const track = el.getBoundingClientRect().width;
            return track > 0
              ? el.shadowRoot.querySelector('.mc-fill').getBoundingClientRect().width / track
              : null;
          };
          const near = (value, want) => value !== null && Math.abs(value - want) < 0.02;
          return (
            near(ratio('demo-progress-basic', 0), 0) &&
            near(ratio('demo-progress-basic', 1), 0.4) &&
            near(ratio('demo-progress-basic', 2), 1) &&
            near(ratio('demo-progress-max', 1), 0.75) &&
            near(ratio('demo-progress-max', 2), 1)
          );
        },
        { timeout: 4000 },
      )
      .catch(() => {});

    const ratios = await readRatios();

    /** 不确定态：不写 aria-valuenow / aria-busy，内联宽度是空的（CSS 动画才有宽度） */
    const indeterminate = await page.evaluate(() => {
      const box = window.__deepAll('demo-progress-indeterminate')[0].shadowRoot;
      return window.__deepAll('mc-progress', box).map((el) => {
        const fill = el.shadowRoot.querySelector('.mc-fill');
        const cs = getComputedStyle(fill);
        return {
          indeterminate: el.hasAttribute('indeterminate'),
          hasValueNow: el.hasAttribute('aria-valuenow'),
          busy: el.getAttribute('aria-busy'),
          role: el.getAttribute('role'),
          inline: fill.style.width,
          cssWidth: cs.width,
          animationName: cs.animationName,
          animationDuration: cs.animationDuration,
        };
      });
    });

    /** 语义色（demo-progress-colors）：填充条底色就是各自的令牌 */
    const colors = await page.evaluate(() => {
      const box = window.__deepAll('demo-progress-colors')[0].shadowRoot;
      return window.__deepAll('mc-progress', box).map((el) => ({
        color: el.getAttribute('color') ?? 'primary',
        fill: getComputedStyle(el.shadowRoot.querySelector('.mc-fill')).backgroundColor,
        track: getComputedStyle(el).backgroundColor,
      }));
    });

    /** 尺寸（demo-progress-sizes）：轨道高两档 */
    const sizes = await page.evaluate(() => {
      const box = window.__deepAll('demo-progress-sizes')[0].shadowRoot;
      return window.__deepAll('mc-progress', box).map((el) => ({
        size: el.getAttribute('size') ?? 'md',
        height: Math.round(el.getBoundingClientRect().height),
      }));
    });

    /** 探针：宿主令牌覆盖、property 访问器、::part(bar) 的对照 */
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'progress-probe';
      host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:320px;background:#fff';
      host.innerHTML =
        '<mc-progress id="p-override" value="60" style="--mc-progress-h: 24px"></mc-progress>' +
        '<mc-progress id="p-prop" value="25" max="100"></mc-progress>';
      document.body.append(host);
    });
    await page
      .waitForFunction(
        () =>
          ['p-override', 'p-prop'].every((id) => !!document.getElementById(id)?.shadowRoot),
        { timeout: 5000 },
      )
      .catch(() => {});

    /* property 的「当次生效」：setter 写完立刻读，中间不 await（P4 那一拍不适用于属性本身） */
    const immediate = await page.evaluate(() => {
      const el = document.getElementById('p-prop');
      const fill = el.shadowRoot.querySelector('.mc-fill');
      const before = { value: el.value, max: el.max, inline: fill.style.width };

      el.value = 50;
      const afterValue = { value: el.value, inline: fill.style.width };

      el.max = 200;
      const afterMax = { max: el.max, inline: fill.style.width };

      el.value = null;
      const afterClear = { value: el.value, inline: fill.style.width };

      return { before, afterValue, afterMax, afterClear };
    });

    const geometry = await page.evaluate(() => {
      const el = document.getElementById('p-override');
      return { height: Math.round(el.getBoundingClientRect().height) };
    });

    /** ::part(bar)：外面改得动填充条的底色，没开的作对照 */
    const parts = await page.evaluate(() => {
      const box = window.__deepAll('demo-progress-part')[0].shadowRoot;
      const [custom, plain] = window.__deepAll('mc-progress', box);
      const read = (el) => {
        const cs = getComputedStyle(el.shadowRoot.querySelector('.mc-fill'));
        return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius };
      };
      return { custom: read(custom), plain: read(plain) };
    });

    await page.evaluate(() => document.getElementById('progress-probe')?.remove());

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return {
      tokens,
      ratios,
      indeterminate,
      colors,
      sizes,
      immediate,
      geometry,
      parts,
      failed,
    };
  })();

  check(
    'mc-progress 注册并渲染：不写 role / aria-*、内部只有一个 part="bar"、没有插槽',
    progress.ratios.forty.role === null &&
      progress.ratios.forty.valuemin === null &&
      progress.ratios.forty.valuemax === null &&
      progress.ratios.forty.valuenow === null &&
      progress.ratios.forty.slots === 0 &&
      JSON.stringify(progress.ratios.forty.parts) === JSON.stringify(['bar']) &&
      progress.failed.length === 0,
    JSON.stringify({ ...progress.ratios.forty, failed: progress.failed }),
  );

  check(
    '确定态的宽度 = value / max：0% / 40% / 100%、150/200 = 75%、超上限夹到 100%（内联宽度与真实渲染都对上）',
    progress.ratios.zero.inline === '0%' &&
      progress.ratios.forty.inline === '40%' &&
      progress.ratios.full.inline === '100%' &&
      progress.ratios.max.inline === '75%' &&
      progress.ratios.over.inline === '100%' &&
      progress.ratios.zero.ratio === 0 &&
      Math.abs(progress.ratios.forty.ratio - 0.4) <= 0.02 &&
      Math.abs(progress.ratios.full.ratio - 1) <= 0.02 &&
      Math.abs(progress.ratios.max.ratio - 0.75) <= 0.02 &&
      Math.abs(progress.ratios.over.ratio - 1) <= 0.02,
    JSON.stringify(progress.ratios),
  );

  check(
    '不确定态：不写 aria-valuenow / aria-busy，内联宽度被清掉（否则会盖住 :host([indeterminate]) 的 CSS，P15）',
    progress.indeterminate.length === 3 &&
      progress.indeterminate.every((p) => p.indeterminate && !p.hasValueNow && p.busy === null) &&
      progress.indeterminate.every((p) => p.role === null) &&
      progress.indeterminate.every((p) => p.inline === '') &&
      progress.indeterminate.every((p) => p.animationName === 'mc-progress-slide') &&
      progress.indeterminate.every((p) => p.cssWidth !== '0px'),
    JSON.stringify(progress.indeterminate),
  );

  check(
    'color 五色：填充条底色就是各自的令牌，轨道底色是 surface-sunken',
    progress.colors.length === 5 &&
      progress.colors[0].fill === progress.tokens.primary &&
      progress.colors[1].fill === progress.tokens.info &&
      progress.colors[2].fill === progress.tokens.success &&
      progress.colors[3].fill === progress.tokens.warning &&
      progress.colors[4].fill === progress.tokens.danger &&
      progress.colors.every((c) => c.track === progress.tokens.surfaceSunken),
    JSON.stringify(progress.colors),
  );

  check(
    'size 两档轨道高 = 4 / 8px；尺寸走 --mc-progress-h（宿主覆盖 24px 就变 24）',
    JSON.stringify(progress.sizes) ===
      JSON.stringify([
        { size: 'sm', height: 4 },
        { size: 'md', height: 8 },
        { size: 'sm', height: 4 },
        { size: 'md', height: 8 },
      ]) && progress.geometry.height === 24,
    JSON.stringify({ sizes: progress.sizes, override: progress.geometry }),
  );

  check(
    'value / max 的 property 当次生效（el.value = 50 立刻 50%）；::part(bar) 改得动填充条',
    progress.immediate.before.value === 25 &&
      progress.immediate.before.inline === '25%' &&
      progress.immediate.afterValue.value === 50 &&
      progress.immediate.afterValue.inline === '50%' &&
      progress.immediate.afterMax.max === 200 &&
      progress.immediate.afterMax.inline === '25%' &&
      progress.immediate.afterClear.value === null &&
      progress.immediate.afterClear.inline === '0%' &&
      progress.parts.custom.bg === progress.tokens.danger &&
      progress.parts.custom.radius === '0px' &&
      progress.parts.plain.bg === progress.tokens.primary,
    JSON.stringify({ immediate: progress.immediate, parts: progress.parts }),
  );
}
