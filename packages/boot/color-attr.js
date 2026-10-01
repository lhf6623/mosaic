/**
 * color-attr.js —— 让组件的 `color` 属性直接吃 hex：`<mc-button color="#fff000">`。
 *
 * 组件侧四行接线：`const color = colorAttr({ slots: ['fill', 'on-fill', 'accent'] })`，
 * 模板里 `attached() { color.sync(this, this.color); }` + `watch: { color(v) { color.change(this, v); } }`。
 *
 * 分工：语义名（`primary` / `info` / …）一律交给 CSS，hex 才走这里写组件自己的色槽；
 * `-fg` 按 WCAG 亮度算（`#fff000` 配白字只有 1.19:1，不该由使用者决定）；只收 hex，
 * `rgb()` / 颜色名一律不当颜色，警告一条后什么都不写。只用 fill / on-fill / accent 的组件
 * 不装观察器，声明了 `-subtle-fill` 的（tag）才在主题变化时重算。
 *
 * 三条边界：① 写的是宿主内联 style，会盖过 `:host` 默认值与使用者写的同名令牌（只清自己写的）；
 * ② 宿主 style 只能在 `attached()` 之后写（构造期写会抛 `NotSupportedError`，P31），
 * `watch` 首次触发恰在构造期、由 `change()` 跳过（P5）；③ hex 不随主题翻转。
 */

import { contrast, mix, parseHex, readToken, readableOn, triple, warnOnce } from './color-math.js';

/** 六个语义名：和 `packages/README.md` 的 color 维度一致 */
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
      /* 浅底变体的强调色仍是品牌色本身，极浅的牌子色会读不清 —— 语义色有构建期门禁，字面量没有 */
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
