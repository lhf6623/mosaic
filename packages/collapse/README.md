# mc-collapse（折叠面板）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · M1 · 标签 `mc-collapse` · 目录 `packages/collapse/`

折叠面板。容器 + 子项，可选互斥；开合语义直接交给原生 details/summary，键盘与无障碍不用自己写。

## 单元里有什么

| 文件                 | 角色                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| `collapse.html`      | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `collapse-item.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`          | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`             | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`             | 9 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`              | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### `collapse.html`

mc-collapse — 折叠面板容器

容器只管外框、尺寸与互斥；开合本身在子项里（collapse-item.html）。

### `collapse-item.html`

mc-collapse-item — 折叠面板的子项（配合 mc-collapse 使用）

骑在原生 <details>/<summary> 上：开合、键盘、焦点、收起时内容不可达都是浏览器给的。
三条约定：状态只有宿主上的 open 属性；<details>.open 是内部实现，跟着属性走；
disabled 用 aria-disabled + tabindex=-1 + 头部 pointer-events:none 三件套堵住两条路。

## 令牌

| 令牌                     | 说明                                       |
| ------------------------ | ------------------------------------------ |
| `--mc-collapse-header-h` | 头部高度（容器按 `size` 赋值，继承进子项） |
| `--mc-collapse-pad-x`    | 头部 / 内容左右内边距                      |
| `--mc-collapse-body-pad` | 内容区底部内边距                           |
| `--mc-collapse-font`     | 头部 / 内容字号                            |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

> ⚠️ 子项**不能**给这些变量写默认值：在 `:host` 上定义会盖掉从容器继承来的值，
> 容器上的 `size` 就永远不生效。子项侧一律写成 `var(--mc-collapse-header-h, 兜底)`。

**运行时状态用 property**，立刻生效（内部不等 ofa 那一拍）：

```js
item.open = true;
item.setAttribute('open', ''); // 等价，但异步一拍
```

## 相邻单元

- 与 [`mc-menu`](../menu/) / [`mc-breadcrumb`](../breadcrumb/) 同族：**容器 + 子项**两个标签，容器管外框与尺寸（靠 `--mc-collapse-*` 继承给子项），子项管自己那格。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
