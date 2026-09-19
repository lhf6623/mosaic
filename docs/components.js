/**
 * 组件登记表 —— 全站唯一的组件清单来源。
 *
 * 组件页的二级菜单、总览页、首页的组件区块，全部从这里渲染。
 * 加一个组件 = **这里加一条 + 在 packages/<slug>/ 里写 page.html**，别处不用动。
 *
 * 文档跟着组件走：组件在 packages/<slug>/，它的文档页就是同目录下的 page.html。
 *
 * 字段：
 *   slug      目录名，同时也是文档页的位置（packages/<slug>/page.html）
 *   name      显示名
 *   tag       自定义元素标签
 *   status    'ready' 已实现 | 'planned' 待建
 *   milestone 归属里程碑
 *   desc      一句话说明（总览页与首页用）
 */

export const GROUPS = [
  {
    title: '基础',
    desc: '最常用的展示与操作单元',
    items: [
      {
        slug: 'button',
        name: 'Button',
        tag: 'mc-button',
        status: 'ready',
        milestone: 'M1',
        desc: '按钮。语义色 × 外观样式两个正交维度，6 色 × 3 外观 = 18 种组合。',
      },
      {
        slug: 'icon',
        name: 'Icon',
        tag: 'mc-icon',
        status: 'planned',
        milestone: 'M1',
        desc: '图标。内联 SVG sprite，随 font-size 等比缩放，不用 icons preset（体积代价太高）。',
      },
      {
        slug: 'card',
        name: 'Card',
        tag: 'mc-card',
        status: 'planned',
        milestone: 'M1',
        desc: '卡片容器。有底色 / 只有描边两种，可选可交互抬升。',
      },
      {
        slug: 'badge',
        name: 'Badge',
        tag: 'mc-badge',
        status: 'planned',
        milestone: 'M1',
        desc: '徽标。默认浅底，比实心更不抢视线；支持纯圆点与数值上限。',
      },
      {
        slug: 'spinner',
        name: 'Spinner',
        tag: 'mc-spinner',
        status: 'planned',
        milestone: 'M1',
        desc: '加载指示。跟随当前文字色与字号。',
      },
    ],
  },
  {
    title: '表单',
    desc: '值的读写遵循统一约定：标签属性是初始值，DOM property 是运行时状态',
    items: [
      { slug: 'input', name: 'Input', tag: 'mc-input', status: 'planned', milestone: 'M2', desc: '单行输入框。可清除、前后缀插槽。' },
      { slug: 'textarea', name: 'Textarea', tag: 'mc-textarea', status: 'planned', milestone: 'M2', desc: '多行输入框。支持自动增高与字数统计。' },
      { slug: 'checkbox', name: 'Checkbox', tag: 'mc-checkbox', status: 'planned', milestone: 'M2', desc: '复选框。支持半选态。' },
      { slug: 'radio', name: 'Radio', tag: 'mc-radio', status: 'planned', milestone: 'M2', desc: '单选按钮组。' },
      { slug: 'switch', name: 'Switch', tag: 'mc-switch', status: 'planned', milestone: 'M2', desc: '开关。' },
      { slug: 'select', name: 'Select', tag: 'mc-select', status: 'planned', milestone: 'M2', desc: '下拉选择。M2 里最复杂的一个：浮层定位 + 键盘导航 + 点击外部判定。' },
    ],
  },
  {
    title: '反馈',
    desc: '把状态告诉使用者',
    items: [
      { slug: 'alert', name: 'Alert', tag: 'mc-alert', status: 'planned', milestone: 'M2', desc: '页内提示条。可关闭，带标题与描述。' },
      { slug: 'progress', name: 'Progress', tag: 'mc-progress', status: 'planned', milestone: 'M2', desc: '进度条。支持不确定态。' },
      { slug: 'toast', name: 'Toast', tag: 'toast()', status: 'planned', milestone: 'M2', desc: '命令式消息条，返回 Promise 与 close 句柄。' },
    ],
  },
  {
    title: '浮层',
    desc: '⚠️ 这一批开工前必须先验证图层：宿主页面的 transform / filter 会创建新的层叠上下文，可能把 shadow root 内的浮层困住',
    items: [
      { slug: 'dialog', name: 'Dialog', tag: 'mc-dialog', status: 'planned', milestone: 'M3', desc: '对话框。遮罩、焦点陷阱、Esc 关闭。' },
      { slug: 'dropdown', name: 'Dropdown', tag: 'mc-dropdown', status: 'planned', milestone: 'M3', desc: '下拉菜单。' },
      { slug: 'tooltip', name: 'Tooltip', tag: 'mc-tooltip', status: 'planned', milestone: 'M3', desc: '提示气泡。' },
    ],
  },
  {
    title: '布局',
    desc: '组织内容',
    items: [
      { slug: 'tabs', name: 'Tabs', tag: 'mc-tabs', status: 'planned', milestone: 'M3', desc: '标签页。' },
      { slug: 'table', name: 'Table', tag: 'mc-table', status: 'planned', milestone: 'M3', desc: '数据表格。columns / data 通过 property 传入（对象不能走标签属性）。' },
      { slug: 'grid', name: 'Grid', tag: 'mc-grid', status: 'planned', milestone: 'M3', desc: '栅格。' },
    ],
  },
];

/** 拍平的完整清单，附带所属分组 */
export const ALL = GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.title })),
);

export const READY = ALL.filter((c) => c.status === 'ready');
export const PLANNED = ALL.filter((c) => c.status === 'planned');

/**
 * 组件文档页在仓库里的位置 —— 就在组件自己的目录下。
 *
 * 文件名是 page.html 而不是 index.html：它是 **ofa.js 页面模块**（`<template page>`），
 * 不是可以直接打开的独立网页。路由地址是 `#/packages/<slug>/page.html`。
 */
export const pageOf = (slug) => `packages/${slug}/page.html`;

/** 组件文档页相对站点根的路径（导航用） */
export const urlOf = (slug) => pageOf(slug);

/** 组件总览页（站点级，跨所有组件） */
export const OVERVIEW = 'docs/pages/components.html';
