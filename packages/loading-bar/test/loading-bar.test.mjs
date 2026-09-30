/**
 * mc-loading-bar · 加载条：首帧没在跑就必须干干净净（不出现、不带语义、不播收尾动画）、
 * active 的状态机（data-on / data-done / 语义三连）、铺满视口宽度与两档条高、
 * **pointer-events 必须是 none**（不只信计算样式，还要跨 shadow 真做一次命中测试）、
 * 语义色 == 令牌 与 hex、收尾不闪回 0 且淡出播完自己复位、爬升终点不是 100%
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
        success: rgb('--mc-color-success'),
        danger: rgb('--mc-color-danger'),
      };
    });

    /* 探针：一条没在跑的（首帧）+ 几条在跑的（几何 / 颜色 / 条高）。
       ⚠️ 它们都是 position:fixed 钉在顶部，会互相叠着 —— 但宿主 pointer-events:none，
          所以既挡不住点击，也不影响各自的几何量测。 */
    await page.evaluate(() => {
      /* ⚠️ 直接挂到 body 上，**不要套一层带 z-index 的容器**：那会形成层叠上下文，
         把条子（组件自己的 z-index 1500）压到外壳顶栏（sticky 1100）下面 ——
         命中测试就永远打不到条子，那条守卫也就失去了鉴别力（实测踩过）。 */
      document.body.insertAdjacentHTML(
        'beforeend',
        '<mc-loading-bar id="lb-idle" label="待命"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-md" active></mc-loading-bar>' +
          '<mc-loading-bar id="lb-sm" active size="sm"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-info" active color="info"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-hex" active color="#ff6b00" style="position: static"></mc-loading-bar>' +
          '<mc-loading-bar id="lb-label" active label="正在保存"></mc-loading-bar>',
      );

      /* 命中测试用：铺满顶部 8px 的一颗原生按钮 —— 条子若吃掉指针，点它就点不着了 */
      const under = document.createElement('button');
      under.id = 'lb-under';
      under.textContent = 'x';
      /* 1200：压过外壳顶栏（sticky 1100），但低于条子的 1500 —— 这样「点得到按钮」
         才真的说明条子没吃指针，而不是「那个点上恰好是别人」 */
      under.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:8px;z-index:1200';
      document.body.append(under);
      window.__lbUnderClicks = 0;
      under.addEventListener('click', () => {
        window.__lbUnderClicks++;
      });
    });
    await page
      .waitForFunction(
        () =>
          ['lb-idle', 'lb-md', 'lb-sm', 'lb-info', 'lb-hex', 'lb-label'].every(
            (id) => !!document.getElementById(id)?.shadowRoot,
          ),
        { timeout: 5000 },
      )
      .catch(() => {});

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const cs = (id) => getComputedStyle(el(id));
      const inner = (id) => getComputedStyle(el(id).shadowRoot.querySelector('.mc-bar'));
      const rect = (id) => el(id).getBoundingClientRect();
      const idle = el('lb-idle');
      return {
        idle: {
          attrs: ['data-on', 'data-done', 'role', 'aria-busy', 'aria-label'].filter((a) =>
            idle.hasAttribute(a),
          ),
          visibility: cs('lb-idle').visibility,
          opacity: cs('lb-idle').opacity,
          barWidth: Math.round(parseFloat(inner('lb-idle').width)),
        },
        active: {
          dataOn: el('lb-md').hasAttribute('data-on'),
          dataDone: el('lb-md').hasAttribute('data-done'),
          role: el('lb-md').getAttribute('role'),
          busy: el('lb-md').getAttribute('aria-busy'),
          label: el('lb-md').getAttribute('aria-label'),
          customLabel: el('lb-label').getAttribute('aria-label'),
          visibility: cs('lb-md').visibility,
        },
        geometry: {
          viewport: window.innerWidth,
          mdWidth: Math.round(rect('lb-md').width),
          mdTop: Math.round(rect('lb-md').top),
          mdHeight: Math.round(rect('lb-md').height),
          smHeight: Math.round(rect('lb-sm').height),
        },
        colors: {
          md: inner('lb-md').backgroundColor,
          info: inner('lb-info').backgroundColor,
          hex: inner('lb-hex').backgroundColor,
          pointerEvents: cs('lb-md').pointerEvents,
        },
        tokens: {
          reach: cs('lb-md').getPropertyValue('--mc-loading-bar-reach').trim(),
          creep: inner('lb-md').animationDuration,
          z: cs('lb-md').zIndex,
        },
        structure: {
          parts: [...el('lb-md').shadowRoot.querySelectorAll('[part]')].map(
            (n) => n.getAttribute('part'),
          ),
          barHidden: el('lb-md')
            .shadowRoot.querySelector('.mc-bar')
            .getAttribute('aria-hidden'),
          slots: el('lb-md').shadowRoot.querySelectorAll('slot').length,
        },
      };
    });

    /* 跨 shadow 的命中测试：document.elementFromPoint 只会给到最外层宿主，
       要一层层钻进 shadowRoot 才能知道「那一点上真正接到指针的是谁」。
       宿主 pointer-events:none 的话，条子根本不会出现在这条链上。 */
    const hit = await page.evaluate(() => {
      const deepest = (x, y) => {
        let el = document.elementFromPoint(x, y);
        while (el?.shadowRoot) {
          const inner = el.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === el) break;
          el = inner;
        }
        return el;
      };
      const isBar = (el) => {
        let node = el;
        while (node && node.tagName !== 'MC-LOADING-BAR') {
          node = node.parentElement ?? node.getRootNode()?.host ?? null;
        }
        return !!node;
      };
      const before = deepest(200, 2); // 条子那 4px 高度上的一点
      /* 伪证：把一条的 pointer-events 强行改回 auto —— 命中测试**必须**打到条子。
         没有这一步，上面「没打到条子」既可能是它不吃指针、也可能是那个点上根本轮不到它。 */
      const forcedBar = document.getElementById('lb-md');
      forcedBar.style.pointerEvents = 'auto';
      const forced = deepest(200, 2);
      forcedBar.style.pointerEvents = '';
      return {
        tag: before?.tagName?.toLowerCase() ?? null,
        className: before?.className ?? null,
        reachedBar: isBar(before),
        forcedReachedBar: isBar(forced),
      };
    });
    await page.mouse.click(200, 2);
    await page.waitForTimeout(120);
    const underClicks = await page.evaluate(() => window.__lbUnderClicks);

    /* 收尾：active 关掉 → 冻住爬升的位置 → 滑满 → 淡出 → 播完自己复位（不闪回 0） */
    const finish = await (async () => {
      await page.evaluate(() => {
        document.getElementById('lb-md').setAttribute('width-probe', '');
        document.getElementById('lb-md').toggleAttribute('active', false);
      });
      const during = await page.evaluate(() => {
        const el = document.getElementById('lb-md');
        return {
          dataDone: el.hasAttribute('data-done'),
          width: Math.round(parseFloat(getComputedStyle(el.shadowRoot.querySelector('.mc-bar')).width)),
        };
      });
      await page.waitForTimeout(900); // 淡出 = 280ms × 1.2
      const after = await page.evaluate(() => {
        const el = document.getElementById('lb-md');
        return {
          attrs: ['data-on', 'data-done', 'role', 'aria-busy', 'aria-label'].filter((a) =>
            el.hasAttribute(a),
          ),
          width: Math.round(
            parseFloat(getComputedStyle(el.shadowRoot.querySelector('.mc-bar')).width),
          ),
          inline: el.shadowRoot.querySelector('.mc-bar').style.width,
        };
      });
      return { during, after };
    })();

    /* 再开一次：复位之后应当能从 0 重新爬（不是停在上一轮的 100%） */
    await page.evaluate(() => document.getElementById('lb-md').setAttribute('active', ''));
    await page.waitForTimeout(120);
    const restart = await page.evaluate(() => {
      const el = document.getElementById('lb-md');
      return {
        dataOn: el.hasAttribute('data-on'),
        dataDone: el.hasAttribute('data-done'),
        width: Math.round(
          parseFloat(getComputedStyle(el.shadowRoot.querySelector('.mc-bar')).width),
        ),
      };
    });

    await page.evaluate(() => {
      document.getElementById('lb-probe')?.remove();
      document.getElementById('lb-under')?.remove();
    });

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { tokens, probe, hit, underClicks, finish, restart, failed };
  })();

  check(
    '首帧没写 active 就干干净净：不出现、不带语义、也不播收尾动画（否则每次打开页面都会闪一下）',
    bar.probe.idle.attrs.length === 0 &&
      bar.probe.idle.visibility === 'hidden' &&
      bar.probe.idle.opacity === '0' &&
      bar.probe.idle.barWidth === 0,
    JSON.stringify(bar.probe.idle),
  );

  check(
    'active → [data-on] + role="progressbar" + aria-busy + aria-label（默认「加载中」，自定义跟着 label）',
    bar.probe.active.dataOn === true &&
      bar.probe.active.dataDone === false &&
      bar.probe.active.role === 'progressbar' &&
      bar.probe.active.busy === 'true' &&
      bar.probe.active.label === '加载中' &&
      bar.probe.active.customLabel === '正在保存' &&
      bar.probe.active.visibility === 'visible',
    JSON.stringify(bar.probe.active),
  );

  check(
    '铺满视口宽度、贴在顶上；md 4px / sm 2px（它不是控件，不借 --mc-control-h-*）',
    bar.probe.geometry.mdWidth === bar.probe.geometry.viewport &&
      bar.probe.geometry.mdTop === 0 &&
      bar.probe.geometry.mdHeight === 4 &&
      bar.probe.geometry.smHeight === 2,
    JSON.stringify(bar.probe.geometry),
  );

  check(
    '宿主 pointer-events: none —— 跨 shadow 真的命中测试：那一点上接指针的不是条子，底下那颗按钮点得到',
    bar.probe.colors.pointerEvents === 'none' &&
      bar.hit.reachedBar === false &&
      bar.hit.forcedReachedBar === true &&
      bar.hit.tag === 'button' &&
      bar.underClicks === 1,
    JSON.stringify({ ...bar.hit, underClicks: bar.underClicks, pe: bar.probe.colors.pointerEvents }),
  );

  check(
    'color：五个语义色 == 各自令牌，hex 也写进同一个色槽；结构与约定一致（part="bar"、图形 aria-hidden、无插槽）',
    bar.probe.colors.md === bar.tokens.primary &&
      bar.probe.colors.info === bar.tokens.info &&
      bar.probe.colors.hex === 'rgb(255, 107, 0)' &&
      JSON.stringify(bar.probe.structure.parts) === JSON.stringify(['bar']) &&
      bar.probe.structure.barHidden === 'true' &&
      bar.probe.structure.slots === 0,
    JSON.stringify({ ...bar.probe.colors, ...bar.probe.structure }),
  );

  check(
    '收尾不闪回 0：先冻住爬升的位置再滑满，淡出播完自己复位（data-on / data-done / 语义三连一起撤）',
    bar.finish.during.dataDone === true &&
      bar.finish.during.width > 0 &&
      bar.finish.after.attrs.length === 0 &&
      bar.finish.after.width === 0 &&
      bar.finish.after.inline === '',
    JSON.stringify(bar.finish),
  );

  check(
    '复位之后再 active 能从 0 重新爬（不是停在上一轮的 100%）',
    bar.restart.dataOn === true && bar.restart.dataDone === false && bar.restart.width < 200,
    JSON.stringify(bar.restart),
  );

  check(
    '爬升终点是 90% 而不是 100%（到 100% 就成了「卡住」），时长与层级都走令牌',
    bar.probe.tokens.reach === '90%' &&
      parseFloat(bar.probe.tokens.creep) > 1 &&
      Number(bar.probe.tokens.z) >= 1000,
    JSON.stringify(bar.probe.tokens),
  );

  check('加载条文档页没有 404 / 运行时报错', bar.failed.length === 0, bar.failed.join(' | ') || '无');
}
