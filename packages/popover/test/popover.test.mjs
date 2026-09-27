/**
 * mc-popover · 通用浮层：原生 popover（top layer）+ CSS 锚点定位的几条不变量。
 *
 * 跑法：node tests/smoke.mjs popover（需先 pnpm dev）
 *
 * ⚠️ 这份套件盯的都是「静默失效」型问题 —— 面板照样渲染、只是位置错 / 关不掉 /
 * 被祖先 transform 困住，肉眼很难当场发现：
 *   · 锚点必须设在 shadow 内的容器上（设在 light DOM 的 slot 元素上无效）
 *   · 必须清掉 UA 给 popover 的 `inset: 0; margin: auto`（auto 外边距会吃掉锚点定位）
 *   · 锚点容器必须是 inline-flex（inline-block 会带 3px 基线缝隙，整体偏移）
 *   · close 事件只能有一个出口（API 与原生 toggle 都发就会重复）
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?popover=1');

  /* 组件由页面模块的 <l-m> 注册；套件自己兜底注册一份（不依赖页面写法） */
  const defined = await page.evaluate(async () => {
    if (!customElements.get('mc-popover')) {
      const loader = document.createElement('l-m');
      loader.setAttribute('src', '/packages/popover/popover.html');
      document.head.append(loader);
    }
    for (let i = 0; i < 100 && !customElements.get('mc-popover'); i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    return !!customElements.get('mc-popover');
  });
  check('mc-popover 注册成功', defined === true, String(defined));

  /** 在 body 末尾造一个 popover，返回它的句柄（用完删掉） */
  const makePopover = (attrs = {}, triggerHtml = '<button>t</button>', panelHtml = 'panel') =>
    page.evaluate(
      ({ attrs, triggerHtml, panelHtml }) => {
        const host = document.createElement('mc-popover');
        for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
        /* 放在视口正中：四周都有空间，12 个方向才量得到「未翻转」的贴合数学 */
        host.style.cssText = 'position: fixed; left: 50%; top: 45%; transform: translate(-50%, -50%);';
        host.innerHTML = `${triggerHtml}<div slot="panel">${panelHtml}</div>`;
        document.body.append(host);
        window.__pop = host;
        return true;
      },
      { attrs, triggerHtml, panelHtml },
    );

  const dropPopover = () => page.evaluate(() => window.__pop?.remove());

  const rects = () =>
    page.evaluate(() => {
      const pop = window.__pop;
      const panel = pop.shadowRoot.querySelector('.mc-panel');
      const trigger = pop.querySelector('button');
      const b = trigger.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      return {
        trigger: { x: b.x, y: b.y, right: b.right, bottom: b.bottom, cx: (b.x + b.right) / 2, cy: (b.y + b.bottom) / 2 },
        panel: { x: p.x, y: p.y, right: p.right, bottom: p.bottom, cx: (p.x + p.right) / 2, cy: (p.y + p.bottom) / 2 },
        rect: p.toJSON(),
      };
    });

  const show = (reason = 'api') => page.evaluate((r) => $(window.__pop).show(r), reason);
  const hide = () => page.evaluate(() => $(window.__pop).hide());
  const openAttr = () => page.evaluate(() => window.__pop.hasAttribute('open'));
  const isOpen = () => page.evaluate(() => window.__pop.shadowRoot.querySelector('.mc-panel').matches(':popover-open'));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ------------------------------------------------------------------ *
   * 1. 地基：面板用原生 popover，进 top layer
   * ------------------------------------------------------------------ */
  await makePopover();
  await wait(200);
  const base = await page.evaluate(() => {
    const panel = window.__pop.shadowRoot.querySelector('.mc-panel');
    const anchorBox = window.__pop.shadowRoot.querySelector('.mc-anchor');
    return {
      popoverAttr: panel.getAttribute('popover'),
      supportsApi: typeof panel.showPopover === 'function',
      anchorName: getComputedStyle(anchorBox).anchorName,
      anchorDisplay: getComputedStyle(anchorBox).display,
      // 面板的定位基准：锚点容器（inline-flex，盒高要与触发元素一致）
      anchorHeight: anchorBox.getBoundingClientRect().height,
      triggerHeight: window.__pop.querySelector('button').getBoundingClientRect().height,
    };
  });
  check(
    '面板是原生 popover（进 top layer），锚点挂在 shadow 内的容器上',
    base.popoverAttr === 'auto' && base.supportsApi === true && /^--/.test(base.anchorName),
    JSON.stringify(base),
  );
  check(
    '锚点容器用 inline-flex：盒高与触发元素一致（inline-block 会差 3px 基线缝隙）',
    base.anchorDisplay === 'inline-flex' && Math.abs(base.anchorHeight - base.triggerHeight) < 0.5,
    JSON.stringify({ anchor: base.anchorHeight, trigger: base.triggerHeight }),
  );

  /* ------------------------------------------------------------------ *
   * 2. 12 个方向的贴合数学（主轴严丝合缝、交叉轴对齐方式正确）
   * ------------------------------------------------------------------ */
  const placements = [
    'bottom',
    'bottom-start',
    'bottom-end',
    'top',
    'top-start',
    'top-end',
    'right',
    'right-start',
    'right-end',
    'left',
    'left-start',
    'left-end',
  ];
  const geometry = await page.evaluate(async (list) => {
    const pop = window.__pop;
    const inst = $(pop);
    const out = [];
    for (const placement of list) {
      pop.setAttribute('placement', placement);
      inst.show();
      await new Promise((r) => setTimeout(r, 260));
      const panel = pop.shadowRoot.querySelector('.mc-panel');
      const b = pop.querySelector('button').getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const axis = placement.startsWith('bottom')
        ? 'bottom'
        : placement.startsWith('top')
          ? 'top'
          : placement.startsWith('right')
            ? 'right'
            : 'left';
      const side = placement.endsWith('-start') ? 'start' : placement.endsWith('-end') ? 'end' : 'center';
      const main =
        axis === 'bottom'
          ? Math.abs(p.top - (b.bottom + 8))
          : axis === 'top'
            ? Math.abs(p.bottom - (b.top - 8))
            : axis === 'right'
              ? Math.abs(p.left - (b.right + 8))
              : Math.abs(p.right - (b.left - 8));
      const cross =
        side === 'start'
          ? axis === 'bottom' || axis === 'top'
            ? Math.abs(p.left - b.left)
            : Math.abs(p.top - b.top)
          : side === 'end'
            ? axis === 'bottom' || axis === 'top'
              ? Math.abs(p.right - b.right)
              : Math.abs(p.bottom - b.bottom)
            : axis === 'bottom' || axis === 'top'
              ? Math.abs((p.left + p.right) / 2 - (b.left + b.right) / 2)
              : Math.abs((p.top + p.bottom) / 2 - (b.top + b.bottom) / 2);
      out.push({ placement, main: +main.toFixed(1), cross: +cross.toFixed(1) });
      inst.hide();
      await new Promise((r) => setTimeout(r, 90));
    }
    return out;
  }, placements);
  const badGeometry = geometry.filter((g) => g.main > 1.5 || g.cross > 1.5);
  check(
    '十二个方向都贴合：主轴间距 8px、交叉轴按 start/center/end 对齐（零偏移）',
    geometry.length === 12 && badGeometry.length === 0,
    badGeometry.length ? JSON.stringify(badGeometry) : JSON.stringify(geometry.slice(0, 3)),
  );

  /* ------------------------------------------------------------------ *
   * 3. 贴边自动翻转：贴着视口右下角时翻到上方、不溢出
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    const pop = window.__pop;
    pop.style.cssText = 'position: fixed; right: 4px; bottom: 4px;';
    pop.setAttribute('placement', 'bottom-start');
  });
  await show();
  await wait(300);
  const flipped = await page.evaluate(() => {
    const pop = window.__pop;
    const b = pop.querySelector('button').getBoundingClientRect();
    const p = pop.shadowRoot.querySelector('.mc-panel').getBoundingClientRect();
    return { above: p.bottom <= b.top + 1, overflowRight: p.right > innerWidth, overflowLeft: p.left < 0 };
  });
  check(
    'space 不够时自动翻转：贴右下角 → 翻到上方且不溢出视口',
    flipped.above === true && flipped.overflowRight === false && flipped.overflowLeft === false,
    JSON.stringify(flipped),
  );
  await hide();

  /* ------------------------------------------------------------------ *
   * 4. 触发方式：click / hover / manual
   * ------------------------------------------------------------------ */
  const triggerBehavior = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const pop = window.__pop;
    const inst = $(pop);
    const anchor = pop.shadowRoot.querySelector('.mc-anchor');
    const anchorRect = anchor.getBoundingClientRect();
    const anchorCenter = { x: anchorRect.x + anchorRect.width / 2, y: anchorRect.y + anchorRect.height / 2 };

    // click（默认）
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await wait(200);
    const clickOpened = pop.hasAttribute('open');
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await wait(200);
    const clickClosed = !pop.hasAttribute('open');

    // hover
    pop.setAttribute('trigger', 'hover');
    pop.setAttribute('placement', 'bottom-start');
    anchor.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    await wait(300);
    const hoverOpened = pop.hasAttribute('open');
    anchor.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    await wait(400);
    const hoverClosed = !pop.hasAttribute('open');

    // manual：点击不该开，show() 才开
    pop.setAttribute('trigger', 'manual');
    inst.hide();
    await wait(150);
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await wait(200);
    const manualClickIgnored = !pop.hasAttribute('open');
    inst.show();
    await wait(200);
    const manualShowed = pop.hasAttribute('open');
    inst.hide();
    return { clickOpened, clickClosed, hoverOpened, hoverClosed, manualClickIgnored, manualShowed, anchorCenter };
  });
  check(
    'trigger="click"：点触发元素开合',
    triggerBehavior.clickOpened === true && triggerBehavior.clickClosed === true,
    JSON.stringify(triggerBehavior),
  );
  check(
    'trigger="hover"：移入开、移出关',
    triggerBehavior.hoverOpened === true && triggerBehavior.hoverClosed === true,
    JSON.stringify(triggerBehavior),
  );
  check(
    'trigger="manual"：点触发元素没反应，只有 show() / open 属性管用',
    triggerBehavior.manualClickIgnored === true && triggerBehavior.manualShowed === true,
    JSON.stringify(triggerBehavior),
  );

  /* ------------------------------------------------------------------ *
   * 5. open 属性受控 + 原生 light-dismiss 双向同步 + 事件只发一次
   * ------------------------------------------------------------------ */
  const controlled = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const pop = window.__pop;
    const panel = pop.shadowRoot.querySelector('.mc-panel');
    pop.setAttribute('trigger', 'manual');
    const events = [];
    for (const type of ['before-open', 'open', 'close']) {
      pop.addEventListener(type, (e) => events.push(`${type}:${e.detail?.reason ?? ''}`));
    }

    pop.setAttribute('open', '');
    await wait(240);
    const afterAttrOn = panel.matches(':popover-open');
    pop.removeAttribute('open');
    await wait(240);
    const afterAttrOff = panel.matches(':popover-open');

    // preventDefault 拦掉打开
    const stop = (e) => e.preventDefault();
    pop.addEventListener('before-open', stop);
    $(pop).show();
    await wait(200);
    const blocked = !pop.hasAttribute('open');
    pop.removeEventListener('before-open', stop);

    // 原生 light-dismiss（Esc）→ 属性要跟着回来
    $(pop).show();
    await wait(200);
    panel.hidePopover();
    await wait(240);
    const afterDismiss = pop.hasAttribute('open');

    return { afterAttrOn, afterAttrOff, blocked, afterDismiss, events };
  });
  check(
    'open 属性受控：写上即开、移除即关；before-open 的 preventDefault 能拦掉',
    controlled.afterAttrOn === true && controlled.afterAttrOff === false && controlled.blocked === true,
    JSON.stringify(controlled),
  );
  check(
    '原生 light-dismiss（Esc / 点空白）关掉后，open 属性也跟着回来',
    controlled.afterDismiss === false,
    JSON.stringify({ afterDismiss: controlled.afterDismiss }),
  );
  const closeCount = controlled.events.filter((e) => e.startsWith('close:')).length;
  check(
    'close 事件只有一个出口：两次关闭只发两条 close（API 与原生 toggle 不重复发）',
    closeCount === 2,
    JSON.stringify(controlled.events),
  );

  /* ------------------------------------------------------------------ *
   * 6. 祖先带 transform 也不受影响（这是用原生 popover 的根本理由）
   * ------------------------------------------------------------------ */
  const underTransform = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const wrap = document.createElement('div');
    /* ⚠️ 用 fixed 定位把它钉在视口里：正文的滚动在外壳的 .doc-main 里（不是 window），
       写在文档流里会被滚出视口 → 面板按设计翻转，量到的就不是"被困住"了。
       fixed + transform 正好构成本组件要防的那个场景（祖先层叠上下文）。 */
    wrap.style.cssText =
      'position: fixed; left: 0; top: 60px; transform: translateZ(0); padding: 0 120px; display: inline-block;';
    document.body.append(wrap);
    const host = document.createElement('mc-popover');
    host.setAttribute('placement', 'bottom-start');
    host.innerHTML = '<button>t</button><div slot="panel">面板</div>';
    wrap.append(host);
    await wait(150);
    $(host).show();
    await wait(300);
    /* 锚点的几何 = 面板的定位基准，所以用锚点容器（而不是按钮）来对账 */
    const anchor = host.shadowRoot.querySelector('.mc-anchor').getBoundingClientRect();
    const p = host.shadowRoot.querySelector('.mc-panel').getBoundingClientRect();
    const opened = host.shadowRoot.querySelector('.mc-panel').matches(':popover-open');
    // 面板相对锚点贴合 = 没被困住（被困住时会跑到祖先坐标系里）
    const aligned = Math.abs(p.top - (anchor.bottom + 8)) <= 1.5 && Math.abs(p.left - anchor.left) <= 1.5;
    const noFlip = p.top >= anchor.bottom; // 往下的方向没被翻到上面去
    host.remove();
    wrap.remove();
    return { opened, aligned, noFlip, panelTop: Math.round(p.top), anchorBottom: Math.round(anchor.bottom), anchorLeft: Math.round(anchor.left), panelLeft: Math.round(p.left) };
  });
  check(
    '祖先带 transform 时面板仍贴着触发元素（top layer 不受层叠上下文影响）',
    underTransform.opened === true && underTransform.aligned === true && underTransform.noFlip === true,
    JSON.stringify(underTransform),
  );

  /* ------------------------------------------------------------------ *
   * 7. 箭头：交叉轴对齐**触发元素**（不是面板），翻转到另一侧时贴对边
   *    实测踩过两个坑：① 对着面板居中 → 面板比触发元素宽时箭头飘到中间；
   *    ② 按 placement 写死边 → 面板被浏览器翻转后箭头留在错的那条边
   * ------------------------------------------------------------------ */
  await makePopover({ arrow: '', placement: 'bottom-start' });
  await wait(200);
  const arrowMath = await page.evaluate(async (list) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const pop = window.__pop;
    const inst = $(pop);
    const results = [];
    for (const placement of list) {
      pop.setAttribute('placement', placement);
      inst.show();
      await wait(360); // 等进场动画结束：动画期间面板坐标是中间值，量出来会偏
      const panel = pop.shadowRoot.querySelector('.mc-panel');
      const arrow = pop.shadowRoot.querySelector('.mc-arrow');
      const trigger = pop.querySelector('button');
      const pr = panel.getBoundingClientRect();
      const ar = arrow.getBoundingClientRect();
      const tr = trigger.getBoundingClientRect();
      const axis = placement.startsWith('top') || placement.startsWith('bottom') ? 'y' : 'x';
      const cross =
        axis === 'y'
          ? Math.abs((ar.x + ar.right) / 2 - (tr.x + tr.right) / 2)
          : Math.abs((ar.y + ar.bottom) / 2 - (tr.y + tr.bottom) / 2);
      const side = panel.dataset.side;
      const cs = getComputedStyle(arrow);
      const onEdge =
        side === 'bottom'
          ? Math.abs(ar.top - pr.top) < 12
          : side === 'top'
            ? Math.abs(ar.bottom - pr.bottom) < 12
            : side === 'left'
              ? Math.abs(ar.right - pr.right) < 12
              : Math.abs(ar.left - pr.left) < 12;
      /* ⚠️ 光量几何不够：UA 给 `[popover]` 的默认样式带 `overflow: auto`，会把伸出面板的
         三角**裁掉** —— 那时 getBoundingClientRect 一切正常，肉眼却看不到箭头（实测踩过，
         右侧那个方向完全看不见）。所以这里同时检测「贴边那一侧确实超出面板边缘」。 */
      const protrudes =
        side === 'bottom'
          ? pr.top - ar.top
          : side === 'top'
            ? ar.bottom - pr.bottom
            : side === 'left'
              ? ar.right - pr.right
              : pr.left - ar.left;
      results.push({
        placement,
        side,
        cross: +cross.toFixed(1),
        onEdge,
        protrudes: +protrudes.toFixed(1),
        /* ⚠️ 三角是「填充三角 + clip-path」，**不是**旋转 45° 的方块。一旦 element 上还留着
           `rotate`，围盒会被撑大（12px 的方块转 45° → 17px），但**中心不变** —— 上面那几条
           只看中心 / 贴边的断言会全绿（这个回归就是这么漏掉的），所以这里单独盯旋转与边框残留。 */
        rotate: cs.rotate,
        bboxDelta: +Math.abs(ar.width - arrow.offsetWidth).toFixed(2),
        clip: cs.clipPath.replace(/\s+/g, ' '),
        border: `${cs.borderRightWidth}/${cs.borderBottomWidth}`,
      });
      inst.hide();
      await wait(120);
    }
    return results;
  }, placements);

  /* protrudes > 2 才算真的露在外面（三角半宽 6px，能被裁掉就说明 overflow 没放开） */
  const arrowBad = arrowMath.filter((a) => a.cross > 1.5 || !a.onEdge || a.protrudes < 2);
  check(
    '箭头交叉轴对齐触发元素中心、贴在正确的边上、且真的露在面板外（12 个方向，防 overflow 裁切）',
    arrowMath.length === 12 && arrowBad.length === 0,
    arrowBad.length ? JSON.stringify(arrowBad) : JSON.stringify(arrowMath.slice(0, 3)),
  );

  /* 形状这条单独一检：三角必须是**没被转动**的填充三角，且四个方向各自朝外。
     起因是一次真实回归 —— 箭头从「旋转方块 + 两条边框」改成 clip-path 时，旧规则没删干净，
     `rotate: 45deg` 与两条边框继续生效，三角被转了 45°、尖歪到一边（用户一眼看出「箭头偏了」），
     而上面那条几何断言**全绿**（旋转后的围盒中心仍在触发元素中心上）。 */
  const EXPECTED_CLIP = {
    bottom: 'polygon(50% 0px, 100% 100%, 0px 100%)',
    top: 'polygon(0px 0px, 100% 0px, 50% 100%)',
    left: 'polygon(0px 0px, 100% 50%, 0px 100%)',
    right: 'polygon(100% 0px, 0px 50%, 100% 100%)',
  };
  const arrowShapeBad = arrowMath.filter(
    (a) =>
      a.rotate !== 'none' || a.bboxDelta > 0.5 || a.border !== '0px/0px' || a.clip !== EXPECTED_CLIP[a.side],
  );
  check(
    '三角形状是对的：没被 rotate 撑开 / 没有旧边框残留，四个方向各自朝外',
    arrowMath.length === 12 && arrowShapeBad.length === 0,
    arrowShapeBad.length ? JSON.stringify(arrowShapeBad) : '12 个方向的三角形状一致',
  );

  /* 翻转：把触发元素顶到视口右下角，面板会翻到另一侧 —— 箭头必须**跟着换边** */
  await page.evaluate(() => {
    const pop = window.__pop;
    pop.style.cssText = 'position: fixed; right: 4px; bottom: 4px;';
  });
  await page.evaluate(async () => {
    const pop = window.__pop;
    pop.setAttribute('placement', 'bottom-start');
    $(pop).show();
    await new Promise((r) => setTimeout(r, 420));
  });
  const flippedArrow = await page.evaluate(() => {
    const pop = window.__pop;
    const panel = pop.shadowRoot.querySelector('.mc-panel');
    const arrow = pop.shadowRoot.querySelector('.mc-arrow');
    const tr = pop.querySelector('button').getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const ar = arrow.getBoundingClientRect();
    const side = panel.dataset.side;
    return {
      side,
      flipped: side === 'top', // 贴着底边时应当翻到上方
      onFlippedEdge: side === 'top' ? Math.abs(ar.bottom - pr.bottom) < 12 : false,
      insideViewport: pr.top >= 0 && pr.bottom <= innerHeight && pr.right <= innerWidth,
    };
  });
  check(
    '面板被翻转时箭头跟着换边（贴底边 → 翻到上方 → 箭头贴在面板下沿）',
    flippedArrow.flipped === true && flippedArrow.onFlippedEdge === true && flippedArrow.insideViewport === true,
    JSON.stringify(flippedArrow),
  );

  /* 令牌 + reduced-motion */
  const arrow = await page.evaluate(() => {
    const pop = window.__pop;
    const el = pop.shadowRoot.querySelector('.mc-arrow');
    const panel = pop.shadowRoot.querySelector('.mc-panel');
    const panelCs = getComputedStyle(panel);
    return {
      display: getComputedStyle(el).display,
      size: Math.round(el.getBoundingClientRect().width),
      panelBg: panelCs.backgroundColor,
      radius: panelCs.borderTopLeftRadius,
      fontFamily: panelCs.fontFamily.split(',')[0],
      /* ⚠️ UA 给 `[popover]` 的是 `border: solid`（宽度 medium = 3px、颜色 currentColor）：
         面板不显式写 `border: 0` 就会长出一圈 3px 边框（实测亮色 rgb(60 67 77)）。 */
      border: `${panelCs.borderTopWidth} ${panelCs.borderTopStyle}`,
      /* 描边改由 drop-shadow 跟「面板 + 三角」的整体轮廓做：两层，第一层是描边 */
      filter: panelCs.filter,
    };
  });
  check(
    'arrow 渲染出小三角（8–20px）',
    arrow.display === 'block' && arrow.size >= 8 && arrow.size <= 20,
    JSON.stringify(arrow),
  );
  check(
    '面板样式走令牌（背景是 surface 色、圆角、字体都是项目令牌）',
    /^rgb\(/.test(arrow.panelBg) && /px$/.test(arrow.radius) && /system-ui|-apple-system/.test(arrow.fontFamily),
    JSON.stringify(arrow),
  );
  /* 面板不画真边框（UA 那条 `border: solid` 必须被显式清零），描边由 drop-shadow 跟整体轮廓做 ——
     两层阴影里的第一层就是那圈描边，少了它面板边缘只能靠投影，三角也会显得塌。 */
  check(
    '面板没有真边框（UA 的 `border: solid` 已清零），描边走两层 drop-shadow',
    arrow.border === '0px none' &&
      /^drop-shadow\(/.test(arrow.filter) &&
      (arrow.filter.match(/drop-shadow\(/g) ?? []).length === 2,
    JSON.stringify({ border: arrow.border, filter: arrow.filter }),
  );
  const animation = await page.evaluate(() => {
    const panel = window.__pop.shadowRoot.querySelector('.mc-panel');
    const arrow = window.__pop.shadowRoot.querySelector('.mc-arrow');
    const cs = getComputedStyle(panel);
    return {
      panelAnimation: cs.animationName,
      panelTransition: cs.transitionDuration,
      arrowTransition: getComputedStyle(arrow).transitionDuration,
    };
  });
  check(
    '浮层不做动画（有意）：面板与三角都没有 animation / transition',
    animation.panelAnimation === 'none' &&
      (animation.panelTransition === '0s' || animation.panelTransition === '0s, 0s') &&
      (animation.arrowTransition === '0s' || animation.arrowTransition === '0s, 0s'),
    JSON.stringify(animation),
  );
  await hide();
  await dropPopover();

  /* ------------------------------------------------------------------ *
   * 8. 说明：面板打开时在 top layer，关闭时不参与布局
   * ------------------------------------------------------------------ */
  await makePopover({}, '<button>t</button>', 'panel');
  await wait(200);
  const layout = await page.evaluate(async () => {
    const pop = window.__pop;
    const panel = pop.shadowRoot.querySelector('.mc-panel');
    const closedDisplay = getComputedStyle(panel).display;
    const closedRect = panel.getBoundingClientRect().height;
    $(pop).show();
    await new Promise((r) => setTimeout(r, 260));
    const openDisplay = getComputedStyle(panel).display;
    const openRect = panel.getBoundingClientRect().height;
    return { closedDisplay, closedRect: Math.round(closedRect), openDisplay, openRect: Math.round(openRect) };
  });
  check(
    '关闭时面板 display:none 不占位，打开后有尺寸',
    layout.closedDisplay === 'none' && layout.closedRect === 0 && layout.openDisplay !== 'none' && layout.openRect > 0,
    JSON.stringify(layout),
  );
  await dropPopover();

  /* ------------------------------------------------------------------ *
   * 9. 文档页本身：演示渲染出来了，点了真的会弹（顺带让依赖地图记下
   *    「popover 套件碰过 packages/popover/page.html」这条边）
   * ------------------------------------------------------------------ */
  await visit(page, `/index.html?popover-page=${Date.now()}#/packages/popover/page.html`);
  await page
    .waitForFunction(() => !!window.__deep('demo-popover-placement')?.shadowRoot, { timeout: 10000 })
    .catch(() => {});
  const docPage = await page.evaluate(async () => {
    const demo = window.__deep('demo-popover-placement');
    const buttons = [...(demo?.shadowRoot?.querySelectorAll('mc-button') ?? [])];
    const heading = window.__deep('.doc-body h1')?.textContent?.trim() ?? null;
    buttons[0]?.click();
    await new Promise((r) => setTimeout(r, 500));
    /* ⚠️ 演示组件在页面模块的 shadow root 里，必须用穿透查询找它里面的 popover */
    const pop = demo.shadowRoot.querySelector('mc-popover');
    const panel = pop?.shadowRoot?.querySelector('.mc-panel');
    return { heading, buttons: buttons.length, opened: panel?.matches(':popover-open') ?? false };
  });
  check(
    '文档页：标题与演示都在，点演示按钮真的弹出面板',
    /^Popover/.test(docPage.heading ?? '') && docPage.buttons >= 4 && docPage.opened === true,
    JSON.stringify(docPage),
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('popover 相关页面没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
