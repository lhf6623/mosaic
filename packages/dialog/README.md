# mc-dialog（对话框）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-dialog` · 目录 `packages/dialog/`

对话框。遮罩、焦点陷阱、Esc 关闭。

## 单元里有什么

| 文件          | 角色                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `dialog.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`   | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`      | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`      | 6 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）               |
| `test/`       | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**浮层形态照 [`mc-popover`](../popover/README.md) 的结论**：整块（遮罩 + 面板）是**一个**
`popover="manual"` 元素，进 top layer —— 不受宿主页面 `transform` / `filter` / `contain` 影响，
**不挂 `document.body`、不用 `z-index` 令牌**。用 `manual` 而不是 `auto` 是刻意的：
`auto` 的 light dismiss 会在 `pointerdown` 上把面板关掉，而模态对话框要自己决定
「点遮罩到底关不关」（`mask-closable`）。代价是三条关闭路径都得自己接：
<kbd>Esc</kbd>、点遮罩、×；

**焦点管理**（模态的全部意义所在）：打开时把焦点送进面板（首个可聚焦元素，没有就面板自己
`tabindex="-1"`）、<kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> 在面板内循环、关闭后焦点归还
**打开前的 `activeElement`**（一路钻进 shadow root —— 触发元素常在别的组件的 shadow 里）。

**焦点陷阱为什么不能用 `panel.querySelectorAll(...)`**：正文与底部是使用者写在插槽里的
**light DOM**，它们不在 shadow 树里，选择器一个都够不到；嵌套的 custom element（`mc-button`）
内部的原生按钮还在它的 shadow root 里。所以按**扁平树**收集：`<slot>` 换成
`assignedElements()`、有 shadow root 的元素换成它 shadow root 的子节点。

落地时踩出来的四条，改这个组件前逐条看：

1. **UA 给 `[popover]` 的 `width: fit-content` 会吃掉 `inset: 0`**：只写 `position: fixed; inset: 0`
   面板铺不满视口（实测 1280 的视口里盒子只有 280 宽）。必须显式补 `width: auto; height: auto`。
2. **作者样式压得过 UA 的 `[popover]:not(:popover-open){display:none}`**：把 `display` 写在浮层基类上
   （比如 `.mc-root { display: flex }`）会让**关着**的面板一直盖在页面上。所以基类写
   `display: none`、只在 `.mc-root:popover-open` 里展开。
3. **插槽内容不在 shadow 树里**：`panel.querySelectorAll()` 只看得到自己那个 ×，
   正文 / 底部里的按钮一个都数不到 —— 焦点陷阱必须走扁平树（见上）。
4. **「点在面板里还是遮罩上」必须走 `composedPath()`**：
   composed 事件冒泡到组件时 `e.target` 已被沿途 shadow 边界重定向成宿主，`contains(e.target)` 必然误判。

另外两条：`showPopover()` 对**还没连上文档**的元素会抛 `InvalidStateError`，所以
`ready()` 里只在 `isConnected` 时同步一次、`attached()` 再补一次；
`heading` 的空值判定要按属性值来 —— ofa 会把声明过的字符串属性以默认值（这里 `""`）写到宿主上，`:host([heading])` 这种写法对实例永远为真。

### 与草案的出入

| 草案                    | 实际            | 理由                                                                                                                             |
| ----------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `title`                 | `heading`       | 声明 `title` 会让宿主弹出浏览器原生 tooltip。`mc-alert` / `mc-collapse-item` 已是这个先例                                        |
| `open` + `default-open` | 只有单一 `open` | 两个属性必然漂移：谁是真相源没有第三处能裁决。`mc-collapse-item` 已经用「单一 `open` 属性 + 宿主 property 访问器」解决了同一件事 |

## 令牌

写在宿主 `style="…"` 上按实例覆盖：

| 令牌                        | 默认                        | 作用                                               |
| --------------------------- | --------------------------- | -------------------------------------------------- |
| `--mc-dialog-panel-width`   | `32rem`                     | 面板宽度（`size` 三档改的就是它）                  |
| `--mc-dialog-panel-bg`      | `--mc-color-surface-raised` | 面板底色                                           |
| `--mc-dialog-panel-border`  | `--mc-color-border-strong`  | 面板描边色（1px 实线）                             |
| `--mc-dialog-panel-radius`  | `--mc-radius-xl`            | 面板圆角                                           |
| `--mc-dialog-panel-pad`     | `--mc-space-6`              | 头部 / 正文 / 底部共用的内边距                     |
| `--mc-dialog-overlay-bg`    | `--mc-color-overlay`        | 遮罩色（三元组）                                   |
| `--mc-dialog-overlay-alpha` | `--mc-color-overlay-alpha`  | 遮罩不透明度                                       |
| `--mc-dialog-gap`           | `--mc-space-4`              | 头部行 / 底部行内的间距                            |
| `--mc-dialog-space`         | `--mc-space-6`              | 面板到视口边缘的最小距离（内容比视口高时靠它留白） |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

## 刻意不做的

- **不做进场 / 退场动画**：同 `mc-popover` —— 连续操作时动效拖慢手感，top layer 里能做出来的效果也有限。
  要动画的使用者自己挂 `::part(panel)` / `::part(overlay)`，或者用 `open` / `close` 事件驱动。
- **不做 `autofocus` 之类的属性**：焦点一律送给面板里第一个可聚焦元素，需要指定就自己在
  `open` 事件里 `focus()`。

## 相邻单元

- 形态与坑的源头是 [`mc-popover`](../popover/)：同一个 `popover` + top layer 结论，同一个
  [`scroll-pin`](../boot/scroll-pin.js) 滚动守卫（dialog 的开合同样会让浏览器顺手滚页面）。
- [`mc-tooltip`](../tooltip/) 是同一批浮层里的另一个：它**非模态**、锚在触发元素上，不抢焦点。
- [`mc-button`](../button/) 是文档页演示用到的兄弟组件（页面自己 `<l-m>` 注册）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
