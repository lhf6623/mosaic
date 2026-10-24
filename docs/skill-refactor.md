# Mosaic × ofajs-docs 技能整改清单

> 工作清单，不进文档站导航。目标：用 `ofajs-docs` 技能把全部组件与文档过一遍，按下面的顺序依次改。
> 每完成一项，把 `[ ]` 改成 `[x]`，并在文末「进度记录」补一行。
> 技能文档：`~/.dsh/skills/ofajs-docs/SKILL.md`；有冲突时以技能和仓库既有陷阱文档为准。

## 判定标准

- 模板是唯一渲染源：可见结构写模板，脚本不 `createElement` / `append` 造结构。
- 列表用 `o-fill`（有唯一键必须带 `fill-key`），条件用 `o-if` / `o-else`。
- 简单标量进 `attrs`，数组 / 对象进 `data`；运行时的对象属性走 `:` 绑定或 `$()` 包装对象。
- HTML 属性 / 布尔属性用 `attr:`；事件用 `on:`；样式用 `class:` / `:style.`。
- 脚本只做模板表达不了的行为：`popover` / `showModal`、焦点、滚动、测量、拖拽、第三方库。
- 行为层的 DOM 访问优先 `this.shadow.$(…)` / `.on(…)`；原生属性 `.ele`。
- 例外必须集中在一个方法里，并注释为什么不能模板化。

状态图例：✅ 基本合规（核对即可） · 🟡 模板 + 行为（统一写法） · 🟠 混合渲染（拆 JS 渲染） · 🔴 可见结构在 JS（重写） · 🔵 行为层例外（核对 + 注释）

每个单元改完跑：`node tests/smoke.mjs <slug>`。测试文件在 `packages/<slug>/test/`，需要时一起改。
每个单元的 `demos/` 与 `page.html` 演示随接口改动同批核对；不改接口时不动。
接口 / 文档有变再跑：`pnpm check:docs`、`pnpm check:size`、`pnpm lint:md`。全量测试只在明确要求时跑。

## P0 · 已完成

- [x] **button** · 源码 `packages/button/button.html` · 文档 `packages/button/README.md` / `api.md` / `page.html` · ✅ · commit `7c4dc3d`

## P1 · 渲染结构在 JS，优先重写

- [x] **menu** · 源码 `packages/menu/menu.html` + `menu-item.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 行 / 内置控件模板渲染；options 走 data + `:options`；浮层与开合为行为层
- [x] **date-picker** · 源码 `packages/date-picker/date-picker.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 触发框文案 / 标题 / 42 格与 12 格改模板（o-fill 两份格模型）；开合 / 焦点 / 键盘为行为层
- [x] **select** · 源码 `packages/select/select.html` + `option.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 触发框文案 / 选项行改 o-fill 模板渲染（行模型）；开合 / 焦点 / 滚动为行为层
- [x] **tree-select** · 源码 `packages/tree-select/tree-select.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 节点树摊成行模型改 o-fill 模板渲染；行模板插槽克隆是唯一例外；开合 / 懒加载 / 键盘为行为层
- [x] **rate** · 源码 `packages/rate/rate.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 星星列表改 o-fill 模板渲染（三态 data-fill）；指针 / 键盘 / 拖拽为行为层
- [x] **icon** · 源码 `packages/icon/icon.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 图形槽改模板渲染（`attr:class` / `:html`）；probe 量 CSS 与远程 SVG 取回留行为层

## P2 · 模板 + 行为，统一写法

- [x] **pagination** · 源码 `packages/pagination/pagination.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 布尔绑定改 `attr:`；行为层改 `this.shadow.$()` / `.on()`；原生 select 选项是唯一 DOM 例外
- [x] **table** · 源码 `packages/table/table.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 表头 o-fill 补 fill-key；foster-parent 集中注释；`:html` 单元格例外收进 `cellsHtml()`
- [x] **form** · 源码 `packages/form/form.html` + `form-item.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 基本合规，仅统一 slot 监听写法；form-item 未改
- [x] **input** · 源码 `packages/input/input.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 行为层改 `shadow.$` / `on` / `off`；原生控件的 `disabled` / `readonly` 等走 `attr:`；溢出提示与焦点集中注释
- [x] **textarea** · 源码 `packages/textarea/textarea.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 字数文案改模板 `{{counterText}}`；`attr:disabled`；自动增高 / 测量留行为层
- [x] **checkbox** · 源码 `packages/checkbox/checkbox.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 原生 input 的 checked / indeterminate 留行为层；`normalizeBoolAttrs` 修掉 `invalid"` 笔误、去掉重复 `applyChecked`
- [x] **radio** · 源码 `packages/radio/radio.html` + `radio-group.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 元素引用改 `shadow.$` / 插槽监听 `on` / `off`；选中与组内键盘 / 焦点集中注释
- [x] **switch** · 源码 `packages/switch/switch.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ `attr:disabled`；`normalizeBoolAttrs` 去掉 `disabled"` 重复项、去掉重复 `applyChecked`
- [x] **slider** · 源码 `packages/slider/slider.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ `attr:disabled`；原生 range 状态与比例几何集中注释
- [x] **tabs** · 源码 `packages/tabs/tabs.html` + `tab.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ tab 的 `disabled` 改 `attr:`；跨 shadow 取 tab 内部 button 集中到 `baseOf()`，指示条测量注释
- [x] **alert** · 源码 `packages/alert/alert.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 插槽引用改预存 `shadow.$`，空内容折叠与内置图形让位集中注释
- [x] **tag** · 源码 `packages/tag/tag.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ `attr:disabled` 替掉两处 `:prop` 布尔绑定；其余核对通过、未改
- [x] **avatar** · 源码 `packages/avatar/avatar.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ `this.shadow.$` 取引用、img load/error 与 slotchange 改 `.on` / `.off`；原生属性走 `.ele`
- [x] **message** · 源码 `packages/message/message.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 委托监听改 `this.shadow.$` + 具名 handler `.on` / `.off`，去掉 cloneNode 摘监听
- [x] **collapse** · 源码 `packages/collapse/collapse.html` + `collapse-item.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ `this.shadow.$`、`attr:open`、toggle 走 `.on`；宿主监听与 `:scope >` 遍历各补注释

## P3 · 行为层例外，只核对并补注释

- [x] **dialog** · 源码 `packages/dialog/dialog.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过；popover / 焦点陷阱 / 插槽遍历已在脚本头集中注释
- [x] **popover** · 源码 `packages/popover/popover.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过；原生 popover / 锚点测量 / toggle 同步已集中注释
- [x] **dropdown** · 源码 `packages/dropdown/dropdown.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过；原生 popover / 点外部 / 焦点归还已集中注释
- [x] **tooltip** · 源码 `packages/tooltip/tooltip.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过；原生 popover / 延迟计时 / 点外部已集中注释
- [x] **scroll-bar** · 源码 `packages/scroll-bar/scroll-bar.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过；滚动几何 / 拖拽 / 滚轮已集中注释
- [x] **loading-bar** · 源码 `packages/loading-bar/loading-bar.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过；宽度归零重启已集中注释
- [x] **code** · 源码 `packages/code/code.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过；第三方高亮 / 行号结构已集中注释

## P4 · 基本合规，核对即可

- [x] **breadcrumb** · 源码 `packages/breadcrumb/breadcrumb.html` + `breadcrumb-item.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动；其套件 15/16，失败项在干净 HEAD 上同样失败（既有问题，与本轮改动无关）
- [x] **card** · 源码 `packages/card/card.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动（头尾显示靠 slot 状态镜像，属行为层）
- [x] **badge** · 源码 `packages/badge/badge.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 徽标文字改模板 `{{textValue}}`（`text` 撞 ofa 方法名已避开）；其余为 slot 状态镜像
- [x] **empty** · 源码 `packages/empty/empty.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动
- [x] **divider** · 源码 `packages/divider/divider.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动（数字 spacing 写宿主变量属行为层）
- [x] **progress** · 源码 `packages/progress/progress.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动（填充宽度由运行时值算，属行为层）
- [x] **skeleton** · 源码 `packages/skeleton/skeleton.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动（宽高 / 数字 size 写宿主 style，模板表达不了）
- [x] **space** · 源码 `packages/space/space.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动（数字 gap 写宿主变量属行为层）
- [x] **grid** · 源码 `packages/grid/grid.html` + `grid-item.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动（cols / span 写宿主变量属行为层）
- [x] **spinner** · 源码 `packages/spinner/spinner.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 核对通过、未改动
- [x] **color** · 无组件源码 · 文档 `packages/color/README.md` / `page.html` · ✅ 核对通过；页面两处静态行内 margin 收进本页 `<style>`（docs/README §三）

## 共享文档

- [x] `packages/README.md`：共用约定（渲染方式 / attrs 与 data / `attr:` / keyed 列表 / ofa DOM API）
- [x] `docs/README.md`：站点写法与示例约定（新增 §十「ofa 写法」：模板唯一渲染源 / `attr:` / `o-fill` / `shadow.$` / 页面模块 / 示例即代码）
- [x] `README.md`：根 README 的引例 ✅ 核对通过、未改动（普通 HTML 引例不含模板指令，符合 §1.1.1）
- [x] `AGENTS.md`：是否把技能写法写进代理规则（可选）→「动手之前」补一条：先读 ofajs-docs 技能与判定标准

## 文档站（用法核对）

- [x] `docs/components/nav.html`：左栏二级菜单（跟 menu 同批）
- [x] `docs/components/toc.html`：右栏目录（o-fill 参考写法）· ✅ `this.shadow.on/off('click')`；全局监听补注释，o-fill 写法核对通过
- [x] `docs/components/search.html` · ✅ `this.shadow.$` / `.on` / `.off`；popover 原生方法走 `.ele`，document 捕获监听补注释
- [x] `docs/components/playground.html` · ✅ 删 `role` / `aria-*`；shadow 引用改 `this.shadow.$`；预览 / 错误兜底 / 剪贴板例外集中注释；toggle 图标名改 `x`（iconify 无 `close`）
- [x] `docs/components/demos.html` · ✅ 纯布局测量（只算位置不搬 DOM），核对通过、未改
- [x] `docs/components/spec.html` · ✅ 运行时渲染 `api.md` 进 light DOM 属行为层例外，文件头已注释
- [x] `docs/components/palette.html` · ✅ 双层 `o-fill`（`family` / `step`）+ `$data` + `:style.` 运行时色值，核对通过、未改
- [x] `docs/components/block-field.html` · ✅ 随机装饰方块例外已有注释；`.layer` 引用改 `this.shadow.all`
- [x] `docs/layout.html` · ✅ 顶栏委托 / 滚动容器 / 菜单 / 下拉改 `this.shadow.$` + `.on`；跨两层 shadow 的 `$(host).shadow.$` 链补注释
- [x] `docs/doc-layout.html` · ✅ 删 `aria-*`；`this.shadow.$` / `.on` / `.off`；把手标题与图标运行时更新
- [x] `docs/snippets/quick-start.html` · ✅ 核对通过、未改
- [x] `docs/pages/home.html` · ✅ 核对通过、未改（单屏 hero 只有 h1）
- [x] `docs/pages/intro.html` · ✅ 核对通过、未改（组件数 / 分类数来自 `site-map.js`）
- [x] `docs/pages/install.html` · ✅ 核对通过、未改
- [x] `docs/pages/controlled.html` · ✅ 示例 `:checked` → `attr:checked`，导语与坑改成现行布尔口径
- [x] `docs/pages/platforms.html` · ✅ 核对通过、未改
- [x] `docs/pages/faq.html` · ✅ 7 处 h3 改 h2（原 h2=0，右栏条目全缩进成子项）
- [x] `docs/pages/theme.html` · ✅ 核对通过、未改
- [x] `docs/pages/component-theme.html` · ✅ 核对通过、未改
- [x] `docs/pages/style-conflicts.html` · ✅ 核对通过、未改

## 每单元验收

- [x] 改前跑一次 `node tests/smoke.mjs <slug>`，记录基线（本批 66/66）
- [x] 改后同命令全绿（本批 158/158，含 P1 遗留四单元）
- [x] 源码体积：`node tools/check-size.mjs`
- [x] 改到接口 / `api.md`：`pnpm check:docs`（22/22）
- [x] 改到 Markdown：`pnpm lint:md` + `prettier --check`

## 进度记录

| 日期       | 单元                                            | commit    | 验收                                                                                                                                  |
| ---------- | ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-24 | button                                          | `7c4dc3d` | button 19/19、form 46/46                                                                                                              |
| 2026-10-24 | menu                                            | 本提交    | menu 24/24、keyed 复用 + 行/控件模板化                                                                                                |
| 2026-10-24 | menu（模板化）                                  | 本提交    | menu 24/24、dropdown 14/14、doc-drift 22/22、文档站 47 行复用                                                                         |
| 2026-10-25 | menu（options 通道）                            | `30a4427` | menu 24/24、doc-drift 22/22、文档站 47 行复用                                                                                         |
| 2026-10-25 | nav（:options + shadow）                        | 本提交    | 文档站 47 行复用、current / 居中正常                                                                                                  |
| 2026-10-25 | nav（居中策略）                                 | 本提交    | 左栏 / full 首次显示居中；换页 / 重开不再改 scrollTop                                                                                 |
| 2026-10-25 | nav（刷新居中）                                 | 本提交    | 60 次刷新 0 错位（修复前 3/60）；边界行 / 窄屏 full 浮层均正常                                                                        |
| 2026-10-25 | date-picker（模板化）                           | 本提交    | date-picker 27/27、面板网格改 o-fill 模板渲染、脚本零 DOM 创建                                                                        |
| 2026-10-25 | select（模板化）                                | 本提交    | select 20/20、选项行改 o-fill 模型 + 原生 button；滚动留行为层                                                                        |
| 2026-10-25 | tree-select（模板化）                           | 本提交    | tree-select 27/27、节点摊行模型 + o-fill；插槽克隆留一处例外                                                                          |
| 2026-10-25 | rate（模板化）                                  | 本提交    | rate 18/18、星星改 o-fill（data-fill 三态）；指针 / 拖拽留行为层                                                                      |
| 2026-10-25 | icon（模板化）                                  | 本提交    | icon 15/15、图形槽改 attr:class / :html；probe 与远程 SVG 留行为层                                                                    |
| 2026-10-25 | P3 行为层核对                                   | 本提交    | dialog/popover/dropdown/tooltip/scroll-bar/loading-bar/code 128/128                                                                   |
| 2026-10-25 | P2-A（pagination/table/form）                   | 本提交    | 91/91；attr:、shadow.$ / on / off、foster-parent 与 :html 例外集中                                                                    |
| 2026-10-25 | badge（模板化）                                 | 本提交    | badge 13/13、徽标文字改 {{textValue}}；slot 状态镜像留行为层                                                                          |
| 2026-10-25 | P2-B/C（input…alert）                           | 本提交    | 8 套件全绿；`attr:` 布尔绑定、`shadow.$` / `on` / `off`、行为层集中注释；checkbox/switch 修笔误                                       |
| 2026-10-25 | P4 核对（9 单元）                               | 本提交    | 全部合规未改；breadcrumb 套件 1 条既有失败（干净 HEAD 复现，与本轮无关）                                                              |
| 2026-10-25 | P2-C（tag/avatar/message/collapse）             | 本提交    | 66/66；`attr:` 布尔、`shadow.$` / `.on` / `.off`、去掉 cloneNode 摘监听                                                               |
| 2026-10-25 | P1 遗留布尔绑定                                 | 本提交    | date-picker 27 / select 20 / tree-select 27 / rate 18 = 92/92；`:disabled` → `attr:disabled` 7 处（tree-select 两处在文档站批次补上） |
| 2026-10-25 | 共享文档（docs/README §十 / AGENTS / color 页） | 本提交    | check:docs 22/22、lint:md 0、prettier 通过、color 页 Playwright 抽检无报错                                                            |
| 2026-10-25 | 文档站用法核对（19 文件）                       | 本提交    | 9 页 hash 抽检 console / 404 全空；改 layout / doc-layout / toc / search / playground / block-field / faq / controlled                |
| 2026-10-25 | 布尔口径收尾（form 文档 / tree-select）         | 本提交    | form 46/46、tree-select 27/27；文档示例 `:checked` → `attr:checked`，tree-select 两处 `attr:disabled`                                 |
