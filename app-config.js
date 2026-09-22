/**
 * Mosaic 文档站 — ofa.js 应用配置
 *
 * 放在仓库根是有意的：o-app 的页面地址（含地址栏 hash）都相对本文件所在目录解析，
 * 于是路由路径和仓库结构一一对应（#/packages/button/page.html）。
 */

/** 首页。o-app 启动时没有指定页面就加载它 */
export const home = './docs/pages/home.html';

/** 让浏览器的前进按钮可用（后退本来就可以） */
export const allowForward = true;

/** 加载中的占位。落在 o-app 的 shadow root 里，只能用内联样式（文档级 CSS 进不来） */
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
