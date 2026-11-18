# AGENTS.md — mosaic-admin 会话约定

> 这份管 `D:\mosaic\mosaic-admin\`。仓库级约定（测试只跑最小范围、不擅自 commit/push、
> ofa 写法规范）仍见上层 `D:\mosaic\AGENTS.md` 与 `packages/README.md`。

## 当前状态（每次开工先看这里）

- 2026-11-16：**P0 + G2 外壳 + mc-data-grid v0 + erp-page v0 已完成**；
  **已接旧仓 dev 真接口**（登录 / 用户列表 / 委托单列表 / 字典 / 分页）；
  **表单与委托单详情都已改成整页**（2 栏字段 + 子表；详情 4 节只读），抽屉只留轻量场景。
  决策见 `docs/form-shell-decision.md`。
  下一步：明细子表可编辑（mc-data-grid 编辑模式）/ 导入流程切片。
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
- 标签条直接用库的 `mc-tabs` + `mc-tab`：`no-panel`、`variant="line"`、每项 `closable`；
  容器只做 `--mc-tabs-*` 令牌覆盖（白底 + 下边框、项高 40px、激活下划线），**不要手写 tab 条**；
  关闭 × 发 `close` 事件（带 value），关哪个 / 切到哪由外壳决定。
- 标签条**增量同步**：`syncTabs()` 能复用 `mc-tab` 元素就复用，只在开关页时增删；切页只改
  `tabs.value`，不要 `replaceChildren` 整条重建（会闪）。`--mc-tabs-*` 颜色令牌要传 rgb 三元组，
  传 `transparent` 会退化成 `currentColor`（一条深色边框闪一下）。
- 权限码只在 `shared/perm.js` 定义（页面引用 `PERM` 常量、用 `<erp-perm>` 包按钮）；`check:app` 拦字面量。
- **委托单这类重详情一律整页**（hidden 路由 `pages/<域>/<页>/detail.html?id=…` + `components/*-detail.html`），
  列表点行直接跳转；抽屉只做轻量只读（用户详情）与子表行表单。
- **详情页的关联 Tab 走菜单配置**（`/admin/menu?type=3&parentId=`），不是写死面板：
  `shared/modules/<模块>/detail-tabs.js` 只做「旧 componentPath → 本地组件」映射；没映射的用
  `order-tab-placeholder` 明示「待接入」。Tab 懒挂载（首次激活才创建 + load），之后只切显隐；
  `?tab=<菜单id>` 深链；权限用菜单节点的真实 permission 过 `can()`。
- **表单一律整页**（hidden 路由 `pages/<域>/<页>/edit.html?id=…`，组件 `components/*-edit.html`）：
  字段两栏 + 子表整宽；抽屉只用于详情 / 子表行表单 / 选择器。
- 表单用 `mc-form`：校验规则（含 `validator`）在组件 `ready` 后按 property 写 `form.rules`；
  动态初值写各控件 `value`（mc-input 受控通道）；保存按钮在表单外时调 `form.submit()`。
- hidden 表单页做**脏标记**：
  切标签保留本地改动；「取消/返回」清脏并丢弃；同一单再次进入时只有不脏才重新拉服务端。
  页面自己解析 `location.hash` 的 `?id=`（shell 的 `routeFile()` 只取文件段匹配注册表）。
- 页面 init 里 `await customElements.whenDefined('x')` 必须和模板里的 `<l-m>` 成对：
  删了组件引用却留着 await，init 会永久挂起（列表空白、无报错）—— 本次踩过。
- 列表**行单击不导航**（防误触）：进入详情要有明确目标 —— 链接列（委托单号 / 用户名，可复制、中键新标签）
  或行双击；复选框、行内按钮各走各的事件，不吃一次点击就跳页。
- 列表状态用库的 `<mc-tag variant="dot" color="#...">`（色点 + 文字）：hex 对比度由 tag 的 color-attr
  自动校正（含暗色）；**不要**手写 span/色块，也不要归并到少数语义色（会把不同状态压成同色，踩过）。
- 委托单列表的列按老仓 `acceptance-center/import-order` 的 `columns` 全量（31 列）：受理/客户/单号/各状态/
  业务模式/日期/合同/供应商/融资/销方/主体/币别/总价/结算/开票/收票/抬头/成交/包装/商务/备注/来源/
  创建人/创建时间 + 操作；列多后由网格**内部横向滚动**（`grid-wrap` 与网格宿主都要 `min-width:0`，
  否则 flex 子项被内容撑宽、被面板裁掉）。改列先对老仓这份 `columns`，别随手增删。
- 冻结列走库的列属性 `fixed: 'left' | 'right'`：**复选框 + 序号固定左侧、操作固定右侧**；
  `erp-page` 注入的序号列默认 `fixed:'left'`，各 schema 的 `ops` 列写 `fixed:'right'`；
  `selectable` 时复选框列由网格自动并入左侧组。冻结列必须给固定 `width`、只在首/尾连续列上使用；
  **不要给冻结列画分隔竖线**（两侧硬线抢眼）；用库的软阴影 `--mc-data-grid-fixed-shadow`（“浮起一层”），
  实现是**左右各一个容器**（库内部三张同源表格：左固定 / 中间可滚 / 右固定，逐行同步高度），
  阴影投在容器上、不是盖在表格上的浮层；只在滚动条离开该侧边界后出现（贴左无左阴影、贴右无右阴影），
  由网格内部管理，页面别自己加。
- 底部合计：schema 列上写 `sum: { field: 'totalMoney', format: 'money' }` 即参与合计；
  `erp-page` 按**当前页**行求和后写 `grid.summary`；库渲染**表内对齐的合计行**（`tfoot.mc-summary`，首列「合计」、
  数值列下显示值，sticky 在列表底部/分页条上方）。「共 N 条」不写在页脚，由分页组件的 `show-total` 渲染；
  页脚只放选中/最近动作。目前老仓列表合计列只有「报关总价」。
  内容不足时用 `tbody.mc-layout-spacer` 顶底（只做布局、不可交互），数据行在 `tbody.mc-body` 里；
  装得下时网格会锁纵向滚动（`data-fit-y`），只有横向滚动条。
- 列表页一律用 `components/erp-page.html`：schema / cell / logic 放 `shared/modules/<域>/<模块>/`，
  **页面直接声明 `:schema` / `:loader`**：schema 放 `data`（纯对象），loader 是 `proto` 方法，
  模板写成 `:schema="schema" :loader="loader"`。`erp-page` 用 `attrs: { schema, loader }` 声明参数、
  在 attached / watch 里接住（这个声明是必需的，否则模板绑定会静默丢掉）。查询 / 重置 / 翻页 /
  每页条数 / 首查 / 加载态 / 错误 / 合计 / 选中页脚都归 `erp-page`，页面不再自己串 API、不再
  `load(1)`、不再监听 search / page-change / select-change。数据保存后广播
  `admin-data-changed`，schema 上写 `reloadOn: '<module>'` 即自动重载；工具栏动作只写
  `page.footerHint`。搜索项 v0 只支持 input（select 的轻 DOM 选项动态挂载时序未定，等通道方案）。
- 列表视觉走**极简**：内容白底铺满（`erp-page` 的 `.list-panel`），**不要卡片外框 / 投影 / 斑马纹**；
  层级只靠工具栏/页脚各一条 divider + 行细线 + 字重。表头与内容同底色（data-grid 宿主内联令牌：
  head-bg=surface、hover-bg=primary-subtle、pad-x=space-3）。
- 长文本列交给库组件 `mc-ellipsis`（单行省略 + 可选中/复制浮层），**不要**在 cell.js 里自己 `truncate` 或加 `title`；
  `erp-page` 已用 `<l-m>` 注册该组件，cell 里直接输出 `<mc-ellipsis>文本</mc-ellipsis>`。
- 数据层：单号/用户名链接 500 字重主色、金额 600 + tabular-nums；状态**不要彩色 chip**（一行 3 个 × 20 行太吵），
  用 `mc-tag variant="dot"`（库负责色点 + ring + 暗色可见）。
- **优先用库组件，不要重复造 UI**：明细表用 `mc-data-grid`（禁止手写 `<table>`），状态用 `mc-tag`，
  标签条用 `mc-tabs`/`mc-tab`，按钮/输入/表单/分页同理；缺能力时先补库（组件 + api.md + 演示 + 测试），
  再在业务里用 —— 这是使用者的明确要求。
- ⚠️ `styles/page.css` 里有通用 `.page`（padding 24 / gap 16 / max-width）与 `.panel`（边框/圆角/overflow），
  组件里**不要复用这两个类名**（列表壳用 `.list-page` / `.list-panel`；踩过两次）。
- 列表页**不要写大标题 / “本页是什么”的说明行**（页名由外壳面包屑 + 标签表达）：
  一条工具栏（左筛选 + 查询/重置，右业务动作）+ flex:1 的网格 + 固定单行页脚（条数 / 选中 / 分页 + 每页条数）。
- 列表**不启用排序**：`erp-page` 的网格不写 `sortable`、schema 列不写 `sortable: true`（业务方明确不要表头排序）。
  库的表头箭头已改成「宿主 sortable + 列 sortable 才显示」，关掉排序后就是纯文字。
- 列表序号：schema 里写 `indexColumn: { title: '序号', width: '56px' }` 即可，`erp-page` 会把它插到第一列，
  并按「(当前页-1)×每页条数 + 行下标」算全局序号（默认居中对齐，可在 `indexColumn.align` 改）；
  **页面不要自己拼序号列**。
- 每页条数由 `erp-page` 内的 `mc-pagination sizer page-sizes` 提供（10/20/50/100）；
  页面查询用 `this._page.pageSize`，不要在页面里另存一份；改条数时 `erp-page` 自动回第 1 页。
  单页数据也要显示分页条——sizer 在里面，藏掉就没法改每页条数。
- **滚动归属**：列表页是满高 flex（`erp-page` host / `.page` 都 `height:100%`），**只有网格内部**
  （`mc-data-grid` 的 `.mc-wrap`）滚；外壳 `.view` 在列表页不出滚动条，页脚/分页固定在视口内。
  详情/编辑这类长内容页仍由 `.view` 整页滚（`shell .view o-page { height:100% }` 不影响它）。
- 列宽要保证「操作列一屏可见」：客户名这类长文本给固定宽 + 省略号 + `title`，别让 nowrap 把操作列挤出屏幕；
  `批量导出 / 清空选择` 等动作配 `requiresSelection`，没选行时禁用。

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

- **函数不要作为 `data` 的值**：页面 / 组件 `data` 里放函数（哪怕不绑定）会让 ofa 加载失败。
  `proto` 方法可以经模板 `:prop="方法名"` 传给子组件，但子组件必须在配置里 `attrs: { prop: null }`
  声明接收参数，否则绑定会被静默丢弃。函数值放 `data` 仍然不行，loader 这类放 `proto`。
- **多标签页不能靠 o-app 换 leaf**：o-app 只复用同 src 的父页面，leaf 会被销毁；
  状态保持要常驻 `<o-page>` + 只切显隐（spike C 实测 0.11MB/页）—— 已按此实现，别再引 o-app 回来。

## 判定节奏

每两周做一次"签出演练"：把 `mosaic-admin` 拷到临时目录、`vendor/mosaic` 换成真实副本，
**能脱离 mosaic 仓单独启动**才算通过。
