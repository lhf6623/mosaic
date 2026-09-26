/**
 * mc-icon：本地命中（零请求）/ 远程内联（一次、全页共享）/ 语义色与尺寸 / 层顺序 / 插槽让位 / 无障碍。
 * 跑法：node tests/smoke.mjs icon（需先 pnpm dev）
 *
 * ⚠️ 两条实测过的坑写在这里，别把它们当成"多余的小心"：
 *   · 本地命中判定靠 getComputedStyle().maskImage —— 所以「本地图标必须真的渲染出来」这件事
 *     本身就是被测对象（第 1 条）；
 *   · 图标规则落在 mosaic.icons 层，层顺序一旦没声明就会被追加到 utilities 之后，
 *     `.mc-icon-*.text-primary` 会变成黑色（第 5 条守的就是这个，实测过的反面教材）。
 */

export default async function run({ page, visit, check }) {
  const iconRequests = [];
  page.on('request', (r) => {
    if (r.url().includes('api.iconify.design')) iconRequests.push(r.url().replace('https://api.iconify.design/', ''));
  });

  await visit(page, '/index.html?icon=1#/packages/icon/page.html');
  await page.waitForFunction(() => !!customElements.get('mc-icon'), { timeout: 8000 }).catch(() => {});

  /* 兜底：文档页万一没引入组件，套件自己注册一份（套件不该依赖页面的写法） */
  if (!(await page.evaluate(() => !!customElements.get('mc-icon')))) {
    await page.evaluate(() => {
      const l = document.createElement('l-m');
      l.setAttribute('src', '/packages/icon/icon.html');
      document.body.appendChild(l);
    });
    await page.waitForFunction(() => !!customElements.get('mc-icon'), { timeout: 8000 });
  }

  /* ---------- 探针：每个断言要的元素都在这里 ---------- */
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.id = 'icon-probe';
    box.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;font-size:16px';
    box.innerHTML = `
      <div><mc-icon id="i-local" name="search"></mc-icon></div>
      <div><mc-icon id="i-prefixed" name="lucide:search"></mc-icon></div>
      <div><mc-icon id="i-danger" name="trash" color="danger"></mc-icon></div>
      <div><mc-icon id="i-inline" name="search" style="font-size:32px;color:rgb(255,0,0)"></mc-icon></div>
      <div><mc-icon id="i-sm" name="search" size="sm"></mc-icon></div>
      <div><mc-icon id="i-lg" name="search" size="lg"></mc-icon></div>
      <div><mc-icon id="i-empty"></mc-icon></div>
      <div><mc-icon id="i-label" name="close" label="关闭"></mc-icon></div>
      <div><span id="i-utility" class="mc-icon-search text-primary" style="font-size:24px"></span></div>
      <div><mc-icon id="i-slot"><b style="font-size:14px">自</b></mc-icon></div>
      <div><mc-icon id="i-remote" name="mdi:home"></mc-icon></div>
      <div><mc-icon id="i-set" name="home" icon-set="mdi"></mc-icon></div>
      <div><mc-icon id="i-unknown-1" name="mc-no-such-icon-zzz"></mc-icon></div>
      <div><mc-icon id="i-unknown-2" name="mc-no-such-icon-zzz"></mc-icon></div>
    `;
    document.body.append(box);
  });

  /* 等异步绘制（本地是同步的，远程要网络） */
  await page
    .waitForFunction(
      () => {
        const glyph = (id) => document.getElementById(id)?.shadowRoot?.querySelector('.mc-glyph');
        return (
          glyph('i-local')?.classList.contains('mc-icon-search') &&
          !!glyph('i-remote')?.querySelector('svg') &&
          glyph('i-unknown-1')?.childElementCount === 0
        );
      },
      { timeout: 15000 },
    )
    .catch(() => {});

  const state = await page.evaluate(() => {
    const box = (id) => document.getElementById(id).getBoundingClientRect();
    const glyph = (id) => document.getElementById(id).shadowRoot.querySelector('.mc-glyph');
    const css = (el) => getComputedStyle(el);
    const rgb = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).join(',');
    const token = (name) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
        .replace(/\s+/g, ',');
    return {
      localMask: css(glyph('i-local')).maskImage,
      localClass: glyph('i-local').className,
      prefixedClass: glyph('i-prefixed').className,
      dangerGlyphColor: rgb(css(glyph('i-danger')).color),
      dangerToken: token('--mc-color-danger'),
      inline: { w: Math.round(box('i-inline').width), color: rgb(css(glyph('i-inline')).color) },
      sizes: {
        sm: Math.round(box('i-sm').width),
        md: Math.round(box('i-local').width),
        lg: Math.round(box('i-lg').width),
      },
      emptyBox: [Math.round(box('i-empty').width), Math.round(box('i-empty').height)],
      emptyChildren: glyph('i-empty').childElementCount,
      label: {
        role: document.getElementById('i-label').getAttribute('role'),
        aria: document.getElementById('i-label').getAttribute('aria-label'),
        glyphHidden: document.getElementById('i-label').shadowRoot
          .querySelector('.mc-glyph')
          .getAttribute('aria-hidden'),
      },
      plainHidden: document.getElementById('i-local').getAttribute('aria-hidden'),
      utility: { color: rgb(css(document.getElementById('i-utility')).color), primary: token('--mc-color-primary') },
      slot: {
        class: glyph('i-slot').className,
        children: glyph('i-slot').childElementCount,
        hostWidth: Math.round(box('i-slot').width),
      },
      remote: {
        svg: !!glyph('i-remote').querySelector('svg'),
        box: [Math.round(box('i-remote').width), Math.round(box('i-remote').height)],
      },
      unknown: {
        one: glyph('i-unknown-1').childElementCount,
        two: glyph('i-unknown-2').childElementCount,
        box: [Math.round(box('i-unknown-1').width), Math.round(box('i-unknown-1').height)],
      },
    };
  });

  check(
    '本地图标命中：零请求、直接渲染（mask 已应用、类名就是内置集那条规则）',
    state.localMask !== 'none' &&
      state.localClass.includes('mc-icon-search') &&
      state.localMask.includes('data:image/svg+xml'),
    `class=${state.localClass} mask=${state.localMask.slice(0, 40)}`,
  );
  check(
    '带集前缀的本地名同样命中本地（lucide:search 不该白跑一次远程）',
    state.prefixedClass.includes('mc-icon-search'),
    state.prefixedClass,
  );
  check(
    'color 只往 currentColor 里填值：color="danger" 就是 --mc-color-danger',
    state.dangerGlyphColor === state.dangerToken,
    `${state.dangerGlyphColor} vs ${state.dangerToken}`,
  );
  check(
    '尺寸 = font-size：size 三档 14 / 16 / 20px（16px 字号下），内联 style 能直接覆盖',
    state.sizes.sm === 14 && state.sizes.md === 16 && state.sizes.lg === 20 && state.inline.w === 32,
    `sm/md/lg=${state.sizes.sm}/${state.sizes.md}/${state.sizes.lg} · 内联 style 32px→${state.inline.w} · 色=${state.inline.color}`,
  );
  check(
    '层顺序：使用者的工具类能盖过图标规则（.mc-icon-search.text-primary 要是 primary）',
    state.utility.color === state.utility.primary,
    `${state.utility.color} vs ${state.utility.primary}`,
  );
  check(
    '有 label → role=img + aria-label；没 label → 宿主 aria-hidden，图形本身永远 aria-hidden',
    state.label.role === 'img' &&
      state.label.aria === '关闭' &&
      state.label.glyphHidden === 'true' &&
      state.plainHidden === 'true',
    JSON.stringify(state.label) + ` · 无 label 的宿主 aria-hidden=${state.plainHidden}`,
  );
  check(
    '插槽有内容就让位：不加图标类、不注入图形，尺寸由使用者内容决定',
    !state.slot.class.includes('mc-icon-') && state.slot.children === 0 && state.slot.hostWidth > 16,
    JSON.stringify(state.slot),
  );
  check(
    '取不到图标 = 空盒子：占住 1em（不留空洞、不跳版），两次实例只请求一次（负结果也缓存）',
    state.emptyBox[0] === 16 &&
      state.emptyChildren === 0 &&
      state.unknown.one === 0 &&
      state.unknown.two === 0 &&
      state.unknown.box[0] === 16 &&
      iconRequests.filter((u) => u.includes('mc-no-such-icon-zzz')).length <= 1,
    `空盒 ${JSON.stringify(state.emptyBox)} · 未知名盒 ${JSON.stringify(state.unknown.box)} · 请求 ${JSON.stringify(iconRequests)}`,
  );
  check(
    '远程图标：内联成 <svg>（不是 <use> 引用），只有一个请求，尺寸仍跟随 font-size',
    state.remote.svg && state.remote.box[0] === 16 && iconRequests.filter((u) => u === 'mdi/home.svg').length === 1,
    `svg=${state.remote.svg} box=${JSON.stringify(state.remote.box)} 请求=${JSON.stringify(iconRequests)}`,
  );
  check(
    '裸名本地查不到时，icon-set 决定用哪个集（name="home" icon-set="mdi" → mdi/home.svg）',
    iconRequests.includes('mdi/home.svg'),
    JSON.stringify(iconRequests),
  );
  check(
    '本地图标一个请求都不发（本地优先）',
    !iconRequests.includes('lucide/search.svg') && !iconRequests.includes('lucide/trash.svg'),
    JSON.stringify(iconRequests),
  );

  await page.evaluate(() => document.getElementById('icon-probe')?.remove());
}
