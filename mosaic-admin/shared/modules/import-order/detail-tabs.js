/**
 * 委托单详情的关联 Tab。
 *
 * 旧仓的 Tab 不是写死在页面里的：`createTabsOpitonsByMenuId(route.meta.id)` 调
 * `/admin/menu?type=3&parentId=…` 拿菜单节点（label / permission / componentPath），
 * 再按 componentPath 动态 require 别的模块页面组件挂进来。这里保持同样的数据流：
 *   · 菜单 = 真相源（label / 权限 / 模块归属，运维能配）；
 *   · 本地映射表 `TAB_COMPONENTS` 决定「这个旧组件在 Mosaic 里由谁接」；
 *   · 没映射到的落 placeholder，不假装已实现。
 */
export const RELATED_MENU_ID = '102532'; // 旧仓「中国进口」菜单：其 TABS 子节点 = 详情页的关联 Tab
export const DETAIL_MENU_ID = '102538'; // 「详情」菜单：其 TABS 子节点 = 详情内部的二级 Tab

/** 附件按业务模块存中文 label（旧仓 getFileModuleLabel(ORDER_BIZ_TYPE.ORDER_IMPORT)） */
export const ANNEX_FILE_MODULE = '进口订单';
/** 操作日志的业务类型（ORDER_BIZ_TYPE.ORDER_IMPORT） */
export const OPERATE_TYPE = 'order_import';

/** 旧 componentPath → Mosaic 组件（未登记 = placeholder） */
export const TAB_COMPONENTS = {
  '/business/order/import-order/details': { tag: 'order-tab-details' },
  '/common/annex': { tag: 'order-tab-annex' },
  '/common/opr-records': { tag: 'order-tab-opr' },
  '/business/order/import-order/details-tabs/views/order-details/index': {
    tag: 'order-tab-summary',
  },
};

export const resolveTabComponent = (componentPath) =>
  TAB_COMPONENTS[String(componentPath ?? '').replace(/\\/g, '/')] ?? null;
