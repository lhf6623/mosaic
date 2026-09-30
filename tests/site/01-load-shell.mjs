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

  // 必须在这里把值读成普通字符串 —— 下面的 host.remove() 会让活对象读空
  const out = {
    display: getComputedStyle(row).display,
    gap: getComputedStyle(row).gap,
    textColor: getComputedStyle(text).color,
    bg: getComputedStyle(box).backgroundColor,
    border: getComputedStyle(box).borderColor,
  };
  host.remove();
  return out;
});

check('工具类生效：display:flex', utils.display === 'flex', `display = ${utils.display}`);
check('工具类生效：gap-2 = 8px', utils.gap === '8px', `gap = ${utils.gap}`);
check(
  '语义色工具类生效：text-muted → neutral-600',
  utils.textColor === 'rgb(101, 113, 131)',
  `text-muted = ${utils.textColor}`,
);
check('语义色工具类生效：bg-surface', utils.bg === 'rgb(255, 255, 255)', `bg-surface = ${utils.bg}`);
check(
  '语义色工具类生效：border-border → neutral-200',
  utils.border === 'rgb(213, 218, 224)',
  `border-border = ${utils.border}`,
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
  host.remove();
  return value;
});
// 令牌存的是裸通道三元组（不是完整颜色），这是全局约定，见 packages/color/README.md
check(
  '令牌跨 shadow 边界继承',
  tokenInherits.trim() === '101 113 131',
  `--mc-color-fg-muted = ${tokenInherits.trim()}`,
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
    const btn = pop?.querySelector('mc-button');
    const navs = window.__deepAll('doc-nav');
    const pageNav = navs.find((n) => !n.closest('.doc-menu-panel'));
    const panel = pop?.shadowRoot?.querySelector('.mc-panel');
    return {
      有按钮: !!pop,
      左栏在正文里: pageNav ? getComputedStyle(pageNav).display !== 'none' : null,
      面板打开: !!panel?.matches(':popover-open'),
      按钮名: btn?.shadowRoot?.querySelector('.mc-native')?.getAttribute('aria-label') ?? null,
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

await page.setViewportSize({ width: 480, height: 900 });
await page.waitForTimeout(350);
const narrow = await menuState();
check(
  '窄屏：左栏让位，头部出现菜单按钮（复用同一个 <doc-nav>，条目齐全、有名字）',
  narrow.有按钮 === true &&
    narrow.左栏在正文里 === false &&
    narrow.按钮名 === '打开菜单' &&
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

/* 面板里的 <doc-nav> **自己滚** —— 它就是外壳那段滚轮接力认的容器。
   这条守的是一个真踩过的坑：滚动容器若写在面板包装层上，<doc-nav> 就没有盒子
   （自定义元素默认 display:inline，clientHeight 恒为 0）→ 被判定「已在底部」→
   滚轮被 preventDefault 转走：**面板纹丝不动、页面在滚**。 */
const wheelAt = await page.evaluate(`(() => {
  const r = ${shellRoot}.querySelector('.doc-menu-panel').getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`);
const menuScroll = () =>
  page.evaluate(`(() => {
    const nav = ${shellRoot}.querySelector('.doc-menu-panel doc-nav');
    return {
      菜单: Math.round(nav.scrollTop),
      可滚: nav.scrollHeight - nav.clientHeight,
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
  afterNav.面板打开 === false && (await page.evaluate(() => window.__deepAll('h1')[0]?.textContent ?? '')).startsWith('Code'),
  JSON.stringify(afterNav),
);

// 复位视口，别把后面的断言（如果有）留在窄屏
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(200);
}
