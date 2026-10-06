/* 文档站**唯一的导航信号源**：监听只在这里挂（hashchange + router-change），消费方订阅同一个 store / 订阅表。
 * 以前 4 个文件各挂一遍（8 个监听），每处都要记得「olink 走 pushState、不触发 hashchange」（P28）—— 漏一个就是静默不更新。
 * 两种消费：routeState() 拿响应式对象（模板里可以按 {{nav.path}} 绑），onRouteChange(cb) 拿订阅（JS 里要派生的用）。
 * ⚠️ 三个不显然的点：懒创建（模块顶层调 $.stanz 依赖 ofa 的执行顺序）；创建即写入当前路由（组件可能比外壳更早 attach）；
 *   订阅表是自己的一张 Set（watch 的返回值能不能退订没有官方说明，而组件会随切页反复建/毁，退订必须可靠）。
 */

import { locate } from '../site-map.js';
import { route } from '../routes.js';

/**
 * 响应式 store 的形状。⚠️ 与模板里读的路径同形：给 null 会在首帧抛 text expression（P37）
 * @typedef {object} RouteState
 * @property {string} path
 * @property {import('../site-map.js').NavNode | null} entry
 * @property {import('../site-map.js').NavNode | null} node
 * @property {boolean} hidden
 */

/** @type {RouteState} */
const SHAPE = { path: '', entry: null, node: null, hidden: false };

/** @type {RouteState | null} */
let store = null;
let tracking = false;
/** @type {Set<(next: RouteState) => void>} */
const subscribers = new Set();

/**
 * 当前路由 + 它在导航树里的位置。`route()` 是纯读，locate 也是纯查询
 * @returns {RouteState}
 */
function read() {
  const path = route();
  const hit = locate(path);
  return {
    path,
    entry: hit?.entry ?? null,
    node: hit?.node ?? null,
    hidden: hit?.hidden ?? false,
  };
}

/** @returns {RouteState} */
function create() {
  store = $.stanz({ ...SHAPE, ...read() });
  return store;
}

/**
 * 响应式状态对象（首次调用时创建并哨兵式地写入当前路由）
 * @returns {RouteState}
 */
export function routeState() {
  const state = store ?? create();
  startRouteTracking();
  return state;
}

/** 挂全局监听。幂等：布局页 / 组件反复建毁都不会重复挂 */
export function startRouteTracking() {
  // 闭包里局部化：模块级 let 在闭包内不收窄，直接读 store 会被判成可能为 null
  const state = store ?? create();
  if (tracking) return;
  tracking = true;

  const sync = () => {
    const next = read();
    // 签名没变就不写：避免同一次导航里的多次事件引发无谓重渲染
    if (state.path === next.path) return;
    Object.assign(state, next);
    for (const cb of [...subscribers]) cb(next);
  };

  window.addEventListener('hashchange', sync);
  document.addEventListener('router-change', sync);
}

/**
 * 订阅路由变化（只在实际换页时回调）。返回退订函数 —— 组件必须在 detached() 里调用它，否则切页后会留下改旧组件的回调。
 * @param {(next: RouteState) => void} cb
 * @returns {() => void}
 */
export function onRouteChange(cb) {
  routeState(); // 保证 store 与监听都已就位
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
