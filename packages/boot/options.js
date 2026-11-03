/**
 * options.js —— 组件对外契约（事件 / 插槽）的声明与统一出口。
 *
 * 组件定义包一层 `withOptions({...})`，顶部两块声明决定运行时行为：
 *   emits.*  data / detail / native 三通道（载荷进 $event.data 或 $event.detail）
 *            默认 bubbles + composed；cancelable 只对 CustomEvent 通道有意义
 *   slots.*  public 插槽名；`reflect: 'x'` 让它自动维护宿主上的 data-has-x
 *
 * 出口全挂在 proto 上（ofa 只把 config.proto 挂到实例，放顶层会被忽略）：
 *   this.$emit(name, payload)  唯一派发口；未声明的事件名直接抛错
 *   this.$options              { emits, slots } 的冻结快照（声明即事实，只读）
 *   this.$slots.names          public 槽名，默认槽叫 'default'
 *   this.$slots.has(name)      该槽有没有分到内容（元素即内容，纯空白文本不算）
 *   this.$slots.nodes(name)    assignedNodes()：元素 / 文本 / 注释都在里面
 *   this.$slots.elements(name) assignedElements()：只数元素（容器类槽的判定用这个）
 *   this.$slots.node(name)     槽元素（ofa 包装，取 .ele / 挂事件）
 *   this.$slots.onChange(fn)   按声明批量订阅 slotchange（fn(name) 收到变的是哪个槽），detached 自动退订
 *
 * 组件里不再手写 this.emit / new CustomEvent / dispatchEvent，也不自己 map 槽名数组
 * （守卫 `event-calls` / `slot-calls` 会拦）。槽没声明不抛错 —— 渲染是模板的事；
 * 但 `pnpm check:docs` 会把 声明 ↔ 模板 <slot> ↔ api.md 三方对齐。
 */

/** 默认槽在声明里的键名；文档与对账里写作 `(默认)`（与 doc-drift 的 slot 抽取产物一致） */
export const DEFAULT_SLOT = 'default';

/** 槽名 / 反射名的形状：小写短横线（与 packages/README.md §1.6 一致） */
const SLOT_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * @typedef {object} EmitSpec
 * @property {string[]} [data] 载荷键（ofa emit 通道；只给文档对账与读代码用）
 * @property {string[] | true} [detail] 载荷键；true = 不透明载荷，整块进 event.detail
 * @property {true} [native] 原生事件重发：不发 detail
 * @property {true} [cancelable] 仅 CustomEvent 通道；$emit 返回 dispatchEvent 的结果
 * @property {true} [internal] 内部事件：不进 api.md，派发行为与公开事件相同
 */

/**
 * @typedef {object} SlotSpec
 * @property {string} [reflect] 有内容时往宿主写 data-has-<reflect>；不写 = 只接线不反射
 */

/**
 * @typedef {object} OptionHost
 * @property {Element} ele
 * @property {any} shadow
 * @property {(name: string, options: Record<string, unknown>) => void} emit
 */

/**
 * @param {any} value
 * @returns {any}
 */
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

/** 声明形状在装载时校验一次 —— 拼错键名不许静默失效
 * @param {Record<string, any>} emits
 */
function assertEmits(emits) {
  for (const [name, meta] of Object.entries(emits)) {
    const channels = ['data' in meta, 'detail' in meta, meta.native === true].filter(
      Boolean,
    ).length;
    if (channels > 1) throw new Error(`emits.${name}：data / detail / native 只能声明一个`);
    if (meta.cancelable && channels === 0)
      throw new Error(`emits.${name}：cancelable 只能用在 detail / native 通道`);
  }
}

/** @param {Record<string, any>} slots */
function assertSlots(slots) {
  for (const [name, meta] of Object.entries(slots)) {
    if (name !== DEFAULT_SLOT && !SLOT_NAME.test(name))
      throw new Error(`slots.${name}：槽名要用小写短横线（见 packages/README.md §1.6）`);
    if (!meta || typeof meta !== 'object' || Array.isArray(meta))
      throw new Error(`slots.${name}：声明值要是对象 —— 不反射就写 {}，反射写 { reflect: 'x' }`);
    for (const key of Object.keys(meta)) {
      if (key !== 'reflect') throw new Error(`slots.${name}：未知键 ${key}（只认 reflect）`);
    }
    if (meta.reflect !== undefined && !SLOT_NAME.test(meta.reflect))
      throw new Error(`slots.${name}.reflect：要用小写短横线（产出 data-has-<名>）`);
  }
}

/** 槽选择器：无名槽靠 :not([name]) —— 模板里写了 name="" 的也一样算默认
 * @param {string} name
 */
const selectorOf = (name) => (name === DEFAULT_SLOT ? 'slot:not([name])' : `slot[name="${name}"]`);

/**
 * 把组件定义包一层，生成唯一派发口 `$emit` 与插槽出口 `$slots`。
 * 声明与派发是同一份对象：通道、默认 flags、cancelable、反射名全部以声明为准。
 *
 * @param {Record<string, any>} config
 * @returns {Record<string, any>}
 */
export function withOptions(config) {
  const emits = /** @type {Record<string, EmitSpec>} */ (config.emits ?? {});
  const slots = /** @type {Record<string, SlotSpec>} */ (config.slots ?? {});
  const slotNames = Object.keys(slots);

  // ofa 只把 config.proto 挂到实例上；三个出口都必须进 proto
  const proto = config.proto ?? {};
  for (const key of ['$emit', '$options', '$slots'])
    if (config[key] || Object.hasOwn(proto, key))
      throw new Error(`组件已定义 ${key}：withOptions 会覆盖它`);

  assertEmits(emits);
  assertSlots(slots);

  /* ---------- 事件：声明即通道 ---------- */

  /**
   * @this {OptionHost}
   * @param {string} name
   * @param {any} [payload]
   * @returns {boolean}
   */
  function $emit(name, payload) {
    if (!Object.hasOwn(emits, name)) throw new Error(`未声明的事件：${name}`);
    const meta = emits[name];

    // detail / native → 原生 CustomEvent（跨 shadow 边界、可取消都靠它）
    if (meta.native === true || 'detail' in meta) {
      /** @type {Record<string, any>} */
      const options = { bubbles: true, composed: true };
      if (meta.cancelable) options.cancelable = true;
      if (meta.native !== true) options.detail = payload;
      return this.ele.dispatchEvent(new CustomEvent(name, options));
    }

    // data（含无载荷）→ ofa emit
    /** @type {Record<string, any>} */
    const options = { bubbles: true, composed: true };
    if (meta.data) options.data = payload;
    this.emit(name, options);
    return true;
  }

  /* ---------- 插槽：按声明解析 / 订阅 / 反射 ---------- */

  /**
   * 每个实例一份运行时状态。声明本身是模块级共享的，状态不能共享。
   * @type {WeakMap<object, { refs: Record<string, any>, bound: Array<{ el: any, onChange: () => void }>, subs: Set<Function>, mounted: boolean }>}
   */
  const states = new WeakMap();

  /** @param {any} host */
  function stateOf(host) {
    let state = states.get(host);
    if (!state) {
      state = { refs: {}, bound: [], subs: new Set(), mounted: false };
      states.set(host, state);
    }
    return state;
  }

  /**
   * ready() 时 shadow 已建好：把声明过的槽一次解析好，组件里不再各写一遍 map。
   * @param {any} host
   */
  function refsOf(host) {
    const state = stateOf(host);
    for (const name of slotNames) {
      if (state.refs[name]) continue;
      const found = host.shadow?.$(selectorOf(name));
      if (found) state.refs[name] = found;
    }
    return state.refs;
  }

  /**
   * 插槽分没分到内容是运行时的 DOM 事实（模板看不见），只能读 assignedNodes()。
   * 元素即内容；纯文本 / 注释节点要非空白才算（与各组件原来的判定一致）。
   * @param {any} host
   * @param {string} name
   */
  function hasContent(host, name) {
    const nodes = /** @type {Node[]} */ (refsOf(host)[name]?.ele?.assignedNodes() ?? []);
    return nodes.some((node) => node.nodeType === 1 || (node.textContent ?? '').trim() !== '');
  }

  /**
   * 把「有没有内容」反射成宿主属性；只在真变了时写，避免每次 slotchange 都重排。
   * @param {any} host
   */
  function reflectAll(host) {
    // 宿主属性必须 attached 之后才能写（宿主上写属性会抛 NotSupportedError）
    if (!stateOf(host).mounted || !host.ele) return;
    for (const [name, meta] of Object.entries(slots)) {
      if (!meta.reflect) continue;
      const on = hasContent(host, name);
      const attr = `data-has-${meta.reflect}`;
      if (on === host.ele.hasAttribute(attr)) continue;
      if (on) host.ele.setAttribute(attr, '');
      else host.ele.removeAttribute(attr);
    }
  }

  /**
   * attached：按声明批量订阅，detached 由 unbindSlots 统一退订。
   * @param {any} host
   */
  function bindSlots(host) {
    const state = stateOf(host);
    if (state.mounted) return;
    refsOf(host);
    // 每个槽一条 handler：回调带上「变的是哪个槽」，组件可以只处理关心的那一个
    for (const name of slotNames) {
      const el = state.refs[name];
      if (!el) continue;
      const onChange = () => {
        reflectAll(host);
        for (const fn of state.subs) fn.call(host, name);
      };
      el.on('slotchange', onChange);
      state.bound.push({ el, onChange });
    }
    // 首次反射：attached 时内容可能已经投影进来（首条 slotchange 不一定在挂载前发生）
    state.mounted = true;
    reflectAll(host);
  }

  /** @param {any} host */
  function unbindSlots(host) {
    const state = stateOf(host);
    for (const { el, onChange } of state.bound) el.off('slotchange', onChange);
    state.bound = [];
    state.mounted = false;
  }

  /* ---------- 挂到 proto ---------- */

  const snapshot = deepFreeze({
    emits: Object.fromEntries(Object.entries(emits).map(([k, v]) => [k, { ...v }])),
    slots: Object.fromEntries(slotNames.map((n) => [n, { ...slots[n] }])),
  });

  // ⚠️ 不能 spread proto：proto 里有依赖 this 的 getter（如 popover 的 panel），
  // spread 会在模块注册期把它们当普通值求值，this 不是实例，直接炸。
  const mergedProto = Object.defineProperties({}, Object.getOwnPropertyDescriptors(proto));
  Object.defineProperty(mergedProto, '$emit', {
    value: $emit,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(mergedProto, '$options', {
    value: snapshot,
    configurable: true,
    writable: true,
  });
  /**
   * 每个实例一个只读出口对象（getter 每次重建，够轻）。
   * @param {any} host
   */
  function slotsApi(host) {
    const refs = () => refsOf(host);
    return {
      names: [...slotNames],
      /** @param {string} name */
      node(name) {
        return refs()[name] ?? null;
      },
      /** @param {string} name */
      nodes(name) {
        return refs()[name]?.ele?.assignedNodes() ?? [];
      },
      /** @param {string} name */
      elements(name) {
        return refs()[name]?.ele?.assignedElements() ?? [];
      },
      /** @param {string} name */
      has(name) {
        return hasContent(host, name);
      },
      /** @param {(name: string) => void} fn @returns {() => boolean} 退订 */
      onChange(fn) {
        const state = stateOf(host);
        state.subs.add(fn);
        return () => state.subs.delete(fn);
      },
    };
  }

  Object.defineProperty(mergedProto, '$slots', {
    /** @this {OptionHost} */
    get() {
      return slotsApi(this);
    },
    configurable: true,
  });

  /** @type {Record<string, any>} */
  const wrapped = { ...config, proto: mergedProto };
  if (slotNames.length) {
    // 组合而非覆盖：组件自己的钩子照常跑，我们的活排在前面（解析 / 订阅要先于组件读状态）
    const { ready, attached, detached } = config;
    /** @this {any} @param {any[]} args */
    const callReady = function (...args) {
      refsOf(this);
      return ready?.apply(this, args);
    };
    /** @this {any} @param {any[]} args */
    const callAttached = function (...args) {
      bindSlots(this);
      return attached?.apply(this, args);
    };
    /** @this {any} @param {any[]} args */
    const callDetached = function (...args) {
      unbindSlots(this);
      return detached?.apply(this, args);
    };
    wrapped.ready = callReady;
    wrapped.attached = callAttached;
    wrapped.detached = callDetached;
  }
  return wrapped;
}
