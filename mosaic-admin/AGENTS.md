# AGENTS.md — mosaic-admin 会话约定

> 这份管 `D:\mosaic\mosaic-admin\`。仓库级约定（测试只跑最小范围、不擅自 commit/push、
> ofa 写法规范）仍见上层 `D:\mosaic\AGENTS.md` 与 `packages/README.md`。

## 当前状态（每次开工先看这里）

- 2026-11-16：**P0 + G2 外壳 + mc-data-grid v0 + erp-page v0 已完成**；
  **已接旧仓 dev 真接口**（登录 / 用户列表 / 委托单列表 / 字典 / 分页）；
  **详情抽屉 + 表单第 1 节已完成**（库新增 `mc-drawer`；表单用 `mc-form`，保存回写真实 update）。
  下一步：导入流程切片。
- 方案主文档：`docs/plan-probe.md`（探针 = 当前主方案）；仓库形态与签出：`docs/plan-collaboration.md`；
  背景与数据：`docs/assessment-rewrite.md`；旧仓基线：`docs/baseline.md`；
  **mc-grid 契约**：`docs/mc-grid-contract.md`（P1 写 `api.md` 前先评审这份）。
- 旧仓 `D:\ed-nextscm-web` **只读**：只准读需求、抄逻辑、当验收基线；不改它、不 import 它、不 1:1 追平。

## 硬规则（违反即返工）

1. 本目录引用库只有一条路径：`vendor/mosaic/<slug>/<slug>.html` 与 `vendor/mosaic/boot/mosaic.css`
   （从子目录用 `../vendor/…`）；**不许**出现 `../packages/`、`docs/`、组件单元内部的 `.js`。
   `check:app` 按"引用值"逐条校验，并检查被引文件真实存在。
2. 库（`packages/`、`docs/`、`tools/`、`tests/`）**不许 import 本目录**。
3. 页面 ≤ 120 行；页面第一行是元信息：`<!-- page: {"label":"…","group":"…","order":0} -->`；
   **页面不写 `export const parent`**（外壳是常驻 o-page，页面没有父页面）；站内链接只写 hash
   `#/pages/…`、不许写 `olink`；页面里不写业务计算、不直接 `fetch`、不拼列内容。
4. 新组件进库前，本目录里必须有 **≥ 2 个真实调用点**（或 `packages/<slug>/demos` 有等价用例）。
5. 组件契约变更必须**同一次提交**更新 `api.md` + `CHANGELOG` + 受影响页面。
6. `vendor/mosaic` 是链接，**永不手改**；改它就是改库。链接由 `tools/link-vendor.mjs` 建（缺了两边都会失败）。
7. `vendor/lib/` 只放 UMD 副本，每个文件在 `vendor/lib/README.md` 记版本与来源。
8. `tools/` 的生成物（`pages.registry.js`）必须可重生成；缺页面 / 规则表过期要**直接失败** ——
   生成物在 `.prettierignore` 里，别手动格式化。

## 边界判定（不知道放哪就问这张表）

| 东西                                                                     | 归属                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------- |
| 换任何业务都成立、无业务名词                                             | `D:\mosaic\packages\`（要过准入 + 测试 + tag） |
| 只在"ERP 后台"语境成立（page 引擎 / edit-table / 详情抽屉 / 审计条）     | 本目录 components/                             |
| 与渲染无关的纯 JS（api / enums / 权限码 / 字典 / schema / cell / logic） | 本目录 shared/                                 |
| 只描述"这页长什么样、接哪些动作"                                         | 本目录 pages/                                  |

## 不要做的事

- 不要为了赶进度把业务形状（`permission` / `orderNo` / `apiPrefix`）写进库；
- 不要在没跑 `pnpm check`（库）与 `pnpm check:app`（本目录）时宣称完成；
- 不要跑 `pnpm test:all` 或整份重录（见上层 AGENTS.md）；
- 不要 `git commit` / `git push`，除非使用者明确要求。

## 外壳架构（G2 决定，别再改回去）

- 入口是 `index.html` → `<admin-shell>`；**不引 `<o-app>` / `<o-router>`**（`check:app` 拦）。
  原因：o-app 只复用同 src 的父页面，leaf 导航会销毁页面，多标签状态必丢。
- 路由 = 外壳自己的 hash 监听（`#/pages/<域>/<页>.html`）；菜单项 href 就是 hash，原生锚点只改地址栏。
- 每个标签一个常驻 `<o-page>` + 一层 `.view`，切走只 `display:none`；关标签才销毁实例。
- 主题：`<html data-theme>` 两态 + localStorage（键 `mosaic-admin-theme`），首帧由 index.html 的同步脚本写入。
- 顶栏搜索按页面注册表过滤；标签上限 12，超了先关最久没激活的；标签右键菜单在 `admin-shell` 里。
- 权限码只在 `shared/perm.js` 定义（页面引用 `PERM` 常量、用 `<erp-perm>` 包按钮）；`check:app` 拦字面量。
- 详情一律用 `mc-drawer`（库）+ `components/*-detail-drawer.html`：组件暴露 `show(id/row)`，
  自己取数 / 拼展示 HTML；页面只绑 `on:cell-click` 调 `show(...)`。
- 表单用 `mc-form` + `mc-form-item`：校验规则（含 `validator`）在组件 `attached` 后按 property 写
  `form.rules`；动态初值写各控件 `value`（mc-input 受控通道）；提交按钮在抽屉 footer 里调 `form.submit()`。
- 列表页一律用 `components/erp-page.html`：schema / cell / logic 放 `shared/modules/<域>/<模块>/`，
  页面只做「拿数据 → setRows → 处理 search/action/事件」。搜索项 v0 只支持 input（select 的轻 DOM 选项
  动态挂载时序未定，等通道方案）。

## 接口与会话（真接口已接）

- 网关：`config.API_BASE`（旧仓 dev：`http://192.168.1.74:9999`）；CORS 已放行，浏览器直连。
- **页面 / 组件不直接 fetch**：只经 `shared/http.js`；具体接口收在 `shared/api/*.js`；
  业务模块（`shared/modules/**`）负责拼参数与把字典码翻成展示行。
- 登录：`shared/auth.js`（OAuth2 密码模式；密码 AES-CFB 用 `vendor/lib/crypto-js` 加密）。
  会话存 localStorage `mosaic-admin-session`；未登录时外壳守卫送回 `pages/login.html`（hidden 页，不进菜单）。
- 权限：登录后 `/admin/user/info` 的 permissions 回填 `shared/perm.js`；按钮权限用真实码（如 `bus_import_export`）。
- 分页：旧仓参数是 **current / size**（不是 page）；换页走 `mc-pagination` + `erp-page` 的 `page-change`。
- **账号密码不进仓库**：登录页现场输入；换环境只改 `config.js`。
- 委托单保存：`POST /api/orderImport/update`，主表字段 + `orderImportDetailDTOList`（明细带 id）+
  `orderDeliveryTakeDTOList` / `orderDeliverySendDTOList`（后端要求非 null，空数组即可）。

## 已知的框架级阻断项（2026-11-16 实测）

- **函数对象不能进 ofa 的数据通道**：页面 `data` 放函数会让整页渲染失败；把含函数的 `columns`
  赋给组件 property，在 `<o-page>` 上下文会触发 ofa 内部 `设置属性值 rows 出错`
  （普通 HTML 宿主里能跑，mc-table 原版也正常）。所以 `mc-grid` 契约只收字符串 / 名字，
  单元格 HTML 由业务模块的纯函数产出（见 `docs/mc-grid-contract.md` §1）。
- **多标签页不能靠 o-app 换 leaf**：o-app 只复用同 src 的父页面，leaf 会被销毁；
  状态保持要常驻 `<o-page>` + 只切显隐（spike C 实测 0.11MB/页）—— 已按此实现，别再引 o-app 回来。

## 判定节奏

每两周做一次"签出演练"：把 `mosaic-admin` 拷到临时目录、`vendor/mosaic` 换成真实副本，
**能脱离 mosaic 仓单独启动**才算通过。
