/**
 * message — 命令式消息条（使用者只碰这个文件）：
 *   import message from '../../message/message.js';
 *   message.success('已保存');
 *   const m = message('正在上传…', { duration: 0 });  m.close();
 * 函数与容器组件只传数据；⚠️ 必须原地改数组，整体替换 rows 之后 o-fill 不更新且不报错；必须挂 document.body。
 */

/**
 * 队列项。
 * @typedef {object} QueueItem
 * @property {string} id
 * @property {string} type
 * @property {string} text
 * @property {boolean} icon
 * @property {string | null} iconName
 * @property {boolean} closable
 * @property {number} duration 0 = 不自动关
 * @property {string | null} key
 * @property {(() => void) | null} onClose
 * @property {ReturnType<typeof setTimeout> | null} timer
 */

/**
 * `message(input, config)` 收的字段（不传的走 DEFAULTS / 类型默认）
 * @typedef {object} MessageInput
 * @property {string} [text]
 * @property {string} [type]
 * @property {number} [duration]
 * @property {string} [key]
 * @property {boolean} [closable]
 * @property {boolean} [icon]
 * @property {string} [iconName]
 * @property {(() => void) | null} [onClose]
 */

/** mc-message 实例上本模块用到的那两块 @typedef {{ push: (item: QueueItem) => void, rows: QueueItem[] }} MessageHost */

/**
 * 语义类型：对齐 mc-alert 的四个语义色 + neutral，不新造色板
 * @type {Record<string, { icon: boolean, iconName: string | null }>}
 */
const TYPES = {
  neutral: { icon: false, iconName: null },
  info: { icon: true, iconName: 'info' },
  success: { icon: true, iconName: 'success' },
  warning: { icon: true, iconName: 'warning' },
  error: { icon: true, iconName: 'error' },
};

const DEFAULTS = {
  type: 'neutral',
  /** 毫秒；0 = 不自动关（要手动 close()） */
  duration: 3000,
  /** 同一 key 的消息只留一条：再来就把旧的那条换掉，不叠 */
  key: null,
  /** 右侧要不要 × 按钮。显式属性、默认 `true` —— 不跟 duration 推导：两件事混在一起看不出来 */
  closable: true,
  /** 同屏最多几条；超出从最旧的开始顶掉 */
  limit: 5,
};

/** 组件文件（相对本模块解析），首次调用时才注册 */
const COMPONENT_URL = new URL('./message.html', import.meta.url).href;

/**
 * 当前配置（message.config 改）
 * @type {typeof DEFAULTS}
 */
let options = { ...DEFAULTS };

/**
 * 队列项：{ id, type, text, icon, iconName, closable, timer, key }
 * @type {QueueItem[]}
 */
const queue = [];
/**
 * key → 队列项（同 key 更新 / close(key) 用）
 * @type {Map<string, QueueItem>}
 */
const byKey = new Map();

/** @type {Promise<MessageHost> | null} */
let hostPromise = null;

/** 自增 id：同毫秒连发也不会重（o-fill 的 fill-key 用它） */
let seq = 0;
const nextId = () => `${Date.now()}-${seq++}`;

/* ---------- 懒挂载：首次调用才注册组件 + 挂宿主，之后复用同一个容器 ---------- */

/**
 * 等 ofa 把实例挂上来（append 之后 $() 不一定立刻有；ready 是异步的）
 * @returns {Promise<MessageHost>}
 */
const waitForInstance = async () => {
  for (let i = 0; i < 40; i++) {
    const inst = $('mc-message');
    if (inst && typeof inst.push === 'function') return inst;
    /** @type {Promise<void>} */
    const nextFrame = new Promise((r) => requestAnimationFrame(() => r()));
    await nextFrame;
  }
  throw new Error('[mosaic] mc-message 没有在预期时间内就绪');
};

/**
 * 挂载容器：必须先用 `<l-m>` 注册，`document.createElement` 才能升级（注册是异步的）
 * @returns {Promise<MessageHost>}
 */
const mount = () => {
  if (hostPromise) return hostPromise;

  hostPromise = (async () => {
    if (!customElements.get('mc-message')) {
      const loader = document.createElement('l-m');
      loader.setAttribute('src', COMPONENT_URL);
      /* ⚠️ l-m 是加载占位：站点样式那条 `l-m { display: none }` 不管挂到 body 的这个，得自己藏好免得占一行高度 */
      loader.style.display = 'none';
      document.body.append(loader);
      for (let i = 0; i < 200 && !customElements.get('mc-message'); i++) {
        await new Promise((r) => setTimeout(r, 20));
      }
      if (!customElements.get('mc-message')) {
        hostPromise = null;
        throw new Error(`[mosaic] 加载 ${COMPONENT_URL} 失败：mc-message 没有注册成功`);
      }
    }

    const host = document.createElement('mc-message');
    /* 定位写在宿主行内：行内会压住组件 :host，「挂哪儿」不该由组件钉死 */
    host.style.cssText =
      'position: fixed; top: var(--mc-space-6, 1.5rem); left: 50%; transform: translateX(-50%); ' +
      'z-index: var(--mc-z-toast, 1500); pointer-events: none;';
    document.body.append(host);

    const inst = await waitForInstance();
    /* 组件把「被点掉」抛成 close 事件；本模块负责清定时器与索引 */
    /** @param {Event} event */
    const onClose = (event) => {
      /* event 的静态类型只有 Event，close 事件带的是 detail.id（EventListener 签名收不窄，这里自己收） */
      const { detail } = /** @type {CustomEvent<{ id?: string }>} */ (event);
      /* ⚠️ 必须走 drop()：组件只把行从 rows 摘掉，队列里这条还在 —— 只清一半会持续泄漏，onClose 也永远不触发 */
      drop(detail?.id);
    };
    host.addEventListener('close', onClose);
    return inst;
  })();

  return hostPromise;
};

/* ---------- 队列操作 ---------- */

/** @param {QueueItem | null} item */
const clearTimer = (item) => {
  if (item?.timer) {
    clearTimeout(item.timer);
    item.timer = null;
  }
};

/**
 * 从队列里删掉一条（按 id）。返回是否删掉了。
 * @param {string | undefined} id
 * @returns {Promise<boolean>}
 */
const drop = async (id) => {
  const index = queue.findIndex((item) => item.id === id);
  if (index < 0) return false;
  const [item] = queue.splice(index, 1);
  clearTimer(item);
  /* 先撤 key 再回调：回调里很可能用同一个 key 再推一条，留着旧映射会去替换一条已经不在队列里的旧项 */
  if (item.key) byKey.delete(item.key);
  /* 告诉生产者「这条没了」—— close() / 点 × / duration 到点都走这里，只调一次；⚠️ 没有它，生产者下一拍又把同 key 的消息推回来 */
  if (typeof item.onClose === 'function') {
    try {
      item.onClose();
    } catch (err) {
      console.error('[mosaic] message 的 onClose 回调抛错：', err);
    }
  }
  const inst = await mount();
  const at = inst.rows.findIndex((row) => row.id === id);
  if (at >= 0) inst.rows.splice(at, 1);
  return true;
};

/** @param {QueueItem} item */
const arm = (item) => {
  if (!item.duration) return;
  item.timer = setTimeout(() => {
    drop(item.id);
  }, item.duration);
};

/**
 * 超出上限时，从最旧的开始顶掉
 * @returns {Promise<void>}
 */
const enforceLimit = async () => {
  while (queue.length > Math.max(1, options.limit)) {
    await drop(queue[0].id);
  }
};

/* ---------- 公开 API ---------- */

/**
 * 弹一条消息，返回 `{ close }`（`close()` 立刻收掉这一条）。
 * @param {string | MessageInput} input 文本，或一份带字段的对象
 * @param {MessageInput} [config] 覆盖默认值的字段（同一条消息上的写法优先）
 * @returns {{ close: () => Promise<boolean>, readonly id: string }}
 */
export function message(input, config = {}) {
  /** @type {MessageInput} */
  const raw = typeof input === 'string' ? { text: input, ...config } : { ...input, ...config };
  const type = typeof raw.type === 'string' && TYPES[raw.type] ? raw.type : DEFAULTS.type;
  const spec = TYPES[type];

  const duration = raw.duration ?? options.duration;
  /** @type {QueueItem} */
  const item = {
    id: nextId(),
    type,
    text: String(raw.text ?? ''),
    icon: raw.icon ?? spec.icon,
    iconName: raw.iconName ?? spec.iconName,
    closable: raw.closable ?? options.closable,
    duration,
    key: raw.key ?? null,
    /** 这条消失时回调（关掉 / 到点 / close() / closeAll() 都算），只调一次 */
    onClose: typeof raw.onClose === 'function' ? raw.onClose : null,
    timer: null,
  };

  /* 同 key 更新语义：把旧的那条换掉（位置也换，不叠成两条）；⚠️ byKey 必须同步写，等 await 之后同一 tick 的第二次就查不到第一条了 */
  const existing = item.key ? byKey.get(item.key) : null;
  if (item.key) byKey.set(item.key, item);

  (async () => {
    if (existing) {
      const at = queue.indexOf(existing);
      clearTimer(existing);
      if (at >= 0) {
        queue[at] = item;
        const inst = await mount();
        const rowAt = inst.rows.findIndex((row) => row.id === existing.id);
        if (rowAt >= 0) inst.rows.splice(rowAt, 1, item);
      }
    } else {
      queue.push(item);
      const inst = await mount();
      inst.push(item);
    }
    await enforceLimit();
    arm(item);
  })();

  return {
    close: () => drop(item.id),
    get id() {
      return item.id;
    },
  };
}

/* 四种类型 + neutral 的简写。都返回 `{ close }`。 */
for (const type of Object.keys(TYPES)) {
  /**
   * @param {string | MessageInput} input
   * @param {MessageInput} [config]
   */
  const shorthand = (input, config = {}) =>
    message(typeof input === 'string' ? { text: input, type } : { ...input, type }, config);
  // 用 Object.assign 挂上去：函数类型没有字符串索引签名，直接 message[type] = 过不了类型检查
  Object.assign(message, { [type]: shorthand });
}

/**
 * 关掉指定的那一条（按 key 或 message() 返回的 id）。
 * @param {string} key
 * @returns {Promise<boolean>}
 */
message.close = (key) => {
  const item = byKey.get(key) ?? queue.find((row) => row.id === key);
  return item ? drop(item.id) : Promise.resolve(false);
};

/**
 * 全收掉。
 * @returns {Promise<void>}
 */
message.closeAll = () => {
  const ids = queue.map((item) => item.id);
  return Promise.all(ids.map((id) => drop(id))).then(() => undefined);
};

/**
 * 改默认值（只影响之后创建的消息）。
 * @param {Partial<typeof DEFAULTS>} [next]
 * @returns {typeof DEFAULTS}
 */
message.config = (next = {}) => {
  options = { ...options, ...next };
  return { ...options };
};

export default message;
