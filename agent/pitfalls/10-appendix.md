# 附：Mosaic 参考组件曾踩中的条目

> 索引见 [`README.md`](./README.md)。

---

`packages/button/button.html` 第一版（照文档写的）一次踩中 **P1 / P2 / P10**：`disabled` 默认
`false` 且没进 `attrs`、转发用 `attr:disabled`、loading 用 `<o-if>`。三条已修 —— 这份清单的
存在意义就是别再犯第二次。

`packages/alert/alert.html` 第一版画图标时写了内联 svg，踩中 **P41**：VS Code Live Server
下组件模块加载失败（控制台一句 `wrong module address`），页面上 28 个实例全部没升级、演示区
空着。**已修**：图形改用 DOM API 建，文件里不再有注入点；同时补了 `tests/site/07` 的两条与
`tests/site/05` 的「空演示」守卫 —— 这个坑以前没有任何测试能拦到，现在有两条。
