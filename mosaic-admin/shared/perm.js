/**
 * 按钮级权限：权限码的唯一手写源（真实码取自旧仓 constant/modules/permission.js）。
 *
 * 登录成功后 shared/auth.js 用 /admin/user/info 的 permissions 回填；
 * 未登录 / 探针默认 `null` = 全部放行。页面只引用 `PERM.*`（check:app 拦字面量）。
 */
import { GRANTED_PERMISSIONS } from '../config.js';

export const PERM = {
  importView: 'bus_import',
  importAdd: 'bus_import_add',
  importEdit: 'bus_import_edit',
  importExport: 'bus_import_export',
};

/** null = 不限；Set = 用户实际拥有的码 */
let granted =
  GRANTED_PERMISSIONS === null || GRANTED_PERMISSIONS === undefined
    ? null
    : new Set(GRANTED_PERMISSIONS);

export const can = (code) => granted === null || granted.has(code);

/** 登录 / 用户接口回填：null = 不限，数组 = 只放行这些 */
export const setPermissions = (codes) => {
  granted = codes === null || codes === undefined ? null : new Set(codes);
  window.dispatchEvent(new CustomEvent('admin-permissions-change'));
};
