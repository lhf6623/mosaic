/**
 * 外部脚本注入到页面上的全局 —— 仓库里没有它们的类型包（ofa.js 由 CDN 引入，不是 npm 依赖）。
 * 这份只做声明：不参与运行时、不进任何产物，只给 `tsc --checkJs` 检查 JS 时用（见 tsconfig.json）。
 */

declare global {
  /**
   * ofa.js 的全局 `$`：`$('mc-message')` 按选择器取实例，`$(el)` 把元素换成实例，
   * `$.stanz({...})` 造响应式对象。前者形状只有 ofa 知道，所以回调返回 any；
   * 类型检查在这里守住的是「拼错名字 / 把 $ 当别的用」。
   */
  const $: {
    (target: string | Element): any;
    stanz: <T extends object>(value: T) => T;
  };
}

export {};
