/*
 * 仓库根相对路径（站内 ID）↔ hash 地址（地址栏）互转。
 * ⚠️ ofa 把 hash 当相对域名根解析，子路径部署要带前缀：JS 用 hashOf()、标记用 olink、比较用 toRepoPath()。
 */

export const SITE_ROOT = new URL('.', document.baseURI).pathname;

/**
 * 站内 ID → hash 地址（带上部署前缀）
 * @param {string} [to] 仓库根相对路径，前导斜杠可有可无
 * @returns {string}
 */
export const hashOf = (to) =>
  `#${SITE_ROOT.replace(/\/$/, '')}/${String(to ?? '').replace(/^\//, '')}`;

/**
 * hash 地址 / 站内 ID → 仓库根相对路径（把部署前缀切掉）
 * @param {unknown} value 地址或 ID，什么都收 —— 不是字符串就按空串算
 * @returns {string}
 */
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

/* 任意 URL → 仓库根相对路径。给「手里只有地址」的地方用：页面模块的 `src`、`olink` 改写过的 `href`。
 * 布局页顶栏高亮就用它，不用再自己抄一份 pathOf。 */
/**
 * @param {string | URL} url 任意地址（相对 / 绝对 / 只有 hash 都行）
 * @returns {string} 仓库根相对路径
 */
export const repoPathOf = (url) => {
  const target = new URL(url, location.href);
  return toRepoPath(decodeURIComponent(target.hash || target.pathname));
};

/** 首页；地址栏没有 hash 时按它算当前路由（与 app-config.js 的 home 同址） */
export const HOME = 'docs/pages/home.html';

export const route = () => toRepoPath(decodeURIComponent(location.hash)) || HOME;
