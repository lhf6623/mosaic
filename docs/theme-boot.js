/* 首帧主题：head 里的同步脚本（防闪色），不能 import —— 模块是 defer，跑起来时首帧已经画完。
   偏好键与取值规则跟 docs/lib/theme.mjs 一致，改一处要改两处。 */
(function () {
  var mode = 'auto';
  try {
    var stored = localStorage.getItem('mosaic-doc-theme');
    if (stored === 'light' || stored === 'dark') mode = stored;
  } catch {}
  if (mode === 'auto') {
    mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = mode;
})();
