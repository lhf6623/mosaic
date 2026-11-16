/** spike A 的数据与 cell：cell 是**函数**（住在模块作用域，不进 ofa 的 data / property 通道） */
export const COLUMNS = [
  { key: 'no', title: '编号', cell: (row) => `<span class="c-no">${row.no}</span>` },
  {
    key: 'customer',
    title: '客户',
    cell: (row) => `<span class="c-customer">${row.customer}</span>`,
  },
  {
    key: 'status',
    title: '状态',
    cell: (row) => `<span class="c-status" data-status="${row.status}">${row.status}</span>`,
  },
  {
    key: 'amount',
    title: '金额',
    cell: (row) => `<span class="c-money">${row.amount.toFixed(2)}</span>`,
  },
  { key: 'owner', title: '负责人', cell: (row) => `<span class="c-owner">${row.owner}</span>` },
  { key: 'date', title: '日期', cell: (row) => `<span class="c-date">${row.date}</span>` },
];

const CUSTOMERS = ['华东金属', '远洋物流', '中盛建材', '恒信电子'];
const OWNERS = ['陈立', '周敏', '李航', '王岚'];
const STATUSES = ['待处理', '处理中', '已解除'];

export const makeRows = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    no: `RSK-${String(index + 1).padStart(4, '0')}`,
    customer: CUSTOMERS[index % CUSTOMERS.length],
    status: STATUSES[index % STATUSES.length],
    amount: 1000 + index * 13.25,
    owner: OWNERS[index % OWNERS.length],
    date: `2026-11-${String((index % 28) + 1).padStart(2, '0')}`,
  }));
