# Mosaic

基于 [ofa.js](https://ofajs.com) 的**免安装、免构建** Web Components UI 框架：引一个 ofa.js、按需引一个组件，
就能用 `<mc-button>` —— 没有 npm、没有打包器、没有脚手架、没有配置文件，**也不用引任何 CSS**。

## 用法

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js@4.7.5/dist/ofa.min.mjs"></script>

<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
<mc-button color="primary">提交</mc-button>
```

**就这两样**：ofa.js 和你要用的组件。组件自己把样式基座（shadow reset + 令牌默认值）带进 shadow root：

- **不外溢** —— 组件的样式全在自己 shadow root 里，你的全局选择器影响不到它，它也不改你的页面；
- **可换肤** —— 组件写的是两级回退 `var(--mc-color-primary, var(--mc-def-color-primary))`：你在 `:root` /
  `[data-theme]` / 元素 `style` 上给的令牌**一定赢**，只有没定义时才落到自带默认值；
- **可选** —— `mosaic.css` 给**你自己的页面**提供工具类与完整令牌表（含亮色 / 暗色两态）。

> `0.1.0` 是计划中的首个版本，仓库还没有 tag —— 首次发布前这些 URL 会 404。

## 开发

```bash
pnpm dev     # 本地起文档站（http://127.0.0.1:8642；复现子路径加 --prefix /mosaic）
pnpm check   # 静态守卫：tsc / 文档与代码对账 / 生成物新鲜度 / 体积 / markdownlint / prettier
```

测试按「改动 → 该跑哪些套件」选，**不要默认全量**；全量只由显式命令触发：

- `pnpm test`：默认入口（= `pnpm test:changed`）。用 `tests/suite-map.json` 的依赖地图 + 兜底策略，
  只跑本次改动命中的套件，并打印每个文件的命中原因。**工作区干净 → 什么都不跑**（不会自动转全量）；
  若这次改动被判定为全量（共享面 / 依赖地图缺失），入口会**拒绝执行并退出 1**，把决定权交给你。
- `node tests/smoke.mjs <slug>`：只跑一个组件的套件，适合单组件迭代（也不会被别的套件偶发干扰）。
- `pnpm test:all`：全量（约 2 分钟，含 35s 预热）。**只在明确要求时跑**——它是显式全量入口
  （等价的还有不带过滤的 `node tests/smoke.mjs`）；`pnpm test:record` 的整份重录同理。
- `node tests/smoke.mjs <slug> --record`：新增组件 / 依赖变化后重录该套件的依赖地图；`pnpm test:record` 重录整份。

纯文档改动（`.md`、导语文案）跑 `pnpm check` 就够；浏览器套件只测运行时，不读这些文件。
选测逻辑的细节见 `tests/select.mjs` 与 `tests/smoke.mjs` 文件头。
