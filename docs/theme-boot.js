/*
 * 首帧主题引导：必须是 head 内的**同步经典脚本**（module 会 defer，
 * 首帧先按亮色画一遍再跳暗色 = FOUC）。三态与 docs/layout.html 一致：
 * localStorage 无值或非法 → 跟随系统（不打 data-theme）。
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
