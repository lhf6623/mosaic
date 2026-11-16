/**
 * 请求层：唯一出口（页面 / 组件不直接 fetch）。
 *
 * 约定照旧仓 src/api/index.js：
 *   · 请求头 Authorization: Bearer <accessToken> + TENANT-ID / VERSION
 *   · 响应业务码 { code, msg, data }：code === 0 成功，失败抛 ApiError
 *   · 401 / 424 视为登录态失效：清 session 并发 admin-auth-expired（外壳据此跳登录页）
 */
import { API_BASE, API_VERSION, SESSION_KEY, TENANT_ID } from '../config.js';

export class ApiError extends Error {
  /** @param {string} message @param {{ status?: number, code?: number | null, data?: unknown }} [meta] */
  constructor(message, { status = 0, code = null, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** 当前登录态：{ accessToken, refreshToken, username, user } */
export const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
};

export const writeSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('admin-auth-change', { detail: { loggedIn: true } }));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('admin-auth-change', { detail: { loggedIn: false } }));
};

export const hasSession = () => Boolean(readSession()?.accessToken);

/** 查询串：跳过 null / undefined / 空串（空搜索项不带给后端） */
const toQuery = (params) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    query.append(key, String(value));
  }
  const text = query.toString();
  return text ? '?' + text : '';
};

const absoluteUrl = (path, params) => API_BASE.replace(/\/$/, '') + path + toQuery(params);

/** @param {string} path @param {{ method?: string, params?: object, json?: unknown, form?: object, auth?: boolean }} [options] */
export async function request(path, options = {}) {
  const { method = 'GET', params, json, form, auth = true } = options;
  const session = readSession();
  const headers = {
    Accept: 'application/json',
    'TENANT-ID': String(session?.user?.tenantId ?? TENANT_ID),
    VERSION: API_VERSION,
  };
  if (auth && session?.accessToken) headers.Authorization = 'Bearer ' + session.accessToken;

  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json;charset=utf-8';
    body = JSON.stringify(json);
  } else if (form !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    body = new URLSearchParams(form).toString();
  }

  const response = await fetch(absoluteUrl(path, params), { method, headers, body });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (response.status === 401 || response.status === 424) {
    clearSession();
    window.dispatchEvent(new CustomEvent('admin-auth-expired'));
    throw new ApiError(payload?.msg ?? '登录已过期', {
      status: response.status,
      code: payload?.code ?? null,
    });
  }

  if (!response.ok) {
    throw new ApiError(payload?.msg ?? 'HTTP ' + response.status, {
      status: response.status,
      code: payload?.code ?? null,
      data: payload?.data,
    });
  }

  if (payload && typeof payload === 'object' && 'code' in payload) {
    if (payload.code !== 0) {
      throw new ApiError(payload.msg || '接口返回失败', {
        status: response.status,
        code: payload.code,
        data: payload.data,
      });
    }
    return payload.data;
  }
  return payload;
}

export const get = (path, params) => request(path, { params });
export const del = (path, params) => request(path, { method: 'DELETE', params });
export const postJson = (path, json) => request(path, { method: 'POST', json });
