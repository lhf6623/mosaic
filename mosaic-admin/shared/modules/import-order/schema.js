/** 委托单列表 · 页面 schema（真接口：/api/orderImport/page） */
import { PERM } from '../../perm.js';

/* 列宽按「一屏放下主信息 + 操作」定：客户名称不写宽度，吃掉剩余空间，避免横向滚动把操作列挤出屏幕 */
export const importOrderColumns = [
  { key: 'entrustNo', title: '委托单号', width: '130px' },
  { key: 'orderNo', title: '订单编号', width: '130px' },
  { key: 'customerName', title: '客户名称', width: '170px' },
  { key: 'orderStatusLabel', title: '订单状态', width: '88px' },
  { key: 'auditStatusLabel', title: '审核状态', width: '84px' },
  { key: 'receivingStatusLabel', title: '入库状态', width: '84px' },
  { key: 'totalMoneyLabel', title: '金额', width: '104px', align: 'right' },
  { key: 'orderDate', title: '订单日期', width: '96px' },
  { key: 'ops', title: '操作', width: '80px' },
];

export const importOrderPageSchema = {
  indexColumn: { title: '序号', width: '56px' },
  search: [
    { key: 'entrustNo', label: '委托单号', type: 'input' },
    { key: 'customerName', label: '客户名称', type: 'input' },
  ],
  toolbar: [
    {
      action: 'export',
      label: '批量导出',
      variant: 'outline',
      permission: PERM.importExport,
      requiresSelection: true,
    },
    { action: 'clear', label: '清空选择', variant: 'outline', requiresSelection: true },
  ],
  columns: importOrderColumns,
};
