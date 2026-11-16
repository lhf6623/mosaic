# 两边受益 v3：库与 ERP 在同一个仓里孵化，成熟后再签出

> 前提：**旧仓 `ed-nextscm-web` 只读**（不抽目录、不改构建）；重组全部发生在新工程；
> 新工程**孵化期住在 `D:\mosaic\mosaic-admin\`**，等库的 API 稳定、首次公开 tag 之前再 `git subtree split` 签出成独立仓库。
> 相关：[可行性评估](./assessment-rewrite.md)

---

## 0. 结论

**同仓孵化这个判断是对的，而且"还没发版"正是唯一低成本的窗口。** 但"在 mosaic 下建一个 admin 目录"要加两个约束才成立：

1. **应用只能通过 `./vendor/mosaic/…` 这个固定入口消费库**（孵化期该目录是指向 `packages/` 的本地链接），
   而不是到处写 `../../packages/…`。这样"签出"只是把链接换成真实副本，**应用代码一个字都不用改**。
2. **签出时间点要提前到"首次公开 tag 之前"**，而不是"做完之后"。理由：一旦 `0.1.0` 打出去，
   `D:\mosaic` 就成了对外产物（jsDelivr 按路径取文件、别人 clone 学习），里面躺着 20 万行业务代码
   既臃肿又误导；而在孵化期同仓，你享受的是"组件改动 + 页面改动一次提交"的效率。

一句话：**孵化期同仓（单仓联动），发版前签出（单仓变两仓），签出靠路径收敛而不是靠改代码。**

---

## 1. 三个位置的角色（孵化期）

```text
D:\mosaic\                  ← 库 + 应用同仓孵化
│   ├─ packages/             # 库：对外唯一产物（不改它的"两入口"原则）
│   ├─ docs/                 # 文档站
│   └─ mosaic-admin/           # 应用：新工程的全部代码
D:\ed-nextscm-web\          ← 只读：需求源 / 参考实现 / 回归基线（迁移期只修 P0 bug）
```

旧仓的三种合法用法：**读需求**（字段、校验、联动、权限码、接口形态、边界 case）、
**抄逻辑**（只抄 `.vue` 里与框架无关的 JS，改写成纯函数）、**当验收基线**（同接口下新页面表现一致，
差异写进 `docs/port-log.md`）。不允许把旧仓当依赖/submodule，也不允许为复用去改它的目录。

---

## 2. 形态：`mosaic-admin` 的目录与硬规则

```text
D:\mosaic\
├─ package.json                  # 加 dev:admin / check:app
├─ tsconfig.json                 # include 加 mosaic-admin（排除 vendor）
├─ packages/                     # 库：不动（对外两入口：本体 + page.html）
├─ docs/                         # 文档站
├─ tests/ tools/ types/          # 库的工具与套件
└─ mosaic-admin/
    ├─ index.html                # 只做引入：ofa + 外壳
    ├─ app-config.js             # o-app 配置：home / loading / fail（照文档站做法）
    ├─ config.js                 # 运行期配置：API base、AES key、版本号、灰度开关
    ├─ vendor/
    │   ├─ mosaic  → ../../../packages     # 本地链接（junction/symlink），git 忽略
    │   └─ lib/                            # UMD：echarts / dayjs / xlsx / crypto-js…（真实进仓）
    ├─ shell/                    # layout / 侧边栏 / 标签页 / 顶栏 / 主题
    ├─ components/               # 组合层 erp-*：page / edit-table / details-drawer / import / audit-bar
    ├─ shared/                   # 纯 JS：http / api / enums / constant / dicts / utils / modules/<域>/<模块>/
    ├─ pages/<域>/<模块>/         # 渲染层：一个页面一个 .html
    ├─ styles/
    ├─ tools/                    # page-registry / port-report / check-app / link-vendor
    ├─ tests/                    # Playwright：外壳冒烟 + 模块冒烟
    └─ docs/                     # 本方案、port-log、决策
```

**八条硬规则**（写进 `mosaic-admin/README.md` + CI 守卫）：

1. 应用引用库**只有一条路径**：`./vendor/mosaic/<slug>/<slug>.html` 与 `./vendor/mosaic/boot/mosaic.css`；
   不许出现 `../packages/`、`docs/`、`packages/<slug>/<slug>.js` 这类内部文件。
2. 库（`packages/`、`docs/`、`tools/`）**不许 import `mosaic-admin/`**——一条都不能有。
3. 页面 ≤ 120 行；页面里不写业务计算、不直接 `fetch`、不拼列内容。
4. 新组件进库前，应用里必须有 **≥ 2 个真实调用点**（或 `demos` 里有等价用例）。
5. 组件契约变更必须**同一次提交**里更新 `api.md` + `CHANGELOG` + 受影响页面。
6. `vendor/mosaic` 永不手改 —— 它指向 `packages/`，改它就是改库。
7. `vendor/lib/` 只放 UMD 副本，每个文件在 `vendor/lib/README.md` 记版本与来源。
8. `mosaic-admin/tools` 的生成物（页面注册表）必须可重生成，缺页面直接启动失败。

> 为什么用"链接 + vendor 路径"而不是改 <l-m src> 的相对路径：`<l-m src>` 是静态字符串，
> 没有打包器帮你改写。链接让**开发期的 URL 形状与生产完全一致**，签出时零改动。

---

## 3. 归属判定（和 v2 一致）

| 东西      | 归属                           | 判定标准                         | 例子                                             |
| --------- | ------------------------------ | -------------------------------- | ------------------------------------------------ |
| 原子控件  | **`packages/`**                | 换任何业务都成立；不出现业务名词 | `mc-input` `mc-grid` `mc-upload` `mc-drawer`     |
| 组合层    | **`mosaic-admin/components/`** | 只在"ERP 后台"语境成立           | page 引擎、edit-table、details-drawer、audit-bar |
| 逻辑/数据 | **`mosaic-admin/shared/`**     | 与渲染无关的纯 JS                | api、enums、权限码、字典、schema、cell、logic    |
| 页面      | **`mosaic-admin/pages/`**      | 只描述"这页长什么样、接哪些动作" | `pages/business/order/import-order/index.html`   |

红线：库里不出现 `permission/tenant/orderNo/apiPrefix`；组合层不重写原子能力；`shared` 不碰 DOM；页面不放业务规则。

---

## 4. 契约一：组件准入与发版

组件进 `packages/<slug>/` 必须同时满足：

1. **≥ 2 个真实场景**；
2. **`api.md` 先于实现**（属性/事件/插槽/part/方法五张表先评审）；
3. 五维正交（`color`/`variant`/`size`/`inline`/状态布尔），不自造枚举；
4. 只消费语义令牌，暗色只靠令牌换值；
5. demos + 一份冒烟套件，`pnpm check` 全绿，文档页按 `page-spec.md`；
6. `CHANGELOG.md` 记录（契约变更算 breaking）。

**发版**：孵化期可以在同一提交里改组件与页面；但**每两周仍要打一次 `0.1.0-alpha.N` tag**，
既是签出演练，也是给"同仓无版本"这件事留一条退路。首次公开 tag（0.1.0）**必须在签出之后**。

---

## 5. 契约二：模块 = schema + cell + logic + 渲染页

```text
mosaic-admin/shared/modules/business/order/import-order/
├─ schema.js    # 搜索项、列、工具栏、主键、详情形态（纯数据）
├─ cell.js      # 单元格渲染：返回 HTML 字符串（Vue 的 v-html 与 ofa 的 :html 都吃）
├─ logic.js     # 联动、转换、提交编排、跨字段校验（纯函数）
└─ perm.js      # 权限码（引用 shared/constant，不写字面量）
```

```js
// schema.js
export const listSchema = {
  key: 'import_order',
  request: 'order/importOrder/page', // 指向 shared/api 的方法名，不写 URL 字面量
  rowKey: 'id',
  search: [
    { field: 'orderNo', label: '委托单号', type: 'input' },
    { field: 'customerId', label: '客户', type: 'autocomplete', api: 'base/customer/search' },
    { field: 'createTime', label: '创建时间', type: 'date-range' },
  ],
  toolbar: ['create', 'import', 'export'],
  columns: [
    { key: 'orderNo', title: '委托单号', width: 160, cell: 'link' },
    { key: 'status', title: '状态', width: 100, cell: 'tag', tone: 'status' },
    { key: 'amount', title: '金额', width: 120, cell: 'money', align: 'right' },
    { key: 'ops', title: '操作', width: 140, cell: 'actions' },
  ],
  detail: { kind: 'drawer', module: 'import-order' },
};
```

```js
// cell.js —— 返回 HTML 字符串；事件走 data-action + 容器委托
export const cells = {
  link: (row, col) =>
    `<a href="javascript:;" data-action="open" data-id="${row.id}">${esc(row[col.key])}</a>`,
  tag: (row, col) =>
    `<span class="tag tag--${toneOf(row[col.key])}" data-action="filter" data-value="${row[col.key]}">${labelOf(row[col.key])}</span>`,
  money: (row, col) => `<span class="num">${formatMoney(row[col.key])}</span>`,
  actions: (row) =>
    ACTIONS.map(
      (a) => `<button type="button" data-action="${a}" data-id="${row.id}">${LABEL[a]}</button>`,
    ).join(''),
};
```

渲染页只接线：`<erp-page :schema="listSchema" :cells="cells" on:cell-action="onAction(…)"></erp-page>`

**为什么是 HTML 字符串 + 事件委托**：Mosaic 现有 38 个组件的 `<slot>` 都无参、没有作用域插槽先例；
ofa 给单元格传上下文的既有范式就是 `:html` 字符串通道（`mc-table` 的 `cellsHtml()`、`mc-icon` 的 `glyphHtml`）。
HTML 字符串跨栈（Vue `v-html` / ofa `:html`），事件只依赖 `data-action` + `CustomEvent`。
代价：单元格内无响应式绑定（变就重渲染该行）；行内编辑走 `erp-edit-table` 自己的编辑器。

**表格能力切分**：选中/展开/固定表头列/排序/虚拟滚动/合并/尺寸/加载空态 → **mc-grid**；
列设置持久化、列筛选交互、拖拽列序、`link` 跳转、标签页标题、搜索参数组装、行内编辑编排 → **erp-page / erp-edit-table**。

### `mc-grid` 契约草案（P0 评审用）

```text
property：columns / data / rowKey / selectable / selected / expanded / height / maxHeight
          / virtual / striped / bordered / size / loading / emptyText / sortable
事件：select-change / sort-change / cell-click / cell-dblclick / cell-action（detail: {row, column, action}）
方法：clearSelection() / scrollTo(rowKey) / refresh()
插槽：empty / loading / footer（无参，沿用现有约定）
part：grid / head / row / cell / selection
```

三个未决点（1 天 spike）：`columns[].cell` 函数走 property 是否稳定；虚拟滚动 + 展开行；
`<table>`+sticky（保语义）vs div grid（虚拟滚动简单）——建议先 `<table>` + 固定行高。

---

## 6. 迁移一个模块的流水线（8 步）

| 步  | 动作                                             | 产出 / 验收                         |
| --- | ------------------------------------------------ | ----------------------------------- |
| 1   | 选模块：churn 低、依赖少、有验收人               | 进 `mosaic-admin/docs/port-plan.md` |
| 2   | **冻结旧模块**（只修 P0）                        | 旧仓对应入口挂"迁移中"              |
| 3   | 盘点：路由/接口/权限码/字段/校验/交互            | 盘点笔记：必须迁移的行为清单        |
| 4   | 搬 `shared`：api + 校验/转换纯函数               | 同接口同参数跑通                    |
| 5   | 写 `shared/modules/<m>/`：schema/cell/logic/perm | 纯函数可单测                        |
| 6   | 写 `pages/<m>/`：布局 + 接线 + 注册表            | 页面 ≤120 行；`check:app` 绿        |
| 7   | 对照旧系统验收：字段、规则、边界、权限           | 差异写 `docs/port-log.md`           |
| 8   | 灰度 → 观察 2 周 → 切换；旧入口跳新版            | 缺陷 ≤ 3 个且非框架性               |

**漂移管理**：只搬 `api/enums/constant/utils` 的纯数据纯函数，不搬 `.vue`；以"模块切换"为同步点；
`tools/port-report.mjs` 每周输出三张表（旧仓有新接口未搬 / 两边同名不同参 / 已切换模块旧仓又有提交）；
迁移期旧仓新功能**默认不进新工程**（需产品确认，否则追不上）。

---

## 7. 组件开发顺序

| 顺序 | 组件                                                 | 为什么排这里                  | 预估      |
| ---- | ---------------------------------------------------- | ----------------------------- | --------- |
| 1    | **mc-grid**（新增单元，不动 `mc-table`）             | 298 个列表页的瓶颈            | 4–6 周    |
| 2    | **mc-upload**                                        | 表单/详情通用                 | 1–2 周    |
| 3    | **mc-autocomplete / mc-combobox**                    | 约 700 处                     | 2–3 周    |
| 4    | **mc-drawer**                                        | 96 处详情抽屉                 | 1 周      |
| 5    | **mc-tree**                                          | 已有 tree-select，缺异步/勾选 | 2 周      |
| 6    | **mc-steps / mc-timeline / mc-descriptions**         | 展示件，简单高复用            | 各 3–5 天 |
| 7    | **mc-tabs-view**                                     | 外壳必需；缓存二期            | 1–2 周    |
| 8    | notification / time-picker / cascader / color-picker | 按真实页面补                  | 各 2–5 天 |

**不进库**：cron 选择器、JSON 编辑器、富文本、报表 iframe、导入导出向导、审计条、业务 autocomplete。

---

## 8. 工作流（同仓孵化期）

| 环节     | 约定                                                                                        |
| -------- | ------------------------------------------------------------------------------------------- |
| 依赖方向 | `mosaic-admin` → `./vendor/mosaic`（链接到 `packages/`）；**库不 import 应用**              |
| 提交     | 组件改动 + 页面改动可以同一个 commit；commit message 标明 `feat(grid):` / `feat(admin):`    |
| 检查     | `pnpm check`（库）+ `pnpm check:app`（应用：路径边界 / 页面行数 / 注册表新鲜度 / 模块冒烟） |
| 冻结     | 每月最后一周"框架冻结"：只修 bug 不改契约，应用专注交付                                     |
| 评审     | 每周 60 分钟契约评审：只过 `api.md` 与"被 ≥2 个页面用到"的能力                              |
| 旧仓     | 只读；bug 只在新工程修；旧仓 bugfix 影响已迁移模块时按 §6 漂移规则回搬                      |

---

## 9. 排期（3 人左右，含 AI 辅助）

| 阶段                 | 时间                           | 交付                                                                                                                                                                                                     | 决策点                             |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **P0** 形态 + 去风险 | 第 0–2 周                      | `mosaic-admin` 骨架（index/app-config/config/http/page-registry/link-vendor/check-app）；`mc-grid` 契约草案；1 天 spike（cellHtml 函数通道 + 500 行 + sticky + 委托事件）；`CHANGELOG` + `0.1.0-alpha.1` | spike 不通过 → 改契约或改路线      |
| **P1** 网格 + 试点   | 第 3–8 周                      | `mc-grid` v0 + demos + smoke；`erp-page` v0；**1 个模块**端到端（`risk`/`product`）；页面 ≤120 行样板                                                                                                    | 能灰度；记录"每人日页数"基线       |
| **P2** 组件族 + 外壳 | 第 2–4 月                      | upload / autocomplete / drawer / tree / steps / timeline / descriptions；外壳（菜单/tabs/主题/权限/请求层）                                                                                              | 再迁 3 个模块，人日较基线降 ≥30%   |
| **P3** 规模化        | 第 4–9 月                      | 按模块迁移；port-report 常规化                                                                                                                                                                           | 覆盖、缺陷、双轨成本三项达标       |
| **P4 签出**          | 库 API 稳定时（建议 ≤ 9 个月） | `git subtree split` 出独立仓库 + 首次公开 tag `0.1.0`                                                                                                                                                    | 新仓库能**脱离 mosaic 仓单独启动** |

---

## 10. 失败模式

| 失败模式                       | 早期信号                                | 对策                                                                             |
| ------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------- |
| **应用伸手进库内部**           | 出现 `../packages/`、直接引单元内 `.js` | 规则 1 + `check-app` 硬拦；只允许 `./vendor/mosaic/<slug>/<slug>.html`           |
| **库反向 import 应用**         | `packages/` 里出现 `mosaic-admin/`      | 规则 2 + grep 守卫                                                               |
| **双轨拖垮**                   | 已冻结模块旧仓又加功能                  | 模块级 freeze + 产品排期联动；旧仓新功能默认不进新工程                           |
| **框架被业务形状污染**         | `api.md` 出现 `permission/orderNo`      | 准入清单 + 每周评审；业务形状进 `components/`                                    |
| **过度通用化**                 | 组件 3 轮没落地；属性表 > 30 行         | YAGNI：只做"试点页 + 第二个页面"都要的                                           |
| **签出时才发现耦合**           | `check-app` 绿但 curl 单起失败          | 每两周做一次"签出演练"：把 `mosaic-admin` 拷到临时目录，用真实副本替换链接，单起 |
| **仓库被业务代码污染公共形象** | 公开 tag 里含 20 万行业务               | **签出前不打公开 tag**；alpha tag 只作内部节点                                   |
| **无 lint/类型兜底**           | 运行期才炸                              | `tsc --checkJs` 覆盖 `mosaic-admin/**/*.js`；页面脚本 ESLint 抽取；每模块冒烟    |

---

## 11. 度量

| 指标                       | 目标                    |
| -------------------------- | ----------------------- |
| 库组件被 ≥2 个业务场景使用 | ≥ 70%                   |
| 组合层 : 页面 行数比       | 1 : 10 → 1 : 4          |
| 单页迁移人日               | P1 基线 → P3 降 ≥ 50%   |
| `api.md` 变更/月           | 稳定期 ≤ 3 次           |
| 已切换模块的旧仓提交       | 冻结后 ≈ 0（除 P0 bug） |
| 签出演练结果               | 每两周一次，必须能单起  |

---

## 12. 需要你定的 4 件事

1. **mosaic 会开源/对外发布吗？** 会的话，孵化期就要接受"业务代码短暂进库"，但**公开 0.1.0 必须晚于签出**；
   如果完全不开源，甚至可以长期同仓（签出变成可选项）。
2. **旧仓迁移期还会继续加功能吗？** 决定漂移策略与总工期。
3. **人手与节奏**：几个人、是否全职、每月能给框架多少（建议 ≥1 人 × 50%）。
4. **第一批模块**：建议 `risk` 或 `product`（列表+详情+表单齐全、字段少、强依赖弱），别从 `order`/`finance` 开始。

---

## 附录 A：签出（split）操作清单

**前置条件**：① 库 API 稳定到可以打 `0.1.0`；② `check:app` 全绿；③ 签出演练（临时目录 + 真实副本）通过。

1. 在 `D:\mosaic` 打 tag `0.1.0`（库本体）。
2. `git subtree split -P mosaic-admin -b admin-split`（保留应用历史）。
3. 新建仓库（如 `nextscm-admin`），push `admin-split`。
4. 新仓库里把 `vendor/mosaic`（原为链接）换成 `git subtree add --prefix vendor/mosaic <mosaic> 0.1.0`
   或 `packages/` 快照副本 + 在 `vendor/mosaic/VERSION` 记录 commit。
5. 从 `D:\mosaic` 删除 `mosaic-admin`，留一个 `apps/README.md` 指向新仓库。
6. 把 `check:app`、模块冒烟迁到新仓库 CI；root 的 `dev:admin` 删掉。
7. **验收**：新仓库在没有任何 mosaic 仓的环境下单起、跑通试点模块 —— 这是签出成功的唯一标准。
