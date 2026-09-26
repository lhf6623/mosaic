# 九、模板控制流与插槽（P38）

> 索引见 [`README.md`](./README.md)。

---

### P38 · `o-fill` / `o-if` 的内容在**它们自己的 light DOM** 里，容器的 `::slotted()` 够不到

```html
<!-- ❌ 分隔符 / 间距静默消失：mc-breadcrumb 的 ::slotted(mc-breadcrumb-item) 匹配不到 -->

<mc-breadcrumb>
  <o-fill :value="levels" fill-key="path">
    <mc-breadcrumb-item>…</mc-breadcrumb-item>
  </o-fill>
</mc-breadcrumb>

<!-- ✅ 每一级是直接子元素；整块显隐用属性钩子 -->
<mc-breadcrumb attr:data-hidden="visible ? null : ''">
  <mc-breadcrumb-item>…</mc-breadcrumb-item>
  <mc-breadcrumb-item current>…</mc-breadcrumb-item>
</mc-breadcrumb>
```

**现象**：页面照常渲染、控制台零报错，**只是容器的 `::slotted()` 规则（分隔符、间距、对齐）
全部不生效**。实测：`mc-breadcrumb` 的 `directChildren` 是 `['o-fill']`，
每一级的 `parentElement` 是 `o-else` / `o-if`，`::before` 的 `content` 是 `none`（本该是 `"/"`）。

**原因**：`o-fill` / `o-if` / `o-else` 都是自定义元素，条目渲染进的是**它们的** light DOM
（见 [P12](#p12--o-fill-把条目渲染在自己的-light-domiinnerhtml里)）。
`::slotted()` 只按「宿主元素的**被分配节点**」匹配，于是它看到的是 `o-fill`，不是里面的条目。

**为什么难查**：`o-fill` 是 `display: contents`，条目在**布局上**照旧参与父容器（flex 间距、
对齐都正常），只有 `::slotted()` 这一条路断掉 —— 看起来像「样式只丢了一半」。

**写法**：

- 组件内部用控制流渲染的条目，别指望容器用 `::slotted()` 去画东西；要么把条目直接写开，
  要么把视觉放在条目**自己的** shadow root / `:host` 上（`mc-menu-item` 就是后者）。
- 需要「第一项不画分隔符」这类**位置相关**的样式时尤其注意：`o-fill` 一旦包一层，
  `:first-child` 也会跟着变成对 `o-fill` 判断，位置语义就没了。
- 容器侧的选择器（`> .child`、`slot[name]` 之外的组合器）同理够不到嵌套条目，
  排查时先 `console.log([...host.children].map(e => e.tagName))` 看一眼真实子元素。

---
