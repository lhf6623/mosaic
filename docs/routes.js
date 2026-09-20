/**
 * 文档站的路由工具：把地址栏 hash 归一成「相对仓库根的页面路径」。
 *
 * 一级菜单不在这里 —— 它是布局页 docs/layout.html 顶栏里的五个 <a olink>；
 * 组件文档页的路径由 components.js 的 pageOf / OVERVIEW 决定。
 * 结构说明见 agent/components.md。
 */

/** 首页。地址栏没有 hash 时按它算当前路由（和 app-config.js 的 home 是同一个地址） */
export const HOME = 'docs/pages/home.html';

export const route = () => {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  return raw || HOME;
};
