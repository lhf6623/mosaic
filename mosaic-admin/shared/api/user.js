/** 系统用户接口（旧仓 /admin/user/page） */
import { get } from '../http.js';

export const getUserPage = (params) => get('/admin/user/page', params);
