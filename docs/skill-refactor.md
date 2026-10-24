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

- [x] **menu** · 源码 `packages/menu/menu.html` + `menu-item.html` · 文档 `README.md` / `api.md` / `page.html` · ✅ 行 / 内置控件模板渲染；浮层与开合为行为层
- [ ] **date-picker** · 源码 `packages/date-picker/date-picker.html` · 文档 `README.md` / `api.md` / `page.html` · 🟠
- [ ] **select** · 源码 `packages/select/select.html` + `option.html` · 文档 `README.md` / `api.md` / `page.html` · 🟠
- [ ] **tree-select** · 源码 `packages/tree-select/tree-select.html` · 文档 `README.md` / `api.md` / `page.html` · 🔴
- [ ] **rate** · 源码 `packages/rate/rate.html` · 文档 `README.md` / `api.md` / `page.html` · 🟠
- [ ] **icon** · 源码 `packages/icon/icon.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡

## P2 · 模板 + 行为，统一写法

- [ ] **pagination** · 源码 `packages/pagination/pagination.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **table** · 源码 `packages/table/table.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **form** · 源码 `packages/form/form.html` + `form-item.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **input** · 源码 `packages/input/input.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **textarea** · 源码 `packages/textarea/textarea.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **checkbox** · 源码 `packages/checkbox/checkbox.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **radio** · 源码 `packages/radio/radio.html` + `radio-group.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **switch** · 源码 `packages/switch/switch.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **slider** · 源码 `packages/slider/slider.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **tabs** · 源码 `packages/tabs/tabs.html` + `tab.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **alert** · 源码 `packages/alert/alert.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **tag** · 源码 `packages/tag/tag.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **avatar** · 源码 `packages/avatar/avatar.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **message** · 源码 `packages/message/message.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡
- [ ] **collapse** · 源码 `packages/collapse/collapse.html` + `collapse-item.html` · 文档 `README.md` / `api.md` / `page.html` · 🟡

## P3 · 行为层例外，只核对并补注释

- [ ] **dialog** · 源码 `packages/dialog/dialog.html` · 文档 `README.md` / `api.md` / `page.html` · 🔵
- [ ] **popover** · 源码 `packages/popover/popover.html` · 文档 `README.md` / `api.md` / `page.html` · 🔵
- [ ] **dropdown** · 源码 `packages/dropdown/dropdown.html` · 文档 `README.md` / `api.md` / `page.html` · 🔵
- [ ] **tooltip** · 源码 `packages/tooltip/tooltip.html` · 文档 `README.md` / `api.md` / `page.html` · 🔵
- [ ] **scroll-bar** · 源码 `packages/scroll-bar/scroll-bar.html` · 文档 `README.md` / `api.md` / `page.html` · 🔵
- [ ] **loading-bar** · 源码 `packages/loading-bar/loading-bar.html` · 文档 `README.md` / `api.md` / `page.html` · 🔵
- [ ] **code** · 源码 `packages/code/code.html` · 文档 `README.md` / `api.md` / `page.html` · 🔵

## P4 · 基本合规，核对即可

- [ ] **breadcrumb** · 源码 `packages/breadcrumb/breadcrumb.html` + `breadcrumb-item.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **card** · 源码 `packages/card/card.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **badge** · 源码 `packages/badge/badge.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **empty** · 源码 `packages/empty/empty.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **divider** · 源码 `packages/divider/divider.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **progress** · 源码 `packages/progress/progress.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **skeleton** · 源码 `packages/skeleton/skeleton.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **space** · 源码 `packages/space/space.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **grid** · 源码 `packages/grid/grid.html` + `grid-item.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **spinner** · 源码 `packages/spinner/spinner.html` · 文档 `README.md` / `api.md` / `page.html` · ✅
- [ ] **color** · 无组件源码 · 文档 `packages/color/README.md` / `page.html` · ✅

## 共享文档

- [x] `packages/README.md`：共用约定（渲染方式 / attrs 与 data / `attr:` / keyed 列表 / ofa DOM API）
- [ ] `docs/README.md`：站点写法与示例约定
- [ ] `README.md`：根 README 的引例
- [ ] `AGENTS.md`：是否把技能写法写进代理规则（可选）

## 文档站（用法核对）

- [x] `docs/components/nav.html`：左栏二级菜单（跟 menu 同批）
- [ ] `docs/components/toc.html`：右栏目录（o-fill 参考写法）
- [ ] `docs/components/search.html`
- [ ] `docs/components/playground.html`
- [ ] `docs/components/demos.html`
- [ ] `docs/components/spec.html`
- [ ] `docs/components/palette.html`
- [ ] `docs/components/block-field.html`
- [ ] `docs/layout.html`
- [ ] `docs/doc-layout.html`
- [ ] `docs/snippets/quick-start.html`
- [ ] `docs/pages/home.html`
- [ ] `docs/pages/intro.html`
- [ ] `docs/pages/install.html`
- [ ] `docs/pages/controlled.html`
- [ ] `docs/pages/platforms.html`
- [ ] `docs/pages/faq.html`
- [ ] `docs/pages/theme.html`
- [ ] `docs/pages/component-theme.html`
- [ ] `docs/pages/style-conflicts.html`

## 每单元验收

- [ ] 改前跑一次 `node tests/smoke.mjs <slug>`，记录基线
- [ ] 改后同命令全绿
- [ ] 源码体积：`node tools/check-size.mjs`
- [ ] 改到接口 / `api.md`：`pnpm check:docs`
- [ ] 改到 Markdown：`pnpm lint:md` + `prettier --check`

## 进度记录

| 日期       | 单元           | commit    | 验收                                                          |
| ---------- | -------------- | --------- | ------------------------------------------------------------- |
| 2026-10-24 | button         | `7c4dc3d` | button 19/19、form 46/46                                      |
| 2026-10-24 | menu           | 本提交    | menu 24/24、keyed 复用 + 行/控件模板化                        |
| 2026-10-24 | menu（模板化） | 本提交    | menu 24/24、dropdown 14/14、doc-drift 22/22、文档站 47 行复用 |
