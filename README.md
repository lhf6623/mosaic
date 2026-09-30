# Mosaic

基于 [ofa.js](https://ofajs.com) 的**免安装、免构建** Web Components UI 框架：在 HTML 里加一个 `<link>` 和一个
`<script type="module">`，就能用 `<mc-button>` —— 没有 npm、没有打包器、没有脚手架、没有配置文件。

## 用法

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/boot/mosaic.css"
/>
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/boot/mosaic.js"
></script>

<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
<mc-button color="primary">提交</mc-button>
```

三条引入各管一段，**缺一不可**：

- `mosaic.css` —— 令牌（颜色 / 间距 / 字号）与工具类，给**你自己的页面**用；
- `mosaic.js` —— 把工具类注入每个 shadow root（组件内部的样式靠它，令牌靠继承）；
- `<l-m src="…">` —— 按需拉取并注册组件本体，**一个组件一条**（目录 `tag/` 对应标签 `mc-tag`）。

> `0.1.0` 是计划中的 M1 版本，仓库还没有 tag —— 首次发布前这些 URL 会 404。
