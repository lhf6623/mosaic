/** 用户列表 · 搜索条件 → 接口参数（旧仓分页参数是 current / size，不是 page） */
export const userQuery = (values = {}, page = 1, size = 20) => ({
  current: page,
  size,
  username: String(values.username ?? '').trim(),
  name: String(values.name ?? '').trim(),
});
