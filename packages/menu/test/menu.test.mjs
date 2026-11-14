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
            'demo-menu-basic, demo-menu-navigate, demo-menu-nested, demo-menu-accordion, demo-menu-collapsed, demo-menu-expanded, demo-menu-current',
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
      /* current 指到子菜单里的动作项：分支开场自动展开，命中落在子项上（顶层没有行命中） */
      const subCurrentBefore = sub() ? rows(sub()).map((o) => o.current) : null;

      /* 演示初始就是展开的（current 命中子项），先点一下收起，再点展开 */
      window.__menuControl(parent()).closest('button').click();
      await wait(250);
      const closed = { hidden: sub()?.hasAttribute('hidden') ?? null, caret: caret() };

      window.__menuControl(parent()).closest('button').click();
      await wait(250);
      const opened = {
        hidden: sub()?.hasAttribute('hidden') ?? null,
        labels: rows(sub()).map((o) => o.label),
        hrefs: rows(sub()).map((o) => o.href),
        caret: caret(),
        indent: textIndent(sub()),
      };

      /* 运行时换一份数据：容器自己生成的那些项整体换掉（直接走 property，不依赖演示里的按钮） */
      menu.options = [
        ...menu.options,
        { key: 'dynamic-1', label: '动态项 1', icon: 'star', href: 'packages/tag/page.html' },
      ];
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

      return { before, subHiddenBefore, subCurrentBefore, opened, closed, afterAdd, attrItems, afterClear };
    });

    /** 动作项（按钮型行）：点击不跳转，只把容器 current 指过去 —— 演示里就是这么接的 */
    const actionRow = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
      const menu = box.querySelector('#options-menu');
      const rows = () => [...window.__menuRows(menu)];
      const pick = () =>
        rows()
          .filter((row) => row.hasAttribute('data-current'))
          .map((row) => window.__menuText(row));
      const row = rows().find((item) => window.__menuText(item) === '动作项');
      const hashBefore = location.hash;
      const before = { current: pick(), tag: window.__menuControl(row)?.tagName ?? null };
      window.__menuControl(row).click();
      await wait(250);
      const after = { current: pick(), hash: location.hash, currentAttr: menu.getAttribute('current') };
      /* 还原成演示初始的「子菜单动作项」：后面的 reuse 用例按它做基线 */
      menu.setAttribute('current', 'components/action');
      await wait(150);
      return { before, after, hashBefore, restored: menu.getAttribute('current') };
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
      /* 只换当前项：数据一个字都不动，命中的行按 key 认（演示初始 current 在子菜单动作项上，这里换到「ofa.js」） */
      const targetKey = menu.options.find((option) => option.label === 'ofa.js')?.key ?? '';
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
        reuse.beforeLabels[2] === '设置' &&
        /* current 在子菜单的动作项上：顶层没有行命中（复用不依赖命中位置） */
        reuse.beforeCurrent.every((c) => !c) &&
        reuse.afterCurrent[2] === false &&
        reuse.afterLabels[5] === 'ofa.js' &&
        reuse.afterCurrent[5] === true,
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

      window.__menuControl(rowByLabel(menu, 'src')).closest('button').click();
      await wait(200);
      const sub = window.__menuSubs(menu)[0];
      window.__menuControl(rowByLabel(sub, 'components')).closest('button').click();
      await wait(250);
      const sub2 = window.__menuSubs(sub)[0];

      return {
        levels: [
          rowByLabel(menu, 'README.md').style.getPropertyValue('--mc-item-level'),
          rowByLabel(sub, 'main.ts').style.getPropertyValue('--mc-item-level'),
          rowByLabel(sub2, 'index.ts').style.getPropertyValue('--mc-item-level'),
        ],
        indents: [
          textIndent(rowByLabel(menu, 'README.md')),
          textIndent(rowByLabel(sub, 'main.ts')),
          textIndent(rowByLabel(sub2, 'index.ts')),
        ],
        /* 同层里没写 icon 的行也留出图标位：文字与同层文字对齐，不是各自从行首起算 */
        noIcon: [textIndent(rowByLabel(sub, 'main.ts')), textIndent(rowByLabel(sub2, 'index.ts'))],
      };
    });

    /** 长标签：行的交互层不许比菜单宽（固定宽度时截断成 …，不能画到栏外压住旁边的页面） */
    const overflow = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const menu = document.createElement('mc-menu');
      menu.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:14rem';
      document.body.append(menu);
      await wait(200);
      menu.options = [
        {
          key: 'long-parent',
          label: '长标签父级行长标签父级行长标签父级行',
          icon: 'file',
          children: [
            { key: 'long-child', label: '长标签子项长标签子项长标签子项长标签子项', href: '#long' },
          ],
        },
      ];
      await wait(400);
      window.__menuControl(window.__menuRows(menu)[0]).closest('button').click();
      await wait(400);
      const control = (row) => window.__menuControl(row).closest('a, button');
      const pick = (row) => ({
        rowW: Math.round(row.getBoundingClientRect().width),
        ctlW: Math.round(control(row).getBoundingClientRect().width),
        scrollW: control(row).scrollWidth,
      });
      const out = {
        menuW: Math.round(menu.getBoundingClientRect().width),
        parent: pick(window.__menuRows(menu)[0]),
        child: {
          ...pick(window.__menuRows(window.__menuSubs(menu)[0])[0]),
          ellipsis: getComputedStyle(
            window.__menuControl(window.__menuRows(window.__menuSubs(menu)[0])[0]).closest('a, button'),
          ).textOverflow,
        },
      };
      menu.remove();
      return out;
    });

    /** 没写宽度的菜单：展开子项不许把整栏撑宽（内联子菜单跟父菜单同宽） */
    const stableWidth = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const rows = (m) => [...m.shadowRoot.querySelectorAll('.mc-node mc-menu-item')];
      const subs = (m) => [...m.shadowRoot.querySelectorAll('.mc-node mc-menu')];
      const label = (row) => row.getAttribute('label') ?? '';
      const click = (row) => row.shadowRoot.querySelector('button').click();
      /* 宽度 auto 的菜单挂在 flex 容器里 = 宽度由内容决定（文档页「压缩」演示就是这种写法） */
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;display:flex';
      document.body.append(wrap);
      const menu = document.createElement('mc-menu');
      wrap.append(menu);
      await wait(200);
      menu.options = [
        { key: 'stable-home', label: '首页', icon: 'menu', href: '#home' },
        {
          key: 'stable-parent',
          label: '组件',
          icon: 'file',
          children: [
            { key: 'stable-leaf', label: '按钮', icon: 'file', href: '#a1' },
            {
              key: 'stable-form',
              label: '表单',
              icon: 'settings',
              children: [{ key: 'stable-input', label: '输入框', icon: 'edit', href: '#a2x' }],
            },
          ],
        },
      ];
      await wait(400);
      const W = (el) => Math.round(el.getBoundingClientRect().width);
      const start = W(menu);
      click(rows(menu).find((row) => label(row) === '组件'));
      await wait(300);
      const level1 = W(menu);
      const sub1 = subs(menu)[0];
      click(rows(sub1).find((row) => label(row) === '表单'));
      await wait(300);
      const level2 = W(menu);
      const sub2 = subs(sub1)[0];
      const out = {
        start,
        level1,
        level2,
        sub1: W(sub1),
        sub2: sub2 ? W(sub2) : null,
        /* 缩进照旧：子项还是比父级深一档（同宽不等于不缩进） */
        levels: [
          rows(sub1)[0].style.getPropertyValue('--mc-item-level'),
          rows(sub2)[0].style.getPropertyValue('--mc-item-level'),
        ],
      };
      wrap.remove();
      return out;
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
          const box = window.__deepAll('demo-menu-basic')[0]?.shadowRoot;
          if (!box) return false;
          /* 图标现在散布在所有演示里：取基础演示中带 icon 且可见的行（收起的分支量不到宽度） */
          const rows = [...window.__deepAll('mc-menu-item', box)].filter(
            (i) => i.hasAttribute('icon') && i.getBoundingClientRect().width > 0,
          );
          return rows.length > 0 && rows.every((i) => {
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
      const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
      /* 只采顶层行（--mc-item-level 0）：缩进断言 38–46 是按顶层口径写的，
         子菜单展开后 level-1 行是 58，混进来会误报 */
      const items = [...window.__deepAll('mc-menu-item', box)].filter(
        (i) =>
          i.hasAttribute('icon') &&
          i.style.getPropertyValue('--mc-item-level') === '0' &&
          i.getBoundingClientRect().width > 0,
      );
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
          textRect(window.__menuControl(childRow).closest('a, button')).left -
            childRow.getBoundingClientRect().left,
        ),
      };
      host.remove();
      return out;
    });

    /** 压缩态：演示里的开关切属性；项只留 icon、分组标题折掉；再关掉恢复 */
    const collapsedState = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const menu = () => box.querySelector('#collapsed-menu');
      /* 开关是自定义元素，宿主 click 不进 shadow —— 点它内部那个原生 label（真实命中同一套） */
      const toggleSwitch = () => box.querySelector('mc-switch').shadowRoot.querySelector('label').click();
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
          overlayW: Math.round(window.__menuControl(row).closest('a, button').getBoundingClientRect().width),
          labelColor: getComputedStyle(window.__menuControl(row).closest('a, button')).color,
          iconDisplay: getComputedStyle(row.shadowRoot.querySelector('.mc-item-icon')).display,
          groupDisplay: groupRow() ? getComputedStyle(groupRow()).display : null,
          flyouts: window.__menuFlyouts(menu()).length,
          parent: parentSample(),
        };
      };
      const expanded = sample();
      toggleSwitch();
      await wait(350);
      const compressed = sample();
      toggleSwitch();
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
    await page.locator('demo-menu-collapsed mc-switch').first().click();
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
    await page.locator('demo-menu-collapsed .mc-flyout mc-menu .mc-node mc-menu-item button').nth(1).hover();
    await page.waitForTimeout(700);
    const flyoutDeep = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-collapsed')[0].shadowRoot;
      const menu = box.querySelector('#collapsed-menu');
      const f1 = window.__menuFlyouts(menu)[0];
      const sub = f1.querySelector('mc-menu');
      const f2 = window.__menuFlyouts(sub)[0];
      const row = window.__menuRows(sub)[1];
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
    await page.locator('demo-menu-collapsed mc-switch').first().click(); // 先切回展开态，后面的键盘用例从干净状态起
    await page.waitForTimeout(350);

    /** 键盘 / 失焦：压缩态下聚焦父级行也弹层，Esc 关；点外部关 */
    await page.locator('demo-menu-collapsed mc-switch').first().click();
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
    await page.locator('demo-menu-collapsed mc-switch').first().click();
    await page.waitForTimeout(350);

    /** 禁用：数据里写 disabled —— 镜像到宿主、压暗、不给 href；当前行（标签路径命中的那个）镜像成 data-current */
    const states = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-current')[0].shadowRoot;
      const items = [...window.__deepAll('mc-menu-item', box)];
      const byLabel = (label) =>
        items.find((item) => item.getAttribute('label') === label) ?? null;
      const cs = (el) => getComputedStyle(el);
      const current = byLabel('管理员');
      const disabled = byLabel('审计日志');
      const parent = byLabel('团队');
      /* 「团队」只是第一层祖先；「角色」在它自己的子菜单里 —— 路径上的每一级父级行都该高亮 */
      const nestedParent = byLabel('角色');
      const neutral = byLabel('概览');
      return {
        currentFlag: !!current?.hasAttribute('data-current'),
        currentCount: items.filter((item) => item.hasAttribute('data-current')).length,
        currentBranchCount: items.filter((item) => item.hasAttribute('data-current-branch')).length,
        leafBranch: !!current?.hasAttribute('data-current-branch'),
        parentBranch: !!parent?.hasAttribute('data-current-branch'),
        nestedParentBranch: !!nestedParent?.hasAttribute('data-current-branch'),
        currentColor: current ? cs(current).color : null,
        parentColor: parent ? cs(parent).color : null,
        neutralColor: neutral ? cs(neutral).color : null,
        currentBg: current ? cs(current).backgroundColor : null,
        parentBg: parent ? cs(parent).backgroundColor : null,
        currentLabelWeight: current ? cs(window.__menuControl(current)).fontWeight : null,
        parentLabelWeight: parent ? cs(window.__menuControl(parent)).fontWeight : null,
        disabledFlag: !!disabled?.hasAttribute('data-disabled'),
        disabledHref: disabled ? window.__menuControl(disabled).getAttribute('href') : undefined,
        opacity: disabled ? cs(disabled).opacity : null,
        cursor: disabled ? cs(disabled).cursor : null,
        parentTag: parent ? window.__menuControl(parent).tagName : null,
      };
    });

    /** 真实鼠标悬停禁用项不亮 */
    await page.locator('demo-menu-current mc-menu-item[label="审计日志"]').hover();
    await page.waitForTimeout(300);
    const hoverDisabled = await page.evaluate(() => {
      const box = window.__deepAll('demo-menu-current')[0].shadowRoot;
      const item = window.__deepAll('mc-menu-item', box).find(
        (i) => i.getAttribute('label') === '审计日志',
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
      const indent = () => Math.round(textRect(window.__menuControl(child).closest('a, button')).left - rect(child).left);
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

    /** 除「跳转链接」外的演示都拦截 navigate：点一个有真实 href 的行（含子菜单里的行）
        不换 hash、只换 current。真正的跳转由「跳转链接」演示单独验证。 */
    const demoLinks = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const tags = [
        'demo-menu-basic',
        'demo-menu-nested',
        'demo-menu-groups',
        'demo-menu-size',
        'demo-menu-collapsed',
        'demo-menu-accordion',
        'demo-menu-expanded',
        'demo-menu-current',
        'demo-menu-events',
        'demo-menu-customize',
        'demo-menu-part',
      ];
      /* 演示是运行时注册的：等每个演示的根菜单都出现再点 */
      for (let i = 0; i < 40; i += 1) {
        const ready = tags.every((tag) => {
          const box = window.__deepAll(tag)[0]?.shadowRoot;
          return !!box?.querySelector('mc-menu');
        });
        if (ready) break;
        await wait(100);
      }
      const out = [];
      for (const tag of tags) {
        const box = window.__deepAll(tag)[0]?.shadowRoot ?? null;
        const roots = box ? [...box.querySelectorAll('mc-menu')] : [];
        let found = 0;
        let checked = 0;
        let hashStable = true;
        let currentOk = true;
        for (const root of roots) {
          /* 第一个真正带 href 的行：本地演示的 href 行有的在子菜单里（如 accordion） */
          const row = window
            .__deepAll('mc-menu-item', root.shadowRoot)
            .find((item) => {
              const control = window.__menuControl(item);
              return control?.tagName === 'A' && control.getAttribute('href');
            });
          if (!row) continue;
          found += 1;
          const before = root.getAttribute('current');
          const hash = location.hash;
          window.__menuControl(row).click();
          await wait(250);
          checked += 1;
          if (location.hash !== hash) hashStable = false;
          if (!row.hasAttribute('data-current')) currentOk = false;
          if (root.getAttribute('current') !== row.getAttribute('data-row-key')) currentOk = false;
          if (before == null) root.removeAttribute('current');
          else root.setAttribute('current', before);
        }
        out.push({ tag, roots: roots.length, found, checked, hashStable, currentOk });
      }
      return out;
    });


    page.off('response', onResponse);
    page.off('pageerror', onError);

    return {
      priority,
      basic,
      options,
      actionRow,
      indent,
      overflow,
      stableWidth,
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
      demoLinks,
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
      /* 当前项只写在容器上，值是命中行的 key */
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

  /* 两个叶子行写同一个 href（甲 / 乙▸丙）：current 只按 key 命中，只有被点名的那一行亮 —— href 不参与定位、不会亮两行 */
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
    const subs = [...window.__menuSubs(menu)];
    /* 第二个子菜单是「组件」：行是 表单 / 表格，表单自己再开一层 */
    const compSub = subs[1] ?? null;
    const compRows = compSub ? [...window.__menuRows(compSub)] : null;
    const nested = compSub ? [...compSub.shadowRoot.querySelectorAll('mc-menu')][0] : null;
    return {
      labels: rows.map((row) => window.__menuText(row)),
      expanded: rows.map((row) => row.hasAttribute('data-expanded')),
      hidden: subs.map((item) => item.hasAttribute('hidden')),
      subLabels: compRows ? compRows.map((row) => window.__menuText(row)) : null,
      subExpanded: compRows ? compRows.map((row) => row.hasAttribute('data-expanded')) : null,
      nestedLabels: nested ? [...window.__menuRows(nested)].map((row) => window.__menuText(row)) : null,
      nestedHidden: nested
        ? [...window.__menuSubs(compSub)].map((item) => item.hasAttribute('hidden'))
        : null,
    };
  });

  /* 文档页「当前项」演示：current 写 key，命中的行高亮、路径上的父级高亮、祖先分支开场展开；
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
      const subs = [...window.__menuSubs(menu)];
      /* 第二个子菜单是「团队」：行是 成员 / 角色，角色自己再开一层 */
      const teamSub = subs[1] ?? null;
      const rolesSub = teamSub ? [...teamSub.shadowRoot.querySelectorAll('mc-menu')][0] : null;
      const pick = (m) =>
        [...window.__menuRows(m)]
          .filter((row) => row.hasAttribute('current'))
          .map((row) => window.__menuText(row));
      const branch = (m) =>
        [...window.__menuRows(m)]
          .filter((row) => row.hasAttribute('data-current-branch'))
          .map((row) => window.__menuText(row));
      return {
        current: pick(menu),
        branch: branch(menu),
        expanded: rows.map((row) => row.hasAttribute('data-expanded')),
        hidden: subs.map((item) => item.hasAttribute('hidden')),
        deepHidden: teamSub
          ? [...window.__menuSubs(teamSub)].map((m) => m.hasAttribute('hidden'))
          : null,
        deepCurrent: rolesSub ? pick(rolesSub) : null,
        /* 「角色」是「团队」那一列的子菜单行；第二层的分支要在 teamSub 里数 */
        deepBranch: teamSub ? branch(teamSub) : null,
      };
    };
    const before = snapshot();
    const rowsBefore = [...window.__menuRows(menu)];
    /* 演示右侧的按钮：点「设置」换到另一支，再点「团队/角色/管理员」换回来 */
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
    '当前项：current 命中的那一行高亮、路径上每一级父级 data-current-branch 高亮（含第二层）、祖先分支开场展开；点演示按钮换属性只换分支，行不重建',
    currentDemo !== null &&
      JSON.stringify(currentDemo.before.current) === JSON.stringify([]) &&
      JSON.stringify(currentDemo.before.branch) === JSON.stringify(['团队']) &&
      JSON.stringify(currentDemo.before.expanded) === JSON.stringify([false, false, true, false, false]) &&
      JSON.stringify(currentDemo.before.hidden) === JSON.stringify([true, false]) &&
      currentDemo.before.deepHidden !== null &&
      JSON.stringify(currentDemo.before.deepHidden) === JSON.stringify([false]) &&
      JSON.stringify(currentDemo.before.deepCurrent) === JSON.stringify(['管理员']) &&
      JSON.stringify(currentDemo.before.deepBranch) === JSON.stringify(['角色']) &&
      JSON.stringify(currentDemo.after.current) === JSON.stringify(['设置']) &&
      JSON.stringify(currentDemo.after.branch) === JSON.stringify([]) &&
      JSON.stringify(currentDemo.after.deepBranch) === JSON.stringify([]) &&
      /* 不是手风琴：换当前项不收起已经开着的「团队」分支 */
      JSON.stringify(currentDemo.after.expanded) === JSON.stringify([false, false, true, false, false]) &&
      JSON.stringify(currentDemo.after.hidden) === JSON.stringify([true, false]) &&
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
    '同一个 href 写了两行：current 只按 key 命中，只有被点名的那一行亮（href 不参与定位）',
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
      JSON.stringify(expandedDemo.labels) === JSON.stringify(['指南', '组件', 'API']) &&
      JSON.stringify(expandedDemo.expanded) === JSON.stringify([true, true, false]) &&
      JSON.stringify(expandedDemo.hidden) === JSON.stringify([false, false]) &&
      JSON.stringify(expandedDemo.subLabels) === JSON.stringify(['表单', '表格']) &&
      JSON.stringify(expandedDemo.subExpanded) === JSON.stringify([true, false]) &&
      JSON.stringify(expandedDemo.nestedLabels) === JSON.stringify(['输入框', '下拉选择']) &&
      JSON.stringify(expandedDemo.nestedHidden) === JSON.stringify([false]),
    JSON.stringify(expandedDemo),
  );

  check(
    'mc-menu / mc-menu-item 注册并渲染出实例，容器开 part="list"',
    menu.basic.upgraded && menu.basic.items >= 40 && menu.basic.menus >= 8 && menu.basic.listPart === 'list',
    JSON.stringify(menu.basic),
  );

  /** 分组标题：模板渲染后文字被包在 o-if 里，不能被 o-if 自带的 16px / 深色掰走 */
  const groupLabel = await page.evaluate(() => {
    const box = window.__deepAll('demo-menu-basic')[0].shadowRoot;
    const row = window.__deepAll('mc-menu-item[group]', box)[0];
    const label = row?.shadowRoot?.querySelector('.mc-group-label');
    if (!row || !label) return null;
    const host = getComputedStyle(row);
    const text = getComputedStyle(label);
    return { hostFontSize: host.fontSize, fontSize: text.fontSize, hostColor: host.color, color: text.color };
  });

  check(
    '分组标题：o-if 不吞字号与颜色（文字与宿主一致，不是 16px 深色）',
    !!groupLabel &&
      groupLabel.fontSize === groupLabel.hostFontSize &&
      groupLabel.color === groupLabel.hostColor &&
      groupLabel.fontSize !== '16px',
    JSON.stringify(groupLabel),
  );

  check(
    '数据驱动：分组 / 图标 / 当前 / 禁用 / href / attrs（外链）/ 父子行各就各位，current 命中子项、所在分支自动展开',
    JSON.stringify(menu.options.before.map((o) => [o.group, o.label])) ===
      JSON.stringify([
        [true, '导航'],
        [false, '组件'],
        [false, '设置'],
        [false, '禁用项'],
        [false, '动作项'],
        [false, 'ofa.js'],
      ]) &&
      /* current="components/action"：顶层没有行命中，命中落在子菜单的动作项上，分支开场就是展开的 */
      menu.options.before.every((o) => !o.current) &&
      menu.options.subCurrentBefore[0] === false &&
      menu.options.subCurrentBefore[3] === true &&
      menu.options.subHiddenBefore === false &&
      menu.options.before[2].icon === 'settings' &&
      menu.options.before[2].href.endsWith('/packages/color/page.html') &&
      menu.options.before[2].level === '0' &&
      menu.options.before[1].href === null &&
      menu.options.before[1].tag === 'BUTTON' &&
      menu.options.before[3].disabled === true &&
      menu.options.before[3].tag === 'BUTTON' &&
      /* 没有 href 的叶子行是真按钮：键盘可达、点击只发 navigate 不跳转 */
      menu.options.before[4].tag === 'BUTTON' &&
      menu.options.before[4].href === null &&
      menu.options.before[4].icon === 'plus' &&
      /* attrs 里的链接属性落到了内置 <a> 上（data-* 留在行上，这里不查） */
      menu.options.before[5].href === 'https://ofajs.com' &&
      menu.options.before[5].target === '_blank' &&
      menu.options.before[5].rel === 'noreferrer' &&
      menu.options.before[5].title === '外链：新窗口打开',
    JSON.stringify(menu.options.before),
  );

  check(
    '动作项：按钮型行点击不跳转，只把 current 指过去（高亮跟着走，可还原）',
    menu.actionRow !== null &&
      menu.actionRow.before.tag === 'BUTTON' &&
      JSON.stringify(menu.actionRow.before.current) === JSON.stringify([]) &&
      JSON.stringify(menu.actionRow.after.current) === JSON.stringify(['动作项']) &&
      menu.actionRow.after.currentAttr === 'action' &&
      menu.actionRow.after.hash === menu.actionRow.hashBefore &&
      menu.actionRow.restored === 'components/action',
    JSON.stringify(menu.actionRow),
  );

  check(
    '内联开合：点父级行展开子菜单（箭头翻向 + data-expanded + 子项缩进一档），再点收起',
    menu.options.opened.hidden === false &&
      JSON.stringify(menu.options.opened.labels) === JSON.stringify(['按钮', '图标', '折叠面板', '动作项']) &&
      menu.options.opened.hrefs.slice(0, 3).every((h) => h && h.includes('/packages/')) &&
      /* 子菜单里的按钮型行（动作项）没有 href */
      menu.options.opened.hrefs[3] === null &&
      menu.options.opened.caret.name === 'chevron-down' &&
      menu.options.opened.caret.expanded === true &&
      menu.options.opened.indent === 58 &&
      menu.options.closed.hidden === true &&
      menu.options.closed.caret.name === 'chevron-right' &&
      menu.options.closed.caret.expanded === false,
    JSON.stringify(menu.options.opened),
  );

  check(
    '缩进：children 逐级 +16px（行都带 icon：42 / 58 / 74），层级是容器算的、进了 --mc-item-level；同层没写 icon 的行留出图标位、与同层文字对齐',
    JSON.stringify(menu.indent.levels) === JSON.stringify(['0', '1', '2']) &&
      JSON.stringify(menu.indent.indents) === JSON.stringify([42, 58, 74]) &&
      JSON.stringify(menu.indent.noIcon) === JSON.stringify([58, 74]),
    JSON.stringify(menu.indent),
  );

  check(
    '长标签不画出栏外：固定宽度的菜单里行宽 = 菜单宽、叶子文字截断成 …，父级行的箭头没被挤出去',
    menu.overflow.menuW === 224 &&
      menu.overflow.parent.rowW === 224 &&
      menu.overflow.parent.ctlW === 224 &&
      menu.overflow.parent.scrollW === 224 &&
      menu.overflow.child.rowW === 224 &&
      menu.overflow.child.ctlW === 224 &&
      menu.overflow.child.scrollW > 224 &&
      menu.overflow.child.ellipsis === 'ellipsis',
    JSON.stringify(menu.overflow),
  );

  check(
    '没写宽度的菜单展开子项不变宽：内联子菜单跟父菜单同宽（层级缩进照旧）',
    menu.stableWidth.start === menu.stableWidth.level1 &&
      menu.stableWidth.level1 === menu.stableWidth.level2 &&
      menu.stableWidth.sub1 === menu.stableWidth.level2 &&
      menu.stableWidth.sub2 === menu.stableWidth.level2 &&
      JSON.stringify(menu.stableWidth.levels) === JSON.stringify(['1', '2']),
    JSON.stringify(menu.stableWidth),
  );

  check(
    '内置行：有 href 造 <a>、禁用 / 没有 href 造 <button>（current / disabled 镜像到宿主、缩进 16）；attrs 的链接属性落到 <a>、data-* 留在行上',
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
      menu.built[2].tag === 'BUTTON' &&
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
    menu.icons.length >= 5 &&
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
      menu.collapsedState.compressed.flyouts === 2 &&
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
      menu.flyoutOpen.labels.join() === '进行中,已归档' &&
      menu.flyoutOpen.labelVisible !== 'rgba(0, 0, 0, 0)' &&
      menu.flyoutOpen.dataOpen === true &&
      menu.flyoutOpen.rowBg !== 'rgba(0, 0, 0, 0)',
    JSON.stringify({ ...menu.flyoutOpen, parent: menu.flyout.parentLabel }),
  );

  check(
    '第三列浮层：同一套面板外观、行不再叠层级缩进（带 icon 也是 42px），两层一起收起',
    menu.flyoutDeep &&
      menu.flyoutDeep.open === true &&
      menu.flyoutDeep.dataOpen === true &&
      menu.flyoutDeep.sameChrome === true &&
      menu.flyoutDeep.position === 'fixed' &&
      parseFloat(menu.flyoutDeep.border) === 1 &&
      parseFloat(menu.flyoutDeep.radius) >= 4 &&
      menu.flyoutDeep.labels.join() === '2025,2024' &&
      /* 浮层每一列都是 level 0：缩进只剩基础内边距 + 图标让位（42px），不能再叠 58/74 */
      menu.flyoutDeep.rows.length === 2 &&
      menu.flyoutDeep.rows.every((r) => r.level === '0' && r.indent === 42) &&
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
    '当前项 / 禁用镜像到宿主：命中的那一行 data-current、路径上的父级 data-current-branch（强调色、不铺底色）、禁用的行 data-disabled / 压暗 / 不给 href，父级行是按钮',
    menu.states.currentFlag === true &&
      menu.states.currentCount === 1 &&
      menu.states.currentBranchCount === 2 &&
      menu.states.leafBranch === false &&
      menu.states.parentBranch === true &&
      menu.states.nestedParentBranch === true &&
      menu.states.currentColor === menu.states.parentColor &&
      menu.states.parentColor !== menu.states.neutralColor &&
      menu.states.parentBg === 'rgba(0, 0, 0, 0)' &&
      menu.states.currentBg !== 'rgba(0, 0, 0, 0)' &&
      Number(menu.states.currentLabelWeight) >= 500 &&
      Number(menu.states.parentLabelWeight) >= 500 &&
      menu.states.disabledFlag === true &&
      menu.states.disabledHref === null &&
      Number(menu.states.opacity) < 1 &&
      menu.states.cursor === 'not-allowed' &&
      menu.states.parentTag === 'BUTTON',
    JSON.stringify(menu.states),
  );


  check(
    '禁用项不响应悬停；分组标题鼠标穿透；分组子项常显、缩进走自己那档 54px（改 collapsible 步长不影响它）',
    menu.hoverDisabled.bg === 'rgba(0, 0, 0, 0)' &&
      menu.groups.pointer === 'none' &&
      menu.groups.groupTag === null &&
      menu.groups.childLevel === '1' &&
      menu.groups.childStep.includes('--mc-menu-group-indent') &&
      menu.groups.childIndent === 54 &&
      menu.groups.afterStepOverride === 54 &&
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

  /* 跳转：菜单在 o-app 子树里时，站内链接自动渲染成 olink 形态（hash 地址 + origin-href + olink），
     点击走 ofa 的 SPA 导航（地址栏换 hash、不整刷）；navigate 事件可取消 —— 取消就不跳。
     外链与 # 锚点恒原样输出。组件探测环境，使用者不写任何属性。
     ⚠️ 菜单要挂进文档页里（o-app 的子树）：ofa 的 olink 代理处理器挂在组件 shadow root 上 */
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

    /* o-app 外（直接挂在 body 上）：站内链接原样输出、不补 olink —— 同一行数据两种环境两种形态 */
    const nativeMenu = document.createElement('mc-menu');
    nativeMenu.options = [{ key: 'raw', label: '原生', href: 'packages/button/page.html' }];
    document.body.append(nativeMenu);
    await wait(300);
    const nativeA = window.__menuControl(window.__menuRows(nativeMenu)[0]);
    const nativeShape = {
      href: nativeA?.getAttribute('href') ?? null,
      olink: nativeA?.hasAttribute('olink') ?? null,
      origin: nativeA?.getAttribute('origin-href') ?? null,
    };
    nativeMenu.remove();

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
    return { rows, nativeShape, events, hashBefore, hashAfterCancel, hashAfterAllow, hashRestored };
  });

  check(
    '跳转：o-app 内站内链接渲染成 olink 形态（hash 地址 + origin-href）；外链 / 锚点原样输出',
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
    '跳转：o-app 外（挂在 body 上）站内链接原样输出、不补 olink / origin-href',
    navigation.nativeShape.href === 'packages/button/page.html' &&
      navigation.nativeShape.olink === false &&
      navigation.nativeShape.origin === null,
    JSON.stringify(navigation.nativeShape),
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

  check(
    '除「跳转链接」外，所有演示都拦截 navigate：点真实 href 行（含子菜单）不换 hash、只换 current（size 三个菜单逐个点）',
    menu.demoLinks.length === 11 &&
      menu.demoLinks.every(
        (item) =>
          item.roots > 0 &&
          item.found === item.roots &&
          item.checked === item.roots &&
          item.hashStable === true &&
          item.currentOk === true,
      ),
    JSON.stringify(menu.demoLinks),
  );

  /* 「跳转链接」演示：当前页那一项由 mc-route-guard 拦下；其他站内链接放行，点完能后退回来 */
  const navigateDemo = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const box = window.__deepAll('demo-menu-navigate')[0]?.shadowRoot;
    const menu = box?.querySelector('mc-menu') ?? null;
    if (!menu) return null;
    for (let i = 0; i < 40 && !window.__menuRows(menu).length; i += 1) await wait(100);
    /* 守卫是演示自己带的：等它挂上，当前路由点击才会被拦 */
    for (let i = 0; i < 40 && !window.__deepAll('mc-route-guard')[0]?.shadowRoot; i += 1)
      await wait(100);
    const rows = [...window.__menuRows(menu)];
    const currentRow = rows.find((item) => window.__menuText(item) === '当前页（不重进）');
    if (!currentRow) return null;
    const currentControl = window.__menuControl(currentRow);
    const currentHref = currentControl.getAttribute('href');
    const hashBeforeCurrent = location.hash;
    currentControl.click();
    await wait(250);
    const hashAfterCurrent = location.hash;

    const row = rows.find((item) => window.__menuText(item) === '按钮文档');
    if (!row) return null;
    const control = window.__menuControl(row);
    const hashBefore = location.hash;
    const href = control.getAttribute('href');
    control.click();
    await wait(800);
    const hashAfter = location.hash;
    history.back();
    await wait(800);
    return {
      currentHref,
      hashBeforeCurrent,
      hashAfterCurrent,
      href,
      hashBefore,
      hashAfter,
      restored: location.hash,
    };
  });

  check(
    '「跳转链接」演示：当前页链接被守卫拦下（hash 不变），其他站内链接真的换 hash（后退回得来）',
    navigateDemo !== null &&
      navigateDemo.currentHref.endsWith('#/packages/menu/page.html') &&
      navigateDemo.hashAfterCurrent === navigateDemo.hashBeforeCurrent &&
      navigateDemo.href.endsWith('#/packages/button/page.html') &&
      navigateDemo.hashAfter !== navigateDemo.hashBefore &&
      navigateDemo.hashAfter.endsWith('#/packages/button/page.html') &&
      navigateDemo.restored === navigateDemo.hashBefore,
    JSON.stringify(navigateDemo),
  );

  check('页面无 404 / 报错', menu.failed.length === 0, menu.failed.join('\n'));
}