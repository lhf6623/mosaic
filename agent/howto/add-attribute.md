# 怎么给已有组件加一个属性

> **这是食谱**：你已经知道属性该长什么样（规矩在 [`../authoring.md`](../authoring.md)），
> 只想把「加一个属性」这件事做完。第一次做组件请先走 [`../tutorial.md`](../tutorial.md)。

例子：给 `mc-tag` 加一个 `pill` 属性（圆角拉满）。

---

## 步骤

**1. 代码里写进 `attrs`**（`packages/tag/tag.html`）

```js
attrs: {
  closable: null,
  // ⚠️ 布尔属性默认值写 `null`，不是 `false`（P1）
  pill: null,
},
```

没写进 `attrs` 就不是 observed attribute —— 外部 `setAttribute` 收不到，且不报错。

**2. CSS 用 `:host([attr])` 驱动**（不拼接类名）

```css
:host([pill]) {
  --mc-tag-radius: 9999px;
}
```

**3. `api.md` 的属性表加一行**（`packages/tag/api.md`）

```markdown
| `pill` | 布尔 | — | 圆角拉满（胶囊形） |
```

表头必须是 `名称 | 值 | 默认` —— 对账拿第 1 列对名字、第 3 列对默认值。
**没写这行 `pnpm check:docs` 会红**：代码有、文档没有。

**4. 只改外观就不用动 README**；如果顺带加了新的令牌，见
[`add-token.md`](./add-token.md)。

**5.（可选）演示里体现它** —— 见 [`add-demo.md`](./add-demo.md)。

---

## 验证

```bash
pnpm check:docs          # 属性名与默认值都对上
node tests/smoke.mjs tag # 组件自己的套件
```

---

## 这一步最容易踩的（都是静默失效）

| 坑                                                              | 症状                                            |
| --------------------------------------------------------------- | ----------------------------------------------- |
| [P1](../pitfalls/01-props.md) 布尔默认写成 `false`              | `pill` 一上来就是「有」，去掉属性也不会变回没有 |
| [P5](../pitfalls/01-props.md) `watch` 没跳首次触发              | 初始化时被默认值触发一次，跑了一段不该跑的逻辑  |
| [P14](../pitfalls/03-style-scope.md) 写了 `:host(:not([pill]))` | 选择器**静默失效**，默认态样式整块丢失          |
| [P10](../pitfalls/02-template.md) 用 `o-if` 控制显隐            | 运行时切换时模板不重渲染，改了没反应            |

改完拿 [`../checklist.md`](../checklist.md) 的「ofa.js 正确性」那节对一遍再提交。
