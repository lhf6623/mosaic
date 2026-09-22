/**
 * 站点 · 首页海报与外壳滚动（第 9.2 节）：视差、方块边界、色片避让、减弱动效、滚动接力
 */

import { pageHelpers } from '../lib/harness.mjs';

export default async function run({ page, goTop, goHash, check, browser, BASE }) {
/* ------------------------------------------------------------------ *
 * 9.2 首页的鼠标视差图案：三层方块（数据驱动渲染），越近的层位移越大
 * ------------------------------------------------------------------ */

/** 读三层当前的 transform */
const artTransforms = () =>
  page.evaluate(() => {
    const art = window.__deep('.poster-art');
    if (!art) return null;
    // 方块是 o-fill 从数据渲染的，按 .art-bit 数，不能数 children
    return [...art.querySelectorAll('[data-layer]')].map((g) => ({
      layer: g.dataset.layer,
      kids: g.querySelectorAll('.art-bit').length,
      transform: g.style.transform || '',
    }));
  });

await goTop('首页');
await page.waitForTimeout(600);

/* 外壳滚动契约：全局不出滚动条，滚动只发生在内部区域（首页正文区正好一屏、不溢出） */
const homeScroll = await page.evaluate(() => {
  const main = window.__deep('.doc-main');
  return {
    doc: document.documentElement.scrollHeight,
    view: window.innerHeight,
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    mainOverflowY: getComputedStyle(main).overflowY,
    mainClient: main.clientHeight,
    mainOver: main.scrollHeight - main.clientHeight,
  };
});
check(
  '外壳固定一屏：没有全局滚动条',
  homeScroll.doc <= homeScroll.view + 1 && homeScroll.bodyOverflowY === 'hidden',
  `文档 ${homeScroll.doc}px / 视口 ${homeScroll.view}px · body overflow-y=${homeScroll.bodyOverflowY}`,
);
check(
  '首页正好一屏，正文区不出滚动条',
  homeScroll.mainOver <= 1,
  `正文区 clientHeight ${homeScroll.mainClient}px · 溢出 ${homeScroll.mainOver}px · overflow-y=${homeScroll.mainOverflowY}`,
);

/*
 * 守高度链条：长页面的内容不能被压扁裁掉。最阴的是 o-router 自带的
 * `:host { overflow: hidden }` —— 它裁掉溢出且不再上传滚动，.doc-main 的
 * scrollHeight 永远等于 clientHeight，长页面被静默截断且看不到滚动条。
 */
await goTop('组件');
await page.waitForTimeout(1500);

/* ---- 二级菜单在页面里：外壳只有顶栏 + 正文带，页面自己分左右两栏 ---- */

const shellBox = await page.evaluate(() => {
  const top = window.__deep('.doc-top').getBoundingClientRect();
  const main = window.__deep('.doc-main');
  const mr = main.getBoundingClientRect();
  const nav = window.__deep('doc-nav');
  const content = window.__deep('.doc-split > .doc-body');
  const nr = nav.getBoundingClientRect();
  const cr = content.getBoundingClientRect();
  const r = (n) => Math.round(n);
  return {
    topW: r(top.width),
    viewW: window.innerWidth,
    topBottom: r(top.bottom),
    viewH: window.innerHeight,
    mainTop: r(mr.top),
    mainBottom: r(mr.bottom),
    navRight: r(nr.right),
    contentLeft: r(cr.left),
    navTop: r(nr.top),
    contentTop: r(cr.top),
    navBottom: r(nr.bottom),
    contentBottom: r(cr.bottom),
    navOverflowY: getComputedStyle(nav).overflowY,
    contentOverflowY: getComputedStyle(content).overflowY,
    // 二级菜单在**子页面**的 shadow 里，不该出现在外壳正文带的 light DOM 里
    shellHasNav: !!main.querySelector('doc-nav'),
  };
});
check(
  '顶栏是「上」：贴满宽度，正文带紧接着它铺到底',
  shellBox.topW === shellBox.viewW &&
    shellBox.mainTop === shellBox.topBottom &&
    shellBox.mainBottom === shellBox.viewH,
  `顶栏宽 ${shellBox.topW}/${shellBox.viewW}px · 正文带 ${shellBox.mainTop}–${shellBox.mainBottom}px · 视口高 ${shellBox.viewH}px`,
);
check(
  '外壳里不再有侧栏（二级菜单搬进页面了）',
  shellBox.shellHasNav === false,
  `.doc-main 里出现 <doc-nav>=${shellBox.shellHasNav}`,
);
check(
  '带二级菜单的页面自己分成左右两栏，两栏都占满顶栏以下',
  shellBox.navRight <= shellBox.contentLeft + 1 &&
    shellBox.contentLeft > 0 &&
    shellBox.navTop === shellBox.contentTop &&
    shellBox.navBottom === shellBox.viewH &&
    shellBox.contentBottom === shellBox.viewH,
  `菜单 ${shellBox.navTop}–${shellBox.navBottom}px（右边界 ${shellBox.navRight}px）/ 正文 ${shellBox.contentTop}–${shellBox.contentBottom}px（左边界 ${shellBox.contentLeft}px）`,
);
check(
  '两栏各自滚',
  shellBox.navOverflowY === 'auto' && shellBox.contentOverflowY === 'auto',
  `overflow-y 菜单=${shellBox.navOverflowY} 正文=${shellBox.contentOverflowY}`,
);

const longPage = await page.evaluate(() => {
  const main = window.__deep('.doc-main');
  const content = window.__deep('.doc-split > .doc-body');
  const last = content?.lastElementChild;
  content.scrollTop = content.scrollHeight; // 滚到底，最后一块内容必须够得着
  const cr = content.getBoundingClientRect();
  const lr = last?.getBoundingClientRect();
  return {
    mainOver: main.scrollHeight - main.clientHeight,
    overflowY: getComputedStyle(content).overflowY,
    globalOver: document.documentElement.scrollHeight - window.innerHeight,
    clientH: content.clientHeight,
    scrollH: content.scrollHeight,
    contentTop: cr.top,
    contentBottom: cr.bottom,
    lastTop: lr ? lr.top : null,
    lastBottom: lr ? lr.bottom : null,
  };
});
check(
  '长页面在页面自己的正文栏里滚（外壳和 window 都不滚）',
  longPage.overflowY === 'auto' &&
    longPage.globalOver <= 1 &&
    longPage.mainOver <= 1 &&
    longPage.scrollH > longPage.clientH,
  `正文栏 ${longPage.clientH}/${longPage.scrollH}px · 外壳正文带溢出 ${longPage.mainOver}px · 全局溢出 ${longPage.globalOver}px`,
);
check(
  '滚到底后长页面的最后一块内容在正文栏里可见（没被裁掉）',
  longPage.lastTop !== null &&
    longPage.lastBottom !== null &&
    longPage.lastTop >= longPage.contentTop - 1 &&
    longPage.lastBottom <= longPage.contentBottom + 1,
  `最后元素 ${Math.round(longPage.lastTop)}–${Math.round(longPage.lastBottom)}px · 正文栏 ${Math.round(longPage.contentTop)}–${Math.round(longPage.contentBottom)}px`,
);

/*
 * 换页复位：全局不滚之后 window.scrollTo 成了空操作，复位必须打在外壳正文带上
 * （site.js 的 route-change 里做；顶栏 olink 不触发 hashchange，那里同时听 router-change）。
 * 用「设计令牌」这种单列长页面测 —— 它滚的就是外壳正文带。
 */
await goHash('packages/color/page.html');
await page.evaluate(() => {
  window.__deep('.doc-main').scrollTop = 99999;
});
const scrolledBefore = await page.evaluate(() => Math.round(window.__deep('.doc-main').scrollTop));
await goHash('docs/pages/specs.html');
const resetTop = await page.evaluate(() => Math.round(window.__deep('.doc-main').scrollTop));
check(
  '换页后正文区自动回到顶部',
  scrolledBefore > 0 && resetTop === 0,
  `切页前 scrollTop=${scrolledBefore}px → 切页后 ${resetTop}px`,
);

/* 滚轮接力：菜单滚到底后继续滚要转给同一页的正文栏（两栏各自滚，纯 CSS 做不到） */
await goTop('组件');
await page.waitForTimeout(1200);
const bridge = await page.evaluate(() => {
  const nav = window.__deep('doc-nav');
  const content = window.__deep('.doc-split > .doc-body');
  nav.scrollTop = nav.scrollHeight; // 先把菜单滚到底
  content.scrollTop = 0;
  const box = nav.getBoundingClientRect();
  return {
    navMax: nav.scrollHeight - nav.clientHeight,
    contentMax: content.scrollHeight - content.clientHeight,
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
});
await page.mouse.move(bridge.x, bridge.y);
await page.mouse.wheel(0, 400);
await page.waitForTimeout(400);
const afterWheel = await page.evaluate(() => ({
  navTop: Math.round(window.__deep('doc-nav').scrollTop),
  contentTop: Math.round(window.__deep('.doc-split > .doc-body').scrollTop),
  winY: window.scrollY,
}));
check(
  '菜单滚到底后滚轮转给正文栏，window 始终不滚',
  bridge.navMax > 0 &&
    bridge.contentMax > 400 &&
    afterWheel.contentTop > 0 &&
    afterWheel.winY === 0,
  `菜单可滚 ${bridge.navMax}px / 正文可滚 ${bridge.contentMax}px · 滚轮后正文栏 scrollTop ${afterWheel.contentTop} · window.scrollY ${afterWheel.winY}`,
);

/* 窄屏：375px 放不下五个中文入口，只能让顶栏自己横滚，不能撑出全局横向滚动条 */
await page.setViewportSize({ width: 375, height: 700 });
await page.waitForTimeout(600);
const narrowTop = await page.evaluate(() => {
  const nav = window.__deep('.doc-top-nav');
  return {
    docW: document.documentElement.scrollWidth,
    viewW: window.innerWidth,
    navScrollable: nav.scrollWidth > nav.clientWidth,
    overflowX: getComputedStyle(nav).overflowX,
  };
});
check(
  '窄屏下顶栏入口自己在内部横滚，不产生全局横向滚动条',
  narrowTop.docW <= narrowTop.viewW + 1 &&
    narrowTop.navScrollable &&
    narrowTop.overflowX === 'auto',
  `文档宽 ${narrowTop.docW}px / 视口 ${narrowTop.viewW}px · 顶栏可滚=${narrowTop.navScrollable} · overflow-x=${narrowTop.overflowX}`,
);
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(600);

await goTop('首页');
await page.waitForTimeout(700);

const artIdle = await artTransforms();
check(
  '首页海报有马赛克图案，且分成三层',
  Array.isArray(artIdle) && artIdle.length === 3 && artIdle.every((l) => l.kids > 0),
  artIdle ? artIdle.map((l) => `${l.layer}:${l.kids}块`).join(' ') : '没找到图案',
);

/* ---- 方块不能越出可视区域 ---- */

/**
 * 量出所有方块的包围盒和容器比对。守一个用户报过的问题：网格写死 18×11 时总宽超出容器，
 * 边缘方块被硬切 —— 现在按容器实测尺寸算行列数，必须完全落在里面。
 */
const measureArt = async (page) =>
  page.evaluate(() => {
    const art = window.__deep('.poster-art');
    const host = window.__deep('.doc-poster');
    if (!art || !host) return null;

    /* 一律量屏幕坐标的矩形：方块位置写在行内样式里，拿样式值比容器尺寸
       会在「算错了但没越界」时误判通过，只有真实矩形算数 */
    const hostRect = host.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const bit of art.querySelectorAll('.art-bit')) {
      const r = bit.getBoundingClientRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right);
      maxY = Math.max(maxY, r.bottom);
    }

    const over = Math.max(
      hostRect.left - minX,
      hostRect.top - minY,
      maxX - hostRect.right,
      maxY - hostRect.bottom,
    );

    return {
      box: `${host.clientWidth}x${host.clientHeight}`,
      layers: [...art.querySelectorAll('[data-layer]')].map(
        (l) => `${Math.round(l.getBoundingClientRect().width)}x${Math.round(l.getBoundingClientRect().height)}`,
      ),
      count: art.querySelectorAll('.art-bit').length,
      over: Math.round(over),
      overflow: over > 0.5,
    };
  });

const artBox = await measureArt(page);
check(
  '方块完全落在可视区域内（不被切）',
  artBox && !artBox.overflow,
  `容器 ${artBox?.box} · 三层 ${artBox?.layers.join(' / ')} · ${artBox?.count} 块 · 越界 ${artBox?.over}px`,
);

// 换几个尺寸，网格必须重新贴合（「尺寸变 → data 重算 → 视图跟上」这条链要真走通）
const resized = [];
for (const [w, h] of [
  [900, 700],
  [1600, 900],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(600);
  const m = await measureArt(page);
  resized.push({ w, h, ...m });
}
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(600);

check(
  '窗口尺寸变化后网格重新贴合（三层跟容器同尺寸，且不越界）',
  resized.every((r) => !r.overflow && r.layers.length === 3 && r.layers.every((b) => b === r.box)),
  resized.map((r) => `${r.w}×${r.h} → 容器 ${r.box} 三层 ${r.layers.join('/')} ${r.count}块`).join('\n        '),
);

await page.mouse.move(80, 120);
await page.waitForTimeout(800);
const artMoved = await artTransforms();

const shifted = (artMoved ?? []).map((l) =>
  Math.abs(parseFloat(/translate3d\((-?[\d.]+)px/.exec(l.transform)?.[1] ?? '0')),
);
check(
  '鼠标移动后三层都跟着位移',
  shifted.length === 3 && shifted.every((n) => n > 0.5),
  `位移 ${shifted.map((n) => n.toFixed(1) + 'px').join(' / ')}`,
);
check(
  '位移量随层深递增（有景深，不是整块平移）',
  shifted.length === 3 && shifted[0] < shifted[1] && shifted[1] < shifted[2],
  `远 ${shifted[0]?.toFixed(1)} < 中 ${shifted[1]?.toFixed(1)} < 近 ${shifted[2]?.toFixed(1)}`,
);

/* ---- 色片不能压到入口按钮上：视差推到极值也不行 ---- */

/*
 * 守一个修过的 bug：色片排除区只按静态位置算，余量（16px）比色片半宽（22.3px）还小，
 * 鼠标移到角落时近景层平移 46px，色片就滑到「快速开始」底下（实测 414px 视口压进 44px）。
 * 三个维度都要覆盖，少一个都测不出来：四个角 / 窄屏 / 边到边距离（交叠为 0 也可能只是「贴着」）。
 */
const chipWorst = { dist: Infinity };
for (const [vw, vh, tag] of [
  [1280, 800, '1280 宽'],
  [414, 700, '414 窄'],
]) {
  await page.setViewportSize({ width: vw, height: vh });
  await page.waitForTimeout(600); // 等 ResizeObserver 重排 + 缓动归位

  for (const [x, y, at] of [
    [2, 2, '左上'],
    [vw - 2, 2, '右上'],
    [2, vh - 2, '左下'],
    [vw - 2, vh - 2, '右下'],
  ]) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(700); // 缓动系数 0.06，追平要一会儿
    const hit = await page.evaluate(() => {
      const art = window.__deep('.poster-art');
      const links = window.__deep('.poster-links');
      if (!art || !links) return null;
      const btns = [...links.children].map((b) => ({
        label: b.textContent.trim(),
        r: b.getBoundingClientRect(),
      }));
      let tightest = { dist: Infinity };
      for (const chip of art.querySelectorAll('.art-chip')) {
        const r = chip.getBoundingClientRect();
        for (const b of btns) {
          const gx = Math.max(0, Math.max(r.left - b.r.right, b.r.left - r.right));
          const gy = Math.max(0, Math.max(r.top - b.r.bottom, b.r.top - r.bottom));
          const dist = Math.hypot(gx, gy);
          if (dist < tightest.dist) {
            tightest = { dist, label: b.label, color: chip.dataset.color };
          }
        }
      }
      return tightest;
    });
    if (hit && hit.dist < chipWorst.dist) Object.assign(chipWorst, hit, { at: `${tag} ${at}` });
  }
}

check(
  '色片与入口按钮留有余量（视差推到极值、缩到窄屏也一样）',
  chipWorst.dist > 0,
  chipWorst.dist === Infinity
    ? '没找到色片或按钮'
    : `最紧在${chipWorst.at}：${chipWorst.color} 色片离「${chipWorst.label}」${chipWorst.dist.toFixed(1)}px`,
);

// 后面的用例按 1280×800 算，量完再切回来
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(600);

/* ---- 减弱动效偏好下不做视差 ---- */
const reduceCtx = await browser.newContext({ reducedMotion: 'reduce' });
const reducePage = await reduceCtx.newPage();
await reduceCtx.addInitScript(pageHelpers);
await reducePage.goto(`${BASE}/index.html`, { waitUntil: 'load' });
await reducePage.waitForTimeout(1600);
await reducePage.mouse.move(80, 120);
await reducePage.waitForTimeout(700);
const reduceTransforms = await reducePage.evaluate(() => {
  const art = window.__deep('.poster-art');
  return art ? [...art.querySelectorAll('[data-layer]')].map((g) => g.style.transform || '') : null;
});
check(
  'prefers-reduced-motion: reduce 时不做视差',
  Array.isArray(reduceTransforms) && reduceTransforms.every((t) => t === ''),
  reduceTransforms ? JSON.stringify(reduceTransforms) : '没找到图案',
);
await reduceCtx.close();

/* ---- 路由来回切时不能累积 pointermove 监听 ---- */

// 先切走首页 —— 此刻挂在首页的监听本来就该存在，否则 add 永远比 remove 多 1（第一版就这么写错的）
await goTop('组件');
await page.waitForTimeout(700);

const leak = await page.evaluate(() => ({
  add: window.__pointerMoveAdds ?? 0,
  remove: window.__pointerMoveRemoves ?? 0,
}));
check(
  '切走首页时清理了 pointermove 监听（不累积）',
  leak.add === leak.remove && leak.add > 0,
  `add=${leak.add} remove=${leak.remove}`,
);
}
