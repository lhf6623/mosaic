/**
 * mc-space · 布局容器：horizontal / vertical 方向、gap 三档 / 数字（px）、justify 六档、
 * align 五档、reverse-order 反向、wrap-items 换行、block 撑满、宿主 inline style 覆盖（packages/space）。
 *
 * 组件没有方法 / 事件可点，所以断言全部落在「宿主的计算样式 + 子项几何」上。
 */

export default async function run({ page, visit, check }) {
  await visit(page, '/index.html?space=1#/packages/space/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-space'), { timeout: 8000 })
    .catch(() => {});

  /* ------------------------------------------------------------------ *
   * 现搭现拆探针：全部几何在一块固定定位的白底板上量，收尾删掉。
   * 组件样式待在 shadow 里，但 `:host` 规则照样作用于 document 里的实例。
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.id = 'space-probe';
    probe.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;width:640px;' +
      'font-size:16px;line-height:1.5';
    probe.innerHTML = `
      <mc-space id="p-default">
        <span style="width:40px;height:20px"></span>
        <span style="width:40px;height:20px"></span>
        <span style="width:40px;height:20px"></span>
      </mc-space>

      <mc-space id="p-gap-sm" gap="sm"><span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span></mc-space>
      <mc-space id="p-gap-md"><span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span></mc-space>
      <mc-space id="p-gap-lg" gap="lg"><span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span></mc-space>
      <mc-space id="p-gap-num" gap="10"><span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span></mc-space>
      <mc-space id="p-gap-unit" gap="12px"><span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span></mc-space>

      <mc-space id="p-vertical" direction="vertical">
        <span style="height:20px;min-width:10px"></span>
        <span style="height:30px;min-width:20px"></span>
      </mc-space>

      <mc-space id="p-align-default" style="height:80px">
        <span style="width:20px;height:40px"></span><span style="width:20px;height:20px"></span>
      </mc-space>
      <mc-space id="p-align-start" align="start" style="height:80px">
        <span style="width:20px;height:40px"></span><span style="width:20px;height:20px"></span>
      </mc-space>
      <mc-space id="p-align-center" align="center" style="height:80px">
        <span style="width:20px;height:40px"></span><span style="width:20px;height:20px"></span>
      </mc-space>
      <mc-space id="p-align-end" align="end" style="height:80px">
        <span style="width:20px;height:40px"></span><span style="width:20px;height:20px"></span>
      </mc-space>
      <mc-space id="p-align-stretch" align="stretch" style="height:100px">
        <span style="min-width:20px"></span><span style="min-width:20px"></span>
      </mc-space>
      <mc-space id="p-align-baseline" align="baseline">
        <span style="font-size:20px;line-height:1.2">Ag</span>
        <span style="font-size:40px;line-height:1.2">Ag</span>
      </mc-space>
      <mc-space id="p-align-v-start" direction="vertical" align="start">
        <span style="height:10px">a</span><span style="height:10px">b</span>
      </mc-space>

      <div id="p-justify-parent" style="width:300px">
        <mc-space id="p-justify-start" block justify="start"><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span></mc-space>
        <mc-space id="p-justify-center" block justify="center"><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span></mc-space>
        <mc-space id="p-justify-end" block justify="end"><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span></mc-space>
        <mc-space id="p-justify-between" block justify="between"><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span></mc-space>
        <mc-space id="p-justify-around" block justify="around"><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span></mc-space>
        <mc-space id="p-justify-evenly" block justify="evenly"><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span><span style="width:30px;height:10px"></span></mc-space>
      </div>

      <mc-space id="p-reverse" reverse-order>
        <span style="width:20px;height:10px"></span>
        <span style="width:20px;height:10px"></span>
        <span style="width:20px;height:10px"></span>
      </mc-space>
      <mc-space id="p-reverse-v" direction="vertical" reverse-order>
        <span style="height:10px;min-width:20px"></span>
        <span style="height:10px;min-width:20px"></span>
        <span style="height:10px;min-width:20px"></span>
      </mc-space>

      <mc-space id="p-nowrap" style="width:100px">
        <span style="width:60px;height:20px"></span><span style="width:60px;height:20px"></span>
      </mc-space>
      <mc-space id="p-wrap" wrap-items style="width:100px">
        <span style="width:60px;height:20px"></span><span style="width:60px;height:20px"></span>
      </mc-space>

      <div id="p-parent" style="width:300px">
        <mc-space id="p-inline"><span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span></mc-space>
        <mc-space id="p-block" block><span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span></mc-space>
      </div>

      <mc-space id="p-override" gap="lg" style="gap:10px">
        <span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span>
      </mc-space>

      <mc-space id="p-runtime">
        <span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span>
      </mc-space>

      <div id="p-tok-sm" style="position:fixed;left:-9999px;display:inline-flex;gap:var(--mc-space-2)"></div>
      <div id="p-tok-md" style="position:fixed;left:-9999px;display:inline-flex;gap:var(--mc-space-4)"></div>
      <div id="p-tok-lg" style="position:fixed;left:-9999px;display:inline-flex;gap:var(--mc-space-6)"></div>`;
    document.body.append(probe);
  });

  /* 定义就绪后 append 是同步升级的；再等一拍，防 ofa 的 shadow 模板挂载慢于 connectedCallback */
  await page
    .waitForFunction(
      () => {
        const el = document.getElementById('p-default');
        return !!el && (getComputedStyle(el).display.includes('flex') || !!el.shadowRoot);
      },
      { timeout: 3000 },
    )
    .catch(() => {});

  const pxOf = (value) => parseFloat(value);
  const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

  try {
    const m = await page.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      const cs = (el) => getComputedStyle(el);
      const rect = (el) => el.getBoundingClientRect();
      const round = (n) => Math.round(n * 10) / 10;
      const px = (v) => parseFloat(v) || 0;
      const kids = (el) => [...el.children];

      /** 内容盒（去掉边框 / 内边距）：「贴顶 / 贴底 / 撑满」都相对它量 */
      const contentBox = (el) => {
        const r = rect(el);
        const s = cs(el);
        return {
          top: r.top + px(s.borderTopWidth) + px(s.paddingTop),
          left: r.left + px(s.borderLeftWidth) + px(s.paddingLeft),
          width:
            r.width - px(s.borderLeftWidth) - px(s.borderRightWidth) - px(s.paddingLeft) - px(s.paddingRight),
          height:
            r.height - px(s.borderTopWidth) - px(s.borderBottomWidth) - px(s.paddingTop) - px(s.paddingBottom),
        };
      };
      const hostStyle = (el) => {
        const s = cs(el);
        const r = rect(el);
        return {
          display: s.display,
          flexDirection: s.flexDirection,
          alignItems: s.alignItems,
          justifyContent: s.justifyContent,
          flexWrap: s.flexWrap,
          gap: s.gap,
          gapVar: s.getPropertyValue('--mc-space-gap').trim(),
          width: round(r.width),
          height: round(r.height),
        };
      };
      const itemsOf = (el) =>
        kids(el).map((kid) => {
          const r = rect(kid);
          return {
            top: round(r.top),
            bottom: round(r.bottom),
            left: round(r.left),
            right: round(r.right),
            width: round(r.width),
            height: round(r.height),
          };
        });
      /** 相对内容盒的偏移：top = 距内容区顶，bottom = 距内容区底，left = 距内容区左 */
      const offsets = (el) => {
        const c = contentBox(el);
        return {
          box: { width: round(c.width), height: round(c.height) },
          items: kids(el).map((kid) => {
            const r = rect(kid);
            return {
              top: round(r.top - c.top),
              bottom: round(c.top + c.height - r.bottom),
              left: round(r.left - c.left),
              width: round(r.width),
              height: round(r.height),
            };
          }),
        };
      };
      /** 相邻子项的横向间隔（行内 flex，直接用盒子边界量，不依赖 gap 的序列化） */
      const gapPx = (el) => {
        const rs = kids(el).map(rect);
        return rs.slice(1).map((r, i) => round(r.left - rs[i].right));
      };
      const tokenGap = (id) => cs($(id)).gap;

      const Ctor = customElements.get('mc-space');
      const def = $('p-default');
      return {
        registered: !!Ctor,
        upgraded: !!Ctor && def instanceof Ctor,
        shadow: !!def?.shadowRoot,
        parts: def?.shadowRoot
          ? [...def.shadowRoot.querySelectorAll('[part]')].map((n) => n.getAttribute('part'))
          : [],
        probeWidth: round(contentBox($('space-probe')).width),
        default: { host: hostStyle(def), items: itemsOf(def), gaps: gapPx(def) },
        gaps: {
          sm: { host: hostStyle($('p-gap-sm')), geom: gapPx($('p-gap-sm')) },
          md: { host: hostStyle($('p-gap-md')), geom: gapPx($('p-gap-md')) },
          lg: { host: hostStyle($('p-gap-lg')), geom: gapPx($('p-gap-lg')) },
          num: { host: hostStyle($('p-gap-num')), geom: gapPx($('p-gap-num')) },
          unit: { host: hostStyle($('p-gap-unit')), geom: gapPx($('p-gap-unit')) },
        },
        tokens: { sm: tokenGap('p-tok-sm'), md: tokenGap('p-tok-md'), lg: tokenGap('p-tok-lg') },
        vertical: { host: hostStyle($('p-vertical')), offsets: offsets($('p-vertical')) },
        align: {
          def: { host: hostStyle($('p-align-default')), offsets: offsets($('p-align-default')) },
          start: { host: hostStyle($('p-align-start')), offsets: offsets($('p-align-start')) },
          center: { host: hostStyle($('p-align-center')), offsets: offsets($('p-align-center')) },
          end: { host: hostStyle($('p-align-end')), offsets: offsets($('p-align-end')) },
          baseline: { host: hostStyle($('p-align-baseline')), items: itemsOf($('p-align-baseline')) },
          stretch: { host: hostStyle($('p-align-stretch')), offsets: offsets($('p-align-stretch')) },
          verticalStart: cs($('p-align-v-start')).alignItems,
        },
        justify: {
          parentWidth: round(contentBox($('p-justify-parent')).width),
          start: { host: hostStyle($('p-justify-start')), offsets: offsets($('p-justify-start')) },
          center: { host: hostStyle($('p-justify-center')), offsets: offsets($('p-justify-center')) },
          end: { host: hostStyle($('p-justify-end')), offsets: offsets($('p-justify-end')) },
          between: { host: hostStyle($('p-justify-between')), offsets: offsets($('p-justify-between')) },
          around: { host: hostStyle($('p-justify-around')), offsets: offsets($('p-justify-around')) },
          evenly: { host: hostStyle($('p-justify-evenly')), offsets: offsets($('p-justify-evenly')) },
        },
        reverse: {
          row: { host: hostStyle($('p-reverse')), items: itemsOf($('p-reverse')) },
          column: { host: hostStyle($('p-reverse-v')), items: itemsOf($('p-reverse-v')) },
        },
        wrap: {
          nowrap: { host: hostStyle($('p-nowrap')), items: itemsOf($('p-nowrap')) },
          wrap: { host: hostStyle($('p-wrap')), items: itemsOf($('p-wrap')) },
        },
        block: {
          inline: hostStyle($('p-inline')),
          block: hostStyle($('p-block')),
          parentWidth: round(contentBox($('p-parent')).width),
        },
        override: { host: hostStyle($('p-override')), geom: gapPx($('p-override')) },
      };
    });

    /** 「垂直居中」的几何判据：每个子项距内容区顶 =（容器高 - 子项高）/ 2 */
    const centered = (probe) =>
      probe.offsets.items.length === 2 &&
      probe.offsets.items.every(
        (item) => Math.abs(item.top - (probe.offsets.box.height - item.height) / 2) <= 1.5,
      );
    const atTop = (probe) => probe.offsets.items.every((item) => Math.abs(item.top) <= 1.5);
    const atBottom = (probe) => probe.offsets.items.every((item) => Math.abs(item.bottom) <= 1.5);
    /** 主轴两端留白：第一个子项距左、最后一个子项距右 */
    const firstLeft = (probe) => probe.offsets.items[0].left;
    const lastRight = (probe) => {
      const last = probe.offsets.items.at(-1);
      return probe.offsets.box.width - (last.left + last.width);
    };

    check(
      'mc-space 注册并升级：宿主默认 display:inline-flex，默认插槽中的子项正常渲染',
      m.registered &&
        m.upgraded &&
        m.default.host.display === 'inline-flex' &&
        m.default.items.length === 3 &&
        m.default.items.every((item) => near(item.width, 40) && near(item.height, 20)),
      JSON.stringify({
        registered: m.registered,
        upgraded: m.upgraded,
        display: m.default.host.display,
        shadowRoot: m.shadow,
        items: m.default.items.map((item) => [item.width, item.height]),
      }),
    );

    check(
      '默认 horizontal + md gap：三个子项同一行，项间距 = --mc-space-4 解析出的像素（16px）',
      m.default.host.flexDirection === 'row' &&
        m.default.host.gap === m.tokens.md &&
        pxOf(m.tokens.md) === 16 &&
        m.default.items.every((item) => near(item.top, m.default.items[0].top)) &&
        m.default.gaps.length === 2 &&
        m.default.gaps.every((gap) => near(gap, 16)),
      JSON.stringify({
        flexDirection: m.default.host.flexDirection,
        gap: m.default.host.gap,
        tokenMd: m.tokens.md,
        tops: m.default.items.map((item) => item.top),
        gaps: m.default.gaps,
      }),
    );

    check(
      'gap 三档 = --mc-space-2 / --mc-space-4 / --mc-space-6（8 / 16 / 24px），宿主 gap 与实际间距一致',
      m.gaps.sm.host.gap === m.tokens.sm &&
        m.gaps.md.host.gap === m.tokens.md &&
        m.gaps.lg.host.gap === m.tokens.lg &&
        pxOf(m.tokens.sm) === 8 &&
        pxOf(m.tokens.md) === 16 &&
        pxOf(m.tokens.lg) === 24 &&
        near(m.gaps.sm.geom[0], 8) &&
        near(m.gaps.md.geom[0], 16) &&
        near(m.gaps.lg.geom[0], 24),
      JSON.stringify({
        tokens: m.tokens,
        hostGap: { sm: m.gaps.sm.host.gap, md: m.gaps.md.host.gap, lg: m.gaps.lg.host.gap },
        geom: { sm: m.gaps.sm.geom, md: m.gaps.md.geom, lg: m.gaps.lg.geom },
      }),
    );

    check(
      'gap 只收数字（px）：10 → 10px；12px 带单位按非法值落回 md，--mc-space-gap 同步；三档不写内部变量',
      m.gaps.num.host.gap === '10px' &&
        m.gaps.num.host.gapVar === '10px' &&
        near(m.gaps.num.geom[0], 10) &&
        m.gaps.unit.host.gap === m.tokens.md &&
        m.gaps.unit.host.gapVar === '' &&
        near(m.gaps.unit.geom[0], 16) &&
        m.gaps.sm.host.gapVar === '' &&
        m.gaps.md.host.gapVar === '' &&
        m.gaps.lg.host.gapVar === '',
      JSON.stringify({
        num: { gap: m.gaps.num.host.gap, var: m.gaps.num.host.gapVar, geom: m.gaps.num.geom },
        unitRejected: { gap: m.gaps.unit.host.gap, var: m.gaps.unit.host.gapVar, geom: m.gaps.unit.geom },
        tokenVars: [m.gaps.sm.host.gapVar, m.gaps.md.host.gapVar, m.gaps.lg.host.gapVar],
      }),
    );

    check(
      'direction="vertical"：子项纵向排列；不写 align 时默认 align-items:stretch，子项宽度拉齐',
      m.vertical.host.flexDirection === 'column' &&
        m.vertical.host.alignItems === 'stretch' &&
        m.vertical.offsets.items.length === 2 &&
        near(m.vertical.offsets.items[0].left, m.vertical.offsets.items[1].left) &&
        m.vertical.offsets.items[1].top > m.vertical.offsets.items[0].top + 5 &&
        near(m.vertical.offsets.items[0].width, m.vertical.offsets.items[1].width) &&
        m.vertical.offsets.items[0].width > 5,
      JSON.stringify({
        flexDirection: m.vertical.host.flexDirection,
        alignItems: m.vertical.host.alignItems,
        items: m.vertical.offsets.items,
      }),
    );

    check(
      'align 不写（横向）：默认 align-items:center，不同高度的两个盒子都垂直居中',
      m.align.def.host.alignItems === 'center' && centered(m.align.def),
      JSON.stringify({ alignItems: m.align.def.host.alignItems, ...m.align.def.offsets }),
    );

    check(
      'align="start" / "end"：贴顶 / 贴底（flex-start / flex-end）',
      m.align.start.host.alignItems === 'flex-start' &&
        atTop(m.align.start) &&
        m.align.end.host.alignItems === 'flex-end' &&
        atBottom(m.align.end),
      JSON.stringify({
        start: m.align.start.host.alignItems,
        startTops: m.align.start.offsets.items.map((item) => item.top),
        end: m.align.end.host.alignItems,
        endBottoms: m.align.end.offsets.items.map((item) => item.bottom),
      }),
    );

    check(
      'align="baseline"：align-items:baseline，字号不同的两个盒子顶边错位（基线对齐）',
      m.align.baseline.host.alignItems === 'baseline' &&
        m.align.baseline.items.length === 2 &&
        Math.abs(m.align.baseline.items[0].top - m.align.baseline.items[1].top) >= 2,
      JSON.stringify({
        alignItems: m.align.baseline.host.alignItems,
        tops: m.align.baseline.items.map((item) => item.top),
      }),
    );

    check(
      'align="stretch"：子项高度撑满容器内容高度（100px）',
      m.align.stretch.host.alignItems === 'stretch' &&
        m.align.stretch.offsets.items.length === 2 &&
        m.align.stretch.offsets.items.every((item) => near(item.height, 100, 1)) &&
        m.align.stretch.offsets.items.every((item) => item.top <= 1.5),
      JSON.stringify({ alignItems: m.align.stretch.host.alignItems, ...m.align.stretch.offsets }),
    );

    check(
      'align 显式 center 生效；纵向时显式 align="start" 压过默认 stretch',
      m.align.center.host.alignItems === 'center' &&
        centered(m.align.center) &&
        m.align.verticalStart === 'flex-start',
      JSON.stringify({
        explicitCenter: m.align.center.host.alignItems,
        centerGeometry: m.align.center.offsets.items.map((item) => item.top),
        verticalStart: m.align.verticalStart,
      }),
    );

    check(
      'justify 六档映射到 justify-content：start / center / end / between / around / evenly',
      m.justify.start.host.justifyContent === 'flex-start' &&
        m.justify.center.host.justifyContent === 'center' &&
        m.justify.end.host.justifyContent === 'flex-end' &&
        m.justify.between.host.justifyContent === 'space-between' &&
        m.justify.around.host.justifyContent === 'space-around' &&
        m.justify.evenly.host.justifyContent === 'space-evenly',
      JSON.stringify({
        start: m.justify.start.host.justifyContent,
        center: m.justify.center.host.justifyContent,
        end: m.justify.end.host.justifyContent,
        between: m.justify.between.host.justifyContent,
        around: m.justify.around.host.justifyContent,
        evenly: m.justify.evenly.host.justifyContent,
      }),
    );

    check(
      'justify 的几何：start/end/between 贴边，center/around/evenly 两侧留白，evenly 留白大于 around',
      near(firstLeft(m.justify.start), 0, 1) &&
        lastRight(m.justify.start) > 5 &&
        near(lastRight(m.justify.end), 0, 1) &&
        firstLeft(m.justify.end) > 5 &&
        near(firstLeft(m.justify.between), 0, 1) &&
        near(lastRight(m.justify.between), 0, 1) &&
        firstLeft(m.justify.center) > 5 &&
        near(firstLeft(m.justify.center), lastRight(m.justify.center), 1) &&
        firstLeft(m.justify.around) > 5 &&
        near(firstLeft(m.justify.around), lastRight(m.justify.around), 1) &&
        firstLeft(m.justify.evenly) > firstLeft(m.justify.around) &&
        near(firstLeft(m.justify.evenly), lastRight(m.justify.evenly), 1),
      JSON.stringify({
        parentWidth: m.justify.parentWidth,
        lefts: {
          start: firstLeft(m.justify.start),
          center: firstLeft(m.justify.center),
          end: firstLeft(m.justify.end),
          between: firstLeft(m.justify.between),
          around: firstLeft(m.justify.around),
          evenly: firstLeft(m.justify.evenly),
        },
        rights: {
          start: lastRight(m.justify.start),
          center: lastRight(m.justify.center),
          end: lastRight(m.justify.end),
          between: lastRight(m.justify.between),
          around: lastRight(m.justify.around),
          evenly: lastRight(m.justify.evenly),
        },
      }),
    );

    check(
      'reverse-order：横向 row-reverse（首项在右），纵向 column-reverse（首项在下）',
      m.reverse.row.host.flexDirection === 'row-reverse' &&
        m.reverse.row.items[0].left > m.reverse.row.items[2].left &&
        m.reverse.column.host.flexDirection === 'column-reverse' &&
        m.reverse.column.items[0].top > m.reverse.column.items[2].top,
      JSON.stringify({
        row: {
          direction: m.reverse.row.host.flexDirection,
          lefts: m.reverse.row.items.map((item) => item.left),
        },
        column: {
          direction: m.reverse.column.host.flexDirection,
          tops: m.reverse.column.items.map((item) => item.top),
        },
      }),
    );

    check(
      'wrap-items：不写时 flex-wrap:nowrap（不换行）；写了 wrap-items 换行，容器高度变成两行 + 行距',
      m.wrap.nowrap.host.flexWrap === 'nowrap' &&
        near(m.wrap.nowrap.items[0].top, m.wrap.nowrap.items[1].top) &&
        near(m.wrap.nowrap.host.height, 20, 1) &&
        m.wrap.wrap.host.flexWrap === 'wrap' &&
        m.wrap.wrap.items[1].top > m.wrap.wrap.items[0].top + 5 &&
        near(m.wrap.wrap.items[1].left, m.wrap.wrap.items[0].left) &&
        near(m.wrap.wrap.host.height, 56, 1),
      JSON.stringify({
        nowrap: {
          flexWrap: m.wrap.nowrap.host.flexWrap,
          height: m.wrap.nowrap.host.height,
          tops: m.wrap.nowrap.items.map((item) => item.top),
        },
        wrap: {
          flexWrap: m.wrap.wrap.host.flexWrap,
          height: m.wrap.wrap.host.height,
          tops: m.wrap.wrap.items.map((item) => item.top),
          lefts: m.wrap.wrap.items.map((item) => item.left),
        },
      }),
    );

    check(
      'block：写了 display:flex + width:100%（撑满父容器），不写时 inline-flex 按内容收缩',
      m.block.block.display === 'flex' &&
        near(m.block.block.width, m.block.parentWidth, 1) &&
        m.block.inline.display === 'inline-flex' &&
        m.block.inline.width > 0 &&
        m.block.inline.width < m.block.parentWidth - 100,
      JSON.stringify({
        inline: { display: m.block.inline.display, width: m.block.inline.width },
        block: { display: m.block.block.display, width: m.block.block.width },
        parentWidth: m.block.parentWidth,
      }),
    );

    check(
      '宿主 style="gap:10px" 压过 gap="lg"：计算值与几何间距都是 10px',
      m.override.host.gap === '10px' && near(m.override.geom[0], 10),
      JSON.stringify({ hostGap: m.override.host.gap, geom: m.override.geom }),
    );

    /* 运行时：纯 CSS 组件靠属性选择器，改属性应立即生效；删掉属性回默认 */
    const runtime = await page.evaluate(async () => {
      const host = document.getElementById('p-runtime');
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const snap = () => {
        const s = getComputedStyle(host);
        const r = host.getBoundingClientRect();
        return {
          display: s.display,
          flexDirection: s.flexDirection,
          alignItems: s.alignItems,
          justifyContent: s.justifyContent,
          flexWrap: s.flexWrap,
          gap: s.gap,
          gapVar: host.style.getPropertyValue('--mc-space-gap').trim(),
          width: Math.round(r.width * 10) / 10,
          height: Math.round(r.height * 10) / 10,
          wrapItemsAttr: host.hasAttribute('wrap-items'),
          reverseAttr: host.hasAttribute('reverse-order'),
          blockAttr: host.hasAttribute('block'),
        };
      };
      const out = { base: snap() };
      host.setAttribute('gap', 'sm');
      await wait(120);
      out.gapSm = snap();
      host.setAttribute('gap', 'lg');
      await wait(120);
      out.gapLg = snap();
      host.setAttribute('gap', '20');
      await wait(120);
      out.gapNum = snap();
      host.setAttribute('gap', 'sm');
      await wait(120);
      out.gapTokenAgain = snap();
      host.setAttribute('gap', '12px');
      await wait(120);
      out.gapInvalid = snap();
      host.setAttribute('gap', 'lg');
      await wait(120);
      host.setAttribute('direction', 'vertical');
      await wait(120);
      out.vertical = snap();
      host.removeAttribute('gap');
      host.removeAttribute('direction');
      await wait(120);
      out.clearedGapDirection = snap();

      host.setAttribute('align', 'end');
      await wait(120);
      out.alignEnd = snap();

      host.setAttribute('justify', 'end');
      host.setAttribute('reverse-order', '');
      await wait(120);
      out.justifyReverse = snap();

      /* 布尔属性写成 "false" 时在**挂载时**被规范化掉（ofa 布尔绑定会写 wrap-items="false"） */
      const mountProbe = document.createElement('mc-space');
      mountProbe.setAttribute('wrap-items', 'false');
      mountProbe.setAttribute('reverse-order', 'false');
      mountProbe.setAttribute('block', 'false');
      mountProbe.innerHTML =
        '<span style="width:20px;height:10px"></span><span style="width:20px;height:10px"></span>';
      host.parentNode.append(mountProbe);
      await wait(200);
      out.falseStrings = {
        wrapItemsAttr: mountProbe.hasAttribute('wrap-items'),
        reverseAttr: mountProbe.hasAttribute('reverse-order'),
        blockAttr: mountProbe.hasAttribute('block'),
        flexWrap: getComputedStyle(mountProbe).flexWrap,
        flexDirection: getComputedStyle(mountProbe).flexDirection,
        display: getComputedStyle(mountProbe).display,
      };
      mountProbe.remove();

      host.setAttribute('wrap-items', '');
      await wait(120);
      out.wrapped = snap();
      host.setAttribute('block', '');
      await wait(120);
      out.block = snap();
      for (const name of ['align', 'justify', 'wrap-items', 'reverse-order', 'block']) host.removeAttribute(name);
      await wait(120);
      out.clearedAll = snap();
      return out;
    });

    check(
      '运行时改 gap / direction：三档与数字都立即生效，带单位 / 非法值落回 md；删掉属性回默认',
      runtime.base.gap === m.tokens.md &&
        runtime.base.gapVar === '' &&
        runtime.gapSm.gap === m.tokens.sm &&
        runtime.gapLg.gap === m.tokens.lg &&
        runtime.gapNum.gap === '20px' &&
        runtime.gapNum.gapVar === '20px' &&
        runtime.gapTokenAgain.gap === m.tokens.sm &&
        runtime.gapTokenAgain.gapVar === '' &&
        runtime.gapInvalid.gap === m.tokens.md &&
        runtime.gapInvalid.gapVar === '' &&
        runtime.vertical.flexDirection === 'column' &&
        runtime.clearedGapDirection.gap === m.tokens.md &&
        runtime.clearedGapDirection.gapVar === '' &&
        runtime.clearedGapDirection.flexDirection === 'row',
      JSON.stringify({
        base: runtime.base.gap,
        sm: runtime.gapSm.gap,
        lg: runtime.gapLg.gap,
        num: { gap: runtime.gapNum.gap, var: runtime.gapNum.gapVar },
        backToToken: { gap: runtime.gapTokenAgain.gap, var: runtime.gapTokenAgain.gapVar },
        invalid: { gap: runtime.gapInvalid.gap, var: runtime.gapInvalid.gapVar },
        vertical: runtime.vertical.flexDirection,
        cleared: {
          gap: runtime.clearedGapDirection.gap,
          var: runtime.clearedGapDirection.gapVar,
          direction: runtime.clearedGapDirection.flexDirection,
        },
      }),
    );

    check(
      '运行时改 align / justify / reverse-order / wrap-items / block：计算样式与宽度跟着走，删掉全部回默认',
      runtime.alignEnd.alignItems === 'flex-end' &&
        runtime.justifyReverse.justifyContent === 'flex-end' &&
        runtime.justifyReverse.flexDirection === 'row-reverse' &&
        runtime.justifyReverse.reverseAttr === true &&
        runtime.falseStrings.wrapItemsAttr === false &&
        runtime.falseStrings.reverseAttr === false &&
        runtime.falseStrings.blockAttr === false &&
        runtime.falseStrings.flexWrap === 'nowrap' &&
        runtime.falseStrings.flexDirection === 'row' &&
        runtime.falseStrings.display === 'inline-flex' &&
        runtime.wrapped.flexWrap === 'wrap' &&
        runtime.wrapped.wrapItemsAttr === true &&
        runtime.block.display === 'flex' &&
        runtime.block.blockAttr === true &&
        Math.abs(runtime.block.width - m.probeWidth) <= 1 &&
        runtime.clearedAll.alignItems === 'center' &&
        runtime.clearedAll.justifyContent === 'flex-start' &&
        runtime.clearedAll.flexDirection === 'row' &&
        runtime.clearedAll.flexWrap === 'nowrap' &&
        runtime.clearedAll.display === 'inline-flex' &&
        runtime.clearedAll.wrapItemsAttr === false &&
        runtime.clearedAll.reverseAttr === false &&
        runtime.clearedAll.blockAttr === false &&
        Math.abs(runtime.clearedAll.width - runtime.base.width) <= 1,
      JSON.stringify({
        alignEnd: runtime.alignEnd.alignItems,
        justifyReverse: {
          justify: runtime.justifyReverse.justifyContent,
          direction: runtime.justifyReverse.flexDirection,
          attr: runtime.justifyReverse.reverseAttr,
        },
        falseStrings: runtime.falseStrings,
        wrapped: { flexWrap: runtime.wrapped.flexWrap, attr: runtime.wrapped.wrapItemsAttr },
        block: { display: runtime.block.display, attr: runtime.block.blockAttr, width: runtime.block.width },
        probeWidth: m.probeWidth,
        baseWidth: runtime.base.width,
        cleared: runtime.clearedAll,
      }),
    );

    check(
      'API 面：没有 part（纯布局容器不对外开内部样式钩子）',
      m.parts.length === 0,
      JSON.stringify({ shadowRoot: m.shadow, parts: m.parts }),
    );
  } finally {
    await page.evaluate(() => document.getElementById('space-probe')?.remove());
  }
}
