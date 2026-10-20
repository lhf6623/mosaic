# AGENTS.md — 给 AI / 自动化代理的工作约定

> 仓库的用法、接口规范、文档规范见 [`README.md`](README.md) 与 [`packages/README.md`](packages/README.md)。
> 这份只记**会话级硬规则**：DeepSeek Harness 在每个新会话的第一次请求自动加载本文件，
> 不依赖上一次会话聊过什么。

## 测试：默认只跑最小范围；全量必须由使用者明确发起

- **组件套件迭代**：`node tests/smoke.mjs <slug>`（例：`node tests/smoke.mjs badge`）。
- **不知道跑哪些**：`pnpm test`（改动选测）。它按 `tests/suite-map.json` 只跑命中的套件；
  工作区干净时什么都不跑；判定为全量时**拒绝执行并退出 1** —— 这是让人做决定，不是故障。
- **不要自己跑全量**：`pnpm test:all`、不带过滤的 `node tests/smoke.mjs`、`pnpm test:record`
  整份重录，都算全量。即使改动落在共享面、选测判成「影响全部套件」，也只把结论告诉使用者并
  **建议**跑全量；等使用者明确要求后再跑。
- 原因：全量成本随组件数量增长（当前 39 个套件约 100 秒；组件到 100 个就是数分钟）。
  它只该出现在使用者明确要求的场合，不是每次改完的自检动作。
- 静态守卫 `pnpm check` 不属于全量测试，按需跑。

## 动手之前

- 先读对应单元的 `README.md`「设计取舍」与 `packages/README.md` 的共用约定，再改代码。
- 接口事实的唯一手写源是各单元的 `api.md`；`pnpm check:docs` 会对账，别在组件页手抄接口表。
