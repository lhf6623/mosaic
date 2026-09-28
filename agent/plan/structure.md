# 目录结构与构建分发

仓库长什么样、产物怎么出去。

> 相关：[`decisions.md`](./decisions.md)（D1 分发 / D2 组件形态）。

---

## 一、目录结构

```text
mosaic/
├── packages/
│   ├── boot/                      ← 运行时引导 + 组件共用的运行时工具
│   │   ├── mosaic.js              # 手写：attachShadow 补丁 + adopt（唯一必需引入）
│   │   ├── mosaic.css             # 生成并提交：令牌 + 工具类（可 <link>）
│   │   ├── shadow-base.css        # 手写：只进 shadow root 的 reset（禁止 <link>）
│   │   └── scroll-pin.js          # 手写：定住滚动条（跨组件共用，组件 import 它）
│   ├── color/                     ← 组件单元的一种：只有 README + page.html，没有 api.md
│   │   ├── tokens.css             # 生成并提交：三层令牌（层顺序也在这里声明）
│   │   └── page.html              # 令牌文档页
│   ├── button/                    ← **一个组件 = 一个单元**，其余单元（code/ collapse/ …）同形
│   │   ├── {name}.html            # 组件本体（源 = 产物，构建不碰它）—— **入口一：使用者 CDN 引入**
│   │   ├── api.md                 # 接口规范（属性 / 事件 / 插槽与 part / 令牌），由 <doc-spec> 渲染进页面
│   │   ├── page.html              # 文档页，注册在 docs/site-map.js —— **入口二：文档站加载**
│   │   ├── demos/*.html           # 可交互演示（一个例子一个文件）
│   │   └── test/{slug}.test.mjs   # 组件自己的冒烟套件
│   └── {next}/{next}.html ...
├── tools/
│   ├── gen-tokens.mjs             # 调色板生成 + WCAG 自检
│   ├── gen-icons.mjs              # 图标子集 → packages/icon/icons.generated.ts
│   ├── icon-manifest.mjs          # 内置图标的唯一清单（gen-icons / build-css / 守卫共用）
│   ├── build-css.mjs              # CSS 构建入口（含「缺输入大声失败」守卫）
│   ├── gen-unit-readme.mjs        # 生成各组件单元的 README.md 入口卡（状态/文件清单由仓库事实推）
│   ├── check-fresh.mjs            # 产物新鲜度：重跑生成再比对（pnpm check:drift）
│   ├── check-size.mjs             # 体积预算：共享产物 raw/gzip + 组件本体单文件上限
│   ├── serve.mjs                  # 本地静态服务器（零依赖，强制禁缓存）
│   ├── doc-drift/                 # 文档 ↔ 代码对账引擎（通用副本 + 版本号，见下）
│   └── doc-drift.config.mjs       # 本仓的约定（表头 / 骨架 / 豁免 / 要对账的数字）
├── uno.config.ts                  # 纯声明式配置，不引 node: 内置模块
├── tsconfig.json                  # 只覆盖 uno.config.ts，供 IDE 与 pnpm typecheck
├── index.html                     # 入口：只做引入（路由库 + o-app 挂载点）
├── app-config.js                  # ofa.js 应用配置（首页地址、加载态、错误兜底）
├── docs/                          # 站点级资源（跨组件的东西）
│   ├── pages/                     # 站点级页面模块：home / guide / components / specs
│   ├── layout.html                # 外壳布局页：顶栏 + 正文带 + <slot>
│   ├── doc-layout.html            # 组件页分区布局（API + 演示 + 目录）
│   ├── snippets/                  # 文档页引用的代码片段
│   ├── state/route.js             # 抽出的路由状态（$.stanz）
│   ├── components/                # 文档站自己的组件（nav/toc/crumb/pager/cards/palette/spec.html：文件名 + doc- 前缀 = 标签名）
│   ├── lib/md-spec.mjs            # 规范 md 的受限子集解析器（<doc-spec> 用它渲染参考区）
│   ├── site-map.js                # 站点唯一数据源（结构即菜单）
│   ├── routes.js                  # 路由工具：route() 归一当前路由
│   ├── theme-boot.js              # 首帧主题（防闪白）
│   └── shell.css  content.css     # 文档级视口/高度链 / 页面共用的正文样式
├── tests/
│   ├── smoke.mjs                  # 冒烟测试入口：默认只跑改动命中的套件（--record 重录地图）
│   ├── select.mjs                 # 选套件（--changed / --site / 按 slug）
│   ├── suite-map.json             # 文件 → 受影响套件（check:affected 用）
│   ├── lib/harness.mjs            # 公共基座：浏览器 / 断言 / 穿透查询注入 / 导航工具
│   ├── lib/suites.mjs             # 套件清单（doc-drift.config 也读它）
│   └── site/*.mjs                 # 跨组件的站点不变量
├── agent/
│   ├── README.md                  # 导航：什么时候读哪一份（先读这份）
│   ├── tutorial.md                # 教程：从零做一个组件（照着走一遍，保证能成）
│   ├── howto/                     # 食谱（只写步骤与验证）：改接口 / 加属性 / 加演示 / 加令牌
│   ├── doc-site.md  doc-pages.md
│   ├── authoring.md  authoring-style.md  checklist.md
│   ├── design-spec.md  design-tokens.md
│   ├── doc-render.md              # 参考区由 md 渲染 + 注意事项上移到页顶（已落地）
│   ├── api/                       # 组件 API 规范：README + 逐组件一份
│   ├── pitfalls/                  # ofa.js 踩坑：README + 按主题分文件
│   ├── plan/                      # 规划总纲：定位 / 决策 / 目录与构建 / 里程碑
│   ├── archive/                   # 已归档（默认不读）：docs-refactor.md + research/ 外部资料原文
│   └── vendor/                    # 外部资料：ofa-skill.md（ofa.js 官方知识库）
├── package.json                   # private: true（永不 publish）
└── README.md
```

**没有 `dist/`**。`packages/**` 就是 CDN 上的东西。

**组件共用的 JS 工具**放 `boot/`（分发时本来就必带这一层），组件用一行相对 `import` 引它
（和文档站组件 `import '../site-map.js'` 同一条路，ofa 编译期会把说明符改写成绝对 URL）。
现在只有一个：`scroll-pin.js` —— 做「不该改变滚动位置」的原生动作时把滚动条钉住
（原生 popover 开合时浏览器会顺手滚页面，实测与上游链接写在该文件头）。

**产物与手写文件的分界**：

| 文件                   | 手写 / 生成 | 可否 `<link>`              | 可否 adopt 进 shadow |
| ---------------------- | ----------- | -------------------------- | -------------------- |
| `boot/mosaic.js`       | 手写        | —（脚本）                  | 它负责 adopt         |
| `boot/mosaic.css`      | **生成**    | ✅                         | ✅                   |
| `boot/shadow-base.css` | 手写        | ❌                         | ✅                   |
| `boot/scroll-pin.js`   | 手写        | —（模块）                  | 组件 `import` 用     |
| `color/tokens.css`     | **生成**    | ✅（已被 mosaic.css 包含） | ✅                   |

---

## 二、构建与分发

```bash
pnpm tokens        # tools/gen-tokens.mjs → packages/color/tokens.css（含 WCAG 自检，不达标退出 1）
pnpm check:tokens  # 只自检，不写文件
pnpm build:css     # unocss -c uno.config.ts → packages/boot/mosaic.css
pnpm dev:css       # 同上，watch 模式
pnpm build         # = icons && tokens && build:css（三份生成脚本，产物都提交）
pnpm check:drift   # 产物新鲜度：重跑一遍生成并比对前后，变了就红（tools/check-fresh.mjs）
pnpm check:docs    # 文档 ↔ 代码对账：tools/doc-drift/drift.mjs 读 tools/doc-drift.config.mjs
pnpm check:size    # 体积预算：共享产物 raw/gzip + 组件本体单文件上限（tools/check-size.mjs）
pnpm lint:md       # markdown 结构：代码块没写语言 / 死锚点 / 列表符号（约定在 .markdownlint.jsonc）
pnpm check         # 提交前一条龙：typecheck && check:docs && check:drift && check:size && lint:md && format:check
pnpm dev           # 本地验收：tools/serve.mjs（零依赖，cache-control: no-store，端口 8642）
pnpm format:check  # prettier 只检查
```

**`check:docs` 的两份东西分工**（改约定时只看第一个）：

| 文件                         | 是什么                                                        | 什么时候改                                                                    |
| ---------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `tools/doc-drift.config.mjs` | 本仓的约定：文件放哪、表头叫什么、什么算豁免、哪些数字要对账  | **约定变了改这里**                                                            |
| `tools/doc-drift/`           | 通用引擎副本（零仓库知识），来自用户级 skill `doc-code-drift` | 引擎升版才动：`node ~/.dsh/skills/doc-code-drift/recipes/vendor.mjs --repo .` |

引擎副本带版本号（`node tools/doc-drift/drift.mjs --version`）；仓库这份是给别人 clone 用的，
不依赖本机装没装 skill。

**发布流程**：

1. 改代码 → `pnpm build` → 提交（**生成物一起提交**）
2. 打 tag `v0.1.0` → 推送 → jsDelivr 自动可用
3. 文档里的引入地址锁精确版本：`.../gh/lhf6623/mosaic@0.1.0/packages/boot/mosaic.js`
4. 发布后**逐文件比对内容哈希**：jsDelivr 有 version fallback，
   新版本缺文件时会静默回退旧版本，只看 HTTP 200 会被骗过去

**门禁都在本地**：`pnpm check`（静态守卫，秒级）随手跑；`pnpm test` 按改动范围选测；
全量 `pnpm test:all` 只在明确要求时跑。以前接过 push / PR 上自动跑全量的 GitHub Actions，
**已删**（推送时没人看那张脸，还要起浏览器；本地跑同一套更省事）。

---
