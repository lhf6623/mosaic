# 组件 API 规范

**唯一真相源**：有哪些组件、各自什么接口。四个正交维度、值读写规则、属性 / 事件 /
插槽与 part、逐组件 API 都在这里。改了组件 API 先改这份，再改文档页。

| 模块                                                                                                               | 内容                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 本文件                                                                                                             | ① 全部组件共用的约定 ② 组件索引 ③ 各组件详细文件的入口 |
| `button.md` `code.md` `icon.md` `card.md` `tag.md` `badge.md` `spinner.md` `collapse.md` `menu.md` `breadcrumb.md` | M1 逐组件：属性 / 事件 / 插槽与 part / 令牌            |
| [`planned.md`](./planned.md)                                                                                       | M2（接口已定，实现待做）+ M3（接口草案）               |

> **读这份的场合**：接一个组件、查接口、改组件 API。
> 怎么写文档页见 [`../doc-pages.md`](../doc-pages.md)，怎么造组件见 [`../authoring.md`](../authoring.md)。

---

这一节是硬约束 —— 所有组件的 API 都必须落在这个框架里，
不允许某个组件"因为情况特殊"另起一套。

### 1.1 引入方式

**按需引入，一个组件一条 `<l-m>`：**

```html
<l-m src="https://cdn.jsdelivr.net/gh/lhf6623/mosaic@0.1.0/packages/button/button.html"></l-m>
```

标签名 = `mc-` + 目录名。同一个族的组件共用一个目录（目录名 = 主标签去掉 `mc-` 前缀）。

### 1.2 属性：四个正交维度

**不要把这些混成一维枚举。** 混了就没法组合（`variant="danger"` 之后
就没法再表达"我要描边样式的危险按钮"），而且 CSS 会退化成组合爆炸。

| 维度         | 属性                                                         | 取值                                                              | 默认      |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- | --------- |
| **语义色**   | `color`                                                      | `primary` / `info` / `success` / `warning` / `danger` / `neutral` | `primary` |
| **外观样式** | `variant`                                                    | 约定：`filled` / `outline` / `ghost`（部分组件另有 `subtle`）     | `filled`  |
| **尺寸**     | `size`                                                       | `sm` / `md` / `lg`                                                | `md`      |
| **状态**     | `disabled` / `loading` / `readonly` / `invalid` / `selected` | 布尔，存在即真                                                    | 无        |

组件**只声明它真正支持的维度**（`mc-card` 没有 `color`，`mc-spinner` 没有 `variant`）。
不支持的属性不要写进 `attrs` —— 写了就是承诺。

`variant` 的取值是**约定**而不是全局枚举：每个组件只声明自己实际支持的取值，
上表列出的是各组件通用的一套（`mc-menu` 用的是 `plain`（默认）/ `surface`）。

**实现方式**：`color` 只往组件自己的色槽（`--mc-<comp>-*`）里填值，`variant` 只决定这些槽
贴到 `background` / `color` / `border-color` 上，两者不直接相乘。槽的个数按需要定：
`mc-button` 用三个 —— `--mc-button-fill` / `--mc-button-on-fill` / `--mc-button-accent`，
因为中性色需要一个单独的强调色。规则数量级因此是「颜色数 + 外观数」，不是两者相乘。

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
（少数直接改不触发更新的 property 见 [P3](../pitfalls/01-props.md)）。
组件**可以**为布尔属性提供一个立即同步的 property 访问器 —— `mc-collapse-item` 的 `open` 就是
（`el.open = true` 写完立刻生效，不必等属性反射那一拍）。

```js
btn.setAttribute('disabled', '');
btn.removeAttribute('disabled');

item.open = true; // 组件提供了访问器时同样可以
```

**值的反射**：`value` / `checked` / `open` 等会反射到宿主元素的原生 DOM property，
所以 `e.target.value` 能读到值（[P18](../pitfalls/04-dom-events.md) 的坑已由组件内部处理，使用者无感）。

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

**点击类交互不定义自定义事件** —— 原生 `click` 自带 `composed: true`，会穿透 shadow 边界冒泡。

### 1.6 插槽命名

| 名字                    | 用途                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| （无 `name`）           | 主内容                                                                           |
| `prefix` / `suffix`     | 输入框、按钮内部的前后附加物；容器类组件的「头部行尾」也用 `suffix`（`mc-card`） |
| `header` / `footer`     | 容器类组件的头尾                                                                 |
| `title` / `description` | 有明确语义的标题与描述                                                           |

**用 `prefix` / `suffix`，不用 `leading` / `trailing`** —— 和 CSS 逻辑属性（`padding-inline-start`）对齐。

### 1.7 `part` 命名

只在**内部有结构性子元素**且使用者确实需要定制时才暴露 `part`。
视觉在 `:host` 上的组件（如 `mc-button`）不需要 —— 外部 `style="…"` 已经够用。

通用词汇：`base` / `panel` / `overlay` / `header` / `body` / `footer` / `label` / `input` / `error`。
已开出的额外名字必须登记在这里：`list`（`mc-menu` / `mc-breadcrumb`）、
`pre` / `code` / `line`（`mc-code`）。

### 1.8 无障碍基线（每个组件都要满足）

- 可交互元素必须是**原生元素**（`<button>` / `<input>` / `<a>`），不是 `<div on:click>`
- 键盘可完成全部操作；弹层必须支持 `Esc` 关闭、打开时焦点进弹层、关闭后焦点归还
- 焦点环用 `--mc-color-ring`，不用 `currentColor`
- 图标按钮必须有 `aria-label`；装饰性 SVG 加 `aria-hidden="true"`
- 详见 [`design-spec.md` 第八节](../design-spec.md#八无障碍)

---

## 二、组件索引

| 组件            | 标签                                   | 目录          | 里程碑 | 状态      |
| --------------- | -------------------------------------- | ------------- | ------ | --------- |
| Button          | `mc-button`                            | `button/`     | M1     | ✅ 已实现 |
| Code            | `mc-code`                              | `code/`       | M1     | ✅ 已实现 |
| Collapse        | `mc-collapse` / `mc-collapse-item`     | `collapse/`   | M1     | ✅ 已实现 |
| Menu            | `mc-menu` / `mc-menu-item`             | `menu/`       | M1     | ✅ 已实现 |
| Breadcrumb      | `mc-breadcrumb` / `mc-breadcrumb-item` | `breadcrumb/` | M1     | ✅ 已实现 |
| Icon            | `mc-icon`                              | `icon/`       | M1     | ✅ 已实现 |
| Card            | `mc-card`                              | `card/`       | M1     | ✅ 已实现 |
| Tag             | `mc-tag`                               | `tag/`        | M1     | ✅ 已实现 |
| Badge           | `mc-badge`                             | `badge/`      | M1     | 待建      |
| Spinner         | `mc-spinner`                           | `spinner/`    | M1     | 待建      |
| Input           | `mc-input`                             | `input/`      | M2     | 待建      |
| Textarea        | `mc-textarea`                          | `textarea/`   | M2     | 待建      |
| Checkbox        | `mc-checkbox`                          | `checkbox/`   | M2     | 待建      |
| Radio           | `mc-radio` / `mc-radio-group`          | `radio/`      | M2     | 待建      |
| Switch          | `mc-switch`                            | `switch/`     | M2     | 待建      |
| Select          | `mc-select` / `mc-option`              | `select/`     | M2     | 待建      |
| Alert           | `mc-alert`                             | `alert/`      | M2     | ✅ 已实现 |
| Progress        | `mc-progress`                          | `progress/`   | M2     | 待建      |
| Toast（命令式） | —                                      | `toast/`      | M2     | 待建      |
| Dialog          | `mc-dialog`                            | `dialog/`     | M3     | 待建      |
| Dropdown        | `mc-dropdown` / `mc-menu-item`         | `dropdown/`   | M3     | 待建      |
| Tooltip         | `mc-tooltip`                           | `tooltip/`    | M3     | 待建      |
| Tabs            | `mc-tabs` / `mc-tab`                   | `tabs/`       | M3     | 待建      |
| Table           | `mc-table`                             | `table/`      | M3     | 待建      |
| Grid            | `mc-grid` / `mc-grid-item`             | `grid/`       | M3     | 待建      |

---

## 二、组件索引

| 组件                          | 标签                                   | 目录          | 里程碑 | 状态      |
| ----------------------------- | -------------------------------------- | ------------- | ------ | --------- |
| [Button](./button.md)         | `mc-button`                            | `button/`     | M1     | ✅ 已实现 |
| [Code](./code.md)             | `mc-code`                              | `code/`       | M1     | ✅ 已实现 |
| [Collapse](./collapse.md)     | `mc-collapse` / `mc-collapse-item`     | `collapse/`   | M1     | ✅ 已实现 |
| [Menu](./menu.md)             | `mc-menu` / `mc-menu-item`             | `menu/`       | M1     | ✅ 已实现 |
| [Breadcrumb](./breadcrumb.md) | `mc-breadcrumb` / `mc-breadcrumb-item` | `breadcrumb/` | M1     | ✅ 已实现 |
| [Icon](./icon.md)             | `mc-icon`                              | `icon/`       | M1     | ✅ 已实现 |
| [Card](./card.md)             | `mc-card`                              | `card/`       | M1     | ✅ 已实现 |
| [Tag](./tag.md)               | `mc-tag`                               | `tag/`        | M1     | ✅ 已实现 |
| [Badge](./badge.md)           | `mc-badge`                             | `badge/`      | M1     | 待建      |
| [Spinner](./spinner.md)       | `mc-spinner`                           | `spinner/`    | M1     | 待建      |
| Input                         | `mc-input`                             | `input/`      | M2     | 待建      |
| Textarea                      | `mc-textarea`                          | `textarea/`   | M2     | 待建      |
| Checkbox                      | `mc-checkbox`                          | `checkbox/`   | M2     | 待建      |
| Radio                         | `mc-radio` / `mc-radio-group`          | `radio/`      | M2     | 待建      |
| Switch                        | `mc-switch`                            | `switch/`     | M2     | 待建      |
| Select                        | `mc-select` / `mc-option`              | `select/`     | M2     | 待建      |
| [Alert](./alert.md)           | `mc-alert`                             | `alert/`      | M2     | ✅ 已实现 |
| Progress                      | `mc-progress`                          | `progress/`   | M2     | 待建      |
| Toast（命令式）               | —                                      | `toast/`      | M2     | 待建      |
| Dialog                        | `mc-dialog`                            | `dialog/`     | M3     | 待建      |
| Dropdown                      | `mc-dropdown` / `mc-menu-item`         | `dropdown/`   | M3     | 待建      |
| Tooltip                       | `mc-tooltip`                           | `tooltip/`    | M3     | 待建      |
| Tabs                          | `mc-tabs` / `mc-tab`                   | `tabs/`       | M3     | 待建      |
| Table                         | `mc-table`                             | `table/`      | M3     | 待建      |
| Grid                          | `mc-grid` / `mc-grid-item`             | `grid/`       | M3     | 待建      |

---

---

## 三、M1 组件

逐个见上面索引里链接的文件。
