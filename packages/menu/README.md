# mc-menu（菜单）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-menu` · 目录 `packages/menu/`

垂直菜单。**推荐用法只有一种**：给 `options` 一个对象数组，容器递归渲染出整棵树（分组、图标、
层级缩进、二级菜单），不用写菜单项标签。`mc-menu-item` 的属性（内置 `<a>`）与插槽（自备控件）
是内部 / 兼容通道 —— 只在要 `olink` 或插槽里放别的东西时才手写，不推荐当常规用法。

## 单元里有什么

| 文件             | 角色                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `menu.html`      | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `menu-item.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`      | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`         | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`         | 11 个演示（页面上的活样例与 `<mc-code src>` 引用**同一个文件**）              |
| `test/`          | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### `menu.html`

mc-menu — 数据驱动的垂直菜单容器

**一棵树、一个渲染器**：`options` 是唯一渲染源，`createNodes()` 递归把一条数据变成
「行（`mc-menu-item`）+ 子菜单（嵌套 `mc-menu`）」。行仍然落在容器的 **light DOM** 里，不造进自己的
shadow root：自备控件（使用者的 `<mc-menu-item>`）与数据驱动共用同一种节点，文档站的
左栏 / 右栏也直接在 `doc-nav` 的 shadow 树里查 / 委托这些 `<a>`（查 shadow root 穿不进另一个
shadow root，见 `tests/lib/harness.mjs` 的 `__inside`）。

容器交给菜单项的只有**属性**：`label` / `icon` / `href` / `current` / `disabled`，父级行再加一个内部的
`data-expandable`；控件（`<a>` / `<button>`）、箭头、状态镜像都在 `mc-menu-item` 里（见下一节）。
容器因此不再拼 `<a>`、不写内联样式、也不碰箭头。

**层级缩进是算出来的，不进数据**：`createNodes(option, level)` 往下递归时 `level + 1`，把
`--mc-item-level` 内联写在每一行上；菜单项按
`calc(pad-x + level × indent-step)` 消费。使用者只写 `children`，不写 `level`。
缩进量与基础内边距都走容器通道（`--mc-menu-indent-step` / `--mc-menu-pad-x`），所以整棵树一起改。
**分组子项走另一档**：带 `children` 的 group，组内条目在行上写 `--mc-item-step: var(--mc-menu-group-indent, …)`
（默认 `--mc-space-3` = 12px）—— 侧栏的「分组名 + 一列子项」通常比 collapsible 的逐级缩进浅，
两者分开调，互不牵连（`--mc-menu-group-indent` 默认 12px，所以 doc-nav 不用再做任何覆盖）。
⚠️ **浮层里的每一级把 level 归零**：第二、三级是各自独立的一列，层级已经由「弹出来」表达了，
再叠一档缩进只会在行左边白留一块（没有 `icon` 的行尤其明显）。

**容器通道要往下复制**：嵌套的 `mc-menu` 也是本组件，它 `:host` 上的同名令牌默认值会盖掉从外层
继承来的值（使用者在**根**上写的 `style="--mc-menu-pad-x: …"` 就是继承来的那一路）——
所以建嵌套实例时把解析后的通道复制成它的内联样式（`copyChannel()`，见代码里的 `CHANNEL`）。
`size` 在运行时改了，会重新给所有子菜单下发一份（`watch.size`）。

**开合分两条路**：

- **普通态**：子菜单挂在行后面，`hidden` 开合；开合状态是行上的 `data-expanded`，箭头方向由
  `mc-menu-item` 看它自己切。`accordion` 时先收起同层的其它分支（口径同 `mc-collapse`：只认直接子级，
  嵌套层各管各的，`accordion` 会继承给子菜单）。
- **压缩态 / 浮层里**（`collapsed`，或本实例带内部的 `data-flyout`）：子菜单不再内联展开，而是装进一个
  `.mc-flyout` —— 它是原生 `popover="manual"`（进 top layer，不被祖先的 `overflow` 裁掉），
  装的是嵌套的 `mc-menu`（展开态，显示文字）。**鼠标移入行**（`pointerenter`）或**键盘聚焦**
  （`focusin`）弹层，移出时给 120ms 宽限（指针从行移到浮层要跨一条缝；浮层上的 `pointerenter`
  取消关闭），点外部 / `Esc` 关。弹层打开时锚点行挂 `data-open`（指针已经在浮层里，行不再 `:hover`），
  `mc-menu-item` 按它给「这条分支开着」的悬停观感；关闭时连**浮层里的每一级**一起收，
  免得外层关了、内层还挂在 top layer 变成孤儿面板。

**浮层的定位交给 CSS 锚点**：行上内联唯一 `anchor-name`（`--mc-item-anchor-<实例>-<序号>`，
同名锚会互相顶掉，所以不能共用），浮层内联 `position-anchor` 指回它；`top: anchor(top)` +
`position-try-fallbacks` 自动翻转 —— 不写一行定位 JS，滚动 / 翻转都由浏览器管。
⚠️ 面板外观（定位 + 底色 + 边框 + 圆角 + 投影）**整体内联写在元素上**（脚本里的 `FLYOUT_STYLE`），
不走 `::slotted(.mc-flyout)`：浮层在祖先 shadow 树里，UA 的 `[popover]` 默认样式
（`background: Canvas` / `inset: 0; margin: auto`）与祖先 shadow 的 reset 都可能压过本 shadow 的
`::slotted()`，实测会导致「第二、三级浮层像换了暗色主题」——值仍然是 `--mc-menu-flyout-*` 令牌。
锚与浮层都在同一个 light tree 里，跨 shadow 的锚是不成立的
（见 [`../dropdown/README.md`](../dropdown/README.md) 第 2 条），这也是没有把浮层做成
`mc-menu` 宿主 popover 的原因：`:host{display:block}` 会压过 UA 的 `[popover]` 隐藏规则。
每个浮层各接一份 [`../boot/scroll-pin.js`](../boot/scroll-pin.js) 的滚动守卫（`attachFloatingScrollGuard`）：
开合原生 popover 时浏览器可能顺手把页面滚一下（火狐实测），显式 `showPopover()` / `hidePopover()`
那两行包成 `guard.run(() => …)`，重建 / 卸载时 `dispose()`。

**`options`（数据驱动）**：进 `attrs`（默认 null），于是属性通道收 JSON 字符串；运行时用宿主
property 传数组 —— 和 `mc-table` 的 `columns` 同一条路：property 走 `Object.defineProperty`，
挂载前赋的值先收进 `_presetOptions`（P31：构造期不往宿主写属性），解析结果落在 `data.items`，
**不写回 attrs 键**（写回会被 ofa 再序列化一次，P6）。

字段：`label` / `icon` / `href`（最终地址）/ `current` / `disabled` / `attrs`（附加到行上的属性：
`target` / `rel` / `title` 由菜单项转给内置 `<a>`，其余（如 `data-status`）留在行上给宿主钩子），
分组用 `type: 'group'`，子菜单用 `children`（同形状的数组，递归）。数据里不存 `#/…`、也不存部署前缀。

`children` 有两种落法：**普通行**带 `children` → 父级是开合开关、子菜单折叠；**分组行**
（`type: 'group'`）带 `children` → 标题不可交互、组内条目**常显**并缩进一档（`doc-nav` 的左栏
就是这个形状：分组名 + 一列页面）。两种都不写 `level`，层级由容器算。

### `menu-item.html`

mc-menu-item — 菜单项（配合 mc-menu 使用）

**行有两条路，都是内部 / 兼容通道**（`options` 才是推荐入口；本单元自己的文档页与
`mc-dropdown` 走下面第二条）：

- **内置行**（`mc-menu` 渲染每一行时走的就是它）：给 `label`（+ `href`）就够了，菜单项自己造
  `<a>`；带内部 `data-expandable` 的行造 `<button>`，行尾再插一枚箭头（方向看 `data-expanded`）。
  内置 `<a>` 是**运行时**造的，拿不到 `olink` 的部署前缀 —— `href` 必须是最终地址。
- **自备控件**（插槽里有元素时优先）：使用者在插槽里放原生 `<a>` / `<button>`，它承载全部语义与
  交互：href、键盘、焦点环、`data-current`、`disabled` / `data-disabled` 都由使用者写，组件只读
  它、不改它。`olink` 只能走这条路（编译期指令，只作用于模板里的元素，
  见 [`docs/routes.js`](../../docs/routes.js)）。

两条路共用同一套行盒子：内置控件也**追加在宿主自己的 light DOM 里**，于是它和自备控件一样被
`<slot>` 投进来、吃同一份 `::slotted()` 样式，不存在第二套外观。

⚠️ 行的视觉全在**宿主**上，控件只当铺满整行的交互层（正常流 + `width/height: 100%`）。
原因是一条实测出来的层叠规则：控件同时是**祖先 shadow 树**里的普通元素，而每一层
shadow root 里都有一份 shadow-base.css（组件的由自己的 `<link>` 带进来、文档站的由
[`docs/adopt-styles.js`](../../docs/adopt-styles.js) 注入）—— 那里面对 button 的
`padding: 0 / background: none / cursor: pointer` 是「直接命中」，优先级压过本组件 shadow root 里的
`::slotted(button)`（封装上下文排在层叠顺序前面）。所以底色 / 颜色一律写在宿主上、缩进走宿主继承的
`text-indent`，控件只负责铺满整行：

· 左侧缩进 → 宿主 `text-indent`（继承属性，能穿 shadow 边界；控件上显式写一遍压住 UA）
· 层级缩进 → 上面的值里再加 `level × --mc-menu-indent-step`（`--mc-item-level` 是容器按行内联写的实例数据）
· 右侧留白 → 宿主 `padding-inline-end`（控件铺的是内容盒，宽度写成 `calc(100% + pad-x)`
把这一层也铺上，整行才是可点区；它同时计入固有宽度 —— 面板按内容自适应时才左右对称）
· 垂直居中 → 宿主 `line-height` = 行高
· 底色 → 宿主 `:host(:hover)` / `:host([data-current])`

⚠️ 控件**不能绝对定位**（原来是 `position:absolute; inset:0`）：绝对定位不参与固有宽度
计算，宿主外面那个容器（`mc-dropdown` 的面板）就永远量不到标签有多宽 —— 面板宽度没法跟着
内容走。改成正常流之后，宿主**左侧**不能有内边距（会和 `text-indent` 叠成双份缩进），
**右侧**那层则要保留、并让控件的宽度补上它（见上）。

⚠️ 父级行（`<button>`）是唯一的例外：它在 flex 里放「文字 + 箭头」，`text-indent` 不生效，
缩进与图标让位改走内联的 `padding-inline-start`（`menu-item.html` 的 `applyControlIndent()`）。

状态 → 宿主上的 `data-current` / `data-disabled` 只有一个出口（`applyState()`）：内置行读宿主自己的
`current` / `disabled`，自备控件读使用者元素上的 `data-current` / `disabled`。镜像到宿主是因为
宿主没法用 `:has()` 看孩子（ofa 的样式作用域不支持 `:host()` 里嵌函数式伪类）。

### 图标与压缩态

`icon` 住在 `mc-menu-item` 上（数据里是 `icon` 字段）。图标是独立组件 `mc-icon`，所以本组件注册前先
`await load('./menu-item.html')`，菜单项再 `await load('../icon/icon.html')`（同 `mc-alert`）——
换来的是图标名语法与 `mc-icon` 完全一致（内置零请求、查不到才远程取一次）。

图标在 shadow 里绝对定位在行首 + `pointer-events: none`，**不占点击区**：交互层仍然铺满整行的
`<a>` / `<button>`，点图标命中的是它。有 `icon` 时文字缩进要多让出「图标宽 + 间距」，
所以图标与文字都按同一份 `基础内边距 + level × 步长` 起算。

`collapsed` 住在容器上，但**样式必须落在菜单项自己的 shadow 里** —— 容器的选择器够不到另一个
shadow root 的子项（和尺寸通道同一条边界）。做法是沿用 `data-current` 那条路：菜单项
`closest('mc-menu')` 拿到最近的容器、MutationObserver 盯 `collapsed`，镜像成宿主上的
`data-collapsed`，CSS 选它。压缩态下：
· 叶子行：控件文字用 `color: transparent` 隐去而不是 `display: none` —— 交互层还得铺满整行、还得能点；
· 父级行（`<button>`）：它的缩进与「文字 + 箭头」是**内联**写的，CSS 的 `::slotted` 压不过内联，
所以只能由脚本在压缩态把内联缩进归零、把文字与箭头 `display: none`（否则 36px 的方块会被内联
padding 顶成 57px、箭头还会露在右边）；
· 分组标题整行 `display: none`（它没有图标，留着就是一条空行）。
**压缩态的切换会整棵重建**（`watch.collapsed`）：子菜单的宿主从「行后面的嵌套菜单」变成
「popover 浮层里的嵌套菜单」，结构本身不同，不是切个 class 能覆盖的。

## 令牌

| 令牌                           | 默认                          | 作用                    |
| ------------------------------ | ----------------------------- | ----------------------- |
| `--mc-menu-item-h`             | `--mc-control-h-md`           | 项高（`size` 改它）     |
| `--mc-menu-pad-x`              | `--mc-space-4`                | 左右内边距 / 第一级缩进 |
| `--mc-menu-font`               | `--mc-text-sm`                | 字号                    |
| `--mc-menu-gap`                | `--mc-space-1`                | 项间距                  |
| `--mc-menu-radius`             | `--mc-radius-md`              | 行圆角                  |
| `--mc-menu-collapsed-w`        | `--mc-menu-item-h`            | 压缩态宽度（方形）      |
| `--mc-menu-icon-size`          | `1.25em`                      | 图标字号                |
| `--mc-menu-icon-gap`           | `--mc-space-2`                | 图标与文字间距          |
| `--mc-menu-indent-step`        | `--mc-space-4`                | 每深一级的缩进量        |
| `--mc-menu-group-indent`       | `--mc-space-3`                | 分组子项的缩进（一档）  |
| `--mc-menu-flyout-gap`         | `--mc-space-2`                | 浮层到行的距离          |
| `--mc-menu-flyout-pad`         | `--mc-space-2`                | 浮层内边距              |
| `--mc-menu-flyout-bg`          | `--mc-color-surface-raised`   | 浮层底色                |
| `--mc-menu-flyout-border`      | `--mc-color-border-strong`    | 浮层轮廓色              |
| `--mc-menu-flyout-radius`      | `--mc-radius-lg`              | 浮层圆角                |
| `--mc-menu-flyout-shadow`      | `0 4px 12px rgb(0 0 0 / .16)` | 浮层投影                |
| `--mc-menu-flyout-min-w`       | `8rem`                        | 浮层最小宽度            |
| `--mc-menu-item-color`         | `--mc-color-fg-muted`         | 普通项文字              |
| `--mc-menu-item-color-hover`   | `--mc-color-fg`               | 悬停文字                |
| `--mc-menu-item-color-current` | `--mc-color-primary`          | 当前项文字              |
| `--mc-menu-item-bg-hover`      | `--mc-color-surface-sunken`   | 悬停底色                |
| `--mc-menu-item-bg-current`    | `--mc-color-primary-subtle`   | 当前项底色              |
| `--mc-menu-group-color`        | `--mc-color-fg-subtle`        | 分组标题文字            |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。

> ⚠️ 菜单项同样**不能**给 `--mc-menu-*` 写默认值，否则会盖掉容器继承来的通道
> （和 `mc-collapse-item` 同一条坑），消费侧一律 `var(--mc-menu-x, 兜底)`。
> 容器自己也只在**根**实例上写默认值吗？不 —— 每个实例都写，嵌套实例靠 `copyChannel()` 拿外层那份。

## 为什么不发事件

> 页面上**没有**这一节：菜单不 emit 任何事件 —— 点击就是插槽里那个原生 `<a>` / `<button>`
> 的原生点击，组件不转发、也不改使用者的 DOM；手风琴与浮层是容器自己的行为，没有对外载荷。
> 这一行留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- 与 [`mc-breadcrumb`](../breadcrumb/) 同一条理由：**交互元素由使用者写在插槽里**，组件不造链接、也不改使用者的 DOM；状态（当前项 / 禁用）写在使用者的元素上，组件只按属性给外观。
- `mc-dropdown` 复用 `mc-menu-item` 当面板里那些行，所以菜单项的 API（`group` / `icon` / 宿主钩子）不能随手改。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
