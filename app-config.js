/**
 * Mosaic 文档站 — ofa.js 应用配置
 *
 * 放在仓库根是有意的：o-app 的页面地址（含地址栏 hash）都相对本文件所在目录解析，
 * 于是路由路径和仓库结构一一对应（#/packages/button/page.html）。
 */

import loadingBar from './packages/loading-bar/loading-bar.js';

/** 首页。o-app 启动时没有指定页面就加载它 */
export const home = './docs/pages/home.html';

/** 让浏览器的前进按钮可用（后退本来就可以） */
export const allowForward = true;

/* 导航加载条：ofa 在**每次导航开始**时调用下面的 `loading` —— 包括 olink 的 pushState 导航
 * （那条不发 hashchange），所以接线点只能在这里，不能接在 docs/state/route.js 那类「地址变了」的信号上。
 * 视觉交给 mc-loading-bar，不在 `loading` 里手写一条：收尾要「先滑到 100%、再淡出」，
 * 而占位元素在拿到新页面时就被 ofa remove() 掉了，做不到收尾；固定一条的定位 / 层级 / 不吃指针
 * （pointer-events: none）也都是组件已经定好的。 */

/** 慢过这个时长才露条：本地 / 命中缓存时一次导航只有 10~30ms，不压着就会每次点击都闪一下 */
const BAR_AFTER = 150;

/** 还没到点导航就结束了 → 条子根本不出现（loading-bar.js 里「没出现过」的收尾是 no-op）
 * @type {number | undefined} */
let barTimer;

const armBar = () => {
  clearTimeout(barTimer);
  barTimer = setTimeout(() => {
    barTimer = undefined;
    loadingBar.start();
  }, BAR_AFTER);
};

/* 结束信号：router-change 在新页面渲染完之后派发，并冒泡到 document（站点里只有一个 o-app） */
const finishBar = () => {
  clearTimeout(barTimer);
  barTimer = undefined;
  loadingBar.done();
};
document.addEventListener('router-change', finishBar);

/** 加载中的占位。落在 o-app 的 shadow root 里，只能用内联样式（文档级 CSS 进不来） */
export const loading = () => {
  armBar();
  return `
  <div style="padding:3rem 1rem;text-align:center;color:rgb(var(--mc-color-fg-subtle,#7c889a));font-size:.875rem">
    加载中…
  </div>`;
};

/**
 * 加载失败时的兜底。同样只能用内联样式
 * @param {{ src?: string, error?: Error }} info 失败上下文：src = 加载失败的地址，error = 抛出来的那个
 */
export const fail = ({ src, error }) => `
  <div style="margin:2rem 0;padding:1rem 1.25rem;border-left:3px solid rgb(var(--mc-color-danger,#d01723));border-radius:.375rem;background:rgb(var(--mc-color-danger-subtle,#fff2f1));font-size:.875rem">
    <strong>页面加载失败</strong><br />
    <code style="font-size:.8em">${src}</code><br />
    <span style="opacity:.75">${error?.message ?? error ?? ''}</span>
  </div>`;
