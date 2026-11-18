/** 委托单列表 · 老项目里的前端枚举（后端没有对应字典，只在本地做 code → 文案 + 语义色） */

export const ACCEPT_STATUS = {
  DRAFT: { label: '草稿', color: 'info' },
  WAIT_ACCEPT: { label: '待受理', color: 'warning' },
  ACCEPTED: { label: '已受理', color: 'success' },
  REJECTED: { label: '已拒绝', color: 'danger' },
};

export const CUSTOMS_STATUS = {
  0: { label: '未报关', color: 'info' },
  1: { label: '部分报关', color: 'warning' },
  2: { label: '已报关', color: 'success' },
};

export const DATA_SOURCE = {
  ERP: { label: 'ERP', color: 'primary' },
  ONLINE: { label: 'B2B', color: 'info' },
  MINI_APP: { label: '小程序', color: 'warning' },
  API: { label: 'API接口', color: 'danger' },
};
