# Mosaic 组件 API 规范

> [`components.md`](./components.md) 讲**怎么造**组件（分层、骨架、检查清单）。
> 本文讲**有哪些**组件、各自的 API 长什么样。
> 设计规则见 [`design-spec.md`](./design-spec.md)，令牌值见 [`design-tokens.md`](./design-tokens.md)。

---

## 一、全部组件共用的约定

这一节是硬约束 —— 所有组件的 API 都必须落在这个框架里，
不允许某个组件"因为情况特殊"另起一套。

### 1.1 引入方式

**按需引入，一个组件一条 `<l-m>`：**

```html
<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
```

标签名 = `mc-` + 目录名。同族组件共用一个目录（`packages/button/` 下还有 `icon-button.html`）。

### 1.2 属性：四个正交维度

**不要把这些混成一维枚举。** 混了就没法组合（`variant="danger"` 之后
就没法再表达"我要描边样式的危险按钮"），而且 CSS 会退化成组合爆炸。

| 维度 | 属性 | 取值 | 默认 |
|---|---|---|---|
| **语义色** | `color` | `primary` / `info` / `success` / `warning` / `danger` / `neutral` | `primary` |
| **外观样式** | `variant` | `filled` / `outline` / `ghost`（部分组件另有 `subtle`） | `filled` |
| **尺寸** | `size` | `sm` / `md` / `lg` | `md` |
| **状态** | `disabled` / `loading` / `readonly` / `invalid` / `selected` | 布尔，存在即真 | 无 |

组件**只声明它真正支持的维度**（`mc-card` 没有 `color`，`mc-spinner` 没有 `variant`）。
不支持的属性不要写进 `attrs` —— 写了就是承诺。

**实现方式**：`color` 只往 `--mc-<comp>-color` / `--mc-<comp>-on-color` 两个色槽里填值，
`variant` 只管把这两个槽贴到 `background` / `color` / `border-color` 上。
于是 6 种颜色 + 3 种外观 = **9 条 CSS 规则**，而不是 18 条组合规则。

### 1.3 尺寸：只有三档

| `size` | 控件高 | 用途 |
|---|---|---|
| `sm` | `--mc-control-h-sm` (28px) | 密集界面（表格行内、工具条）。**低于 32px 触控下限，不要用在移动端主操作** |
| `md`（默认） | `--mc-control-h-md` (36px) | 常规 |
| `lg` | `--mc-control-h-lg` (44px) | 移动端主操作、突出操作 |

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
input.value = "李四";      // ✅
input.setAttribute("value", "李四");   // ❌ 无效
dialog.open = true;        // ✅
```

**布尔属性的 JS 修改必须走 `setAttribute` / `removeAttribute`**（直接改 property 不触发更新，[P3](./ofa-pitfalls.md)）：

```js
btn.setAttribute("disabled", "");
btn.removeAttribute("disabled");
```

**值的反射**：`value` / `checked` / `open` 等会反射到宿主元素的原生 DOM property，
所以 `e.target.value` 能读到值（[P18](./ofa-pitfalls.md) 的坑已由组件内部处理，使用者无感）。

### 1.5 事件

**不加 `mc-` 前缀**，用原生语义名，使用者不需要记两套命名。

| 事件 | 触发 | `$event.data` |
|---|---|---|
| `change` | 值确定变化（失焦、选中、确认） | `{ value }` |
| `input` | 实时输入（每次按键） | `{ value }` |
| `open` / `close` | 弹层打开 / 关闭 | — |
| `select` | 选项被选中 | `{ value, item }` |
| `clear` | 可清除输入被清空 | — |

```html
<mc-input on:change="value = $event.data.value"></mc-input>
```

**点击类交互不定义自定义事件** —— 原生 `click` 自带 `composed: true`，会穿透 shadow 边界冒泡。

### 1.6 插槽命名

| 名字 | 用途 |
|---|---|
| （无 `name`） | 主内容 |
| `prefix` / `suffix` | 输入框、按钮内部的前后附加物 |
| `header` / `footer` | 容器类组件的头尾 |
| `title` / `description` | 有明确语义的标题与描述 |

**用 `prefix` / `suffix`，不用 `leading` / `trailing`** —— 和 CSS 逻辑属性（`padding-inline-start`）对齐。

### 1.7 `part` 命名

只在**内部有结构性子元素**且使用者确实需要定制时才暴露 `part`。
视觉在 `:host` 上的组件（如 `mc-button`）不需要 —— 外部 `style="…"` 已经够用。

固定词汇表：`base` / `panel` / `overlay` / `header` / `body` / `footer` / `label` / `input` / `error`。

### 1.8 无障碍基线（每个组件都要满足）

- 可交互元素必须是**原生元素**（`<button>` / `<input>` / `<a>`），不是 `<div on:click>`
- 键盘可完成全部操作；弹层必须支持 `Esc` 关闭、打开时焦点进弹层、关闭后焦点归还
- 焦点环用 `--mc-color-ring`，不用 `currentColor`
- 图标按钮必须有 `aria-label`；装饰性 SVG 加 `aria-hidden="true"`
- 详见 [`design-spec.md` 第八节](./design-spec.md#八无障碍)

---

## 二、组件索引

| 组件 | 标签 | 目录 | 里程碑 | 状态 |
|---|---|---|---|---|
| Button | `mc-button` | `button/` | M1 | ✅ 已实现 |
| Icon | `mc-icon` | `icon/` | M1 | 待建 |
| Card | `mc-card` | `card/` | M1 | 待建 |
| Badge | `mc-badge` | `badge/` | M1 | 待建 |
| Spinner | `mc-spinner` | `spinner/` | M1 | 待建 |
| Input | `mc-input` | `input/` | M2 | 待建 |
| Textarea | `mc-textarea` | `textarea/` | M2 | 待建 |
| Checkbox | `mc-checkbox` | `checkbox/` | M2 | 待建 |
| Radio | `mc-radio` / `mc-radio-group` | `radio/` | M2 | 待建 |
| Switch | `mc-switch` | `switch/` | M2 | 待建 |
| Select | `mc-select` / `mc-option` | `select/` | M2 | 待建 |
| Alert | `mc-alert` | `alert/` | M2 | 待建 |
| Progress | `mc-progress` | `progress/` | M2 | 待建 |
| Toast（命令式） | — | `toast/` | M2 | 待建 |
| Dialog | `mc-dialog` | `dialog/` | M3 | 待建 |
| Dropdown | `mc-dropdown` / `mc-menu-item` | `dropdown/` | M3 | 待建 |
| Tooltip | `mc-tooltip` | `tooltip/` | M3 | 待建 |
| Tabs | `mc-tabs` / `mc-tab` | `tabs/` | M3 | 待建 |
| Table | `mc-table` | `table/` | M3 | 待建 |
| Grid | `mc-grid` / `mc-grid-item` | `grid/` | M3 | 待建 |

---

## 三、M1 组件

### mc-button

`packages/button/button.html` · **已实现**

| 属性 | 值 | 默认 | 说明 |
|---|---|---|---|
| `color` | `primary` `info` `success` `warning` `danger` `neutral` | `primary` | 语义色 |
| `variant` | `filled` `outline` `ghost` | `filled` | 外观样式 |
| `size` | `sm` `md` `lg` | `md` | 尺寸 |
| `type` | `button` `submit` `reset` | `button` | 转发给内部原生 button |
| `disabled` | 布尔 | — | 禁用 |
| `loading` | 布尔 | — | 加载中，显示 spinner 且不可点 |
| `block` | 布尔 | — | 撑满父容器宽度 |

| 插槽 | 说明 |
|---|---|
| （默认） | 按钮文案 |
| `prefix` / `suffix` | 前置/后置图标 |

| 事件 | 说明 |
|---|---|
| `click` | 原生事件，直接 `on:click` 监听，无自定义事件 |

**定制**：视觉全部在 `:host` 上，直接写原生 CSS 即可。

```html
<mc-button color="danger" variant="outline" size="sm">删除</mc-button>
<mc-button color="success" loading>正在保存…</mc-button>
<mc-button block style="height: 48px; border-radius: 9999px">圆角大按钮</mc-button>
<mc-button><span slot="prefix">🔍</span>搜索</mc-button>
```

---

### mc-icon

`packages/icon/icon.html` · M1

**图标方案：内联 SVG sprite，不用 `@unocss/preset-icons`。**
理由：preset-icons 把每个图标转成 data-URI 的 CSS，**gzip 后每个仍占 120–440 B**，
200 个图标就是 25–80 KB 纯 CSS，而且无法 tree-shake。
sprite 方案下一个图标约 200 B，且能按需加载。

| 属性 | 值 | 默认 | 说明 |
|---|---|---|---|
| `name` | 图标名 | — | 必填，对应 sprite 里的 symbol id |
| `size` | `sm` `md` `lg` | `md` | 映射到 `1em` / `1.25em` / `1.5em`，随 `font-size` 缩放 |
| `color` | 同 button | `current` | `current` 表示继承文字色 |
| `label` | 字符串 | — | 有值时视为有语义图标，设 `aria-label`；无值时加 `aria-hidden="true"` |

| 插槽 | 说明 |
|---|---|
| （默认） | 覆盖 `name`，直接放内联 SVG |

```html
<mc-icon name="search"></mc-icon>
<mc-icon name="trash" label="删除" color="danger"></mc-icon>
```

---

### mc-card

`packages/card/card.html` · M1

| 属性 | 值 | 默认 | 说明 |
|---|---|---|---|
| `variant` | `surface` `outline` | `surface` | 有底色 / 只有描边 |
| `padding` | `none` `sm` `md` `lg` | `md` | 内边距，映射 `--mc-space-3/4/6` |
| `interactive` | 布尔 | — | 可点击，加 hover 抬升与焦点环 |

| 插槽 | 说明 |
|---|---|
| （默认） | 主体内容 |
| `header` / `footer` | 头尾，会自动加分隔线 |

| part | 说明 |
|---|---|
| `base` `header` `body` `footer` | |

```html
<mc-card variant="outline">
  <span slot="header">项目设置</span>
  主体内容
  <div slot="footer"><mc-button size="sm">保存</mc-button></div>
</mc-card>
```

---

### mc-badge

`packages/badge/badge.html` · M1

| 属性 | 值 | 默认 | 说明 |
|---|---|---|---|
| `color` | 同 button（无 `neutral`） | `primary` | 语义色 |
| `variant` | `solid` `subtle` `outline` | `subtle` | 徽标默认用浅底，比 solid 更不抢视线 |
| `size` | `sm` `md` | `md` | 徽标只有两档 |
| `dot` | 布尔 | — | 只显示一个圆点，不显示内容 |
| `max` | 数字 | — | 数值超过时显示 `max+` |

```html
<mc-badge>新</mc-badge>
<mc-badge color="danger" variant="solid" :max="99">{{count}}</mc-badge>
<mc-badge dot color="success"></mc-badge>
```

---

### mc-spinner

`packages/spinner/spinner.html` · M1

| 属性 | 值 | 默认 | 说明 |
|---|---|---|---|
| `size` | `sm` `md` `lg` | `md` | 1em / 1.5em / 2em，随 `font-size` 缩放 |
| `color` | `current` 或语义色 | `current` | 默认继承文字色 |
| `label` | 字符串 | `加载中` | 屏幕阅读器文案 |

```html
<mc-spinner></mc-spinner>
<mc-spinner size="lg" color="primary" label="正在同步"></mc-spinner>
```

---

## 四、M2 组件（接口已定，实现待做）

> 这一批会大量撞上 [`ofa-pitfalls.md`](./ofa-pitfalls.md) 的 P6 / P18 / P19 / P20
> （值的反射、`change` 事件穿透、点击外部判定）。开工前先把那四条读一遍。

### 表单控件共用约定

| 属性 | 说明 |
|---|---|
| `name` | 表单字段名 |
| `value` / `default-value` | 运行时值 / HTML 初始值 |
| `disabled` `readonly` `required` `invalid` | 状态布尔 |
| `size` | `sm` `md` `lg` |
| `placeholder` | 占位符 |

| 事件 | 说明 |
|---|---|
| `input` | 每次输入，`$event.data.value` |
| `change` | 值确定变化（**组件内部已把原生 `change` 转发为 `composed: true`**，见 [P19](./ofa-pitfalls.md)） |
| `focus` / `blur` | 原生事件，已穿透 |

**校验态不用独立的错误色板**，用 `invalid` 布尔 + `--mc-color-danger`。

### 各组件要点

| 组件 | 关键属性 | 关键插槽 / part |
|---|---|---|
| `mc-input` | `type` `clearable` `maxlength` `prefix`/`suffix` 文本 | `prefix` `suffix` 插槽；`input` part |
| `mc-textarea` | 同 input + `rows` `auto-resize` `maxlength` + 字数统计 | 同 input |
| `mc-checkbox` | `checked` / `default-checked` `indeterminate` `value` | 默认插槽为标签文案 |
| `mc-radio` + `mc-radio-group` | group 上用 `value` `default-value` `name` `direction`；radio 上用 `value` `disabled` | 默认插槽为标签文案 |
| `mc-switch` | `checked` / `default-checked` `disabled` `size` | — |
| `mc-select` + `mc-option` | select 上 `value` `multiple` `placeholder` `clearable`；option 上 `value` `disabled` | `option` part；弹层 `panel` part |
| `mc-alert` | `color` `variant` `title` `closable` `icon` | `title` `description` 插槽 |
| `mc-progress` | `value` `max` `indeterminate` `color` `size` | `bar` part；`aria-valuenow` 齐全 |
| `toast()` | 命令式函数，返回 `{ close }`，对齐原生语义 | `toast(msg, { color, duration, position })` |

`mc-select` 是 M2 里最复杂的一个：它要处理浮层定位、点击外部关闭（**必须用 `composedPath()`**，
[P20](./ofa-pitfalls.md)）、键盘导航、以及消费 `o-fill` 渲染出来的 option
（[P12](./ofa-pitfalls.md)）。建议留出充足的实现时间。

---

## 五、M3 组件（接口草案）

> ⚠️ **M3 开工前必须先验证图层问题**：shadow DOM 里的 `position: fixed` + `z-index`
> 与宿主页面层叠上下文的关系。宿主页面上的 `transform` / `filter` / `contain`
> 会创建新的层叠上下文，可能把 shadow root 内的浮层困住。
> 验证后再决定是继续用 `position: fixed`，还是改用 popover API，还是挂载到 `document.body`。
> 详见 [`design-spec.md` 第七节](./design-spec.md#七层级)。

| 组件 | 关键属性 | 关键插槽 | 关键 part |
|---|---|---|---|
| `mc-dialog` | `open` / `default-open` `title` `closable` `mask-closable` `size` | `header` `footer`（默认为主体） | `overlay` `panel` `header` `body` `footer` |
| `mc-dropdown` + `mc-menu-item` | dropdown 上 `open` `placement` `trigger`；item 上 `value` `disabled` `danger` | `trigger` 插槽 | `panel` |
| `mc-tooltip` | `content` `placement` `trigger` `delay` | 默认插槽为触发元素 | `panel` |
| `mc-tabs` + `mc-tab` | tabs 上 `value` `default-value`；tab 上 `value` `disabled` | tab 的默认插槽为标签文案 | `list` `panel` `indicator` |
| `mc-table` | `columns` `data`（JSON property，见 [P6](./ofa-pitfalls.md)）`striped` `hoverable` `loading` `empty-text` | `empty` `loading` | `table` `row` `cell` |
| `mc-grid` + `mc-grid-item` | grid 上 `cols` `gap` `min-item-width`；item 上 `span` | — | — |

`mc-table` 的 `columns` / `data` 是**对象**，必须通过 property 传，
不能写成标签属性（会被 JSON 序列化，[P6](./ofa-pitfalls.md)）：

```html
<mc-table id="t"></mc-table>
<script type="module">
  document.querySelector("#t").columns = [{ key: "name", title: "姓名" }];
  document.querySelector("#t").data = [{ name: "张三" }];
</script>
```
