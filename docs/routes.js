export const SITE_ROOT = new URL('.', document.baseURI).pathname;

/** @param {string} [to] */
export const goto = (to) => {
  const url = new URL(String(to ?? '').replace(/^\//, ''), document.baseURI).href;
  $('o-app')?.goto(url);
};

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

export const HOME = 'docs/pages/home.html';

export const route = () => toRepoPath(decodeURIComponent(location.hash)) || HOME;
