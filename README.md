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
