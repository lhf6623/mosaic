/*
 * 仓库根相对路径（站内 ID）↔ hash 地址（地址栏）互转。
 * ⚠️ ofa 把 hash 当相对域名根解析，子路径部署要带前缀：JS 用 hashOf()、
 * 标记用 olink、比较用 toRepoPath()。顶栏另有一份（页面模块不能 import）。
 */

export const SITE_ROOT = new URL('.', document.baseURI).pathname;

export const hashOf = (to) =>
  `#${SITE_ROOT.replace(/\/$/, '')}/${String(to ?? '').replace(/^\//, '')}`;

export const toRepoPath = (value) => {
  const raw = String(value ?? '')
    .replace(/^#\/?/, '')
    .replace(/^\//, '');
  const prefix = SITE_ROOT.replace(/^\/|\/$/g, '');
  if (prefix && (raw === prefix || raw.startsWith(`${prefix}/`))) {
    return raw.slice(prefix.length).replace(/^\//, '');
  }
  return raw;
};

/** 首页；地址栏没有 hash 时按它算当前路由（与 app-config.js 的 home 同址） */
export const HOME = 'docs/pages/home.html';

export const route = () => toRepoPath(decodeURIComponent(location.hash)) || HOME;
