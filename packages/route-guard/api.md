# mc-route-guard

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./route-guard.html` · **已实现**

路由守卫：在 ofa.js 的 `o-app` 里，点击**指向当前路由的 `olink` 链接**不再重新进入当前页，
避免当前页被重建、状态丢失。只对带 `olink` 的站内链接生效；普通 `<a href>` 不归它管。

```html
<l-m src="./packages/route-guard/route-guard.html"></l-m>

<mc-route-guard attr:disabled="guardDisabled" on:same-route="onSameRoute($event)"></mc-route-guard>

<a olink href="./packages/button/page.html">按钮文档</a>
```

链接上加 `olink-force` 可跳过守卫（仍由 ofa 的 `olink` 正常导航）；组件上的 `disabled`
可整体停用。守卫只负责拦点击导航，不改 `app.goto` / `app.replace` —— 需要主动刷新时仍显式调用它们。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/route-guard/route-guard.html"></l-m>

<mc-route-guard id="guard"></mc-route-guard>

<script type="module">
  await customElements.whenDefined('mc-route-guard');
  // 对象 / 数组属性：$("#guard").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/route-guard/route-guard.html"></l-m>

<mc-route-guard></mc-route-guard>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称       | 值        | 默认 | 说明                                                 |
| ---------- | --------- | ---- | ---------------------------------------------------- |
| `disabled` | `boolean` | —    | 停用守卫：存在时不拦同路由点击，点击照常交给 olink。 |

## 事件

| 名称         | 类型                                                          | 说明                                                                                                                                       |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `same-route` | `(event: CustomEvent<{ href: string, src: string }>) => void` | 点中当前路由的 `olink` 链接时在守卫宿主上触发；`href` 是目标绝对地址、`src` 是当前页面 src。导航已经被拦下，事件用于收尾 / 埋点 / 关抽屉。 |
