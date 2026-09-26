# 里程碑、风险与待定

做到哪一步了、还剩什么、哪些还没定。

> 相关：[`decisions.md`](./decisions.md)、[`README.md`](./README.md)。

---

## 一、里程碑

### M0 — 打通骨架 ✅ **D3 已验证成立**

冒烟测试在 `tests/smoke.mjs`（真浏览器；M0 当时 22 项断言，现为 194 项
= 11 站点套件 + 5 组件套件，`pnpm test`）。

- [x] `attachShadow` 补丁在真实 ofa.js 上生效 —— shadow root 内 `class="flex gap-2"` 起作用
- [x] `@layer` 优先级正确 —— 组件自身 `<style>`（未分层）赢过工具类
- [x] 工具类产物注入 shadow root（M0 当时的快照：387 条规则；现为 370 条）
- [x] 主题切换能穿过 shadow 边界（`rgb(114 70 237)` → `rgb(189 182 255)`）
- [x] 令牌靠自定义属性继承进 shadow root
- [x] 文档站五个页面可访问、无 404、色板实时渲染
- [ ] 验证降级：故意让补丁失效，确认颜色/尺寸仍正常，只有排布退化
- [ ] CI 接入（`check:drift` + 冒烟测试 + 体积上限）

**M0 推翻/修正了两条我原本写错的设计**，都已落到实现里：

1. **颜色令牌全链路必须是通道三元组。**
   第一版 L1 存三元组、L2 却存完整颜色（`rgb(var(--mc-primary-600))`），
   UnoCSS 拼出 `rgb(rgb(114 70 237) / 1)` 这种非法 CSS，**所有语义色工具类静默失效**。
   是冒烟测试里的 `text-muted → neutral-600` 断言把它抓出来的。

2. **令牌只能定义在 `:root`，不能带 `:host`。**
   令牌表在 shadow root 里也会被 adopt，`:host` 会给宿主元素重新赋一遍亮色值，
   盖掉从文档继承的暗色值 —— 切主题时组件纹丝不动。同样零报错。

这两条都是「D3 是否成立」的一部分，结论是：**D3 成立**，但前提是上面两条守住。

- **产出**：可运行的文档站（`pnpm dev`）+ 当时 22 项真浏览器断言全绿

### M1 — 令牌与基础组件

- [x] 已实现：`mc-button` / `mc-code` / `mc-collapse`（含 item）/ `mc-menu`（含 item）/
      `mc-breadcrumb`（含 item）/ `mc-card` / `mc-tag`
- [ ] 待建：`mc-icon` / `mc-badge` / `mc-spinner`
- [ ] 每个组件补齐 `{name}.html` + `page.html` + `demos/*.html` + `test/{slug}.test.mjs`
      （**没有** per-component 的 `README.md` / `index.html`）
- **产出**：可发布的 0.1.0

### M2 — 表单与反馈

`mc-input` / `mc-textarea` / `mc-checkbox` / `mc-radio` / `mc-switch` / `mc-select` /
`mc-alert` / `mc-toast` / `mc-progress`

表单类组件统一约定见 [组件 API 规范](../api/README.md)。
这一批会大量撞上 [踩坑清单](../pitfalls/README.md) 的 P6 / P18 / P19 / P20（值的反射与事件穿透）。

### M3 — 浮层与布局

`mc-dialog` / `mc-dropdown` / `mc-tooltip` / `mc-tabs` / `mc-table` / `mc-grid`

> ⚠️ M3 开头必须先验证图层：shadow DOM 里的 `position: fixed` + `z-index`
> 与宿主页面层叠上下文的关系。`--mc-z-*` 令牌已定义好，但弹出层挂在 shadow root 内部时，
> 是否会被宿主的 `transform` / `filter` 困住，需要实测后决定是否改用 popover API。

### M4 — 工程加固

CI 全量接入（令牌自检 + drift 检查 + 冒烟测试 + 体积上限）、
主题预设、自托管部署方案。

---

---

## 二、风险登记

| 风险                       | 影响                                         | 缓解                                                            |
| -------------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| **D3 运行时补丁失效**      | 组件失去排布（颜色/尺寸仍在）                | 降级是分级的（D3）；M0 端到端冒烟测试；退路是每组件 `<link>`    |
| 生成物与生成器漂移         | CDN 上的东西和源码不一致                     | 生成物提交进仓库 + CI `check:drift`                             |
| jsDelivr 在大陆不可达      | 使用者无法加载                               | 换入口域名 + 自托管；不赌单一 CDN                               |
| 预编译工具类子集不够用     | 使用者写了不存在的类名，静默无效果           | 文档首页写明边界；提供反馈入口                                  |
| ofa.js 升级破坏组件        | 大量组件同时失效                             | pin 验证过的版本（兼容区间 `>=4.7 <5`）+ 升级必跑冒烟（见 P23） |
| 体积失控                   | 令牌 ≈14.1 KB + 工具类 ≈21 KB                | CI 设体积上限；L1 色阶可拆成独立文件按需引入                    |
| 代码高亮的 CDN 不可达      | 代码块没有颜色（排版、行号、主题跟随都正常） | 失败即降级为纯文本；`hljs-base` 支持自托管 / 换镜像             |
| 组件作者重复踩 ofa.js 的坑 | 排查极耗时（都是静默失效）                   | [踩坑清单](../pitfalls/README.md) 作为写组件的必需前置阅读      |

---

---

## 三、待定

1. **标签前缀**：当前 `<mc-*>`。个人自用不 publish，只要目录名和标签前缀自洽即可。
2. **品牌主色**：当前 OKLCH 色相 288°（紫罗兰）。
   换色改 `tools/gen-tokens.mjs` 里一个数字，对比度自检会保证换完仍达标。
3. **是否随组件附一份给 AI 读的自包含 `README.md`** —— 纯增量工作，M1 之后再定。
