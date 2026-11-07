import { locate } from '../site-map.js';
import { route } from '../routes.js';

/**
 * @typedef {object} RouteState
 * @property {string} path
 * @property {import('../site-map.js').MenuOption | null} entry
 * @property {import('../site-map.js').MenuOption | null} node
 */

/** @type {RouteState} */
const SHAPE = { path: '', entry: null, node: null };

/** @type {RouteState | null} */
let store = null;
let tracking = false;
/** @type {Set<(next: RouteState) => void>} */
const subscribers = new Set();

/** 读一次当前地址 → 导航树里的入口与节点 @returns {RouteState} */
function read() {
  const path = route();
  const hit = locate(path);
  return {
    path,
    entry: hit?.entry ?? null,
    node: hit?.node ?? null,
  };
}

/** 建 store（唯一一份响应式路由状态） @returns {RouteState} */
function create() {
  store = $.stanz({ ...SHAPE, ...read() });
  return store;
}

/** @returns {RouteState} */
export function routeState() {
  const state = store ?? create();
  startRouteTracking();
  return state;
}

export function startRouteTracking() {
  const state = store ?? create();
  if (tracking) return;
  tracking = true;

  const sync = () => {
    const next = read();
    if (state.path === next.path) return;
    Object.assign(state, next);
    for (const cb of [...subscribers]) cb(next);
  };

  window.addEventListener('hashchange', sync);
  document.addEventListener('router-change', sync);
}

/**
 * @param {(next: RouteState) => void} cb
 * @returns {() => void}
 */
export function onRouteChange(cb) {
  routeState(); // 保证 store 与监听都已就位
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
