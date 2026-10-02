# mc-tabs（标签页）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-tabs` · 目录 `packages/tabs/`

标签页。

## 单元里有什么

| 文件        | 角色                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `tabs.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `tab.html`  | 同族子标签，随本体一起引入                                                    |
| `page.html` | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`    | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`    | 4 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`     | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### 标签与面板都是使用者的 light DOM

标签（`mc-tab`）与面板（`slot="panel"`）都由使用者写在容器里，容器一个节点都不造、也不搬。
所以：**面板用 `hidden` 常驻 DOM**，不用 `o-if` / `o-fill` 去渲染 ——
一旦用 `o-fill` 包一层，容器自己的 `:scope > mc-tab` / `:scope > [slot="panel"]` 收集就会失配
（那一族），而且切回来时内容与滚动位置会丢。

容器只认**直接子项**：嵌套的 `mc-tabs` 各自算各自的，不会互相误伤（同 `mc-collapse` 的容器策略）。

### 值：初始值属性、运行时 property

`default-value` 只决定首屏（`attrs` 里声明，所以它是 observed attribute）；运行时读写宿主
property `value` —— 它在 `ready()` 里挂访问器，不是 `attrs` 键、也不反射成属性
（规范 1.4）。`el.value = 'b'` 是同步生效的，
且**不发 `change`**：事件只表示"使用者改了它"。

指向禁用项、或指向一个不存在的 `value` 时都退到第一个可用项 —— 面板与标签因此不会同时空着。

### 键盘

- 可交互元素是 `mc-tab` 内部那颗**原生 `<button>`**（`part="base"`），禁用直接走
  `:disabled`：指针、键盘两条路一起堵住。
- roving tabindex 写在这颗 button 上：只有激活项 `tabindex="0"`，其余 `-1`；方向键 /
  <kbd>Home</kbd> / <kbd>End</kbd> 移动**并激活**（焦点也跟着走），跳过禁用项、到头绕回。
- 指示条（`part="indicator"`）由 JS 按激活标签**内部 button** 的位置写宽度与位移，
  `ResizeObserver` 盯着标签条与每个标签：字体、文案、容器宽度变了都跟着重摆，
  `mc-tab` 比容器晚升级也能补上。

## 令牌

| 令牌                    | 默认                        | 作用                                      |
| ----------------------- | --------------------------- | ----------------------------------------- |
| `--mc-tabs-tab-h`       | `--mc-control-h-md`         | 标签高度（只写在容器上，继承进 `mc-tab`） |
| `--mc-tabs-pad-x`       | `--mc-space-3`              | 标签左右内边距                            |
| `--mc-tabs-font`        | `--mc-text-sm`              | 标签字号                                  |
| `--mc-tabs-gap`         | `--mc-space-1`              | 标签之间的间距                            |
| `--mc-tabs-panel-pad`   | `--mc-space-4`              | 面板容器上下内边距                        |
| `--mc-tabs-fg`          | `--mc-color-fg-muted`       | 未选中标签的文字色                        |
| `--mc-tabs-fg-hover`    | `--mc-color-fg`             | 悬停时的文字色                            |
| `--mc-tabs-fg-selected` | `--mc-color-primary`        | 选中标签的文字色                          |
| `--mc-tabs-bg-hover`    | `--mc-color-surface-sunken` | 悬停时的标签底色                          |
| `--mc-tabs-border`      | `--mc-color-border`         | 标签条那根下边线                          |
| `--mc-tabs-indicator`   | `--mc-color-primary`        | 指示条颜色                                |
| `--mc-tabs-indicator-h` | `2px`                       | 指示条粗细                                |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

> ⚠️ `mc-tab` 侧一律写成 `var(--mc-tabs-x, 兜底)`：在子项 `:host` 上写默认值会盖掉容器继承来的值，
> 容器的尺寸通道就永远不生效（同 `mc-collapse-item` 那条）。

## 相邻单元

- 与 [`mc-collapse`](../collapse/) / [`mc-menu`](../menu/) 同族：**容器 + 子项**两个标签，容器管外框与尺寸
  （靠 `--mc-tabs-*` 继承给子项），子项管自己那一格。
- 本体不依赖任何其它组件（零 `load()`）：标签文案就是普通插槽，图标之类的自己写在标签里。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
