/* 站点唯一数据源：**有哪些页面 / 组件**、它们的层级与顺序 —— 也就是导航本身。一棵树，**结构即菜单**：children 的层级就是左栏的分组与缩进，label 就是显示名。
 * 有 children → 分组 / 分区；有 path → 有页面、可点；没有 path → 待建。分区自己可以没有落地页，顶栏入口落到子树第一页（firstPageOf）；order 同层唯一、显示顺序由它说了算，hidden 只管展示、子树上继承。
 * 字段：label 显示名 / zh 中文名（只有组件补）/ order / path / children / hidden / summary / type ——
 * type 只写在叶子上：`component`（组件单元）/ `page`（站点页）；分组看 children，「已实现 / 待建」看有没有 path。
 * ⚠️ 页内目录（h2/h3）**不在这里**：它是内容派生的、每页都不同，由 <doc-toc> 扫标题生成。
 */

export const SITE = [
  { order: 10, type: 'page', label: '首页', path: 'docs/pages/home.html' },
  {
    order: 20,
    label: '文档',
    children: [
      {
        order: 10,
        label: '介绍',
        children: [
          {
            order: 10,
            type: 'page',
            label: 'Mosaic UI',
            path: 'docs/pages/intro.html',
            summary: '这个库是什么、用什么写的、有多少组件。',
          },
        ],
      },
      {
        order: 20,
        label: '快速上手',
        children: [
          {
            order: 10,
            type: 'page',
            label: '安装',
            path: 'docs/pages/install.html',
            summary: '不需要 npm 与打包器：最小用法、引组件的方式、自托管与大陆访问。',
          },
          {
            order: 20,
            type: 'page',
            label: '支持的平台',
            path: 'docs/pages/platforms.html',
            summary: '取决于浏览器有没有那几样原生能力：ES module、自定义元素、popover、锚点定位。',
          },
          {
            order: 30,
            type: 'page',
            label: '常见问题',
            path: 'docs/pages/faq.html',
            summary: '组件没渲染、改了没生效、有结构没样式、工具类不生效这类「装上了却没效果」。',
          },
        ],
      },
      {
        order: 30,
        label: '指南',
        children: [
          {
            order: 10,
            type: 'page',
            label: '调整主题',
            path: 'docs/pages/theme.html',
            summary: '亮色 / 暗色两态，以及覆盖令牌换肤。',
          },
          {
            order: 20,
            type: 'page',
            label: '单个组件主题适配',
            path: 'docs/pages/component-theme.html',
            summary: '只给某一块换色：color 属性、实例上覆盖令牌、data-tone 子树。',
          },
          {
            order: 30,
            type: 'page',
            label: '样式冲突',
            path: 'docs/pages/style-conflicts.html',
            summary: '组件样式不外溢，以及怎么反过来盖掉库的默认样式。',
          },
        ],
      },
    ],
  },
  {
    order: 30,
    label: '组件',
    children: [
      {
        order: 10,
        label: '基础',
        summary: '最常用的展示与操作单元',
        children: [
          {
            order: 5,
            type: 'page',
            label: '色彩',
            path: 'packages/color/page.html',
            summary:
              '色彩与设计令牌：色板由 OKLCH 生成（6 色族 × 11 档），语义令牌每族只留一档，构建期强制跑 WCAG 对比度自检。',
          },
          {
            order: 10,
            label: 'Button',
            zh: '按钮',
            path: 'packages/button/page.html',
            type: 'component',
            summary:
              '按钮。语义色 × 外观样式两个正交维度，6 色 × 3 外观 = 18 种组合；另有行内文字形态（inline）。',
          },
          {
            order: 20,
            label: 'Code',
            zh: '代码',
            path: 'packages/code/page.html',
            type: 'component',
            summary:
              '代码展示。配色用 highlight.js 官方主题、按需懒加载，失败即降级为纯文本；行号 / 折行 / 限高滚动开箱可用。',
          },
          {
            order: 30,
            label: 'Icon',
            zh: '图标',
            path: 'packages/icon/page.html',
            type: 'component',
            summary:
              '图标。先查内置、查不到再远程取一次；颜色继承 currentColor、尺寸跟随 font-size，取不到也只留一个不跳版的空位。',
          },
          {
            order: 40,
            label: 'Card',
            zh: '卡片',
            path: 'packages/card/page.html',
            type: 'component',
            summary:
              '卡片容器。有底色 / 只有描边两种，头尾结构 + 内边距档位；不做交互，可点的是你写在卡内那个元素。',
          },
          {
            order: 45,
            label: 'Tag',
            zh: '标签',
            path: 'packages/tag/page.html',
            type: 'component',
            summary:
              '分类 / 状态标签。语义色 × 浅底 / 实心 / 描边三个维度，可选可关（checkable / closable）。',
          },
          {
            order: 50,
            label: 'Badge',
            zh: '徽标',
            path: 'packages/badge/page.html',
            type: 'component',
            summary: '徽标。默认浅底，比实心更不抢视线；支持纯圆点与数值上限。',
          },
          {
            order: 60,
            label: 'Spinner',
            zh: '加载指示',
            path: 'packages/spinner/page.html',
            type: 'component',
            summary: '加载指示。跟随当前文字色与字号。',
          },
          {
            order: 70,
            label: 'Menu',
            zh: '菜单',
            path: 'packages/menu/page.html',
            type: 'component',
            summary:
              '数据驱动的垂直菜单：给 options 传对象数组，分组 / 图标 / 层级缩进 / 二级菜单都由容器渲染；可压缩成图标栏（子菜单浮层弹出），也可以开手风琴。',
          },
          {
            order: 80,
            label: 'Breadcrumb',
            zh: '面包屑',
            path: 'packages/breadcrumb/page.html',
            type: 'component',
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
            zh: '输入框',
            path: 'packages/input/page.html',
            type: 'component',
            summary: '单行输入框。可清除、前后缀插槽。',
          },
          {
            order: 20,
            label: 'Textarea',
            zh: '多行输入',
            path: 'packages/textarea/page.html',
            type: 'component',
            summary: '多行输入框。支持自动增高与字数统计。',
          },
          {
            order: 30,
            label: 'Checkbox',
            zh: '复选框',
            path: 'packages/checkbox/page.html',
            type: 'component',
            summary: '复选框。支持半选态。',
          },
          {
            order: 40,
            label: 'Radio',
            zh: '单选按钮',
            path: 'packages/radio/page.html',
            type: 'component',
            summary: '单选按钮组。',
          },
          {
            order: 50,
            label: 'Switch',
            zh: '开关',
            path: 'packages/switch/page.html',
            type: 'component',
            summary: '开关。',
          },
          {
            order: 60,
            label: 'Select',
            zh: '下拉选择',
            path: 'packages/select/page.html',
            type: 'component',
            summary: '下拉选择。最复杂的一个：浮层定位 + 键盘导航 + 点击外部判定。',
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
            zh: '提示条',
            path: 'packages/alert/page.html',
            type: 'component',
            summary: '页内提示条。可关闭，带标题与描述。',
          },
          {
            order: 20,
            label: 'Progress',
            zh: '进度条',
            path: 'packages/progress/page.html',
            type: 'component',
            summary: '进度条。支持不确定态。',
          },
          {
            order: 30,
            label: 'Message',
            zh: '消息条',
            path: 'packages/message/page.html',
            // 命令式：入口是 message() 这个函数，容器标签由模块自己创建，使用者不用写标签
            type: 'component',
            summary: '命令式消息条：从顶部落下来一条，几秒后自己走；同 key 更新不叠加。',
          },
          {
            order: 40,
            label: 'Loading Bar',
            zh: '加载条',
            path: 'packages/loading-bar/page.html',
            type: 'component',
            summary:
              '加载条。state 一个入口（idle / loading / done / error）：在跑就缓慢爬升（到不了 100%），收尾先滑到 100% 再淡出，成功与出错同一条路、只差色；默认钉在视口顶部，也可放进容器；不吃指针。',
          },
        ],
      },
      {
        order: 40,
        label: '浮层',
        summary:
          '浮层：图层问题已验完 —— 用原生 popover（top layer）+ CSS 锚点定位，不挂 body、不用 z-index',
        children: [
          {
            order: 5,
            label: 'Popover',
            zh: '浮层',
            path: 'packages/popover/page.html',
            type: 'component',
            summary: '通用浮层：锚在触发元素上，原生 popover + CSS 锚点定位，贴边自动翻转。',
          },
          {
            order: 10,
            label: 'Dialog',
            zh: '对话框',
            path: 'packages/dialog/page.html',
            type: 'component',
            summary: '对话框。遮罩、焦点陷阱、Esc 关闭。',
          },
          {
            order: 20,
            label: 'Dropdown',
            zh: '下拉菜单',
            path: 'packages/dropdown/page.html',
            type: 'component',
            summary: '下拉菜单。',
          },
          {
            order: 30,
            label: 'Tooltip',
            zh: '提示气泡',
            path: 'packages/tooltip/page.html',
            type: 'component',
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
            zh: '折叠面板',
            path: 'packages/collapse/page.html',
            type: 'component',
            summary:
              '折叠面板。容器 + 子项，可选互斥；开合语义直接交给原生 details/summary，键盘不用自己写。',
          },
          {
            order: 20,
            label: 'Tabs',
            zh: '标签页',
            path: 'packages/tabs/page.html',
            type: 'component',
            summary: '标签页。',
          },
          {
            order: 30,
            label: 'Table',
            zh: '表格',
            path: 'packages/table/page.html',
            type: 'component',
            summary: '数据表格。columns / data 通过 property 传入（对象不能走标签属性）。',
          },
          {
            order: 40,
            label: 'Grid',
            zh: '栅格',
            path: 'packages/grid/page.html',
            type: 'component',
            summary: '栅格。',
          },
          {
            order: 45,
            label: 'Pagination',
            zh: '分页',
            path: 'packages/pagination/page.html',
            type: 'component',
            summary:
              '分页。给总条数与每页条数，渲染页码条；页数多了折叠成省略号，可选「跳至 __ 页」输入跳转与「每页 __ 条」选择器，翻页发 change。',
          },
          {
            order: 50,
            label: 'Scroll Bar',
            zh: '滚动条',
            path: 'packages/scroll-bar/page.html',
            type: 'component',
            summary:
              '滚动条。自带覆盖式滚动条（跟着主题走），滚动本身仍是原生的：键盘、触屏惯性、锚点都照旧。',
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
export const SPEC_URL = 'https://github.com/lhf6623/mosaic/blob/main/packages/README.md';

/** 顶栏一级入口。顶层没有祖先，所以这里的 hidden 不需要继承 */
export const TOPBAR = NAV.filter((entry) => entry.hidden !== true);

/* 子树里第一个有页面的条目（按左栏顺序，跳过 hidden）—— 分区自己没落地页时，顶栏入口落到这里。
 * ⚠️ **不能**把子节点的 path 直接抄到分区上：那会造出重复路由（10 号套件明令禁止），而且顶栏高亮靠 locate() 认「命中了哪一支」，抄了就分不清是分区还是那一页。
 */
export function firstPageOf(node) {
  if (hasPage(node)) return node;
  for (const child of menuOf(node)) {
    const hit = firstPageOf(child);
    if (hit) return hit;
  }
  return null;
}

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

/** 按树序走一遍（含 hidden） */
function walk(nodes, visit) {
  for (const node of nodes) {
    visit(node);
    if (hasChildren(node)) walk(node.children, visit);
  }
}

/** **工具面**：所有已实现的组件（含 hidden）—— 冒烟套件入口、文档页检查都用它 */
export const READY = (() => {
  const out = [];
  walk(NAV, (node) => {
    if (node.type === 'component' && hasPage(node)) out.push(node);
  });
  return out;
})();

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
