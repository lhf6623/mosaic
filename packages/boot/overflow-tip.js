/**
 * 被 text-overflow 裁掉时的完整文案提示（mc-select / mc-tree-select / mc-date-picker 共用）。
 *
 * 触发框的宽度是固定的，长选项 / 多选拼接 / 范围文本会被 ellipsis 裁掉；这里在 hover / focus 时
 * 在 top layer 弹一个小浮层显示完整文案，不占版面、不被祖先 overflow 裁掉。
 *
 * 用法：attached() 里 attachOverflowTip(host, target)，detached() 里 dispose()；
 * 每次内容变化后调 check()。宿主上会镜像 [data-overflow]，给外部样式与测试一个稳定钩子。
 */

let sequence = 0;

/**
 * @param {HTMLElement} host 组件宿主（shadow root 的拥有者）
 * @param {HTMLElement} target 被 ellipsis 裁的那个元素
 * @param {{
 *   text?: () => string;
 *   enabled?: () => boolean;
 *   showOnFocus?: boolean;
 * }} [options]
 *   text：自定义完整文案；默认读 target.textContent。
 *   enabled：返回 false 时不提示（如密码框 / 正在编辑的输入框）。
 *   showOnFocus：focus 时是否也弹，默认 true；输入框传 false（聚焦后让位给编辑）。
 */
export function attachOverflowTip(host, target, options = {}) {
  if (!host || !target) {
    return { check: () => false, show: () => {}, hide: () => {}, dispose: () => {} };
  }
  const root = host.shadowRoot;
  if (!root) {
    return { check: () => false, show: () => {}, hide: () => {}, dispose: () => {} };
  }

  const getText =
    typeof options.text === 'function'
      ? options.text
      : () =>
          String(target.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim();
  const enabled = typeof options.enabled === 'function' ? options.enabled : () => true;
  const showOnFocus = options.showOnFocus !== false;

  const anchor = '--mc-overflow-' + ++sequence;
  const previousAnchor = target.style.getPropertyValue('anchor-name');
  target.style.setProperty('anchor-name', anchor);

  const tip = document.createElement('div');
  tip.className = 'mc-overflow-tip';
  tip.setAttribute('popover', 'manual');
  tip.style.cssText = [
    'position: fixed',
    'inset: auto',
    'margin: 0',
    'box-sizing: border-box',
    'padding: var(--mc-space-1, 0.25rem) var(--mc-space-2, 0.5rem)',
    'border: 1px solid rgb(var(--mc-color-border-strong, 187 194 194))',
    'border-radius: var(--mc-radius-md, 0.375rem)',
    'background-color: rgb(var(--mc-color-surface-raised, 255 255 255))',
    'color: rgb(var(--mc-color-fg, 61 67 68))',
    'box-shadow: var(--mc-shadow-panel, 0 4px 12px rgb(0 0 0 / 0.16))',
    'font: inherit',
    'font-size: var(--mc-text-xs, 0.75rem)',
    'line-height: 1.4',
    'text-align: start',
    'white-space: normal',
    'overflow-wrap: anywhere',
    'max-width: min(24rem, calc(100vw - var(--mc-space-8, 2rem)))',
    'pointer-events: none',
    'position-anchor: ' + anchor,
    'top: anchor(bottom)',
    'left: anchor(left)',
    'margin-top: var(--mc-space-1, 0.25rem)',
    'position-try-fallbacks: flip-block, flip-inline',
  ].join('; ');
  root.append(tip);

  const canPopover = typeof tip.showPopover === 'function';
  let shown = false;
  let suppressFocus = false;
  let suppressTimer = 0;

  const isOverflowing = () => target.scrollWidth > target.clientWidth + 1;

  const hide = () => {
    if (!shown) return;
    shown = false;
    if (canPopover) {
      try {
        tip.hidePopover();
      } catch (error) {
        /* 已经被浏览器收掉：不用管 */
      }
    }
  };

  const check = () => {
    if (!enabled()) {
      if (host.hasAttribute('data-overflow')) host.removeAttribute('data-overflow');
      hide();
      return false;
    }
    const overflow = isOverflowing();
    const flagged = host.hasAttribute('data-overflow');
    if (overflow !== flagged) {
      if (overflow) host.setAttribute('data-overflow', '');
      else host.removeAttribute('data-overflow');
    }

    if (shown) {
      const text = getText();
      if (text !== tip.textContent) hide();
    }
    if (!overflow) hide();

    /* 没有 popover 的老环境退回原生 title，至少不丢信息 */
    if (!canPopover) {
      if (overflow) host.setAttribute('title', getText());
      else host.removeAttribute('title');
    }
    return overflow;
  };

  const show = () => {
    if (host.hasAttribute('data-open')) return;
    if (!check()) return;
    const text = getText();
    if (!text) return;
    tip.textContent = text;
    if (!canPopover) return;
    if (shown) return;
    try {
      tip.showPopover();
      shown = true;
    } catch (error) {
      shown = false;
    }
  };

  const onEnter = () => show();
  const onLeave = () => hide();
  const onFocusIn = () => {
    if (!showOnFocus) {
      hide();
      check();
      return;
    }
    if (!suppressFocus) show();
  };
  const onFocusOut = () => {
    hide();
    /* 焦点离开后 enabled 可能从 false 变 true（如输入框失焦），把钩子状态补回来 */
    check();
  };
  const onPointerDown = () => {
    hide();
    suppressFocus = true;
    window.clearTimeout(suppressTimer);
    suppressTimer = window.setTimeout(() => {
      suppressFocus = false;
    }, 320);
  };
  const onViewportChange = () => hide();

  host.addEventListener('pointerenter', onEnter);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('focusin', onFocusIn);
  host.addEventListener('focusout', onFocusOut);
  host.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);

  /* 面板一打开就把提示收掉：它和下拉 / 日历是同一块地方 */
  const observer = new MutationObserver(() => {
    if (host.hasAttribute('data-open')) hide();
  });
  observer.observe(host, { attributes: true, attributeFilter: ['data-open'] });

  check();

  return {
    check,
    show,
    hide,
    dispose() {
      hide();
      observer.disconnect();
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('focusin', onFocusIn);
      host.removeEventListener('focusout', onFocusOut);
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      window.clearTimeout(suppressTimer);
      tip.remove();
      if (previousAnchor) target.style.setProperty('anchor-name', previousAnchor);
      else target.style.removeProperty('anchor-name');
      host.removeAttribute('data-overflow');
      if (!canPopover) host.removeAttribute('title');
    },
  };
}
