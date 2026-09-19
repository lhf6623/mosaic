/**
 * 首帧主题引导 —— 必须是 head 内的**同步经典脚本**（不能用 module）。
 *
 * 为什么要单独一个文件：ES module 天生 defer，会在首帧渲染之后才执行，
 * 于是页面会先按亮色画一遍再跳成暗色（FOUC，刷新闪色）。
 * 经典脚本同步执行，能在浏览器开始绘制之前把 data-theme 打上。
 *
 * 三态与 docs/layout.html 保持一致：localStorage 里没值或值非法 → 跟随系统（不打 data-theme）。
 */
(function () {
  try {
    var mode = localStorage.getItem('mosaic-doc-theme');
    if (mode === 'light' || mode === 'dark') {
      document.documentElement.dataset.theme = mode;
    }
  } catch (e) {
    /* 隐私模式下读不了 localStorage，跟随系统即可 */
  }
})();
