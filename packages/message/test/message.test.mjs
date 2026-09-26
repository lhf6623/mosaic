/**
 * message · 命令式消息条：懒挂载（只挂一次、挂到 body 末尾）、自动关闭、手动关闭、
 * closeAll、同 key 更新不叠加、limit 顶掉最旧的、aria-live/role 跟着 type 切、
 * prefers-reduced-motion 下不播动画、样式只用令牌、没有魔法 z-index。
 *
 * 跑法：node tests/smoke.mjs message（需先 pnpm dev）
 *
 * ⚠️ 这个组件**没有标签入口**：套件自己 import message.js 驱动（页面里写标签什么也不会发生）。
 * 失败面大多是"静默"的（不报错、只是不弹 / 不消失），所以每一条都独立断言。
 */

export default async function run({ page, visit, check, newPage }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?message=1');
  await page.waitForFunction(() => !!customElements.get('mc-collapse') || !!document.body, { timeout: 8000 }).catch(() => {});

  /** 在页面里装一份 message（模块只注册一次，重复 import 拿同一份） */
  const load = () =>
    page.evaluate(async () => {
      const mod = await import('/packages/message/message.js');
      window.__message = mod.default;
      return typeof mod.default === 'function';
    });

  const loaded = await load();
  check('message.js 能在浏览器里 import，导出的是可调用函数', loaded === true, String(loaded));

  /** 小工具：等条件成立（渲染是异步的） */
  const until = (fn, timeout = 4000) =>
    page.waitForFunction(fn, { timeout }).then(
      () => true,
      () => false,
    );

  const snapshot = () =>
    page.evaluate(() => {
      const host = document.querySelector('mc-message');
      const list = host?.shadowRoot?.querySelector('.mc-list');
      const items = [...(host?.shadowRoot?.querySelectorAll('.mc-item') ?? [])];
      return {
        hosts: document.querySelectorAll('mc-message').length,
        lastChild: document.body.lastElementChild?.tagName.toLowerCase() ?? null,
        position: host ? getComputedStyle(host).position : null,
        zIndex: host ? getComputedStyle(host).zIndex : null,
        live: list?.getAttribute('aria-live') ?? null,
        texts: items.map((i) => i.textContent.trim()),
        types: items.map((i) => i.getAttribute('data-type')),
        roles: items.map((i) => i.getAttribute('role')),
        closable: items.map((i) => i.hasAttribute('data-closable')),
        // 图标渲染：行内有没有真的画出 mc-icon
        icons: items.map((i) => i.querySelector('mc-glyph, .mc-glyph mc-icon')?.getAttribute?.('name') ?? null),
      };
    });

  /* ------------------------------------------------------------------ *
   * 1. 懒挂载：第一次调用之前页面上什么都没有
   * ------------------------------------------------------------------ */
  const beforeAny = await page.evaluate(() => document.querySelectorAll('mc-message').length);
  check('调用之前页面上没有 mc-message（懒挂载）', beforeAny === 0, `${beforeAny} 个`);

  const first = await page.evaluate(() => {
    window.__message.success('第一条');
    return true;
  });
  const mounted = await until(() => {
    const host = document.querySelector('mc-message');
    return !!host?.shadowRoot?.querySelector('.mc-item');
  });
  const afterFirst = await snapshot();
  check(
    '第一次调用才挂容器，且挂在 body 末尾、fixed + 令牌层级',
    first && mounted === true && afterFirst.hosts === 1 && afterFirst.lastChild === 'mc-message' && afterFirst.position === 'fixed' && afterFirst.zIndex === '1500',
    JSON.stringify(afterFirst),
  );

  /* ------------------------------------------------------------------ *
   * 2. 多次调用复用同一个容器（不是每弹一条建一个）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__message.info('第二条');
    window.__message.warning('第三条');
  });
  const three = await until(() => {
    const items = document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? [];
    return items.length === 3;
  });
  const afterThree = await snapshot();
  check(
    '连续调用复用同一个容器，条目按顺序排列',
    three === true && afterThree.hosts === 1 && JSON.stringify(afterThree.texts) === JSON.stringify(['第一条', '第二条', '第三条']),
    JSON.stringify(afterThree.texts),
  );

  /* ------------------------------------------------------------------ *
   * 3. 自动关闭：duration 到点自己走
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__message.closeAll());
  await until(() => (document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? []).length === 0);
  await page.evaluate(() => window.__message('要自己走的', { duration: 700 }));
  const appeared = await until(() => (document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? []).length === 1);
  const gone = await until(
    () => (document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? []).length === 0,
  );
  check('duration 到点后自己消失', appeared === true && gone === true, `出现=${appeared} 消失=${gone}`);

  /* ------------------------------------------------------------------ *
   * 4. duration: 0 就常驻，得手动收
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__sticky = window.__message('常驻的', { duration: 0 });
  });
  await new Promise((r) => setTimeout(r, 1200));
  const stillThere = await until(
    () => (document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? []).length === 1,
    1500,
  );
  await page.evaluate(() => window.__sticky.close());
  const closedByHandle = await until(
    () => document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length === 0,
  );
  check('duration: 0 不会自动关；close() 句柄能收掉它', stillThere === true && closedByHandle === true, `常驻=${stillThere} 关掉=${closedByHandle}`);

  /* ------------------------------------------------------------------ *
   * 5. 关闭按钮：右侧有个明确的 ×（32×32 命中区），点它才关；
   *    整条**不再可点**（消息是要读的，点一下就没不该是默认行为）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__message.info('点 × 收掉我', { duration: 0 }));
  await until(() => document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length === 1);
  const closeBtn = await page.evaluate(() => {
    const item = document.querySelector('mc-message').shadowRoot.querySelector('.mc-item');
    const btn = item.querySelector('.mc-close');
    if (!btn) return null;
    const cs = getComputedStyle(btn);
    const rect = btn.getBoundingClientRect();
    return {
      exists: true,
      // ⚠️ 在 flex 容器里是 flex（flex item 会被块级化），不是样式里写的 inline-flex —— 同 mc-alert
      display: cs.display,
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      label: btn.getAttribute('aria-label'),
      radius: cs.borderRadius,
      // 整条不可点：条目的 cursor 不是 pointer、也没有 tabindex
      itemCursor: getComputedStyle(item).cursor,
      itemTabindex: item.getAttribute('tabindex'),
      // 图标真的画出来了
      icon: !!btn.querySelector('mc-icon'),
    };
  });
  check(
    '每条消息右侧有明确的 ×：约 32×32 命中区、圆形、带 aria-label、图标已渲染',
    closeBtn?.exists === true &&
      closeBtn.display === 'flex' &&
      closeBtn.w >= 31 &&
      closeBtn.w <= 33 &&
      closeBtn.h >= 31 &&
      closeBtn.h <= 33 &&
      closeBtn.radius === '9999px' &&
      !!closeBtn.label &&
      closeBtn.icon === true,
    JSON.stringify(closeBtn),
  );
  check(
    '整条消息不再可点（cursor 不是 pointer、也没有 tabindex）',
    closeBtn?.itemCursor !== 'pointer' && closeBtn?.itemTabindex === null,
    JSON.stringify({ cursor: closeBtn?.itemCursor, tabindex: closeBtn?.itemTabindex }),
  );

  await page.evaluate(() => {
    document.querySelector('mc-message').shadowRoot.querySelector('.mc-close').click();
  });
  const clickedAway = await until(
    () => document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length === 0,
  );
  check('点 × 能收掉这条', clickedAway === true, String(clickedAway));

  /* 键盘：聚焦 × 后回车 / 空格各能关一次（不能关两次 —— keydown 与合成 click 会都到） */
  const keyboard = await page.evaluate(async () => {
    const items = () => document.querySelector('mc-message').shadowRoot.querySelectorAll('.mc-item');
    const out = [];
    for (const key of ['Enter', ' ']) {
      window.__message.info(`键盘 ${key}`, { duration: 0 });
      await new Promise((r) => setTimeout(r, 350));
      const btn = document.querySelector('mc-message').shadowRoot.querySelector('.mc-close');
      btn.focus();
      btn.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 350));
      out.push({ key, left: items().length, focused: document.activeElement?.tagName ?? null });
    }
    return out;
  });
  check(
    '键盘：聚焦 × 后回车 / 空格各关一次（没有因 keydown + 合成 click 关两次而误伤下一条）',
    keyboard.every((k) => k.left === 0),
    JSON.stringify(keyboard),
  );

  /* ------------------------------------------------------------------ *
   * onClose：这条消失时通知生产者（点 × / 到点 / close() / closeAll() 都算一次）；
   * 顺带守「× 掉之后队列里真的删了」—— 只清 DOM 不清队列会静默泄漏，onClose 也永不触发
   * ------------------------------------------------------------------ */
  const onCloseProbe = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const rows = () => [...(document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? [])];
    const seen = [];
    await window.__message.closeAll();
    await wait(200);

    window.__message.info('a', { duration: 0, onClose: () => seen.push('click') });
    await wait(350);
    rows()[0].querySelector('.mc-close').click();
    await wait(350);

    window.__message.info('b', { duration: 400, onClose: () => seen.push('timer') });
    await wait(900);

    const handle = window.__message.info('c', { duration: 0, onClose: () => seen.push('handle') });
    await wait(300);
    await handle.close();
    await wait(300);

    window.__message.info('d', { duration: 0, onClose: () => seen.push('all') });
    await wait(300);
    await window.__message.closeAll();
    await wait(300);

    /* 队列有没有泄漏：limit 是 5，若关掉的还留在队列里，再连发 5 条时前几条会被误顶掉 */
    for (let i = 1; i <= 5; i++) window.__message(`L${i}`, { duration: 0 });
    await wait(600);
    const afterLimit = rows().map((r) => r.querySelector('.mc-text').textContent.trim());
    await window.__message.closeAll();
    return { seen, afterLimit };
  });
  check(
    'onClose 在这条消失时回调一次（点 × / 到点 / close() / closeAll()）',
    JSON.stringify(onCloseProbe.seen) === JSON.stringify(['click', 'timer', 'handle', 'all']),
    JSON.stringify(onCloseProbe.seen),
  );
  check(
    '关掉之后队列真的清了（再发 5 条不会因为旧条目占名额而被顶掉）',
    JSON.stringify(onCloseProbe.afterLimit) === JSON.stringify(['L1', 'L2', 'L3', 'L4', 'L5']),
    JSON.stringify(onCloseProbe.afterLimit),
  );

  /* closable 是**显式属性、默认 true**，不跟 duration 推导：
     「关不关得掉」和「多久自己走」是两件事，混在一起读者看不出来。 */
  const closableCases = await page.evaluate(async () => {
    const shown = async (config) => {
      await window.__message.closeAll();
      await new Promise((r) => setTimeout(r, 220));
      window.__message.info('closable 检查', config);
      await new Promise((r) => setTimeout(r, 380));
      const btn = document.querySelector('mc-message').shadowRoot.querySelector('.mc-item .mc-close');
      const display = getComputedStyle(btn).display;
      await window.__message.closeAll();
      return display;
    };
    return {
      默认: await shown({}),
      自走也默认: await shown({ duration: 1500 }),
      常驻: await shown({ duration: 0 }),
      显式关掉: await shown({ closable: false }),
      显式关掉且常驻: await shown({ duration: 0, closable: false }),
    };
  });
  check(
    'closable 是显式属性、默认 true（不跟 duration 推导）：四种组合都对',
    closableCases.默认 === 'flex' &&
      closableCases.自走也默认 === 'flex' &&
      closableCases.常驻 === 'flex' &&
      closableCases.显式关掉 === 'none' &&
      closableCases.显式关掉且常驻 === 'none',
    JSON.stringify(closableCases),
  );

  /* closable: false 时不给 × */
  const notClosable = await page.evaluate(async () => {
    window.__message.info('不可点', { closable: false, duration: 0 });
    await new Promise((r) => setTimeout(r, 400));
    const item = document.querySelector('mc-message').shadowRoot.querySelector('.mc-item');
    const style = getComputedStyle(item.querySelector('.mc-close')).display;
    await window.__message.closeAll();
    return style;
  });
  check('closable: false 时不渲染 ×（display: none）', notClosable === 'none', notClosable);

  /* ------------------------------------------------------------------ *
   * 6. 同 key 更新：只留一条，位置也换成最后那条
   * ------------------------------------------------------------------ */
  await page.evaluate(async () => {
    window.__message.info('上传中 0%', { key: 'upload', duration: 0 });
    window.__message.info('上传中 50%', { key: 'upload', duration: 0 });
    window.__message.success('上传完成', { key: 'upload', duration: 0 });
  });
  await new Promise((r) => setTimeout(r, 600));
  const keyed = await snapshot();
  check(
    '同 key 的三条只留最后一条（不叠加）',
    keyed.texts.length === 1 && keyed.texts[0] === '上传完成',
    JSON.stringify(keyed.texts),
  );

  /* ------------------------------------------------------------------ *
   * 7. close(key) / closeAll()
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__message.close('upload'));
  const closedByKey = await until(
    () => document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length === 0,
  );
  await page.evaluate(() => {
    window.__message('a', { duration: 0 });
    window.__message('b', { duration: 0 });
    window.__message('c', { duration: 0 });
  });
  await until(() => document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length === 3);
  await page.evaluate(() => window.__message.closeAll());
  const allClosed = await until(
    () => document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length === 0,
  );
  check('close(key) 与 closeAll() 都能收掉', closedByKey === true && allClosed === true, `close(key)=${closedByKey} closeAll=${allClosed}`);

  /* ------------------------------------------------------------------ *
   * 8. limit：超出上限从最旧的顶掉（默认 5）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    for (let i = 1; i <= 8; i++) window.__message(`L${i}`, { duration: 0 });
  });
  await new Promise((r) => setTimeout(r, 800));
  const limited = await snapshot();
  check(
    '同屏最多 5 条，超出从最旧的顶掉（留下最后 5 条）',
    limited.texts.length === 5 && JSON.stringify(limited.texts) === JSON.stringify(['L4', 'L5', 'L6', 'L7', 'L8']),
    JSON.stringify(limited.texts),
  );
  await page.evaluate(() => window.__message.closeAll());

  /* ------------------------------------------------------------------ *
   * 8.5 宽度：每条按自己的内容宽；一条长的**不许**把短的带着一起变宽
   *     （`.mc-list` 是纵向 flex，条目在交叉轴默认 stretch —— 少写一句 align-items 就回来）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__message.closeAll());
  await until(() => document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length === 0);
  const widths = await page.evaluate(async () => {
    const measure = () => {
      const items = [...document.querySelector('mc-message').shadowRoot.querySelectorAll('.mc-item')];
      return items.map((el) => ({
        w: Math.round(el.getBoundingClientRect().width),
        text: el.querySelector('.mc-text').textContent.trim(),
      }));
    };
    window.__message('短', { duration: 0 });
    window.__message.info('这是一条很长的提示文案，用来把容器宽度撑起来，看看短的那条会不会被带着一起变宽，再长一点再长一点', {
      duration: 0,
    });
    await new Promise((r) => setTimeout(r, 700));
    const [shortOne, longOne] = measure();
    await window.__message.closeAll();
    return { shortOne, longOne };
  });
  check(
    '每条消息按自己的内容宽：长的那条不会把短的撑宽',
    widths.shortOne.w < 150 && widths.longOne.w > 400 && widths.longOne.w !== widths.shortOne.w,
    JSON.stringify(widths),
  );

  /* ------------------------------------------------------------------ *
   * 9. 类型 → 图标 / 颜色 / role；error 切 assertive
   * ------------------------------------------------------------------ */
  await until(() => document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length === 0);
  const typeRows = await page.evaluate(async () => {
    const out = [];
    for (const type of ['neutral', 'info', 'success', 'warning', 'error']) {
      await window.__message.closeAll();
      await new Promise((r) => setTimeout(r, 220));
      window.__message[type](`${type} 文案`, { duration: 0 });
      await new Promise((r) => setTimeout(r, 320));
      const host = document.querySelector('mc-message');
      const item = host.shadowRoot.querySelector('.mc-item');
      const glyph = item.querySelector('.mc-glyph');
      const icon = glyph?.querySelector('mc-icon');
      out.push({
        type,
        iconName: icon?.getAttribute('name') ?? null,
        iconColor: glyph ? getComputedStyle(glyph).color : null,
        role: item.getAttribute('role'),
        live: host.shadowRoot.querySelector('.mc-list').getAttribute('aria-live'),
        hasGlyph: !!glyph,
      });
    }
    await window.__message.closeAll();
    return out;
  });
  const byType = Object.fromEntries(typeRows.map((r) => [r.type, r]));
  check(
    'neutral 没有图标；其余四种各用语义图标（info / success / warning / error）',
    byType.neutral.hasGlyph === false &&
      byType.info.iconName === 'info' &&
      byType.success.iconName === 'success' &&
      byType.warning.iconName === 'warning' &&
      byType.error.iconName === 'error',
    JSON.stringify(typeRows.map((r) => `${r.type}:${r.iconName ?? '无'}`)),
  );
  check(
    '图标颜色跟着类型走（success / warning / error 各不相同）',
    byType.success.iconColor !== byType.warning.iconColor &&
      byType.warning.iconColor !== byType.error.iconColor &&
      byType.success.iconColor !== byType.error.iconColor,
    JSON.stringify(typeRows.map((r) => `${r.type}:${r.iconColor}`)),
  );
  check(
    'error 是紧急播报（role=alert + aria-live=assertive），其余 polite',
    byType.error.role === 'alert' && byType.error.live === 'assertive' && byType.info.live === 'polite' && byType.info.role === null,
    JSON.stringify(typeRows.map((r) => `${r.type}:${r.role}/${r.live}`)),
  );

  /* ------------------------------------------------------------------ *
   * 10. 样式只用令牌：圆角、内边距、字号都不是裸数字
   * ------------------------------------------------------------------ */
  const styled = await page.evaluate(async () => {
    window.__message.success('样式检查', { duration: 0 });
    await new Promise((r) => setTimeout(r, 350));
    const host = document.querySelector('mc-message');
    const item = host.shadowRoot.querySelector('.mc-item');
    const cs = getComputedStyle(item);
    return {
      radius: cs.borderTopLeftRadius,
      fontSize: cs.fontSize,
      paddingLeft: cs.paddingLeft,
      color: cs.color,
      hasShadow: cs.boxShadow !== 'none',
      hostZ: getComputedStyle(host).zIndex,
    };
  });
  check(
    '条目的圆角 / 内边距 / 字号都落在令牌刻度上（full 胶囊、14px、12px）',
    styled.radius === '9999px' && styled.fontSize === '14px' && styled.paddingLeft === '16px',
    JSON.stringify(styled),
  );
  check('浮层有阴影、层级是令牌值 1500', styled.hasShadow === true && styled.hostZ === '1500', JSON.stringify(styled));
  await page.evaluate(() => window.__message.closeAll());

  /* ------------------------------------------------------------------ *
   * 11. prefers-reduced-motion：不播进场动画
   * ------------------------------------------------------------------ */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(async () => {
    await window.__message.closeAll();
    await new Promise((r) => setTimeout(r, 200));
    window.__message.info('减少动效', { duration: 0 });
    await new Promise((r) => setTimeout(r, 300));
    const item = document.querySelector('mc-message').shadowRoot.querySelector('.mc-item');
    return getComputedStyle(item).animationName;
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.__message.closeAll());
  check('prefers-reduced-motion: reduce 下不播进场动画', reduced === 'none', `animation-name=${reduced}`);

  /* ------------------------------------------------------------------ *
   * 12. 页面上的演示能点：**新开一页冷启动**文档页，点「成功」真的弹出一条
   *     ⚠️ 不能复用上面那个 page：它已经 import 过 message.js / 建过容器，
   *     而第一次冷启动时 l-m 还没定义 → 演示组件绑在未升级的元素上，点了什么都不会发生
   *     （这正是套件要拦的那种"页面照常、点了没反应"）。
   * ------------------------------------------------------------------ */
  const demoPage = await newPage();
  await visit(demoPage, `/index.html?message-demo=${Date.now()}#/packages/message/page.html`);
  await demoPage
    .waitForFunction(() => !!window.__deep('demo-message-basic')?.shadowRoot, { timeout: 10000 })
    .catch(() => {});
  const demoWorks = await demoPage.evaluate(() => {
    /* 演示在页面模块的 shadow root 里（slot 投影），document.querySelector 够不到 */
    const host = window.__deep('demo-message-basic');
    if (!host?.shadowRoot) return { ok: false, why: '演示组件没升级' };
    /* 演示里是 mc-button 本身，没有内部 <button>，直接 click() 即可 */
    const button = host.shadowRoot.querySelectorAll('mc-button')?.[2];
    if (!button) return { ok: false, why: `只找到 ${host.shadowRoot.querySelectorAll('mc-button').length} 个按钮` };
    button.click();
    return { ok: true };
  });
  const demoShows = await demoPage
    .waitForFunction(
      () =>
        [...(document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? [])].some((i) =>
          i.textContent.includes('成功'),
        ),
      { timeout: 4000 },
    )
    .then(
      () => true,
      () => false,
    );
  check('文档页的演示点了真的会弹出消息', demoWorks.ok === true && demoShows === true, JSON.stringify({ demoWorks, demoShows }));
  await demoPage.close();

  /* ------------------------------------------------------------------ *
   * 13. 「停留时长」演示的 close() 句柄真的能关（演示里写的东西必须是真能用的 ——
   *     曾经这里写着"点下面的按钮"，而页面上根本没有那个按钮）
   * ------------------------------------------------------------------ */
  const durPage = await newPage();
  await visit(durPage, `/index.html?message-duration=${Date.now()}#/packages/message/page.html`);
  await durPage
    .waitForFunction(() => !!window.__deep('demo-message-duration')?.shadowRoot, { timeout: 10000 })
    .catch(() => {});
  const durDemo = await durPage.evaluate(async () => {
    const host = window.__deep('demo-message-duration');
    const buttons = [...host.shadowRoot.querySelectorAll('mc-button')];
    const labels = buttons.map((b) => b.textContent.trim());
    const items = () =>
      document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? [];
    const handleButton = buttons.find((b) => b.textContent.trim() === 'close()');
    /* 先弹一条 duration: 0 的，再用页脚那个 close() 句柄按钮关掉它 */
    buttons[1].click();
    await new Promise((r) => setTimeout(r, 700));
    const afterOpen = items().length;
    handleButton?.click();
    await new Promise((r) => setTimeout(r, 500));
    return { labels, afterOpen, afterClose: items().length, counter: host.shadowRoot.querySelector('p span')?.textContent.trim() ?? '' };
  });
  check(
    '「停留时长」演示里的 close() 句柄按钮存在、且真的能收掉常驻消息',
    durDemo.labels.includes('close()') && durDemo.afterOpen === 1 && durDemo.afterClose === 0 && durDemo.counter === '已关 1 次',
    JSON.stringify(durDemo),
  );

  /* ------------------------------------------------------------------ *
   * 13.2 「停留时长」演示：关掉之后再点还能打开（P43 —— `this.sticky = 句柄`
   *      会把同名的 proto 方法覆盖掉，症状是"点第一次有用、之后再也打不开"）
   * ------------------------------------------------------------------ */
  const reopen = await durPage
    .waitForFunction(() => !!window.__deep('demo-message-duration')?.shadowRoot, { timeout: 5000 })
    .then(
      () => true,
      () => false,
    );
  const reopenRounds = reopen
    ? await durPage.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const host = window.__deep('demo-message-duration');
        const buttons = [...host.shadowRoot.querySelectorAll('mc-button')];
        const count = () =>
          document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item').length ?? 0;
        const rounds = [];
        for (let i = 0; i < 3; i++) {
          buttons[1].click(); // 不自动关
          await wait(450);
          const opened = count();
          buttons[2].click(); // close() 句柄
          await wait(450);
          rounds.push({ opened, closed: count() });
        }
        return rounds;
      })
    : [];
  check(
    '「停留时长」演示：连续三轮「打开 → close()」，每一轮都能打开（P43 回归）',
    reopenRounds.length === 3 && reopenRounds.every((r) => r.opened === 1 && r.closed === 0),
    JSON.stringify(reopenRounds),
  );

  /* ------------------------------------------------------------------ *
   * 13.5 「可关闭」演示：closable:false 的「保存中」——按钮点一下开始、再点一下由**任务方**取消；
   *      任务完成时用同一个 key 换成结果（那条带 ×）
   * ------------------------------------------------------------------ */
  const closeDemoPage = await newPage();
  await visit(closeDemoPage, `/index.html?message-closable=${Date.now()}#/packages/message/page.html`);
  await closeDemoPage
    .waitForFunction(() => !!window.__deep('demo-message-closable')?.shadowRoot, { timeout: 10000 })
    .catch(() => {});
  const toggleDemo = await closeDemoPage.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const host = window.__deep('demo-message-closable');
    const button = () => host.shadowRoot.querySelectorAll('mc-button')[1];
    const items = () =>
      [...(document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? [])].map((el) => ({
        text: el.querySelector('.mc-text').textContent.trim(),
        x: getComputedStyle(el.querySelector('.mc-close')).display,
      }));
    const out = {};

    button().click(); // 开始
    await wait(500);
    out.started = { label: button().textContent.trim(), items: items() };

    button().click(); // 任务方取消
    await wait(400);
    out.cancelled = { label: button().textContent.trim(), items: items() };

    button().click(); // 重新开始，等任务完成
    await wait(2000);
    out.done = { label: button().textContent.trim(), items: items() };

    await window.__message?.closeAll?.();
    return out;
  });
  check(
    '「可关闭」演示：保存中不给 ×，按钮再点一下由任务方取消，完成后同 key 换成带 × 的结果',
    toggleDemo.started.items.length === 1 &&
      toggleDemo.started.items[0].text === '保存中…' &&
      toggleDemo.started.items[0].x === 'none' &&
      toggleDemo.started.label === '取消保存' &&
      toggleDemo.cancelled.items.length === 0 &&
      toggleDemo.cancelled.label.includes('保存中（任务归组件管）') &&
      toggleDemo.done.items.length === 1 &&
      toggleDemo.done.items[0].text === '已保存' &&
      toggleDemo.done.items[0].x === 'flex',
    JSON.stringify(toggleDemo),
  );
  await closeDemoPage.close();

  await durPage.close();
  /* ------------------------------------------------------------------ *
   * 14. 「同 key 更新」演示：点 × 之后定时器必须停 —— 否则下一拍又把同 key 的消息
   *     推回来，看着就是"关不掉"（真实反馈过的问题）
   * ------------------------------------------------------------------ */
  const keyPage = await newPage();
  await visit(keyPage, `/index.html?message-key=${Date.now()}#/packages/message/page.html`);
  await keyPage
    .waitForFunction(() => !!window.__deep('demo-message-key')?.shadowRoot, { timeout: 10000 })
    .catch(() => {});
  const keyDemo = await keyPage.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const rows = () => [...(document.querySelector('mc-message')?.shadowRoot?.querySelectorAll('.mc-item') ?? [])];
    const text = () => rows().map((r) => r.querySelector('.mc-text').textContent.trim());
    const start = window.__deep('demo-message-key').shadowRoot.querySelectorAll('mc-button')[0];
    start.click();
    await wait(1200);
    const running = text(); // 应该在跑（有百分比）
    rows()[0].querySelector('.mc-close').click();
    await wait(1600); // 跨过好几个 500ms 的 tick
    return { running, afterClose: text() };
  });
  check(
    '「同 key 更新」演示：点 × 之后不再被定时器推回来',
    keyDemo.running.length === 1 && /上传中 \d+%/.test(keyDemo.running[0]) && keyDemo.afterClose.length === 0,
    JSON.stringify(keyDemo),
  );
  await keyPage.close();

  page.off('response', onResponse);
  page.off('pageerror', onError);
  check('message 相关页面没有 404 / 运行时报错', failed.length === 0, failed.join(' | ') || '无');
}
