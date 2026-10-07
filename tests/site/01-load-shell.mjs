/**
 * 站点 · 加载与外壳（第 1–7 节）：无 404、ofa 注册组件、D3 样式注入、工具类、令牌继承、@layer、主题切换
 */

export default async function run({ page, visit, check, problems, routerReady }) {
/* ------------------------------------------------------------------ *
 * 1. 首页加载：无 404、无运行时错误
 * ------------------------------------------------------------------ */
await visit(page, '/index.html');

check('首页加载无 404 / 无运行时报错', problems.length === 0, problems.join('\n        '));

/* 2/3/7 节要一个真正加载了 Mosaic 组件的页面：首页是刻意做的海报、不引组件，所以切到组件文档页跑 */
await routerReady();
await page.evaluate(() => {
  location.hash = '#/packages/button/page.html';
});
/* 等的是**这一页的**按钮升级完。⚠️ 只等「有一个 mc-button 带 shadow root」会被首页自己的
   两个 mc-button（海报 CTA）提前满足，等到的其实是切换前的旧页面；随后路由把旧页面卸载、
   新页面的元素先建出来、shadow root 晚一拍 —— 断言正好落进那个窗口（实测必红）。
   所以必须同时确认「已经在 Button 文档页上」且「所有按钮都升级完」。 */
await page
  .waitForFunction(
    () => {
      const all = window.__deepAll('mc-button');
      const title = window.__deepAll('h1')[0]?.textContent ?? '';
      return title.startsWith('Button') && all.length > 0 && all.every((el) => !!el.shadowRoot);
    },
    { timeout: 15000 },
  )
  .catch(() => {});

/* ------------------------------------------------------------------ *
 * 2. ofa.js 注册组件，<l-m> 把组件拉起来
 * ------------------------------------------------------------------ */
check(
  'mc-button 已注册（ofa.js + <l-m> 正常）',
  await page.evaluate(() => !!customElements.get('mc-button')),
);
check(
  'mc-button 实例已升级并创建 shadow root',
  await page.evaluate(() => !!window.__deep('mc-button')?.shadowRoot),
);

/* ------------------------------------------------------------------ *
 * 3. 【D3 核心】运行时补丁把样式表 adopt 进了 shadow root（顶层是 @layer 块，规则要递归数）
 * ------------------------------------------------------------------ */
const sheets = await page.evaluate(() => {
  const sr = window.__deep('mc-button')?.shadowRoot;
  if (!sr) return null;

  const count = (list) => {
    let n = 0;
    for (const r of list) {
      if (r.cssRules?.length) n += count(r.cssRules);
      else n += 1;
    }
    return n;
  };

  return {
    adopted: sr.adoptedStyleSheets.length,
    rules: sr.adoptedStyleSheets.reduce((n, s) => n + count(s.cssRules), 0),
  };
});
check(
  'shadow root 已 adopt Mosaic 样式表（2 份）',
  sheets?.adopted === 2,
  `adoptedStyleSheets.length = ${sheets?.adopted}`,
);
/* 门槛随产物构成走：现在 = 50 条图标规则 + 43 条工具类 + 令牌层里的若干条 ≈ 110。
   它只是一条「真的注进去了东西」的地板线，行为由下面 4 条断言逐个验。 */
check('注入的样式表内容非空', (sheets?.rules ?? 0) > 80, `${sheets?.rules} 条规则`);

/* ------------------------------------------------------------------ *
 * 4. 【D3 核心】工具类在 shadow root 内部真的生效（文档级 <link> 的规则进不了 shadow root）
 * ------------------------------------------------------------------ */
const utils = await page.evaluate(() => {
  const host = document.createElement('div');
  document.body.append(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML =
    '<div class="flex gap-2">' +
    '<span class="text-muted">a</span>' +
    '<span class="bg-surface border border-border">b</span>' +
    '</div>';

  const row = sr.querySelector('.flex');
  const text = sr.querySelector('.text-muted');
  const box = sr.querySelector('.bg-surface');

  /* 期望值**从令牌现算**，不写死色值：色板是生成出来的，重定身份（改 tools/gen-tokens.mjs 的 HUES）
     不该让这条守卫跟着报假警 —— 它要守的是「工具类接对了令牌」，不是「令牌恰好是这个色」。
     同一个做法见 packages/loading-bar/test 的 tokens 探针。 */
  const root = getComputedStyle(document.documentElement);
  const tokenRgb = (name) => `rgb(${root.getPropertyValue(name).trim().split(/\s+/).join(', ')})`;

  // 必须在这里把值读成普通字符串 —— 下面的 host.remove() 会让活对象读空
  const out = {
    display: getComputedStyle(row).display,
    gap: getComputedStyle(row).gap,
    textColor: getComputedStyle(text).color,
    bg: getComputedStyle(box).backgroundColor,
    border: getComputedStyle(box).borderColor,
    expected: {
      textColor: tokenRgb('--mc-color-fg-muted'),
      bg: tokenRgb('--mc-color-surface'),
      border: tokenRgb('--mc-color-border'),
    },
  };
  host.remove();
  return out;
});

check('工具类生效：display:flex', utils.display === 'flex', `display = ${utils.display}`);
check('工具类生效：gap-2 = 8px', utils.gap === '8px', `gap = ${utils.gap}`);
check(
  '语义色工具类生效：text-muted → --mc-color-fg-muted',
  utils.textColor === utils.expected.textColor,
  `text-muted = ${utils.textColor} · 令牌 = ${utils.expected.textColor}`,
);
check(
  '语义色工具类生效：bg-surface',
  utils.bg === utils.expected.bg,
  `bg-surface = ${utils.bg} · 令牌 = ${utils.expected.bg}`,
);
check(
  '语义色工具类生效：border-border → --mc-color-border',
  utils.border === utils.expected.border,
  `border-border = ${utils.border} · 令牌 = ${utils.expected.border}`,
);

/* ------------------------------------------------------------------ *
 * 5. 令牌靠自定义属性继承进 shadow root（不依赖运行时机制）
 * ------------------------------------------------------------------ */
const tokenInherits = await page.evaluate(() => {
  const host = document.createElement('div');
  document.body.append(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = '<span class="text-muted">x</span>';
  const value = getComputedStyle(sr.querySelector('.text-muted')).getPropertyValue(
    '--mc-color-fg-muted',
  );
  // 期望值同样现算：比的是「继承下去了」，不是「值等于某个数」
  const expected = getComputedStyle(document.documentElement)
    .getPropertyValue('--mc-color-fg-muted')
    .trim();
  host.remove();
  return { value: value.trim(), expected };
});
// 令牌存的是裸通道三元组（不是完整颜色），这是全局约定，见 packages/color/README.md
check(
  '令牌跨 shadow 边界继承',
  tokenInherits.value === tokenInherits.expected && tokenInherits.value !== '',
  `--mc-color-fg-muted = ${tokenInherits.value} · 根上 = ${tokenInherits.expected}`,
);

/* ------------------------------------------------------------------ *
 * 6. @layer 优先级：组件自己的 <style>（未分层）能覆盖工具类 —— D3 的硬前提
 * ------------------------------------------------------------------ */
const layerOrder = await page.evaluate(() => {
  const host = document.createElement('div');
  document.body.append(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = '<style>.probe { color: rgb(1, 2, 3); }</style><span class="probe text-muted">x</span>';
  const color = getComputedStyle(sr.querySelector('.probe')).color;
  host.remove();
  return color;
});
check(
  '组件自身 <style>（未分层）赢过工具类（@layer）',
  layerOrder === 'rgb(1, 2, 3)',
  `期望 rgb(1, 2, 3)，实际 ${layerOrder}`,
);

/* ------------------------------------------------------------------ *
 * 7. 【关键】主题切换能穿过 shadow 边界（曾坏过：`:root, :host` 让 shadow 内的 :host 重赋亮色值）
 * ------------------------------------------------------------------ */
/* 读颜色前先等实例在：并行跑时页面挂载更慢，不等就会读到 null，
   而 getComputedStyle(null) 会直接把整个套件抛掉（实测 4 并行时红在这条）。
   挑「第一颗实心底按钮」：它的底就是 --mc-color-primary，跟着主题走。两条踩过的坑：
     · 别赌「第一个 mc-button」—— 第 2 节把页面切到了 Button 文档页，而**外壳顶栏现在也有
       一个 mc-button**（主题下拉，ghost 透明底），它会先被命中，透明底切主题前后一模一样；
     · 别写「容器 + 后代」的复合选择器（如 'demo-button-colors mc-button'）—— __deep 是在
       每棵树里**单独**匹配的，跨不过 shadow 边界，只会一路等到超时。 */
const PICK_THEMED = `(() => {
  return (
    window.__deepAll('mc-button').find(
      (b) =>
        !b.closest('.doc-top-actions') &&
        getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)',
    ) ?? null
  );
})()`;
const buttonBg = async () => {
  await page.waitForFunction(`!!(${PICK_THEMED})?.shadowRoot`, { timeout: 15000 }).catch(() => {});
  return page.evaluate(
    `(() => { const b = ${PICK_THEMED}; return b ? getComputedStyle(b).backgroundColor : null; })()`,
  );
};

const lightBg = await buttonBg();
await page.evaluate(() => {
  document.documentElement.dataset.theme = 'dark';
});
await page.waitForTimeout(80);
const darkBg = await buttonBg();

check('切到暗色后组件颜色随之变化', lightBg !== darkBg, `${lightBg} → ${darkBg}`);

const docSurface = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--mc-color-surface').trim(),
);
check('文档级令牌也切到了暗色', docSurface !== '255 255 255', `--mc-color-surface = ${docSurface}`);

await page.evaluate(() => delete document.documentElement.dataset.theme);
await page.waitForTimeout(80);
check('切回自动（亮色）后恢复', (await buttonBg()) === lightBg);

/* ------------------------------------------------------------------ *
 * 8. 窄屏：左栏收进头部那颗图标按钮的浮层；宽屏左栏常驻、按钮**不渲染**
 *    （所以宽屏 DOM 里仍然只有一份 <doc-nav>，别的套件按老样子找得到它）
 * ------------------------------------------------------------------ */
const shellRoot = `(() => {
  const shell = window.__deepAll('o-page').find(
    (x) => (x.getAttribute('src') || '').endsWith('/docs/layout.html'),
  );
  return shell?.shadowRoot ?? null;
})()`;
const menuState = () =>
  page.evaluate(`(() => {
    const root = ${shellRoot};
    const pop = root?.querySelector('.doc-menu');
    const navs = window.__deepAll('doc-nav');
    const pageNav = navs.find((n) => !n.closest('.doc-menu-panel'));
    const panel = pop?.shadowRoot?.querySelector('.mc-panel');
    return {
      有按钮: !!pop,
      左栏在正文里: pageNav ? getComputedStyle(pageNav).display !== 'none' : null,
      面板打开: !!panel?.matches(':popover-open'),
      浮层条目数:
        root?.querySelector('.doc-menu-panel doc-nav')?.shadowRoot?.querySelectorAll('mc-menu-item')
          .length ?? 0,
    };
  })()`);

const wide = await menuState();
check(
  '宽屏：左栏常驻，头部不渲染菜单按钮（DOM 里也就不会多一份 <doc-nav>）',
  wide.有按钮 === false && wide.左栏在正文里 === true,
  JSON.stringify(wide),
);

/* 宽屏左栏：滚动同样归 mc-scroll-bar（宿主 <doc-nav> 只定位 + 给内边距）。
   读宿主自己的 scrollTop/scrollHeight 会得到「没滚动、可滚 0」的假象 —— 真滚的是组件 shadow 里那个 viewport，
   外壳的滚轮接力也只认它（认错就变成「滚轮被转走、菜单纹丝不动」）。所以这里量的一律是 viewport。 */
const sideNavState = () =>
  page.evaluate(`(() => {
    const nav = window.__deepAll('doc-nav').find((n) => !n.closest('.doc-menu-panel'));
    const bar = nav?.shadowRoot?.querySelector('mc-scroll-bar');
    const vp = bar?.shadowRoot?.querySelector('[part="viewport"]');
    if (!vp) return null;
    const r = vp.getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      菜单: Math.round(vp.scrollTop),
      可滚: vp.scrollHeight - vp.clientHeight,
      正文: Math.round(window.__deep('.doc-main').scrollTop),
      reveal: bar.getAttribute('data-reveal'),
      条子透明度: getComputedStyle(bar.shadowRoot.querySelector('[part="bar"]')).opacity,
      /* 菜单里第一条与顶栏下沿的距离（只在 scrollTop = 0 时有意义）：宿主只让开顶栏那一条，
         不再垫额外的 space-6，所以这个数应当是 0。 */
      首条余量: (() => {
        const first = nav.shadowRoot.querySelector('mc-menu-item');
        const topbar = window.__deep('.doc-top');
        return first && topbar
          ? Math.round(first.getBoundingClientRect().top - topbar.getBoundingClientRect().bottom)
          : null;
      })(),
      /* 条子离栏右边多远：条子贴的是 mc-scroll-bar 自己的右沿，横向 gutter 因此必须挂在
         viewport 上（挂在宿主 <doc-nav> 上会把条子一起推进内容区）。只剩 gutter 那几像素。 */
      条子离栏右边: (() => {
        const thumb = bar.shadowRoot.querySelector('[part="thumb"]');
        return Math.round(nav.getBoundingClientRect().right - thumb.getBoundingClientRect().right);
      })(),
    };
  })()`);

const wideNav = await sideNavState();
check(
  '宽屏：左栏的滚动容器是组件里那个 mc-scroll-bar viewport（宿主自己不滚）',
  wideNav !== null && wideNav.可滚 > 0,
  JSON.stringify(wideNav),
);

/* 条子默认不显示（reveal="hover"）：鼠标还没进过这一栏，条子必须是透明的。
   这条防的是「顺手写成 always」—— 那样条目背景上会一直压着一条，属于改需求而不是改实现。 */
check(
  '宽屏：左栏的条子默认不显示（reveal="hover"，不是常驻）',
  wideNav !== null && wideNav.reveal === 'hover' && wideNav.条子透明度 === '0',
  JSON.stringify({ reveal: wideNav?.reveal, 条子透明度: wideNav?.条子透明度 }),
);

/* 条子贴栏边（只剩 2px gutter + 1px 边框）：把横向 gutter 写回宿主 <doc-nav> 的 padding 上，
   条子就会被一起推进内容区（差 20px）—— 这条守的是那个位置。 */
check(
  '宽屏：左栏的条子贴着栏的右边（没缩在内容区里）',
  wideNav !== null && wideNav.条子离栏右边 <= 6,
  JSON.stringify({ 条子离栏右边: wideNav?.条子离栏右边 }),
);

if (wideNav) {
  await page.mouse.move(wideNav.x, wideNav.y);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(300);
  const sideWheel = await sideNavState();
  check(
    '宽屏：在左栏上滚轮滚的是菜单，不是页面',
    sideWheel.菜单 > 0 && sideWheel.正文 === wideNav.正文,
    `${JSON.stringify(wideNav)} → ${JSON.stringify(sideWheel)}`,
  );

  await page.mouse.wheel(0, 4000); // 滚到菜单底
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 200); // 到底之后再滚：接力给正文带
  await page.waitForTimeout(300);
  const forwardedSide = await sideNavState();
  check(
    '宽屏：左栏滚到底后滚轮接力给正文带',
    forwardedSide.菜单 === forwardedSide.可滚 && forwardedSide.正文 > 0,
    JSON.stringify(forwardedSide),
  );

  /* 上下都不留额外间距：顶上只让开顶栏（首条余量 0，在 sideNavState 里量过），
     底下滚到底时最后一条贴栏底。宿主 <doc-nav> 上不再垫 padding —— 菜单条目自己带内边距。 */
  const sideGap = await page.evaluate(`(() => {
    const nav = window.__deepAll('doc-nav').find((n) => !n.closest('.doc-menu-panel'));
    const vp = nav.shadowRoot.querySelector('mc-scroll-bar').shadowRoot.querySelector('[part="viewport"]');
    const items = nav.shadowRoot.querySelectorAll('mc-menu-item');
    const last = items[items.length - 1];
    return {
      到底: vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 1,
      底部余量: Math.round(nav.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom),
    };
  })()`);
  check(
    '宽屏：左栏上下都不留额外间距（首条贴顶栏下沿、滚到底时末条贴栏底）',
    Math.abs(wideNav.首条余量) <= 4 && sideGap.到底 && Math.abs(sideGap.底部余量) <= 4,
    JSON.stringify({ 首条余量: wideNav.首条余量, ...sideGap }),
  );
}

/* 右栏「本页目录」走的是同一套（toc.html 里包的是同一个组件）：宿主 <doc-toc> 不滚，滚的是 viewport。
   把视口压矮才溢得出 —— 满屏高时这一页的目录放得下，溢出与否本来就不是这条要守的东西，
   守的是「滚动容器换到组件里了、宿主没被偷偷用成第二个滚动容器」。 */
await page.setViewportSize({ width: 1280, height: 320 });
await page.waitForTimeout(400);
const tocBar = await page.evaluate(`(() => {
  const host = window.__deepAll('doc-toc')[0];
  const bar = host?.shadowRoot?.querySelector('mc-scroll-bar');
  const vp = bar?.shadowRoot?.querySelector('[part="viewport"]');
  const thumb = bar?.shadowRoot?.querySelector('[part="thumb"]');
  return vp
    ? {
        可滚: vp.scrollHeight - vp.clientHeight,
        宿主自身溢出: host.scrollHeight - host.clientHeight,
        溢出标记: bar.hasAttribute('data-overflow'),
        条子离栏右边: Math.round(host.getBoundingClientRect().right - thumb.getBoundingClientRect().right),
      }
    : null;
})()`);
check(
  '宽屏：右栏目录的滚动容器同样是组件里的 mc-scroll-bar viewport（宿主自己不滚、条子贴栏边）',
  tocBar !== null &&
    tocBar.可滚 > 0 &&
    tocBar.宿主自身溢出 === 0 &&
    tocBar.溢出标记 === true &&
    tocBar.条子离栏右边 <= 6,
  JSON.stringify(tocBar),
);

await page.setViewportSize({ width: 480, height: 900 });
await page.waitForTimeout(350);
const narrow = await menuState();
check(
  '窄屏：左栏让位，头部出现菜单按钮（复用同一个 <doc-nav>，条目齐全）',
  narrow.有按钮 === true &&
    narrow.左栏在正文里 === false &&
    narrow.浮层条目数 > 0,
  JSON.stringify(narrow),
);

/* ⚠️ 再走一遍**窄屏 + 刷新**（全新加载），这条才是用户实际踩的路径：
   showMenu = hasMenu && narrow，而 narrow 来自 matchMedia —— 如果它没在算 showMenu
   之前就位，全新加载时按钮就是「不显示且没人重算」，只能靠跨断点 resize 把它碰出来。
   上一版正好坏在这条上（resize 那条是绿的，所以守卫没抓住）。 */
await visit(page, '/index.html#/packages/button/page.html');
await page.waitForTimeout(900);
const refreshed = await menuState();
check(
  '窄屏：刷新（全新加载）后菜单按钮依然在',
  refreshed.有按钮 === true && refreshed.左栏在正文里 === false && refreshed.浮层条目数 > 0,
  JSON.stringify(refreshed),
);

await page.evaluate(`(() => {
  ${shellRoot}.querySelector('.doc-menu mc-button').shadowRoot.querySelector('.mc-native').click();
})()`);
await page.waitForTimeout(350);
const opened = await menuState();
check('窄屏：浮层点开就是这一页的菜单', opened.面板打开 === true, JSON.stringify(opened));

/* 浮层里的条子**不压在菜单项上**：面板自己有边框和内边距，条子没必要去贴面板边，
   所以 gutter 由菜单这层的 viewport 出（--doc-scroll-pad-x），条子落在面板内侧。
   把这条 gutter 去掉，条子就会正好盖住菜单项背景的最右一条。 */
const popupBar = await page.evaluate(`(() => {
  const nav = ${shellRoot}.querySelector('.doc-menu-panel doc-nav');
  const panel = ${shellRoot}.querySelector('.doc-menu').shadowRoot.querySelector('.mc-panel');
  const bar = nav.shadowRoot.querySelector('mc-scroll-bar');
  const vp = bar.shadowRoot.querySelector('[part="viewport"]');
  const thumb = bar.shadowRoot.querySelector('[part="thumb"]');
  const item = nav.shadowRoot.querySelector('mc-menu-item');
  const P = panel.getBoundingClientRect(), T = thumb.getBoundingClientRect(), I = item.getBoundingClientRect();
  return {
    条目右: Math.round(I.right - P.left),
    滑块左: Math.round(T.left - P.left),
    条子距面板右边: Math.round(P.right - T.right),
    viewport内边距: getComputedStyle(vp).paddingRight,
  };
})()`);
check(
  '窄屏：浮层里的条子不压在菜单项上，也不往面板边靠',
  popupBar.条目右 <= popupBar.滑块左 && popupBar.条子距面板右边 >= 6,
  JSON.stringify(popupBar),
);

/* 面板里的菜单**自己滚** —— 滚的是 <doc-nav> 里那个 mc-scroll-bar 的 viewport（宿主只是定位 + 内边距）。
   这条守的是一个真踩过的坑：滚动容器若落在面板包装层上，<doc-nav> 就没有盒子
   （自定义元素默认 display:inline，clientHeight 恒为 0）→ 被判定「已在底部」→
   滚轮被 preventDefault 转走：**面板纹丝不动、页面在滚**。
   ⚠️ 换成滚动条组件后又多一个同形的坑：宿主 <doc-nav> 不再滚，读它的 scrollTop 恒为 0 —— 必须读 viewport。 */
const wheelAt = await page.evaluate(`(() => {
  const r = ${shellRoot}.querySelector('.doc-menu-panel').getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`);
const menuScroll = () =>
  page.evaluate(`(() => {
    const nav = ${shellRoot}.querySelector('.doc-menu-panel doc-nav');
    const vp = nav.shadowRoot.querySelector('mc-scroll-bar').shadowRoot.querySelector('[part="viewport"]');
    return {
      菜单: Math.round(vp.scrollTop),
      可滚: vp.scrollHeight - vp.clientHeight,
      正文: Math.round(window.__deep('.doc-main').scrollTop),
    };
  })()`);

const beforeWheel = await menuScroll();
await page.mouse.move(wheelAt.x, wheelAt.y);
await page.mouse.wheel(0, 200);
await page.waitForTimeout(300);
const afterWheel = await menuScroll();
check(
  '窄屏：在浮层菜单上滚轮滚的是菜单，不是页面',
  beforeWheel.可滚 > 0 && afterWheel.菜单 > 0 && afterWheel.正文 === beforeWheel.正文,
  `${JSON.stringify(beforeWheel)} → ${JSON.stringify(afterWheel)}`,
);

await page.mouse.wheel(0, 4000); // 滚到菜单底
await page.waitForTimeout(300);
await page.mouse.wheel(0, 200); // 到底之后再滚：接力给正文带
await page.waitForTimeout(300);
const forwarded = await menuScroll();
check(
  '窄屏：菜单滚到底后滚轮接力给正文带（与宽屏左栏同一套行为）',
  forwarded.菜单 === forwarded.可滚 && forwarded.正文 > 0,
  JSON.stringify(forwarded),
);

/* 点条目 = 导航：路由一变就把浮层收起来（不能盖在新页面上） */
await page.evaluate(`(() => {
  const nav = ${shellRoot}.querySelector('.doc-menu-panel doc-nav');
  [...nav.shadowRoot.querySelectorAll('a')].find((a) => a.textContent.includes('Code'))?.click();
})()`);
await page.waitForTimeout(800);
const afterNav = await menuState();
check(
  '窄屏：点条目跳走之后浮层自动收起',
  /* ⚠️ 必须 trim：prettier 把 <h1> 的内容拆到多行，textContent 带上了首尾换行与缩进 */
  afterNav.面板打开 === false &&
    (
      await page.evaluate(() => (window.__deepAll('h1')[0]?.textContent ?? '').trim())
    ).startsWith('Code'),
  JSON.stringify(afterNav),
);

/* ------------------------------------------------------------------ *
 * 9. 导航加载条（第 7.x 节）：接线在 app-config.js，视觉是 mc-loading-bar
 *    ofa 每次导航开始都会调 `loading` —— 包括 olink 的 pushState 导航（它不发 hashchange），
 *    所以这里也顺带守着那条路径；结束信号是 router-change。
 * ------------------------------------------------------------------ */
const navBarState = () =>
  page.evaluate(`(() => {
    const el = document.querySelector('body > mc-loading-bar');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      state: el.getAttribute('state'),
      top: Math.round(el.getBoundingClientRect().top),
      position: cs.position,
      pointerEvents: cs.pointerEvents,
    };
  })()`);

/* ⓐ 快导航不露条：直接在页面上驱动那一对信号，而不是赌「真实导航一定慢过阈值」——
      本地一次导航只有 10~30ms，拿它做断言在并行跑时会变成时序抽奖。 */
const fastNav = await page.evaluate(`(async () => {
  const mod = await import(new URL('app-config.js', document.baseURI).href);
  mod.loading(); // 布防
  document.dispatchEvent(new CustomEvent('router-change')); // 结束信号先到
  await new Promise((r) => setTimeout(r, 400));
  return document.querySelector('body > mc-loading-bar')?.getAttribute('state') ?? null;
})()`);
check('快导航不闪加载条（结束信号先到，条子根本不出现）', fastNav !== 'loading', `state=${fastNav}`);

/* ⓑ 慢导航露条、渲染完收尾：把目标页模块压住 —— faq 这一页本套件没访问过，才会真发那次请求 */
await page.route('**/docs/pages/faq.html', async (route) => {
  await new Promise((r) => setTimeout(r, 1500));
  await route.continue();
});
await page.evaluate(() => {
  location.hash = '#/docs/pages/faq.html';
});
const barAppeared = await page
  .waitForFunction(
    () => document.querySelector('body > mc-loading-bar')?.getAttribute('state') === 'loading',
    { timeout: 1200 },
  )
  .then(() => true)
  .catch(() => false);
const midBar = await navBarState();
check(
  '慢导航露出加载条：挂在 body 上、钉在视口顶部、不吃指针',
  barAppeared &&
    midBar?.state === 'loading' &&
    midBar.top === 0 &&
    midBar.position === 'fixed' &&
    midBar.pointerEvents === 'none',
  JSON.stringify(midBar),
);

const barDone = await page
  .waitForFunction(
    () => document.querySelector('body > mc-loading-bar')?.getAttribute('state') === 'done',
    { timeout: 6000 },
  )
  .then(() => true)
  .catch(() => false);
check(
  '新页面渲染完（router-change）后加载条收尾',
  barDone && (await navBarState())?.state === 'done',
  JSON.stringify(await navBarState()),
);

// 复位视口，别把后面的断言（如果有）留在窄屏
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(200);
}
