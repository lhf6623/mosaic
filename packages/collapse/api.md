# mc-collapse / mc-collapse-item

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./collapse.html` + `./collapse-item.html` · **已实现**

折叠面板，**容器 + 子项**两个标签：容器管外框、尺寸与互斥，子项管自己那格的开合。
开合直接骑在原生 `<details>/<summary>` 上 —— 键盘（<kbd>Enter</kbd> / <kbd>空格</kbd>）、
焦点、收起时内容对 <kbd>Tab</kbd> 不可达，全是浏览器给的。

```html
<mc-collapse accordion>
  <mc-collapse-item header="配送与退换">下单后 48 小时内发货</mc-collapse-item>
  <mc-collapse-item header="发票说明" open>电子发票发到下单邮箱</mc-collapse-item>
</mc-collapse>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/collapse/collapse.html"></l-m>

<mc-collapse id="demo"></mc-collapse>

<script type="module">
  await customElements.whenDefined('mc-collapse');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/collapse/collapse.html"></l-m>

<mc-collapse></mc-collapse>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

### mc-collapse

| 名称        | 值                     | 默认 | 说明                                                                    |
| ----------- | ---------------------- | ---- | ----------------------------------------------------------------------- |
| `accordion` | `boolean`              | —    | 手风琴：同一时刻只允许一个子项展开                                      |
| `size`      | `'sm' \| 'md' \| 'lg'` | `md` | 头部高度 / 内边距 / 字号；只写在这一处，靠 `--mc-collapse-*` 继承给子项 |

### mc-collapse-item

| 名称       | 值        | 默认 | 说明                                                          |
| ---------- | --------- | ---- | ------------------------------------------------------------- |
| `header`   | `string`  | —    | 头部文案。富内容用同名的 `header` 插槽                        |
| `name`     | `string`  | —    | 标识；`open` / `close` 事件的 `$event.data.name`              |
| `open`     | `boolean` | —    | 展开状态。**既是初始值也是运行时状态**，会反射回宿主属性      |
| `disabled` | `boolean` | —    | 点不动、<kbd>Tab</kbd> 跳过（原生 `<details>` 没有 disabled） |

## 事件

| 名称    | 类型                                                  | 说明                                                            |
| ------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `open`  | `(event: Event & { data: { name: string } }) => void` | 展开时在**子项**上触发；冒泡 + `composed`，挂在容器上收全部子项 |
| `close` | `(event: Event & { data: { name: string } }) => void` | 收起时在**子项**上触发；冒泡 + `composed`，挂在容器上收全部子项 |

## 插槽

| 名称     | 说明                                                                     |
| -------- | ------------------------------------------------------------------------ |
| （默认） | **`mc-collapse`（容器）**：放子项 `mc-collapse-item`；**子项**：面板内容 |
| `header` | **子项 `mc-collapse-item`**：头部内容，给了就覆盖 `header` 属性的纯文本  |

## part

| 名称     | 说明                                                    |
| -------- | ------------------------------------------------------- |
| `header` | **子项 `mc-collapse-item`**：头部（内部原生 `summary`） |
| `body`   | **子项 `mc-collapse-item`**：内容区                     |
