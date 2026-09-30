/**
 * mc-loading-bar · 加载条：状态只有一个入口 `state`（idle / loading / done / error）——
 * idle 什么都不做、loading 出现并爬升且挂语义三连、done 与 error 是**同一条收尾**
 * （先滑到 100% 再淡出，只有填充色不同）、中途切状态不闪回 0、复位后能重新爬；
 * 另有：铺满视口 / 贴在顶上、两档条高、容器里那一种落在容器内、
 * **pointer-events 必须是 none**（跨 shadow 真命中测试 + 伪证）、
 * 填充色跟着主题走（没有 color 属性，要换色是覆盖令牌）。
 */

export default async function run({ page, visit, check }) {
  const bar = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?loading-bar=1#/packages/loading-bar/page.html');
    await page
      .waitForFunction(() => !!customElements.get('mc-loading-bar'), { timeout: 8000 })
      .catch(() => {});

    /** 令牌解析：组件的颜色是 rgb(var(--mc-…))，期望值要按当前主题算 */
    const tokens = await page.evaluate(() => {
      const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const rgb = (name) => `rgb(${read(name).split(/\s+/).join(', ')})`;
      return {
        primary: rgb('--mc-color-primary'),
        info: rgb('--mc-color-info'),
        danger: rgb('--mc-color-danger'),
        warning: rgb('--mc-color-warning'),
      };
    });

    /* 探针：四种状态各一条 + 尺寸 / 颜色 / 容器里那一种。
       ⚠️ 直接挂 body，**不要套带 z-index 的容器** —— 那会形成层叠上下文，把条子（自己的
          z-index 1500）压到外壳顶栏（sticky 1100）下面，命中测试就永远打不到它。 */
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<mc-loading-bar id="lb-idle"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-loading" state="loading" label="正在加载"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-sm" state="loading" size="sm"></mc-loading-bar>' +
          /* 换色走令牌（没有 color 属性）：这条把出错色槽覆盖成 warning */
          '<mc-loading-bar id="lb-tone" state="error" style="--mc-loading-bar-error: var(--mc-color-warning)"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-done" state="done"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-error" state="error"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-error-custom" state="error" color="warning"></mc-loading-bar>',
      );

      /* 容器里那一种：整盒 260px 宽、贴在顶 200px 处 */
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div id="lb-inline-box" style="position:fixed;left:0;top:200px;width:260px;z-index:1">' +
          '<mc-loading-bar id="lb-inline" state="loading" position="static" label="这一块在忙"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-inline-sm" state="loading" position="static" size="sm"></mc-loading-bar>' +
          '</div>',
      );

      /* 命中测试用：铺满顶部 8px 的一颗原生按钮 —— 条子若吃掉指针，点它就点不着了。
         z-index 1200：压过外壳顶栏（sticky 1100）但低于条子的 1500，这样「点得到按钮」
         才真的说明条子没吃指针，而不是「那个点上恰好是别人」。 */
      document.body.insertAdjacentHTML(
        'beforeend',
        '<button id="lb-under" style="position:fixed;left:0;top:0;width:100%;height:8px;z-index:1200">x</button>',
      );
      window.__lbUnderClicks = 0;
      document.getElementById('lb-under').addEventListener('click', () => {
        window.__lbUnderClicks++;
      });
    });
    await page
      .waitForFunction(
        () =>
          ['lb-idle', 'lb-loading', 'lb-sm', 'lb-tone', 'lb-inline', 'lb-done'].every(
            (id) => !!document.getElementById(id)?.shadowRoot,
          ),
        { timeout: 5000 },
      )
      .catch(() => {});

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const cs = (id) => getComputedStyle(el(id));
      const barOf = (id) => el(id).shadowRoot.querySelector('.mc-bar');
      const inner = (id) => getComputedStyle(barOf(id));
      const rect = (id) => el(id).getBoundingClientRect();
      return {
        idle: {
          attrs: ['role', 'aria-busy', 'aria-label'].filter((a) => el('lb-idle').hasAttribute(a)),
          visibility: cs('lb-idle').visibility,
          opacity: cs('lb-idle').opacity,
          width: Math.round(parseFloat(inner('lb-idle').width)),
        },
        loading: {
          visibility: cs('lb-loading').visibility,
          role: el('lb-loading').getAttribute('role'),
          busy: el('lb-loading').getAttribute('aria-busy'),
          label: el('lb-loading').getAttribute('aria-label'),
          reach: cs('lb-loading').getPropertyValue('--mc-loading-bar-reach').trim(),
          creep: inner('lb-loading').transitionDuration,
          z: cs('lb-loading').zIndex,
        },
        geometry: {
          viewport: window.innerWidth,
          width: Math.round(rect('lb-loading').width),
          top: Math.round(rect('lb-loading').top),
          height: Math.round(rect('lb-loading').height),
          smHeight: Math.round(rect('lb-sm').height),
        },
        fill: {
          loading: inner('lb-loading').backgroundColor,
          pointerEvents: cs('lb-loading').pointerEvents,
        },
        inline: {
          position: cs('lb-inline').position,
          width: Math.round(rect('lb-inline').width),
          boxWidth: Math.round(rect('lb-inline-box').width),
          topOffset: Math.round(rect('lb-inline').top - rect('lb-inline-box').top),
          height: Math.round(rect('lb-inline').height),
          smHeight: Math.round(rect('lb-inline-sm').height),
          role: el('lb-inline').getAttribute('role'),
          label: el('lb-inline').getAttribute('aria-label'),
          visibility: cs('lb-inline').visibility,
          viewport: window.innerWidth,
        },
        structure: {
          parts: [...el('lb-loading').shadowRoot.querySelectorAll('[part]')].map((n) =>
            n.getAttribute('part'),
          ),
          barHidden: barOf('lb-loading').getAttribute('aria-hidden'),
          slots: el('lb-loading').shadowRoot.querySelectorAll('slot').length,
        },
      };
    });

    /* 跨 shadow 的命中测试：document.elementFromPoint 只会给到最外层宿主，
       要一层层钻进 shadowRoot 才知道「那一点上真正接到指针的是谁」。
       宿主 pointer-events:none 的话，条子根本不会出现在这条链上。 */
    const hit = await page.evaluate(() => {
      const deepest = (x, y) => {
        let node = document.elementFromPoint(x, y);
        while (node?.shadowRoot) {
          const inner = node.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === node) break;
          node = inner;
        }
        return node;
      };
      const isBar = (node) => {
        let at = node;
        while (at && at.tagName !== 'MC-LOADING-BAR') {
          at = at.parentElement ?? at.getRootNode()?.host ?? null;
        }
        return !!at;
      };
      const before = deepest(200, 2); // 条子那 4px 高度上的一点
      /* 伪证：把一条的 pointer-events 强行改回 auto —— 命中测试**必须**打到条子。
         没有这一步，上面「没打到条子」既可能是它不吃指针、也可能是那个点上根本轮不到它。 */
      const forcedBar = document.getElementById('lb-loading');
      forcedBar.style.pointerEvents = 'auto';
      const forced = deepest(200, 2);
      forcedBar.style.pointerEvents = '';
      return {
        tag: before?.tagName?.toLowerCase() ?? null,
        reachedBar: isBar(before),
        forcedReachedBar: isBar(forced),
      };
    });
    await page.mouse.click(200, 2);
    await page.waitForTimeout(120);
    const underClicks = await page.evaluate(() => window.__lbUnderClicks);

    /** 一条条子当下的样子：宽度 / 色 / 可见性 / 语义 */
    const readBar = (id) =>
      page.evaluate((x) => {
        const el = document.getElementById(x);
        const inner = el.shadowRoot.querySelector('.mc-bar');
        return {
          attrs: ['role', 'aria-busy', 'aria-label'].filter((a) => el.hasAttribute(a)),
          width: Math.round(parseFloat(getComputedStyle(inner).width)),
          hostWidth: Math.round(el.getBoundingClientRect().width),
          fill: getComputedStyle(inner).backgroundColor,
          visibility: getComputedStyle(el).visibility,
          opacity: Math.round(parseFloat(getComputedStyle(el).opacity) * 100) / 100,
        };
      }, id);

    /* done 与 error 是同一个收尾：同时刻量它们，除颜色外应当处处一样 */
    await page.waitForTimeout(250); // 落在「滑满已结束、淡出还没走完」的窗口里
    const doneMid = await readBar('lb-done');
    const errorMid = await readBar('lb-error');
    const toneMid = await readBar('lb-tone');
    await page.waitForTimeout(1200);
    const doneEnd = await readBar('lb-done');
    const errorEnd = await readBar('lb-error');

    /* 中途切状态：先跑起来，再在爬升途中换成 error —— 宽度必须从当前位置接着走 */
    const handoff = await (async () => {
      await page.evaluate(() => {
        const el = document.getElementById('lb-loading');
        el.setAttribute('state', 'loading');
      });
      await page.waitForTimeout(300);
      const before = await readBar('lb-loading');
      await page.evaluate(() => document.getElementById('lb-loading').setAttribute('state', 'error'));
      await page.waitForTimeout(60);
      const right = await readBar('lb-loading');
      await page.waitForTimeout(190);
      const reached = await readBar('lb-loading');
      await page.waitForTimeout(1200);
      const end = await readBar('lb-loading');
      return { before, right, reached, end };
    })();

    /* 复位之后再 loading：必须从 0 重新爬（不是停在上一轮的 100%） */
    await page.evaluate(() => document.getElementById('lb-loading').setAttribute('state', 'loading'));
    await page.waitForTimeout(120);
    const restarted = await readBar('lb-loading');

    await page.evaluate(() => {
      for (const id of ['lb-under', 'lb-inline-box']) document.getElementById(id)?.remove();
    });

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return {
      tokens,
      probe,
      hit,
      underClicks,
      doneMid,
      errorMid,
      toneMid,
      doneEnd,
      errorEnd,
      handoff,
      restarted,
      failed,
    };
  })();

  check(
    'idle（默认）什么都不做：不出现、宽度 0、也不留语义三连 —— 否则每次打开页面都会闪一下',
    bar.probe.idle.attrs.length === 0 &&
      bar.probe.idle.visibility === 'hidden' &&
      bar.probe.idle.opacity === '0' &&
      bar.probe.idle.width === 0,
    JSON.stringify(bar.probe.idle),
  );

  check(
    'loading：出现 + role="progressbar" + aria-busy + label，爬升终点是 90%（不是 100%）',
    bar.probe.loading.visibility === 'visible' &&
      bar.probe.loading.role === 'progressbar' &&
      bar.probe.loading.busy === 'true' &&
      bar.probe.loading.label === '正在加载' &&
      bar.probe.loading.reach === '90%' &&
      parseFloat(bar.probe.loading.creep) > 1 &&
      Number(bar.probe.loading.z) >= 1000,
    JSON.stringify(bar.probe.loading),
  );

  check(
    '铺满视口宽度、贴在顶上；md 4px / sm 2px（它不是控件，不借 --mc-control-h-*）',
    bar.probe.geometry.width === bar.probe.geometry.viewport &&
      bar.probe.geometry.top === 0 &&
      bar.probe.geometry.height === 4 &&
      bar.probe.geometry.smHeight === 2,
    JSON.stringify(bar.probe.geometry),
  );

  check(
    '宿主 pointer-events: none —— 跨 shadow 真命中测试：那一点上接指针的不是条子，底下那颗按钮点得到',
    bar.probe.fill.pointerEvents === 'none' &&
      bar.hit.reachedBar === false &&
      bar.hit.forcedReachedBar === true &&
      bar.hit.tag === 'button' &&
      bar.underClicks === 1,
    JSON.stringify({ ...bar.hit, underClicks: bar.underClicks }),
  );

  check(
    '填充色跟着主题走（没有 color 属性）：在跑就是主题主色；结构与约定一致（part="bar"、图形 aria-hidden、无插槽）',
    bar.probe.fill.loading === bar.tokens.primary &&
      JSON.stringify(bar.probe.structure.parts) === JSON.stringify(['bar']) &&
      bar.probe.structure.barHidden === 'true' &&
      bar.probe.structure.slots === 0,
    JSON.stringify({ ...bar.probe.fill, ...bar.probe.structure }),
  );

  check(
    'position="static"：就落在容器里（通宽 = 容器宽、占自己那 2 / 4px、不铺满视口），语义照旧',
    bar.probe.inline.position === 'static' &&
      bar.probe.inline.width === bar.probe.inline.boxWidth &&
      bar.probe.inline.width < bar.probe.inline.viewport &&
      bar.probe.inline.topOffset === 0 &&
      bar.probe.inline.height === 4 &&
      bar.probe.inline.smHeight === 2 &&
      bar.probe.inline.role === 'progressbar' &&
      bar.probe.inline.label === '这一块在忙' &&
      bar.probe.inline.visibility === 'visible',
    JSON.stringify(bar.probe.inline),
  );

  check(
    'done 与 error 是**同一条收尾**：宽度 / 可见性 / 语义处处一样，只有填充色不同（出错走主题的 danger）',
    bar.doneMid.width === bar.doneMid.hostWidth &&
      bar.errorMid.width === bar.errorMid.hostWidth &&
      bar.doneMid.width === bar.errorMid.width &&
      bar.doneMid.opacity === bar.errorMid.opacity &&
      bar.doneMid.visibility === bar.errorMid.visibility &&
      JSON.stringify(bar.doneMid.attrs) === JSON.stringify(bar.errorMid.attrs) &&
      bar.doneMid.fill === bar.tokens.primary &&
      bar.errorMid.fill === bar.tokens.danger &&
      /* 要换色是覆盖令牌（没有 color 属性）：把出错色槽换成 warning */
      bar.toneMid.fill === bar.tokens.warning &&
      /* 收尾之后：淡出到看不见、不留语义 */
      bar.doneEnd.opacity === 0 &&
      bar.errorEnd.opacity === 0 &&
      bar.errorEnd.attrs.length === 0,
    JSON.stringify({ doneMid: bar.doneMid, errorMid: bar.errorMid, tone: bar.toneMid }),
  );

  check(
    '爬升中途换成收尾：从**当前位置**接着滑（不闪回 0）→ 到 100% 且还看得清 → 再淡出消失',
    bar.handoff.before.width > 0 &&
      bar.handoff.before.width < bar.handoff.before.hostWidth &&
      bar.handoff.right.width >= bar.handoff.before.width - 2 &&
      bar.handoff.reached.width === bar.handoff.reached.hostWidth &&
      bar.handoff.reached.opacity > 0.6 &&
      bar.handoff.end.opacity === 0,
    JSON.stringify(bar.handoff),
  );

  check(
    '复位之后再 loading：从 0 重新爬（不是停在上一轮的 100%）',
    bar.restarted.width < bar.restarted.hostWidth / 2 && bar.restarted.visibility === 'visible',
    JSON.stringify(bar.restarted),
  );

  check('加载条文档页没有 404 / 运行时报错', bar.failed.length === 0, bar.failed.join(' | ') || '无');
}
