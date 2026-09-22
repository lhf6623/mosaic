/**
 * 站点 · 导航稳定性（第 9.5 / 10 节）：导航 DOM 不重建、真人节奏点击、二级菜单自己滚
 *
 * 从 harness 拿 browser / page / check / visit 这些（见 tests/lib/harness.mjs）。
 */

export default async function run({ page, goTop, check }) {
  /* ------------------------------------------------------------------ *
   * 9.5 【回归】导航 DOM 必须稳定，且真人节奏的点击一次就跳转
   *
   * 这里守着一个修过的 bug：原来每个轮询 tick 都 replaceChildren() 重建菜单，
   * 路由变化后每秒重建 10 次。真实点击的 mousedown 与 click 之间目标节点被换掉，
   * click 就不触发了 —— 表现为「菜单要按很多次才跳转」（实测第一轮点了 6 次）。
   *
   * 注意：用 element.click() 测不出来。它是程序化的、同步的，不受 DOM 替换影响。
   * 必须用 page.mouse 走真实的按下-抬起，才能复现。
   * ------------------------------------------------------------------ */

  await goTop('组件');
  await page.waitForTimeout(600);

  const navChurn = await page.evaluate(
    () =>
      new Promise((resolve) => {
        // 二级菜单现在由页面自己带（<doc-nav>），照样要盯住它的 DOM 会不会被反复重建
        const nav = window.__deep('doc-nav');
        let n = 0;
        const obs = new MutationObserver((list) => {
          n += list.length;
        });
        obs.observe(nav, { childList: true, subtree: true });
        setTimeout(() => {
          obs.disconnect();
          resolve(n);
        }, 1500);
      }),
  );
  check('路由稳定后导航 DOM 不变动（不重建菜单）', navChurn === 0, `1.5 秒内变更 ${navChurn} 次`);

  /** 真人节奏的点击：按下与抬起之间隔 120ms */
  async function humanClick(selector) {
    const box = await page.locator(selector).boundingBox();
    if (!box) return false;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
    return true;
  }

  let clicksNeeded = 0;
  for (let i = 1; i <= 4; i++) {
    clicksNeeded = i;
    const ok = await humanClick('.doc-top-nav a:nth-child(1)'); // 「首页」
    if (!ok) continue;
    await page.waitForTimeout(600);
    if ((await page.evaluate(() => location.hash)).includes('home.html')) break;
  }
  check('真人节奏点击：一次就跳转', clicksNeeded === 1, `需要点 ${clicksNeeded} 次`);

  // 点回组件页，后面的断言依赖页面自带的二级菜单
  await goTop('组件');
  await page.waitForTimeout(600);

  /* ------------------------------------------------------------------ *
   * 10. 页面自带的二级菜单内容超高时自己滚
   *
   * 这一条曾经真的坏过：侧栏 sticky 且不设 max-height + overflow 时，
   * 顶部被钉住而整页滚动不带动它，底部那些组件永远够不到。
   *
   * 现在外壳固定一屏、整页不滚（见 9.2 那几条），菜单是页面里固定高度的一栏，
   * 超出部分必须由它自己滚 —— 否则会被 .doc-split 的 overflow: hidden 裁掉。
   * ------------------------------------------------------------------ */
  const menuScroll = await page.evaluate(() => {
    const nav = window.__deep('doc-nav');
    const headerH = window.__deep('.doc-top').getBoundingClientRect().height;
    const links = [...nav.querySelectorAll('a')];
    const last = links[links.length - 1];
    nav.scrollTop = nav.scrollHeight; // 尽量滚到底
    const lr = last.getBoundingClientRect();
    return {
      overflowY: getComputedStyle(nav).overflowY,
      scrollH: nav.scrollHeight,
      clientH: nav.clientHeight,
      lastLabel: last.textContent.trim(),
      /*
       * 必须拿**视口**做参照，不能拿菜单自己的矩形。
       * 坏掉时菜单本身会延伸到视口外，那时最后一项"在菜单内"依然成立，
       * 拿 nav 的 rect 对比会误判为通过。
       */
      lastVisibleInViewport: lr.top >= headerH - 1 && lr.bottom <= window.innerHeight + 1,
    };
  });
  check(
    '页面自带的二级菜单内容超高时自己滚动（overflow-y: auto）',
    menuScroll.overflowY === 'auto',
    `overflow-y=${menuScroll.overflowY} scrollH=${menuScroll.scrollH} clientH=${menuScroll.clientH}`,
  );
  check(
    '滚到底后最后一个组件在视口内可见',
    menuScroll.lastVisibleInViewport,
    `最后一项是「${menuScroll.lastLabel}」`,
  );
}
