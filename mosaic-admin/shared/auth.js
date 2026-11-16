/**
 * 登录 / 登出 / 会话。
 *
 * 登录走旧仓同一套 OAuth2 密码模式：POST /auth/oauth2/token?grant_type=password
 *   · Authorization: Basic base64(client)（不携带 token）
 *   · 密码用 AES-CFB（key = PWD_ENC_KEY，iv = key）加密后提交 —— 与旧仓 utils/aes.js 一致
 * 登录成功后拉 /admin/user/info，把 tenantId / permissions 回填会话与 shared/perm。
 */
import { API_BASE, API_VERSION, AUTH_CLIENT, PWD_ENC_KEY, TENANT_ID } from '../config.js';
import { clearSession, get, hasSession, readSession, writeSession } from './http.js';
import { setPermissions } from './perm.js';

const LOGIN_PATH = '/auth/oauth2/token';

/** 密码加密：AES-CFB / NoPadding / iv = key（Latin1），产出 base64 —— 照旧仓 utils/aes.js */
export const encryptPassword = (password) => {
  const CryptoJS = window.CryptoJS;
  if (!CryptoJS) throw new Error('CryptoJS 未加载（index.html 的 vendor/lib 脚本缺失）');
  const key = CryptoJS.enc.Latin1.parse(PWD_ENC_KEY);
  return CryptoJS.AES.encrypt(password, key, {
    iv: key,
    mode: CryptoJS.mode.CFB,
    padding: CryptoJS.pad.NoPadding,
  }).toString();
};

/**
 * 登录：成功后写会话（含用户信息与权限），失败抛错（message 直接用后端 msg）
 * @param {string} username @param {string} password
 */
export async function login(username, password) {
  const response = await fetch(API_BASE.replace(/\/$/, '') + LOGIN_PATH + '?grant_type=password', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(AUTH_CLIENT),
      'TENANT-ID': String(TENANT_ID),
      VERSION: API_VERSION,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({
      username: String(username).trim(),
      password: encryptPassword(password),
    }).toString(),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.msg || payload?.data || '登录失败（' + response.status + '）');
  }

  writeSession({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    username: String(username).trim(),
  });

  /* 用户信息失败不阻断登录：页面会以「无权限」呈现，下一次请求 401 会引导重登 */
  try {
    const user = await get('/admin/user/info');
    writeSession({ ...readSession(), user });
    setPermissions(Array.isArray(user?.permissions) ? user.permissions : null);
  } catch {
    setPermissions([]);
  }
  return readSession();
}

/** 退出：清本地会话（服务端 logout 接口可选，探针不做） */
export const logout = () => {
  clearSession();
  setPermissions(null);
};

export const currentUser = () => readSession()?.user ?? null;
export const isLoggedIn = () => hasSession();
