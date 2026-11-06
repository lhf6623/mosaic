/**
 * mc-menu / mc-menu-item · 数据驱动的垂直菜单：
 * 渲染（分组 / 图标 / 当前 / 禁用 / href / children / 属性通道）、层级缩进、内联开合、
 * 手风琴、压缩态与浮层子菜单（hover / focus / Esc / 点外部）、尺寸通道、P31 动态创建
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
            'demo-menu-basic, demo-menu-nested, demo-menu-accordion, demo-menu-collapsed, demo-menu-expanded, demo-menu-current',
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
      const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
      const menu = box.querySelector('#options-menu');
      return {
        upgraded: !!menu?.shadowRoot,
        items: window.__deepAll('mc-menu-item').length,
        menus: window.__deepAll('mc-menu').length,
        listPart: menu?.shadowRoot.querySelector('[part="list"]')?.getAttribute('part') ?? null,
      };
    });

    /** 一刀切契约：页面上所有数据驱动的菜单，options 每一项（含 children 递归）都写了非空且唯一的 key */
    const keyCoverage = await page.evaluate(() => {
      const report = { menus: 0, checked: 0, missing: [], duplicate: [] };
      for (const menu of window.__deepAll('mc-menu')) {
        const list = menu.options;
        if (!list || typeof list[Symbol.iterator] !== 'function') continue;
        const items = [...list];
        if (!items.length) continue;
        report.menus += 1;
        const seen = new Set();
        const walk = (nodes, trail) => {
          for (const option of nodes ?? []) {
            if (!option || typeof option !== 'object') continue;
            const where = trail + '/' + (option.label ?? '?');
            const key = option.key == null ? '' : String(option.key).trim();
            if (!key) report.missing.push(where);
            else if (seen.has(key)) report.duplicate.push(key);
            else seen.add(key);
            report.checked += 1;
            walk(option.children, where);
          }
        };
        walk(items, menu.id || 'mc-menu');
      }
      return report;
    });
    check(
      '页面上所有 options（含 children）都写了非空且唯一的 key',
      keyCoverage.menus >= 8 &&
        keyCoverage.checked >= 20 &&
        keyCoverage.missing.length === 0 &&
        keyCoverage.duplicate.length === 0,
      JSON.stringify(keyCoverage),
    );

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
          { key: 'attr-group', type: 'group', label: '属性组' },
          { key: 'attr-item', label: '属性项', icon: 'star', href: '#/attr-target.html' },
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

    /** key 复用：同一份菜单换当前项（容器属性 current），行 / 子菜单节点不重建、也不移动 */
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
      /* 只换当前项：数据一个字都不动，命中的行按 href 认（这里取「设置」那一行的 href） */
      const targetKey = menu.options.find((option) => option.label === '设置')?.key ?? '';
      menu.setAttribute('current', targetKey);
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
      '换当前项只改容器属性 current：行 / 子菜单节点复用、不移位',
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
      /* 当前项在容器上（值 = 那行的 href）：行自己不带高亮字段 */
      menu.setAttribute('current', 'built-current');
      document.body.append(menu);
      await wait(200);
      menu.options = [
        { key: 'built-current', label: '内置当前项', href: '#/built-current.html' },
        { key: 'built-normal', label: '内置普通项', href: '#/built-normal.html' },
        { key: 'built-disabled', label: '内置禁用项', disabled: true },
        {
          key: 'built-external',
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
        { key: 'parent', label: '带图标父级', icon: 'file', children: [{ key: 'parent/child', label: '子项', href: '#sub' }] },
        { key: 'leaf', label: '带图标叶子', icon: 'file', href: '#leaf' },
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
      host.options = [{ key: 'parent', label: '父级', children: [{ key: 'parent/child', label: '子项' }] }];
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

    /** 禁用：数据里写 disabled —— 镜像到宿主、压暗、不给 href；当前行（标签路径命中的那个）镜像成 data-current */
    const states = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-current')[0].shadowRoot;
      const items = [...window.__deepAll('mc-menu-item', box)];
      const byLabel = (label) =>
        items.find((item) => item.getAttribute('label') === label) ?? null;
      const cs = (el) => getComputedStyle(el);
      const current = byLabel('输入框');
      const disabled = byLabel('禁用项');
      const parent = byLabel('组件');
      return {
        currentFlag: !!current?.hasAttribute('data-current'),
        currentCount: items.filter((item) => item.hasAttribute('data-current')).length,
        disabledFlag: !!disabled?.hasAttribute('data-disabled'),
        disabledHref: disabled ? window.__menuControl(disabled).getAttribute('href') : undefined,
        opacity: disabled ? cs(disabled).opacity : null,
        cursor: disabled ? cs(disabled).cursor : null,
        parentTag: parent ? window.__menuControl(parent).tagName : null,
      };
    });

    /** 真实鼠标悬停禁用项不亮 */
    await page.locator('demo-menu-current mc-menu-item[label="禁用项"]').hover();
    await page.waitForTimeout(300);
    const hoverDisabled = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-current')[0].shadowRoot;
      const item = window.__deepAll('mc-menu-item', box).find(
        (i) => i.getAttribute('label') === '禁用项',
      );
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

    /** 键盘：Tab 进到下一项、焦点环用 ring 令牌；禁用的行进不来 */
    const keyboard = await (async () => {
      const links = page.locator('demo-menu-current a');
      await links.nth(0).focus();
      await page.keyboard.press('Tab');
      await page.waitForTimeout(150);
      const byKeyboard = await page.evaluate(() => {
        const box = window.__deepAll('demo-menu-current')[0].shadowRoot;
        let active = box.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return {
          focusVisible: !!active?.matches?.(':focus-visible'),
          outlineWidth: active ? getComputedStyle(active).outlineWidth : null,
        };
      });
      return byKeyboard;
    })();

    /** P31：document.createElement 创建的实例照常初始化，构造期没往宿主写属性；property 预设值也收 */
    const dynamic = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const host = document.createElement('mc-menu');
      const atCreate = host.getAttributeNames().length;
      const opts = [
        { key: 'dynamic-group', type: 'group', label: '动态组' },
        { key: 'dynamic-item', label: '动态项', icon: 'star' },
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
      el.options = [{ key: 'property', label: '来自 property' }];
      el.setAttribute('options', JSON.stringify([{ key: 'attr', label: '来自属性' }]));
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
      hoverDisabled,
      groups,
      keyboard,
      dynamic,
      failed,
    };
  })();

  /* 默认展开是容器上的布尔属性：整棵摊开；手风琴下同层只留一个。
     另外「当前项那一支自动展开」单列一条 —— 它不写 expanded 属性，也不在数据里（数据里没有状态）。 */
  const expandedOption = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const make = ({ accordion = false, expanded = false, current = null } = {}) => {
      const menu = document.createElement('mc-menu');
      if (accordion) menu.setAttribute('accordion', '');
      if (expanded) menu.setAttribute('expanded', '');
      /* 当前项只写在容器上，值是 label 路径（祖先 label 用 / 连） */
      if (current) menu.setAttribute('current', current);
      menu.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:12rem';
      /* 挂载前赋的 property 走 _presetOptions 那条路（P31）：数据里只有 label / children / href */
      menu.options = [
        { key: 'a', label: '甲', children: [{ key: 'a/1', label: '甲一', href: '#a' }] },
        { key: 'b', label: '乙', children: [{ key: 'b/1', label: '乙一', href: '#b' }] },
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
      currentRows: [...window.__menuRows(menu)].map((row) => row.hasAttribute('current')),
    });
    const plain = make({ expanded: true });
    const accordion = make({ accordion: true, expanded: true });
    const pinned = make({ accordion: true, current: 'a/1' });
    await wait(400);
    const out = {
      plain: read(plain),
      accordion: read(accordion),
      pinned: read(pinned),
      /* 嵌套实例吃到的是解出来的 href：子菜单里的行也要标成当前项 */
      pinnedSubCurrent: [...window.__menuSubs(pinned)].map(
        (sub) => [...window.__menuRows(sub)].filter((row) => row.hasAttribute('current')).length,
      ),
    };
    for (const menu of [plain, accordion, pinned]) menu.remove();
    return out;
  });

  /* 同一个 href 写了两行（甲 / 乙▸丙）：当前项只亮一行 —— label 路径精确到那一行，写 href 时认第一处 */
  const duplicateHref = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const menu = document.createElement('mc-menu');
    menu.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:12rem';
    menu.options = [
      { key: 'a', label: '甲', href: '#/same.html' },
      { key: 'b', label: '乙', children: [{ key: 'b/c', label: '丙', href: '#/same.html' }] },
    ];
    document.body.append(menu);
    await wait(300);
    const read = () => ({
      current: [...window.__menuRows(menu)]
        .filter((row) => row.hasAttribute('current'))
        .map((row) => window.__menuText(row)),
      expanded: [...window.__menuRows(menu)].map((row) => row.hasAttribute('data-expanded')),
      sub: window.__menuSubs(menu).map((sub) =>
        [...window.__menuRows(sub)].map(
          (row) => window.__menuText(row) + (row.hasAttribute('current') ? '*' : ''),
        ),
      ),
    });
    const empty = read();
    menu.setAttribute('current', 'b/c');
    await wait(300);
    const byPath = read();
    menu.setAttribute('current', 'a');
    await wait(300);
    const byHref = read();
    menu.remove();
    return { empty, byPath, byHref };
  });

  /* 换当前项只「补开命中的那一支」，不负责收别人的：手风琴下才收同层其它分支 */
  const currentKeepsOpen = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const make = (accordion) => {
      const menu = document.createElement('mc-menu');
      if (accordion) menu.setAttribute('accordion', '');
      menu.setAttribute('current', 'a/1');
      menu.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:12rem';
      menu.options = [
        { key: 'a', label: '甲', children: [{ key: 'a/1', label: '甲一', href: '#a' }] },
        { key: 'b', label: '乙', children: [{ key: 'b/1', label: '乙一', href: '#b' }] },
        { key: 'c', label: '丙', children: [{ key: 'c/1', label: '丙一', href: '#c' }] },
      ];
      document.body.append(menu);
      return menu;
    };
    const read = (menu) => ({
      expanded: [...window.__menuRows(menu)].map((row) => row.hasAttribute('data-expanded')),
      hidden: [...window.__menuSubs(menu)].map((sub) => sub.hasAttribute('hidden')),
      current: [...window.__menuRows(menu)]
        .filter((row) => row.hasAttribute('current'))
        .map((row) => window.__menuText(row)),
    });
    const clickParent = (menu, label) => {
      const row = [...window.__menuRows(menu)].find((item) => window.__menuText(item) === label);
      window.__menuControl(row).closest('button').click();
    };
    const plain = make(false);
    const accordion = make(true);
    await wait(400);
    const start = { plain: read(plain), accordion: read(accordion) };
    /* 手动再多开一支：普通模式两支并存，手风琴下前一支被收掉 */
    clickParent(plain, '乙');
    clickParent(accordion, '乙');
    await wait(250);
    const manual = { plain: read(plain), accordion: read(accordion) };
    /* 换当前项：普通模式收进来的那支不收，手风琴下只留命中的这一支 */
    plain.setAttribute('current', 'c/1');
    accordion.setAttribute('current', 'c/1');
    await wait(300);
    const swapped = { plain: read(plain), accordion: read(accordion) };
    plain.remove();
    accordion.remove();
    return { start, manual, swapped };
  });

  /* 文档页「默认展开」演示：expanded 属性整棵摊开，嵌套父级各自摊开 */
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

  /* 文档页「当前项」演示：current 写 label 路径，命中的行高亮、祖先分支开场展开；
     右边几个按钮改的是同一个属性（点按钮 → 数据变 → 属性变），只换高亮分支（行不重建），换回去也回得来 */
  const currentDemo = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const find = () =>
      window.__deepAll('demo-menu-current')[0]?.shadowRoot?.querySelector('mc-menu') ?? null;
    let menu = find();
    for (let i = 0; i < 40 && !menu?.shadowRoot?.querySelector('mc-menu-item'); i += 1) {
      await wait(100);
      menu = find();
    }
    if (!menu) return null;
    const snapshot = () => {
      const rows = [...window.__menuRows(menu)];
      const sub = window.__menuSubs(menu)[0] ?? null;
      const nested = sub ? [...sub.shadowRoot.querySelectorAll('mc-menu')][0] : null;
      const pick = (m) =>
        [...window.__menuRows(m)]
          .filter((row) => row.hasAttribute('current'))
          .map((row) => window.__menuText(row));
      return {
        current: pick(menu),
        expanded: rows.map((row) => row.hasAttribute('data-expanded')),
        hidden: [...window.__menuSubs(menu)].map((item) => item.hasAttribute('hidden')),
        deepHidden: nested ? [...sub.shadowRoot.querySelectorAll('mc-menu')].map((m) => m.hasAttribute('hidden')) : null,
        deepCurrent: nested ? pick(nested) : null,
      };
    };
    const before = snapshot();
    const rowsBefore = [...window.__menuRows(menu)];
    /* 演示右侧的按钮：点「设置」换到另一支，再点「组件/表单/输入框」换回来 */
    const buttons = [...window.__deepAll('demo-menu-current')[0].shadowRoot.querySelectorAll('mc-button')];
    buttons[3].click();
    await wait(400);
    const after = snapshot();
    after.sameRows =
      rowsBefore.length === [...window.__menuRows(menu)].length &&
      [...window.__menuRows(menu)].every((row, index) => row === rowsBefore[index]);
    buttons[2].click();
    await wait(400);
    return { before, after, restored: snapshot() };
  });

  check(
    '默认展开：expanded 属性整棵摊开；手风琴下同层只留一个；current 那一支优先（不写属性也开）',
    JSON.stringify(expandedOption.plain.expandedRows) === JSON.stringify([true, true]) &&
      JSON.stringify(expandedOption.plain.hiddenSubs) === JSON.stringify([false, false]) &&
      JSON.stringify(expandedOption.accordion.expandedRows) === JSON.stringify([false, true]) &&
      JSON.stringify(expandedOption.accordion.hiddenSubs) === JSON.stringify([true, false]) &&
      JSON.stringify(expandedOption.pinned.expandedRows) === JSON.stringify([true, false]) &&
      JSON.stringify(expandedOption.pinned.hiddenSubs) === JSON.stringify([false, true]) &&
      JSON.stringify(expandedOption.pinned.currentRows) === JSON.stringify([false, false]) &&
      JSON.stringify(expandedOption.pinnedSubCurrent) === JSON.stringify([1, 0]),
    JSON.stringify(expandedOption),
  );

  check(
    '当前项：current 命中 label 路径的那一行高亮、祖先分支开场展开（含第二层）；点演示按钮换属性只换分支，行不重建',
    currentDemo !== null &&
      JSON.stringify(currentDemo.before.current) === JSON.stringify([]) &&
      JSON.stringify(currentDemo.before.expanded) === JSON.stringify([false, true, false, false]) &&
      JSON.stringify(currentDemo.before.hidden) === JSON.stringify([false]) &&
      currentDemo.before.deepHidden !== null &&
      JSON.stringify(currentDemo.before.deepHidden) === JSON.stringify([false]) &&
      JSON.stringify(currentDemo.before.deepCurrent) === JSON.stringify(['输入框']) &&
      JSON.stringify(currentDemo.after.current) === JSON.stringify(['设置']) &&
      /* 不是手风琴：换当前项不收起已经开着的「组件」分支 */
      JSON.stringify(currentDemo.after.expanded) === JSON.stringify([false, true, false, false]) &&
      JSON.stringify(currentDemo.after.hidden) === JSON.stringify([false]) &&
      JSON.stringify(currentDemo.after.deepCurrent) === JSON.stringify([]) &&
      currentDemo.after.sameRows &&
      JSON.stringify(currentDemo.restored) === JSON.stringify(currentDemo.before),
    JSON.stringify(currentDemo),
  );

  check(
    '换 current 只补开命中的那一支：不开手风琴就保留已摊开的分支，accordion 才收同层其它分支',
    JSON.stringify(currentKeepsOpen.start.plain.expanded) === JSON.stringify([true, false, false]) &&
      JSON.stringify(currentKeepsOpen.start.accordion.expanded) === JSON.stringify([true, false, false]) &&
      JSON.stringify(currentKeepsOpen.manual.plain.expanded) === JSON.stringify([true, true, false]) &&
      JSON.stringify(currentKeepsOpen.manual.accordion.expanded) ===
        JSON.stringify([false, true, false]) &&
      JSON.stringify(currentKeepsOpen.swapped.plain.expanded) === JSON.stringify([true, true, true]) &&
      JSON.stringify(currentKeepsOpen.swapped.plain.hidden) === JSON.stringify([false, false, false]) &&
      JSON.stringify(currentKeepsOpen.swapped.accordion.expanded) ===
        JSON.stringify([false, false, true]) &&
      JSON.stringify(currentKeepsOpen.swapped.accordion.hidden) ===
        JSON.stringify([true, true, false]),
    JSON.stringify(currentKeepsOpen),
  );

  check(
    '同一个 href 写了两行：当前项只亮一行 —— label 路径精确到那一行，写 href 时认第一处',
    JSON.stringify(duplicateHref.empty.current) === JSON.stringify([]) &&
      JSON.stringify(duplicateHref.empty.expanded) === JSON.stringify([false, false]) &&
      JSON.stringify(duplicateHref.byPath.current) === JSON.stringify([]) &&
      JSON.stringify(duplicateHref.byPath.expanded) === JSON.stringify([false, true]) &&
      JSON.stringify(duplicateHref.byPath.sub) === JSON.stringify([['丙*']]) &&
      JSON.stringify(duplicateHref.byHref.current) === JSON.stringify(['甲']) &&
      /* 换到「甲」时「乙」不收：非手风琴下开着的分支保持原样 */
      JSON.stringify(duplicateHref.byHref.expanded) === JSON.stringify([false, true]) &&
      JSON.stringify(duplicateHref.byHref.sub) === JSON.stringify([['丙']]),
    JSON.stringify(duplicateHref),
  );

  check(
    '默认展开的演示：expanded 属性让父级行开场展开，嵌套父级各自摊开（整条分支可见）',
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
    '当前项 / 禁用镜像到宿主：命中的那一行 data-current、禁用的行 data-disabled / 压暗 / 不给 href，父级行是按钮',
    menu.states.currentFlag === true &&
      menu.states.currentCount === 1 &&
      menu.states.disabledFlag === true &&
      menu.states.disabledHref === null &&
      Number(menu.states.opacity) < 1 &&
      menu.states.cursor === 'not-allowed' &&
      menu.states.parentTag === 'BUTTON',
    JSON.stringify(menu.states),
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

  /* 跳转：ofa 应用内内置 <a> 渲染成 olink 形态（hash 地址 + origin-href + olink），
     点击走 ofa 的 SPA 导航（地址栏换 hash、不整刷）；navigate 事件可取消 —— 取消就不跳。
     外链与 # 锚点不吃这一套（原样 href、无 olink）。
     ⚠️ 菜单要挂进文档页里（o-app 的子树）：直接 append 到 body 上没有应用上下文，href 会按普通链接原生跳转 */
  const navigation = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const host = window.__deepAll('demo-menu-basic')[0];
    const menu = document.createElement('mc-menu');
    menu.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:12rem';
    menu.options = [
      { key: 'inner', label: '站内页', href: 'packages/button/page.html' },
      { key: 'external', label: '外链', href: 'https://example.com/x.html' },
      { key: 'anchor', label: '锚点', href: '#part' },
    ];
    host.append(menu);
    await wait(300);
    const controlOf = (index) => window.__menuControl(window.__menuRows(menu)[index]);
    const shape = (index) => {
      const a = controlOf(index);
      return {
        href: a.getAttribute('href'),
        olink: a.hasAttribute('olink'),
        origin: a.getAttribute('origin-href'),
      };
    };
    const rows = [shape(0), shape(1), shape(2)];
    const events = [];
    const onNav = (e) => {
      events.push({ ...e.detail });
      /* 第一次取消：地址栏不许动 */
      if (events.length === 1) e.preventDefault();
    };
    menu.addEventListener('navigate', onNav);
    const hashBefore = location.hash;
    controlOf(0).click();
    await wait(300);
    const hashAfterCancel = location.hash;
    controlOf(0).click();
    await wait(600);
    const hashAfterAllow = location.hash;
    menu.removeEventListener('navigate', onNav);
    /* 把路由退回去（ofa 的 back），别影响套件收尾 */
    history.back();
    await wait(600);
    const hashRestored = location.hash;
    menu.remove();
    return { rows, events, hashBefore, hashAfterCancel, hashAfterAllow, hashRestored };
  });

  check(
    '跳转：应用内内置 <a> 渲染成 olink 形态（hash 地址 + origin-href）；外链 / 锚点原样输出',
    navigation.rows[0].olink === true &&
      navigation.rows[0].href.endsWith('#/packages/button/page.html') &&
      navigation.rows[0].origin.endsWith('/packages/button/page.html') &&
      !navigation.rows[0].origin.includes('#') &&
      navigation.rows[1].olink === false &&
      navigation.rows[1].href === 'https://example.com/x.html' &&
      navigation.rows[1].origin === null &&
      navigation.rows[2].olink === false &&
      navigation.rows[2].href === '#part',
    JSON.stringify(navigation.rows),
  );

  check(
    '跳转：navigate 事件可取消（取消不跳、放行后 ofa 接管换 hash、back 回得来）',
    navigation.events.length === 2 &&
      navigation.events[0].href === 'packages/button/page.html' &&
      navigation.events[0].resolved.endsWith('/packages/button/page.html') &&
      navigation.hashAfterCancel === navigation.hashBefore &&
      navigation.hashAfterAllow.endsWith('#/packages/button/page.html') &&
      navigation.hashRestored === navigation.hashBefore,
    JSON.stringify(navigation),
  );

  check('页面无 404 / 报错', menu.failed.length === 0, menu.failed.join('\n'));
}