/**
 * mc-divider · 分割线：水平 / 竖直、spacing 三档 + 数字、variant 线型、中间文字与 align、
 * 令牌 / ::part 定制，以及 slot 分到节点的变化（data-has-content）。
 *
 * 组件没有方法 / 事件可点，断言全部落在「宿主 / shadow 内部的计算样式 + 几何」上。
 * 现搭现拆探针：固定白底板上量，收尾删掉，避免污染文档页。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(r.status() + ' ' + r.url());
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?divider=1#/packages/divider/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-divider'), { timeout: 8000 })
    .catch(() => {});

  /** 令牌解析：组件里的线色是 rgb(var(--mc-divider-color)) → rgb(var(--mc-color-border))，期望值按当前主题算 */
  const tokens = await page.evaluate(() => {
    const read = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const rgb = (name) => 'rgb(' + read(name).split(/\s+/).join(', ') + ')';
    return { border: rgb('--mc-color-border') };
  });

  const px = (value) => parseFloat(value);
  const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

  try {
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.id = 'divider-probe';
      probe.style.cssText =
        'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
        'width:320px;font-size:16px;line-height:1.5';
      probe.innerHTML = `
        <div id="d-row" style="width:300px">
          <mc-divider id="d-default"></mc-divider>
          <mc-divider id="d-sm" spacing="sm"></mc-divider>
          <mc-divider id="d-md" spacing="md"></mc-divider>
          <mc-divider id="d-lg" spacing="lg"></mc-divider>
          <mc-divider id="d-num" spacing="10"></mc-divider>
          <mc-divider id="d-unit" spacing="12px"></mc-divider>
          <mc-divider id="d-solid"></mc-divider>
          <mc-divider id="d-dashed" variant="dashed"></mc-divider>
          <mc-divider id="d-dotted" variant="dotted"></mc-divider>
          <mc-divider id="d-empty"></mc-divider>
          <mc-divider id="d-text">或</mc-divider>
          <mc-divider id="d-align-center">居中</mc-divider>
          <mc-divider id="d-align-start" align="start">左对齐</mc-divider>
          <mc-divider id="d-align-end" align="end">右对齐</mc-divider>
          <mc-divider id="d-token" style="--mc-divider-color: 1 2 3; --mc-divider-width: 2px; --mc-divider-text-gap: 20px">令牌</mc-divider>
          <mc-divider id="d-part"></mc-divider>
          <mc-divider id="d-runtime"></mc-divider>
          <mc-divider id="d-slot"></mc-divider>
          <!-- 不在 flex 行里：用来量真正的 inline-flex（flex 子项会被 blockify 成 flex） -->
          <mc-divider id="d-v-plain" direction="vertical"></mc-divider>
        </div>
        <div id="d-v-row" style="display:flex;height:80px;align-items:stretch;width:300px">
          <span style="width:40px">左</span>
          <mc-divider id="d-v" direction="vertical"></mc-divider>
          <mc-divider id="d-v-lg" direction="vertical" spacing="lg"></mc-divider>
          <mc-divider id="d-v-dashed" direction="vertical" variant="dashed"></mc-divider>
          <span style="width:40px">右</span>
        </div>`;
      document.body.append(probe);
    });

    /* 组件定义已就绪时 append 会同步升级；再等一拍，防 ofa 的 shadow 挂载慢于 connectedCallback */
    await page
      .waitForFunction(() => !!document.getElementById('d-default')?.shadowRoot, { timeout: 3000 })
      .catch(() => {});
    /* 组件 shadow 初次挂载后才去请求 component-base.css；再等一拍让样式表落位 */
    await page.waitForTimeout(250);

    const probe = await page.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      const cs = (el) => getComputedStyle(el);
      const rect = (el) => el.getBoundingClientRect();
      const round = (n) => Math.round(n * 10) / 10;
      const line = (el, which) => el.shadowRoot.querySelector('.mc-line-' + which);
      const content = (el) => el.shadowRoot.querySelector('.mc-content');

      const d = $('d-default');
      const root = d.shadowRoot;
      const children = [...root.children]
        .filter((n) => n.tagName !== 'STYLE' && n.tagName !== 'LINK')
        .map((n) => n.className);
      const slot = root.querySelector('slot');

      const host = (() => {
        const s = cs(d);
        return {
          display: s.display,
          flexDirection: s.flexDirection,
          alignItems: s.alignItems,
          width: round(rect(d).width),
          marginTop: s.marginTop,
          marginBottom: s.marginBottom,
          marginLeft: s.marginLeft,
          marginRight: s.marginRight,
        };
      })();

      const sl = line(d, 'start');
      const el = line(d, 'end');
      const lineStyle = cs(sl);
      const start = rect(sl);
      const end = rect(el);
      const contentRect = rect(content(d));
      const lines = {
        startW: round(start.width),
        endW: round(end.width),
        startTop: round(start.top),
        endTop: round(end.top),
        sameTop: round(Math.abs(start.top - end.top)),
        startRight: round(start.right),
        endLeft: round(end.left),
        touching: round(Math.abs(start.right - end.left)),
        contentW: round(contentRect.width),
        borderTopWidth: lineStyle.borderTopWidth,
        borderTopStyle: lineStyle.borderTopStyle,
        borderTopColor: lineStyle.borderTopColor,
      };

      const spacing = (id) => {
        const hostEl = $(id);
        const s = cs(hostEl);
        return {
          marginTop: s.marginTop,
          marginBottom: s.marginBottom,
          varInline: hostEl.style.getPropertyValue('--mc-divider-spacing').trim(),
          varComputed: s.getPropertyValue('--mc-divider-spacing').trim(),
        };
      };

      const variant = (id) => {
        const s = cs(line($(id), 'start'));
        return {
          line: s.borderTopStyle,
          lineEnd: cs(line($(id), 'end')).borderTopStyle,
          width: s.borderTopWidth,
          /** 水平线只用上边框：另一边显式 0 宽，改 dashed 也不会冒出 3px 的假线 */
          inlineWidth: s.borderLeftWidth,
          inlineStyle: s.borderLeftStyle,
        };
      };

      const box = (id) => {
        const hostEl = $(id);
        const c = content(hostEl);
        const s = cs(c);
        return {
          hasContent: hostEl.hasAttribute('data-has-content'),
          contentW: round(rect(c).width),
          paddingLeft: s.paddingLeft,
          paddingRight: s.paddingRight,
          startRight: round(rect(line(hostEl, 'start')).right),
          endLeft: round(rect(line(hostEl, 'end')).left),
          contentLeft: round(rect(c).left),
          contentRight: round(rect(c).right),
          touching: round(
            Math.abs(rect(line(hostEl, 'start')).right - rect(line(hostEl, 'end')).left),
          ),
        };
      };

      const textEl = $('d-text');
      const textRange = document.createRange();
      textRange.selectNodeContents(textEl);
      const text = {
        ...box('d-text'),
        textW: round(textRange.getBoundingClientRect().width),
      };

      const align = (id) => {
        const hostEl = $(id);
        return {
          hostW: round(rect(hostEl).width),
          startW: round(rect(line(hostEl, 'start')).width),
          endW: round(rect(line(hostEl, 'end')).width),
          contentW: round(rect(content(hostEl)).width),
        };
      };

      const vertical = (id) => {
        const hostEl = $(id);
        const s = cs(hostEl);
        const ls = rect(line(hostEl, 'start'));
        const le = rect(line(hostEl, 'end'));
        const lineStyleV = cs(line(hostEl, 'start'));
        return {
          display: s.display,
          flexDirection: s.flexDirection,
          alignSelf: s.alignSelf,
          height: round(rect(hostEl).height),
          fontSize: s.fontSize,
          minHeight: s.minHeight,
          marginTop: s.marginTop,
          marginBottom: s.marginBottom,
          marginLeft: s.marginLeft,
          marginRight: s.marginRight,
          startW: round(ls.width),
          endW: round(le.width),
          startH: round(ls.height),
          endH: round(le.height),
          borderLeftWidth: lineStyleV.borderLeftWidth,
          borderTopWidth: lineStyleV.borderTopWidth,
        };
      };

      return {
        structure: {
          upgraded: root instanceof ShadowRoot,
          children,
          parts: root.querySelectorAll('[part="line"]').length,
          slots: root.querySelectorAll('slot').length,
          slotName: slot?.getAttribute('name') ?? '',
          aria: ['role', 'aria-orientation', 'aria-label', 'aria-hidden'].filter((a) =>
            d.hasAttribute(a),
          ),
        },
        host,
        lines,
        spacing: {
          sm: spacing('d-sm'),
          md: spacing('d-md'),
          lg: spacing('d-lg'),
          num: spacing('d-num'),
          unit: spacing('d-unit'),
        },
        variants: {
          solid: variant('d-solid'),
          dashed: variant('d-dashed'),
          dotted: variant('d-dotted'),
        },
        empty: box('d-empty'),
        text,
        align: {
          center: align('d-align-center'),
          start: align('d-align-start'),
          end: align('d-align-end'),
        },
        vertical: {
          md: vertical('d-v'),
          lg: vertical('d-v-lg'),
          plain: vertical('d-v-plain'),
          dashed: (() => {
            const s = cs(line($('d-v-dashed'), 'start'));
            return {
              topWidth: s.borderTopWidth,
              leftStyle: s.borderLeftStyle,
              leftWidth: s.borderLeftWidth,
            };
          })(),
        },
        token: (() => {
          const hostEl = $('d-token');
          const ls = cs(line(hostEl, 'start'));
          const c = cs(content(hostEl));
          return {
            borderTopColor: ls.borderTopColor,
            borderTopWidth: ls.borderTopWidth,
            paddingLeft: c.paddingLeft,
            paddingRight: c.paddingRight,
          };
        })(),
      };
    });

    /* ------------------------------------------------------------------ *
     * 1. 注册 + shadow 结构
     * ------------------------------------------------------------------ */
    check(
      'mc-divider 注册并渲染：shadow 里两条 part=line + 一个默认 slot，没有多余结构，也不写 role / aria-*',
      probe.structure.upgraded &&
        probe.structure.parts === 2 &&
        probe.structure.slots === 1 &&
        probe.structure.slotName === '' &&
        probe.structure.children.length === 3 &&
        probe.structure.children[0].includes('mc-line-start') &&
        probe.structure.children[1] === 'mc-content' &&
        probe.structure.children[2].includes('mc-line-end') &&
        probe.structure.aria.length === 0,
      JSON.stringify(probe.structure),
    );

    /* ------------------------------------------------------------------ *
     * 2. 默认水平：block 级 flex 撑满容器、上下留白 md
     * ------------------------------------------------------------------ */
    check(
      '默认水平：display:flex、宽度撑满探针容器（300px）、margin-block 为 md 的 16px',
      probe.host.display === 'flex' &&
        probe.host.flexDirection === 'row' &&
        probe.host.alignItems === 'center' &&
        near(probe.host.width, 300, 1) &&
        probe.host.marginTop === '16px' &&
        probe.host.marginBottom === '16px',
      JSON.stringify(probe.host),
    );

    /* ------------------------------------------------------------------ *
     * 3. 两条线段：同一水平线、各约一半、1px 实线、颜色取 --mc-color-border
     * ------------------------------------------------------------------ */
    check(
      '没有内容时两段线各占一半、首尾相接并在同一水平线；线是 1px 实线，颜色 == rgb(var(--mc-color-border))',
      probe.lines.sameTop <= 1 &&
        near(probe.lines.startW, 150, 1) &&
        near(probe.lines.endW, 150, 1) &&
        near(probe.lines.contentW, 0, 0.5) &&
        probe.lines.touching <= 1 &&
        probe.lines.borderTopWidth === '1px' &&
        probe.lines.borderTopStyle === 'solid' &&
        probe.lines.borderTopColor === tokens.border,
      JSON.stringify({ lines: probe.lines, borderToken: tokens.border }),
    );

    /* ------------------------------------------------------------------ *
     * 4. spacing 三档：sm / md / lg → 8 / 16 / 24px（CSS 令牌，不写宿主变量）
     * ------------------------------------------------------------------ */
    check(
      'spacing 三档：sm / md / lg 的 margin-block 分别是 8 / 16 / 24px；三档都不写宿主 --mc-divider-spacing',
      near(px(probe.spacing.sm.marginTop), 8) &&
        near(px(probe.spacing.sm.marginBottom), 8) &&
        near(px(probe.spacing.md.marginTop), 16) &&
        near(px(probe.spacing.lg.marginTop), 24) &&
        near(px(probe.spacing.lg.marginBottom), 24) &&
        probe.spacing.sm.varInline === '' &&
        probe.spacing.md.varInline === '' &&
        probe.spacing.lg.varInline === '',
      JSON.stringify(probe.spacing),
    );

    /* ------------------------------------------------------------------ *
     * 5. spacing 的数字通道：纯数字按 px；带单位 / 非法值落回 md
     * ------------------------------------------------------------------ */
    check(
      'spacing 只收纯数字：10 → 10px 且宿主 --mc-divider-spacing=10px；12px 非法 → 回 md 16px 且变量为空',
      near(px(probe.spacing.num.marginTop), 10) &&
        probe.spacing.num.varInline === '10px' &&
        probe.spacing.num.varComputed === '10px' &&
        near(px(probe.spacing.unit.marginTop), 16) &&
        probe.spacing.unit.varInline === '' &&
        probe.spacing.unit.varComputed === '',
      JSON.stringify({ num: probe.spacing.num, unit: probe.spacing.unit }),
    );

    /* ------------------------------------------------------------------ *
     * 6. 竖线：inline-flex + column、margin-inline 按 spacing、线宽 1px、父级 flex 行里拉满高度
     * ------------------------------------------------------------------ */
    check(
      '竖线：display:inline-flex、flex-direction:column；margin-inline 按 spacing（md 16 / lg 24）；线宽 1px；父级 flex 行里被拉伸到 80px',
      /* flex 子项会被 blockify：行里的实例计算值是 flex（方向仍是 column），行外才是 inline-flex */
      probe.vertical.plain.display === 'inline-flex' &&
        probe.vertical.plain.flexDirection === 'column' &&
        probe.vertical.plain.marginTop === '0px' &&
        probe.vertical.md.flexDirection === 'column' &&
        probe.vertical.md.alignSelf === 'stretch' &&
        near(probe.vertical.md.height, 80, 1) &&
        near(px(probe.vertical.md.minHeight), px(probe.vertical.md.fontSize), 0.5) &&
        near(px(probe.vertical.md.marginLeft), 16) &&
        near(px(probe.vertical.md.marginRight), 16) &&
        probe.vertical.md.marginTop === '0px' &&
        probe.vertical.md.marginBottom === '0px' &&
        near(probe.vertical.md.startW, 1, 0.5) &&
        near(probe.vertical.md.endW, 1, 0.5) &&
        probe.vertical.md.borderLeftWidth === '1px' &&
        probe.vertical.md.borderTopWidth === '0px' &&
        near(probe.vertical.md.startH + probe.vertical.md.endH, 80, 2) &&
        near(px(probe.vertical.lg.marginLeft), 24) &&
        near(px(probe.vertical.lg.marginRight), 24),
      JSON.stringify(probe.vertical),
    );

    /* ------------------------------------------------------------------ *
     * 7. variant：solid 默认 / dashed / dotted 只改线型
     * ------------------------------------------------------------------ */
    check(
      'variant：默认 solid，dashed / dotted 只改两条线对应边的线型，宽度仍是 1px；另一轴显式 0 宽（dashed 也不冒出假线）',
      probe.variants.solid.line === 'solid' &&
        probe.variants.dashed.line === 'dashed' &&
        probe.variants.dashed.lineEnd === 'dashed' &&
        probe.variants.dotted.line === 'dotted' &&
        probe.variants.dotted.lineEnd === 'dotted' &&
        probe.variants.dashed.width === '1px' &&
        probe.variants.dotted.width === '1px' &&
        probe.variants.dashed.inlineWidth === '0px' &&
        probe.variants.dotted.inlineWidth === '0px' &&
        probe.vertical.dashed.topWidth === '0px' &&
        probe.vertical.dashed.leftStyle === 'dashed' &&
        probe.vertical.dashed.leftWidth === '1px',
      JSON.stringify({ horizontal: probe.variants, vertical: probe.vertical.dashed }),
    );

    /* ------------------------------------------------------------------ *
     * 8. 空内容：不占位、没有 data-has-content、两段线相接
     * ------------------------------------------------------------------ */
    check(
      '无内容：不写 data-has-content，.mc-content 宽 0 且没有内边距，两段线首尾相接',
      probe.empty.hasContent === false &&
        near(probe.empty.contentW, 0, 0.5) &&
        probe.empty.paddingLeft === '0px' &&
        probe.empty.paddingRight === '0px' &&
        probe.empty.touching <= 1,
      JSON.stringify(probe.empty),
    );

    /* ------------------------------------------------------------------ *
     * 9. 有文字：data-has-content、文字两侧 12px（--mc-divider-text-gap）
     * ------------------------------------------------------------------ */
    check(
      '有文字：宿主出现 data-has-content，.mc-content 两侧各 12px 内边距，两段线贴住内容（总宽 = 文字宽 + 24）',
      probe.text.hasContent === true &&
        probe.text.paddingLeft === '12px' &&
        probe.text.paddingRight === '12px' &&
        probe.text.contentW > probe.text.textW &&
        near(probe.text.contentW, probe.text.textW + 24, 2) &&
        Math.abs(probe.text.startRight - probe.text.contentLeft) <= 1 &&
        Math.abs(probe.text.endLeft - probe.text.contentRight) <= 1,
      JSON.stringify(probe.text),
    );

    /* ------------------------------------------------------------------ *
     * 10. align：center 两侧等长；start / end 把短的一侧缩到 5%
     * ------------------------------------------------------------------ */
    check(
      'align：有内容时 center 两段线等长；start 起始线约为容器 5%、末尾线明显更长；end 反之',
      near(probe.align.center.startW, probe.align.center.endW, 1) &&
        probe.align.center.startW > 50 &&
        near(probe.align.start.startW, probe.align.start.hostW * 0.05, 1.5) &&
        probe.align.start.endW > probe.align.start.startW * 3 &&
        near(probe.align.end.endW, probe.align.end.hostW * 0.05, 1.5) &&
        probe.align.end.startW > probe.align.end.endW * 3,
      JSON.stringify(probe.align),
    );

    /* ------------------------------------------------------------------ *
     * 11. 运行时改属性：纯 CSS 属性选择器，改完立即生效；删掉属性回默认
     * ------------------------------------------------------------------ */
    const runtime = await page.evaluate(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const hostEl = document.getElementById('d-runtime');
      const snapshot = () => {
        const s = getComputedStyle(hostEl);
        return {
          display: s.display,
          flexDirection: s.flexDirection,
          marginTop: s.marginTop,
          marginBottom: s.marginBottom,
          marginLeft: s.marginLeft,
          marginRight: s.marginRight,
          varInline: hostEl.style.getPropertyValue('--mc-divider-spacing').trim(),
          borderTopStyle: getComputedStyle(
            hostEl.shadowRoot.querySelector('.mc-line-start'),
          ).borderTopStyle,
        };
      };
      const out = { base: snapshot() };
      hostEl.setAttribute('spacing', 'sm');
      await wait(120);
      out.spSm = snapshot();
      hostEl.setAttribute('spacing', '20');
      await wait(120);
      out.spNum = snapshot();
      hostEl.setAttribute('spacing', 'lg');
      await wait(120);
      out.spLg = snapshot();
      hostEl.removeAttribute('spacing');
      await wait(120);
      out.spCleared = snapshot();
      hostEl.setAttribute('direction', 'vertical');
      await wait(120);
      out.vertical = snapshot();
      hostEl.setAttribute('direction', 'horizontal');
      await wait(120);
      out.horizontal = snapshot();
      hostEl.setAttribute('variant', 'dashed');
      await wait(120);
      out.dashed = snapshot();
      hostEl.removeAttribute('variant');
      await wait(120);
      out.solid = snapshot();
      hostEl.removeAttribute('direction');
      return out;
    });

    check(
      '运行时改 spacing / direction / variant 立即生效：sm 8、20 → 20px、lg 24；删掉 spacing 回 md 16；竖线切横线、dashed ← → solid 都跟着走',
      px(runtime.base.marginTop) === 16 &&
        runtime.base.varInline === '' &&
        px(runtime.spSm.marginTop) === 8 &&
        runtime.spSm.varInline === '' &&
        px(runtime.spNum.marginTop) === 20 &&
        runtime.spNum.varInline === '20px' &&
        px(runtime.spLg.marginTop) === 24 &&
        runtime.spLg.varInline === '' &&
        px(runtime.spCleared.marginTop) === 16 &&
        runtime.spCleared.varInline === '' &&
        runtime.vertical.display === 'inline-flex' &&
        runtime.vertical.flexDirection === 'column' &&
        px(runtime.vertical.marginTop) === 0 &&
        px(runtime.vertical.marginLeft) === 16 &&
        runtime.horizontal.display === 'flex' &&
        runtime.horizontal.flexDirection === 'row' &&
        px(runtime.horizontal.marginTop) === 16 &&
        px(runtime.horizontal.marginLeft) === 0 &&
        runtime.dashed.borderTopStyle === 'dashed' &&
        runtime.solid.borderTopStyle === 'solid',
      JSON.stringify(runtime),
    );

    /* ------------------------------------------------------------------ *
     * 12. slot 动态变化：塞文本 → 出间距；清空 → 回一条通长的线
     * ------------------------------------------------------------------ */
    const dynamic = await page.evaluate(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const hostEl = document.getElementById('d-slot');
      const snapshot = () => {
        const c = hostEl.shadowRoot.querySelector('.mc-content');
        const s = getComputedStyle(c);
        const start = hostEl.shadowRoot.querySelector('.mc-line-start').getBoundingClientRect();
        const end = hostEl.shadowRoot.querySelector('.mc-line-end').getBoundingClientRect();
        return {
          hasContent: hostEl.hasAttribute('data-has-content'),
          contentW: Math.round(c.getBoundingClientRect().width * 10) / 10,
          paddingLeft: s.paddingLeft,
          gap: Math.round((end.left - start.right) * 10) / 10,
        };
      };
      const out = { base: snapshot() };
      hostEl.appendChild(document.createTextNode('分隔'));
      await wait(250);
      out.appended = snapshot();
      hostEl.textContent = '';
      await wait(250);
      out.cleared = snapshot();
      return out;
    });

    check(
      'slot 动态变化：往默认插槽塞文本 → data-has-content + 12px 间距出现；清空 → 属性移除、两段线重新相接',
      dynamic.base.hasContent === false &&
        near(dynamic.base.contentW, 0, 0.5) &&
        near(dynamic.base.gap, 0, 0.5) &&
        dynamic.appended.hasContent === true &&
        dynamic.appended.paddingLeft === '12px' &&
        dynamic.appended.contentW > 0 &&
        dynamic.appended.gap > 0 &&
        dynamic.cleared.hasContent === false &&
        near(dynamic.cleared.contentW, 0, 0.5) &&
        dynamic.cleared.paddingLeft === '0px' &&
        near(dynamic.cleared.gap, 0, 0.5),
      JSON.stringify(dynamic),
    );

    /* ------------------------------------------------------------------ *
     * 13. 令牌覆盖：宿主 style 上的 --mc-divider-* 三件套
     * ------------------------------------------------------------------ */
    check(
      '令牌覆盖：宿主 style 改 --mc-divider-color / --mc-divider-width / --mc-divider-text-gap 都生效',
      probe.token.borderTopColor === 'rgb(1, 2, 3)' &&
        probe.token.borderTopWidth === '2px' &&
        probe.token.paddingLeft === '20px' &&
        probe.token.paddingRight === '20px',
      JSON.stringify(probe.token),
    );

    /* ------------------------------------------------------------------ *
     * 14. ::part(line)：外部 style 规则能改线段
     * ------------------------------------------------------------------ */
    const part = await page.evaluate(async () => {
      const style = document.createElement('style');
      style.id = 'divider-part-style';
      style.textContent = '#d-part::part(line) { border-top-color: rgb(0, 128, 0); }';
      document.head.append(style);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const hostEl = document.getElementById('d-part');
      const colors = [...hostEl.shadowRoot.querySelectorAll('[part="line"]')].map(
        (node) => getComputedStyle(node).borderTopColor,
      );
      return { colors };
    });

    check(
      '::part(line)：文档里加规则改 border-top-color，两条线的计算样式都跟着变',
      part.colors.length === 2 && part.colors.every((c) => c === 'rgb(0, 128, 0)'),
      JSON.stringify(part),
    );

    /* ------------------------------------------------------------------ *
     * 15. 文档页无 404 / console 报错 / 运行时异常
     * ------------------------------------------------------------------ */
    check(
      'divider 文档页没有 404 / console error / pageerror',
      failed.length === 0,
      failed.join('\n') || '无',
    );
  } finally {
    await page.evaluate(() => {
      document.getElementById('divider-probe')?.remove();
      document.getElementById('divider-part-style')?.remove();
    });
    page.off('response', onResponse);
    page.off('pageerror', onError);
  }
}
