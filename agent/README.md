# agent/ 导航：什么时候读哪一份

这里是**规范与踩坑记录**，不是给人从头读的。新会话按任务挑 1～2 份，其余别读 ——
全量八千多行，读完也记不住，还会把上下文挤掉。

**「读这份」这一列是必读闭包**：读完列出的文件就能动手做这件事；正文里其它链接、以及按组件 / 按坑条目取的文件都是**按需查**（红了再查、命中再查）。
闭包有行数预算（上限在 [`tools/doc-drift.config.mjs`](../tools/doc-drift.config.mjs) 的 `readBudget`），`pnpm check:docs` 会替你算 —— 超了就是「做这件事要读的东西又变多了」，该拆文档而不是加预算。

| 我要做什么                                           | 读这份（必读闭包）                                                              | 类             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- | -------------- |
| **第一次做一个组件**（照着走一遍，保证能成）         | [`tutorial.md`](./tutorial.md)                                                  | 教程 ✓         |
| **改了接口，要同步哪些地方**（最高频）               | [`howto/change-api.md`](./howto/change-api.md)                                  | 做法 ✓         |
| 加属性 / 加演示 / 加令牌                             | [`howto/`](./howto/)（按需取一份）                                              | 做法 ✓         |
| 改文档站外壳 / 顶栏 / 主题 / 两栏定位 / 滚动         | [`doc-site.md`](./doc-site.md)                                                  | 参考（含设计） |
| 写或改组件文档页（骨架、演示区四段、表格口径）       | [`doc-pages.md`](./doc-pages.md)                                                | 参考           |
| 造新组件（命名、职责、四维正交、ofa 骨架）           | [`authoring.md`](./authoring.md) + [`authoring-style.md`](./authoring-style.md) | 参考 ⚠️        |
| 只改组件的 `<style>` / 事件 / 插槽与定制点           | [`authoring-style.md`](./authoring-style.md)                                    | 参考 ⚠️        |
| 提交前自检、尺寸与无障碍基线                         | [`checklist.md`](./checklist.md)                                                | 做法 ✓         |
| 查某个组件的接口（属性 / 事件 / 插槽与 part / 令牌） | [组件 API 规范](api/README.md)（共用约定；该组件的 `api.md` 按需开）            | 参考           |
| 写组件前扫一遍「静默失效」的坑                       | [踩坑索引](pitfalls/README.md)（按改动类型取一节）                              | 参考           |
| 改配色 / 加令牌 / 换肤                               | [`design-tokens.md`](./design-tokens.md)                                        | 参考           |
| 选间距 / 排版 / 动效 / 层级 / 文案                   | [`design-spec.md`](./design-spec.md)                                            | 参考           |
| 对账「文档和代码有没有脱节」                         | `pnpm check:docs`（约定在 `tools/doc-drift.config.mjs`）                        | 工具           |
| 对账「提交进仓库的产物是不是源码生成的」             | `pnpm check:drift`（`tools/check-fresh.mjs`）                                   | 工具           |
| 跑测试：这次该跑哪些                                 | `pnpm test`（`--list` 先预览；全量 `pnpm test:all` 只在明确要求时跑）           | 工具           |
| 提交前格式化这次改过的文件（md + 代码）              | `npx prettier --write <改过的文件…>`（提交前一次，见 checklist）                | 工具           |
| 参考区为什么由 md 渲染、注意事项为什么上移到页顶     | [`doc-render.md`](./doc-render.md)（**已落地**）                                | 背景           |
| 项目定位、关键决策、里程碑、风险                     | [`plan/`](./plan/)（定位 / 决策 / 目录与构建 / 里程碑）                         | 背景 · 规划    |

**「类」这一列按读者此刻在做什么分**（Diátaxis 四象限）：

- **参考** = 查事实的干描述：规矩、清单、条目。不教做事，只说事实是什么。
- **做法** = 目标导向的食谱：已经会了，只想把这件事做完，照着走就行。
- **背景** = 解释为什么这么定（决策 / 调研 / 方案）。不操作，读了是为了理解。
- **教程** = 带你从头做一遍，保证成功，不给选择也不解释原理。

⚠️ 标出来的两份是**规范，不是步骤** —— 读完拿到的是「规矩」，还得自己串成流程。
四格现在都填上了：**教程**有 `tutorial.md`（照着走能做出一个真组件）；
**做法**在 `howto/`（改接口同步 / 加属性 / 加演示 / 加令牌）+ `checklist.md`（提交前自检）。
`howto/` 里**不重写规矩**，只写步骤与验证 —— 规矩抄过来就是第二份会漂移的副本。

**已归档**（不进这张导航表，不参与 `pnpm check:docs` 对账，除非明确要考古）：

- [`archive/docs-refactor.md`](./archive/docs-refactor.md) —— 已完成的一次文档站重构记录；
- [`archive/research/`](./archive/research/) —— 外部资料的抓取原文（unocss / jsdelivr / ofa 状态 / iconify）。
  决策早已定进 [`plan/decisions.md`](./plan/decisions.md)，这里留原文是为了将来说「当初为什么」。

**外部资料**（不是我们写的，也不参与对账）：

- [`vendor/ofa-skill.md`](./vendor/ofa-skill.md) —— ofa.js 官方给 AI 的知识库，语法疑问以它为准。
  ⚠️ 残缺副本：附属的 `references/` 与 `assets/` 没进仓库，正文里 60+ 处链接不可达
  （[`vendor/README.md`](./vendor/README.md) 有说明，别去修那些链接）。

为什么要分出去：`agent/` 原本 7908 行里有 3927 行（50%）是「默认不读」的 ——
它们压住了真正要用的那份，也让「这里有多少文档」这个问题没有答案。
归档目录**不参与对账**（`tools/doc-drift.config.mjs` 的 `skipFiles`），所以里面写什么都不会红。

## 分工约定

- `agent/` 只放**规范**：怎么造、怎么写、踩过什么坑；
- **实现说明**写在组件文件头（`packages/<name>/*.html` 顶部的注释块）；
- **页面上的用法**写在文档页自己（`packages/<name>/page.html`）；
- 组件清单与逐组件接口的**唯一真相源**是 [组件 API 规范](api/README.md)，
  改了组件 API 先改它，再改文档页；
- 这三处（规范 / 文档页 / 组件代码）**有没有对上由 `pnpm check:docs` 守**：
  它只认 `tools/doc-drift.config.mjs` 里的约定，所以改约定改配置、别改引擎。

## 现在长什么样

```
agent/
├── README.md            ← 这份：先读它挑模块
├── tutorial.md          教程：从零做一个组件（照着走一遍）
├── howto/               食谱：改接口 / 加属性 / 加演示 / 加令牌（只写步骤与验证）
├── doc-site.md          文档站外壳（布局 / 顶栏 / 滚动）
├── doc-pages.md         文档页规范（骨架 / 演示区 / 参考区）
├── authoring.md         造组件（命名 / 职责 / 四维 / ofa 骨架）
├── authoring-style.md   <style> 五分区 / 事件 / 插槽与 part
├── checklist.md         尺寸与无障碍基线 / 交付检查
├── design-spec.md       间距 / 排版 / 动效 / 层级
├── design-tokens.md     令牌体系 / 换色 / 换肤
├── api/                 组件 API 规范（README = 共用约定 + 索引，逐组件一个文件）
├── pitfalls/            ofa.js 踩坑清单（README = 44 条索引，按主题分文件）
├── plan/                规划总纲（定位 / 决策 / 目录与构建 / 里程碑）
├── doc-render.md        参考区由 md 渲染 + 注意事项上移到页顶（已落地）
├── archive/             **已归档，默认不读**：docs-refactor.md（重构记录）+ research/（外部资料原文）
└── vendor/              **外部资料**：ofa-skill.md（ofa.js 官方知识库，语法疑问以它为准）
```

现在还在用的 ~4500 行（原 7908 行，归档掉约一半）。单份最大 ~370 行
（`tutorial.md`），按任务挑一份就够。
