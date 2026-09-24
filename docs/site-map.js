/* 站点唯一数据源：**有哪些页面 / 组件**、它们的分组与顺序，以及**导航树**。
 *
 * 以前这分成两份（components.js 组件登记表 + nav.js 导航树），其实是一件事的两半 ——
 * 合并成一份：加一个组件、加一个一级入口，都只认这里。
 *
 * 字段约定：
 *   order        排序用（10 / 20 / 30…，留出插队空间）。分组按分组的 order，组内按条目的 order
 *   status       'ready' 已实现 | 'planned' 待建 —— **它同时就是「有没有自己的文档页」的标识**：
 *                待建的还没有 packages/<slug>/page.html，所以判「有没有页面」一律走下面的
 *                hasPage()，别在别处再写一遍 status === 'ready'
 *   desc         一句话说明：左栏 tooltip、总览页卡片、首页组件区块都用它
 *
 * ⚠️ 页内目录（h2/h3）**不在这里**：它是内容派生的、每页都不同，由 <doc-toc> 扫标题生成。
 *    写进数据意味着每加一节、改个标题、挪次顺序都要两处改，而且锚点 id 是页面里生成的，
 *    手写必然对不上。
 */

/**
 * 组件按分组写。加一个组件 = **这里加一条 + 建 packages/<slug>/**，别处不用动。
 *
 * slug / name / tag  目录名 / 显示名 / 自定义元素标签
 * milestone          归属里程碑
 */
const GROUPS_RAW = [
  {
    title: '基础',
    order: 10,
    desc: '最常用的展示与操作单元',
    items: [
      {
        slug: 'button',
        name: 'Button',
        tag: 'mc-button',
        order: 10,
        status: 'ready',
        milestone: 'M1',
        desc: '按钮。语义色 × 外观样式两个正交维度，6 色 × 3 外观 = 18 种组合。',
      },
      {
        slug: 'code',
        name: 'Code',
        tag: 'mc-code',
        order: 20,
        status: 'ready',
        milestone: 'M1',
        desc: '代码展示。配色用 highlight.js 官方主题、按需懒加载，失败即降级为纯文本；行号 / 折行 / 限高滚动开箱可用。',
      },
      {
        slug: 'icon',
        name: 'Icon',
        tag: 'mc-icon',
        order: 30,
        status: 'planned',
        milestone: 'M1',
        desc: '图标。内联 SVG sprite，随 font-size 等比缩放，不用 icons preset（体积代价太高）。',
      },
      {
        slug: 'card',
        name: 'Card',
        tag: 'mc-card',
        order: 40,
        status: 'planned',
        milestone: 'M1',
        desc: '卡片容器。有底色 / 只有描边两种，可选可交互抬升。',
      },
      {
        slug: 'badge',
        name: 'Badge',
        tag: 'mc-badge',
        order: 50,
        status: 'planned',
        milestone: 'M1',
        desc: '徽标。默认浅底，比实心更不抢视线；支持纯圆点与数值上限。',
      },
      {
        slug: 'spinner',
        name: 'Spinner',
        tag: 'mc-spinner',
        order: 60,
        status: 'planned',
        milestone: 'M1',
        desc: '加载指示。跟随当前文字色与字号。',
      },
      {
        slug: 'menu',
        name: 'Menu',
        tag: 'mc-menu',
        order: 70,
        status: 'ready',
        milestone: 'M1',
        desc: '垂直菜单。容器 + 菜单项两个标签，交互元素由使用者写在插槽里 —— 组件不造链接、也不改使用者的 DOM。',
      },
    ],
  },
  {
    title: '表单',
    order: 20,
    desc: '值的读写遵循统一约定：标签属性是初始值，DOM property 是运行时状态',
    items: [
      {
        slug: 'input',
        name: 'Input',
        tag: 'mc-input',
        order: 10,
        status: 'planned',
        milestone: 'M2',
        desc: '单行输入框。可清除、前后缀插槽。',
      },
      {
        slug: 'textarea',
        name: 'Textarea',
        tag: 'mc-textarea',
        order: 20,
        status: 'planned',
        milestone: 'M2',
        desc: '多行输入框。支持自动增高与字数统计。',
      },
      {
        slug: 'checkbox',
        name: 'Checkbox',
        tag: 'mc-checkbox',
        order: 30,
        status: 'planned',
        milestone: 'M2',
        desc: '复选框。支持半选态。',
      },
      {
        slug: 'radio',
        name: 'Radio',
        tag: 'mc-radio',
        order: 40,
        status: 'planned',
        milestone: 'M2',
        desc: '单选按钮组。',
      },
      {
        slug: 'switch',
        name: 'Switch',
        tag: 'mc-switch',
        order: 50,
        status: 'planned',
        milestone: 'M2',
        desc: '开关。',
      },
      {
        slug: 'select',
        name: 'Select',
        tag: 'mc-select',
        order: 60,
        status: 'planned',
        milestone: 'M2',
        desc: '下拉选择。M2 里最复杂的一个：浮层定位 + 键盘导航 + 点击外部判定。',
      },
    ],
  },
  {
    title: '反馈',
    order: 30,
    desc: '把状态告诉使用者',
    items: [
      {
        slug: 'alert',
        name: 'Alert',
        tag: 'mc-alert',
        order: 10,
        status: 'planned',
        milestone: 'M2',
        desc: '页内提示条。可关闭，带标题与描述。',
      },
      {
        slug: 'progress',
        name: 'Progress',
        tag: 'mc-progress',
        order: 20,
        status: 'planned',
        milestone: 'M2',
        desc: '进度条。支持不确定态。',
      },
      {
        slug: 'toast',
        name: 'Toast',
        tag: 'toast()',
        order: 30,
        status: 'planned',
        milestone: 'M2',
        desc: '命令式消息条，返回 Promise 与 close 句柄。',
      },
    ],
  },
  {
    title: '浮层',
    order: 40,
    desc: '⚠️ 这一批开工前必须先验证图层：宿主页面的 transform / filter 会创建新的层叠上下文，可能把 shadow root 内的浮层困住',
    items: [
      {
        slug: 'dialog',
        name: 'Dialog',
        tag: 'mc-dialog',
        order: 10,
        status: 'planned',
        milestone: 'M3',
        desc: '对话框。遮罩、焦点陷阱、Esc 关闭。',
      },
      {
        slug: 'dropdown',
        name: 'Dropdown',
        tag: 'mc-dropdown',
        order: 20,
        status: 'planned',
        milestone: 'M3',
        desc: '下拉菜单。',
      },
      {
        slug: 'tooltip',
        name: 'Tooltip',
        tag: 'mc-tooltip',
        order: 30,
        status: 'planned',
        milestone: 'M3',
        desc: '提示气泡。',
      },
    ],
  },
  {
    title: '布局',
    order: 50,
    desc: '组织内容',
    items: [
      {
        slug: 'collapse',
        name: 'Collapse',
        tag: 'mc-collapse',
        order: 10,
        status: 'ready',
        milestone: 'M1',
        desc: '折叠面板。容器 + 子项，可选互斥；开合语义直接交给原生 details/summary，键盘与无障碍不用自己写。',
      },
      {
        slug: 'tabs',
        name: 'Tabs',
        tag: 'mc-tabs',
        order: 20,
        status: 'planned',
        milestone: 'M3',
        desc: '标签页。',
      },
      {
        slug: 'table',
        name: 'Table',
        tag: 'mc-table',
        order: 30,
        status: 'planned',
        milestone: 'M3',
        desc: '数据表格。columns / data 通过 property 传入（对象不能走标签属性）。',
      },
      {
        slug: 'grid',
        name: 'Grid',
        tag: 'mc-grid',
        order: 40,
        status: 'planned',
        milestone: 'M3',
        desc: '栅格。',
      },
    ],
  },
];

/* ------------------------------------------------------------------ 派生与查询 */

const byOrder = (a, b) => a.order - b.order;

/** 分组写在上面的数据表里，先后由 order 说了算 —— 这里排一次，渲染端不用再操心 */
export const GROUPS = [...GROUPS_RAW]
  .sort(byOrder)
  .map((group) => ({ ...group, items: [...group.items].sort(byOrder) }));

/** 拍平的完整清单（按分组顺序 + 组内顺序），附带所属分组 */
export const ALL = GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title })),
);

/** 有没有自己的文档页。**唯一**的实现状态判断：菜单 / 卡片 / 面包屑 / 翻页都用它 */
export const hasPage = (item) => item.status === 'ready';

export const READY = ALL.filter(hasPage);
export const PLANNED = ALL.filter((item) => !hasPage(item));

/**
 * 组件文档页在仓库里的位置 —— 就在组件自己的目录下。
 *
 * 文件名是 page.html 而不是 index.html：它是 **ofa.js 页面模块**（`<template page>`），
 * 不是可以直接打开的独立网页。路由地址是 `#/packages/<slug>/page.html`。
 */
export const pageOf = (slug) => `packages/${slug}/page.html`;

/** 组件总览页（站点级，跨所有组件） */
export const OVERVIEW = 'docs/pages/components.html';

/** 未实现的组件不给死链，指到规范里的接口定义（外链，不走 hash 路由） */
export const SPEC_URL = 'https://github.com/lhf6623/mosaic/blob/main/agent/component-spec.md';

/* ------------------------------------------------------------------ 导航树 */

/** 组件分区的子菜单：总览 + 每个分组（分组标题行）+ 组内条目 */
function componentMenu() {
  // 总览本身也是一页，status 不能省：hasPage() 是严格判断，漏了它 Button 就没有「上一页」
  const items = [{ order: 0, to: OVERVIEW, label: '总览', status: 'ready' }];

  for (const group of GROUPS) {
    items.push({ group: group.title, order: group.order });

    for (const item of group.items) {
      items.push({
        to: pageOf(item.slug),
        label: item.name,
        order: item.order,
        // 带 slug = 这是一条组件条目（总览那种页面条目不进「组件」那套钩子：压暗样式、测试选择器）
        slug: item.slug,
        status: item.status,
        title: hasPage(item) ? item.desc : `${item.milestone} · 待建 —— ${item.desc}`,
        external: hasPage(item) ? null : SPEC_URL,
      });
    }
  }

  return items;
}

/**
 * 顶层入口（顶栏）。带 menu 的是「分区」——左栏、面包屑、翻页都围着它转。
 * 页面挂到哪一层靠各自的 export const parent，这里只描述结构与顺序。
 */
export const NAV = [
  { order: 10, label: '首页', to: 'docs/pages/home.html' },
  { order: 20, label: '快速开始', to: 'docs/pages/guide.html' },
  { order: 30, label: '设计令牌', to: 'packages/color/page.html' },
  { order: 40, label: '规范', to: 'docs/pages/specs.html' },
  { order: 50, label: '组件', to: OVERVIEW, menu: componentMenu() },
].sort(byOrder);

/** menu 里的一项是不是分组标题（不可点，只当标题） */
export const isGroup = (node) => typeof node?.group === 'string';

/** 当前路由落在哪一支：`{ entry, leaf }`；顶层入口自己那一页只有 entry（leaf 为 null） */
export function locate(route) {
  for (const entry of NAV) {
    if (entry.to === route) return { entry, leaf: null };

    for (const node of entry.menu ?? []) {
      if (!isGroup(node) && node.to === route) return { entry, leaf: node };
    }
  }
  return null;
}

/** 分区里**真正有页面**的叶子（按左栏顺序）。待建的跳过：翻页不能指向不存在的页 */
export const pagesOf = (entry) =>
  (entry?.menu ?? []).filter((node) => !isGroup(node) && hasPage(node));

/** 同一分区里相邻的上一页 / 下一页（没有就是 null） */
export function siblingsOf(route) {
  const { entry } = locate(route) ?? {};
  const pages = pagesOf(entry);
  const index = pages.findIndex((page) => page.to === route);
  return { prev: pages[index - 1] ?? null, next: pages[index + 1] ?? null };
}
