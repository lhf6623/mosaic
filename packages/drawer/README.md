# mc-drawer（抽屉）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 事件 / 插槽 / part）的唯一手写源是
> [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，并放**不进文档页**的东西
> （令牌 / 实现约束 / 刻意不做）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-drawer` · 目录 `packages/drawer/`

侧滑抽屉。遮罩、焦点陷阱、Esc 关闭。

## 单元里有什么

| 文件          | 角色                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `drawer.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`   | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`      | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`      | 9 个演示（页面用可编辑示例区，**同一份文件**）                                |
| `test/`       | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**浮层形态照抄 [`mc-dialog`](../dialog/README.md)，只换面板落点。** 整块（遮罩 + 面板）是一个
`popover="manual"` 元素，进 top layer；不挂 `document.body`、不用 `z-index` 令牌。
与 dialog 共用同一个 [`scroll-pin`](../boot/scroll-pin.js) 滚动守卫（打开时锁页面滚动）。

**为什么是另一个组件而不是 dialog 的 `placement` 属性**：两者的**内容形态**不同 —— dialog 是
「短、要求用户立刻决策」的居中框，drawer 是「长、可滚动、可带子表 / 多段」的贴边容器；
尺寸三档、圆角、贴边方向、进场动画全都不同。如果合成一个组件，属性组合会变成
「居中但不居中、贴边但窄」这类无效态，校验成本比多一个单元高。

**进场动画只在打开时做**：`popover` 关闭是同步 `hidePopover()`，做退场动画要自己接管
`beforetoggle` / `toggle` 并在动画结束后再关 —— 会把「`open` 属性 = 真相源」这条约定弄脏。
所以 v0 只有 `transform: translateX` 进场（`--mc-duration-base`），退场瞬隐；
`prefers-reduced-motion` 下动画关闭。

**焦点管理**（模态的全部意义）：打开时把焦点送进面板（首个可聚焦元素，没有就面板自己
`tabindex="-1"`）、<kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> 在面板内循环、关闭后焦点归还
**打开前的 `activeElement`**。焦点陷阱按扁平树收元素（插槽内容在 light DOM、嵌套组件在 shadow root 里）。

落地时踩出来、改这个组件前逐条看：

1. **UA 给 `[popover]` 的 `width: fit-content` 会吃掉 `inset: 0`**：必须显式补
   `width: auto; height: auto`，否则遮罩铺不满视口。
2. **作者样式压得过 UA 的 `[popover]:not(:popover-open){display:none}`**：基类写 `display: none`、
   只在 `:popover-open` 里展开，否则关着的面板会一直盖在页面上。
3. **插槽内容不在 shadow 树里**：焦点陷阱不能 `panel.querySelectorAll()`，必须走扁平树。
4. **「点在面板里还是遮罩上」必须走 `composedPath()`**：composed 事件冒泡到组件时
   `e.target` 已被重定向成宿主，`contains(e.target)` 必然误判。

另外：`showPopover()` 对**还没连上文档**的元素会抛 `InvalidStateError`，所以 `ready()` 里只在
`isConnected` 时同步一次、`attached()` 再补一次。

### 与草案的出入

| 草案                    | 实际            | 理由                                                                                                 |
| ----------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `title`                 | `heading`       | 声明 `title` 会让宿主弹出浏览器原生 tooltip；`mc-dialog` / `mc-alert` 已是这个先例                   |
| `open` + `default-open` | 只有单一 `open` | 两个属性必然漂移；`mc-dialog` / `mc-collapse-item` 已用「单一 `open` + property 访问器」解决同一件事 |

## 令牌

写在宿主 `style="…"` 上按实例覆盖：

| 令牌                        | 默认                        | 作用                                           |
| --------------------------- | --------------------------- | ---------------------------------------------- |
| `--mc-drawer-panel-width`   | `26rem`                     | 面板宽度（`size` 三档改的就是它）              |
| `--mc-drawer-panel-bg`      | `--mc-color-surface-raised` | 面板底色                                       |
| `--mc-drawer-panel-border`  | `--mc-color-border-strong`  | 面板描边 / 头尾分隔线颜色                      |
| `--mc-drawer-panel-pad`     | `--mc-space-6`              | 头部 / 正文 / 底部共用的内边距                 |
| `--mc-drawer-overlay-bg`    | `--mc-color-overlay`        | 遮罩色（三元组）                               |
| `--mc-drawer-overlay-alpha` | `--mc-color-overlay-alpha`  | 遮罩不透明度                                   |
| `--mc-drawer-gap`           | `--mc-space-4`              | 头部行 / 底部行内的间距                        |
| `--mc-drawer-space`         | `--mc-space-6`              | 预留（面板贴视口边时为 0，保留给未来留白场景） |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

## 刻意不做

- **不做退场动画**：见上；要动画的使用者自己挂 `::part(panel)` / `::part(overlay)`，或用
  `open` / `close` 事件驱动。
- **不做 `resizable` / 拖拽调宽**：v0 尺寸只有三档；真实需求出现前不加。
- **不做多级 push 抽屉栈**：需要嵌套抽屉就放多个 `mc-drawer`（各自独立 popover 栈，浏览器 top layer
  会自动按打开顺序叠）。这是「两个抽屉」不是「一个抽屉的二级页」——后者语义不同，等真需求。

## 相邻单元

- 形态与坑的源头是 [`mc-dialog`](../dialog/)：同一个 `popover` + top layer 结论、同一个滚动守卫。
- [`mc-tooltip`](../tooltip/) / [`mc-popover`](../popover/) 是**非模态**浮层：锚在触发元素上、不抢焦点。
- [`mc-button`](../button/) 是文档页演示用到的兄弟组件（页面自己 `<l-m>` 注册）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定与组件索引：[`packages/README.md`](../README.md)
- 文档页 / 演示区规范：[`packages/page-spec.md`](../page-spec.md)
