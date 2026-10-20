/**
 * mc-tree-select · 树型选择：数据渲染（options property）、默认展开、触发框 / 面板 / 行与
 * part、打开与关闭（点击 / Enter / Space / ArrowDown / Esc / 点外部）、键盘导航与展开收起、
 * 选中与事件（change 先于 close、clear 先于 change）、禁用的父级可展开但整支不可选、
 * clearable、空数据、size 三档 + 数字、options 属性通道、mc-form 取值；
 * 懒加载（组件级 property el.load + 节点 lazy:true：data-loading / spinner / 失败重试 /
 * load 只调一次 / 只认箭头 / 非 lazy 叶子不加载 / load 返回节点默认是叶子）、
 * 具名插槽（prefix / chevron / empty）与行模板插槽（option / icon，data-field 填充）。
 *
 * 跑法：node tests/smoke.mjs tree-select（需先 pnpm dev）
 *
 * ⚠️ 探针现搭现拆，不依赖文档页演示区（page.html 由文档单元并行维护）：
 *   组件本体用 <l-m src="/packages/tree-select/tree-select.html"> 现引；
 *   options 一律走 property（挂载后赋值），等 shadow 里渲染出预期行数再断言。
 */

const TREE = [
  {
    value: 'zj',
    label: '浙江',
    expanded: true,
    children: [
      {
        value: 'hz',
        label: '杭州',
        children: [
          { value: 'xh', label: '西湖' },
          { value: 'yh', label: '余杭', disabled: true },
        ],
      },
      {
        value: 'nb',
        label: '宁波',
        disabled: true,
        children: [{ value: 'hs', label: '海曙' }],
      },
    ],
  },
  { value: 'js', label: '江苏', children: [{ value: 'nj', label: '南京' }] },
  { value: 'sh', label: '上海' },
];

/* 行模板用例的数据：自定义字段（icon / desc）也放在原始数据里给 data-field / data-field-attr 取 */
const TEMPLATE_TREE = [
  {
    value: 'a',
    label: '甲',
    desc: '甲说明',
    icon: '★',
    children: [{ value: 'a1', label: '甲一' }],
  },
  {
    value: 'b',
    label: '乙',
    desc: '乙说明',
    icon: '☆',
    children: [{ value: 'b1', label: '乙一' }],
  },
];

const TEMPLATE_HTML =
  '<template slot="option"><span data-field="label"></span><em data-field-attr="title:desc"></em></template>' +
  '<template slot="icon"><i data-field="icon"></i></template>';

const countNodes = (list) => list.reduce((sum, node) => sum + 1 + countNodes(node.children ?? []), 0);

export default async function run({ page, visit, check }) {
  /* ------------------------------------------------------------------ *
   * 0. 组件本体用 <l-m> 现引（页面加载后才注册，等它升级完）
   * ------------------------------------------------------------------ */
  await visit(page, '/index.html?tree-select=1');
  await page.evaluate(() => {
    const loader = document.createElement('l-m');
    loader.setAttribute('src', '/packages/tree-select/tree-select.html');
    document.body.append(loader);
  });
  const registered = await page
    .waitForFunction(() => !!customElements.get('mc-tree-select'), { timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  /* ------------------------------------------------------------------ *
   * 探针：固定在视口左上，避开站点外壳；一个时刻只挂一个实例，坐标不打架
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    document.getElementById('tree-probe')?.remove();
    document.getElementById('tree-outside')?.remove();
    const probe = document.createElement('div');
    probe.id = 'tree-probe';
    probe.style.cssText =
      'position:fixed;left:16px;top:72px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    const outside = document.createElement('div');
    outside.id = 'tree-outside';
    outside.style.cssText =
      'position:fixed;left:16px;top:560px;width:90px;height:40px;z-index:9999;' +
      'background-color:rgb(0 0 0 / 0.04);';
    document.body.append(probe, outside);
    window.__treeProbe = probe;

    /** 建一个探针实例：先删旧的；options 走 property（挂载前赋值，构造期会收下） */
    window.__make = (attrs = {}, data = []) => {
      document.querySelector('#tree-probe mc-tree-select')?.remove();
      const host = document.createElement('mc-tree-select');
      host.id = 'probe-tree';
      for (const [key, value] of Object.entries(attrs)) host.setAttribute(key, value);
      host.options = data;
      window.__treeProbe.append(host);
      return host.id;
    };

    /** 当前探针的完整快照：宿主状态 + 每个数据行（含隐藏行） */
    window.__state = () => {
      const host = document.getElementById('probe-tree');
      const root = host?.shadowRoot;
      if (!root) return null;
      const control = root.querySelector('.mc-control');
      const panel = root.querySelector('.mc-panel');
      const clear = root.querySelector('.mc-clear');
      const empty = root.querySelector('.mc-empty');
      const controlBox = control.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      const rows = [...root.querySelectorAll('.mc-row')].map((row) => ({
        label: row.querySelector('.mc-label')?.textContent ?? '',
        level: Number(row.dataset.level),
        visible: !row.hidden,
        selected: row.getAttribute('data-selected') === 'true',
        disabled: row.getAttribute('data-disabled') === 'true',
        expanded: row.hasAttribute('data-expanded'),
        active: row.hasAttribute('data-active'),
        expandable: row.hasAttribute('data-expandable'),
        loading: row.hasAttribute('data-loading'),
        loadError: row.hasAttribute('data-load-error'),
        expandClass: row.querySelector('.mc-expand')?.className ?? '',
        part: row.getAttribute('part'),
        expandPart: row.querySelector('.mc-expand')?.getAttribute('part') ?? null,
      }));
      return {
        tag: control.tagName,
        type: control.type,
        controlPart: control.getAttribute('part'),
        controlDisabled: control.disabled,
        panelPart: panel.getAttribute('part'),
        controlWidth: Math.round(controlBox.width),
        popover: panel.getAttribute('popover'),
        open: panel.matches(':popover-open'),
        display: getComputedStyle(panel).display,
        panelOverflow: getComputedStyle(panel).overflow,
        hasScroller: !!root.querySelector('mc-scroll-bar'),
        viewportMaxH:
          getComputedStyle(root.querySelector('mc-scroll-bar')?.shadowRoot?.querySelector('.mc-viewport') ?? panel).maxHeight,
        below: panelBox.top >= controlBox.bottom - 1,
        wideEnough: panelBox.width >= controlBox.width - 1,
        dataOpen: host.hasAttribute('data-open'),
        dataEmpty: host.hasAttribute('data-empty'),
        dataFilled: host.hasAttribute('data-filled'),
        dataHasPrefix: host.hasAttribute('data-has-prefix'),
        clearDisplay: getComputedStyle(clear).display,
        text: root.querySelector('.mc-value')?.textContent ?? '',
        emptyText: empty?.textContent ?? '',
        emptyHidden: empty?.hidden ?? null,
        value: host.value,
        valueAttr: host.getAttribute('value'),
        focused: root.activeElement?.className ?? null,
        rows,
      };
    };

    /** 探针里某个可点元素的视口坐标 */
    window.__point = (kind, label) => {
      const root = document.querySelector('#tree-probe mc-tree-select')?.shadowRoot;
      if (!root) return null;
      const rowList = [...root.querySelectorAll('.mc-row')];
      /* 行模板下 .mc-label 的文本不再等于节点 label，按序号点（row-index / expand-index）更稳 */
      const row =
        typeof label === 'number'
          ? rowList[label]
          : label === null
            ? null
            : rowList.find((item) => item.querySelector('.mc-label')?.textContent === label);
      const target =
        kind === 'control'
          ? root.querySelector('.mc-control')
          : kind === 'clear'
            ? root.querySelector('.mc-clear')
            : kind === 'row' || kind === 'row-index'
              ? row?.querySelector('.mc-label')
              : kind === 'expand' || kind === 'expand-index'
                ? row?.querySelector('.mc-expand')
                : null;
      if (!target) return null;
      const box = target.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    window.__outsidePoint = () => {
      const box = document.getElementById('tree-outside').getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    /**
     * 懒加载探针：节点只写 lazy: true，加载器挂在组件级 property el.load 上；
     * 另有一个普通叶子（没有 lazy），用来验「组件给了 load 也不会变懒」。
     * load 挂起，由用例决定何时 resolve / reject。
     */
    window.__makeLazy = (attrs = {}) => {
      window.__loads = { calls: [], pending: [] };
      window.__make(attrs, [
        { value: 'lz', label: '懒加载', lazy: true, icon: '★' },
        { value: 'plain', label: '普通叶子' },
      ]);
      const host = document.getElementById('probe-tree');
      host.load = (node) => {
        window.__loads.calls.push({
          value: node.value,
          label: node.label,
          lazy: node.lazy === true,
          nodeLoad: typeof node.load,
        });
        return new Promise((resolve, reject) => {
          window.__loads.pending.push({ resolve, reject });
        });
      };
    };

    window.__loadState = () => ({
      calls: window.__loads?.calls.slice() ?? [],
      pending: window.__loads?.pending.length ?? 0,
    });

    window.__loadResolve = (children) => {
      const pending = window.__loads?.pending.shift();
      if (!pending) return false;
      pending.resolve(children);
      return true;
    };

    window.__loadReject = (message) => {
      const pending = window.__loads?.pending.shift();
      if (!pending) return false;
      pending.reject(new Error(message));
      return true;
    };

    /** 带具名插槽内容的探针 */
    window.__makeSlotted = (attrs = {}, data = [], html = '') => {
      window.__make(attrs, data);
      const host = document.getElementById('probe-tree');
      host.innerHTML = html;
      return host.id;
    };

    /** 插槽 / 空态快照：assigned 内容、fallback 是否真的进了布局 */
    window.__slots = () => {
      const host = document.getElementById('probe-tree');
      const root = host?.shadowRoot;
      if (!root) return null;
      const rect = (el) => {
        if (!el) return { w: 0, h: 0 };
        const box = el.getBoundingClientRect();
        return { w: Math.round(box.width), h: Math.round(box.height) };
      };
      const prefix = root.querySelector('.mc-prefix');
      const chevron = root.querySelector('.mc-chevron');
      const prefixSlot = root.querySelector('slot[name="prefix"]');
      const chevronSlot = root.querySelector('slot[name="chevron"]');
      const emptySlot = root.querySelector('slot[name="empty"]');
      const assigned = (slot) => slot?.assignedElements() ?? [];
      return {
        hasPrefix: host.hasAttribute('data-has-prefix'),
        prefixPart: prefix?.getAttribute('part') ?? null,
        prefixDisplay: prefix ? getComputedStyle(prefix).display : null,
        prefixRect: rect(prefix),
        prefixAssigned: assigned(prefixSlot).length,
        prefixText: assigned(prefixSlot)
          .map((el) => el.textContent)
          .join(''),
        prefixContentRect: rect(host.querySelector('[slot="prefix"]')),
        chevronPart: chevron?.getAttribute('part') ?? null,
        chevronDisplay: chevron ? getComputedStyle(chevron).display : null,
        chevronAssigned: assigned(chevronSlot).length,
        chevronText: assigned(chevronSlot)
          .map((el) => el.textContent)
          .join(''),
        chevronContentRect: rect(host.querySelector('[slot="chevron"]')),
        defaultChevronRect: rect(root.querySelector('.mc-default-chevron')),
        emptyAssigned: assigned(emptySlot).length,
        emptyContentRect: rect(assigned(emptySlot)[0]),
        emptyFallbackRect: rect(root.querySelector('.mc-empty')),
        emptyFallbackText: root.querySelector('.mc-empty')?.textContent ?? '',
        emptyWrapHidden: root.querySelector('.mc-empty-wrap')?.hidden ?? null,
      };
    };

    /** 行模板快照：正文（option 模板）与行首展开图标（icon 模板）的克隆填充结果 */
    window.__rowContent = () => {
      const root = document.querySelector('#tree-probe mc-tree-select')?.shadowRoot;
      if (!root) return null;
      const segOf = (el) => ({
        field: el.getAttribute('data-field'),
        fieldAttr: el.getAttribute('data-field-attr'),
        text: el.textContent,
        attrs: Object.fromEntries([...el.attributes].map((attr) => [attr.name, attr.value])),
      });
      return [...root.querySelectorAll('.mc-row')].map((row) => {
        const expand = row.querySelector('[part="expand"]');
        const label = row.querySelector('.mc-label');
        return {
          label: label?.textContent ?? '',
          expandClass: expand?.className ?? '',
          expandText: expand?.textContent ?? '',
          hasSpinner: !!expand?.querySelector('.mc-tree-spinner'),
          expandSegments: [...(expand?.querySelectorAll('[data-field], [data-field-attr]') ?? [])].map(
            segOf,
          ),
          labelSegments: [...(label?.querySelectorAll('[data-field], [data-field-attr]') ?? [])].map(
            segOf,
          ),
          partIcon: !!row.querySelector('[part="icon"], .mc-node-icon'),
          visible: !row.hidden,
          expanded: row.hasAttribute('data-expanded'),
          selected: row.getAttribute('data-selected') === 'true',
        };
      });
    };

    /* 事件采集：document 级（既查 payload，也查 bubbles / composed 真的穿透了 shadow） */
    window.__events = [];
    if (!window.__treeEventsWired) {
      window.__treeEventsWired = true;
      for (const type of ['change', 'clear', 'open', 'close']) {
        document.addEventListener(type, (event) => {
          if (event.target?.id !== 'probe-tree') return;
          window.__events.push({
            type,
            data: event.data ? JSON.parse(JSON.stringify(event.data)) : null,
            composed: event.composed,
            bubbles: event.bubbles,
          });
        });
      }
    }

    /* 懒加载失败事件单独收集：payload 里的 error 是 Error，JSON 克隆只剩 {}，这里取 message */
    window.__loadErrors = [];
    if (!window.__treeLoadErrorWired) {
      window.__treeLoadErrorWired = true;
      document.addEventListener('load-error', (event) => {
        if (event.target?.id !== 'probe-tree') return;
        window.__loadErrors.push({
          value: event.data?.value ?? null,
          message: String(event.data?.error?.message ?? ''),
          composed: event.composed,
          bubbles: event.bubbles,
        });
      });
    }
    window.__resetLoadErrors = () => {
      window.__loadErrors = [];
    };
  });

  /* ------------------------------------------------------------------ *
   * Node 侧小工具
   * ------------------------------------------------------------------ */
  const waitRows = (rows) =>
    page
      .waitForFunction(
        (want) => {
          const root = document.getElementById('probe-tree')?.shadowRoot;
          if (!root?.querySelector('.mc-control')) return false;
          return root.querySelectorAll('.mc-row').length === want;
        },
        rows,
        { timeout: 5000 },
      )
      .catch(() => {});

  const make = async (attrs = {}, data = TREE) => {
    await page.evaluate((payload) => window.__make(payload.attrs, payload.data), { attrs, data });
    await waitRows(countNodes(data));
  };

  const state = () => page.evaluate(() => window.__state());
  const events = () => page.evaluate(() => window.__events.slice());
  const resetEvents = () =>
    page.evaluate(() => {
      window.__events = [];
    });

  const click = async (kind, label = null) => {
    const at = await page.evaluate((args) => window.__point(args.kind, args.label), { kind, label });
    await page.mouse.click(at.x, at.y);
  };

  const waitOpen = (want) =>
    page
      .waitForFunction(
        (open) =>
          document.getElementById('probe-tree')?.shadowRoot?.querySelector('.mc-panel')?.matches(
            ':popover-open',
          ) === open,
        want,
        { timeout: 3000 },
      )
      .catch(() => {});

  const waitValue = (value) =>
    page
      .waitForFunction((want) => document.getElementById('probe-tree')?.value === want, value, {
        timeout: 3000,
      })
      .catch(() => {});

  /** 等某行的加载 / 错误态落到期望值（懒加载的异步动作） */
  const waitRowState = (label, want) =>
    page
      .waitForFunction(
        ({ label: text, want: flags }) => {
          const root = document.getElementById('probe-tree')?.shadowRoot;
          const row = [...(root?.querySelectorAll('.mc-row') ?? [])].find(
            (item) => item.querySelector('.mc-label')?.textContent === text,
          );
          if (!row) return false;
          if (flags.loading !== undefined && row.hasAttribute('data-loading') !== flags.loading)
            return false;
          if (
            flags.loadError !== undefined &&
            row.hasAttribute('data-load-error') !== flags.loadError
          )
            return false;
          return true;
        },
        { label, want },
        { timeout: 3000 },
      )
      .catch(() => {});

  const focusControl = () =>
    page.evaluate(() => {
      const root = document.querySelector('#tree-probe mc-tree-select')?.shadowRoot;
      root?.querySelector('.mc-control')?.focus();
      return root?.activeElement?.className ?? null;
    });

  const rowsWhere = (snap, predicate) => snap.rows.filter(predicate).map((row) => row.label);
  const visibleLabels = (snap) => rowsWhere(snap, (row) => row.visible);
  const expandedLabels = (snap) => rowsWhere(snap, (row) => row.expanded);
  const activeLabels = (snap) => rowsWhere(snap, (row) => row.active);
  const selectedLabels = (snap) => rowsWhere(snap, (row) => row.selected);

  /* ------------------------------------------------------------------ *
   * 1. 数据渲染：递归成行、层级、part；初始空值态
   * ------------------------------------------------------------------ */
  await make();
  const render = await state();
  check(
    '数据渲染：options property 驱动出 9 行（递归、按层级缩进），行都是 part="option"、箭头都是 part="expand"，触发框是原生 button（part="base"）、面板是 popover="manual"（part="panel"）；初始 data-empty + placeholder',
    registered === true &&
      render?.tag === 'BUTTON' &&
      render?.type === 'button' &&
      render?.controlPart === 'base' &&
      render?.panelPart === 'panel' &&
      render?.popover === 'manual' &&
      render?.rows.length === 9 &&
      JSON.stringify(render.rows.map((row) => row.label)) ===
        JSON.stringify(['浙江', '杭州', '西湖', '余杭', '宁波', '海曙', '江苏', '南京', '上海']) &&
      JSON.stringify(render.rows.map((row) => row.level)) ===
        JSON.stringify([0, 1, 2, 2, 1, 2, 0, 1, 0]) &&
      render.rows.every((row) => row.part === 'option' && row.expandPart === 'expand') &&
      JSON.stringify(render.rows.map((row) => row.expandable)) ===
        JSON.stringify([true, true, false, false, true, false, true, false, false]) &&
      render.value === '' &&
      render.dataEmpty === true &&
      render.dataFilled === false &&
      render.text === '请选择',
    JSON.stringify(render),
  );
  /* 宽度不跟选中项走：空值 vs 短标签（上海）触发框同宽，且不窄于 --mc-tree-select-min-w = 10rem */
  await make();
  const emptyWidth = (await state()).controlWidth;
  await page.evaluate(() => {
    document.getElementById('probe-tree').value = 'sh';
  });
  await page.waitForTimeout(120);
  const shortWidth = (await state()).controlWidth;
  check(
    '触发框宽度不跟选中项的文字变：空值与短标签（上海）同宽，且不窄于 --mc-tree-select-min-w = 10rem（160px）',
    emptyWidth >= 160 && shortWidth >= 160 && Math.abs(emptyWidth - shortWidth) <= 1,
    JSON.stringify({ emptyWidth, shortWidth }),
  );

  check(
    '面板滚动条复用 mc-scroll-bar（覆盖式、不占内容宽）：面板自身 overflow 是 visible、里面是 mc-scroll-bar、viewer 有 max-height —— 原生滚动条不会把面板右侧圆角切方',
    render?.panelOverflow === 'visible' &&
      render?.hasScroller === true &&
      render?.viewportMaxH !== 'none' &&
      render?.viewportMaxH !== '',
    JSON.stringify({
      panelOverflow: render?.panelOverflow,
      hasScroller: render?.hasScroller,
      viewportMaxH: render?.viewportMaxH,
    }),
  );

  /* ------------------------------------------------------------------ *
   * 2. 默认展开：数据 expanded:true + 选中节点的祖先自动展开
   * ------------------------------------------------------------------ */
  await make({ 'default-value': 'xh' });
  const selectedInit = await state();
  check(
    '默认展开：expanded:true 的父级初始展开、其余根收起；default-value 选中 xh 时祖先自动展开（杭州可见）、data-filled 与选中行一起亮',
    JSON.stringify(expandedLabels(render)) === JSON.stringify(['浙江']) &&
      JSON.stringify(visibleLabels(render)) ===
        JSON.stringify(['浙江', '杭州', '宁波', '江苏', '上海']) &&
      JSON.stringify(expandedLabels(selectedInit)) === JSON.stringify(['浙江', '杭州']) &&
      JSON.stringify(visibleLabels(selectedInit)) ===
        JSON.stringify(['浙江', '杭州', '西湖', '余杭', '宁波', '江苏', '上海']) &&
      JSON.stringify(selectedLabels(selectedInit)) === JSON.stringify(['西湖']) &&
      selectedInit.value === 'xh' &&
      selectedInit.text === '西湖' &&
      selectedInit.dataFilled === true &&
      selectedInit.dataEmpty === false,
    JSON.stringify({ initial: render, selected: selectedInit }),
  );

  /* ------------------------------------------------------------------ *
   * 3. value property：写完当次生效、同步 value 属性；未知值按未选显示但 property 保留
   * ------------------------------------------------------------------ */
  await make();
  const valueWrite = await page.evaluate(() => {
    const host = document.getElementById('probe-tree');
    host.value = 'nj';
    const child = window.__state();
    host.value = 'nope';
    const unknown = window.__state();
    host.value = 'sh';
    const root = window.__state();
    return { child, unknown, root };
  });
  check(
    'value property：写 "nj" 当次读得到（显示南京、选中行亮、祖先江苏展开、value 属性同步）；写未知值按未选显示（placeholder / data-empty）但 property 保留原值',
    valueWrite.child.value === 'nj' &&
      valueWrite.child.text === '南京' &&
      valueWrite.child.valueAttr === 'nj' &&
      JSON.stringify(selectedLabels(valueWrite.child)) === JSON.stringify(['南京']) &&
      expandedLabels(valueWrite.child).includes('江苏') &&
      valueWrite.unknown.value === 'nope' &&
      valueWrite.unknown.text === '请选择' &&
      valueWrite.unknown.dataEmpty === true &&
      valueWrite.unknown.dataFilled === false &&
      selectedLabels(valueWrite.unknown).length === 0 &&
      valueWrite.root.value === 'sh' &&
      valueWrite.root.text === '上海' &&
      valueWrite.root.dataFilled === true,
    JSON.stringify(valueWrite),
  );

  /* ------------------------------------------------------------------ *
   * 4. 点触发框打开：原生 popover 进 top layer、锚点定位；Esc 关闭并还焦点
   * ------------------------------------------------------------------ */
  await make();
  await click('control');
  await waitOpen(true);
  const opened = await state();
  const openEvents = await events();
  await page.keyboard.press('Escape');
  await waitOpen(false);
  const escaped = await state();
  const escEvents = await events();
  check(
    '点触发框打开面板（原生 popover 进 top layer、data-open 亮起、面板贴在触发框下方且不窄于它，发 open）；Esc 收起并把焦点还给触发框（close 在 open 之后）',
    opened.open === true &&
      opened.popover === 'manual' &&
      opened.display !== 'none' &&
      opened.dataOpen === true &&
      opened.below === true &&
      opened.wideEnough === true &&
      JSON.stringify(openEvents.map((event) => event.type)) === JSON.stringify(['open']) &&
      escaped.open === false &&
      escaped.dataOpen === false &&
      escaped.focused === 'mc-control' &&
      JSON.stringify(escEvents.map((event) => event.type)) === JSON.stringify(['open', 'close']),
    JSON.stringify({ opened, escaped, openEvents, escEvents }),
  );

  /* ------------------------------------------------------------------ *
   * 5. Enter / Space / ArrowDown 打开；ArrowDown 激活第一个启用根节点
   * ------------------------------------------------------------------ */
  await make();
  await focusControl();
  await page.keyboard.press('Enter');
  await waitOpen(true);
  const enterOpen = await state();
  await page.keyboard.press('Escape');
  await waitOpen(false);
  await page.keyboard.press('Space');
  await waitOpen(true);
  const spaceOpen = await state();
  await page.keyboard.press('Escape');
  await waitOpen(false);
  await page.keyboard.press('ArrowDown');
  await waitOpen(true);
  const arrowOpen = await state();
  check(
    'Enter / Space / ArrowDown 都能打开面板；ArrowDown 打开时把高亮放在第一个可用的根节点（浙江）',
    enterOpen.open === true &&
      spaceOpen.open === true &&
      arrowOpen.open === true &&
      JSON.stringify(activeLabels(arrowOpen)) === JSON.stringify(['浙江']),
    JSON.stringify({ enter: enterOpen.open, space: spaceOpen.open, arrow: activeLabels(arrowOpen) }),
  );

  /* ------------------------------------------------------------------ *
   * 6. 点外部关闭：判定走 composedPath（真指针）
   * ------------------------------------------------------------------ */
  await make();
  await click('control');
  await waitOpen(true);
  const outsideHit = await page.evaluate(() => {
    const at = window.__outsidePoint();
    return { ...at, hit: document.elementFromPoint(at.x, at.y)?.id ?? null };
  });
  await resetEvents();
  await page.mouse.click(outsideHit.x, outsideHit.y);
  await waitOpen(false);
  const dismissed = await state();
  const dismissedEvents = await events();
  check(
    '点组件外部（真指针）关掉面板：判定走 composedPath，close 事件到达',
    outsideHit.hit === 'tree-outside' &&
      dismissed.open === false &&
      dismissed.dataOpen === false &&
      JSON.stringify(dismissedEvents.map((event) => event.type)) === JSON.stringify(['close']),
    JSON.stringify({ outsideHit, dismissed: dismissed.open, dismissedEvents }),
  );

  /* ------------------------------------------------------------------ *
   * 7. 键盘导航：只在可见且未禁用的节点间移动（跳过禁用的宁波）、Home / End
   * ------------------------------------------------------------------ */
  await make();
  await focusControl();
  await page.keyboard.press('ArrowDown');
  await waitOpen(true);
  const nav = { start: activeLabels(await state()) };
  const pressNav = async (name, key) => {
    await page.keyboard.press(key);
    nav[name] = activeLabels(await state());
  };
  await pressNav('down1', 'ArrowDown');
  await pressNav('down2', 'ArrowDown');
  await pressNav('down3', 'ArrowDown');
  await pressNav('up', 'ArrowUp');
  await pressNav('home', 'Home');
  await pressNav('end', 'End');
  check(
    '键盘：ArrowDown / ArrowUp 只在可见且未禁用的节点间移动（可见顺序 浙江 → 杭州 → 江苏，跳过禁用的宁波）、Home / End 到首尾、循环',
    JSON.stringify(nav.start) === JSON.stringify(['浙江']) &&
      JSON.stringify(nav.down1) === JSON.stringify(['杭州']) &&
      JSON.stringify(nav.down2) === JSON.stringify(['江苏']) &&
      JSON.stringify(nav.down3) === JSON.stringify(['上海']) &&
      JSON.stringify(nav.up) === JSON.stringify(['江苏']) &&
      JSON.stringify(nav.home) === JSON.stringify(['浙江']) &&
      JSON.stringify(nav.end) === JSON.stringify(['上海']),
    JSON.stringify(nav),
  );

  /* ------------------------------------------------------------------ *
   * 8. ArrowRight / ArrowLeft：展开 → 进子节点 → 回父级 → 收起；叶子不响应
   * ------------------------------------------------------------------ */
  const step = async () => {
    const snap = await state();
    return {
      active: activeLabels(snap).join(','),
      expanded: expandedLabels(snap).join(','),
      visible: visibleLabels(snap).join(','),
      value: snap.value,
    };
  };
  await make();
  await focusControl();
  await page.keyboard.press('ArrowDown');
  await waitOpen(true);
  await page.keyboard.press('Home');
  const steps = [await step()]; /* 0: 浙江 */
  await page.keyboard.press('ArrowRight');
  steps.push(await step()); /* 1: 进到已展开的浙江的第一个子节点 杭州 */
  await page.keyboard.press('ArrowRight');
  steps.push(await step()); /* 2: 杭州收起 → 展开 */
  await page.keyboard.press('ArrowRight');
  steps.push(await step()); /* 3: 进到 西湖 */
  await page.keyboard.press('ArrowLeft');
  steps.push(await step()); /* 4: 回父级 杭州 */
  await page.keyboard.press('ArrowLeft');
  steps.push(await step()); /* 5: 收起 杭州 */
  await page.keyboard.press('ArrowLeft');
  steps.push(await step()); /* 6: 回父级 浙江 */
  await page.keyboard.press('ArrowLeft');
  steps.push(await step()); /* 7: 收起 浙江 */
  await page.keyboard.press('ArrowRight');
  steps.push(await step()); /* 8: 再展开 浙江 */
  await page.keyboard.press('End');
  steps.push(await step()); /* 9: 高亮到最后一个可用节点 上海 */
  await page.keyboard.press('ArrowRight');
  steps.push(await step()); /* 10: 叶子行 Right 不动 */
  check(
    '键盘：ArrowRight 先展开再进入第一个子节点、ArrowLeft 先收起再回父级；叶子行按 ArrowRight 不移动，值始终没被改',
    steps[0].active === '浙江' &&
      steps[1].active === '杭州' &&
      steps[2].expanded.includes('杭州') &&
      steps[2].visible.includes('西湖') &&
      steps[3].active === '西湖' &&
      steps[4].active === '杭州' &&
      !steps[5].expanded.includes('杭州') &&
      !steps[5].visible.includes('西湖') &&
      steps[5].active === '杭州' &&
      steps[6].active === '浙江' &&
      !steps[7].expanded.includes('浙江') &&
      !steps[7].visible.includes('杭州') &&
      steps[7].active === '浙江' &&
      steps[8].expanded.includes('浙江') &&
      steps[8].visible.includes('杭州') &&
      steps[8].active === '浙江' &&
      steps[9].active === '上海' &&
      steps[10].active === '上海' &&
      steps.every((item) => item.value === ''),
    JSON.stringify(steps),
  );

  /* ------------------------------------------------------------------ *
   * 9. Enter / Space 选中：change { value } 先于 close、composed 冒泡、选中后面板收起
   * ------------------------------------------------------------------ */
  await make();
  await focusControl();
  await resetEvents();
  await page.keyboard.press('ArrowDown'); /* open + 高亮浙江 */
  await waitOpen(true);
  await page.keyboard.press('ArrowDown'); /* 杭州 */
  await page.keyboard.press('Enter');
  await waitValue('hz');
  await waitOpen(false);
  const entered = await state();
  const enterEvents = await events();
  await resetEvents();
  await page.keyboard.press('ArrowDown'); /* 打开，高亮已选中的杭州 */
  await waitOpen(true);
  await page.keyboard.press('ArrowDown'); /* 江苏 */
  await page.keyboard.press('Space');
  await waitValue('js');
  await waitOpen(false);
  const spaced = await state();
  const spaceEvents = await events();
  const changeOf = (list) => list.find((event) => event.type === 'change') ?? null;
  check(
    'Enter / Space 选中当前高亮：change payload 是 { value } 且 composed 冒泡、紧随其后 close；选中后收起并把焦点还给触发框',
    entered.value === 'hz' &&
      entered.text === '杭州' &&
      JSON.stringify(selectedLabels(entered)) === JSON.stringify(['杭州']) &&
      entered.open === false &&
      entered.focused === 'mc-control' &&
      JSON.stringify(enterEvents.map((event) => event.type)) ===
        JSON.stringify(['open', 'change', 'close']) &&
      JSON.stringify(changeOf(enterEvents)?.data) === JSON.stringify({ value: 'hz' }) &&
      changeOf(enterEvents)?.composed === true &&
      changeOf(enterEvents)?.bubbles === true &&
      spaced.value === 'js' &&
      JSON.stringify(selectedLabels(spaced)) === JSON.stringify(['江苏']) &&
      spaced.open === false &&
      JSON.stringify(spaceEvents.map((event) => event.type)) ===
        JSON.stringify(['open', 'change', 'close']) &&
      JSON.stringify(changeOf(spaceEvents)?.data) === JSON.stringify({ value: 'js' }),
    JSON.stringify({ entered, enterEvents, spaced, spaceEvents }),
  );

  /* ------------------------------------------------------------------ *
   * 10. 点展开箭头：只开合，不改值、不关面板、不发 change
   * ------------------------------------------------------------------ */
  await make();
  await resetEvents();
  await click('control');
  await waitOpen(true);
  const beforeToggle = await state();
  await click('expand', '浙江');
  const collapsed = await state();
  await click('expand', '浙江');
  const reexpanded = await state();
  const toggleEvents = await events();
  check(
    '点展开箭头只开合（浙江收起再展开）：value 不变、面板不关、不发 change；对应子孙跟着显隐',
    beforeToggle.open === true &&
      collapsed.open === true &&
      collapsed.value === '' &&
      !expandedLabels(collapsed).includes('浙江') &&
      !visibleLabels(collapsed).includes('杭州') &&
      expandedLabels(reexpanded).includes('浙江') &&
      visibleLabels(reexpanded).includes('杭州') &&
      toggleEvents.every((event) => event.type !== 'change') &&
      JSON.stringify(toggleEvents.map((event) => event.type)) === JSON.stringify(['open']),
    JSON.stringify({ collapsed, toggleEvents }),
  );

  /* ------------------------------------------------------------------ *
   * 11. 点行正文：选中并收起，change → close
   * ------------------------------------------------------------------ */
  await make();
  await resetEvents();
  await click('control');
  await waitOpen(true);
  await click('row', '杭州');
  await waitValue('hz');
  await waitOpen(false);
  const picked = await state();
  const pickEvents = await events();
  check(
    '点行正文：选中该节点（value / 显示文案 / data-selected 一起变）、发 change 后收起；只发一条 change',
    picked.value === 'hz' &&
      picked.text === '杭州' &&
      JSON.stringify(selectedLabels(picked)) === JSON.stringify(['杭州']) &&
      picked.open === false &&
      picked.focused === 'mc-control' &&
      JSON.stringify(pickEvents.map((event) => event.type)) ===
        JSON.stringify(['open', 'change', 'close']) &&
      JSON.stringify(pickEvents.find((event) => event.type === 'change')?.data) ===
        JSON.stringify({ value: 'hz' }),
    JSON.stringify({ picked, pickEvents }),
  );

  /* ------------------------------------------------------------------ *
   * 12. 禁用的父级：箭头仍可展开；整支继承禁用、可见但不可选
   * ------------------------------------------------------------------ */
  await make();
  await resetEvents();
  await click('control');
  await waitOpen(true);
  await click('expand', '宁波');
  const inherited = await state();
  await click('row', '海曙');
  const afterChild = await state();
  await click('row', '宁波');
  const afterParent = await state();
  const disabledEvents = await events();
  const rowOf = (snap, label) => snap.rows.find((row) => row.label === label);
  check(
    '禁用的父级仍可点箭头展开（宁波展开后海曙可见）；子孙继承禁用（data-disabled）、点了不可选、面板不关、不发 change',
    rowOf(inherited, '宁波').expanded === true &&
      rowOf(inherited, '宁波').disabled === true &&
      rowOf(inherited, '海曙').visible === true &&
      rowOf(inherited, '海曙').disabled === true &&
      inherited.value === '' &&
      afterChild.value === '' &&
      afterChild.open === true &&
      selectedLabels(afterChild).length === 0 &&
      afterParent.value === '' &&
      afterParent.open === true &&
      disabledEvents.every((event) => event.type !== 'change') &&
      JSON.stringify(disabledEvents.map((event) => event.type)) === JSON.stringify(['open']),
    JSON.stringify({ inherited, afterChild, afterParent, disabledEvents }),
  );

  /* ------------------------------------------------------------------ *
   * 13. clearable：有值出现 ×；点它先 clear 再 change（{ value: '' }）
   * ------------------------------------------------------------------ */
  await make({ clearable: '', 'default-value': 'hz' });
  await resetEvents();
  const clearBefore = await state();
  await click('clear');
  await waitValue('');
  const clearAfter = await state();
  const clearEvents = await events();
  check(
    'clearable：有值时出现 ×；点 × 清空 value，先发 clear 再发 change（payload { value: "" }），空值回到 placeholder（× 跟着消失）',
    /* 宿主是 inline-flex，子是 flex item：inline-flex 被 blockify 成 flex（Chrome 的 resolved value） */
    clearBefore.clearDisplay !== 'none' &&
      clearBefore.dataFilled === true &&
      clearBefore.text === '杭州' &&
      clearAfter.value === '' &&
      clearAfter.text === '请选择' &&
      clearAfter.dataEmpty === true &&
      clearAfter.dataFilled === false &&
      clearAfter.clearDisplay === 'none' &&
      selectedLabels(clearAfter).length === 0 &&
      clearAfter.focused === 'mc-control' &&
      JSON.stringify(clearEvents.map((event) => event.type)) ===
        JSON.stringify(['clear', 'change']) &&
      JSON.stringify(clearEvents[1]?.data) === JSON.stringify({ value: '' }) &&
      clearEvents[0]?.composed === true &&
      clearEvents[1]?.composed === true,
    JSON.stringify({ clearBefore, clearAfter, clearEvents }),
  );

  /* ------------------------------------------------------------------ *
   * 14. 空数据：面板里显示 empty-text（默认「暂无数据」，可用属性覆盖）
   * ------------------------------------------------------------------ */
  await make({}, []);
  const emptyDefault = await state();
  await click('control');
  await waitOpen(true);
  const emptyOpen = await state();
  await make({ 'empty-text': '没有节点' }, []);
  const emptyCustom = await state();
  check(
    '空数据：options=[] 时行数为 0、触发框 data-empty，面板里显示 empty-text（默认「暂无数据」，empty-text 属性可覆盖），空面板照样能开',
    emptyDefault.rows.length === 0 &&
      emptyDefault.emptyText === '暂无数据' &&
      emptyDefault.emptyHidden === false &&
      emptyDefault.dataEmpty === true &&
      emptyOpen.open === true &&
      emptyOpen.emptyHidden === false &&
      emptyCustom.emptyText === '没有节点',
    JSON.stringify({ emptyDefault, emptyOpen: emptyOpen.open, emptyCustom }),
  );

  /* ------------------------------------------------------------------ *
   * 15. size：只有三档 28 / 36 / 44，字号 12 / 14 / 16（不再收数字）
   * ------------------------------------------------------------------ */
  const sizes = await page.evaluate(async () => {
    const data = [{ value: 'a', label: 'A' }];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const measure = async (attrs) => {
      window.__make(attrs, data);
      const el = document.getElementById('probe-tree');
      await wait(160);
      return {
        host: Math.round(el.getBoundingClientRect().height),
        font: getComputedStyle(el).fontSize,
        token: el.style.getPropertyValue('--mc-tree-select-h').trim(),
      };
    };
    const sm = await measure({ size: 'sm' });
    const md = await measure({});
    const lg = await measure({ size: 'lg' });
    const el = document.getElementById('probe-tree');
    el.setAttribute('size', 'sm');
    await wait(120);
    const back = {
      host: Math.round(el.getBoundingClientRect().height),
      font: getComputedStyle(el).fontSize,
      token: el.style.getPropertyValue('--mc-tree-select-h').trim(),
    };
    return { sm, md, lg, back };
  });
  check(
    'size：三档宿主高 28 / 36 / 44、字号 12 / 14 / 16；切档跟属性走，且不会往 style 写 --mc-tree-select-h 内联令牌',
    sizes.sm.host === 28 &&
      sizes.sm.font === '12px' &&
      sizes.md.host === 36 &&
      sizes.md.font === '14px' &&
      sizes.lg.host === 44 &&
      sizes.lg.font === '16px' &&
      sizes.back.host === 28 &&
      sizes.back.font === '12px' &&
      sizes.sm.token === '' &&
      sizes.md.token === '' &&
      sizes.lg.token === '' &&
      sizes.back.token === '',
    JSON.stringify(sizes),
  );

  /* 溢出提示：长标签被固定宽度裁掉时，hover 弹完整文案；面板打开时收起 */
  const overflowState = await page.evaluate(async () => {
    const label = '浙江省杭州市西湖区文三路 90 号（很长的节点名称，用来测裁切提示）';
    window.__make({ style: 'width: 12rem', value: 'long' }, [{ value: 'long', label }]);
    await new Promise((resolve) => setTimeout(resolve, 220));
    const host = document.getElementById('probe-tree');
    const value = host.shadowRoot.querySelector('.mc-value');
    const box = host.getBoundingClientRect();
    return {
      label,
      flagged: host.hasAttribute('data-overflow'),
      clipped: value.scrollWidth > value.clientWidth + 1,
      text: value.textContent,
      at: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    };
  });
  await page.mouse.move(400, 700);
  await page.waitForTimeout(80);
  await page.mouse.move(overflowState.at.x, overflowState.at.y);
  await page.waitForTimeout(220);
  const tip = await page.evaluate(() => {
    const host = document.getElementById('probe-tree');
    const el = host?.shadowRoot?.querySelector('.mc-overflow-tip');
    return { exists: !!el, text: el?.textContent ?? null, open: el ? el.matches(':popover-open') : false };
  });
  const controlAt = await page.evaluate(() => window.__point('control'));
  await page.mouse.click(controlAt.x, controlAt.y);
  await page.waitForTimeout(250);
  const tipWhileOpen = await page.evaluate(() => {
    const host = document.getElementById('probe-tree');
    const el = host?.shadowRoot?.querySelector('.mc-overflow-tip');
    return { open: el ? el.matches(':popover-open') : false, flagged: host.hasAttribute('data-overflow') };
  });
  await page.keyboard.press('Escape');
  await page.mouse.move(400, 700);
  check(
    '溢出提示：长标签把 .mc-value 裁掉时 data-overflow 亮起，hover 弹完整文案，面板打开时收起',
    overflowState.flagged === true &&
      overflowState.clipped === true &&
      tip.exists === true &&
      tip.open === true &&
      tip.text === overflowState.label &&
      tipWhileOpen.open === false &&
      tipWhileOpen.flagged === true,
    JSON.stringify({ overflowState, tip, tipWhileOpen }),
  );

  /* ------------------------------------------------------------------ *
   * 16. options 属性通道：JSON 文本可作初始值；property 写过之后属性不再覆盖
   * ------------------------------------------------------------------ */
  const optionChannels = await page.evaluate(async () => {
    document.querySelector('#tree-probe mc-tree-select')?.remove();
    window.__events = [];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const host = document.createElement('mc-tree-select');
    host.id = 'probe-tree';
    host.setAttribute(
      'options',
      JSON.stringify([{ value: 'a', label: 'A', children: [{ value: 'a1', label: 'A1' }] }]),
    );
    window.__treeProbe.append(host);
    await wait(200);
    const labels = () =>
      [...host.shadowRoot.querySelectorAll('.mc-label')].map((node) => node.textContent);
    const fromAttr = labels();
    host.options = [{ value: 'x', label: 'X' }];
    const fromProp = labels();
    const propRead = host.options.map((node) => node.label);
    host.setAttribute('options', JSON.stringify([{ value: 'y', label: 'Y' }]));
    await wait(200);
    return { fromAttr, fromProp, propRead, afterAttrWrite: labels() };
  });
  check(
    'options 属性通道：JSON 文本可作初始值（递归渲染出两层）；property 写过值之后属性通道不再覆盖（再改属性仍是 property 那棵树）',
    JSON.stringify(optionChannels.fromAttr) === JSON.stringify(['A', 'A1']) &&
      JSON.stringify(optionChannels.fromProp) === JSON.stringify(['X']) &&
      JSON.stringify(optionChannels.propRead) === JSON.stringify(['X']) &&
      JSON.stringify(optionChannels.afterAttrWrite) === JSON.stringify(['X']),
    JSON.stringify(optionChannels),
  );

  /* ------------------------------------------------------------------ *
   * 17. mc-form 集成：树节点的 value 按字符串收（页面没有注册 mc-form，用 <l-m> 现引）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    for (const src of ['/packages/form/form.html', '/packages/form/form-item.html']) {
      const loader = document.createElement('l-m');
      loader.setAttribute('src', src);
      document.body.append(loader);
    }
  });
  await page
    .waitForFunction(() => !!customElements.get('mc-form') && !!customElements.get('mc-form-item'), {
      timeout: 10000,
    })
    .catch(() => {});
  const form = await page.evaluate(async (tree) => {
    const formEl = document.createElement('mc-form');
    formEl.innerHTML =
      '<mc-form-item name="x"><mc-tree-select default-value="hz"></mc-tree-select></mc-form-item>';
    document.body.append(formEl);
    const host = formEl.querySelector('mc-tree-select');
    host.options = tree;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const hasGetValue = typeof formEl.getValue === 'function';
    const before = { value: host.value, collected: formEl.getValue() };
    host.value = 'xh';
    const after = { value: host.value, collected: formEl.getValue(), attr: host.getAttribute('value') };
    formEl.remove();
    return { hasGetValue, before, after };
  }, TREE);
  check(
    'mc-form 集成：default-value 的初始值按字符串收进 getValue()（"hz" → property 改成 "xh" 后表单值跟着变、value 属性同步）',
    form.hasGetValue === true &&
      form.before.value === 'hz' &&
      form.before.collected?.x === 'hz' &&
      form.after.value === 'xh' &&
      form.after.collected?.x === 'xh' &&
      form.after.attr === 'xh',
    JSON.stringify(form),
  );

  /* ------------------------------------------------------------------ *
   * 18. 懒加载：初次不调 load；点箭头才加载（data-loading + spinner）；resolve 后子节点自动展开、只加载一次
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__makeLazy());
  await waitRows(2);
  const lazyInit = await state();
  await click('control');
  await waitOpen(true);
  await click('expand', '懒加载');
  await waitRowState('懒加载', { loading: true });
  const loadingState = await state();
  const lazyLoadingRow = await page.evaluate(() => window.__rowContent());
  const loadingLoads = await page.evaluate(() => window.__loadState());
  await page.evaluate((children) => window.__loadResolve(children), [
    { value: 'a', label: '子 A' },
    { value: 'b', label: '子 B' },
  ]);
  await waitRows(4);
  const loadedState = await state();
  const loadedLoads = await page.evaluate(() => window.__loadState());
  /* 收起再展开：已经 loaded 的懒节点不再调 load */
  await click('expand', '懒加载');
  await click('expand', '懒加载');
  await page.waitForTimeout(80);
  const reloadLoads = await page.evaluate(() => window.__loadState());
  check(
    '懒加载（组件级 el.load + 节点 lazy:true）：初始懒节点有箭头但不提前调 load；点箭头 → data-loading + mc-tree-spinner，resolve 的子节点自动展开且默认是叶子（无箭头），load 收到原始节点、只调一次（收起再展开不再调）；没有 lazy 的普通叶子即使组件给了 load 也没箭头',
    lazyInit.rows.length === 2 &&
      lazyInit.rows[0].expandable === true &&
      lazyInit.rows[0].expandClass.includes('mc-icon-chevron-right') &&
      lazyInit.rows[1].expandable === false &&
      lazyInit.rows[1].expandClass === 'mc-expand' &&
      JSON.stringify(loadingLoads.calls) ===
        JSON.stringify([{ value: 'lz', label: '懒加载', lazy: true, nodeLoad: 'undefined' }]) &&
      loadingState.rows.length === 2 &&
      loadingState.rows[0].loading === true &&
      /* 加载中 spinner 是 expand 的子节点（不再挂在 expand 的 class 上） */
      lazyLoadingRow[0].hasSpinner === true &&
      lazyLoadingRow[0].expandSegments.length === 0 &&
      loadingState.open === true &&
      loadedLoads.calls.length === 1 &&
      loadedState.rows.length === 4 &&
      JSON.stringify(loadedState.rows.map((row) => row.label)) ===
        JSON.stringify(['懒加载', '子 A', '子 B', '普通叶子']) &&
      loadedState.rows[0].loading === false &&
      loadedState.rows[0].expanded === true &&
      !loadedState.rows[0].expandClass.includes('mc-tree-spinner') &&
      loadedState.rows[1].expandable === false &&
      loadedState.rows[1].expandClass === 'mc-expand' &&
      loadedState.rows[2].expandable === false &&
      loadedState.rows[2].expandClass === 'mc-expand' &&
      JSON.stringify(visibleLabels(loadedState)) ===
        JSON.stringify(['懒加载', '子 A', '子 B', '普通叶子']) &&
      reloadLoads.calls.length === 1 &&
      reloadLoads.pending === 0,
    JSON.stringify({
      lazyInit,
      loadingState,
      lazyLoadingRow,
      loadedState,
      loadingLoads,
      loadedLoads,
      reloadLoads,
    }),
  );

  /* ------------------------------------------------------------------ *
   * 19. 懒加载失败：data-load-error + document 收到 load-error；再点箭头重试成功
   * ------------------------------------------------------------------ */
  await page.evaluate(() => {
    window.__resetLoadErrors();
    window.__makeLazy();
  });
  await waitRows(2);
  await click('control');
  await waitOpen(true);
  await click('expand', '懒加载');
  await waitRowState('懒加载', { loading: true });
  await page.evaluate(() => window.__loadReject('网络挂了'));
  await waitRowState('懒加载', { loading: false, loadError: true });
  const failedState = await state();
  const failedLoads = await page.evaluate(() => window.__loadState());
  const loadErrorEvents = await page.evaluate(() => window.__loadErrors.slice());
  await click('expand', '懒加载');
  await waitRowState('懒加载', { loading: true, loadError: false });
  const retryState = await state();
  await page.evaluate((children) => window.__loadResolve(children), [
    { value: 'r1', label: '重试子' },
  ]);
  await waitRows(3);
  const recoveredState = await state();
  const recoveredLoads = await page.evaluate(() => window.__loadState());
  check(
    '懒加载失败：reject 后行 data-load-error、document 收到 load-error（载荷 { value, error }）；再点箭头重试成功 → 错误态清除、子节点出现',
    failedState.rows[0].loadError === true &&
      failedState.rows[0].loading === false &&
      failedState.rows.length === 2 &&
      failedLoads.calls.length === 1 &&
      loadErrorEvents.length === 1 &&
      loadErrorEvents[0].value === 'lz' &&
      loadErrorEvents[0].message === '网络挂了' &&
      loadErrorEvents[0].composed === true &&
      loadErrorEvents[0].bubbles === true &&
      retryState.rows[0].loading === true &&
      retryState.rows[0].loadError === false &&
      recoveredState.rows.length === 3 &&
      recoveredState.rows[0].loading === false &&
      recoveredState.rows[0].loadError === false &&
      recoveredState.rows[0].expanded === true &&
      JSON.stringify(visibleLabels(recoveredState)) ===
        JSON.stringify(['懒加载', '重试子', '普通叶子']) &&
      recoveredLoads.calls.length === 2,
    JSON.stringify({
      failedState,
      failedLoads,
      loadErrorEvents,
      retryState,
      recoveredState,
      recoveredLoads,
    }),
  );

  /* ------------------------------------------------------------------ *
   * 20. 懒加载只认箭头：键盘 ArrowRight 触发；点行正文不触发（按单选选中父节点）
   * ------------------------------------------------------------------ */
  await page.evaluate(() => window.__makeLazy());
  await waitRows(2);
  await focusControl();
  await page.keyboard.press('ArrowDown');
  await waitOpen(true);
  await page.keyboard.press('ArrowRight');
  await waitRowState('懒加载', { loading: true });
  const keyboardState = await state();
  const keyboardLoads = await page.evaluate(() => window.__loadState());
  await page.evaluate(() => window.__makeLazy());
  await waitRows(2);
  await click('control');
  await waitOpen(true);
  await click('row', '懒加载');
  await waitValue('lz');
  await waitOpen(false);
  const bodyState = await state();
  const bodyLoads = await page.evaluate(() => window.__loadState());
  /* 没有 lazy 的普通叶子：组件给了 load 也不会变懒，点它只是选中、不触发加载 */
  await page.evaluate(() => window.__makeLazy());
  await waitRows(2);
  await click('control');
  await waitOpen(true);
  await click('row', '普通叶子');
  await waitValue('plain');
  await waitOpen(false);
  const leafState = await state();
  const leafLoads = await page.evaluate(() => window.__loadState());
  check(
    '懒加载的触发只认箭头 + lazy 标记：键盘 ArrowRight 对高亮的懒节点触发加载（data-loading）；点行正文不触发 load，而是按单选选中该父节点（value=lz）并收起；没有 lazy 的普通叶子即使组件给了 load 也没有箭头、点了只选中不加载',
    keyboardState.rows[0].loading === true &&
      keyboardLoads.calls.length === 1 &&
      bodyState.value === 'lz' &&
      bodyState.open === false &&
      bodyLoads.calls.length === 0 &&
      JSON.stringify(selectedLabels(bodyState)) === JSON.stringify(['懒加载']) &&
      leafState.value === 'plain' &&
      leafState.open === false &&
      leafState.rows[1].expandable === false &&
      leafLoads.calls.length === 0,
    JSON.stringify({
      keyboardState: keyboardState.rows[0],
      keyboardLoads,
      bodyState,
      bodyLoads,
      leafState,
      leafLoads,
    }),
  );

  /* ------------------------------------------------------------------ *
   * 21. 插槽 prefix / chevron：有内容才占位；chevron 不给时落回内置下箭头
   * ------------------------------------------------------------------ */
  await page.evaluate(
    (tree) =>
      window.__makeSlotted(
        {},
        tree,
        '<span slot="prefix">前</span><span slot="chevron">下</span>',
      ),
    TREE,
  );
  await waitRows(9);
  await page.waitForTimeout(120);
  const slotted = await page.evaluate(() => window.__slots());
  await page.evaluate((tree) => window.__make({}, tree), TREE);
  await waitRows(9);
  await page.waitForTimeout(80);
  const bare = await page.evaluate(() => window.__slots());
  check(
    '插槽 prefix / chevron：prefix 有内容时宿主挂 data-has-prefix、内容可见且 part="prefix" 在；chevron 有内容时 slot 分到 assigned、part="chevron" 在、内置 fallback .mc-default-chevron 不渲染；没给 chevron 时 fallback 可见；空 prefix 不占位',
    slotted.hasPrefix === true &&
      slotted.prefixPart === 'prefix' &&
      slotted.prefixDisplay !== 'none' &&
      slotted.prefixAssigned === 1 &&
      slotted.prefixText === '前' &&
      slotted.prefixRect.w > 0 &&
      slotted.prefixContentRect.w > 0 &&
      slotted.chevronPart === 'chevron' &&
      slotted.chevronDisplay !== 'none' &&
      slotted.chevronAssigned === 1 &&
      slotted.chevronText === '下' &&
      slotted.chevronContentRect.w > 0 &&
      slotted.defaultChevronRect.w === 0 &&
      bare.hasPrefix === false &&
      bare.prefixDisplay === 'none' &&
      bare.prefixRect.w === 0 &&
      bare.chevronPart === 'chevron' &&
      bare.chevronAssigned === 0 &&
      bare.defaultChevronRect.w > 0,
    JSON.stringify({ slotted, bare }),
  );

  /* ------------------------------------------------------------------ *
   * 22. 插槽 empty：options=[] 时替换 fallback；empty-text 仍决定 fallback 文案
   * ------------------------------------------------------------------ */
  await page.evaluate(() =>
    window.__makeSlotted({ 'empty-text': '兜底文案' }, [], '<em slot="empty">自定义空态</em>'),
  );
  await page.waitForTimeout(120);
  await click('control');
  await waitOpen(true);
  await page.waitForTimeout(180); /* mc-scroll-bar 铺好再量几何 */
  const emptySlottedOpen = await state();
  const emptySlotted = await page.evaluate(() => window.__slots());
  await page.evaluate(() => window.__make({ 'empty-text': '兜底文案' }, []));
  await waitRows(0);
  await click('control');
  await waitOpen(true);
  await page.waitForTimeout(180);
  const emptyFallback = await page.evaluate(() => window.__slots());
  check(
    '插槽 empty：options=[] 且给了 <em slot="empty"> 时用插槽内容替换 fallback（插槽内容可见、.mc-empty fallback 不渲染）；empty-text 仍写进 fallback 文案；没有插槽时 fallback 正常显示',
    emptySlottedOpen.open === true &&
      emptySlotted.emptyAssigned === 1 &&
      emptySlotted.emptyContentRect.w > 0 &&
      emptySlotted.emptyFallbackRect.w === 0 &&
      emptySlotted.emptyFallbackText === '兜底文案' &&
      emptySlotted.emptyWrapHidden === false &&
      emptyFallback.emptyAssigned === 0 &&
      emptyFallback.emptyFallbackRect.w > 0 &&
      emptyFallback.emptyFallbackText === '兜底文案',
    JSON.stringify({ emptySlotted, emptyFallback }),
  );

  /* ------------------------------------------------------------------ *
   * 23. 行模板插槽 option / icon：option 进行正文、icon 进行首展开位；::part(expand) 可定制
   * ------------------------------------------------------------------ */
  await page.evaluate(
    ({ tree, html }) => window.__makeSlotted({}, tree, html),
    { tree: TEMPLATE_TREE, html: TEMPLATE_HTML },
  );
  await page
    .waitForFunction(
      () =>
        !!document
          .querySelector('#probe-tree')
          ?.shadowRoot?.querySelector('.mc-row [part="expand"] [data-field="icon"]'),
      { timeout: 3000 },
    )
    .catch(() => {});
  await page.waitForTimeout(80);
  const templatedRows = await page.evaluate(() => window.__rowContent());
  await click('control');
  await waitOpen(true);
  await click('expand-index', 0);
  const templatedExpanded = await state();
  await click('row-index', 2);
  await waitValue('b');
  await waitOpen(false);
  const templatedPicked = await state();
  /* 没有模板时：行正文回落节点 label、可展开行 expand 挂内置右箭头、叶子行 expand 为空 */
  await page.evaluate((tree) => window.__make({}, tree), TEMPLATE_TREE);
  await waitRows(4);
  const plainRows = await page.evaluate(() => window.__rowContent());
  /* ::part(expand) 改得动内部；part="icon" / .mc-node-icon 已删除 */
  const partStyles = await page.evaluate(
    async ({ tree, html }) => {
      window.__makeSlotted({}, tree, html);
      const style = document.createElement('style');
      style.id = 'tree-part-style';
      style.textContent = '#tree-probe mc-tree-select::part(expand) { color: rgb(4, 5, 6); }';
      document.head.append(style);
      const host = document.getElementById('probe-tree');
      /* 模板是 light DOM 改动 → slotchange 重渲染行；等 expand 里出现模板内容再量 */
      for (let i = 0; i < 40; i += 1) {
        if (host.shadowRoot.querySelector('.mc-row [part="expand"] [data-field="icon"]')) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const root = host.shadowRoot;
      return {
        expand: getComputedStyle(root.querySelector('.mc-row [part="expand"]')).color,
        legacyIcon: !!root.querySelector('[part="icon"], .mc-node-icon'),
      };
    },
    { tree: TEMPLATE_TREE, html: TEMPLATE_HTML },
  );
  check(
    '行模板插槽 option / icon：option 模板进行正文（data-field="label" 填文本、data-field-attr="title:desc" 填属性），icon 模板按行克隆进行首 part="expand"（叶子行不渲染）；没有模板时行正文回落 label、可展开行 expand 挂 mc-icon-chevron-right、叶子行 expand 为空；part="icon" / .mc-node-icon 已删除；行仍可展开 / 选中；::part(expand) 能改样式',
    templatedRows.length === 4 &&
      templatedRows.every((row) => row.partIcon === false) &&
      templatedRows[0].expandText === '★' &&
      templatedRows[0].expandSegments.some((seg) => seg.field === 'icon' && seg.text === '★') &&
      templatedRows[1].expandText === '' &&
      templatedRows[1].expandSegments.length === 0 &&
      templatedRows[2].expandText === '☆' &&
      templatedRows[3].expandText === '' &&
      templatedRows[3].expandSegments.length === 0 &&
      templatedRows[0].labelSegments.some((seg) => seg.field === 'label' && seg.text === '甲') &&
      templatedRows[0].labelSegments.some(
        (seg) => seg.fieldAttr === 'title:desc' && seg.attrs.title === '甲说明',
      ) &&
      templatedRows[2].labelSegments.some((seg) => seg.field === 'label' && seg.text === '乙') &&
      templatedExpanded.rows[0].expanded === true &&
      templatedExpanded.rows[1].visible === true &&
      templatedPicked.value === 'b' &&
      templatedPicked.rows.filter((row) => row.selected).length === 1 &&
      templatedPicked.open === false &&
      plainRows.every((row) => row.partIcon === false) &&
      JSON.stringify(plainRows.map((row) => row.label)) ===
        JSON.stringify(['甲', '甲一', '乙', '乙一']) &&
      plainRows[0].expandClass.includes('mc-icon-chevron-right') &&
      plainRows[2].expandClass.includes('mc-icon-chevron-right') &&
      plainRows[1].expandClass === 'mc-expand' &&
      plainRows[1].expandText === '' &&
      plainRows[3].expandClass === 'mc-expand' &&
      plainRows[3].expandText === '' &&
      partStyles.expand === 'rgb(4, 5, 6)' &&
      partStyles.legacyIcon === false,
    JSON.stringify({
      templatedRows,
      templatedExpanded: templatedExpanded.rows,
      templatedPicked,
      plainRows,
      partStyles,
    }),
  );

  /* ------------------------------------------------------------------ *
   * 24. icon 模板 + 懒加载：加载中 expand 换成转圈，完成后恢复模板图标
   * ------------------------------------------------------------------ */
  await page.evaluate((html) => {
    window.__makeLazy();
    document.getElementById('probe-tree').innerHTML = html;
  }, '<template slot="icon"><i data-field="icon"></i></template>');
  await page
    .waitForFunction(
      () =>
        !!document
          .querySelector('#probe-tree')
          ?.shadowRoot?.querySelector('.mc-row [part="expand"] [data-field="icon"]'),
      { timeout: 3000 },
    )
    .catch(() => {});
  await page.waitForTimeout(80);
  const iconInit = await page.evaluate(() => window.__rowContent());
  await click('control');
  await waitOpen(true);
  await click('expand', '懒加载');
  await waitRowState('懒加载', { loading: true });
  const iconLoading = await page.evaluate(() => window.__rowContent());
  await page.evaluate((children) => window.__loadResolve(children), [
    { value: 'x', label: '子 X' },
  ]);
  await waitRows(3);
  const iconLoaded = await page.evaluate(() => window.__rowContent());
  check(
    'icon 模板 + 懒加载：加载期间 expand 换成 .mc-tree-spinner（自定义图标先让位），resolve 后转圈消失、模板图标恢复',
    iconInit[0].expandText === '★' &&
      iconInit[0].expandSegments.length === 1 &&
      iconLoading[0].hasSpinner === true &&
      iconLoading[0].expandSegments.length === 0 &&
      iconLoaded[0].hasSpinner === false &&
      iconLoaded[0].expandText === '★' &&
      iconLoaded[0].expanded === true,
    JSON.stringify({ iconInit, iconLoading, iconLoaded }),
  );

  /* ---------- 收摊：拆探针 ---------- */
  await page.evaluate(() => {
    document.getElementById('tree-probe')?.remove();
    document.getElementById('tree-outside')?.remove();
    document.getElementById('tree-part-style')?.remove();
  });
}
