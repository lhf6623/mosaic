/** 委托单列表 · 页面 schema（真接口：/api/orderImport/page） */
import { PERM } from '../../perm.js';

export const importOrderColumns = [
  { key: 'entrustNo', title: '委托单号', width: '150px', sortable: true },
  { key: 'orderNo', title: '订单编号', width: '160px' },
  { key: 'customerName', title: '客户名称', width: '220px' },
  { key: 'orderStatusLabel', title: '订单状态', width: '110px' },
  { key: 'auditStatusLabel', title: '审核状态', width: '100px' },
  { key: 'receivingStatusLabel', title: '入库状态', width: '100px' },
  { key: 'totalMoneyLabel', title: '金额', width: '130px', align: 'right', sortable: true },
  { key: 'orderDate', title: '订单日期', width: '110px' },
  { key: 'createByName', title: '创建人', width: '100px' },
  { key: 'ops', title: '操作', width: '90px' },
];

export const importOrderPageSchema = {
  title: '委托单列表',
  hint: '重列表切片（真接口）：/api/orderImport/page，500 行级列表 + 复选 / 排序 / 行内动作 / 分页。',
  search: [
    { key: 'entrustNo', label: '委托单号', type: 'input' },
    { key: 'customerName', label: '客户名称', type: 'input' },
  ],
  toolbar: [
    { action: 'export', label: '批量导出', variant: 'outline', permission: PERM.importExport },
    { action: 'clear', label: '清空选择', variant: 'outline' },
  ],
  columns: importOrderColumns,
};
