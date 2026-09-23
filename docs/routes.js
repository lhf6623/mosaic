/*
 * 仓库根相对路径（站内 ID）↔ hash 地址（地址栏）互转。
 * ⚠️ ofa 把 hash 当相对域名根解析，子路径部署要带前缀：JS 用 hashOf()、
 * 标记用 olink、比较用 toRepoPath() / repoPathOf()。
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

/**
 * 任意 URL → 仓库根相对路径。给「手里只有地址」的地方用：
 * 页面模块的 `src`、`olink` 改写过的 `href`（都是绝对 URL，hash 或 pathname 里才是站内 ID）。
 * 布局页顶栏高亮就用它，不用再自己抄一份 pathOf。
 */
export const repoPathOf = (url) => {
  const target = new URL(url, location.href);
  return toRepoPath(decodeURIComponent(target.hash || target.pathname));
};

/** 首页；地址栏没有 hash 时按它算当前路由（与 app-config.js 的 home 同址） */
export const HOME = 'docs/pages/home.html';

export const route = () => toRepoPath(decodeURIComponent(location.hash)) || HOME;
