/**
 * emits.js —— 组件事件声明与统一派发。
 *
 * 组件定义包一层 `withEmits({...})`，声明里的 `emits` 决定怎么发：
 *   data   ofa emit，载荷进 `$event.data`
 *   detail 原生 CustomEvent，载荷进 `$event.detail`
 *   native 原生事件重发，不带 detail（scroll 那类）
 *
 * 默认 `bubbles + composed`；`cancelable` 只对 CustomEvent 通道有意义，`$emit` 返回 dispatch 结果。
 * 未声明的事件名运行时直接抛错；组件里不再手写 `this.emit` / `new CustomEvent`（守卫会拦）。
 */

/**
 * @typedef {object} EmitSpec
 * @property {string[]} [data] 载荷键（ofa emit 通道；只给文档对账与读代码用）
 * @property {string[] | true} [detail] 载荷键；true = 不透明载荷，整块进 event.detail
 * @property {true} [native] 原生事件重发：不发 detail
 * @property {true} [cancelable] 仅 CustomEvent 通道；$emit 返回 dispatchEvent 的结果
 * @property {true} [internal] 内部事件：不进 api.md，派发行为与公开事件相同
 */

/**
 * @typedef {object} EmitHost
 * @property {Element} ele
 * @property {(name: string, options: Record<string, unknown>) => void} emit
 */

/**
 * 把组件定义包一层，生成唯一派发口 `$emit(name, payload)`。
 * 声明与派发是同一份对象：通道、默认 flags、cancelable 全部以 `emits` 为准。
 *
 * @param {Record<string, any>} config
 * @returns {Record<string, any>}
 */
export function withEmits(config) {
  const spec = /** @type {Record<string, EmitSpec>} */ (config.emits ?? {});
  // ofa 只把 config.proto 挂到实例上；$emit 必须进 proto，放顶层会被忽略
  const proto = config.proto ?? {};
  if (config.$emit || Object.hasOwn(proto, '$emit'))
    throw new Error('组件已定义 $emit：withEmits 会覆盖它');

  // 形状在装载时校验一次：data / detail / native 最多一个；都不写 = 无载荷的 ofa emit
  for (const [name, meta] of Object.entries(spec)) {
    const channels = ['data' in meta, 'detail' in meta, meta.native === true].filter(
      Boolean,
    ).length;
    if (channels > 1) throw new Error(`emits.${name}：data / detail / native 只能声明一个`);
    if (meta.cancelable && channels === 0)
      throw new Error(`emits.${name}：cancelable 只能用在 detail / native 通道`);
  }

  /**
   * @this {EmitHost}
   * @param {string} name
   * @param {any} [payload]
   * @returns {boolean}
   */
  function $emit(name, payload) {
    if (!Object.hasOwn(spec, name)) throw new Error(`未声明的事件：${name}`);
    const meta = spec[name];

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

  // ⚠️ 不能 spread proto：proto 里有依赖 this 的 getter（如 popover 的 panel），
  // spread 会在模块注册期把它们当普通值求值，this 不是实例，直接炸。
  const mergedProto = Object.defineProperties({}, Object.getOwnPropertyDescriptors(proto));
  Object.defineProperty(mergedProto, '$emit', { value: $emit, configurable: true, writable: true });
  return { ...config, proto: mergedProto };
}
