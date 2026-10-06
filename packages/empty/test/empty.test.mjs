/**
 * mc-empty · 空态：内置图形（图标集里的 empty，靠 .mc-icon-empty 的 mask 零请求渲染）、
 * 默认文案「暂无数据」与 description ↔ 默认插槽的优先级、size 三档（图形与字号一起）、
 * footer 插槽（有内容才占位，运行时增删跟着变）、令牌与 ::part、
 * 不写 role / aria-*、组件自己不含任何交互元素
 */

export default async function run({ page, visit, check }) {
  const empty = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?empty=1#/packages/empty/page.html');
    await page
      .waitForFunction(
        () => {
          const all = window.__deepAll('mc-empty');
          return all.length >= 6 && all.every((e) => !!e.shadowRoot);
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    /** 令牌解析：组件内部的颜色都是 rgb(var(--mc-…))，期望值要按当前主题算 */
    const tokens = await page.evaluate(() => {
      const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const rgb = (name) => `rgb(${read(name).split(/\s+/).join(', ')})`;
      return {
        fgSubtle: rgb('--mc-color-fg-subtle'),
        fgMuted: rgb('--mc-color-fg-muted'),
        primary: rgb('--mc-color-primary'),
      };
    });

    /** 全局：实例数、升级、四个 part、图形真的画出来了（mask 不是 none）、没有语义与交互 */
    const overview = await page.evaluate(() => {
      const all = window.__deepAll('mc-empty');
      const read = (el) => {
        const root = el.shadowRoot;
        const image = root.querySelector('.mc-image');
        const cs = getComputedStyle(image);
        const mask = cs.maskImage || cs.webkitMaskImage || 'none';
        return {
          upgraded: !!root,
          parts: ['base', 'image', 'description', 'footer'].every(
            (p) => !!root.querySelector(`[part="${p}"]`),
          ),
          slots: [...root.querySelectorAll('slot')].map((s) => s.name || '（默认）').join('+'),
          role: el.getAttribute('role'),
          aria: [...el.attributes].filter((a) => a.name.startsWith('aria-')).length,
          innerInteractive: root.querySelectorAll('a, button, input, select, textarea, [tabindex]')
            .length,
          imageClass: image.className,
          imageMask: mask !== 'none',
        };
      };
      const rows = all.map(read);
      return {
        total: all.length,
        upgraded: rows.every((r) => r.upgraded),
        parts: rows.every((r) => r.parts),
        slots: [...new Set(rows.map((r) => r.slots))],
        roles: [...new Set(rows.map((r) => r.role))],
        aria: rows.reduce((n, r) => n + r.aria, 0),
        innerInteractive: rows.reduce((n, r) => n + r.innerInteractive, 0),
        imageClass: [...new Set(rows.map((r) => r.imageClass))],
        imageMasks: [...new Set(rows.map((r) => r.imageMask))],
      };
    });

    /** 探针：文案优先级、三档尺寸、footer 占位、令牌覆盖 */
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'empty-probe';
      host.style.cssText =
        'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
        'display:flex;flex-direction:column;gap:8px;width:320px';
      host.innerHTML =
        '<mc-empty id="e-default"></mc-empty>' +
        '<mc-empty id="e-desc" description="没有匹配的记录"></mc-empty>' +
        '<mc-empty id="e-slot" description="属性文案">插槽文案</mc-empty>' +
        '<mc-empty id="e-sm" size="sm"></mc-empty>' +
        '<mc-empty id="e-md"></mc-empty>' +
        '<mc-empty id="e-lg" size="lg"></mc-empty>' +
        '<mc-empty id="e-no-footer"></mc-empty>' +
        '<mc-empty id="e-footer"><span slot="footer">重试</span></mc-empty>' +
        '<mc-empty id="e-token" style="--mc-empty-image-color: var(--mc-color-primary)"></mc-empty>';
      document.body.append(host);
    });
    await page
      .waitForFunction(
        () =>
          ['e-default', 'e-desc', 'e-slot', 'e-sm', 'e-md', 'e-lg', 'e-token'].every(
            (id) => !!document.getElementById(id)?.shadowRoot,
          ),
        { timeout: 5000 },
      )
      .catch(() => {});

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const root = (id) => el(id).shadowRoot;
      const size = (id) => {
        const image = root(id).querySelector('.mc-image');
        const desc = root(id).querySelector('.mc-description');
        return {
          image: Math.round(image.getBoundingClientRect().width),
          fontSize: getComputedStyle(desc).fontSize,
        };
      };
      /** 默认插槽的兜底文本与分到节点要分开读：slot.textContent 只看 shadow 里那份兜底 */
      const text = (id) => {
        const slot = root(id).querySelector('.mc-description slot');
        return {
          assigned: [...slot.assignedNodes()]
            .map((n) => n.textContent ?? '')
            .join('')
            .trim(),
          fallback: slot.textContent.trim(),
        };
      };
      const footer = (id) => ({
        host: el(id).hasAttribute('data-has-footer'),
        display: getComputedStyle(root(id).querySelector('.mc-footer')).display,
      });
      return {
        defaultText: text('e-default'),
        attrText: text('e-desc'),
        slotText: text('e-slot'),
        sizes: { sm: size('e-sm'), md: size('e-md'), lg: size('e-lg') },
        color: {
          image: getComputedStyle(root('e-default').querySelector('.mc-image')).color,
          description: getComputedStyle(root('e-default').querySelector('.mc-description')).color,
          tokenImage: getComputedStyle(root('e-token').querySelector('.mc-image')).color,
        },
        footer: { none: footer('e-no-footer'), has: footer('e-footer') },
      };
    });

    /** footer 的运行时增减：加了才占位（slotchange 一条路，不看子树） */
    const footerRuntime = await page.evaluate(async () => {
      const el = document.getElementById('e-no-footer');
      const read = () => ({
        host: el.hasAttribute('data-has-footer'),
        display: getComputedStyle(el.shadowRoot.querySelector('.mc-footer')).display,
      });
      const before = read();
      const extra = document.createElement('span');
      extra.setAttribute('slot', 'footer');
      extra.textContent = '去创建';
      el.append(extra);
      await new Promise((r) => setTimeout(r, 50));
      const after = read();
      extra.remove();
      await new Promise((r) => setTimeout(r, 50));
      return { before, after, restored: read() };
    });

    /** 内部样式：part 演示里四条 ::part() 规则真的落在内部节点上 */
    const partDemo = await page.evaluate(() => {
      const demo = window.__deepAll('demo-empty-part')[0];
      const el = window.__deepAll('mc-empty', demo.shadowRoot)[0];
      const root = el.shadowRoot;
      const base = getComputedStyle(root.querySelector('[part="base"]'));
      const image = getComputedStyle(root.querySelector('[part="image"]'));
      return {
        borderStyle: base.borderTopStyle,
        borderWidth: base.borderTopWidth,
        imageColor: image.color,
        descriptionWeight: getComputedStyle(root.querySelector('[part="description"]')).fontWeight,
      };
    });

    await page.evaluate(() => document.getElementById('empty-probe')?.remove());

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { tokens, overview, probe, footerRuntime, partDemo, failed };
  })();

  check(
    'mc-empty 注册并渲染：四个 part、默认 + footer 两个插槽、不写 role / aria-*、组件里没有交互元素',
    empty.overview.upgraded &&
      empty.overview.total >= 6 &&
      empty.overview.parts &&
      JSON.stringify(empty.overview.slots) === JSON.stringify(['（默认）+footer']) &&
      JSON.stringify(empty.overview.roles) === JSON.stringify([null]) &&
      empty.overview.aria === 0 &&
      empty.overview.innerInteractive === 0 &&
      empty.failed.length === 0,
    `${empty.overview.total} 个 · ${JSON.stringify(empty.overview)} · ${empty.failed.join(' | ') || '无 404 / 报错'}`,
  );

  check(
    '内置图形画得出来：每个实例的 .mc-image 都带 mc-icon-empty，mask 不是 none（图标集那条类是活的）',
    JSON.stringify(empty.overview.imageClass) === JSON.stringify(['mc-image mc-icon-empty']) &&
      JSON.stringify(empty.overview.imageMasks) === JSON.stringify([true]),
    JSON.stringify({ class: empty.overview.imageClass, mask: empty.overview.imageMasks }),
  );

  check(
    '文案：默认是「暂无数据」；description 属性换掉；默认插槽有内容时整块顶掉属性文案',
    empty.probe.defaultText.assigned === '' &&
      empty.probe.defaultText.fallback === '暂无数据' &&
      empty.probe.attrText.assigned === '' &&
      empty.probe.attrText.fallback === '没有匹配的记录' &&
      empty.probe.slotText.assigned === '插槽文案' &&
      empty.probe.slotText.fallback === '属性文案',
    JSON.stringify({
      default: empty.probe.defaultText,
      attr: empty.probe.attrText,
      slot: empty.probe.slotText,
    }),
  );

  check(
    'size 三档：图形 28 / 40 / 56 px（1.75 / 2.5 / 3.5em），文案字号 12 / 14 / 16 px 一起跟',
    JSON.stringify(empty.probe.sizes) ===
      JSON.stringify({
        sm: { image: 28, fontSize: '12px' },
        md: { image: 40, fontSize: '14px' },
        lg: { image: 56, fontSize: '16px' },
      }),
    JSON.stringify(empty.probe.sizes),
  );

  check(
    '颜色默认走令牌：图形 = fg-subtle、文案 = fg-muted；宿主 style 覆盖 --mc-empty-image-color 立刻生效',
    empty.probe.color.image === empty.tokens.fgSubtle &&
      empty.probe.color.description === empty.tokens.fgMuted &&
      empty.probe.color.tokenImage === empty.tokens.primary,
    JSON.stringify({ ...empty.probe.color, tokens: empty.tokens }),
  );

  check(
    '操作区：footer 插槽没内容时 .mc-footer 是 display:none 且宿主没有 data-has-footer；有内容才占位',
    empty.probe.footer.none.host === false &&
      empty.probe.footer.none.display === 'none' &&
      empty.probe.footer.has.host === true &&
      empty.probe.footer.has.display === 'block',
    JSON.stringify(empty.probe.footer),
  );

  check(
    'footer 的运行时增减跟着 slotchange 走：加上出现、移除复原（不是只在挂载那一刻判一次）',
    empty.footerRuntime.before.host === false &&
      empty.footerRuntime.before.display === 'none' &&
      empty.footerRuntime.after.host === true &&
      empty.footerRuntime.after.display === 'block' &&
      empty.footerRuntime.restored.host === false &&
      empty.footerRuntime.restored.display === 'none',
    JSON.stringify(empty.footerRuntime),
  );

  check(
    '::part() 四条规则都落在内部节点上：base 变虚线、image 换主色、description 加粗',
    empty.partDemo.borderStyle === 'dashed' &&
      empty.partDemo.borderWidth === '1px' &&
      empty.partDemo.imageColor === empty.tokens.primary &&
      empty.partDemo.descriptionWeight === '500',
    JSON.stringify(empty.partDemo),
  );
}
