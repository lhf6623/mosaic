/** 委托单列表 · 页面 schema（真接口：/api/orderImport/page）
 *  列顺序对齐老仓 acceptance-center/import-order 的 columns（31 列）；列多后由网格内部横向滚动。 */
import { PERM } from '../../perm.js';

export const importOrderColumns = [
  { key: 'acceptStatusLabel', title: '受理状态', width: '96px' },
  { key: 'customerName', title: '客户名称', width: '170px' },
  { key: 'entrustNo', title: '委托单号', width: '130px' },
  { key: 'orderNo', title: '订单编号', width: '130px' },
  { key: 'orderStatusLabel', title: '订单状态', width: '92px' },
  { key: 'auditStatusLabel', title: '审核状态', width: '88px' },
  { key: 'receivingStatusLabel', title: '入库状态', width: '88px' },
  { key: 'customsStatusLabel', title: '报关状态', width: '88px' },
  { key: 'shippingStatusLabel', title: '出库状态', width: '88px' },
  { key: 'tradeModeLabel', title: '业务模式', width: '100px' },
  { key: 'orderDate', title: '订单日期', width: '96px' },
  { key: 'customerContractNo', title: '客户合同号', width: '140px' },
  { key: 'cusContractNo', title: '客户协议', width: '150px' },
  { key: 'supplierName', title: '供应商名称', width: '160px' },
  { key: 'thirdPartyFinancingLabel', title: '是否三方融资', width: '96px' },
  { key: 'financeCustomerName', title: '销方客户', width: '150px' },
  { key: 'principalName', title: '签约主体', width: '160px' },
  { key: 'currencyName', title: '报关币别', width: '80px' },
  {
    key: 'totalMoneyLabel',
    title: '报关总价',
    width: '110px',
    align: 'right',
    sum: { field: 'totalMoney', format: 'money' },
  },
  { key: 'cargoSettleStatusLabel', title: '货款结算', width: '88px' },
  { key: 'taxSettleStatusLabel', title: '税费结算', width: '88px' },
  { key: 'makeInvoiceStatusLabel', title: '开票状态', width: '88px' },
  { key: 'receiveInvoiceStatusLabel', title: '收票状态', width: '88px' },
  { key: 'declareTitleLabel', title: '抬头方式', width: '100px' },
  { key: 'incoterms', title: '成交方式', width: '90px' },
  { key: 'packageType', title: '包装类型', width: '140px' },
  { key: 'tradeManName', title: '商务名称', width: '90px' },
  { key: 'remark', title: '备注', width: '150px' },
  { key: 'dataSourceLabel', title: '数据来源', width: '90px' },
  { key: 'createByName', title: '创建人名称', width: '90px' },
  { key: 'createTime', title: '创建时间', width: '150px' },
  { key: 'ops', title: '操作', width: '80px', fixed: 'right' },
];

export const importOrderPageSchema = {
  /* 编辑保存后广播 admin-data-changed(module:'import-order') → erp-page 自动重载 */
  reloadOn: 'import-order',
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
