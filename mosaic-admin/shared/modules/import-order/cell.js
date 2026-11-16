/** 委托单列表 · 行加工：字典码 → 中文标签 / 金额格式化（组件只收字符串，状态标签走 cells HTML 通道） */
import { formatMoney } from '../../format.js';
import { getDict, dictMap } from '../../api/dicts.js';

const tag = (entry, raw) => {
  const label = entry?.label ?? raw ?? '—';
  const color = entry?.color || 'neutral';
  return `<mc-tag color="${color}">${label}</mc-tag>`;
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
      totalMoneyLabel: formatMoney(row.totalMoney),
      cells: {
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
