/**
 * loadingBar — 命令式加载条（函数入口）。使用者只碰这个文件：
 *   import loadingBar from '../../loading-bar/loading-bar.js';
 *   loadingBar.start({ label: '正在保存' });  loadingBar.done();
 *   const task = loadingBar.start({ target: panel });  task.done();
 * 它只把组件的某个 `state` 写上去（没有队列 / 计数）；默认那条必须挂 body 才压得住弹层。
 */
const COMPONENT_URL = new URL('./loading-bar.html', import.meta.url).href;

/** 组件注册（全局一次，与落点无关） */
let defined = null;
/** 默认那一条（挂 body） */
let fixedHost = null;
/** 容器 → 该容器里那一条（WeakMap：容器没了它跟着走；存的是 Promise，并发不会造出两条） */
const scopedHosts = new WeakMap();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 等 ofa 把实例挂上来（`ready` 是异步的）。⚠️ 必须等：ofa 会把非空默认属性反射到宿主，早写的属性会被那一下盖掉。 */
const waitForInstance = async (el) => {
  for (let i = 0; i < 40; i++) {
    const inst = $(el);
    if (inst && typeof inst.syncState === 'function') return inst;
    await new Promise((r) => requestAnimationFrame(() => r()));
  }
  throw new Error('[mosaic] mc-loading-bar 没有在预期时间内就绪');
};

/** 首次用到才用 `<l-m>` 把组件注册上（在 CDN 上也是相对自己解析） */
const ensureDefined = () => {
  if (defined) return defined;

  defined = (async () => {
    if (customElements.get('mc-loading-bar')) return;
    const loader = document.createElement('l-m');
    loader.setAttribute('src', COMPONENT_URL);
    /* ⚠️ l-m 是加载占位：站点样式那条 `l-m { display: none }` 不管挂到 body 的这个，得自己藏好免得占一行高度 */
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

/** `target` 归一成「元素 / 空」——选择器给错了要在调用那一刻报，不能静默落到默认那条上 */
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

/** 写一次状态 —— 这个文件的全部实现；返回 Promise（等挂载那一下） */
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

/** 开始：条子出现并缓慢爬升（到不了 100%），返回这一条的句柄；给了 `target` 之后只有句柄能收掉它 */
export function start(config = {}) {
  const target = resolveTarget(typeof config === 'string' ? null : config?.target);
  /* 不等挂载：句柄同步返回（都排在同一个挂载 Promise 后面）；挂载失败要像 message.js 那样在控制台报出来，不该静默 */
  void drive(target, 'loading', labelOf(config));

  return {
    done: () => drive(target, 'done'),
    error: () => drive(target, 'error'),
    idle: () => drive(target, 'idle'),
  };
}

/** 成功收尾默认那条：先滑到 100%，再淡出消失。 */
export const done = () => defaultOnly('done');

/** 失败收尾默认那条：与成功同一条路，只是填充色换成主题的 danger。 */
export const error = () => defaultOnly('error');

/** 立刻收掉默认那条（不播收尾）：条子直接回到「不出现」。 */
export const idle = () => defaultOnly('idle');

const loadingBar = { start, done, error, idle };

export default loadingBar;
