/**
 * mc-ellipsis · 长文本省略 + 可选中/复制的浮层
 *
 * 跑法：node tests/smoke.mjs ellipsis（需先 pnpm dev）
 */

export default async function run({ page, visit, check }) {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

  await visit(page, '/index.html?ellipsis=1#/packages/ellipsis/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-ellipsis'), { timeout: 8000 })
    .catch(() => {});
  const defined = await page.evaluate(() => !!customElements.get('mc-ellipsis'));
  check('mc-ellipsis 注册成功', defined === true, String(defined));

  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'ellipsis-probe';
    host.style.cssText =
      'position:fixed;left:120px;top:160px;z-index:99999;background:#fff;padding:40px;display:flex;flex-direction:column;gap:32px';
    host.innerHTML =
      '<div style="width:150px"><mc-ellipsis id="el-long">深圳美高创新科技股份有限公司（华东区）&nbsp;很长很长的客户名称</mc-ellipsis></div>' +
      '<div style="width:260px"><mc-ellipsis id="el-short">短文本</mc-ellipsis></div>' +
      '<div style="width:150px"><mc-ellipsis id="el-always" always>短文本也允许弹层</mc-ellipsis></div>';
    document.body.append(host);
  });
  await page
    .waitForFunction(
      () => !!document.querySelector('#el-long')?.shadowRoot?.querySelector('.mc-text'),
      { timeout: 8000 },
    )
    .catch(() => {});

  const isOpen = (id) =>
    page.evaluate((sel) => {
      const host = document.querySelector(sel);
      const panel = host?.shadowRoot?.querySelector('.mc-panel');
      return panel?.matches(':popover-open') ?? false;
    }, id);

  /* 省略号：scrollWidth > clientWidth */
  const truncated = await page.evaluate(() => {
    const host = document.querySelector('#el-long');
    const text = host.shadowRoot.querySelector('.mc-text');
    return {
      scrollWidth: text.scrollWidth,
      clientWidth: text.clientWidth,
      textOverflow: getComputedStyle(text).textOverflow,
      overflow: getComputedStyle(text).overflowX,
    };
  });
  check(
    '长文本单行省略（scrollWidth > clientWidth，text-overflow: ellipsis）',
    truncated.scrollWidth > truncated.clientWidth + 1 &&
      truncated.textOverflow === 'ellipsis' &&
      truncated.overflow === 'hidden',
    JSON.stringify(truncated),
  );

  /* hover 打开浮层：全文、可交互、可选中 */
  await page.hover('#el-long .mc-text').catch(() => {});
  await page.waitForTimeout(200);
  const hoverState = await page.evaluate(() => {
    const host = document.querySelector('#el-long');
    const panel = host.shadowRoot.querySelector('.mc-panel');
    const full = panel.querySelector('.mc-full');
    const style = getComputedStyle(panel);
    return {
      open: panel.matches(':popover-open'),
      fullText: full.textContent.trim(),
      pointerEvents: style.pointerEvents,
      userSelect: style.userSelect,
      copyLabel: panel.querySelector('.mc-copy').textContent.trim(),
    };
  });
  check(
    'hover 浮出完整文本：面板可交互（pointer-events:auto）且文字可选中',
    hoverState.open === true &&
      hoverState.fullText.includes('深圳美高创新科技股份有限公司') &&
      hoverState.pointerEvents === 'auto' &&
      hoverState.userSelect === 'text' &&
      hoverState.copyLabel === '复制',
    JSON.stringify(hoverState),
  );

  /* 选中全文 + 复制按钮写剪贴板 */
  const copied = await page.evaluate(async () => {
    const host = document.querySelector('#el-long');
    const panel = host.shadowRoot.querySelector('.mc-panel');
    const full = panel.querySelector('.mc-full');
    const text = full.textContent.trim();
    const range = document.createRange();
    range.selectNodeContents(full);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const selected = selection.toString();
    panel.querySelector('.mc-copy').click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    let clipboard = null;
    try {
      clipboard = await navigator.clipboard.readText();
    } catch (error) {
      clipboard = null;
    }
    return {
      selected,
      expected: text,
      clipboard,
      labelAfter: panel.querySelector('.mc-copy').textContent.trim(),
    };
  });
  check(
    '浮层文字可被选中，复制按钮把全文写入剪贴板',
    copied.selected === copied.expected &&
      copied.clipboard === copied.expected &&
      copied.labelAfter === '已复制',
    JSON.stringify(copied),
  );

  /* 鼠标移入面板保持打开；点外部关闭 */
  await page.hover('#el-long .mc-text').catch(() => {});
  await page.waitForTimeout(150);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  check('鼠标移出后自动收起浮层', (await isOpen('#el-long')) === false);
  await page.hover('#el-long .mc-text').catch(() => {});
  await page.waitForTimeout(200);
  const beforeOutside = await isOpen('#el-long');
  await page.mouse.click(5, 5);
  await page.waitForTimeout(300);
  const afterOutside = await isOpen('#el-long');
  check('点击浮层外部收起', afterOutside === false, JSON.stringify({ beforeOutside, afterOutside }));

  /* 短文本默认不弹；always 时允许弹 */
  await page.hover('#el-short .mc-text').catch(() => {});
  await page.waitForTimeout(150);
  const shortOpen = await isOpen('#el-short');
  await page.hover('#el-always .mc-text').catch(() => {});
  await page.waitForTimeout(150);
  const alwaysOpen = await isOpen('#el-always');
  check(
    '短文本默认不弹浮层；always 时允许弹',
    shortOpen === false && alwaysOpen === true,
    JSON.stringify({ shortOpen, alwaysOpen }),
  );

  /* Escape 关闭 */
  await page.focus('#el-long .mc-text').catch(() => {});
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check('Escape 收起浮层', (await isOpen('#el-long')) === false);

  check('全程无 pageerror / 控制台 404', failed.length === 0, failed.slice(0, 3).join(' | '));
}
