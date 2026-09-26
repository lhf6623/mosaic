# 附：Mosaic 参考组件曾踩中的条目

> 索引见 [`README.md`](./README.md)。

---

`packages/button/button.html` 第一版（照文档写的）一次踩中 **P1 / P2 / P10**：`disabled` 默认
`false` 且没进 `attrs`、转发用 `attr:disabled`、loading 用 `<o-if>`。三条已修 —— 这份清单的
存在意义就是别再犯第二次。
