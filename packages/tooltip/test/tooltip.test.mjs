/**
 * mc-tooltip · 提示气泡：原生 popover（manual）+ CSS 锚点定位的几条不变量。
 *
 * 跑法：node tests/smoke.mjs tooltip（需先 pnpm dev）
 *
 * ⚠️ 这份套件盯的都是「静默失效」型问题 —— 气泡会弹，只是弹错位置 / 收不起来 /
 * 键盘够不到，肉眼很难当场发现：
 *   · 锚点容器必须是 inline-flex（inline-block 会带 3px 基线缝隙，整体偏移）
 *   · UA 给 `[popover]` 的 `inset: auto` / `border: solid` 必须显式清掉
 *   · 面板不能写 `display`（作者样式会压过 UA 的「关着就 display:none」）
 *   · `trigger="click"` 的「点外部」必须走 composedPath
 *
 * 探针现搭现拆（`#tooltip-probe`，固定在视口里），量完最后一个 evaluate 删掉。
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?tooltip=1#/packages/tooltip/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-tooltip'), { timeout: 8000 })
    .catch(() => {});
  await page
    .waitForFunction(() => !!customElements.get('mc-button'), { timeout: 8000 })
    .catch(() => {});
  const defined = await page.evaluate(() => !!customElements.get('mc-tooltip'));
  check('mc-tooltip 注册成功', defined === true, String(defined));

  /* ------------------------------------------------------------------ *
   * 探针：一个宿主里放齐所有要量的实例（间距开得大，免得气泡互相压）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'tooltip-probe';
    host.style.cssText =
      'position:fixed;left:120px;top:160px;z-index:99999;background:#fff;padding:56px;display:flex;gap:48px';
    host.innerHTML =
      '<mc-tooltip id="tt-hover" content="悬停提示"><button id="tt-hover-btn">hover</button></mc-tooltip>' +
      '<mc-tooltip id="tt-top" content="上方提示" placement="top"><button id="tt-top-btn">top</button></mc-tooltip>' +
      '<mc-tooltip id="tt-bottom" content="下方提示" placement="bottom"><button id="tt-bottom-btn">bottom</button></mc-tooltip>' +
      '<mc-tooltip id="tt-right" content="右侧提示" placement="right"><button id="tt-right-btn">right</button></mc-tooltip>' +
      '<mc-tooltip id="tt-focus" content="聚焦提示" trigger="focus" delay="0"><button id="tt-focus-btn">focus</button></mc-tooltip>' +
      '<mc-tooltip id="tt-click" content="点击提示" trigger="click"><button id="tt-click-btn">click</button></mc-tooltip>' +
      '<mc-tooltip id="tt-delay" content="延迟提示" delay="400"><button id="tt-delay-btn">delay</button></mc-tooltip>' +
      '<mc-tooltip id="tt-part" content="内部样式" delay="0"><button id="tt-part-btn">part</button></mc-tooltip>';
    // ::part(panel) 生效的探针
    const style = document.createElement('style');
    style.textContent =
      '#tt-part::part(panel) { background-color: rgb(255, 0, 0); border-radius: var(--mc-radius-full); }';
    document.head.append(style);
    document.body.append(host);
  });
  await page
    .waitForFunction(
      () => !!document.querySelector('#tt-hover')?.shadowRoot?.querySelector('.mc-panel'),
      { timeout: 8000 },
    )
    .catch(() => {});

  const isOpen = (id) =>
    page.evaluate(
      (sel) =>
        document.getElementById(sel)?.shadowRoot?.querySelector('.mc-panel')?.matches(':popover-open') ??
        false,
      id,
    );

  const waitOpen = (id, want) =>
    page
      .waitForFunction(
        ({ sel, open }) =>
          document
            .getElementById(sel)
            ?.shadowRoot?.querySelector('.mc-panel')
            ?.matches(':popover-open') === open,
        { sel: id, open: want },
        { timeout: 4000 },
      )
      .catch(() => {});

  /** 触发元素的命中点（顺带断言它真的在指针下 —— 环境一变就当场红，而不是测了个寂寞） */
  const pointOf = (id) =>
    page.evaluate((sel) => {
      const el = document.getElementById(sel);
      const box = el.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      return { x, y, hit: document.elementFromPoint(x, y)?.id ?? null };
    }, id);

  /** 悬停某个触发元素并把鼠标停在那儿 */
  const hover = async (id) => {
    const point = await pointOf(id);
    await page.mouse.move(point.x, point.y);
    return point;
  };

  const park = () => page.mouse.move(4, 4);

  /* ------------------------------------------------------------------ *
   * 1. 地基：锚点几何 = 触发元素几何；面板是原生 popover
   * ------------------------------------------------------------------ */
  const hoverPoint = await hover('tt-hover-btn');
  await waitOpen('tt-hover', true);
  const base = await page.evaluate(() => {
    const tt = document.getElementById('tt-hover');
    const panel = tt.shadowRoot.querySelector('.mc-panel');
    const anchor = tt.shadowRoot.querySelector('.mc-anchor');
    const trigger = document.getElementById('tt-hover-btn');
    const a = anchor.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    return {
      popover: panel.getAttribute('popover'),
      role: panel.getAttribute('role'),
      text: panel.textContent.trim(),
      anchorDisplay: getComputedStyle(anchor).display,
      anchorW: Math.abs(a.width - t.width),
      anchorH: Math.abs(a.height - t.height),
      /* 不写 placement 时默认在**上方**（默认态挂在 :host([placement='top']) 上 —— ofa 会把
         默认值反射到宿主，P32；`:host(:not([placement]))` 在 ofa 里静默失效，P14） */
      defaultMain: +Math.abs(p.bottom - (a.top - 8)).toFixed(1),
      defaultCross: +Math.abs((p.left + p.right) / 2 - (a.left + a.right) / 2).toFixed(1),
    };
  });
  check(
    '悬停触发显示：原生 popover="manual" + content 文本；锚点盒与触发元素严丝合缝（inline-flex）、默认方位在上方',
    hoverPoint.hit === 'tt-hover-btn' &&
      base.popover === 'manual' &&
      base.role === null &&
      base.text === '悬停提示' &&
      base.anchorDisplay === 'inline-flex' &&
      base.anchorW < 0.5 &&
      base.anchorH < 0.5 &&
      base.defaultMain <= 1.5 &&
      base.defaultCross <= 1.5,
    JSON.stringify({ ...hoverPoint, ...base }),
  );

  const noAriaOpen = await page.evaluate(() =>
    document.getElementById('tt-hover').shadowRoot.querySelector('.mc-panel').getAttribute('aria-hidden'),
  );
  await park();
  await waitOpen('tt-hover', false);
  const noAriaClosed = await page.evaluate(() =>
    document.getElementById('tt-hover').shadowRoot.querySelector('.mc-panel').getAttribute('aria-hidden'),
  );
  check(
    '移开就收；面板不写 aria-hidden（显隐是原生 popover 的真相）',
    noAriaOpen === null && noAriaClosed === null && (await isOpen('tt-hover')) === false,
    JSON.stringify({ noAriaOpen, noAriaClosed }),
  );

  /* ------------------------------------------------------------------ *
   * 2. 方位：top（默认）/ bottom / right 的贴合数学（间距 8px = --mc-tooltip-offset）
   * ------------------------------------------------------------------ */
  await hover('tt-top-btn');
  await waitOpen('tt-top', true);
  const top = await page.evaluate(() => {
    const tt = document.getElementById('tt-top');
    const a = tt.shadowRoot.querySelector('.mc-anchor').getBoundingClientRect();
    const p = tt.shadowRoot.querySelector('.mc-panel').getBoundingClientRect();
    return {
      main: +Math.abs(p.bottom - (a.top - 8)).toFixed(1),
      cross: +Math.abs((p.left + p.right) / 2 - (a.left + a.right) / 2).toFixed(1),
    };
  });
  check(
    'placement="top"：面板底边离锚点顶边 8px、交叉轴居中',
    top.main <= 1.5 && top.cross <= 1.5,
    JSON.stringify(top),
  );

  await hover('tt-bottom-btn');
  await waitOpen('tt-bottom', true);
  const bottom = await page.evaluate(() => {
    const tt = document.getElementById('tt-bottom');
    const a = tt.shadowRoot.querySelector('.mc-anchor').getBoundingClientRect();
    const p = tt.shadowRoot.querySelector('.mc-panel').getBoundingClientRect();
    return {
      main: +Math.abs(p.top - (a.bottom + 8)).toFixed(1),
      cross: +Math.abs((p.left + p.right) / 2 - (a.left + a.right) / 2).toFixed(1),
    };
  });
  check(
    'placement="bottom"：面板顶边离锚点底边 8px、交叉轴居中',
    bottom.main <= 1.5 && bottom.cross <= 1.5,
    JSON.stringify(bottom),
  );

  await hover('tt-right-btn');
  await waitOpen('tt-right', true);
  const right = await page.evaluate(() => {
    const tt = document.getElementById('tt-right');
    const a = tt.shadowRoot.querySelector('.mc-anchor').getBoundingClientRect();
    const p = tt.shadowRoot.querySelector('.mc-panel').getBoundingClientRect();
    return {
      main: +Math.abs(p.left - (a.right + 8)).toFixed(1),
      cross: +Math.abs((p.top + p.bottom) / 2 - (a.top + a.bottom) / 2).toFixed(1),
    };
  });
  check(
    'placement="right"：面板左边离锚点右边 8px、交叉轴居中（居中变体单独写过）',
    right.main <= 1.5 && right.cross <= 1.5,
    JSON.stringify(right),
  );
  await park();
  await waitOpen('tt-right', false);

  /* ------------------------------------------------------------------ *
   * 3. trigger：hover（默认，focus 也算）/ focus / click
   * ------------------------------------------------------------------ */
  await page.evaluate(() => document.getElementById('tt-focus-btn').focus());
  await waitOpen('tt-focus', true);
  const focusShows = await isOpen('tt-focus');
  await page.evaluate(() => document.getElementById('tt-focus-btn').blur());
  await waitOpen('tt-focus', false);
  await hover('tt-focus-btn');
  await page.waitForTimeout(250); // delay="0"，这点时间足够证明「悬停不触发」
  const focusIgnoresHover = (await isOpen('tt-focus')) === false;
  await park();
  check(
    'trigger="focus"：聚焦显示、失焦收起，悬停不显示',
    focusShows === true && focusIgnoresHover === true,
    JSON.stringify({ focusShows, focusIgnoresHover }),
  );

  // 默认的 hover 档：focus 也要触发（键盘可达）
  await page.evaluate(() => document.getElementById('tt-hover-btn').focus());
  await waitOpen('tt-hover', true);
  const hoverFocusShows = await isOpen('tt-hover');
  await page.evaluate(() => document.getElementById('tt-hover-btn').blur());
  await waitOpen('tt-hover', false);
  check(
    'trigger="hover"（默认）：聚焦也显示（键盘可达靠它）',
    hoverFocusShows === true,
    String(hoverFocusShows),
  );

  const clickPoint = await pointOf('tt-click-btn');
  await page.mouse.click(clickPoint.x, clickPoint.y);
  await waitOpen('tt-click', true);
  const clickShows = await isOpen('tt-click');
  await page.mouse.click(4, 4);
  await waitOpen('tt-click', false);
  check(
    'trigger="click"：点一下显示、点空白收起（composedPath 判外部）',
    clickPoint.hit === 'tt-click-btn' && clickShows === true && (await isOpen('tt-click')) === false,
    JSON.stringify({ ...clickPoint, clickShows }),
  );

  /* ------------------------------------------------------------------ *
   * 4. delay：400ms 的那一档不会立刻弹
   * ------------------------------------------------------------------ */
  await hover('tt-delay-btn');
  const delayImmediate = await isOpen('tt-delay');
  await waitOpen('tt-delay', true);
  const delayLater = await isOpen('tt-delay');
  check(
    'delay="400"：指针刚移上去不会立刻弹，等过延迟才弹',
    delayImmediate === false && delayLater === true,
    JSON.stringify({ delayImmediate, delayLater }),
  );
  await park();
  await waitOpen('tt-delay', false);

  /* ------------------------------------------------------------------ *
   * 5. ::part(panel) 与「不改使用者的 DOM」
   * ------------------------------------------------------------------ */
  await hover('tt-part-btn');
  await waitOpen('tt-part', true);
  const part = await page.evaluate(() => {
    const cs = getComputedStyle(
      document.getElementById('tt-part').shadowRoot.querySelector('.mc-panel'),
    );
    return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius };
  });
  check(
    '::part(panel) 从外面改得动（底色 / 圆角都跟着变）',
    part.bg === 'rgb(255, 0, 0)' && parseFloat(part.radius) > 100,
    JSON.stringify(part),
  );
  const triggerAttrs = await page.evaluate(() =>
    [...document.getElementById('tt-part-btn').attributes].map((a) => a.name),
  );
  check(
    '不给使用者的触发元素写属性（插槽里的 DOM 归使用者）',
    triggerAttrs.join(',') === 'id',
    JSON.stringify(triggerAttrs),
  );
  await park();

  /* ------------------------------------------------------------------ *
   * 6. 收摊：删掉探针
   * ------------------------------------------------------------------ */
  await page.evaluate(() => document.getElementById('tooltip-probe')?.remove());

  /* ------------------------------------------------------------------ *
   * 7. 文档页本身：演示渲染出来了，悬停演示里的按钮真的弹（顺带让依赖地图记下 page.html 这条边）
   * ------------------------------------------------------------------ */
  const hoverPointInPage = await page.evaluate(() => {
    const demo = window.__deep('demo-tooltip-basic');
    if (!demo?.shadowRoot) return null;
    const trigger = demo.shadowRoot.querySelector('mc-button');
    trigger?.scrollIntoView({ block: 'center' });
    const box = trigger?.getBoundingClientRect();
    if (!box) return null;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    /* ⚠️ `document.elementFromPoint` 只到最外层宿主（这里是 o-page）——
       想问「指针底下是不是这个按钮」得用**它所在那棵 shadow 树**的 elementFromPoint */
    return {
      x,
      y,
      inside: demo.shadowRoot.elementFromPoint(x, y)?.tagName?.toLowerCase() ?? null,
    };
  });
  if (hoverPointInPage) await page.mouse.move(hoverPointInPage.x, hoverPointInPage.y);
  const docPage = await page.evaluate(async () => {
    const demo = window.__deep('demo-tooltip-basic');
    const heading = window.__deep('.doc-body h1')?.textContent?.trim() ?? null;
    const sections = window.__deepAll('section.doc-demo').length;
    await new Promise((r) => setTimeout(r, 400));
    const tt = demo?.shadowRoot?.querySelector('mc-tooltip');
    const panel = tt?.shadowRoot?.querySelector('.mc-panel');
    return {
      heading,
      sections,
      opened: panel?.matches(':popover-open') ?? false,
      text: panel?.textContent?.trim() ?? null,
    };
  });
  check(
    '文档页：标题与五个演示都在，悬停演示的按钮真的弹出气泡',
    /^Tooltip/.test(docPage.heading ?? '') &&
      docPage.sections >= 5 &&
      hoverPointInPage?.inside === 'mc-button' &&
      docPage.opened === true &&
      docPage.text === '删除后无法恢复',
    JSON.stringify({ ...hoverPointInPage, ...docPage }),
  );

  page.off('response', onResponse);
  page.off('pageerror', onError);}
