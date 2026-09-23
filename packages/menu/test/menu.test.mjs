/**
 * mc-menu / mc-menu-item · 垂直菜单：行渲染与缩进、尺寸通道、当前项/悬停/禁用、列表语义、
 * 状态镜像（aria-current / disabled 运行时变化）、P31 动态创建
 */

export default async function run({ page, visit, check }) {
/* ------------------------------------------------------------------ *
 * 11.5 mc-menu —— 垂直菜单（交互元素是插槽里的原生元素，所以这里盯的是组件契约：
 *      整行铺满 / 文字缩进与垂直居中靠宿主继承 / 三个状态镜像到宿主 /
 *      role 列表语义 / 动态创建那条路不炸（P31 实测踩过一次））
 * ------------------------------------------------------------------ */

const menu = await (async () => {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  await visit(page, '/index.html?menu=1#/packages/menu/page.html');
  await page
    .waitForFunction(
      () => {
        const items = window.__deepAll('mc-menu-item');
        return items.length >= 20 && items.every((i) => i.shadowRoot);
      },
      { timeout: 8000 },
    )
    .catch(() => {});

  /** 基础页：行铺满、文字缩进来自宿主、当前项高亮、容器 role */
  const basic = await page.evaluate(() => {
    const host = window.__deepAll('demo-menu-basic')[0];
    const box = host.shadowRoot;
    const menu = window.__deepAll('mc-menu', box)[0];
    const items = window.__deepAll('mc-menu-item', box);
    const rows = items.map((i) => i.querySelector('a, button'));
    const cs = (el) => getComputedStyle(el);
    const rect = (el) => el.getBoundingClientRect();
    /** 文字本身的矩形：Range 量的是内容，不受「交互层铺满整行」影响 */
    const textRect = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };
    return {
      total: window.__deepAll('mc-menu-item').length,
      menus: window.__deepAll('mc-menu').length,
      upgraded: !!menu.shadowRoot && items.every((i) => i.shadowRoot),
      listRole: menu.shadowRoot.querySelector('[part="list"]')?.getAttribute('role'),
      itemRoles: items.map((i) => i.getAttribute('role')),
      currentFlags: items.map((i) => i.hasAttribute('data-current')),
      menuW: Math.round(rect(menu).width),
      rowH: items.map((i) => Math.round(rect(i).height)),
      rowW: items.map((i) => Math.round(rect(i).width)),
      overlayW: rows.map((r) => Math.round(rect(r).width)),
      /** 文字左边缘相对行左边缘的距离 = 缩进（插槽元素上没有 padding，全靠宿主 text-indent 继承） */
      indent: rows.map((r, n) => Math.round(textRect(r).left - rect(items[n]).left)),
      lineHeight: items.map((i) => cs(i).lineHeight),
      current: {
        bg: cs(items[0]).backgroundColor,
        color: cs(items[0]).color,
        weight: cs(items[0]).fontWeight,
      },
      normal: {
        bg: cs(items[1]).backgroundColor,
        color: cs(items[1]).color,
        weight: cs(items[1]).fontWeight,
      },
      underline: rows.map((r) => cs(r).textDecorationLine),
    };
  });

  /** 悬停整行：真实鼠标；禁用的行不亮。
      底色有 transition，等它落定再读（读太早会读到过渡起点） */
  await page.locator('demo-menu-basic mc-menu-item').nth(1).hover();
  await page
    .waitForFunction(
      () => {
        const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
        const item = window.__deepAll('mc-menu-item', box)[1];
        return getComputedStyle(item).backgroundColor === 'rgb(232, 235, 238)';
      },
      { timeout: 2000 },
    )
    .catch(() => {});
  const hoverOn = await page.evaluate(() => {
    const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
    const items = window.__deepAll('mc-menu-item', box);
    return { hovered: items[1].matches(':hover'), bg: getComputedStyle(items[1]).backgroundColor };
  });
  await page.locator('demo-menu-states mc-menu-item').nth(2).hover();
  await page.waitForTimeout(300);
  const hoverDisabled = await page.evaluate(() => {
    const box = window.__deepAll('demo-menu-states')[0].shadowRoot;
    const items = window.__deepAll('mc-menu-item', box);
    return { hovered: items[2].matches(':hover'), bg: getComputedStyle(items[2]).backgroundColor };
  });

  /** 尺寸：写在容器上，菜单项跟着变 */
  const sizes = await page.evaluate(() => {
    const box = window.__deepAll('demo-menu-size')[0].shadowRoot;
    return window.__deepAll('mc-menu', box).map((m) =>
      Math.round(m.querySelector('mc-menu-item a').getBoundingClientRect().height),
    );
  });

  /** variant：surface 才有边框与内边距 */
  const variant = await page.evaluate(() => {
    const box = window.__deepAll('demo-menu-surface')[0].shadowRoot;
    const menus = window.__deepAll('mc-menu', box);
    const read = (m) => {
      const cs = getComputedStyle(m);
      return {
        border: cs.borderTopWidth,
        radius: cs.borderTopLeftRadius,
        padding: cs.padding,
        bg: cs.backgroundColor,
      };
    };
    return { surface: read(menus[0]), plain: read(menus[1]) };
  });

  /** 分组标题：不交互、不算列表项 */
  const groups = await page.evaluate(() => {
    const box = window.__deepAll('demo-menu-groups')[0].shadowRoot;
    const items = window.__deepAll('mc-menu-item', box);
    const groupItems = items.filter((i) => i.hasAttribute('group'));
    const normalItems = items.filter((i) => !i.hasAttribute('group'));
    return {
      count: items.length,
      groupCount: groupItems.length,
      groupRoles: groupItems.map((i) => i.getAttribute('role')),
      groupPointer: getComputedStyle(groupItems[0]).pointerEvents,
      groupHeight: Math.round(groupItems[0].getBoundingClientRect().height),
      groupIndent: getComputedStyle(groupItems[0]).textIndent,
      normalRoles: normalItems.map((i) => i.getAttribute('role')),
      normalHeight: Math.round(normalItems[0].getBoundingClientRect().height),
    };
  });

  /** 当前项与禁用：状态从插槽元素读 → 镜像到宿主；两种原生元素（A / BUTTON）表现一致 */
  const states = await page.evaluate(() => {
    const box = window.__deepAll('demo-menu-states')[0].shadowRoot;
    const items = window.__deepAll('mc-menu-item', box);
    const rows = items.map((i) => i.querySelector('a, button'));
    const cs = (el) => getComputedStyle(el);
    const rect = (el) => el.getBoundingClientRect();
    const textRect = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };
    return {
      tags: rows.map((r) => r.tagName),
      currentFlags: items.map((i) => i.hasAttribute('data-current')),
      disabledFlags: items.map((i) => i.hasAttribute('data-disabled')),
      opacity: items.map((i) => cs(i).opacity),
      cursor: items.map((i) => cs(i).cursor),
      currentBg: cs(items[0]).backgroundColor,
      normalBg: cs(items[1]).backgroundColor,
      buttonDisabled: rows[2].disabled,
      anchorHref: rows[3].getAttribute('href'),
      /** 关键回归：<button> 行曾经因为 shadow-base 的 button reset 丢掉 padding，
          文字贴边。现在两种元素的文字缩进必须一样 */
      indent: rows.map((r, n) => Math.round(textRect(r).left - rect(items[n]).left)),
    };
  });

  /** 禁用项点不动：真实点击后地址栏 hash 不动 */
  const hashBefore = await page.evaluate(() => location.hash);
  await page.locator('demo-menu-states a').nth(2).click({ force: true });
  await page.waitForTimeout(300);
  const hashAfter = await page.evaluate(() => location.hash);

  /** 键盘：Tab 进入可用项，焦点环用 ring 令牌；禁用的两行进不了焦点顺序 */
  const keyboard = await (async () => {
    const links = page.locator('demo-menu-states a');
    await links.nth(0).focus();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
    const byKeyboard = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-states')[0].shadowRoot;
      const active = box.activeElement;
      return {
        text: active?.textContent?.trim() ?? null,
        focusVisible: !!active?.matches?.(':focus-visible'),
        outlineWidth: active ? getComputedStyle(active).outlineWidth : null,
        outlineColor: active ? getComputedStyle(active).outlineColor : null,
      };
    });
    const cantFocus = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-states')[0].shadowRoot;
      const items = window.__deepAll('mc-menu-item', box);
      const rows = items.map((i) => i.querySelector('a, button'));
      rows[2].focus();
      const buttonFocused = box.activeElement === rows[2];
      rows[3].focus();
      const anchorFocused = box.activeElement === rows[3];
      return { buttonFocused, anchorFocused };
    });
    return { byKeyboard, cantFocus };
  })();

  /** 状态镜像：aria-current / aria-disabled / disabled 运行时变化要跟着走（文档站切页就靠它） */
  const mirrorState = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
    const item = window.__deepAll('mc-menu-item', box)[1];
    const a = item.querySelector('a');
    const out = { before: item.hasAttribute('data-current') };

    a.setAttribute('aria-current', 'page');
    await wait(200);
    out.afterSet = item.hasAttribute('data-current');
    out.bgAfterSet = getComputedStyle(item).backgroundColor;

    a.setAttribute('aria-current', 'false');
    await wait(200);
    out.afterFalse = item.hasAttribute('data-current');

    a.removeAttribute('aria-current');
    a.setAttribute('aria-disabled', 'true');
    await wait(200);
    out.afterDisabled = item.hasAttribute('data-disabled');
    out.opacity = getComputedStyle(item).opacity;

    a.removeAttribute('aria-disabled');
    await wait(200);
    out.afterEnabled = item.hasAttribute('data-disabled');
    return out;
  });

  /** 动态创建（P31：构造期不能往宿主写属性）+ group 运行时切换 + 使用者自己的 role 不被覆盖 */
  const dynamic = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const menu = document.createElement('mc-menu');
    const item = (attrs, html) => {
      const el = document.createElement('mc-menu-item');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.innerHTML = html;
      menu.append(el);
      return el;
    };
    const falseItem = item({}, '<a href="#/docs/pages/home.html" aria-current="false">没写</a>');
    const pageItem = item({}, '<a href="#/docs/pages/home.html" aria-current="page">当前</a>');
    const groupItem = item({ group: '' }, '分组');
    const ownItem = item({ role: 'presentation' }, '<a href="#/docs/pages/home.html">自己写的 role</a>');

    const atCreate = menu.getAttributeNames().length + falseItem.getAttributeNames().length;
    document.body.append(menu);
    await wait(400);

    const out = {
      atCreate,
      menuShadow: !!menu.shadowRoot,
      itemShadows: [...menu.children].every((i) => i.shadowRoot),
      roles: [...menu.children].map((i) => i.getAttribute('role')),
      currentFlags: [...menu.children].map((i) => i.hasAttribute('data-current')),
      falseBg: getComputedStyle(falseItem).backgroundColor,
      pageBg: getComputedStyle(pageItem).backgroundColor,
    };

    groupItem.removeAttribute('group');
    await wait(200);
    out.afterUngroup = groupItem.getAttribute('role');
    groupItem.setAttribute('group', '');
    await wait(200);
    out.afterGroup = groupItem.getAttribute('role');
    out.ownRole = ownItem.getAttribute('role');

    menu.remove();
    return out;
  });

  page.off('response', onResponse);
  page.off('pageerror', onError);
  return {
    basic,
    hoverOn,
    hoverDisabled,
    sizes,
    variant,
    groups,
    states,
    hashBefore,
    hashAfter,
    keyboard,
    mirrorState,
    dynamic,
    failed,
  };
})();

check(
  'mc-menu / mc-menu-item 注册并渲染出实例',
  menu.basic.upgraded && menu.basic.total >= 20 && menu.basic.menus >= 6,
  `${menu.basic.menus} 个容器 / ${menu.basic.total} 个菜单项 · 全部升级=${menu.basic.upgraded}`,
);

check(
  '列表语义：容器 role=list（part=list），条目 role=listitem',
  menu.basic.listRole === 'list' && menu.basic.itemRoles.every((r) => r === 'listitem'),
  `list=${menu.basic.listRole} · items=${JSON.stringify(menu.basic.itemRoles)}`,
);

check(
  '行 = 宿主，插槽元素铺满整行（点击区 = 高亮区 = 整行）',
  menu.basic.overlayW.every((w) => w === menu.basic.menuW) &&
    menu.basic.rowW.every((w) => w === menu.basic.menuW) &&
    menu.basic.rowH.every((h) => h === 36) &&
    menu.basic.underline.every((v) => v === 'none'),
  JSON.stringify({ menuW: menu.basic.menuW, overlayW: menu.basic.overlayW, rowH: menu.basic.rowH }),
);

check(
  '文字缩进与垂直居中走宿主继承（text-indent / line-height），不靠插槽元素的 padding',
  menu.basic.indent.every((v) => v === 16) && menu.basic.lineHeight.every((v) => v === '36px'),
  JSON.stringify({ indent: menu.basic.indent, lineHeight: menu.basic.lineHeight }),
);

check(
  '当前项（aria-current → data-current）底色/字色/字重与普通项不同',
  menu.basic.currentFlags.join() === 'true,false,false,false' &&
    menu.basic.current.bg !== menu.basic.normal.bg &&
    menu.basic.current.color !== menu.basic.normal.color &&
    Number(menu.basic.current.weight) > Number(menu.basic.normal.weight),
  JSON.stringify({ flags: menu.basic.currentFlags, current: menu.basic.current, normal: menu.basic.normal }),
);

check(
  '悬停整行浅底（真实鼠标打底在宿主上，<a> / <button> 一致）',
  menu.hoverOn.hovered && menu.hoverOn.bg === 'rgb(232, 235, 238)',
  JSON.stringify(menu.hoverOn),
);

check(
  '禁用项不响应悬停（:host([data-disabled]:hover) 压住底色）',
  menu.hoverDisabled.bg === 'rgba(0, 0, 0, 0)',
  JSON.stringify(menu.hoverDisabled),
);

check(
  'size 写在容器上，靠 CSS 变量继承进子项（sm/md/lg = 28/36/44）',
  JSON.stringify(menu.sizes) === JSON.stringify([28, 36, 44]),
  JSON.stringify(menu.sizes),
);

check(
  'variant=surface 有边框/内边距，plain（默认）没有',
  parseFloat(menu.variant.surface.border) === 1 &&
    parseFloat(menu.variant.plain.border) === 0 &&
    menu.variant.surface.padding !== menu.variant.plain.padding,
  JSON.stringify(menu.variant),
);

check(
  'group 行：不可交互、不算列表项、不定高，普通项照旧是 listitem',
  menu.groups.groupCount === 2 &&
    menu.groups.groupRoles.every((r) => r === null) &&
    menu.groups.groupPointer === 'none' &&
    menu.groups.groupIndent === '0px' &&
    menu.groups.normalRoles.every((r) => r === 'listitem') &&
    menu.groups.normalHeight === 36,
  JSON.stringify(menu.groups),
);

check(
  '状态从插槽元素读：<a aria-current> / <button disabled> / <a aria-disabled> 三种都镜像到宿主',
  menu.states.tags.join() === 'A,A,BUTTON,A' &&
    menu.states.currentFlags.join() === 'true,false,false,false' &&
    menu.states.disabledFlags.join() === 'false,false,true,true' &&
    menu.states.buttonDisabled === true &&
    menu.states.anchorHref === null &&
    Number(menu.states.opacity[2]) < 1 &&
    Number(menu.states.opacity[3]) < 1 &&
    menu.states.cursor[2] === 'not-allowed' &&
    menu.states.cursor[3] === 'not-allowed' &&
    menu.states.currentBg !== menu.states.normalBg,
  JSON.stringify(menu.states),
);

check(
  '关键回归：<button> 行的文字缩进与 <a> 行一致（不再被 shadow-base 的 button reset 吃掉）',
  menu.states.indent.every((v) => v === 16),
  JSON.stringify(menu.states.indent),
);

check(
  '禁用的链接点不动（真实点击后 hash 不变）',
  menu.hashBefore === menu.hashAfter,
  `${menu.hashBefore} → ${menu.hashAfter}`,
);

check(
  '键盘：Tab 进到下一项且焦点环用 ring 令牌；禁用的两行进不来',
  menu.keyboard.byKeyboard.focusVisible &&
    parseFloat(menu.keyboard.byKeyboard.outlineWidth) === 2 &&
    !menu.keyboard.cantFocus.buttonFocused &&
    !menu.keyboard.cantFocus.anchorFocused,
  JSON.stringify(menu.keyboard),
);

check(
  '状态镜像跟随运行时变化：aria-current 加了就亮、写成 false 就灭、aria-disabled 加了就压暗',
  menu.mirrorState.before === false &&
    menu.mirrorState.afterSet === true &&
    menu.mirrorState.afterFalse === false &&
    menu.mirrorState.afterDisabled === true &&
    Number(menu.mirrorState.opacity) < 1 &&
    menu.mirrorState.afterEnabled === false,
  JSON.stringify(menu.mirrorState),
);

check(
  'document.createElement 创建的实例照常初始化（P31：构造期没往宿主写属性）',
  menu.dynamic.atCreate === 0 &&
    menu.dynamic.menuShadow &&
    menu.dynamic.itemShadows &&
    JSON.stringify(menu.dynamic.roles) === JSON.stringify(['listitem', 'listitem', null, 'presentation']),
  JSON.stringify(menu.dynamic),
);

check(
  'aria-current="false" 不点亮（等于没写）',
  menu.dynamic.currentFlags.join() === 'false,true,false,false' &&
    menu.dynamic.falseBg !== menu.dynamic.pageBg &&
    menu.dynamic.pageBg !== 'rgba(0, 0, 0, 0)',
  JSON.stringify({ flags: menu.dynamic.currentFlags, falseBg: menu.dynamic.falseBg, pageBg: menu.dynamic.pageBg }),
);

check(
  'group 运行时切换：role 跟着摘掉/补回',
  menu.dynamic.afterUngroup === 'listitem' && menu.dynamic.afterGroup === null,
  `去掉 group → ${menu.dynamic.afterUngroup} · 加回 group → ${menu.dynamic.afterGroup}`,
);

check(
  '使用者自己写的 role 不被覆盖',
  menu.dynamic.ownRole === 'presentation',
  `own=${menu.dynamic.ownRole} · 使用者写了 role 时组件不补 listitem`,
);

check(
  'mc-menu 文档页没有 404 / 运行时报错',
  menu.failed.length === 0,
  menu.failed.join(' | ') || '无',
);
}
