/**
 * 文档站的路由工具。
 *
 * 两个概念要分清：
 *
 *   · **仓库根相对路径**（`docs/pages/guide.html`）—— 站内 ID：登记表、`route()`、
 *     菜单高亮比较统一用它。
 *   · **站内 hash 地址**（`#/docs/pages/guide.html`；子路径部署下是
 *     `#/mosaic/docs/pages/guide.html`）—— 地址栏里的东西。
 *
 * ⚠️ ofa 的路由把 hash 当**相对域名根**的地址解析：`#/packages/x.html` 会去取
 * `/packages/x.html`。开发时服务器就在根上（`/`）看不出问题，但 GitHub Pages 的
 * 项目页在 `/mosaic/` 下 —— 手写的 `#/…` 会 404，菜单高亮也会错位（线上实测过）。
 * 所以：
 *   · JS 里拼链接一律走 `hashOf()`；
 *   · 页面标记里的链接写成 `<a olink href="相对本文件的路径">`，让 ofa 自己带上前缀；
 *   · 需要比较时用 `toRepoPath()` 把两边都归一成仓库根相对路径。
 *
 * 一级菜单不在这里 —— 它是布局页 docs/layout.html 顶栏里的五个 <a olink>（那一侧
 * 也有一份同样的归一化逻辑，页面模块不能 import，只能各写一份）。结构说明见
 * agent/components.md。
 */

/** 站点部署前缀：开发 / 根部署是 `/`，GitHub Pages 项目页是 `/mosaic/` */
export const SITE_ROOT = new URL('.', document.baseURI).pathname;

/** 仓库根相对路径 → 站内 hash 地址 */
export const hashOf = (to) =>
  `#${SITE_ROOT.replace(/\/$/, '')}/${String(to ?? '').replace(/^\//, '')}`;

/** 把 hash 或 pathname 归一成「相对仓库根」的路径（去掉部署前缀） */
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

/** 首页。地址栏没有 hash 时按它算当前路由（和 app-config.js 的 home 是同一个地址） */
export const HOME = 'docs/pages/home.html';

/** 当前路由（仓库根相对路径） */
export const route = () => toRepoPath(decodeURIComponent(location.hash)) || HOME;
