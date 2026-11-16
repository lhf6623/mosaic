/** 用户列表 · 行加工：sex 字典码 → 中文（组件只收字符串） */
export const userGridRows = (rows, sexMap) =>
  rows.map((row) => ({
    ...row,
    sexLabel: sexMap?.get(String(row.sex))?.label ?? row.sex ?? '—',
  }));
