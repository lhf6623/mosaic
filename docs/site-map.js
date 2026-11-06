/* 站点唯一数据源：**就是 mc-menu 的 options 树**，不再有「导航节点 → options」的中间翻译。
 * key = `docs:*` 的层级英文标识（逐级用 : 拼，整棵树唯一；容器 current 就写它）；label = 显示名；
 * href = 普通站内路径（路由定位、搜索跳转、工具索引都读它）；
 * meta = 站点自己的业务数据（path / type / zh），组件不解释；**数组顺序就是显示顺序**。
 * 顶层分区没有 type → menu 当可开合的 parent（窄屏「全部菜单」用）；二级分组写 type: 'group' → 左栏常显。
 * ⚠️ 页内目录（h2/h3）不在这里：由 <doc-toc> 扫标题生成。
 */

/**
 * 树上的一个节点 = 一条 menu option
 * @typedef {object} MenuOption
 * @property {string} key 整棵树唯一的 `docs:*` 层级英文标识
 * @property {string} label 显示名
 * @property {string} [href] 站内路径 / 完整 URL
 * @property {'group'} [type] 二级分组标题
 * @property {MenuOption[]} [children] 子菜单
 * @property {object} [attrs] 行上的 HTML 属性
 * @property {{ type?: 'component' | 'page', zh?: string }} [meta]
 *            站点业务数据，组件不解释；没有业务数据的分组 / 分区不写这个字段
 */

/** @type {MenuOption[]} */
export const SITE = [
  { key: 'docs:home', label: '首页', href: 'docs/pages/home.html', meta: { type: 'page' } },
  {
    key: 'docs:docs',
    label: '文档',
    children: [
      {
        key: 'docs:docs:intro',
        type: 'group',
        label: '介绍',
        children: [
          {
            key: 'docs:docs:intro:intro',
            label: 'Mosaic UI',
            href: 'docs/pages/intro.html',
            meta: { type: 'page' },
          },
        ],
      },
      {
        key: 'docs:docs:quickstart',
        type: 'group',
        label: '快速上手',
        children: [
          {
            key: 'docs:docs:quickstart:install',
            label: '安装',
            href: 'docs/pages/install.html',
            meta: { type: 'page' },
          },
          {
            key: 'docs:docs:quickstart:controlled',
            label: '受控与非受控',
            href: 'docs/pages/controlled.html',
            meta: { type: 'page' },
          },
          {
            key: 'docs:docs:quickstart:platforms',
            label: '支持的平台',
            href: 'docs/pages/platforms.html',
            meta: { type: 'page' },
          },
          {
            key: 'docs:docs:quickstart:faq',
            label: '常见问题',
            href: 'docs/pages/faq.html',
            meta: { type: 'page' },
          },
        ],
      },
      {
        key: 'docs:docs:guide',
        type: 'group',
        label: '指南',
        children: [
          {
            key: 'docs:docs:guide:theme',
            label: '调整主题',
            href: 'docs/pages/theme.html',
            meta: { type: 'page' },
          },
          {
            key: 'docs:docs:guide:component-theme',
            label: '单个组件主题适配',
            href: 'docs/pages/component-theme.html',
            meta: { type: 'page' },
          },
          {
            key: 'docs:docs:guide:style-conflicts',
            label: '样式冲突',
            href: 'docs/pages/style-conflicts.html',
            meta: { type: 'page' },
          },
        ],
      },
    ],
  },
  {
    key: 'docs:component',
    label: '组件',
    children: [
      {
        key: 'docs:component:base',
        type: 'group',
        label: '基础',
        children: [
          {
            key: 'docs:component:base:color',
            label: '色彩',
            href: 'packages/color/page.html',
            meta: { type: 'page' },
          },
          {
            key: 'docs:component:base:button',
            label: '按钮（Button）',
            href: 'packages/button/page.html',
            meta: { type: 'component', zh: '按钮' },
          },
          {
            key: 'docs:component:base:icon',
            label: '图标（Icon）',
            href: 'packages/icon/page.html',
            meta: { type: 'component', zh: '图标' },
          },
        ],
      },
      {
        key: 'docs:component:display',
        type: 'group',
        label: '数据展示',
        children: [
          {
            key: 'docs:component:display:card',
            label: '卡片（Card）',
            href: 'packages/card/page.html',
            meta: { type: 'component', zh: '卡片' },
          },
          {
            key: 'docs:component:display:tag',
            label: '标签（Tag）',
            href: 'packages/tag/page.html',
            meta: { type: 'component', zh: '标签' },
          },
          {
            key: 'docs:component:display:badge',
            label: '徽标（Badge）',
            href: 'packages/badge/page.html',
            meta: { type: 'component', zh: '徽标' },
          },
          {
            key: 'docs:component:display:avatar',
            label: '头像（Avatar）',
            href: 'packages/avatar/page.html',
            meta: { type: 'component', zh: '头像' },
          },
          {
            key: 'docs:component:display:image',
            label: '图像（Image）',
            href: 'packages/image/page.html',
            meta: { type: 'component', zh: '图像' },
          },
          {
            key: 'docs:component:display:table',
            label: '表格（Table）',
            href: 'packages/table/page.html',
            meta: { type: 'component', zh: '表格' },
          },
          {
            key: 'docs:component:display:code',
            label: '代码（Code）',
            href: 'packages/code/page.html',
            meta: { type: 'component', zh: '代码' },
          },
          {
            key: 'docs:component:display:qrcode',
            label: '二维码（QR Code）',
            href: 'packages/qrcode/page.html',
            meta: { type: 'component', zh: '二维码' },
          },
        ],
      },
      {
        key: 'docs:component:nav',
        type: 'group',
        label: '导航',
        children: [
          {
            key: 'docs:component:nav:menu',
            label: '菜单（Menu）',
            href: 'packages/menu/page.html',
            meta: { type: 'component', zh: '菜单' },
          },
          {
            key: 'docs:component:nav:breadcrumb',
            label: '面包屑（Breadcrumb）',
            href: 'packages/breadcrumb/page.html',
            meta: { type: 'component', zh: '面包屑' },
          },
          {
            key: 'docs:component:nav:tabs',
            label: '标签页（Tabs）',
            href: 'packages/tabs/page.html',
            meta: { type: 'component', zh: '标签页' },
          },
          {
            key: 'docs:component:nav:pagination',
            label: '分页（Pagination）',
            href: 'packages/pagination/page.html',
            meta: { type: 'component', zh: '分页' },
          },
        ],
      },
      {
        key: 'docs:component:form',
        type: 'group',
        label: '表单',
        children: [
          {
            key: 'docs:component:form:input',
            label: '输入框（Input）',
            href: 'packages/input/page.html',
            meta: { type: 'component', zh: '输入框' },
          },
          {
            key: 'docs:component:form:textarea',
            label: '多行输入（Textarea）',
            href: 'packages/textarea/page.html',
            meta: { type: 'component', zh: '多行输入' },
          },
          {
            key: 'docs:component:form:code-editor',
            label: '代码编辑（Code Editor）',
            href: 'packages/code-editor/page.html',
            meta: { type: 'component', zh: '代码编辑' },
          },
          {
            key: 'docs:component:form:checkbox',
            label: '复选框（Checkbox）',
            href: 'packages/checkbox/page.html',
            meta: { type: 'component', zh: '复选框' },
          },
          {
            key: 'docs:component:form:radio',
            label: '单选按钮（Radio）',
            href: 'packages/radio/page.html',
            meta: { type: 'component', zh: '单选按钮' },
          },
          {
            key: 'docs:component:form:switch',
            label: '开关（Switch）',
            href: 'packages/switch/page.html',
            meta: { type: 'component', zh: '开关' },
          },
          {
            key: 'docs:component:form:slider',
            label: '滑动选择（Slider）',
            href: 'packages/slider/page.html',
            meta: { type: 'component', zh: '滑动选择' },
          },
          {
            key: 'docs:component:form:rate',
            label: '评分（Rate）',
            href: 'packages/rate/page.html',
            meta: { type: 'component', zh: '评分' },
          },
          {
            key: 'docs:component:form:tree-select',
            label: '树型选择（Tree Select）',
            href: 'packages/tree-select/page.html',
            meta: { type: 'component', zh: '树型选择' },
          },
          {
            key: 'docs:component:form:select',
            label: '下拉选择（Select）',
            href: 'packages/select/page.html',
            meta: { type: 'component', zh: '下拉选择' },
          },
          {
            key: 'docs:component:form:date-picker',
            label: '日期选择（Date Picker）',
            href: 'packages/date-picker/page.html',
            meta: { type: 'component', zh: '日期选择' },
          },
          {
            key: 'docs:component:form:form',
            label: '表单（Form）',
            href: 'packages/form/page.html',
            meta: { type: 'component', zh: '表单' },
          },
        ],
      },
      {
        key: 'docs:component:feedback',
        type: 'group',
        label: '反馈',
        children: [
          {
            key: 'docs:component:feedback:alert',
            label: '提示条（Alert）',
            href: 'packages/alert/page.html',
            meta: { type: 'component', zh: '提示条' },
          },
          {
            key: 'docs:component:feedback:message',
            label: '消息条（Message）',
            href: 'packages/message/page.html',
            meta: { type: 'component', zh: '消息条' },
          },
          {
            key: 'docs:component:feedback:progress',
            label: '进度条（Progress）',
            href: 'packages/progress/page.html',
            meta: { type: 'component', zh: '进度条' },
          },
          {
            key: 'docs:component:feedback:loading-bar',
            label: '加载条（Loading Bar）',
            href: 'packages/loading-bar/page.html',
            meta: { type: 'component', zh: '加载条' },
          },
          {
            key: 'docs:component:feedback:spinner',
            label: '加载指示（Spinner）',
            href: 'packages/spinner/page.html',
            meta: { type: 'component', zh: '加载指示' },
          },
          {
            key: 'docs:component:feedback:skeleton',
            label: '骨架屏（Skeleton）',
            href: 'packages/skeleton/page.html',
            meta: { type: 'component', zh: '骨架屏' },
          },
          {
            key: 'docs:component:feedback:empty',
            label: '空态（Empty）',
            href: 'packages/empty/page.html',
            meta: { type: 'component', zh: '空态' },
          },
        ],
      },
      {
        key: 'docs:component:overlay',
        type: 'group',
        label: '浮层',
        children: [
          {
            key: 'docs:component:overlay:popover',
            label: '浮层（Popover）',
            href: 'packages/popover/page.html',
            meta: { type: 'component', zh: '浮层' },
          },
          {
            key: 'docs:component:overlay:dialog',
            label: '对话框（Dialog）',
            href: 'packages/dialog/page.html',
            meta: { type: 'component', zh: '对话框' },
          },
          {
            key: 'docs:component:overlay:dropdown',
            label: '下拉菜单（Dropdown）',
            href: 'packages/dropdown/page.html',
            meta: { type: 'component', zh: '下拉菜单' },
          },
          {
            key: 'docs:component:overlay:tooltip',
            label: '提示气泡（Tooltip）',
            href: 'packages/tooltip/page.html',
            meta: { type: 'component', zh: '提示气泡' },
          },
        ],
      },
      {
        key: 'docs:component:layout',
        type: 'group',
        label: '布局',
        children: [
          {
            key: 'docs:component:layout:grid',
            label: '栅格（Grid）',
            href: 'packages/grid/page.html',
            meta: { type: 'component', zh: '栅格' },
          },
          {
            key: 'docs:component:layout:space',
            label: '间距（Space）',
            href: 'packages/space/page.html',
            meta: { type: 'component', zh: '间距' },
          },
          {
            key: 'docs:component:layout:divider',
            label: '分割线（Divider）',
            href: 'packages/divider/page.html',
            meta: { type: 'component', zh: '分割线' },
          },
          {
            key: 'docs:component:layout:collapse',
            label: '折叠面板（Collapse）',
            href: 'packages/collapse/page.html',
            meta: { type: 'component', zh: '折叠面板' },
          },
          {
            key: 'docs:component:layout:scroll-bar',
            label: '滚动条（Scroll Bar）',
            href: 'packages/scroll-bar/page.html',
            meta: { type: 'component', zh: '滚动条' },
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ 结构与查询 */

/**
 * @param {MenuOption} node
 * @returns {node is MenuOption & { children: MenuOption[] }}
 */
const hasChildren = (node) => Array.isArray(node.children);

/**
 * 有没有自己的文档页。**唯一**的实现状态判断：菜单 / 卡片 / 面包屑 / 翻页都用它
 * @param {MenuOption} node
 * @returns {node is MenuOption & { href: string }}
 */
export const hasPage = (node) => typeof node.href === 'string';

/**
 * 组件目录名（`packages/<目录>/page.html` 的第二段）。测试拼套件 / 演示路径要用
 * @param {MenuOption} node 必须是叶子（有页面），分组没有目录名
 * @returns {string}
 */
export const slugOf = (node) => node.href?.split('/')[1] ?? '';

/** 顶栏一级入口 = SITE 的顶层节点（就是数组里的那几条） */
export const TOPBAR = SITE;

/* 子树里第一个有页面的条目（按数组顺序）—— 分区自己没落地页时，顶栏入口落到这里。
 * ⚠️ **不能**把子节点的落地页地址直接抄到分区上：那会造出重复路由，而且顶栏高亮靠 locate() 认「命中了哪一支」，抄了就分不清是分区还是那一页。
 */
/**
 * @param {MenuOption} node
 * @returns {MenuOption | null}
 */
export function firstPageOf(node) {
  if (hasPage(node)) return node;
  for (const child of menuOf(node)) {
    const hit = firstPageOf(child);
    if (hit) return hit;
  }
  return null;
}

/**
 * 左栏要渲染的子节点：就是该分区的 children
 * @param {MenuOption} [entry]
 * @returns {MenuOption[]}
 */
export const menuOf = (entry) => entry?.children ?? [];

/**
 * 按树序走一遍
 * @param {MenuOption[]} nodes
 * @param {(node: MenuOption) => void} visit
 */
function walk(nodes, visit) {
  for (const node of nodes) {
    visit(node);
    if (hasChildren(node)) walk(node.children, visit);
  }
}

/** **工具面**：所有已实现的组件 —— 冒烟套件入口、文档页检查都用它 */
export const READY = (() => {
  /** @type {object[]} */
  const out = [];
  walk(SITE, (node) => {
    if (node.meta?.type === 'component' && hasPage(node))
      out.push({ ...node, ...node.meta, path: node.href });
  });
  return out;
})();

/** **工具面**：搜索索引 —— 全部可导航的页面（站点页 + 组件），按菜单顺序，带分区标签链。
 *  「整个菜单都搜得到」由它保证：与 SITE 同一棵树，所以搜到的集合 = 菜单里点得到的集合。
 *  分区链（如「组件 · 表单」）在结果行里当副标题，用来分清同名 / 同类的落点。 */
export const PAGES = (() => {
  /** @type {object[]} */
  const out = [];
  /** @param {MenuOption[]} nodes @param {string[]} trail */
  const collect = (nodes, trail) => {
    for (const node of nodes) {
      if (node.children) collect(node.children, [...trail, node.label]);
      else if (hasPage(node))
        out.push({ ...node, ...node.meta, path: node.href, section: trail.join(' · ') });
    }
  };
  collect(SITE, []);
  return out;
})();

/** 当前路由落在哪一支：`{ entry, node }` —— 顶栏靠它认「命中了哪一支」 */
/**
 * @param {string} route 仓库根相对路径
 * @returns {{ entry: MenuOption, node: MenuOption } | null}
 */
export function locate(route) {
  for (const entry of SITE) {
    const hit = findIn(entry, route);
    if (hit) return { entry, ...hit };
  }
  return null;
}

/**
 * @param {MenuOption} node
 * @param {string} route
 * @returns {{ node: MenuOption } | null}
 */
function findIn(node, route) {
  if (node.href === route) return { node };
  for (const child of node.children ?? []) {
    const hit = findIn(child, route);
    if (hit) return hit;
  }
  return null;
}
