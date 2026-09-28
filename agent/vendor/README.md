# vendor/ —— 外部资料

不是我们写的，也不参与 `pnpm check:docs` 对账（`tools/doc-drift.config.mjs` 的 `skipFiles`）。

## `ofa-skill.md`

ofa.js 官方给 AI 的知识库（本体是一个 AI Skill 包的主文件，带 frontmatter）。
**语法疑问以它为准** —— 优先级高于任何搜索结果和既有记忆。

⚠️ **它是残缺副本**：原 Skill 包还带两个附属目录 ——
`references/`（30+ 份细分文档：生命周期、插槽、路由、SSR…）与 `assets/`（示例工程）。
这两份目录**没有进本仓库**，所以正文里指向它们的 60+ 处链接全部不可达。

这是**复制时就这样的，不是链接写错** —— 别去"修"那些链接。
要用细分文档，得去 ofa.js 官方仓库取完整 Skill 包。

本体那 926 行（AI 使用规范 / 常见错误对照 / 各主题正文）是完整的，够用。
