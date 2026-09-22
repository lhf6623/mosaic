/**
 * 站点 · 加载与外壳（第 1–7 节）：无 404、ofa 注册组件、D3 样式注入、工具类、令牌继承、@layer、主题切换
 *
 * 从 harness 拿 browser / page / check / visit 这些（见 tests/lib/harness.mjs）。
 */

export default async function run({ page, visit, check, problems }) {
/* ------------------------------------------------------------------ *
 * 1. 首页加载：无 404、无运行时错误
 * ------------------------------------------------------------------ */
await visit(page, '/index.html');

check('首页加载无 404 / 无运行时报错', problems.length === 0, problems.join('\n        '));

/*
 * 下面 2/3/7 节验证的是 D3 那套机制（shadow root 注入样式、主题穿过 shadow 边界），
 * 需要一个真正加载了 Mosaic 组件的页面做载体。
 *
 * 首页现在只剩标题和两个入口，不引任何组件（刻意做的海报），
 * 所以切到组件文档页来跑 —— 那里有 <l-m> 和活的可交互演示。
 */
await page.evaluate(() => {
  location.hash = '#/packages/button/page.html';
});
await page.waitForFunction(() => !!window.__deep?.('mc-button'), { timeout: 15000 }).catch(() => {});

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
 * 3. 【D3 核心】运行时补丁把样式表 adopt 进了 shadow root
 *
 * 注意统计方式：顶层 cssRules 是 @layer 块，工具类在块**里面**，所以要递归下去数。
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
 * 4. 【D3 核心】工具类在 shadow root 内部真的生效
 *
 * 这是整个架构的关键假设：文档级 <link> 的规则进不了 shadow root，
 * 只有通过 adoptedStyleSheets 注入才能让组件模板里的 class="flex gap-2" 起作用。
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
 * 6. @layer 优先级：组件自己的 <style>（未分层）能覆盖工具类
 *
 * MDN 明确 adoptedStyleSheets 排在组件自身 <style> 之后（优先级更高），
 * 所以这一条只有在工具类被放进 @layer 时才成立。这是 D3 的硬前提。
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
 * 7. 【关键】主题切换能穿过 shadow 边界
 *
 * 这一条曾经真的坏过：令牌表里写了 `:root, :host`，shadow root 内的 :host
 * 会给宿主重新赋一遍亮色值，盖掉从文档继承的暗色值 → 切主题组件纹丝不动。
 * ------------------------------------------------------------------ */
const buttonBg = () =>
  page.evaluate(() => getComputedStyle(window.__deep('mc-button')).backgroundColor);

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
