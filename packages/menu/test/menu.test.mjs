/**
 * mc-menu / mc-menu-item · 数据驱动的垂直菜单：
 * 渲染（分组 / 图标 / 当前 / 禁用 / href / children / 属性通道）、层级缩进、内联开合、
 * 手风琴、压缩态与浮层子菜单（hover / focus / Esc / 点外部）、尺寸通道、自备控件状态镜像、P31 动态创建
 */

export default async function run({ page, visit, check }) {
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
          const menus = window.__deepAll('mc-menu');
          return menus.length >= 8 && menus.every((m) => m.shadowRoot);
        },
        { timeout: 8000 },
      )
      .catch(() => {});
    /* 菜单页的演示组件是运行时注册的：先等 demo 宿主有 shadow，
       否则下面的 evaluate 可能在它们升级前就跑（改模板渲染后菜单变慢，暴露了这个竞态） */
    await page
      .waitForFunction(
        () => {
          const hosts = window.__deepAll(
            'demo-menu-basic, demo-menu-nested, demo-menu-accordion, demo-menu-collapsed, demo-menu-expanded, demo-menu-states, demo-menu-slot',
          );
          return hosts.length > 0 && hosts.every((el) => !!el.shadowRoot);
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    /* 模板渲染后生成的行在 mc-menu 自己的 shadow 里；测试统一走这些 helper 查 */
    await page.evaluate(() => {
      window.__menuRows = (menu) =>
        [...(menu.shadowRoot?.querySelectorAll('.mc-node mc-menu-item') ?? [])];
      window.__menuSubs = (menu) =>
        [...(menu.shadowRoot?.querySelectorAll('.mc-node mc-menu') ?? [])];
      window.__menuFlyouts = (menu) =>
        [...(menu.shadowRoot?.querySelectorAll('.mc-node .mc-flyout') ?? [])];
      window.__menuControl = (row) =>
        row.shadowRoot?.querySelector('a, button') ?? row.querySelector('a, button');
      window.__menuText = (row) => row.getAttribute('label') ?? row.textContent.trim();
    });

    /** 基础：注册、part、菜单项都升级了 */
    const basic = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-slot')[0];
      const menu = window.__deepAll('mc-menu', box.shadowRoot)[0];
      return {
        upgraded: !!menu?.shadowRoot,
        items: window.__deepAll('mc-menu-item').length,
        menus: window.__deepAll('mc-menu').length,
        listPart: menu?.shadowRoot.querySelector('[part="list"]')?.getAttribute('part') ?? null,
      };
    });

    /** 数据驱动：字段、分组、children 内联开合、运行时换数据、属性通道 */
    const options = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
      const menu = box.querySelector('#options-menu');
      const rows = (m) =>
        [...window.__menuRows(m)].map((i) => {
          const control = window.__menuControl(i);
          return {
            group: i.hasAttribute('group'),
            icon: i.getAttribute('icon'),
            label: window.__menuText(i),
            current: i.hasAttribute('data-current'),
            disabled: i.hasAttribute('data-disabled'),
            href: control?.getAttribute('href') ?? null,
            tag: control?.tagName ?? null,
            level: i.style.getPropertyValue('--mc-item-level'),
            /* options 的 attrs：target / rel / title 转给了内置 <a> */
            target: control?.getAttribute('target') ?? null,
            rel: control?.getAttribute('rel') ?? null,
            title: control?.getAttribute('title') ?? null,
          };
        });
      const parent = () =>
        [...window.__menuRows(menu)].find(
          (i) => window.__menuText(i) === '组件',
        );
      const sub = () => window.__menuSubs(menu)[0];
      const caret = () => {
        const button = parent() ? window.__menuControl(parent()) : null;
        const icon = button?.querySelector('mc-icon');
        return {
          name: icon?.getAttribute('name') ?? null,
          /* 开合状态现在挂在行上（箭头方向由菜单项自己看 data-expanded 切） */
          expanded: parent()?.hasAttribute('data-expanded') ?? null,
        };
      };
      const textIndent = (m) => {
        const row = window.__menuRows(m)[0];
        const r = document.createRange();
        r.selectNodeContents(window.__menuControl(row));
        return Math.round(r.getBoundingClientRect().left - row.getBoundingClientRect().left);
      };

      const before = rows(menu);
      const subHiddenBefore = sub()?.hasAttribute('hidden') ?? null;

      window.__menuControl(parent()).closest('button').click();
      await wait(250);
      const opened = {
        hidden: sub()?.hasAttribute('hidden') ?? null,
        labels: rows(sub()).map((o) => o.label),
        hrefs: rows(sub()).map((o) => o.href),
        caret: caret(),
        indent: textIndent(sub()),
      };

      window.__menuControl(parent()).closest('button').click();
      await wait(250);
      const closed = { hidden: sub()?.hasAttribute('hidden') ?? null, caret: caret() };

      /* 运行时换一份数据：容器自己生成的那些项整体换掉 */
      box.querySelector('mc-button').click();
      await wait(250);
      const afterAdd = rows(menu);

      /* 属性通道：JSON 字符串（临时造一个菜单，验完拆掉） */
      const attrMenu = document.createElement('mc-menu');
      attrMenu.setAttribute(
        'options',
        JSON.stringify([
          { type: 'group', label: '属性组' },
          { label: '属性项', icon: 'star', href: '#/attr-target.html' },
        ]),
      );
      document.body.append(attrMenu);
      await wait(400);
      const attrItems = rows(attrMenu);
      attrMenu.options = [];
      await wait(250);
      const afterClear = window.__deepAll('mc-menu-item', attrMenu).length;
      attrMenu.remove();

      return { before, subHiddenBefore, opened, closed, afterAdd, attrItems, afterClear };
    });

    /** key 复用：同一份菜单换 current，行 / 子菜单节点不重建、也不移动 */
    const reuse = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
      const menu = box.querySelector('#options-menu');
      const beforeRows = [...window.__menuRows(menu)];
      const beforeSubs = [...window.__menuSubs(menu)];
      const beforeLabels = beforeRows.map((row) => row.getAttribute('label') ?? window.__menuText(row));
      const beforeCurrent = beforeRows.map((row) => row.hasAttribute('current'));
      let added = 0;
      let removed = 0;
      const mo = new MutationObserver((records) => {
        for (const record of records) {
          added += record.addedNodes.length;
          removed += record.removedNodes.length;
        }
      });
      mo.observe(menu, { childList: true });
      const clone = (nodes, target) =>
        nodes.map((node) => {
          const copy = { ...node };
          if (Array.isArray(node.children)) copy.children = clone(node.children, target);
          else copy.current = node.label === target;
          return copy;
        });
      menu.options = clone(menu.options, '设置');
      await wait(200);
      mo.disconnect();
      const afterRows = [...window.__menuRows(menu)];
      const afterSubs = [...window.__menuSubs(menu)];
      return {
        sameRows:
          beforeRows.length === afterRows.length &&
          afterRows.every((row, index) => row === beforeRows[index]),
        sameSubs:
          beforeSubs.length === afterSubs.length && afterSubs.every((sub, index) => sub === beforeSubs[index]),
        beforeLabels,
        afterLabels: afterRows.map((row) => row.getAttribute('label') ?? window.__menuText(row)),
        beforeCurrent,
        afterCurrent: afterRows.map((row) => row.hasAttribute('current')),
        added,
        removed,
      };
    });
    check(
      '换 options 但 key 不变：行 / 子菜单节点复用、不移位，只更新 current',
      reuse.sameRows &&
        reuse.sameSubs &&
        reuse.added === 0 &&
        reuse.removed === 0 &&
        reuse.afterCurrent.filter(Boolean).length === 1 &&
        reuse.beforeCurrent[0] === true &&
        reuse.afterCurrent[0] === false,
      JSON.stringify(reuse),
    );

    /** 缩进：children 每深一级多一档（基础内边距 16 + 层级 × 16） */
    const indent = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-nested')[0].shadowRoot;
      const menu = box.querySelector('#nested-menu');
      const textIndent = (row) => {
        const r = document.createRange();
        r.selectNodeContents(window.__menuControl(row));
        return Math.round(r.getBoundingClientRect().left - row.getBoundingClientRect().left);
      };
      const rowByLabel = (m, label) =>
        [...window.__menuRows(m)].find((i) => window.__menuText(i) === label);

      window.__menuControl(rowByLabel(menu, '组件')).closest('button').click();
      await wait(200);
      const sub = window.__menuSubs(menu)[0];
      window.__menuControl(rowByLabel(sub, '表单')).closest('button').click();
      await wait(250);
      const sub2 = window.__menuSubs(sub)[0];

      return {
        levels: [
          rowByLabel(menu, '基础').style.getPropertyValue('--mc-item-level'),
          rowByLabel(sub, '按钮').style.getPropertyValue('--mc-item-level'),
          rowByLabel(sub2, '输入框').style.getPropertyValue('--mc-item-level'),
        ],
        indents: [
          textIndent(rowByLabel(menu, '基础')),
          textIndent(rowByLabel(sub, '按钮')),
          textIndent(rowByLabel(sub2, '输入框')),
        ],
      };
    });

    /** 内置行（内部通道）：options 落到行上后由菜单项自己造 <a>；禁用的行不给 href、缩进照旧 */
    const built = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const menu = document.createElement('mc-menu');
      menu.style.width = '12rem';
      document.body.append(menu);
      await wait(200);
      menu.options = [
        { label: '内置当前项', href: '#/built-current.html', current: true },
        { label: '内置普通项', href: '#/built-normal.html' },
        { label: '内置禁用项', disabled: true },
        {
          label: '内置外链项',
          href: 'https://example.com',
          attrs: {
            target: '_blank',
            rel: 'noreferrer',
            title: '外链',
            'data-status': 'planned',
          },
        },
      ];
      await wait(400);
      const items = [...window.__menuRows(menu)];
      const rect = (el) => el.getBoundingClientRect();
      const textRect = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return r.getBoundingClientRect();
      };
      const out = items.map((row) => {
        const control = window.__menuControl(row);
        return {
          label: window.__menuText(row),
          tag: control?.tagName ?? null,
          href: control?.getAttribute('href') ?? null,
          current: row.hasAttribute('data-current'),
          disabled: row.hasAttribute('data-disabled'),
          indent: control ? Math.round(textRect(control).left - rect(row).left) : null,
          /* attrs：链接属性转给 <a>，data-* 留在行上 */
          target: control?.getAttribute('target') ?? null,
          rel: control?.getAttribute('rel') ?? null,
          title: control?.getAttribute('title') ?? null,
          dataStatus: row.getAttribute('data-status'),
          controlStatus: control?.getAttribute('data-status') ?? null,
        };
      });
      menu.remove();
      return out;
    });

    /** 手风琴：同一层只留一个展开的分支 */
    const accordion = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-accordion')[0].shadowRoot;
      const menu = box.querySelector('#accordion-menu');
      const subs = () => [...window.__menuSubs(menu)].map((s) => s.hasAttribute('hidden'));
      const buttons = () =>
        window.__menuRows(menu)
          .map((row) => window.__menuControl(row).closest('button'))
          .filter(Boolean);
      buttons()[0].click();
      await wait(250);
      const afterFirst = subs();
      buttons()[1].click();
      await wait(250);
      return { afterFirst, afterSecond: subs() };
    });

    /** 图标：icon 渲染内置 mc-icon，绝对定位在行首、不占点击区；文字让开图标 */
    await page
      .waitForFunction(
        () => {
          const box = window.__deepAll('demo-menu-icon')[0]?.shadowRoot;
          if (!box) return false;
          return [...window.__deepAll('mc-menu-item', box)].every((i) => {
            const glyph = i.shadowRoot
              ?.querySelector('.mc-item-icon mc-icon')
              ?.shadowRoot?.querySelector('.mc-glyph');
            return glyph && /mc-icon-/.test(glyph.className);
          });
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    const icons = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-icon')[0].shadowRoot;
      const items = [...window.__deepAll('mc-menu-item', box)];
      const rect = (el) => el.getBoundingClientRect();
      const textRect = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return r.getBoundingClientRect();
      };
      return items.map((item) => {
        const wrap = item.shadowRoot.querySelector('.mc-item-icon');
        const glyph = wrap?.querySelector('mc-icon')?.shadowRoot?.querySelector('.mc-glyph');
        const row = window.__menuControl(item);
        return {
          display: wrap ? getComputedStyle(wrap).display : null,
          pointer: wrap ? getComputedStyle(wrap).pointerEvents : null,
          cls: glyph?.className ?? '',
          indent: Math.round(textRect(row).left - rect(item).left),
          rowW: Math.round(rect(item).width),
          overlayW: Math.round(rect(row).width),
          menuW: Math.round(rect(item.getRootNode().querySelector('.mc-list')).width),
        };
      });
    });

    /** 图标 + 文字 + 展开箭头三者齐：父级行文字只让开一次图标（text-indent 别从按钮继承到行内文字） */
    const parentIcon = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const host = document.createElement('mc-menu');
      host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:14rem';
      host.options = [
        { label: '带图标父级', icon: 'file', children: [{ label: '子项', href: '#sub' }] },
        { label: '带图标叶子', icon: 'file', href: '#leaf' },
      ];
      document.body.append(host);
      await wait(400);
      const textRect = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return r.getBoundingClientRect();
      };
      const rows = [...window.__menuRows(host)].map((row) => {
        const control = window.__menuControl(row);
        return {
          label: window.__menuText(row),
          expandable: row.hasAttribute('data-expandable'),
          padStart: getComputedStyle(control).paddingInlineStart,
          textIndent: getComputedStyle(control).textIndent,
          textLeft: Math.round(textRect(control).left - row.getBoundingClientRect().left),
        };
      });
      host.remove();
      return rows;
    });

    /** 尺寸：三档写在容器上，靠通道继承进子项 */
    const sizes = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-size')[0].shadowRoot;
      return [...window.__deepAll('mc-menu', box)].map((m) =>
        Math.round(window.__menuControl(window.__menuRows(m)[0]).getBoundingClientRect().height),
      );
    });

    /** 通道下发：嵌套实例也拿同一套（含根上按实例覆盖的那份） */
    const channel = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const host = document.createElement('mc-menu');
      host.setAttribute('size', 'sm');
      host.style.setProperty('--mc-menu-pad-x', '40px');
      document.body.append(host);
      await wait(300);
      host.options = [{ label: '父级', children: [{ label: '子项' }] }];
      await wait(400);
      const parentRow = window.__menuRows(host)[0];
      const sub = window.__menuSubs(host)[0];
      window.__menuControl(parentRow).closest('button').click();
      await wait(250);
      const childRow = window.__menuRows(sub)[0];
      const textRect = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return r.getBoundingClientRect();
      };
      const out = {
        childH: Math.round(childRow.getBoundingClientRect().height),
        parentIndent: Math.round(
          textRect(window.__menuControl(parentRow).closest('button')).left - parentRow.getBoundingClientRect().left,
        ),
        childIndent: Math.round(
          textRect(window.__menuControl(childRow).closest('a')).left - childRow.getBoundingClientRect().left,
        ),
      };
      host.remove();
      return out;
    });

    /** 压缩态：按钮切属性；项只留 icon、分组标题折掉；再点展开恢复 */
    const collapsedState = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const menu = () => box.querySelector('#collapsed-menu');
      const groupRow = () => window.__menuRows(menu()).find((row) => row.hasAttribute('group'));
      const firstRow = () => window.__menuRows(menu()).find((row) => !row.hasAttribute('group'));
      /* 父级行（有子菜单）：压缩后文字与箭头都要收掉，整行仍是 36 的方块 */
      const parentSample = () => {
        const row = window.__menuRows(menu()).find((item) => item.hasAttribute('data-expandable'));
        const control = row ? window.__menuControl(row) : null;
        if (!control) return null;
        const caret = control.querySelector('mc-icon');
        const span = control.querySelector('span');
        return {
          width: Math.round(control.getBoundingClientRect().width),
          color: getComputedStyle(control).color,
          padStart: getComputedStyle(control).paddingInlineStart,
          caret: caret ? getComputedStyle(caret).display : null,
          text: span ? getComputedStyle(span).display : null,
        };
      };
      const sample = () => {
        const row = firstRow();
        return {
          flag: menu().hasAttribute('collapsed'),
          width: Math.round(menu().getBoundingClientRect().width),
          rowW: Math.round(row.getBoundingClientRect().width),
          overlayW: Math.round(window.__menuControl(row).closest('a').getBoundingClientRect().width),
          labelColor: getComputedStyle(window.__menuControl(row).closest('a')).color,
          iconDisplay: getComputedStyle(row.shadowRoot.querySelector('.mc-item-icon')).display,
          groupDisplay: groupRow() ? getComputedStyle(groupRow()).display : null,
          flyouts: window.__menuFlyouts(menu()).length,
          parent: parentSample(),
        };
      };
      const expanded = sample();
      box.querySelector('mc-button').click();
      await wait(350);
      const compressed = sample();
      box.querySelector('mc-button').click();
      await wait(350);
      return { expanded, compressed, restored: sample() };
    });

    /** 压缩态浮层：鼠标移入父级行弹出、贴在行右侧、能一层层往下；移开收起；Esc / 点外部关 */
    const flyout = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      return { parentLabel: window.__menuText(window.__menuRows(box.querySelector('#collapsed-menu'))[2]) };
    });
    // 压缩
    await page.locator('demo-menu-collapsed mc-button').first().click();
    await page.waitForTimeout(350);
    const parentRowLocator = page.locator('demo-menu-collapsed mc-menu .mc-node mc-menu-item').nth(2);
    await parentRowLocator.hover();
    await page.waitForTimeout(600);
    const flyoutOpen = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const menu = box.querySelector('#collapsed-menu');
      const f = window.__menuFlyouts(menu)[0];
      const row = window.__menuRows(menu)[2];
      if (!f) return null;
      const fr = f.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const sub = f.querySelector('mc-menu');
      return {
        open: f.matches(':popover-open'),
        gap: Math.round(fr.left - rr.right),
        top: Math.round(fr.top - rr.top),
        width: Math.round(fr.width),
        labels: [...window.__menuRows(sub)].map((i) => window.__menuText(i)),
        labelVisible: getComputedStyle(window.__menuControl(window.__menuRows(sub)[0])).color,
        /* 指针进浮层后行不再 :hover，靠 data-open 把「这条分支开着」留在行上 */
        dataOpen: row.hasAttribute('data-open'),
        rowBg: getComputedStyle(row).backgroundColor,
      };
    });

    // 再往下钻一级：第三列浮层要用同一套面板外观（不能被 UA 的 [popover] 默认样式顶掉）
    await page.locator('demo-menu-collapsed .mc-flyout mc-menu .mc-node mc-menu-item button').nth(0).hover();
    await page.waitForTimeout(700);
    const flyoutDeep = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const menu = box.querySelector('#collapsed-menu');
      const f1 = window.__menuFlyouts(menu)[0];
      const sub = f1.querySelector('mc-menu');
      const f2 = window.__menuFlyouts(sub)[0];
      const row = window.__menuRows(sub)[2];
      const cs2 = getComputedStyle(f2);
      const textRect = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return r.getBoundingClientRect();
      };
      /* 浮层里每一列就是一级：不能再叠 level 缩进（否则没 icon 的行左边白留一块） */
      const rows = [...window.__menuRows(f2.querySelector('mc-menu'))].map((item) => ({
        label: window.__menuText(item),
        level: item.style.getPropertyValue('--mc-item-level'),
        indent: Math.round(
          textRect(window.__menuControl(item)).left - item.getBoundingClientRect().left,
        ),
      }));
      return {
        open: f2.matches(':popover-open'),
        dataOpen: row.hasAttribute('data-open'),
        sameChrome: cs2.backgroundColor === getComputedStyle(f1).backgroundColor,
        position: cs2.position,
        border: cs2.borderTopWidth,
        radius: cs2.borderTopLeftRadius,
        labels: rows.map((r) => r.label),
        rows,
      };
    });

    // 移开：两层一起收起，data-open 也摘掉
    await page.mouse.move(5, 5, { steps: 6 });
    await page.waitForTimeout(600);
    const flyoutClosed = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const menu = box.querySelector('#collapsed-menu');
      const f1 = window.__menuFlyouts(menu)[0];
      const f2 = window.__menuFlyouts(f1.querySelector('mc-menu'))[0];
      return {
        f1: f1.matches(':popover-open'),
        f2: f2.matches(':popover-open'),
        openRows: window.__deepAll('mc-menu-item[data-open]', menu).length,
      };
    });
    await page.locator('demo-menu-collapsed mc-button').first().click(); // 先切回展开态，后面的键盘用例从干净状态起
    await page.waitForTimeout(350);

    /** 键盘 / 失焦：压缩态下聚焦父级行也弹层，Esc 关；点外部关 */
    await page.locator('demo-menu-collapsed mc-button').first().click();
    await page.waitForTimeout(350);
    await page.locator('demo-menu-collapsed mc-menu .mc-node mc-menu-item button').nth(0).focus();
    await page.waitForTimeout(500);
    const byFocus = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const f = window.__menuFlyouts(box.querySelector("#collapsed-menu"))[0];
      return f ? f.matches(':popover-open') : null;
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const afterEsc = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const f = window.__menuFlyouts(box.querySelector("#collapsed-menu"))[0];
      return f ? f.matches(':popover-open') : null;
    });
    // 重新弹出 → 点外部关闭
    await page.locator('demo-menu-collapsed mc-menu .mc-node mc-menu-item').nth(2).hover();
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    const afterOutside = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const f = window.__menuFlyouts(box.querySelector("#collapsed-menu"))[0];
      return f ? f.matches(':popover-open') : null;
    });
    // 回到展开态，别把状态留给后面的断言
    await page.locator('demo-menu-collapsed mc-button').first().click();
    await page.waitForTimeout(350);

    /** options 的状态：current / disabled 镜像到宿主；禁用的行不给 href */
    const states = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-states')[0].shadowRoot;
      const items = [...window.__deepAll('mc-menu-item', box)];
      const rows = items.map((i) => window.__menuControl(i));
      const cs = (el) => getComputedStyle(el);
      return {
        currentFlags: items.map((i) => i.hasAttribute('data-current')),
        disabledFlags: items.map((i) => i.hasAttribute('data-disabled')),
        opacity: items.map((i) => cs(i).opacity),
        cursor: items.map((i) => cs(i).cursor),
        tags: rows.map((r) => r.tagName),
        disabledHref: rows[2].getAttribute('href'),
      };
    });

    /** 自备控件（兼容通道）：状态从插槽元素读 → 镜像到宿主，两种原生元素都一致 */
    const slot = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-slot')[0].shadowRoot;
      const items = [...window.__deepAll('mc-menu-item', box)];
      const rows = items.map((i) => window.__menuControl(i));
      const cs = (el) => getComputedStyle(el);
      return {
        tags: rows.map((r) => r.tagName),
        currentFlags: items.map((i) => i.hasAttribute('data-current')),
        disabledFlags: items.map((i) => i.hasAttribute('data-disabled')),
        opacity: items.map((i) => cs(i).opacity),
        cursor: items.map((i) => cs(i).cursor),
        buttonDisabled: rows[4].disabled,
        disabledHref: rows[3].getAttribute('href'),
      };
    });

    /** 真实鼠标悬停禁用项不亮 */
    await page.locator('demo-menu-states mc-menu-item').nth(2).hover();
    await page.waitForTimeout(300);
    const hoverDisabled = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-states')[0].shadowRoot;
      const item = window.__deepAll('mc-menu-item', box)[2];
      return { hovered: item.matches(':hover'), bg: getComputedStyle(item).backgroundColor };
    });

    /** 分组标题：鼠标穿透；带 children 的分组 = 标题 + 组内条目常显、缩进一档（不折叠） */
    const groups = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-groups')[0].shadowRoot;
      const menu = box.querySelector('#groups-menu');
      const rect = (el) => el.getBoundingClientRect();
      const textRect = (el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return r.getBoundingClientRect();
      };
      const rows = [...window.__menuRows(menu)];
      const group = rows.find((r) => r.hasAttribute('group'));
      const child = rows.find((r) => !r.hasAttribute('group'));
      const indent = () => Math.round(textRect(window.__menuControl(child).closest('a')).left - rect(child).left);
      /* 分组子项的缩进走自己那一档：改 collapsible 的逐级步长不该动它 */
      const ownIndent = indent();
      menu.style.setProperty('--mc-menu-indent-step', '60px');
      const afterStepOverride = indent();
      menu.style.removeProperty('--mc-menu-indent-step');
      return {
        pointer: getComputedStyle(group).pointerEvents,
        groupTag: window.__menuControl(group)?.tagName ?? null,
        childLevel: child.style.getPropertyValue('--mc-item-level'),
        childStep: child.style.getPropertyValue('--mc-item-step'),
        childIndent: ownIndent,
        afterStepOverride,
        childExpandable: child.hasAttribute('data-expandable'),
        /* 组内条目是平铺的行：菜单里没有隐藏起来的子菜单 */
        nestedMenus: window.__menuSubs(menu).length,
      };
    });

    /** 键盘：Tab 进到下一项、焦点环用 ring 令牌；禁用的两行进不来 */
    const keyboard = await (async () => {
      const links = page.locator('demo-menu-states a');
      await links.nth(0).focus();
      await page.keyboard.press('Tab');
      await page.waitForTimeout(150);
      const byKeyboard = await page.evaluate(() => {
        const box = window.__deepAll('demo-menu-states')[0].shadowRoot;
        let active = box.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return {
          focusVisible: !!active?.matches?.(':focus-visible'),
          outlineWidth: active ? getComputedStyle(active).outlineWidth : null,
        };
      });
      return byKeyboard;
    })();

    /** 状态镜像：运行时改插槽元素上的 data-current / data-disabled 也跟着走 */
    const mirror = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-slot')[0].shadowRoot;
      const item = [...window.__deepAll('mc-menu-item', box)][1];
      const a = window.__menuControl(item).closest('a');
      a.setAttribute('data-current', '');
      await wait(200);
      const afterSet = item.hasAttribute('data-current');
      a.removeAttribute('data-current');
      await wait(200);
      const afterRemove = item.hasAttribute('data-current');
      a.setAttribute('data-disabled', '');
      await wait(200);
      const disabled = item.hasAttribute('data-disabled');
      a.removeAttribute('data-disabled');
      await wait(200);
      return { afterSet, afterRemove, disabled, afterEnabled: item.hasAttribute('data-disabled') };
    });

    /** P31：document.createElement 创建的实例照常初始化，构造期没往宿主写属性；property 预设值也收 */
    const dynamic = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const host = document.createElement('mc-menu');
      const atCreate = host.getAttributeNames().length;
      const opts = [
        { type: 'group', label: '动态组' },
        { label: '动态项', icon: 'star' },
      ];
      host.options = opts; // 挂载前赋 property
      document.body.append(host);
      await wait(400);
      const out = {
        atCreate,
        shadow: !!host.shadowRoot,
        rows: [...window.__menuRows(host)].map((i) => window.__menuText(i)),
        groupPointer: getComputedStyle(window.__menuRows(host).find((row) => row.hasAttribute('group'))).pointerEvents,
        version: host.options,
      };
      host.remove();
      return out;
    });

    /** 绑定首屏双通道优先级：property 写过值后属性通道不能覆盖 */
    const priority = await page.evaluate(async () => {
      const el = document.createElement('mc-menu');
      document.body.append(el);
      await new Promise((r) => setTimeout(r, 80));
      el.options = [{ label: '来自 property' }];
      el.setAttribute('options', JSON.stringify([{ label: '来自属性' }]));
      await new Promise((r) => setTimeout(r, 300));
      const out = {
        labels: el.options.map((option) => option.label),
        rows: [...window.__menuRows(el)].map((item) =>
          window.__menuText(item),
        ),
      };
      el.remove();
      return out;
    });

    page.off('response', onResponse);
    page.off('pageerror', onError);

    return {
      priority,
      basic,
      options,
      indent,
      built,
      accordion,
      icons,
      parentIcon,
      sizes,
      channel,
      collapsedState,
      flyout,
      flyoutOpen,
      flyoutDeep,
      flyoutClosed,
      byFocus,
      afterEsc,
      afterOutside,
      states,
      slot,
      hoverDisabled,
      groups,
      keyboard,
      mirror,
      dynamic,
      failed,
    };
  })();

  /* options 的 expanded：开场展开；手风琴下同层只留一个（同层多个 expanded 时后面的赢）。
     单独再搭两个菜单跑：一个带 accordion、一个不带，免得搅乱上面那套共享探针状态。 */
  const expandedOption = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const make = (accordion) => {
      const menu = document.createElement('mc-menu');
      if (accordion) menu.setAttribute('accordion', '');
      menu.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:12rem';
      /* 挂载前赋的 property 走 _presetOptions 那条路（P31）：两行都声明 expanded，手风琴下应当只剩后一行开着 */
      menu.options = [
        { label: '甲', expanded: true, children: [{ label: '甲一', href: '#a' }] },
        { label: '乙', expanded: true, children: [{ label: '乙一', href: '#b' }] },
      ];
      document.body.append(menu);
      return menu;
    };
    const read = (menu) => ({
      expandedRows: [...window.__menuRows(menu)].map((row) =>
        row.hasAttribute('data-expanded'),
      ),
      hiddenSubs: [...window.__menuSubs(menu)].map((sub) =>
        sub.hasAttribute('hidden'),
      ),
    });
    const accordion = make(true);
    const plain = make(false);
    await wait(400);
    const out = { accordion: read(accordion), plain: read(plain) };
    accordion.remove();
    plain.remove();
    return out;
  });

  /* 文档页「默认展开」演示：expanded: true 的行开场展开，嵌套父级各自摊开 */
  const expandedDemo = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const find = () => {
      const box = window.__deepAll('demo-menu-expanded')[0]?.shadowRoot;
      return box?.querySelector('mc-menu') ?? null;
    };
    let menu = find();
    for (let i = 0; i < 40 && !menu?.shadowRoot?.querySelector('mc-menu-item'); i += 1) {
      await wait(100);
      menu = find();
    }
    if (!menu) return null;
    const rows = [...window.__menuRows(menu)];
    /* 组件 的子菜单（第一层展开）：行是 按钮 / 表单，表单也是 expanded */
    const sub = window.__menuSubs(menu)[0] ?? null;
    const subRows = sub ? [...window.__menuRows(sub)] : null;
    /* 表单 的子菜单（第二层展开）：它自己不该再是 hidden */
    const nested = sub ? [...sub.shadowRoot.querySelectorAll('mc-menu')][0] : null;
    return {
      labels: rows.map((row) => window.__menuText(row)),
      expanded: rows.map((row) => row.hasAttribute('data-expanded')),
      hidden: [...window.__menuSubs(menu)].map((item) => item.hasAttribute('hidden')),
      subLabels: subRows ? subRows.map((row) => window.__menuText(row)) : null,
      subExpanded: subRows ? subRows.map((row) => row.hasAttribute('data-expanded')) : null,
      nestedHidden: nested
        ? [...window.__menuSubs(sub)].map((item) => item.hasAttribute('hidden'))
        : null,
    };
  });

  check(
    'options 的 expanded：父级行开场就展开；手风琴下同层只留一个（后面的赢）',
    JSON.stringify(expandedOption.plain.expandedRows) === JSON.stringify([true, true]) &&
      JSON.stringify(expandedOption.plain.hiddenSubs) === JSON.stringify([false, false]) &&
      JSON.stringify(expandedOption.accordion.expandedRows) === JSON.stringify([false, true]) &&
      JSON.stringify(expandedOption.accordion.hiddenSubs) === JSON.stringify([true, false]),
    JSON.stringify(expandedOption),
  );

  check(
    '默认展开的演示：expanded 的父级行开场展开，嵌套父级各自摊开（整条分支可见）',
    expandedDemo !== null &&
      JSON.stringify(expandedDemo.labels) === JSON.stringify(['基础', '组件', '设置']) &&
      JSON.stringify(expandedDemo.expanded) === JSON.stringify([false, true, false]) &&
      JSON.stringify(expandedDemo.hidden) === JSON.stringify([false]) &&
      JSON.stringify(expandedDemo.subLabels) === JSON.stringify(['按钮', '表单']) &&
      JSON.stringify(expandedDemo.subExpanded) === JSON.stringify([false, true]) &&
      JSON.stringify(expandedDemo.nestedHidden) === JSON.stringify([false]),
    JSON.stringify(expandedDemo),
  );

  check(
    'mc-menu / mc-menu-item 注册并渲染出实例，容器开 part="list"',
    menu.basic.upgraded && menu.basic.items >= 40 && menu.basic.menus >= 8 && menu.basic.listPart === 'list',
    JSON.stringify(menu.basic),
  );

  check(
    '数据驱动：分组 / 图标 / 当前 / 禁用 / href / attrs（外链）/ 父子行各就各位，children 默认收起',
    JSON.stringify(menu.options.before.map((o) => [o.group, o.label])) ===
      JSON.stringify([
        [false, '首页'],
        [true, '导航'],
        [false, '组件'],
        [false, '设置'],
        [false, '禁用项'],
        [false, 'ofa.js'],
      ]) &&
      menu.options.before[0].current === true &&
      menu.options.before[0].icon === 'menu' &&
      menu.options.before[0].href.endsWith('/packages/menu/page.html') &&
      menu.options.before[0].level === '0' &&
      menu.options.before[2].href === null &&
      menu.options.before[2].tag === 'BUTTON' &&
      menu.options.before[4].disabled === true &&
      /* attrs 里的链接属性落到了内置 <a> 上（data-* 留在行上，这里不查） */
      menu.options.before[5].href === 'https://ofajs.com' &&
      menu.options.before[5].target === '_blank' &&
      menu.options.before[5].rel === 'noreferrer' &&
      menu.options.before[5].title === '外链：新窗口打开' &&
      menu.options.subHiddenBefore === true,
    JSON.stringify(menu.options.before),
  );

  check(
    '内联开合：点父级行展开子菜单（箭头翻向 + data-expanded + 子项缩进一档），再点收起',
    menu.options.opened.hidden === false &&
      JSON.stringify(menu.options.opened.labels) === JSON.stringify(['按钮', '图标', '折叠面板']) &&
      menu.options.opened.hrefs.every((h) => h && h.includes('/packages/')) &&
      menu.options.opened.caret.name === 'chevron-down' &&
      menu.options.opened.caret.expanded === true &&
      menu.options.opened.indent === 32 &&
      menu.options.closed.hidden === true &&
      menu.options.closed.caret.name === 'chevron-right' &&
      menu.options.closed.caret.expanded === false,
    JSON.stringify(menu.options.opened),
  );

  check(
    '缩进：children 逐级 +16px（16 / 32 / 48），层级是容器算的、进了 --mc-item-level',
    JSON.stringify(menu.indent.levels) === JSON.stringify(['0', '1', '2']) &&
      JSON.stringify(menu.indent.indents) === JSON.stringify([16, 32, 48]),
    JSON.stringify(menu.indent),
  );

  check(
    '内置行：自己造 <a>（禁用不给 href、current / disabled 镜像到宿主、缩进 16）；attrs 的链接属性落到 <a>、data-* 留在行上',
    menu.built.length === 4 &&
      menu.built[0].tag === 'A' &&
      menu.built[0].href === '#/built-current.html' &&
      menu.built[0].current === true &&
      menu.built[0].disabled === false &&
      menu.built[0].indent === 16 &&
      menu.built[1].href === '#/built-normal.html' &&
      menu.built[1].current === false &&
      menu.built[2].href === null &&
      menu.built[2].disabled === true &&
      menu.built[2].current === false &&
      menu.built[3].href === 'https://example.com' &&
      menu.built[3].target === '_blank' &&
      menu.built[3].rel === 'noreferrer' &&
      menu.built[3].title === '外链' &&
      menu.built[3].dataStatus === 'planned' &&
      menu.built[3].controlStatus === null,
    JSON.stringify(menu.built),
  );

  check(
    '手风琴：点第二个分支，第一个自己收起来（同一层只留一个）',
    JSON.stringify(menu.accordion.afterFirst) === JSON.stringify([false, true, true]) &&
      JSON.stringify(menu.accordion.afterSecond) === JSON.stringify([true, false, true]),
    JSON.stringify(menu.accordion),
  );

  check(
    '运行时换数据：容器自己生成的那些项整体换掉；属性通道收 JSON、清空后不留行',
    menu.options.afterAdd.length === 7 &&
      menu.options.afterAdd[6].label === '动态项 1' &&
      menu.options.attrItems.length === 2 &&
      menu.options.attrItems[0].group === true &&
      menu.options.attrItems[1].href === '#/attr-target.html' &&
      menu.options.attrItems[1].icon === 'star' &&
      menu.options.afterClear === 0,
    JSON.stringify({ afterAdd: menu.options.afterAdd, attrItems: menu.options.attrItems, afterClear: menu.options.afterClear }),
  );

  check(
    '图标：icon 落在行首、pointer-events:none，整行照旧铺满且可点（文字让开图标）',
    menu.icons.every(
      (i) =>
        i.display === 'flex' &&
        i.pointer === 'none' &&
        /mc-icon-/.test(i.cls) &&
        i.overlayW === i.menuW &&
        i.rowW === i.menuW &&
        i.indent >= 38 &&
        i.indent <= 46,
    ),
    JSON.stringify(menu.icons),
  );

  check(
    '图标 + 文字 + 展开箭头三者齐：父级行文字只让开一次图标（text-indent 不从按钮继承到行内文字）',
    menu.parentIcon.length === 2 &&
      menu.parentIcon[0].expandable === true &&
      menu.parentIcon[0].textIndent === '0px' &&
      menu.parentIcon[0].padStart !== '0px' &&
      menu.parentIcon[0].textLeft === menu.parentIcon[1].textLeft,
    JSON.stringify(menu.parentIcon),
  );

  check(
    'size 写在容器上（sm/md/lg = 28/36/44）',
    JSON.stringify(menu.sizes) === JSON.stringify([28, 36, 44]),
    JSON.stringify(menu.sizes),
  );

  check(
    '通道下发到嵌套子菜单：size 与根上的实例覆盖都跟着走（子项 28 高、缩进 40 / 56）',
    menu.channel.childH === 28 &&
      menu.channel.parentIndent >= 40 &&
      menu.channel.parentIndent <= 44 &&
      menu.channel.childIndent === 56,
    JSON.stringify(menu.channel),
  );

  check(
    '压缩：整栏 36 宽、项只留图标（文字透明、分组折掉、父级行的箭头也收掉），再点恢复',
    menu.collapsedState.expanded.flag === false &&
      menu.collapsedState.expanded.width > 36 &&
      menu.collapsedState.expanded.groupDisplay !== 'none' &&
      menu.collapsedState.expanded.flyouts === 0 &&
      menu.collapsedState.expanded.parent.caret === 'flex' &&
      menu.collapsedState.expanded.parent.text !== 'none' &&
      menu.collapsedState.expanded.parent.width > 36 &&
      menu.collapsedState.compressed.flag === true &&
      menu.collapsedState.compressed.width === 36 &&
      menu.collapsedState.compressed.rowW === 36 &&
      menu.collapsedState.compressed.overlayW === 36 &&
      menu.collapsedState.compressed.labelColor === 'rgba(0, 0, 0, 0)' &&
      menu.collapsedState.compressed.iconDisplay === 'flex' &&
      menu.collapsedState.compressed.groupDisplay === 'none' &&
      menu.collapsedState.compressed.flyouts === 1 &&
      /* 父级行：控件 36 宽、文字与箭头都收掉、内联缩进归零（否则 border-box 被 padding 撑破方块） */
      menu.collapsedState.compressed.parent.width === 36 &&
      menu.collapsedState.compressed.parent.color === 'rgba(0, 0, 0, 0)' &&
      menu.collapsedState.compressed.parent.caret === 'none' &&
      menu.collapsedState.compressed.parent.text === 'none' &&
      menu.collapsedState.compressed.parent.padStart === '0px' &&
      menu.collapsedState.restored.flag === false &&
      menu.collapsedState.restored.width === menu.collapsedState.expanded.width &&
      menu.collapsedState.restored.flyouts === 0 &&
      menu.collapsedState.restored.parent.caret === 'flex' &&
      menu.collapsedState.restored.parent.text !== 'none',
    JSON.stringify(menu.collapsedState),
  );

  check(
    '压缩态浮层：鼠标移入父级行弹出（贴行右侧）、子项显示文字、锚点行保持选中观感；移开后收起',
    menu.flyoutOpen &&
      menu.flyoutOpen.open === true &&
      menu.flyoutOpen.gap >= 0 &&
      menu.flyoutOpen.gap <= 24 &&
      menu.flyoutOpen.top >= -4 &&
      menu.flyoutOpen.top <= 8 &&
      menu.flyoutOpen.labels.join() === '按钮,图标,表单' &&
      menu.flyoutOpen.labelVisible !== 'rgba(0, 0, 0, 0)' &&
      menu.flyoutOpen.dataOpen === true &&
      menu.flyoutOpen.rowBg !== 'rgba(0, 0, 0, 0)',
    JSON.stringify({ ...menu.flyoutOpen, parent: menu.flyout.parentLabel }),
  );

  check(
    '第三列浮层：同一套面板外观、行不再叠层级缩进（无 icon 也是 16px），两层一起收起',
    menu.flyoutDeep &&
      menu.flyoutDeep.open === true &&
      menu.flyoutDeep.dataOpen === true &&
      menu.flyoutDeep.sameChrome === true &&
      menu.flyoutDeep.position === 'fixed' &&
      parseFloat(menu.flyoutDeep.border) === 1 &&
      parseFloat(menu.flyoutDeep.radius) >= 4 &&
      menu.flyoutDeep.labels.join() === '输入框,下拉选择' &&
      /* 浮层每一列都是 level 0：缩进只剩基础内边距 16px，不能再叠 32/48 */
      menu.flyoutDeep.rows.length === 2 &&
      menu.flyoutDeep.rows.every((r) => r.level === '0' && r.indent === 16) &&
      menu.flyoutClosed.f1 === false &&
      menu.flyoutClosed.f2 === false &&
      menu.flyoutClosed.openRows === 0,
    JSON.stringify({ deep: menu.flyoutDeep, closed: menu.flyoutClosed }),
  );

  check(
    '浮层键盘可达：聚焦父级行也弹层，Esc 关闭；点外部也关闭',
    menu.byFocus === true && menu.afterEsc === false && menu.afterOutside === false,
    JSON.stringify({ byFocus: menu.byFocus, afterEsc: menu.afterEsc, afterOutside: menu.afterOutside }),
  );

  check(
    'options 的 current / disabled 镜像到宿主：禁用的行不给 href、压暗、悬停不亮',
    menu.states.currentFlags.join() === 'true,false,false' &&
      menu.states.disabledFlags.join() === 'false,false,true' &&
      menu.states.disabledHref === null &&
      Number(menu.states.opacity[2]) < 1 &&
      menu.states.cursor[2] === 'not-allowed',
    JSON.stringify(menu.states),
  );

  check(
    '自备控件（兼容通道）：状态从插槽元素读并镜像到宿主（当前 / 禁用两种原生元素都一致）',
    menu.slot.tags.join() === 'A,A,A,A,BUTTON' &&
      menu.slot.currentFlags.join() === 'true,false,false,false,false' &&
      menu.slot.disabledFlags.join() === 'false,false,false,true,true' &&
      menu.slot.buttonDisabled === true &&
      menu.slot.disabledHref === null &&
      Number(menu.slot.opacity[3]) < 1 &&
      Number(menu.slot.opacity[4]) < 1 &&
      menu.slot.cursor[3] === 'not-allowed' &&
      menu.slot.cursor[4] === 'not-allowed',
    JSON.stringify(menu.slot),
  );

  check(
    '禁用项不响应悬停；分组标题鼠标穿透；分组子项常显、缩进走自己那档 28px（改 collapsible 步长不影响它）',
    menu.hoverDisabled.bg === 'rgba(0, 0, 0, 0)' &&
      menu.groups.pointer === 'none' &&
      menu.groups.groupTag === null &&
      menu.groups.childLevel === '1' &&
      menu.groups.childStep.includes('--mc-menu-group-indent') &&
      menu.groups.childIndent === 28 &&
      menu.groups.afterStepOverride === 28 &&
      menu.groups.childExpandable === false &&
      menu.groups.nestedMenus === 0,
    JSON.stringify({ hover: menu.hoverDisabled, group: menu.groups }),
  );

  check(
    '键盘：Tab 进到下一项且焦点环用 ring 令牌',
    menu.keyboard.focusVisible && parseFloat(menu.keyboard.outlineWidth) === 2,
    JSON.stringify(menu.keyboard),
  );

  check(
    '状态镜像跟随运行时变化：data-current / data-disabled 加了就跟着走、摘掉就恢复',
    menu.mirror.afterSet === true &&
      menu.mirror.afterRemove === false &&
      menu.mirror.disabled === true &&
      menu.mirror.afterEnabled === false,
    JSON.stringify(menu.mirror),
  );

  check(
    'createElement 创建的实例照常初始化（P31：构造期没往宿主写属性），挂载前赋的 property 收得到',
    menu.dynamic.atCreate === 0 &&
      menu.dynamic.shadow &&
      JSON.stringify(menu.dynamic.rows) === JSON.stringify(['动态组', '动态项']) &&
      menu.dynamic.groupPointer === 'none' &&
      Array.isArray(menu.dynamic.version) &&
      menu.dynamic.version.length === 2,
    JSON.stringify(menu.dynamic),
  );

  check(
    '绑定首屏可能同时写属性与 property：property 写过值后，后到的属性通道不覆盖它',
    menu.priority.labels[0] === '来自 property' &&
      menu.priority.rows.includes('来自 property') &&
      !menu.priority.rows.includes('来自属性'),
    JSON.stringify(menu.priority),
  );

  check('页面无 404 / 报错', menu.failed.length === 0, menu.failed.join('\n'));
}