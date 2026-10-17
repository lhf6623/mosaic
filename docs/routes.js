/*
 * 仓库根相对路径（站内 ID）↔ hash 地址（地址栏）互转。
 * ⚠️ ofa 把 hash 当相对域名根解析，子路径部署要带前缀：JS 用 hashOf()、标记用 olink、比较用 toRepoPath()。
 */

export const SITE_ROOT = new URL('.', document.baseURI).pathname;

/** @param {string} [to] 站内 ID → hash 地址（带部署前缀；前导斜杠可有可无） */
export const hashOf = (to) =>
  `#${SITE_ROOT.replace(/\/$/, '')}/${String(to ?? '').replace(/^\//, '')}`;

/** @param {unknown} value hash 地址 / 站内 ID → 仓库根相对路径（切掉部署前缀；非字符串按空串算） */
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

/** @param {string | URL} url 任意 URL → 仓库根相对路径（页面 src、olink 改写的 href、顶栏高亮都用它） */
export const repoPathOf = (url) => {
  const target = new URL(url, location.href);
  return toRepoPath(decodeURIComponent(target.hash || target.pathname));
};

/** 首页；地址栏没有 hash 时按它算当前路由（与 app-config.js 的 home 同址） */
export const HOME = 'docs/pages/home.html';

export const route = () => toRepoPath(decodeURIComponent(location.hash)) || HOME;
