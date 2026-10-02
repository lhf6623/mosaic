# mc-input（输入框）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-input` · 目录 `packages/input/`

单行输入框。可清除、前后缀插槽。

## 单元里有什么

| 文件         | 角色                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `input.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`  | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`     | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`     | 9 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`      | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**值只有一条通道：属性进（初始值）、property 出（运行时值）。**

```js
this._input.value = String(this.defaultValue ?? ''); // 初始值：default-value 属性，只读一次
Object.defineProperty(this.ele, 'value', {
  // 运行时值：宿主 DOM property，真相在内部原生元素
  configurable: true,
  get: () => this._input.value,
  set: (v) => {
    this._input.value = String(v ?? '');
    this.applyState();
  },
});
```

- 宿主 property 是**取景器**不是副本：`el.value = 'x'` 直接写内部原生 `<input>`，读也读它 ——
  所以 `e.target.value` 在事件处理器里读得到，
  不存在「property 与内部元素谁更新」的问题。
- `value` **不声明进 `attrs`**：声明了 ofa 就会把它当 observed attribute，属性 / property 两条通道
  会互相覆盖（`<mc-input value="x">` 于是看起来"能设"，但那是初始值语义，与 `default-value` 撞车）。
- **初始值由 `applyDefaultValue()` 读，不读 `this.defaultValue`**：`attrs` 的数据在 `ready()` 那一刻还
  没铺好（实测 `this.defaultValue === ''` 而宿主上明明写着属性），所以直接读宿主属性、并用
  `_defaultApplied` 记账只生效一次 —— `ready()` 接住声明式 HTML，`attached()` 接住
  「createElement 之后再 `setAttribute`」那条路（属性在不在不能当条件，要看值）。
- 写宿主属性（`data-has-*`）一律走 `applyState()`，它不是只在 `attached()` 之后生效 ——
  构造期写宿主会抛 `NotSupportedError`。

**`data-has-clear` / `data-has-prefix` / `data-has-suffix` 是 CSS 唯一的输入**：× 该不该出现、
空插槽该不该占那一个 `gap`，CSS 都看不见（slot 有没有分到节点只有 JS 知道），
所以由 `slotchange` + property 写入镜像成宿主属性，样式从宿主上选（常驻 DOM + 属性显隐，不用 `o-if`）。`data-has-clear` 是一个**派生事实**
（`clearable` + 有内容 + 没被禁用 / 只读），不给 CSS 留"两个条件相与"的差事 ——
`:host([a][b])` 与 `:host([disabled])` 撞在一起时，特异性会把禁用态盖回可见。

**原生 `input` 事件被拦掉了**：原生 `input` 自带 `composed: true`，不拦的话宿主上会先收到一条
**没有 `data`** 的原生事件、再收到组件转发的那条，`on:input="v = $event.data.value"` 会先抛一次
异常。所以 `onInput()` 先 `stopPropagation()`，对外**永远只有一条带 `data.value` 的 `input`**。
`change` 本来就是 `composed: false`，不存在这个问题。

**转发给内部原生元素：除了 `disabled` 一律用 `attr:`，不要用 `:prop`**（这是踩出来的：
`<input>` 上的 `:placeholder` / `:type` / `:name` 生效，但同一份模板里的 `<textarea>` 上
`:placeholder` / `:rows` **完全不生效**；`<input>` 上的 `:maxlength` / `:readonly` 只写成同名的
expando —— 真正的 IDL 是 `maxLength` / `readOnly`，所以要写进属性）。`attr:` 对 `null` 是**移除属性**
（空 `placeholder=""`、无上限的 `maxlength` 都靠这条），`disabled` 仍用 `:disabled`（IDL 就是小写，且 `attr:` 会把 `false`
序列化成 `"false"` 反而永远禁用）。

**行盒子写在宿主上**：高度、内边距、底色、边框、焦点环全在 `:host`（外部 `style="…"` 就能覆盖），
`::slotted()` 一个属性都没写 —— 插槽内容只承载语义，颜色从 `part="prefix"` / `part="suffix"`
那两层的容器继承下去。

**没有 `color` / `variant` 维度**：输入框的语气由 `invalid` 一个布尔表达（错误色取
`--mc-color-danger`），多一个色板只会让「校验失败」和「品牌色」两件事混在一起。

## 令牌

| 令牌                      | 默认                        | 作用                                  |
| ------------------------- | --------------------------- | ------------------------------------- |
| `--mc-input-bg`           | `--mc-color-surface-sunken` | 输入区底色                            |
| `--mc-input-border`       | `--mc-color-border-strong`  | 常态边框，也是禁用态边框              |
| `--mc-input-border-hover` | `--mc-color-fg-subtle`      | hover 边框                            |
| `--mc-input-placeholder`  | `--mc-color-fg-subtle`      | 占位符颜色                            |
| `--mc-input-affix-color`  | `--mc-color-fg-muted`       | `prefix` / `suffix` 插槽容器的颜色    |
| `--mc-input-clear-color`  | `--mc-color-fg-subtle`      | × 的颜色（hover / active 是它的叠加） |
| `--mc-input-gap`          | `--mc-space-2`              | 前后缀、输入区、× 之间的间距          |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

## 相邻单元

- 与 [`mc-textarea`](../textarea/) 同族：同一套值读写与事件约定，差别只在单行 / 多行。
- 后面 5 个表单组件（checkbox / radio / switch / select / progress）照这一份抄：
  `default-value` 属性 + `value` property + `input` / `change` 的 `data.value` + `data-has-*` 镜像。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
