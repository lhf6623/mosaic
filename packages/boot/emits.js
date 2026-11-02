/**
 * emits.js —— 已并入 `options.js`（事件 + 插槽同一套声明），这里只留转发。
 *
 * 保留这个路径的两个理由：
 *   ① 仓库外的引用：`packages/boot/*` 是 CDN 上的产物，随手 `import { withEmits } from
 *      '…/boot/emits.js'` 的地方不该因为改名 404。
 *   ② 冻结期：组件正在逐个从 `withEmits` 换成 `withOptions`，两边都要能跑。
 *
 * 新代码请直接 `import { withOptions } from './options.js'`，用法见该文件头注释。
 */

export { withOptions, withEmits, DEFAULT_SLOT } from './options.js';
