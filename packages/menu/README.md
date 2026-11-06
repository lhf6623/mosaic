# mc-menu（菜单）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-menu` · 目录 `packages/menu/`

数据驱动的垂直菜单：给 options 传对象数组，分组 / 图标 / 层级缩进 / 二级菜单都由容器渲染；可压缩成图标栏（子菜单浮层弹出），也可以开手风琴。

## 单元里有什么

| 文件             | 角色                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `menu.html`      | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `menu-item.html` | 同族子标签，随本体一起引入                                                    |
| `page.html`      | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`         | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`         | 13 个演示（页面用可编辑示例读**同一份文件**）                                 |
| `test/`          | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

### `menu.html`

mc-menu — 数据驱动的垂直菜单容器

**一棵树、一个渲染器**：`options` 是唯一渲染源，`buildRows()` 递归把一条数据摊成行模型，
模板里的 `<o-fill fill-key="key">` 渲染出 `mc-menu-item`（行）与嵌套 `mc-menu`（父级子菜单）。
生成的行住在 `mc-menu` 自己的 **shadow root** 里；`mc-menu-item` 的内容全部由属性给，
组件**不提供插槽**。`doc-nav` 因此从 `mc-menu` 的 shadowRoot 查当前行。

**更新按 key 复用，不整棵重建**：`o-fill` 按 `fill-key` 复用节点；只换当前项 / 展开状态时只更新属性，
新 key 才建节点、旧 key 才拆。行模型的 key 就是 `options` 里写的 `key`（不再拼前缀、不再推导身份）；
doc-nav 同一分区切页时 47 行原地复用。

**`key` 必填，没有兼容兜底**：`buildRows()` 只认数据里的 `key`，缺 / 重复直接抛错 ——
不推导、不加序号、不 warn。这样 `o-fill` 的 `fill-key`、`keepOpen` 的展开态、`current` 的命中、
以及将来所有按行定位的功能都只有一套依据。`current` 也只认 key，嵌套子菜单直接收同一个 key
自己命中，不用再换算 label 路径。

**`meta` 是给使用者的数据通道**：任意值，组件不解释、不写进 DOM，只原样放进 row 模型，
由容器以 property 挂到行上，`navigate` 事件的 `detail.meta` 再原样带回。路由节点、权限、
埋点字段都放这里；`attrs` 只留给真正的 HTML 属性（`target` / `rel` / `title` / `style`）。
文档站左栏就用 `key` 在 `navigate` 里拦「点当前页」，不必在外壳挂捕获阶段的兜底。

容器交给菜单项的只有**属性**：`label` / `icon` / `href` / `current` / `disabled`，父级行再加一个内部的
`data-expandable`；控件（`<a>` / `<button>`）、箭头、状态镜像都在 `mc-menu-item` 里（见下一节）。
容器因此不再拼 `<a>`、不写内联样式、也不碰箭头。

**层级缩进是算出来的，不进数据**：`buildRows()` 往下递归时 `level + 1`，由 `syncMeta()` 把
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
⚠️ 面板外观（定位 + 底色 + 边框 + 圆角 + 投影）写在 `mc-menu` 的 `.mc-flyout` 类规则里：
面板现在由模板生成在 `mc-menu` 自己的 shadow root 内，普通类规则直接压过 UA 的 `[popover]`
默认样式（旧实现把它放在 light DOM，才需要内联写）。值仍然是 `--mc-menu-flyout-*` 令牌。
锚与浮层都在同一个 light tree 里，跨 shadow 的锚是不成立的
（见 [`../dropdown/README.md`](../dropdown/README.md) 第 2 条），这也是没有把浮层做成
`mc-menu` 宿主 popover 的原因：`:host{display:block}` 会压过 UA 的 `[popover]` 隐藏规则。
每个浮层各接一份 [`../boot/scroll-pin.js`](../boot/scroll-pin.js) 的滚动守卫（`attachFloatingScrollGuard`）：
开合原生 popover 时浏览器可能顺手把页面滚一下（火狐实测），显式 `showPopover()` / `hidePopover()`
那两行包成 `guard.run(() => …)`，重建 / 卸载时 `dispose()`。

**`options`（数据驱动）**：对象数组，**声明进 `attrs`**（和 `mc-pagination` 的 `blocks` 同一套接线）——
只走 JS property（`menu.options = [...]`）与 ofa 模板的 `:options` 绑定两条通道，都汇到 `applyOptions()`
→ `data.optionList`（渲染源），**绝不写回 attrs 声明的键**，否则会被 ofa 再序列化成属性文本。
JSON 属性通道与那个专属 MutationObserver 已删掉。property 通过 `Object.defineProperty` 暴露，
挂载前赋的值先收进 `_presetOptions`（P31：构造期不往宿主写属性）。
⚠️ 声明进 `attrs` 是为了让 `api.md` 的「属性」表能对账 —— 那份表原来挂在 `| 对象属性 |` 下面，
不参与 attrs 对账，等于给接口事实开了个口子（全仓只有本单元这么写，已收掉）。

字段：**`key`（必填，整棵树唯一、值恒定）** / `label` / `icon` / `href` / `disabled` / `attrs`
（HTML 属性：`target` / `rel` / `title` 转给内置 `<a>`，`style` 留在行上）/ **`meta`（业务数据）**，
分组用 `type: 'group'`，子菜单用 `children`（同形状的数组，递归，子项同样要写 `key`）。

**href 照普通链接的写法写**（相对**应用根**的路径、绝对路径、完整 URL 都行），数据里不存 `#/…` 这种
地址栏形态 —— 那是运行时的渲染结果，不是数据。跳转方式由菜单项按环境决定（`resolveLink()`）：
ofa 应用内（composedPath 上找得到 `o-app`）渲染成 **olink 形态**（href 改写成地址栏的 hash 形态 +
`origin-href` 记原地址 + `olink` 属性），点击由 ofa 挂在每个组件 shadow root 上的代理处理器接管
（preventDefault + `app.goto`，与手写 olink 完全同一条路）；普通 HTML 里 href 原样输出，浏览器原生跳转。
页内锚点（`#` 开头）与跨域链接永远原生。点击派发可取消的 `navigate` 事件
（`event.detail = { href, resolved, key, meta }`），宿主 preventDefault 即接管；没有 `href` 的行
也发这个事件，可当按钮用（文档站的主题切换 / 右栏目录就是这么接的）。

`children` 有两种落法：**普通行**带 `children` → 父级是开合开关、子菜单折叠；**分组行**
（`type: 'group'`）带 `children` → 标题不可交互、组内条目**常显**并缩进一档（`doc-nav` 的左栏
就是这个形状：分组名 + 一列页面）。两种都不写 `level`，层级由容器算。模板里的嵌套 `mc-menu` 直接用
`:options="$data.children"`：对象数组走绑定通道，不会被 ofa 序列化成属性文本。

**当前项 / 默认展开都是属性，不是数据** —— 它们是「外部世界现在在哪」的状态：

- `current="…"`：值就是**命中行的 key**。`resolveCurrent()` 递归找到那个 key，记下它祖先 parent
  的 key 集合；行的 `current` 用 `key === target.key` 判，`currentBranch` 用 `target.parents.has(key)` 判，
  所以命中的那一支自动展开、且**只会亮一行**。对不上就是没有当前项。
- **换当前项只「补开」命中的那一支**：`buildRows(items, { keepOpen })` 在只换 `current`
  （或重新赋同 key 的 `options`）时按 key 把上一份展开态带过来；收人只有手动点父级行与 `accordion`。
- `expanded`：每个父级行开场就展开（整棵摊开）。
- 下发给嵌套实例（`syncChannels()`）：因为 key 整棵树唯一，**current 原样下发**，子实例拿自己的
  `children` 自己命中，不再换算相对 label 路径；`expanded` 也一并下发。
- `current` 的变更走 `_modeMo`（`attributeFilter` 里带它），只换当前项时**不**收浮层、也不重算展开。
- `accordion` 下同层只留一个：`current` 那一支优先；压缩态浮层归 hover / focus 管。

### `menu-item.html`

mc-menu-item — 菜单项（配合 mc-menu 使用）

**只有一条路**：行内容全部由宿主属性给，`mc-menu-item` 在自己的 shadow root 里造控件 ——
有 `label` 且不是 `group` 时造 `<a>`（带内部 `data-expandable` 造父级 `<button>` + 箭头），
`group` 行渲染纯文字。图标、状态镜像、链接属性（`target` / `rel` / `title`）都从宿主属性读。
独立使用（dropdown / popover 的面板行）也是同一套，只是 `key` 从行上的 `key` 属性读，
`navigate` 事件的 `detail.key` 带出去。

内置 `<a>` 的导航不用自己实现：ofa 给每个组件的 shadow root 挂了 olink 代理点击处理器
（`initLink`），渲染时补 `olink` + `origin-href`，点击就走进 `app.goto()`（见 `resolveLink()`）。

⚠️ 行的视觉全在**宿主**上，控件只当铺满整行的交互层（正常流 + `width/height: 100%`）。
控件在同一个 shadow root 里，类规则能直接压住 UA 的 button 默认样式，只有一套样式。
底色 / 颜色一律写在宿主上，控件只负责铺满整行：

· 左侧缩进 → 宿主 `text-indent`（继承属性，能穿 shadow 边界；控件上显式写一遍压住 UA）
· 层级缩进 → 上面的值里再加 `level × --mc-menu-indent-step`（`--mc-item-level` 是容器按行内联写的实例数据）
· 右侧留白 → 宿主 `padding-inline-end`（控件用 `width: max-content` 让行宽跟着标签走，
`min-width: calc(100% + pad-x)` 再铺满固定宽度的菜单并把这层留白一起铺上）
· 垂直居中 → 宿主 `line-height` = 行高
· 底色 → 宿主 `:host(:hover)` / `:host([data-current])`

⚠️ 控件**不能绝对定位**（原来是 `position:absolute; inset:0`）：绝对定位不参与固有宽度
计算，宿主外面那个容器（`mc-dropdown` 的面板）就永远量不到标签有多宽 —— 面板宽度没法跟着
内容走。改成正常流之后，宿主**左侧**不能有内边距（会和 `text-indent` 叠成双份缩进），
**右侧**那层则要保留、并让控件的宽度补上它（见上）。

⚠️ 父级行（`<button>`）是唯一的例外：它在 flex 里放「文字 + 箭头」，`text-indent` 对布局不生效，
缩进与图标让位改走两条 CSS（`menu-item.html` 的 `.mc-control--parent`）：`padding-inline-start`
（含图标宽 + 间距）负责让位，`text-indent` 则必须**显式归零**。后者不是保险 —— `text-indent` 是继承属性，
「有图标时文字让开」那条（`:host([icon]) .mc-control`）优先级更高，会把让位量写到按钮上再被行里的
`.mc-control-label` 继承一份，于是「图标 + 文字 + 箭头」三者齐全时文字被推两次（曾踩过）。

状态 → 宿主上的 `data-current` / `data-disabled` 只有一个出口（`applyState()`）：读宿主自己的
`current` / `disabled` 镜像过去。镜像到宿主是因为宿主没法用 `:has()` 看 shadow 里的孩子
（ofa 的样式作用域不支持 `:host()` 里嵌函数式伪类）。

### 图标与压缩态

`icon` 住在 `mc-menu-item` 上（数据里是 `icon` 字段）。图标是独立组件 `mc-icon`，所以本组件注册前先
`await load('./menu-item.html')`，菜单项再 `await load('../icon/icon.html')`（同 `mc-alert`）——
换来的是图标名语法与 `mc-icon` 完全一致（内置零请求、查不到才远程取一次）。

图标在 shadow 里绝对定位在行首 + `pointer-events: none`，**不占点击区**：交互层仍然铺满整行的
`<a>` / `<button>`，点图标命中的是它。有 `icon` 时文字缩进要多让出「图标宽 + 间距」，
所以图标与文字都按同一份 `基础内边距 + level × 步长` 起算。

`collapsed` 住在容器上，但**样式必须落在菜单项自己的 shadow 里** —— 容器的选择器够不到另一个
shadow root 的子项（和尺寸通道同一条边界）。做法是沿用 `data-current` 那条路：菜单项
`closest('mc-menu')`（数据驱动的行在容器 shadow 里时回退到根宿主）拿到最近的容器、
MutationObserver 盯 `collapsed`，镜像成宿主上的 `data-collapsed`，CSS 选它。压缩态下：
· 叶子行：控件文字用 `color: transparent` 隐去而不是 `display: none` —— 交互层还得铺满整行、还得能点；
· 父级行（`<button>`）：文字 / 箭头都在模板里，压缩态由 `:host([data-collapsed])` 的 CSS 收掉，
不再写内联样式；缩进也由同一套 CSS 归零；
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

## 为什么只有一个事件

> 页面上**没有**这一节：菜单对外只 emit `navigate` 一个事件 —— 点击内置行时派发，载荷
> `{ href, resolved }`，可取消（宿主 `preventDefault()` 就掐掉跳转）。手风琴与浮层是容器自己的行为，
> 没有对外载荷；行内容全部由属性给，组件不再接受 light DOM 里的自备控件。
> 这一行留给对账与改代码的人 —— 不渲染（README 不进页面）。

## 相邻单元

- 与 [`mc-breadcrumb`](../breadcrumb/) 的关系：面包屑的交互元素仍由使用者写在插槽里；
  `mc-menu` 这一侧已经统一成属性式行 + `options` 数据驱动，两边不再共用「自备控件状态」那套口径。
- `mc-dropdown` / `mc-popover` 复用 `mc-menu-item` 当面板行：它们写 `label` / `href` / `key` 属性，
  点击统一收 `navigate` 事件，不再往行里塞原生 `<a>` / `<button>`。
- `mc-dropdown` 复用 `mc-menu-item` 当面板里那些行，所以菜单项的 API（`group` / `icon` / 宿主钩子）不能随手改。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定与组件索引：[`packages/README.md`](../README.md)
- 文档页 / 演示区规范：[`packages/page-spec.md`](../page-spec.md)
