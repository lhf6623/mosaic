# mosaic-admin（探针工程）

> 位置：`D:\mosaic\mosaic-admin\` —— Mosaic 仓库内的孵化应用。
> 签出时用 `git subtree split -P mosaic-admin`，把本目录整体搬成独立仓库。
> 状态（2026-11-16）：**P0 骨架已落地**，G2 外壳（多标签页 / 主题 / 自建 hash 路由）已通；下一步 mc-grid 与垂直切片。

## 这是什么

用真实 ERP 需求驱动 Mosaic 组件成熟，同时验证 Web Components + ofa.js + 免构建能否撑住
20 万行 / 800 页量级的 ERP。**不是 1:1 复刻**：只做探针切片，旧仓继续演进、不追平。

- 需求源 / 参考实现 / 回归基线：`D:\ed-nextscm-web`（**只读**，不抽目录、不改构建、不当依赖）
- 组件库：`D:\mosaic\packages\`（本目录只通过 `./vendor/mosaic/…` 消费）

## 当前结论（来自 docs/assessment-rewrite.md）

| 问题          | 结论                                                    |
| ------------- | ------------------------------------------------------- |
| 整站 1:1 重写 | 不建议，中性 30–40 人月                                 |
| 路线          | 探针优先：8 个切片 / 10 周 / 2 人 / 3 道闸门            |
| 判定          | 继续 / 收敛 / 放弃（阈值见 docs/plan-probe.md 第 6 节） |
| 最大单点风险  | `mc-table` 不是 ERP 级数据网格（298 个列表页全靠它）    |
| 第二风险      | 浮层依赖 Chrome/Edge 125+，企微内置浏览器可能不可用     |

## P0 状态（2026-11-16 完成）

- [x] `tools/link-vendor.mjs`：建 `vendor/mosaic` 链接（Windows junction / 其它平台 symlink；`--check` 供 check:app 复用）
- [x] `index.html` + `app-config.js` + `config.js` + `shell/shell.css`：最小可运行外壳（ofa + `<o-router>` + `<o-app>`）
- [x] `shell/layout.html`：侧栏菜单 + 顶栏面包屑 + 内容 slot（菜单 / 标题由页面注册表驱动）
- [x] `tools/page-registry.mjs`：扫 `pages/**/*.html` 首行元信息生成 `pages.registry.js`，`--check` 对账
- [x] `tools/check-app.mjs`：路径边界 / 反向引用 / 页面 ≤120 行 / 元信息 / parent / 注册表新鲜度 / vendor 链接
- [x] 三个 spike：cell 函数通道 / 500 行 sticky / 标签页状态保持（`pnpm spike:admin` 全绿，结论与数据见 docs/mc-grid-contract.md）
- [x] `mc-grid` 契约草案：docs/mc-grid-contract.md（**v0.1 评审稿**，P1 按它先写 api.md）
- [x] 仓根接线：`package.json` 的 `dev:admin` / `check:app` / `spike:admin`；`.gitignore` 忽略 `vendor/mosaic`

### 骨架页面（占位，G2 接真接口）

| 页面       | 路由                           | 说明                                                                           |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------ |
| 工作台     | `pages/home.html`              | 首页，列出切片入口                                                             |
| 风险列表   | `pages/risk/list.html`         | 简单列表切片骨架：搜索项 + 24 行假数据（表格行走 `:html`，与 mc-table 同范式） |
| 委托单列表 | `pages/import-order/list.html` | 重列表切片占位，等 mc-grid 契约实现                                            |

## G2 进度（2026-11-16 起）

- [x] **外壳**：`shell/admin-shell.html` 自建 hash 路由（`#/pages/<域>/<页>.html`）+ 常驻 `<o-page>` 多标签页
      （切走只隐藏，状态 / 滚动位置保留）+ 亮暗主题切换；o-app 已从链路移除（原因见 docs/mc-grid-contract.md §4）
- [x] **erp-page v0**（schema 驱动搜索 / 工具栏 / 数据网格；列 / cell / 过滤沉到 `shared/modules/<域>/<模块>/`）
- [x] **按钮级权限**（`shared/perm.js` 权限码 + `<erp-perm>` 容器，登录后 `setPermissions()` 回填）
- [x] **全局搜索**（顶栏按注册表搜页面，↑↓ / Enter / Esc）与**标签页上限 + 右键菜单**（关闭 / 关闭其他 / 关闭右侧）
- [x] **mc-data-grid v0 进库**（`packages/data-grid/`；`mc-grid` 标签被布局栅格占用所以换名）；
      简单列表（risk）与重列表（import-order 500 行）已接上，满足新组件 ≥2 调用点
- [ ] 表单第 1 节 / 详情抽屉 / 导入流程切片；接真接口（等后端可用）

## 真接口（2026-11-16 接入）

| 项   | 值                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------- |
| 网关 | `config.API_BASE = http://192.168.1.74:9999`（旧仓 dev 代理目标；CORS 已放行，浏览器直连）                     |
| 登录 | OAuth2 密码模式 `POST /auth/oauth2/token?grant_type=password`，密码 AES-CFB 加密（`vendor/lib/crypto-js`）     |
| 会话 | localStorage `mosaic-admin-session`（accessToken / refreshToken / user.permissions）；424/401 自动回登录页     |
| 权限 | 登录后 `/admin/user/info` 的 permissions 回填 `shared/perm.js`（真实码，如 `bus_import_export`）               |
| 列表 | `/admin/user/page`（19 条真实用户）、`/api/orderImport/page`（206 条真实委托单，固定 `acceptStatus=ACCEPTED`） |
| 字典 | `/admin/dict/type/{type}`（订单状态 / 审核状态 / 入库状态按字典翻中文）                                        |
| 分页 | 旧仓分页参数是 **current / size**（不是 page）；`mc-pagination` 翻页 / 每页条数都走真实接口                    |

> ⚠️ **仓库里不存任何账号密码**：登录页由使用者现场输入；开发账号仅本机使用。换环境改 `config.js` 一处即可。

## 交互约定

- **列表行单击不导航**：进入详情的明确入口是「链接列」（委托单号 / 用户名，可复制、可中键新标签）或**行双击**；
  复选框、行内「编辑」等按钮各走各的事件，不会因为点一下就跳页。
- 详情页关联 Tab 支持深链：`?id=…&tab=<菜单id>`。
- 列表页：白面板卡片（工具栏/表格/页脚一块），去斑马纹、表头与面板同底，数据层加重（单号/金额 600 字重）；
  无大标题/说明行，表头不排序（纯展示），一条工具栏（筛选 + 查询/重置 + 业务动作）+ flex:1 网格 + 固定单行页脚；
  **只有网格内部滚动**（外壳不出滚动条，分页始终在视口内）；首列「序号」（按分页偏移算全局值），
  页脚带「每页 10/20/50/100 条」选择器，
  「批量导出 / 清空选择」未选行时禁用；操作列保证一屏可见（长文本省略 + title）。

## 本地怎么跑

```bash
node mosaic-admin/tools/link-vendor.mjs   # 一次性：建 vendor/mosaic 链接（签出后用真实副本代替）
pnpm dev                                  # 仓库根起本地服务（8642）
# 打开 http://127.0.0.1:8642/mosaic-admin/

pnpm check:app                            # 应用边界 / 页面行数 / 注册表 / vendor 链接
# 打开 http://127.0.0.1:8642/mosaic-admin/ 会先跳登录页（用旧仓 dev 账号登录）
pnpm spike:admin                          # 三个 P0 spike（需要 8642 在跑 + 本机 Chrome）
```

深链：应用自己管 hash，格式是 **admin 相对路径** `#/pages/<域>/<页>.html`（如 `#/pages/risk/list.html`），
子路径部署不用带前缀；站内链接一律写这种 hash（`check:app` 守着不许再出现 `olink`）。

## 目录（当前实际）

```text
mosaic-admin/
├─ index.html / config.js
├─ pages.registry.js        # 生成物（tools/page-registry.mjs），别手改
├─ vendor/mosaic            # 链接 → ../../../packages（git 忽略）
├─ vendor/lib/              # 第三方 UMD（P0 为空，README 已立规矩）
├─ shell/                   # admin-shell.html（外壳：路由 / 标签页 / 搜索 / 主题）/ shell.css / favicon.svg
├─ components/              # erp-page / order-edit / order-detail（Tab 壳）/ order-tab-*（各关联页签）/ user-detail-drawer
├─ pages/                   # home / risk / import-order（一个页面一个 .html，首行是元信息）
├─ shared/                  # 纯 JS：http / auth / perm / api / format / modules
├─ styles/page.css          # 业务页共用样式（页头 / 工具条 / 面板 / 表格 / 瓦片）
├─ spikes/                  # 三个 P0 探针（cell-channel / table-500 / tab-state）
├─ tools/                   # link-vendor / page-registry / check-app / spike
└─ docs/                    # plan-* / baseline / mc-grid-contract
```

## 文档

先读 [docs/README.md](docs/README.md)（索引与阅读顺序）。
