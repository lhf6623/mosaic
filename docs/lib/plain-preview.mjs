/* 普通例子预览：把一段普通 HTML 塞进 iframe 跑，并按内容高度自适应。
   与 ofa 例子的分别只在「谁来跑」—— 这里没有模板编译，浏览器原生解析；
   demo 源码的编译在 docs/lib/demo-runtime.mjs，两件事互不相干。 */

import { currentTheme } from './theme.mjs';

/** 例子里的 CDN 地址换成本地仓库：断网 / 未发版时也能跑 */
const CDN_RE =
  /https:\/\/(?:cdn|fastly|gcore|testingcf)\.jsdelivr\.net\/gh\/lhf6623\/mosaic@[^/]+\//g;

const siteRoot = () => new URL('.', document.baseURI).href;

/**
 * 把主题与站点样式桥接进 srcdoc（例子里没写 <html> 时原样返回）
 * @param {unknown} text
 * @returns {string}
 */
function buildSrcdoc(text) {
  const root = siteRoot();
  let html = String(text ?? '').replace(CDN_RE, root);
  if (!/<html\b/i.test(html)) return html;

  html = html.replace(/<html\b([^>]*)>/i, (match, attrs) => {
    const cleaned = attrs.replace(/\sdata-theme="[^"]*"/i, '');
    return '<html' + cleaned + ' data-theme="' + currentTheme() + '">';
  });

  const bridge =
    '<link rel="stylesheet" href="' +
    root +
    'packages/boot/mosaic.css" />\n' +
    '    <style>html { background: rgb(var(--mc-color-surface)); }</style>';
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, bridge + '\n  </head>') : bridge + html;
}

/**
 * 造一个预览器：宿主给哪块 DOM，iframe 就长在哪块里（dispose 会把它摘掉）。
 * @param {HTMLElement} host
 */
export function createPlainPreview(host) {
  /** @type {HTMLIFrameElement | null} */
  let frame = null;
  /** @type {ResizeObserver | null} */
  let observer = null;
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];

  const fit = () => {
    if (!frame) return;
    let doc;
    try {
      doc = frame.contentDocument;
    } catch {
      return; // 跨域：量不到就不量
    }
    if (!doc?.body) return;
    const style = doc.defaultView?.getComputedStyle(doc.body);
    const margin =
      (parseFloat(style?.marginTop ?? '') || 0) + (parseFloat(style?.marginBottom ?? '') || 0);
    const height = Math.ceil(doc.body.scrollHeight + margin);
    if (height > 0) frame.style.height = height + 'px';
  };

  const syncTheme = () => {
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      if (doc?.documentElement) doc.documentElement.dataset.theme = currentTheme();
    } catch {}
  };

  const onLoad = () => {
    const loaded = frame;
    if (!loaded) return;
    syncTheme();
    fit();
    try {
      const doc = loaded.contentDocument;
      if (!doc?.body) return;
      /* 用 iframe 自己的 ResizeObserver：字体晚到 / 内容自己长高都要跟 */
      const FrameRO = doc.defaultView?.ResizeObserver;
      observer?.disconnect();
      if (FrameRO) {
        observer = new FrameRO(() => fit());
        observer.observe(doc.body);
      }
      doc.fonts?.ready?.then(() => fit());
    } catch {}
  };

  const dispose = () => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    observer?.disconnect();
    observer = null;
    frame?.remove();
    frame = null;
  };

  /** @param {unknown} text */
  const render = (text) => {
    dispose();
    host.replaceChildren(); // 宿主这一格归我：切过来时把上一个（ofa 例子）留下的一并清掉
    const next = document.createElement('iframe');
    next.className = 'frame';
    next.title = '普通 HTML 示例预览';
    next.setAttribute('part', 'preview');
    next.srcdoc = buildSrcdoc(text);
    frame = next;
    next.addEventListener('load', onLoad, { once: true });
    host.append(next);
    /* 兜底：load 可能晚到或不来（图片 / 字体拖住），几次定时重排保证高度不塌 */
    timers = [100, 400, 1200].map((ms) =>
      setTimeout(() => {
        if (frame === next) fit();
      }, ms),
    );
  };

  return { render, syncTheme, dispose };
}
