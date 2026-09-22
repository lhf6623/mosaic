/**
 * 站点 · 导航稳定性（第 9.5 / 10 节）：导航 DOM 不重建、真人节奏点击、二级菜单自己滚
 */

export default async function run({ page, goTop, check }) {
/* ------------------------------------------------------------------ *
 * 9.5 【回归】导航 DOM 必须稳定，真人节奏的点击一次就跳（曾每个轮询 tick 重建菜单，mousedown→click 之间节点被换掉，要点很多次；element.click() 测不出来，必须 page.mouse 走真实按下-抬起）
 * ------------------------------------------------------------------ */

await goTop('组件');
await page.waitForTimeout(600);

const navChurn = await page.evaluate(
  () =>
    new Promise((resolve) => {
      // 二级菜单现在由页面自己带（<doc-nav>），照样盯住它的 DOM 会不会被反复重建
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
 * 10. 页面自带的二级菜单内容超高时自己滚（曾坏过：侧栏 sticky 且不限高时顶部被钉住、底部组件永远够不到；现在菜单是页面里固定高度的一栏，超出必须自己滚，否则被 .doc-split 裁掉）
 * ------------------------------------------------------------------ */
const menuScroll = await page.evaluate(() => {
  const nav = window.__deep('doc-nav');
  const headerH = window.__deep('.doc-top').getBoundingClientRect().height;
  const links = [...nav.querySelectorAll('a')];
  const last = links[links.length - 1];
  nav.scrollTop = nav.scrollHeight;
  const lr = last.getBoundingClientRect();
  return {
    overflowY: getComputedStyle(nav).overflowY,
    scrollH: nav.scrollHeight,
    clientH: nav.clientHeight,
    lastLabel: last.textContent.trim(),
    /* 必须拿视口做参照，不能拿菜单自己的矩形：坏掉时菜单本身延伸到视口外，
       那时最后一项「在菜单内」依然成立，拿 nav 的 rect 比会误判为通过 */
    lastVisibleInViewport: lr.top >= headerH - 1 && lr.bottom <= window.innerHeight + 1,
  };
});
check('页面自带的二级菜单内容超高时自己滚动（overflow-y: auto）', menuScroll.overflowY === 'auto', `overflow-y=${menuScroll.overflowY} scrollH=${menuScroll.scrollH} clientH=${menuScroll.clientH}`);
check('滚到底后最后一个组件在视口内可见', menuScroll.lastVisibleInViewport, `最后一项是「${menuScroll.lastLabel}」`);
}
