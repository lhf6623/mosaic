/** 菜单：页面页签配置（旧仓 type=3 = TABS；详情/表单页下的关联 Tab 就是这些菜单节点） */
import { get } from '../http.js';

export const getUserTabs = async (parentId) => {
  const list = await get('/admin/menu', { type: '3', parentId });
  return Array.isArray(list) ? list : [];
};
