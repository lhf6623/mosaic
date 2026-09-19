/**
 * Mosaic 文档站 — ofa.js 应用配置
 *
 * 放在仓库根，而不是 docs/ 下，是有意的：o-app 的页面地址（包括地址栏 hash 里那个）
 * 都相对**本文件所在目录**解析。放在根上，路由路径就和仓库结构一一对应：
 *
 *   #/docs/pages/guide.html
 *   #/packages/button/page.html
 *
 * 页面模块的路径也跟着结构走，不用在脑子里做一层映射。
 */

/** 首页。o-app 启动时没有指定页面就加载它 */
export const home = './docs/pages/home.html';

/** 让浏览器的前进按钮可用（后退本来就可以） */
export const allowForward = true;

/**
 * 加载中的占位。
 *
 * 注意这段 HTML 会落在 o-app 的 shadow root 里，所以只能用内联样式 ——
 * 外部的 shell.css 进不来（文档级 CSS 不进 shadow root，这是整套架构的核心约束）。
 */
export const loading = () => `
  <div style="padding:3rem 1rem;text-align:center;color:rgb(var(--mc-color-fg-subtle,#7c889a));font-size:.875rem">
    加载中…
  </div>`;

/** 加载失败时的兜底。同样只能用内联样式 */
export const fail = ({ src, error }) => `
  <div style="margin:2rem 0;padding:1rem 1.25rem;border-left:3px solid rgb(var(--mc-color-danger,#d01723));border-radius:.375rem;background:rgb(var(--mc-color-danger-subtle,#fff2f1));font-size:.875rem">
    <strong>页面加载失败</strong><br />
    <code style="font-size:.8em">${src}</code><br />
    <span style="opacity:.75">${error?.message ?? error ?? ''}</span>
  </div>`;
