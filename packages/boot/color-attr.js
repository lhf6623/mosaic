/**
 * color-attr.js —— 让组件的 `color` 属性**直接吃 hex**：`<mc-button color="#fff000">`。
 *
 * 组件里四行接线（button / tag / icon 各一处，alert 刻意不接 —— 见 agent/plan/decisions.md D8）：
 *
 * ```js
 * import { colorAttr } from '../boot/color-attr.js';
 * const color = colorAttr({ slots: ['fill', 'on-fill', 'accent'] });
 * // 组件模板里：
 * attached() { color.sync(this, this.color); },
 * watch: { color(value) { color.change(this, value); } },
 * ```
 *
 * ## 语义
 *
 * · **语义名照旧交给 CSS**：`primary` / `info` / … （外加组件自己的取值，如 `mc-icon` 的 `current`）
 *   一律不碰，`variant` 决定槽贴到哪儿，组合关系一个字没变。
 * · **hex 走这里**：`#fff000` / `#fc0` → 写该组件自己的色槽（`--mc-<slug>-fill` 等）。
 *   只收 hex —— `rgb()` / `hsl()` / 颜色名一律**不当颜色**，一条 `[mosaic]` 警告后什么都不写
 *   （不猜、不降级：值不对就是不给颜色）。
 * · `-fg` 不用你给：按 WCAG 相对亮度算（`#fff000` 配白字只有 1.19:1，所以这个不该由使用者决定）。
 * · `-subtle-fill` 要跟主题走：声明了它的组件（tag）会在 `<html data-theme>` 或系统配色变化时重算。
 *   只用 `fill` / `on-fill` / `accent` 的组件（button）**不装任何观察器**，零常驻开销。
 *
 * ## 三条边界
 *
 * 1. 写的是**宿主的内联 style**：盖过 `:host` 上的默认值，也盖过使用者写在同一元素上的同名令牌。
 *    （本文件只清自己写过的那几个属性，不碰别人的。）
 * 2. 宿主 style 只在 `attached()` 之后写 —— 构造期往宿主写属性会抛 `NotSupportedError`（P31）；
 *    `watch` 首次触发恰好落在构造期，由 `change()` 内部跳过（P5）。这两个坑都在本文件里处理完，
 *    组件侧只剩上面四行。
 * 3. **hex 不随主题翻转**（它是品牌色，不是语义色）；要亮暗两套就亮暗各写一个值 ——
 *    `[data-theme='dark'] mc-button { --mc-button-fill: … }` 之类。
 */

import { contrast, mix, parseHex, readToken, readableOn, triple, warnOnce } from './color-math.js';

/** 六个语义名：和 `agent/api/README.md` 的 color 维度一致 */
const SEMANTIC = ['primary', 'info', 'success', 'warning', 'danger', 'neutral'];

/** 我们已经为哪些宿主写过哪些属性（清的时候只清自己的） */
const painted = new WeakMap();

/** 一个宿主只会由它自己那个组件装配 —— 用来跳过 watch 的首次触发（P5） */
const seen = new WeakSet();

/** tag → 配置。主题观察器靠它把 `[color]` 元素对回各自的槽位 */
const configs = new Map();

let themeWatcher = null;

/** 只有真的声明了 `-subtle-fill` 的组件才需要它；装一次、全页共用 */
function ensureThemeWatcher() {
  if (themeWatcher) return;
  themeWatcher = true;
  const reapply = () => {
    for (const el of document.querySelectorAll('[color]')) {
      const config = configs.get(el.tagName.toLowerCase());
      if (config) apply(el, el.getAttribute('color'), config);
    }
  };
  new MutationObserver(reapply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reapply);
}

function write(host, name, value) {
  host.style.setProperty(name, value);
  const list = painted.get(host) ?? [];
  if (!list.includes(name)) list.push(name);
  painted.set(host, list);
}

/** 撤掉本文件写过的东西 —— 元素回到 CSS（语义色 / 组件默认） */
function unpaint(host) {
  for (const name of painted.get(host) ?? []) host.style.removeProperty(name);
  painted.delete(host);
}

function apply(host, raw, config) {
  if (!config.slug) {
    const tag = host.tagName.toLowerCase();
    config.slug = tag.startsWith('mc-') ? tag.slice(3) : tag;
    configs.set(tag, config);
  }
  const value = String(raw ?? '').trim();

  /* 语义名（含组件自己的取值，如 current）：交给 CSS，撤掉我们写过的 */
  if (config.names.includes(value)) return unpaint(host);

  const rgb = parseHex(value);
  if (!rgb) {
    warnOnce(
      `${host.tagName}:${value}`,
      `[mosaic] ${host.tagName.toLowerCase()} 的 color="${value}" 不是 hex（只支持 #fff000 / #fc0），已忽略`,
    );
    return unpaint(host);
  }

  /* fg 模式：color 直接就是前景色（mc-icon），没有色槽 */
  if (config.mode === 'fg') {
    write(host, 'color', `rgb(${triple(rgb)})`);
    return;
  }

  const slot = (name) => `--mc-${config.slug}-${name}`;
  write(host, slot('fill'), triple(rgb));
  write(host, slot('on-fill'), triple(readableOn(rgb)));
  if (config.slots.includes('accent')) write(host, slot('accent'), triple(rgb));
  if (config.slots.includes('subtle-fill')) {
    const surface = readToken('--mc-color-surface');
    /* 样式表还没就位：浅底这一档留给下一次主题重算，其余槽照常 */
    if (surface) {
      const subtle = mix(rgb, surface, 0.9);
      write(host, slot('subtle-fill'), triple(subtle));
      /* 浅底变体的强调色仍是品牌色本身（L2 没有"浅底上的强调色"这个令牌），
         所以极浅的牌子色在浅底上会读不清。语义色有构建期 34 项门禁兜底，字面量没有 —— 这里补一条。 */
      const ratio = contrast(rgb, subtle);
      if (ratio < 4.5)
        warnOnce(
          `${host.tagName}:${value}:subtle`,
          `[mosaic] ${host.tagName.toLowerCase()} 的 color="${value}" 在浅底上只有 ${ratio.toFixed(2)}:1（< 4.5）—— ` +
            '换个中等明度的颜色，或这个组件用实心外观',
        );
    }
  }
}

/**
 * 造一个 `color` 属性的接线器。一个组件文件调一次。
 *
 * @param {{slots?: string[], names?: string[], mode?: 'slots'|'fg'}} [config]
 *   slots 该组件声明的色槽后缀（button: fill / on-fill / accent；tag 再加 subtle-fill）
 *   names 该组件接受的语义取值（默认六个语义名；mc-icon 传 [...SEMANTIC, 'current']）
 *   mode  'fg' = color 就是前景色（mc-icon），此时 slots 不生效
 */
export function colorAttr({ slots = [], names = SEMANTIC, mode = 'slots' } = {}) {
  const config = { slots, names, mode };
  if (mode === 'slots' && slots.includes('subtle-fill')) ensureThemeWatcher();

  return {
    /** 在组件的 attached() 里调：构造期已过，可以写宿主 style（P31） */
    sync(host, value) {
      apply(host, value, config);
    },
    /** 在组件的 watch.color 里调；首次触发落在构造期，跳过（P5） */
    change(host, value) {
      if (!seen.has(host)) {
        seen.add(host);
        return;
      }
      apply(host, value, config);
    },
  };
}

/** 给 mc-icon 这类「color = 前景色」的组件用；导出是为了让语义显式，不用记 mode 字符串 */
export const FG_NAMES = [...SEMANTIC, 'current'];
