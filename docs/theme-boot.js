/*
 * 首帧主题引导：必须是 head 内的**同步经典脚本**（module 会 defer，首帧先按亮色画一遍再跳暗色 = FOUC）。
 * 令牌表只有亮 / 暗两态，「自动」是本站自己接的：读系统偏好，落成 data-theme="light" / "dark"。
 * 与 docs/layout.html 的 applyTheme 同一套口径（那边管运行时切换，这里管首帧）。
 */
(function () {
  var mode = 'auto';
  try {
    var stored = localStorage.getItem('mosaic-doc-theme');
    if (stored === 'light' || stored === 'dark') mode = stored;
  } catch (e) {
    /* 隐私模式下读不了 localStorage，按自动处理 */
  }
  if (mode === 'auto') {
    mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = mode;
})();
