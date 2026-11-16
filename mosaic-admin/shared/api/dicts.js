/** 字典：按 type 取（旧仓 /admin/dict/type/{type}），带内存缓存 */
import { get } from '../http.js';

const cache = new Map();

export const getDict = async (type) => {
  if (cache.has(type)) return cache.get(type);
  const list = await get('/admin/dict/type/' + encodeURIComponent(type));
  const items = Array.isArray(list) ? list : [];
  if (items.length) cache.set(type, items);
  return items;
};

/** 字典数组 → { 值: {label,color} } 查询表（cell 里按值取中文） */
export const dictMap = (list) =>
  new Map(
    (list ?? []).map((item) => [String(item.value), { label: item.label, color: item.color }]),
  );
