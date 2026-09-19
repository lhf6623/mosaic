/**
 * 文档站的路由工具。
 *
 * 路由用地址栏 hash 表达，路径相对仓库根 —— 因为 app-config.js 放在根上，
 * 所以 hash 里的路径就是仓库里的路径（`#/docs/pages/guide.html`），
 * 不用在脑子里做一层映射。
 *
 * ⚠️ 这里**没有一级菜单表**：一级菜单是布局页 docs/layout.html 顶栏里的五个
 * `<a olink>` —— 菜单是布局页自己的东西（ofa.js「嵌套页面/路由」）。
 * 加一个一级入口 = 在 docs/layout.html 的顶栏里加一条。
 *
 * 组件文档页（`packages/<slug>/page.html`）也不在这里：它们属于「组件」这一项，
 * 清单由 components.js 的登记表决定（pageOf / OVERVIEW）。
 */

/** 首页。地址栏没有 hash 时按它算当前路由（和 app-config.js 的 home 是同一个地址） */
export const HOME = 'docs/pages/home.html';

/**
 * 当前路由路径（不含开头的 `#/`）。
 *
 * 空 hash 就是首页 —— 首次打开 `index.html` 时 o-app 按 app-config.js 的 `home`
 * 加载首页，但地址栏还没有 hash，这里得给出同一个答案，否则顶栏一项都不亮。
 */
export const route = () => {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  return raw || HOME;
};
