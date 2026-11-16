/** 委托单列表 · 搜索条件 → 接口参数（分页用 current / size；列表固定带 acceptStatus=ACCEPTED） */
export const importOrderQuery = (values = {}, page = 1, size = 20) => ({
  current: page,
  size,
  acceptStatus: 'ACCEPTED',
  entrustNo: String(values.entrustNo ?? '').trim(),
  customerName: String(values.customerName ?? '').trim(),
});
/** 页脚文案：已选 / 总数 / 最近操作（页面只接线，文案格式留在这里） */
export const importOrderFooter = ({ selected = [], total = 0, lastAction = '' } = {}) =>
  '已选 ' + selected.length + ' / ' + total + ' 条 · ' + lastAction;
