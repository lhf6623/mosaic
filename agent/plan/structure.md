# 目录结构与构建分发

仓库长什么样、产物怎么出去。

> 相关：[`decisions.md`](./decisions.md)（D1 分发 / D2 组件形态）。

---

## 一、目录结构

```
mosaic/
├── packages/
│   ├── boot/                      ← 运行时引导
│   │   ├── mosaic.js              # 手写：attachShadow 补丁 + adopt（唯一必需引入）
│   │   ├── mosaic.css             # 生成并提交：令牌 + 工具类（可 <link>）
│   │   └── shadow-base.css        # 手写：只进 shadow root 的 reset（禁止 <link>）
│   ├── color/
│   │   ├── tokens.css             # 生成并提交：三层令牌（层顺序也在这里声明）
│   │   └── page.html              # 令牌文档页
│   ├── button/ code/ collapse/ menu/ breadcrumb/
│   │   ├── {name}.html            # 组件本体（源 = 产物，构建不碰它）
│   │   ├── page.html              # 文档页，注册在 docs/site-map.js
│   │   ├── demos/*.html           # 可交互演示（一个例子一个文件）
│   │   └── test/{slug}.test.mjs   # 组件自己的冒烟套件
│   └── {next}/{next}.html ...
├── tools/
│   ├── gen-tokens.mjs             # 调色板生成 + WCAG 自检
│   ├── build-css.mjs              # CSS 构建入口（含「缺输入大声失败」守卫）
│   └── serve.mjs                  # 本地静态服务器（零依赖，强制禁缓存）
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
│   ├── components/                # 文档站自己的组件（nav/toc/crumb/pager/cards/palette.html：文件名 + doc- 前缀 = 标签名）
│   ├── site-map.js                # 站点唯一数据源（结构即菜单）
│   ├── routes.js                  # 路由工具：route() 归一当前路由
│   ├── theme-boot.js              # 首帧主题（防闪白）
│   └── shell.css  content.css     # 文档级视口/高度链 / 页面共用的正文样式
├── tests/
│   ├── smoke.mjs                  # 冒烟测试入口：站点套件 + 各组件套件
│   ├── lib/harness.mjs            # 公共基座：浏览器 / 断言 / 穿透查询注入 / 导航工具
│   └── site/*.mjs                 # 跨组件的站点不变量
├── agent/
│   ├── README.md                  # 导航：什么时候读哪一份（先读这份）
│   ├── doc-site.md  doc-pages.md
│   ├── authoring.md  authoring-style.md  checklist.md
│   ├── design-spec.md  design-tokens.md
│   ├── api/                       # 组件 API 规范：README + 逐组件一份
│   ├── pitfalls/                  # ofa.js 踩坑：README + 按主题分文件
│   ├── plan/                      # 规划总纲：定位 / 决策 / 目录与构建 / 里程碑
│   ├── docs-refactor.md           # 已完成的重构记录（考古用）
│   └── research/{unocss,jsdelivr,state}.md
├── package.json                   # private: true（永不 publish）
└── README.md
```

**没有 `dist/`**。`packages/**` 就是 CDN 上的东西。

**产物与手写文件的分界**：

| 文件                   | 手写 / 生成 | 可否 `<link>`              | 可否 adopt 进 shadow |
| ---------------------- | ----------- | -------------------------- | -------------------- |
| `boot/mosaic.js`       | 手写        | —（脚本）                  | 它负责 adopt         |
| `boot/mosaic.css`      | **生成**    | ✅                         | ✅                   |
| `boot/shadow-base.css` | 手写        | ❌                         | ✅                   |
| `color/tokens.css`     | **生成**    | ✅（已被 mosaic.css 包含） | ✅                   |

---

---

## 二、构建与分发

```bash
pnpm tokens        # tools/gen-tokens.mjs → packages/color/tokens.css（含 WCAG 自检，不达标退出 1）
pnpm check:tokens  # 只自检，不写文件
pnpm build:css     # unocss -c uno.config.ts → packages/boot/mosaic.css
pnpm dev:css       # 同上，watch 模式
pnpm build         # = tokens && build:css
pnpm check:drift   # CI：重新生成后 git diff --exit-code，防止产物与生成器漂移
pnpm dev           # 本地验收：tools/serve.mjs（零依赖，cache-control: no-store，端口 8642）
pnpm format:check  # prettier 只检查
```

**发布流程**：

1. 改代码 → `pnpm build` → 提交（**生成物一起提交**）
2. 打 tag `v0.1.0` → 推送 → jsDelivr 自动可用
3. 文档里的引入地址锁精确版本：`.../gh/lhf6623/mosaic@0.1.0/packages/boot/mosaic.js`
4. 发布后**逐文件比对内容哈希**：jsDelivr 有 version fallback，
   新版本缺文件时会静默回退旧版本，只看 HTTP 200 会被骗过去

---
