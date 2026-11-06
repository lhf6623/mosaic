(function () {
  var mode = 'auto';
  try {
    var stored = localStorage.getItem('mosaic-doc-theme');
    if (stored === 'light' || stored === 'dark') mode = stored;
  } catch (e) {}
  if (mode === 'auto') {
    mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = mode;
})();
