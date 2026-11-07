/* 侧栏滚轮桥接：光标停在 doc-nav / doc-toc 里，滚到那一栏的顶（底）之后，
   把剩下的滚轮交给正文。两栏的滚动容器藏在 mc-scroll-bar 的 shadow 里，只能顺 shadow 摸。 */

const WHEEL_LINE = 16;

/**
 * 不同 deltaMode 的滚轮都换算成像素（行 / 页 → px）
 * @param {WheelEvent} event
 * @returns {number}
 */
const wheelPixels = (event) => {
  if (event.deltaMode === 1) return event.deltaY * WHEEL_LINE;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
};

/**
 * 某个宿主里的滚动视口（mc-scroll-bar 的 [part="viewport"]）；摸不到返回 null
 * @param {Element} host
 * @returns {HTMLElement | null}
 */
function viewportOf(host) {
  return $(host)?.shadow?.$('mc-scroll-bar')?.shadow?.$('[part="viewport"]')?.ele ?? null;
}

/**
 * 这次滚轮该不该由正文接管。
 * @param {WheelEvent} event
 * @param {HTMLElement | null} scroller 正文的滚动容器
 */
export function forwardWheel(event, scroller) {
  if (!event.deltaY || event.ctrlKey || event.metaKey) return;

  const host = /** @type {Element | undefined} */ (
    event
      .composedPath()
      .find((node) => node instanceof Element && node.matches?.('doc-nav, doc-toc'))
  );
  if (!host || !scroller) return;

  const viewport = viewportOf(host);
  if (!viewport) return;

  const down = event.deltaY > 0;
  const atTop = viewport.scrollTop <= 0;
  const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1;
  if ((down && !atBottom) || (!down && !atTop)) return;

  event.preventDefault(); // 拦掉「被吞掉的那一次」，改由我们转发
  scroller.scrollTop += wheelPixels(event);
}
