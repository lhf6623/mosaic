# 六、平台与环境（P23 / P24 / P25）

> 索引见 [`README.md`](./README.md)。

---

### P23 · ofa.js 的 CDN 不锁版本

官方示例用的是 `https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs`（无版本号），
会自动升级，历史上从 4.5 漂到 4.7+，并曾因新版把 `refresh` 收进 `$.fn` 而破坏组件。
但**锁死旧版本同样有风险**（锁 4.5.0 时 `o-fill` 的内嵌 `$data` 模板直接不可用）。

**Mosaic 的立场**：pin 一个**验证过的** ofa.js 版本（当前 `4.7.5`），兼容区间是
**`>=4.7 <5`**，每次升 ofa.js 必须跑一遍冒烟测试。这份契约写在文档里，**不写 `peerDependencies`**：
本库 `private: true` 永不发 npm，使用者走 CDN，ofa.js 也是运行时从 jsDelivr `import` 的 ——
没有 npm 解析器会读那个字段，写了只是惰性声明。将来真要发 npm / 给打包器用户用时再补。

### P24 · 本地验证必须禁缓存

用 `pnpm dev`（仓库自带 `tools/serve.mjs`，零依赖、`cache-control: no-store`）。
用默认缓存的静态服务器会导致「改完 `page.html` / `mosaic.js` 浏览器继续用旧模块」，
表现为"改了没生效"或诡异报错，排查极耗时。

### P25 · 动态生成主题必然有 FOUC，治理 = 同步引导 + 双兜底

ES module 天生 defer，模块在首帧渲染之后才执行 → 页面先无色再变色。

已知可行的方案（senti-ui 的 `st-boot.js` 思路）：

1. 主题生成后把 CSS 文本缓存进 `localStorage`
2. 配一个**经典同步脚本**放在 `<head>`，刷新时同步注入缓存
   （同步注入必须用经典 script，module 做不到）
3. 首次访问无缓存时，同步 `<link>` 一份静态兜底 CSS
4. 动态注入的 `<style>` 在 head 更靠后，同特异性自然覆盖兜底

---
