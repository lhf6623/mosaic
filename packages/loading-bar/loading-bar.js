/**
 * loadingBar — 命令式加载条（函数入口）
 *
 * 使用者只碰这个文件：
 *
 *   import loadingBar from '../../loading-bar/loading-bar.js';
 *
 *   // 整页在忙：默认那一条，钉在视口顶部
 *   loadingBar.start({ label: '正在保存' });
 *   loadingBar.done();
 *
 *   // 某一整块在忙：给它容器，条子就落在那一块的最上沿
 *   const task = loadingBar.start({ target: panel, label: '正在刷新列表' });
 *   task.done();
 *
 * **它只做一件事：把组件的某个 `state` 写上去**（start / done / error / idle ↔
 * loading / done / error / idle，一一对应）。没有队列、没有计数、没有定时器、没有 Promise
 * 包装 ——「现在到底有几件事在忙、什么时候算完」是**使用者的业务**，由调用方自己决定。
 *
 * 两个落点（不给 `target` 就是前一种）：
 *   · 默认：模块自己造**一条**挂 `document.body`，用组件的默认定位（`fixed`、视口顶部）。
 *     **必须挂 body**：`position: fixed` 一旦落在 shadow root 或任何带 transform / filter /
 *     contain 的祖先下，就会被困成新的层叠上下文，压不到顶栏与弹层上（同 message.js）。
 *   · `target`（元素或选择器）：在那个容器里造一条 `position="static"` 的、**放在最上沿** ——
 *     与标签那一种完全一样：占自己那 2 / 4px、通宽，而且**不去猜容器**（不套 `absolute`、也不
 *     要求容器 `position: relative`）。「盖在容器上沿、不占布局」要的是给条子写内联样式，
 *     那件事只有标签入口做得到（模块写不了使用者的内联样式）。
 *
 * 视图不在这里：本文件不碰 DOM 结构、不写样式，`loading-bar.html` 的状态机与 CSS 一行不改。
 */
const COMPONENT_URL = new URL('./loading-bar.html', import.meta.url).href;

/** 组件注册（全局一次，与落点无关） */
let defined = null;
/** 默认那一条（挂 body） */
let fixedHost = null;
/** 容器 → 那个容器里的那一条（WeakMap：容器没了它跟着走；存的是 Promise，并发调用不会造出两条） */
const scopedHosts = new WeakMap();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 等 ofa 把实例挂上来（append 之后 `$()` 不一定立刻有；`ready` 是异步的）。
 * ⚠️ 必须等：ofa 会把非空默认属性反射到宿主（实测新建元素 append 后自动带 `state="idle"`），
 * 早写的属性会被那一下盖掉。
 */
const waitForInstance = async (el) => {
  for (let i = 0; i < 40; i++) {
    const inst = $(el);
    if (inst && typeof inst.syncState === 'function') return inst;
    await new Promise((r) => requestAnimationFrame(() => r()));
  }
  throw new Error('[mosaic] mc-loading-bar 没有在预期时间内就绪');
};

/** 首次用到才 `<l-m>` 把组件注册上（在 CDN 上也是相对自己解析） */
const ensureDefined = () => {
  if (defined) return defined;

  defined = (async () => {
    if (customElements.get('mc-loading-bar')) return;
    const loader = document.createElement('l-m');
    loader.setAttribute('src', COMPONENT_URL);
    /* ⚠️ l-m 是加载占位：站点样式里那条 `l-m { display: none }` 只管文档页自己那份，
       挂到 body 上的这个得自己藏好，免得占一行高度 */
    loader.style.display = 'none';
    document.body.append(loader);
    for (let i = 0; i < 200 && !customElements.get('mc-loading-bar'); i++) await sleep(20);
    if (!customElements.get('mc-loading-bar')) {
      defined = null;
      throw new Error(`[mosaic] 加载 ${COMPONENT_URL} 失败：mc-loading-bar 没有注册成功`);
    }
  })();

  return defined;
};

/** 造 + 挂一条：无 target 挂 body（fixed），有 target 进容器（static） */
const create = async (target) => {
  const el = document.createElement('mc-loading-bar');
  if (target) {
    el.setAttribute('position', 'static');
    target.prepend(el); // 容器的最上沿（只占自己那 2 / 4px）
  } else {
    document.body.append(el);
  }
  await waitForInstance(el);
  return el;
};

/** 某个落点上的那一条；第一次用到才造（失败就把缓存清掉，下次还能重试） */
const hostFor = (target) => {
  if (!target) {
    fixedHost ??= ensureDefined()
      .then(() => create(null))
      .catch((err) => {
        fixedHost = null;
        throw err;
      });
    return fixedHost;
  }

  let host = scopedHosts.get(target);
  if (!host) {
    host = ensureDefined()
      .then(() => create(target))
      .catch((err) => {
        scopedHosts.delete(target);
        throw err;
      });
    scopedHosts.set(target, host);
  }
  return host;
};

/** `target` 归一成「元素 / 空」——选择器给错了要在**调用那一刻**报，不能静默落到默认那条上 */
const resolveTarget = (target) => {
  if (target === undefined || target === null) return null;
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(el instanceof Element)) {
    throw new Error(
      `[mosaic] loadingBar：target 既不是元素、也不是能命中的选择器（${String(target)}）`,
    );
  }
  return el;
};

/** 写一次状态 —— 这个文件的全部实现。返回 Promise（等挂载那一下） */
const drive = async (target, state, label) => {
  const el = await hostFor(target);
  /* 先写文案再写状态：状态一变，组件就会读 label 去挂 aria-label */
  if (label !== undefined) el.setAttribute('label', label);
  el.setAttribute('state', state);
  return el;
};

const labelOf = (config) => (typeof config === 'string' ? config : config?.label);

/** 模块级那三个只管默认那条；它还没出现过就什么都不做（省得打错目标时在顶部闪一条） */
const defaultOnly = (state) => (fixedHost ? drive(null, state) : Promise.resolve(null));

/**
 * 开始：条子出现并缓慢爬升（到不了 100%），返回**这一条**的句柄。
 *   loadingBar.start()                                     // 默认那条：视口顶部
 *   loadingBar.start('正在保存')                            // 同上，只是带文案
 *   loadingBar.start({ target: panel, label: '刷新中' })    // 那一块那条
 * 给了 `target` 之后，就只剩句柄能收掉它（模块级的 done() 只管默认那条）。
 */
export function start(config = {}) {
  const target = resolveTarget(typeof config === 'string' ? null : config?.target);
  /* 不等挂载：句柄同步返回，调用顺序照样保持（都排在同一个挂载 Promise 后面）。
     挂载失败会像 message.js 那样在控制台报出来 —— 那是真坏了，不该静默。 */
  void drive(target, 'loading', labelOf(config));

  return {
    done: () => drive(target, 'done'),
    error: () => drive(target, 'error'),
    idle: () => drive(target, 'idle'),
  };
}

/** 成功收尾**默认那条**：先滑到 100%，再淡出消失。 */
export const done = () => defaultOnly('done');

/** 失败收尾**默认那条**：与成功**同一条路**，只是填充色换成主题的 danger。 */
export const error = () => defaultOnly('error');

/** 立刻收掉**默认那条**（不播收尾）：条子直接回到「不出现」。 */
export const idle = () => defaultOnly('idle');

const loadingBar = { start, done, error, idle };

export default loadingBar;
