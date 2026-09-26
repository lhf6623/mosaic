# mc-collapse / mc-collapse-item

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/collapse/collapse.html` + `packages/collapse/collapse-item.html` · **已实现**

折叠面板，**容器 + 子项**两个标签：容器管外框、尺寸与互斥，子项管自己那格的开合。
开合直接骑在原生 `<details>/<summary>` 上 —— 键盘（<kbd>Enter</kbd> / <kbd>空格</kbd>）、
焦点、收起时内容对 <kbd>Tab</kbd> 与读屏都不可达，全是浏览器给的。

```html
<mc-collapse accordion>
  <mc-collapse-item header="配送与退换">下单后 48 小时内发货</mc-collapse-item>
  <mc-collapse-item header="发票说明" open>电子发票发到下单邮箱</mc-collapse-item>
</mc-collapse>
```

**mc-collapse（容器）**

| 名称        | 值             | 默认 | 说明                                                                    |
| ----------- | -------------- | ---- | ----------------------------------------------------------------------- |
| `accordion` | 布尔           | —    | 手风琴：同一时刻只允许一个子项展开                                      |
| `size`      | `sm` `md` `lg` | `md` | 头部高度 / 内边距 / 字号；只写在这一处，靠 `--mc-collapse-*` 继承给子项 |

| 名称     | 说明                    |
| -------- | ----------------------- |
| （默认） | 子项 `mc-collapse-item` |

外框（边框 / 圆角 / 底色）在 `:host` 上，`style="border-radius:0"` 直接覆盖；
子项之间的分隔线由容器画（子项自己不带边框）。没有 `part`。

**mc-collapse-item（子项）**

| 名称       | 值     | 默认 | 说明                                                                      |
| ---------- | ------ | ---- | ------------------------------------------------------------------------- |
| `header`   | 字符串 | —    | 头部文案。富内容用同名的 `header` 插槽                                    |
| `name`     | 字符串 | —    | 标识；`open` / `close` 事件的 `$event.data.name`                          |
| `open`     | 布尔   | —    | 展开状态。**既是初始值也是运行时状态**，会反射回宿主属性                  |
| `disabled` | 布尔   | —    | 点不动、<kbd>Tab</kbd> 跳过、读屏可感知（原生 `<details>` 没有 disabled） |

| 名称            | 说明                                       |
| --------------- | ------------------------------------------ |
| 插槽 `header`   | 头部内容，给了就覆盖 `header` 属性的纯文本 |
| 插槽（默认）    | 面板内容                                   |
| `part="header"` | 头部（内部那个原生 `summary`）             |
| `part="body"`   | 内容区                                     |

| 名称    | 类型                                                  | 说明                                                            |
| ------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `open`  | `(event: Event & { data: { name: string } }) => void` | 展开时在**子项**上触发；冒泡 + `composed`，挂在容器上收全部子项 |
| `close` | `(event: Event & { data: { name: string } }) => void` | 收起时在**子项**上触发；冒泡 + `composed`，挂在容器上收全部子项 |

```js
// 运行时状态用 property，立刻生效（内部不等 ofa 那一拍，见 P4）
item.open = true;
item.setAttribute('open', ''); // 等价，但异步一拍
```

> ⚠️ 属性叫 **`header`** 而不是 `title`：`title` 是全局 HTML 属性，
> 写在宿主上浏览器会在悬停时弹一个原生 tooltip（[P32](../pitfalls/01-props.md) 还会把它反射出来）。

| 令牌                     | 说明                                       |
| ------------------------ | ------------------------------------------ |
| `--mc-collapse-header-h` | 头部高度（容器按 `size` 赋值，继承进子项） |
| `--mc-collapse-pad-x`    | 头部 / 内容左右内边距                      |
| `--mc-collapse-body-pad` | 内容区底部内边距                           |
| `--mc-collapse-font`     | 头部 / 内容字号                            |

> ⚠️ 子项**不能**给这些变量写默认值：在 `:host` 上定义会盖掉从容器继承来的值，
> 容器上的 `size` 就永远不生效。子项侧一律写成 `var(--mc-collapse-header-h, 兜底)`。

---
