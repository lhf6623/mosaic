/**
 * 运行期配置 —— 环境值只在这一份文件里。
 *
 * 为什么单独一份：页面 / 组件里不写 URL 与网关前缀（硬规则：页面不直接 fetch），
 * 全部经 shared/http 从这里拼地址；换环境（本地 / 测试 / 生产）只改这里。
 */
export const APP_TITLE = 'Mosaic Admin';

/** 探针工程版本：跟着 P0/P1 里程碑走，不是库的版本 */
export const APP_VERSION = '0.2.0-g2';

/** 接口根：旧仓 dev 网关（CORS 已放行，浏览器可直连） */
export const API_BASE = 'http://192.168.1.74:9999';

/** 网关要求的两个头（旧仓 config.apiHeaders 同源） */
export const API_VERSION = 'beta';
export const TENANT_ID = '1';

/** OAuth2 密码模式客户端 + 前端密码加密密钥（与旧仓 .env 一致） */
export const AUTH_CLIENT = 'nextscm:nextscm';
export const PWD_ENC_KEY = 'xl4vJqLnKZi9LrIF';

/** 登录态存 localStorage 的键；token 过期 / 退出时由 shared/auth.js 清掉 */
export const SESSION_KEY = 'mosaic-admin-session';

/** 登录页路由（隐藏页，不进菜单）与首页 */
export const LOGIN_ROUTE = 'pages/login.html';
export const HOME_ROUTE = 'pages/home.html';

/** 列表默认每页条数 */
export const PAGE_SIZE = 20;

/**
 * 当前用户的权限码：null = 不限（未登录 / 探针默认全部放行）。
 * 登录成功后 shared/auth.js 会用 /admin/user/info 的 permissions 回填。
 */
export const GRANTED_PERMISSIONS = null;
