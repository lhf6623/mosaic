/** 委托单列表 · 行加工：字典码 → 中文标签 / 金额格式化 / 长文本省略
 *  列对齐老仓 acceptance-center/import-order；组件只收字符串，标签与链接走 cells HTML 通道。 */
import { formatMoney } from '../../format.js';
import { getDict, dictMap } from '../../api/dicts.js';
import { ACCEPT_STATUS, CUSTOMS_STATUS, DATA_SOURCE } from './enums.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const linkStyle =
  'padding:0;border:0;background:none;color:rgb(var(--mc-color-primary));font:inherit;font-weight:500;cursor:pointer;text-decoration:none';
const moneyStyle =
  'font-variant-numeric: tabular-nums; font-weight: 600; color: rgb(var(--mc-color-fg))';

/* 长文本列：交给库组件 mc-ellipsis（单行省略 + 可选中/复制浮层），不再自己截断 */
const text = (value) =>
  value ? '<mc-ellipsis>' + esc(value) + '</mc-ellipsis>' : '<span>—</span>';

/* 状态用库组件的 dot 变体（色点 + 文字） */
const tag = (entry, raw) => {
  const label = entry?.label ?? raw ?? '—';
  const color = entry?.color || 'neutral';
  return `<mc-tag variant="dot" color="${esc(color)}">${esc(label)}</mc-tag>`;
};

const enumTag = (table, raw) => tag(table[String(raw)], raw);

const dictLabel = (map, raw) => map.get(String(raw))?.label ?? raw ?? '—';

export const createImportOrderRows = (maps) => (rows) =>
  rows.map((row) => {
    const tagDict = (name, raw) => tag(maps[name].get(String(raw)), raw);
    return {
      ...row,
      cells: {
        /* 只有「委托单号」是可点入口：可复制、可中键新标签；行单击不导航 */
        customerName: text(row.customerName),
        entrustNo:
          '<a href="#/pages/import-order/detail.html?id=' +
          encodeURIComponent(row.id) +
          '" style="' +
          linkStyle +
          '">' +
          esc(row.entrustNo) +
          '</a>',
        acceptStatusLabel: enumTag(ACCEPT_STATUS, row.acceptStatus),
        orderStatusLabel: tagDict('orderStatus', row.orderStatus),
        auditStatusLabel: tagDict('auditStatus', row.auditStatus),
        receivingStatusLabel: tagDict('receivingStatus', row.receivingStatus),
        customsStatusLabel: enumTag(CUSTOMS_STATUS, row.customsStatus),
        shippingStatusLabel: tagDict('shippingStatus', row.shippingStatus),
        tradeModeLabel: dictLabel(maps.tradeMode, row.tradeMode),
        customerContractNo: text(row.customerContractNo),
        cusContractNo: text(row.cusContractNo),
        supplierName: text(row.supplierName),
        thirdPartyFinancingLabel: dictLabel(maps.whether, row.thirdPartyFinancing),
        financeCustomerName: text(row.financeCustomerName),
        principalName: text(row.principalName),
        totalMoneyLabel:
          '<span style="' + moneyStyle + '">' + esc(formatMoney(row.totalMoney)) + '</span>',
        cargoSettleStatusLabel: tagDict('settleStatus', row.cargoSettleStatus),
        taxSettleStatusLabel: tagDict('settleStatus', row.taxSettleStatus),
        makeInvoiceStatusLabel: tagDict('makeInvoiceStatus', row.makeInvoiceStatus),
        receiveInvoiceStatusLabel: tagDict('receiveInvoiceStatus', row.receiveInvoiceStatus),
        declareTitleLabel: dictLabel(maps.declareTitle, row.declareTitle),
        packageType: text(row.packageType),
        remark: text(row.remark),
        dataSourceLabel: enumTag(DATA_SOURCE, row.dataSource),
        ops: '<button type="button" data-action="edit" style="padding:0;border:0;background:none;color:rgb(var(--mc-color-primary));font:inherit;cursor:pointer">编辑</button>',
      },
    };
  });

/** 取本页需要的字典并建好「原始行 → 展示行」的映射（页面 init 只调这一下）
 *  某本字典拿不到时退化为空表：列还显示原始码，不影响整页 */
const safeDict = (type) => getDict(type).catch(() => []);

export const loadImportOrderRowMapper = async () => {
  const [
    order,
    audit,
    receiving,
    shipping,
    tradeMode,
    whether,
    settle,
    makeInvoice,
    receiveInvoice,
    declareTitle,
  ] = await Promise.all([
    safeDict('order_import_process_status'),
    safeDict('audit_status'),
    safeDict('receiving_status'),
    safeDict('ware_shipping_status'),
    safeDict('trade_model'),
    safeDict('whether'),
    safeDict('settle_status'),
    safeDict('order_make_invoice_status'),
    safeDict('order_receive_invoice_status'),
    safeDict('declare_title'),
  ]);
  return createImportOrderRows({
    orderStatus: dictMap(order),
    auditStatus: dictMap(audit),
    receivingStatus: dictMap(receiving),
    shippingStatus: dictMap(shipping),
    tradeMode: dictMap(tradeMode),
    whether: dictMap(whether),
    settleStatus: dictMap(settle),
    makeInvoiceStatus: dictMap(makeInvoice),
    receiveInvoiceStatus: dictMap(receiveInvoice),
    declareTitle: dictMap(declareTitle),
  });
};
