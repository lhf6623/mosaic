/** 展示层的格式化纯函数：页面 / cell 共用，不碰 DOM、不碰请求。 */

/**
 * 金额 → 人民币展示串（千分位，两位小数）。金额是「分」还是「元」由后端契约定，
 * 探针里先按「元」处理；G2 接真接口时只改这一处。
 * @param {number | string} value
 */
export const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return (
    '¥' + amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
};

/** 空值统一显示为短横线，避免表格里一眼全是空白 */
export const formatText = (value) => {
  const text = String(value ?? '').trim();
  return text === '' ? '—' : text;
};
