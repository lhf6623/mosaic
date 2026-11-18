/** 用户列表 · 行加工：sex 字典码 → 中文；用户名是唯一「查看详情」入口（行单击不触发）。 */
const linkStyle =
  'padding:0;border:0;background:none;color:rgb(var(--mc-color-primary));font:inherit;cursor:pointer;text-decoration:none;font-weight:600';

export const userGridRows = (rows, sexMap) =>
  rows.map((row) => ({
    ...row,
    sexLabel: sexMap?.get(String(row.sex))?.label ?? row.sex ?? '—',
    cells: {
      username:
        '<button type="button" data-action="detail" style="' +
        linkStyle +
        '">' +
        String(row.username ?? '') +
        '</button>',
    },
  }));
