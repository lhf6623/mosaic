# 组件单元总纲：共用约定 · 组件索引

`packages/` 下**一个组件 = 一个单元**：本体 `<slug>.html` + `api.md`（接口事实）+ `page.html`（文档页）

- `demos/`（例子）+ `test/`（冒烟套件）住在一起。**对外只有两个入口**：本体（使用者 CDN 引入）与
  `page.html`（文档站加载），其余是单元内部资产 —— 所以规范跟着单元走，不另建一处。

这份是全目录共用的：**① 接口共用约定**（五）· **② 有哪些单元**（六）· **③ 表单约定与实现出入**（七～八）。
**文档页怎么排（页面骨架 / 演示区 / 参考区 / 首页）已拆到 [`page-spec.md`](./page-spec.md)** ——
写或改 `page.html`、增删演示时读那份；逐组件接口住各自单元的 [`api.md`](./button/api.md)；
令牌体系住 [`color/README.md`](./color/README.md)。

> **读这份的场合**：接一个组件、查接口、改组件 API、写或改组件文档页（页面规范见
> [`page-spec.md`](./page-spec.md)）、加一个新组件页。

---

## 五、共用约定（属性 / 事件 / 插槽 / part / 键盘）

> 子节编号沿用原「组件 API 规范」的 **1.x** —— 外部有多处按 1.2 / 1.4 / 1.5 / 1.7 引用，别重编号。

这一节是硬约束 —— 所有组件的 API 都必须落在这个框架里，
不允许某个组件"因为情况特殊"另起一套。

### 1.1 引入方式

**按需引入，一个组件一条 `<l-m>`：**

```html
<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
```

标签名 = `mc-` + 目录名。同一个族的组件共用一个目录（目录名 = 主标签去掉 `mc-` 前缀）。

### 1.1.1 使用环境：普通 HTML 与 ofa 模板

同一颗组件在两种环境里消费；**模板指令只属于 ofa 模板，普通 HTML 里不要写**。

| 需求        | 普通 HTML                                  | ofa 模板（`<template page>` / `<template component>`） |
| ----------- | ------------------------------------------ | ------------------------------------------------------ |
| 静态标量    | 普通属性 `size="sm"`                       | 普通属性 `size="sm"`                                   |
| 动态标量    | `setAttribute` / JS property               | `:size="size"`                                         |
| 布尔        | 普通属性 / `setAttribute`                  | `attr:disabled="disabled"`（**不许** `:disabled`）     |
| 对象 / 数组 | `$('#id').options = [...]`（组件走 data）  | `data` + `:options="items"`（**不许** `attr:`）        |
| 事件        | `addEventListener` / `$().on()`            | `on:click="handler"`                                   |
| 列表 / 条件 | 手写 DOM 或组件 API                        | `o-fill` / `o-if`                                      |
| 子组件注册  | `<l-m>`（等 `customElements.whenDefined`） | `<l-m>` 放页面顶部，或 `await load()`                  |

- **普通 HTML** 没有模板编译：`{{}}` / `:prop` / `sync:` / `attr:` / `on:` / `o-fill` / `o-if` 都只是普通属性字符串，不会被 ofa 处理。对象 / 数组只能走 JS property（`$()`）或组件显式支持的 JSON 属性初始值；JSON 属性**只作初值**，运行时改值仍走 property。
- **ofa 模板**：标量进 `attrs` / 用 `:prop`；布尔用 `attr:`；对象 / 数组放 `data`、用 `:prop` 传。**对象不需要 `sync:`**（引用共享）。
- **组件作者**：标量进 `attrs`，对象 / 数组进 `data`；为普通 HTML 暴露同名 property（对象字段在 `data` 里时 `$('#id').options` 即可生效；要支持原生 `el.options` 再补 accessor）；JSON 属性兼容必须单独监听，且只作初值。
- **对象属性的文档位置**：不进「属性」表（那张表对账 `attrs`），在 `api.md` 的属性节用
  `| 对象属性 | 值 | 说明 |` 单独列表；页面照常渲染，但不参与 attrs 对账。

### 1.2 属性：五个正交维度

**不要把这些混成一维枚举。** 混了就没法组合（`variant="danger"` 之后
就没法再表达"我要描边样式的危险按钮"），而且 CSS 会退化成组合爆炸。

| 维度         | 属性                                                         | 取值                                                              | 默认      |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- | --------- |
| **语义色**   | `color`                                                      | `primary` / `info` / `success` / `warning` / `danger` / `neutral` | `primary` |
| **外观样式** | `variant`                                                    | 约定：`filled` / `outline` / `ghost`（部分组件另有 `subtle`）     | `filled`  |
| **尺寸**     | `size`                                                       | `sm` / `md` / `lg`                                                | `md`      |
| **形态**     | `inline`                                                     | 缺省 = 控件盒 / `inline` = 行内文字（盒子交给文字）               | 缺省      |
| **状态**     | `disabled` / `loading` / `readonly` / `invalid` / `selected` | 布尔，存在即真                                                    | 无        |

组件**只声明它真正支持的维度**（`mc-card` 没有 `color`，`mc-spinner` 没有 `variant`）。
**形态**目前只有 `mc-button` 声明（`inline`）：它跟 `variant` 分开，是因为文字按钮要动的是**盒子**
（那是 `size` 的地盘），塞进 `variant` 会让 `size` 在那一档只剩半个轴。
不支持的属性不要写进 `attrs` —— 写了就是承诺。

`variant` 的取值是**约定**而不是全局枚举：每个组件只声明自己实际支持的取值，
上表列出的是各组件通用的一套（`mc-menu` 用的是 `plain`（默认）/ `surface`）。

**实现方式**：`color` 只往组件自己的色槽（`--mc-<comp>-*`）里填值，`variant` 只决定这些槽
贴到 `background` / `color` / `border-color` 上，两者不直接相乘。槽的个数按需要定：
`mc-button` 用三个 —— `--mc-button-fill` / `--mc-button-on-fill` / `--mc-button-accent`，
因为中性色需要一个单独的强调色。规则数量级因此是「颜色数 + 外观数」，不是两者相乘。

**`color` 除语义名外还收 hex**（`color="#fff000"`，只收 `#fff000` / `#fc0` 这种写法）：
语义名照旧走 CSS（也只有它们随主题翻转），hex 走**共享接线器**
[`packages/boot/color-attr.js`](./boot/color-attr.js) —— 组件里 `attached()` +
`watch.color` 各一行，填的还是上面那些槽，所以 `variant` 的组合关系一个字没变；文字色按 WCAG 自动算。
已接：`button` / `tag` / `icon` / `alert` / `avatar`（五个声明了 `color` 的组件）。声明了 `color` 的组件漏接会被
新声明 `color` 的组件记得一起接上（原来由站点套件 11 拦，已随文档站套件删除）。

### 1.3 尺寸：只有三档

| `size`       | 控件高                     | 用途                                                                       |
| ------------ | -------------------------- | -------------------------------------------------------------------------- |
| `sm`         | `--mc-control-h-sm` (28px) | 密集界面（表格行内、工具条）。**低于 32px 触控下限，不要用在移动端主操作** |
| `md`（默认） | `--mc-control-h-md` (36px) | 常规                                                                       |
| `lg`         | `--mc-control-h-lg` (44px) | 移动端主操作、突出操作                                                     |

**没有 `xs` / `xl`。** 需要更极端的尺寸时用 `style="height: …"` 精确覆盖，
不要往组件里加尺寸档位 —— 三档之外的需求都是个案。

### 1.4 值的读写（最容易踩的地方）

**标签属性是"初始值"，DOM property 是"运行时状态"。** 这条规则对所有带值的组件生效。

```html
<!-- HTML 里设初始值：用 default-* -->
<mc-input default-value="张三"></mc-input>
<mc-dialog default-open></mc-dialog>
```

```js
// JS 里读写运行时状态：用 property
input.value = '李四'; // ✅
input.setAttribute('value', '李四'); // ❌ 无效
dialog.open = true; // ✅
```

**布尔属性推荐走 `setAttribute` / `removeAttribute`** —— 属性是 ofa 观察的通道
（少数直接改不触发更新的 property 例外）。

> ⚠️ **ofa 的布尔绑定会把 `false` 写成 `attr="false"`**（属性仍然存在）—— `:checked="expr"` /
> `sync:checked` / `:disabled="expr"` 都这样。视图组件里有两条应对，**两条都要做**：
>
> 1. **读**的时候别只看"属性在不在"：`const raw = this.ele.getAttribute(name); return raw !== null && raw !== 'false';`
>    （`mc-checkbox` / `mc-switch` 的 `boolAttr()` 就是这个）；
> 2. **规范化**属性，让 CSS 选择器（`:host([disabled])` / `:host([checked])` / `:host([required])`）判得准：
>    挂载后把 `="false"` 摘掉、其余非空值统一成空串（`normalizeBoolAttrs()`，各状态组件一份，
>    宿主属性必须在 `attached` 之后写 —— P31）。
>
> 这样"存在即真"在 JS 与 CSS 两侧同时成立，受控地绑成 `false` 时样式与行为都不会错。
> 组件**可以**为布尔属性提供一个立即同步的 property 访问器 —— `mc-collapse-item` 的 `open` 就是
> （`el.open = true` 写完立刻生效，不必等属性反射那一拍）。
>
> ⚠️ **`attrs` 的键不要撞 ofa 元素 API 的方法名**（如 `wrap` / `reverse`）：同名键在挂载时会把
> 方法函数写进属性（`mc-space` 因此把它们命名为 `wrap-items` / `reverse-order`）。新增属性前
> 先确认 ofa 的代理上没有同名方法。

> ⚠️ **`proto` / `data` 的键更严格**：撞上 `$.fn` 会报「注册参数有误，'proto' 上的 'x' 已被占用」
> —— `proto` 在 4.7.x 是 `console.warn`（表现为注册失败 / 行为不可靠），`data` 直接 throw。
> `root` / `text` / `data` / `style` / `next` / `parent` / `watch` 这些业务名都在表里
> （`mc-dialog` 的 `root`、`mc-table` 演示的 `next` 都踩过）。完整 54 个保留名清单见
> `ofajs-docs` 技能的「proto / data 禁止与内置保留名冲突」节。

```js
btn.setAttribute('disabled', '');
btn.removeAttribute('disabled');

item.open = true; // 组件提供了访问器时同样可以
```

**值的反射**：`value` / `checked` / `open` 等会反射到宿主元素的原生 DOM property，
所以 `e.target.value` 能读到值（这里的历史坑已由组件内部处理，使用者无感）。

**对象值：属性通道只收 JSON 文本，运行时走 property。** Web Components 的属性只能是字符串；
模板里的 `:attr="对象"` 是 ofa 的绑定实现，落点**不稳定**（首屏直出可能直接写 property，经路由导航会先
`JSON.stringify` 成属性文本）—— 不能当契约。组件的统一做法：

1. 属性 / 模板里**只写 JSON 文本**（声明式配置，如 `rules='…'`）；
2. 对象（尤其带函数）**运行时用 property 传** —— `form.rules` / `table.data` / `menu.options`；
3. 两条通道都收到时**以 property 为准**：`mc-table` / `mc-menu` 是 property 写过值后属性不再覆盖；
   `mc-form` 的规则允许混合（属性写声明式键、property 补 `validator`），范围相同的那份去重。

**对象数组换值按 key 复用**：`menu.options` 重新赋值时，mc-menu 按行 key 复用已有节点、只更新属性
（同 key 只换 `current` 时不会清空重建）。给对象数组换值时要保证 key 稳定：优先写 `key`，
否则同层 href / label 必须唯一；key 变了就会被当作新行拆除重建。

已按这条实现的单元：`mc-form` / `mc-table` / `mc-menu`。使用者视角的解释在
[`docs/pages/faq.html`](../docs/pages/faq.html) 的「对象数据为什么有时能绑、有时不能」。

### 1.5 事件

**不加 `mc-` 前缀**，用原生语义名，使用者不需要记两套命名。

| 名称     | 类型                                                                  | 说明                           |
| -------- | --------------------------------------------------------------------- | ------------------------------ |
| `change` | `(event: Event & { data: { value: string } }) => void`                | 值确定变化（失焦、选中、确认） |
| `input`  | `(event: Event & { data: { value: string } }) => void`                | 实时输入（每次按键）           |
| `open`   | `(event: Event) => void`                                              | 弹层打开                       |
| `close`  | `(event: Event) => void`                                              | 弹层关闭                       |
| `select` | `(event: Event & { data: { value: string; item: unknown } }) => void` | 选项被选中                     |
| `clear`  | `(event: Event) => void`                                              | 可清除输入被清空               |

```html
<mc-input on:change="value = $event.data.value"></mc-input>
```

**原生事件不重复定义、也不重复转发** —— 按规范 `composed: true` 的那些本来就会穿透 shadow、
落在宿主上：`click` / `pointerdown` / `focus` / `blur` / `focusin` / `focusout` / `keydown` /
`keyup` / `paste` / `copy` / `cut` / `compositionstart` / `compositionupdate` / `compositionend`…
使用者在宿主上直接 `on:focus` / `on:keydown` 就行，组件不必再发一遍（发了会收到两次）。

**只有三个要组件自己接管**（它们要么穿不出来、要么得带上值）：

| 原生事件 | 为什么                           | 组件怎么做                                                                 |
| -------- | -------------------------------- | -------------------------------------------------------------------------- |
| `input`  | 能穿出来，但不带值               | **拦掉原生那条**（`stopPropagation`），改发同名 + `data: { value }` 的事件 |
| `change` | `composed: false`，穿不出 shadow | 转成同名的 composed 事件，带 `data`（表单组件都这么做）                    |
| `scroll` | 不冒泡、也不 composed            | 在宿主上重发一次（`mc-scroll-bar`）；滚到哪儿读 `part="viewport"`          |

所以 `api.md` 的「事件」表**只列组件自己发的那些**（`change` / `input` / `open` / `close`…）；
原生事件不列 —— 列了就是第二份事实，还得跟浏览器对齐。

**组件作者怎么发**：定义顶部 `emits` 声明（与 `attrs` 对称），组件定义包一层 `withEmits(...)`，调用点只写 `this.$emit('name', payload)`：

```js
export default async () =>
  withEmits({
    tag: 'mc-input',

    emits: {
      input: { data: ['value'] }, // $event.data.value
      change: { data: ['value'] },
      clear: {}, // 无载荷
    },

    // …
    onInput() {
      this.$emit('input', { value: this._input.value }); // 不再手写 data / bubbles / composed
    },
  });
```

通道由声明决定：`data` 走 ofa `emit`，`detail` / `native` 走原生 `CustomEvent`；`cancelable` 只配后两者。
事件名必须是**字面量**（三元列全也行），未声明的事件名运行时直接抛错；`internal: true` 的内部事件不进 `api.md`。
守卫：`event-calls`（声明 ↔ `$emit`，禁止裸 `this.emit` / `new CustomEvent` / `dispatchEvent`）与
`event-doc`（通道 / 载荷键 ↔ 事件表的「类型」列）。

### 1.6 插槽命名

| 名字                    | 用途                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| （无 `name`）           | 主内容                                                                       |
| `prefix` / `suffix`     | 输入框的前后附加物；容器类组件的「头部行尾」也用 `suffix`（`mc-card`）       |
| `icon` / `icon-right`   | 按钮的图标槽：属性给内置图标名、槽放自定义图形；写了槽就顶掉属性（两侧对称） |
| `header` / `footer`     | 容器类组件的头尾                                                             |
| `title` / `description` | 有明确语义的标题与描述                                                       |

**用 `prefix` / `suffix`，不用 `leading` / `trailing`** —— 和 CSS 逻辑属性（`padding-inline-start`）对齐。
按钮的图标槽是例外：叫 `icon` / `icon-right`，和它的两个属性同名 —— 否则会出现「属性 `icon`、槽 `prefix`」两套叫法。

> 默认插槽在「被挂载」类组件里放的是**被挂载的元素**（`mc-tooltip` / `mc-popover` 的触发元素、`mc-badge` 的容器），不是主内容 —— 这类组件的默认插槽没有别的用途。

### 1.7 `part` 命名

只在**内部有结构性子元素**且使用者确实需要定制时才暴露 `part`。
视觉在 `:host` 上的组件（如 `mc-button`）不需要 —— 外部 `style="…"` 已经够用。

通用词汇：`base` / `panel` / `overlay` / `header` / `body` / `footer` / `label` / `input` / `error`。
已开出的额外名字必须登记在这里：`list`（`mc-menu` / `mc-breadcrumb` / `mc-pagination`）、
`item` / `prev` / `next` / `jumper` / `sizer` / `select`（`mc-pagination`）、
`pre` / `code` / `line`（`mc-code` / `mc-divider`）、`image` / `description`（`mc-empty`）、
`day` / `cell`（`mc-date-picker`：日 / 周一格与月 / 年一格）。

### 1.8 键盘基线（每个组件都要满足）

**不做读屏支持**：组件里没有 `role` / `aria-*` / live region / 文字替代；
只保证键盘操作（页面层的补充见 [`docs/README.md`](../docs/README.md) §八）：

- 可交互元素必须是**原生元素**（`<button>` / `<input>` / `<a>` / `<details>`），不是 `<div on:click>`；
  自定义交互补等价键：Enter / Space 激活，Esc 关闭，方向键在菜单 / 列表 / 标签页内移动。
- 键盘可完成全部操作，顺序与视觉一致；焦点环用 `--mc-color-ring`（不用 `currentColor`），
  且只在键盘态出现（`:focus-visible`）—— 不拿掉 `outline` 了事。
- 无键盘陷阱：不可达内容用 `inert` / `display: none` 移出 Tab 序列，不能只靠 `opacity: 0`；
  预设了内容形态的浮层（`mc-dialog` / `mc-dropdown`）负责「打开时焦点进弹层、关闭后归还触发点」，
  通用容器 `mc-popover` 只走原生 light-dismiss（Esc 交给浏览器）。
- 不吞键：只在确实需要时 `preventDefault`，别拦 `Tab` / `Esc` / 浏览器组合键；不做全局单键快捷键。
- 状态一律用 `data-*`（`data-current` / `data-selected` / `data-disabled` / `data-expanded`），
  `aria-*` 与 `role` 一个都不写

### 1.9 小结：什么算「操作 DOM」，布尔属性怎么判

两条口径，改代码前先过一遍 —— 它们决定了「这行 JS 该不该存在」。

**① 节点操作本身是允许的，判据是「场景」，不是「碰没碰 DOM」。** 可见结构只有一个渲染源 = 模板；
只有模板表达不了的才进脚本（测量 / 滚动 / 焦点 / 插槽内容判定 / 表单转发 / 写宿主 CSS 变量 /
第三方库自己的挂载点——如 `mc-code-editor` 把 CodeMirror 挂进 shadow root），
而且必须走 ofa 的 API：

| 要干的事           | 用这个                                    | 不用这个                                |
| ------------------ | ----------------------------------------- | --------------------------------------- |
| shadow 里取引用    | `this.shadow.$('.x')`                     | `getElementById` / `querySelector`      |
| 订阅 / 退订        | 模板写不了时才用 `.on(…)` / `.off(…)`     | `addEventListener`                      |
| 原生属性、原生方法 | `.ele.scrollTop` / `.ele.assignedNodes()` | 直接在 ofa 包装对象上取                 |
| 宿主上的布尔属性   | `setAttribute` / `removeAttribute`        | 拼 class 名 / 用 `style.display` 当显隐 |

> 站点页与站点组件同一条口径，见 [`docs/README.md`](../docs/README.md) §十「ofa 写法」里的
> 「DOM 访问」一条。所以「组件的脚本里出现了 `.ele` / `.on` / `shadow.$`」不是问题，
> **模板能写的却用脚本写**才是。

**订阅的判据（表格第 2 行那条限定）：默认写模板。** 元素本来就在模板里、事件名固定 →
`on:click="fn($event)"`，一行搞定，也不用管退订。只有这三种才进脚本用 `.on()` / `.off()`：

| 情况            | 例子                                                            | 为什么模板不行                                                     |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| 多槽循环        | `alert` / `input` / `textarea` 要遍历若干个 slot                | 模板写不出「对所有 slot 各挂一次」                                 |
| 事件委托        | `message` / `pagination` 在 `o-fill` 容器上挂一个监听           | 项是运行时生成的，逐个绑要往 `$host` 上绕（`pagination` 里有注释） |
| 订阅 + 退订成对 | 8 个插槽判定组件的 `slotchange`（`avatar` / `form` / `icon` …） | 可模板化，但全仓同一手法，`attached` 订阅 / `detached` 退订成对写  |

> ⚠️ 第 3 种是**一致性上的选择，不是技术上写不出来** —— 新写的地方若只有一个 slot、也
> 不需要按引用退订，模板 `on:slotchange` 同样成立；跟着相邻单元走就行，别混着来。

**② 布尔属性看「在不在」，不看值 —— `!== null` 就是正解。** 原生布尔属性本来就只看存在性：
`<input disabled="false">` 浏览器照样禁用。所以组件不必比浏览器更宽容，也不必替写错的绑定兜底：

| 写法                             | 落到宿主                     | 结果         |
| -------------------------------- | ---------------------------- | ------------ |
| 普通 HTML `<mc-button disabled>` | `disabled=""`                | 禁用 ✅      |
| ofa 模板 `attr:disabled="cond"`  | 真 → 属性在；假 → 属性被摘掉 | 正确 ✅      |
| ofa 模板 `:disabled="cond"` ❌   | 假也写成 `disabled="false"`  | **永远禁用** |
| JS `el.disabled = false`         | 属性被摘掉                   | 正常 ✅      |

`disabled="false"` 只可能来自 `:prop` 绑定（`attr:` 遇到 `false` 是摘属性），那是绑定层的错；
使用者侧的写法说明在 [`docs/pages/faq.html`](../docs/pages/faq.html) 的「按钮点不动、开关关不掉」。

> ⚠️ **边界**：§1.4 那两条（`boolAttr()` 值感知、`normalizeBoolAttrs()` 规范化）服务的是**值控件**的
> `sync:value` / `sync:checked` 受控通道 —— 值控件的常态就是被绑成 `false`。动作类组件（`mc-button`）
> 不套，别把两条口径混成一条。

---

## 六、组件索引

逐一列出全部单元：标签、目录、状态。**标签名 = `mc-` + 目录名**；
改了组件 API 先改该单元的 `api.md`，再改文档页。

| 组件                                  | 标签                                   | 目录           | 状态      |
| ------------------------------------- | -------------------------------------- | -------------- | --------- |
| [Button](./button/api.md)             | `mc-button`                            | `button/`      | ✅ 已实现 |
| [Code](./code/api.md)                 | `mc-code`                              | `code/`        | ✅ 已实现 |
| [Collapse](./collapse/api.md)         | `mc-collapse` / `mc-collapse-item`     | `collapse/`    | ✅ 已实现 |
| [Menu](./menu/api.md)                 | `mc-menu` / `mc-menu-item`             | `menu/`        | ✅ 已实现 |
| [Breadcrumb](./breadcrumb/api.md)     | `mc-breadcrumb` / `mc-breadcrumb-item` | `breadcrumb/`  | ✅ 已实现 |
| [Icon](./icon/api.md)                 | `mc-icon`                              | `icon/`        | ✅ 已实现 |
| [Card](./card/api.md)                 | `mc-card`                              | `card/`        | ✅ 已实现 |
| [Tag](./tag/api.md)                   | `mc-tag`                               | `tag/`         | ✅ 已实现 |
| [Badge](./badge/api.md)               | `mc-badge`                             | `badge/`       | ✅ 已实现 |
| [Avatar](./avatar/api.md)             | `mc-avatar`                            | `avatar/`      | ✅ 已实现 |
| [Spinner](./spinner/api.md)           | `mc-spinner`                           | `spinner/`     | ✅ 已实现 |
| [Skeleton](./skeleton/api.md)         | `mc-skeleton`                          | `skeleton/`    | ✅ 已实现 |
| [Empty](./empty/api.md)               | `mc-empty`                             | `empty/`       | ✅ 已实现 |
| [Input](./input/api.md)               | `mc-input`                             | `input/`       | ✅ 已实现 |
| [Textarea](./textarea/api.md)         | `mc-textarea`                          | `textarea/`    | ✅ 已实现 |
| [Code Editor](./code-editor/api.md)   | `mc-code-editor`                       | `code-editor/` | ✅ 已实现 |
| [Checkbox](./checkbox/api.md)         | `mc-checkbox`                          | `checkbox/`    | ✅ 已实现 |
| [Radio](./radio/api.md)               | `mc-radio` / `mc-radio-group`          | `radio/`       | ✅ 已实现 |
| [Switch](./switch/api.md)             | `mc-switch`                            | `switch/`      | ✅ 已实现 |
| [Slider](./slider/api.md)             | `mc-slider`                            | `slider/`      | ✅ 已实现 |
| [Rate](./rate/api.md)                 | `mc-rate`                              | `rate/`        | ✅ 已实现 |
| [Tree Select](./tree-select/api.md)   | `mc-tree-select`                       | `tree-select/` | ✅ 已实现 |
| [Select](./select/api.md)             | `mc-select` / `mc-option`              | `select/`      | ✅ 已实现 |
| [Date Picker](./date-picker/api.md)   | `mc-date-picker`                       | `date-picker/` | ✅ 已实现 |
| [Form](./form/api.md)                 | `mc-form` / `mc-form-item`             | `form/`        | ✅ 已实现 |
| [Alert](./alert/api.md)               | `mc-alert`                             | `alert/`       | ✅ 已实现 |
| [Progress](./progress/api.md)         | `mc-progress`                          | `progress/`    | ✅ 已实现 |
| [Message](./message/api.md)（命令式） | `message()`                            | `message/`     | ✅ 已实现 |
| [Loading Bar](./loading-bar/api.md)   | `mc-loading-bar`                       | `loading-bar/` | ✅ 已实现 |
| [Scroll Bar](./scroll-bar/api.md)     | `mc-scroll-bar`                        | `scroll-bar/`  | ✅ 已实现 |
| [Popover](./popover/api.md)           | `mc-popover`                           | `popover/`     | ✅ 已实现 |
| [Dialog](./dialog/api.md)             | `mc-dialog`                            | `dialog/`      | ✅ 已实现 |
| [Dropdown](./dropdown/api.md)         | `mc-dropdown` / `mc-menu-item`         | `dropdown/`    | ✅ 已实现 |
| [Tooltip](./tooltip/api.md)           | `mc-tooltip`                           | `tooltip/`     | ✅ 已实现 |
| [Tabs](./tabs/api.md)                 | `mc-tabs` / `mc-tab`                   | `tabs/`        | ✅ 已实现 |
| [Table](./table/api.md)               | `mc-table`                             | `table/`       | ✅ 已实现 |
| [Grid](./grid/api.md)                 | `mc-grid` / `mc-grid-item`             | `grid/`        | ✅ 已实现 |
| [Space](./space/api.md)               | `mc-space`                             | `space/`       | ✅ 已实现 |
| [Divider](./divider/api.md)           | `mc-divider`                           | `divider/`     | ✅ 已实现 |
| [Pagination](./pagination/api.md)     | `mc-pagination`                        | `pagination/`  | ✅ 已实现 |
| [QR Code](./qrcode/api.md)            | `mc-qrcode`                            | `qrcode/`      | ✅ 已实现 |

---

## 七、表单控件共用约定

> 所有单元都已实现。接口事实的唯一手写源是各单元的 `packages/<slug>/api.md` —— 这里只留两样东西：
> ① 表单控件的**跨组件共用约定**（本节）② 实现相对草案的**出入清单**（第八节，对账用、含理由）。
> 共用约定见上面第五节；浮层结论见 [`popover/api.md`](./popover/api.md)。

| 名称              | 说明                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | 表单字段名                                                                                                                                    |
| `default-value`   | HTML 初始值（attribute，只在挂载时读一次）                                                                                                    |
| `default-checked` | 开关类的 HTML 初始值（同上，只在挂载时读一次）；`checked` 则是受控 / 运行时状态                                                               |
| `value`           | 运行时值（宿主 DOM property）；同名一组里是「本项的身份值」；被 ofa 的 `:value` / `sync:value` 绑定时它就是**绑定通道**（读、写、回写都走它） |
| `checked-value`   | 开关类专用：写了它才启用自定义值（勾上 / 开着时给的值）                                                                                       |
| `unchecked-value` | 开关类专用：没勾 / 关着时给的值（配 `checked-value` 用）                                                                                      |
| `disabled`        | 状态布尔：禁用                                                                                                                                |
| `readonly`        | 状态布尔：只读                                                                                                                                |
| `required`        | 状态布尔：必填                                                                                                                                |
| `invalid`         | 状态布尔：校验失败                                                                                                                            |
| `size`            | `sm` `md` `lg`                                                                                                                                |
| `placeholder`     | 占位符                                                                                                                                        |

| 名称             | 类型                                                   | 说明                                          |
| ---------------- | ------------------------------------------------------ | --------------------------------------------- |
| `input`          | `(event: Event & { data: { value: string } }) => void` | 每次输入，载荷 `{ value }`                    |
| `change`         | `(event: Event & { data: { value: string } }) => void` | 值确定变化（组件已转发为 composed）           |
| `clear`          | `(event: Event) => void`                               | 可清除输入被清空（input / textarea / select） |
| `focus` / `blur` | `(event: Event) => void`                               | 原生事件，已穿透                              |

两条实现要点（在 `mc-input` 里定型，其它表单单元照抄）：

1. **初始值不能读 ofa 数据**：`ready()` 那一刻 attrs 还没铺进 `this`，要读
   `this.ele.getAttribute('default-value')`；`ready()` + `attached()` 各接一次、记账保证只生效一次。
2. **原生 `input` 先 `stopPropagation()` 再转发**：它是 composed，不拦的话宿主上会先到一条**没有 `data`**
   的原生事件，使用者按文档写 `$event.data.value` 会先抛一次；`change` 穿不出 shadow，只由组件转发。
3. **转发给内部原生元素用 `attr:`**（`disabled` 除外）：实测 `:placeholder` / `:rows`（textarea）与
   `:maxlength` / `:readonly` 不生效（IDL 名是 `maxLength` / `readOnly`）。

**校验态不用独立的错误色板**，用 `invalid` 布尔 + `--mc-color-danger`。

编排这十个控件（含 `mc-slider` / `mc-rate` / `mc-tree-select` / `mc-date-picker`）的容器是 [`mc-form`](./form/api.md)：`required` / `pattern` 写在控件上或
`mc-form-item` 上都认，失败时容器给控件挂 `invalid`、给行显示文案。

---

## 八、实现与草案的出入（对账用）

| 单元                        | 出入与理由                                                                                                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mc-progress`               | 不套表单那套 `default-value` / `value` 约定：进度条不接受输入、不参与提交、没有 `change`，它的属性就是**当前**进度（同 `mc-collapse-item` 的 `open`）；`value` / `max` 另给宿主 property 访问器。                                                                 |
| `mc-input` / `mc-textarea`  | 转发内部原生元素用 `attr:` 而不是 `:prop`（见上）；原生 `input` 转发前先 `stopPropagation()`。                                                                                                                                                                    |
| `mc-checkbox` / `mc-switch` | `checked` 是**受控 / 运行时状态**（唯一的 observed 布尔），`default-checked` 只作**非受控初值**：挂载时读一次就把 `checked` 落成宿主属性，之后**不再参与**（所以不存在"两个属性漂移"——漂移的前提是两个都持续观察，`mc-collapse-item` 那个先例说的正是持续观察）。 |
| `mc-radio`                  | 原生「同 name 成组」跨 shadow 不成立，所以唯一真相是子项宿主上的 `checked`、由组维护；`mc-radio` 的 `checked` 是镜像 property，不进 api.md 属性表。                                                                                                               |
| `mc-slider`                 | `value` property 是 **number**（其余表单控件给 string）；写值与初值按原生 range 的 step 归一，`mc-form` 收集时转字符串；键盘 / 拖拽来自原生 range，视觉自绘并开放 4 个 part。                                                                                     |
| `mc-rate`                   | `value` property 同样是 **number**（0 = 未评分）；指针按星星的真实几何换算（原生 range 只做键盘 / 焦点，pointer-events: none），`mc-form` 收集时转字符串；半星是实心层裁 50%。                                                                                    |
| `mc-select`                 | `name` 不做原生 formAssociated（没有表单提交语义），只当字段名与内部 aria id 前缀；`multiple` 时 property 是 `string[]`、`default-value` 是逗号分隔字符串。                                                                                                       |
| `mc-tree-select`            | 树数据用 property 传对象数组（属性只作 JSON 初始值）；第一版只做单选，多选 / 搜索 / `show-path` 留到下一版；禁用父级仍可展开、但整支不可选；`value` 是 string。                                                                                                   |
