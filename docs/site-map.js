/* 站点唯一数据源：**有哪些页面 / 组件**、它们的层级与顺序 —— 也就是导航本身。
 *
 * 一棵树，**结构即菜单**：children 的层级就是左栏的分组与缩进，label 就是显示名。
 *   · 有 children → 分组 / 分区（左栏渲染成不可点的标题行）
 *   · 有 path     → 有页面、可点
 *   · 没有 path   → 待建：左栏指向规范文档，卡片上显示 stage 徽标
 *
 * 左栏 = children 逐条渲染。分区的顶栏入口与它 children 里的「总览」是同一页，
 * 所以那条 path 写两次 —— 这是有意的（测试放行这一处重合）。
 *
 * 显示顺序由 order 说了算（同层唯一），加载时递归排好，消费端一次都不用 sort；
 * 数组也按 order 写 —— 打开文件看到的顺序就是页面上的顺序，测试对账这两者一致。
 *
 * hidden 只管展示：顶栏 / 左栏 / 面包屑 / 翻页 / 总览卡片都不出现，子树上继承；
 * 页面文件、组件套件、文档页检查照旧（藏起来 ≠ 不维护），直链仍然能访问。
 *
 * 字段约定：
 *   label     显示名（顶栏入口 / 分组标题 / 页面名）
 *   order     同层显示顺序（10 / 20 / 30…，留出插队空间）
 *   path      站内路由（仓库相对路径）。**有 path 才算已实现**，所以没有 status 之类的兼职字段
 *   children  子节点
 *   hidden    从展示面隐藏（缺省 false）
 *   summary   一句话说明：左栏 tooltip、总览页卡片、首页组件区块都用它
 *   tagName   自定义元素标签（组件）
 *   stage     里程碑 M1 / M2 / M3（组件）
 *
 * ⚠️ 页内目录（h2/h3）**不在这里**：它是内容派生的、每页都不同，由 <doc-toc> 扫标题生成。
 */

export const SITE = [
  { order: 10, label: '首页', path: 'docs/pages/home.html' },
  { order: 20, label: '快速开始', path: 'docs/pages/guide.html' },
  { order: 30, label: '设计令牌', path: 'packages/color/page.html' },
  { order: 40, label: '规范', path: 'docs/pages/specs.html' },
  {
    order: 50,
    label: '组件',
    path: 'docs/pages/components.html',
    children: [
      // 分区入口自己那一页也是左栏第一项：它的 path 与上面重复是有意的
      { order: 0, label: '总览', path: 'docs/pages/components.html' },
      {
        order: 10,
        label: '基础',
        summary: '最常用的展示与操作单元',
        children: [
          {
            order: 10,
            label: 'Button',
            path: 'packages/button/page.html',
            tagName: 'mc-button',
            stage: 'M1',
            summary: '按钮。语义色 × 外观样式两个正交维度，6 色 × 3 外观 = 18 种组合。',
          },
          {
            order: 20,
            label: 'Code',
            path: 'packages/code/page.html',
            tagName: 'mc-code',
            stage: 'M1',
            summary:
              '代码展示。配色用 highlight.js 官方主题、按需懒加载，失败即降级为纯文本；行号 / 折行 / 限高滚动开箱可用。',
          },
          {
            order: 30,
            label: 'Icon',
            tagName: 'mc-icon',
            stage: 'M1',
            summary:
              '图标。内联 SVG sprite，随 font-size 等比缩放，不用 icons preset（体积代价太高）。',
          },
          {
            order: 40,
            label: 'Card',
            path: 'packages/card/page.html',
            tagName: 'mc-card',
            stage: 'M1',
            summary:
              '卡片容器。有底色 / 只有描边两种，头尾结构 + 内边距档位；不做交互，可点的是你写在卡内那个元素。',
          },
          {
            order: 50,
            label: 'Badge',
            tagName: 'mc-badge',
            stage: 'M1',
            summary: '徽标。默认浅底，比实心更不抢视线；支持纯圆点与数值上限。',
          },
          {
            order: 60,
            label: 'Spinner',
            tagName: 'mc-spinner',
            stage: 'M1',
            summary: '加载指示。跟随当前文字色与字号。',
          },
          {
            order: 70,
            label: 'Menu',
            path: 'packages/menu/page.html',
            tagName: 'mc-menu',
            stage: 'M1',
            summary:
              '垂直菜单。容器 + 菜单项两个标签，交互元素由使用者写在插槽里 —— 组件不造链接、也不改使用者的 DOM。',
          },
          {
            order: 80,
            label: 'Breadcrumb',
            path: 'packages/breadcrumb/page.html',
            tagName: 'mc-breadcrumb',
            stage: 'M1',
            summary:
              '面包屑。容器 + 每一级两个标签；一级里的链接由使用者写在插槽里，当前页写 current，组件不造链接。',
          },
        ],
      },
      {
        order: 20,
        label: '表单',
        summary: '值的读写遵循统一约定：标签属性是初始值，DOM property 是运行时状态',
        children: [
          {
            order: 10,
            label: 'Input',
            tagName: 'mc-input',
            stage: 'M2',
            summary: '单行输入框。可清除、前后缀插槽。',
          },
          {
            order: 20,
            label: 'Textarea',
            tagName: 'mc-textarea',
            stage: 'M2',
            summary: '多行输入框。支持自动增高与字数统计。',
          },
          {
            order: 30,
            label: 'Checkbox',
            tagName: 'mc-checkbox',
            stage: 'M2',
            summary: '复选框。支持半选态。',
          },
          {
            order: 40,
            label: 'Radio',
            tagName: 'mc-radio',
            stage: 'M2',
            summary: '单选按钮组。',
          },
          {
            order: 50,
            label: 'Switch',
            tagName: 'mc-switch',
            stage: 'M2',
            summary: '开关。',
          },
          {
            order: 60,
            label: 'Select',
            tagName: 'mc-select',
            stage: 'M2',
            summary: '下拉选择。M2 里最复杂的一个：浮层定位 + 键盘导航 + 点击外部判定。',
          },
        ],
      },
      {
        order: 30,
        label: '反馈',
        summary: '把状态告诉使用者',
        children: [
          {
            order: 10,
            label: 'Alert',
            tagName: 'mc-alert',
            stage: 'M2',
            summary: '页内提示条。可关闭，带标题与描述。',
          },
          {
            order: 20,
            label: 'Progress',
            tagName: 'mc-progress',
            stage: 'M2',
            summary: '进度条。支持不确定态。',
          },
          {
            order: 30,
            label: 'Toast',
            tagName: 'toast()',
            stage: 'M2',
            summary: '命令式消息条，返回 Promise 与 close 句柄。',
          },
        ],
      },
      {
        order: 40,
        label: '浮层',
        summary:
          '⚠️ 这一批开工前必须先验证图层：宿主页面的 transform / filter 会创建新的层叠上下文，可能把 shadow root 内的浮层困住',
        children: [
          {
            order: 10,
            label: 'Dialog',
            tagName: 'mc-dialog',
            stage: 'M3',
            summary: '对话框。遮罩、焦点陷阱、Esc 关闭。',
          },
          {
            order: 20,
            label: 'Dropdown',
            tagName: 'mc-dropdown',
            stage: 'M3',
            summary: '下拉菜单。',
          },
          {
            order: 30,
            label: 'Tooltip',
            tagName: 'mc-tooltip',
            stage: 'M3',
            summary: '提示气泡。',
          },
        ],
      },
      {
        order: 50,
        label: '布局',
        summary: '组织内容',
        children: [
          {
            order: 10,
            label: 'Collapse',
            path: 'packages/collapse/page.html',
            tagName: 'mc-collapse',
            stage: 'M1',
            summary:
              '折叠面板。容器 + 子项，可选互斥；开合语义直接交给原生 details/summary，键盘与无障碍不用自己写。',
          },
          {
            order: 20,
            label: 'Tabs',
            tagName: 'mc-tabs',
            stage: 'M3',
            summary: '标签页。',
          },
          {
            order: 30,
            label: 'Table',
            tagName: 'mc-table',
            stage: 'M3',
            summary: '数据表格。columns / data 通过 property 传入（对象不能走标签属性）。',
          },
          {
            order: 40,
            label: 'Grid',
            tagName: 'mc-grid',
            stage: 'M3',
            summary: '栅格。',
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ 排序 */

const byOrder = (a, b) => a.order - b.order;

/** 递归按 order 排好；children 也换成排好序的新数组（SITE 原样留着，对账测试要看它） */
const sortTree = (nodes) =>
  [...nodes]
    .sort(byOrder)
    .map((node) => (node.children ? { ...node, children: sortTree(node.children) } : { ...node }));

/** 排好序的完整树（含 hidden）：渲染、定位都用它 */
export const NAV = sortTree(SITE);

/* ------------------------------------------------------------------ 结构与查询 */

const hasChildren = (node) => Array.isArray(node.children);

/** 有没有自己的文档页。**唯一**的实现状态判断：菜单 / 卡片 / 面包屑 / 翻页都用它 */
export const hasPage = (node) => typeof node.path === 'string';

/** 组件目录名（`packages/<目录>/page.html` 的第二段）。测试拼套件 / 演示路径要用 */
export const slugOf = (node) => node.path.split('/')[1];

/** 未实现的组件不给死链，指到规范里的接口定义（外链，不走 hash 路由） */
export const SPEC_URL = 'https://github.com/lhf6623/mosaic/blob/main/agent/component-spec.md';

/** 顶栏一级入口。顶层没有祖先，所以这里的 hidden 不需要继承 */
export const TOPBAR = NAV.filter((entry) => entry.hidden !== true);

/** 过滤 hidden（沿树继承）；隐藏后空掉的分组整条去掉 */
function prune(nodes, inherited = false) {
  const out = [];
  for (const node of nodes) {
    const hidden = inherited || node.hidden === true;
    if (hidden) continue;
    if (!hasChildren(node)) {
      out.push(node);
      continue;
    }
    const children = prune(node.children, hidden);
    if (children.length) out.push({ ...node, children });
  }
  return out;
}

/** 左栏要渲染的子节点：hidden 已剔除、隐藏后空掉的分组不出现 */
export const menuOf = (entry) => prune(entry?.children ?? []);

/** 按树序走一遍，回调拿得到所属分组与继承来的 hidden */
function walk(nodes, visit, group = null, hidden = false) {
  for (const node of nodes) {
    const isHidden = hidden || node.hidden === true;
    visit(node, { group, hidden: isHidden });
    if (hasChildren(node)) walk(node.children, visit, node.label, isHidden);
  }
}

/** **工具面**：所有已实现的组件（含 hidden）—— 冒烟套件入口、文档页检查都用它 */
export const READY = (() => {
  const out = [];
  walk(NAV, (node) => {
    if (node.tagName && hasPage(node)) out.push(node);
  });
  return out;
})();

/** **渲染面**：组件分组（hidden 的整组 / 整条不出现，空分组不出现）→ 总览卡片与首页卡片 */
export const GROUPS = (() => {
  const out = [];
  walk(NAV, (node, { hidden }) => {
    if (hidden || !hasChildren(node)) return;
    const items = node.children.filter((child) => child.tagName && child.hidden !== true);
    if (items.length) out.push({ label: node.label, summary: node.summary, items });
  });
  return out;
})();

/** **渲染面**：可见的组件清单（含待建），按左栏顺序，附所属分组 */
export const ALL = GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
);

/** 当前路由落在哪一支：`{ entry, node, hidden }`。**隐藏页也能命中** —— 顶栏得知道该点亮谁 */
export function locate(route) {
  for (const entry of NAV) {
    const hit = findIn(entry, route);
    if (hit) return { entry, ...hit };
  }
  return null;
}

function findIn(node, route, hidden = false) {
  const isHidden = hidden || node.hidden === true;
  if (node.path === route) return { node, hidden: isHidden };

  for (const child of node.children ?? []) {
    const hit = findIn(child, route, isHidden);
    if (hit) return hit;
  }
  return null;
}

/** 一个分区里可见、有页面的条目（按左栏顺序，递归展开分组） */
const collectPages = (nodes, out) => {
  for (const node of nodes) {
    if (hasChildren(node)) collectPages(node.children, out);
    else if (hasPage(node)) out.push(node);
  }
  return out;
};

/**
 * 一个分区里会出现在翻页链上的页面（按左栏顺序），隐藏页不在里面 ——
 * 直链打开隐藏页时不该把它塞回翻页链。
 */
export const pagesOf = (entry) => collectPages(menuOf(entry), []);

/** 同一分区里相邻的上一页 / 下一页（没有、或当前是隐藏页就是 null） */
export function siblingsOf(route) {
  const { entry } = locate(route) ?? {};
  const pages = pagesOf(entry);
  const index = pages.findIndex((page) => page.path === route);
  if (index < 0) return { prev: null, next: null };

  return { prev: pages[index - 1] ?? null, next: pages[index + 1] ?? null };
}
