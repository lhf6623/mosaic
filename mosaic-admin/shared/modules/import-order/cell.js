/** 委托单列表 · 行加工：字典码 → 中文标签 / 金额格式化（组件只收字符串，状态标签与链接走 cells HTML 通道） */
import { formatMoney } from '../../format.js';
import { getDict, dictMap } from '../../api/dicts.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const linkStyle =
  'padding:0;border:0;background:none;color:rgb(var(--mc-color-primary));font:inherit;font-weight:600;cursor:pointer;text-decoration:none';
const moneyStyle =
  'font-variant-numeric: tabular-nums; font-weight: 600; color: rgb(var(--mc-color-fg))';

/* 字典的颜色是租户配置的，**保留原色**（同一列不同值 / 不同状态列靠色相区分）；
   浅底文字对比度由 mc-tag 的 hex 通道自动校正，暗色主题也会重算（color-attr 已穿 shadow）。 */
/* 列固定宽后，超长客户名用省略号 + title；不然 nowrap 会把操作列挤出屏幕 */
const truncate = (value, max = 14) => {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max) + '…' : text;
};

const tag = (entry, raw) => {
  const label = entry?.label ?? raw ?? '—';
  const color = entry?.color || 'neutral';
  return `<mc-tag color="${esc(color)}">${esc(label)}</mc-tag>`;
};

/**
 * @param {{ orderStatus: Map<string, {label:string,color:string}>, auditStatus: Map<string, any>, receivingStatus: Map<string, any> }} maps
 */
export const createImportOrderRows = (maps) => (rows) =>
  rows.map((row) => {
    const orderStatus = tag(maps.orderStatus.get(String(row.orderStatus)), row.orderStatus);
    const auditStatus = tag(maps.auditStatus.get(String(row.auditStatus)), row.auditStatus);
    const receivingStatus = tag(
      maps.receivingStatus.get(String(row.receivingStatus)),
      row.receivingStatus,
    );
    return {
      ...row,
      cells: {
        /* 只有「委托单号」是可点入口：可复制、可中键新标签；行单击不再导航，避免误触 */
        customerName:
          '<span title="' +
          esc(row.customerName) +
          '">' +
          esc(truncate(row.customerName)) +
          '</span>',
        entrustNo:
          '<a href="#/pages/import-order/detail.html?id=' +
          encodeURIComponent(row.id) +
          '" style="' +
          linkStyle +
          '">' +
          esc(row.entrustNo) +
          '</a>',
        totalMoneyLabel:
          '<span style="' + moneyStyle + '">' + esc(formatMoney(row.totalMoney)) + '</span>',
        orderStatusLabel: orderStatus,
        auditStatusLabel: auditStatus,
        receivingStatusLabel: receivingStatus,
        ops: '<button type="button" data-action="edit" style="padding:0;border:0;background:none;color:rgb(var(--mc-color-primary));font:inherit;cursor:pointer">编辑</button>',
      },
    };
  });

/** 取本页需要的三本字典并建好「原始行 → 展示行」的映射（页面 init 只调这一下） */
export const loadImportOrderRowMapper = async () => {
  const [order, audit, receiving] = await Promise.all([
    getDict('order_import_process_status'),
    getDict('audit_status'),
    getDict('receiving_status'),
  ]);
  return createImportOrderRows({
    orderStatus: dictMap(order),
    auditStatus: dictMap(audit),
    receivingStatus: dictMap(receiving),
  });
};
