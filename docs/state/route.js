/* 文档站**唯一的导航信号源**。
 *
 * 以前「跟着路由走」在 4 个文件里各挂一遍 hashchange + router-change（8 个监听），
 * 每处都要单独记得「olink 走 pushState、不触发 hashchange」（P28）—— 漏一个就是一处静默不更新。
 * 现在监听只在这里挂，消费方订阅同一个 store / 同一个订阅表。
 *
 * 两种消费方式（按需选）：
 *   · routeState()          拿响应式对象 —— 模板里可以按 {{nav.path}} 绑（ofa 会跟随，实测）
 *   · onRouteChange(cb)      拿订阅 —— JS 里要派生的（左栏行、面包屑、翻页）用这条
 *
 * ⚠️ 三个不显然的点：
 *   · **懒创建**：模块顶层调 $.stanz 会依赖 ofa 的执行顺序；这里只在首次取用时建。
 *   · **创建即写入当前路由**：组件可能比外壳的引导更早 attach，先有值再订阅，
 *     消费方就不用写「还没值」的分支。
 *   · **订阅表是自己的一张 Set**，不用 $.stanz 的 watch：watch 的返回值能不能退订
 *     没有官方说明（实测未验），而组件会随切页反复建/毁，退订必须可靠。
 */

import { locate } from '../site-map.js';
import { route } from '../routes.js';

/** store 形状。⚠️ 与模板里读的路径同形：给 null 会在首帧抛 text expression（P37） */
const SHAPE = { path: '', entry: null, node: null, hidden: false };

let store = null;
let tracking = false;
const subscribers = new Set();

/** 当前路由 + 它在导航树里的位置。`route()` 是纯读，locate 也是纯查询 */
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

function create() {
  store = $.stanz({ ...SHAPE, ...read() });
  return store;
}

/** 响应式状态对象（首次调用时创建并哨兵式地写入当前路由） */
export function routeState() {
  if (!store) create();
  startRouteTracking();
  return store;
}

/** 挂全局监听。幂等：布局页 / 组件反复建毁都不会重复挂 */
export function startRouteTracking() {
  if (!store) create();
  if (tracking) return;
  tracking = true;

  const sync = () => {
    const next = read();
    // 签名没变就不写：避免同一次导航里的多次事件引发无谓重渲染
    if (store.path === next.path) return;
    Object.assign(store, next);
    for (const cb of [...subscribers]) cb(next);
  };

  window.addEventListener('hashchange', sync);
  document.addEventListener('router-change', sync);
}

/**
 * 订阅路由变化（只在实际换页时回调）。返回退订函数 ——
 * 组件必须在 detached() 里调用它，否则切页后会留下改旧组件的回调。
 */
export function onRouteChange(cb) {
  routeState(); // 保证 store 与监听都已就位
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
