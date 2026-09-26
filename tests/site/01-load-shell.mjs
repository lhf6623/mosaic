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
check('注入的样式表内容非空', (sheets?.rules ?? 0) > 300, `${sheets?.rules} 条规则`);

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
// 令牌存的是裸通道三元组（不是完整颜色），这是全局约定，见 agent/design-tokens.md
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
   而 getComputedStyle(null) 会直接把整个套件抛掉（实测 4 并行时红在这条） */
const buttonBg = async () => {
  await page
    .waitForFunction(() => !!window.__deep('mc-button')?.shadowRoot, { timeout: 15000 })
    .catch(() => {});
  return page.evaluate(() => {
    const button = window.__deep('mc-button');
    return button ? getComputedStyle(button).backgroundColor : null;
  });
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
}
