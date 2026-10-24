# mc-date-picker（日期选择）

> **这是单元开发文档，不是接口文档。** 接口事实（属性 / 方法 / 事件 / 配置 / 插槽 / part）
> 的唯一手写源是 [`api.md`](./api.md) —— 它由 `<doc-spec>` 渲染进 [`page.html`](./page.html) 的参考区。
> 这份回答「这个目录里有什么、各自什么关系、现在什么状态、为什么这么设计」，
> 并放**不进文档页**的东西（令牌 / 实现约束 / 刻意不做的）—— 那些是改代码的人才要看的。

**状态**：已实现 · 标签 `mc-date-picker` · 目录 `packages/date-picker/`

日期选择。触发框 + 浮层，两个正交维度：`type`（日 / 周 / 月 / 年）× 模式（单选 / 多选 / 范围）。

## 单元里有什么

| 文件               | 角色                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `date-picker.html` | **入口一**：使用者 CDN 引入的本体（源 = 产物，构建不碰它）                    |
| `page.html`        | **入口二**：文档站加载（注册在 [`docs/site-map.js`](../../docs/site-map.js)） |
| `api.md`           | 接口规范 —— 由 `<doc-spec>` 渲染进页面参考区                                  |
| `demos/`           | 13 个演示（页面用 `<doc-playground src>` 读**同一份文件**）                   |
| `test/`            | 组件自己的冒烟套件（1 个文件）                                                |

只有两个东西对外：**本体（使用者 CDN 引入）** 与 **`page.html`（文档站加载）**；其余是单元内部资产。

<!-- hand:start -->

## 设计取舍

**两个轴：`type` × 模式。** `type` 决定「一格代表多少时间」——`day` / `week` / `month` / `year`；
模式决定「能选几个」——单选（默认）/ `multiple` / `range`。两个轴正交，所以 4 × 3 种组合都走同一套
选择、格式化与取消逻辑，不需要为「月份范围」再写一个组件。`range` 与 `multiple` 同时写时 `range` 生效
（两个都开没有明确定义，与其猜，不如给一个确定的优先级并写进 api）。

**渲染是模板的事，脚本只算数据。** 触发框文案（`displayText`）、面板标题与两个翻页按钮的 title
（`panelTitle` / `prevTitle` / `nextTitle`）、星期行的显隐（`coarse`）都在模板里绑定；
日 / 周 42 格与月 / 年 12 格各由一条 `<o-fill>` 渲染（`days` / `cells` 两份格模型，`fill-key` 用逐格唯一的
id —— 周视图里 7 天的选择 key 相同，不能拿它当 fill-key）。选中 / 范围中 / 键盘高亮 / 置灰 / 补位 /
今天都是格模型上的布尔字段，模板用 `attr:` 落到 `data-*`，样式仍由 CSS 按属性选择器切换。
脚本里没有 `createElement` / `append`：它只做模板表达不了的行为 —— 原生 `popover` 开合、焦点、
滚动守卫、溢出提示、键盘状态机，以及把值解析成格模型。⚠️ 面板开合是同步的，格模型要等微任务才落到
DOM（`o-fill` 的更新是批量的），所以溢出提示等一拍再量（`queueMicrotask`）。

**内部存 canonical key，不存 `Date`。** 每种 type 一个稳定字符串键，比较、排序、范围判断都按字符串做：

| `type`  | canonical key | 说明                         |
| ------- | ------------- | ---------------------------- |
| `day`   | `YYYY-MM-DD`  | 本地日历日                   |
| `week`  | `YYYY-Www`    | ISO 周（周一开始，零填两位） |
| `month` | `YYYY-MM`     | 月                           |
| `year`  | `YYYY`        | 年                           |

`periodOfKey()` 把 key 还原成起止日期（周 → 周一 ~ 周日，月 → 1 号 ~ 月末，年 → 1/1 ~ 12/31），
渲染与范围高亮都靠它。没有引入 `Date` 对象：对象的时区、原地可变、跨 shadow 传值都会让「同一天」
在不同时区上漂，而这个组件只需要稳定的日历标识。

**值形状跟着模式走。** 单选是 string；`multiple` / `range` 的 property 是 `string[]`，
同名属性是逗号分隔的初始值（同 `mc-select` 的 `multiple`）。`range` 的数组固定是 `[起, 止]`，
第一次点击只置起点（显示 `起 ~ …`、不写 `value` 属性），第二次点击排序后提交并关面板；
中途 Esc / 点外部会丢掉未完成的起点，恢复打开前的值（`openPanel` 存快照、`closePanel` 还原）。
属性通道用逗号分隔，所以多选 / 范围时 `output-format` 不要含逗号；property 是数组，不受影响。

**多选不关面板。** 每点一格 toggle 一次，`change` 跟着发（`value` 是当前完整数组），
触发框按 `format` 把各项用逗号加空格拼起来（超长由固定宽度 + 省略号兜住）。
范围两端用实心色、中间用 18% 主色浅底（`data-in-range`），周视图里整行是同一个 key，所以整行高亮。

**三段格式各一个属性，默认值随 type。** 进 `input-format` / 中 `format` / 出 `output-format`：

| `type`  | 默认格式     |
| ------- | ------------ |
| `day`   | `YYYY-MM-DD` |
| `week`  | `YYYY-[W]WW` |
| `month` | `YYYY-MM`    |
| `year`  | `YYYY`       |

| 占位符 | 含义                                      | 输出示例 |
| ------ | ----------------------------------------- | -------- |
| `YYYY` | 四位年（`week` 下是 ISO 周所属年）        | `2026`   |
| `YY`   | 两位年（解析 00–69 → 20xx、70–99 → 19xx） | `26`     |
| `MM`   | 两位月份                                  | `03`     |
| `M`    | 一至两位月份                              | `3`      |
| `DD`   | 两位日                                    | `05`     |
| `D`    | 一至两位日                                | `5`      |
| `WW`   | 两位 ISO 周号（仅 `week`）                | `43`     |
| `W`    | 一至两位 ISO 周号（仅 `week`）            | `43`     |

其它字符原样保留，`[...]` 里是字面量（`YYYY-[W]WW` 的 `W`）。`compileFormat()` 按 type 校验必需字段：
day 要年 / 月 / 日，week 要年 / 周，month 要年 / 月，year 只要年；缺字段、重复字段或串了别的字段都判无效，
回退该 type 的默认格式并 `console.warn` 一次。**解析顺序是 input → output → 该 type 的默认格式**，
先命中的赢。

组件自己写回的 `value` 属性用 `output-format`，并在 `value` 的 watch 里按字符串跳过自己刚写的那一份 ——
否则 in / out 不同且彼此歧义时（`MM/DD` 与 `DD/MM`），回读会把你刚选中的日子改成另一个。
所以 `sync:value` 里存的是 out 格式；外部再把这串写回来时，靠 output 回退能读回同一天。

**宽度固定，不跟内容跳。** 宿主宽度由 `--mc-date-picker-control-width`（默认 `12rem`）给死：
占位文案、单值 / 多选拼接、格式化后的长文本、`clearable` 多出来的 × 都不会撑大或缩回盒子（放不下时
`.mc-value` 省略号）。需要整行宽度写宿主 `style="width:100%"` —— 那是实例覆盖，不是第二个尺寸维度。

**长内容被裁掉时给完整文案提示。** 多选拼接、范围文案或长格式化文本让 `.mc-value` 出现
`scrollWidth > clientWidth` 时，hover / focus 会在下方弹一个 top layer 的小浮层显示完整文案；面板打开时自动收起。
提示来自共享的 [`../boot/overflow-tip.js`](../boot/overflow-tip.js)，宿主上同步 `[data-overflow]`。

**日期一律按本地日历日的三个数字算。** 与 `new Date(y, m - 1, d)` 做加减，**不用 `Date.parse('YYYY-MM-DD')`**
—— 后者按 UTC 解析，东八区上会整体退一天。ISO 周用 UTC 日差算（`isoWeekInfo` / `mondayOfWeek`），
避开夏令时导致的 23 / 25 小时；非法日期（`2026-02-30`）与非法周（`2026-W54`）当空值处理。

**日 / 周视图固定 6 × 7 格，月 / 年是 3 × 4 格。** 日视图前后补相邻月份（`data-outside`），月份切换时高度不跳；
周视图里同一周的 7 天共用一个 `data-key`，点任意一天等于选整周。月视图 12 个月、年视图 12 年一页
（`2020 – 2031` 这种年段），翻页步长分别是 1 年 / 12 年。键盘与指针走同一套状态：
日 / 周方向键逐日 / 逐周，月 / 年方向键逐格，`PageUp` / `PageDown` 翻页，`Home` / `End` 到首尾，
`Enter` / 空格选中，`Esc` 关闭。

**浮层形态照 `mc-popover` / `mc-select` 的四条结论：**

1. 面板是原生 `popover` 进 top layer，不挂 `document.body`、不用 `--mc-z-*`；
2. 锚点（`anchor-name`）设在 shadow 内的触发框 `.mc-control` 上；
3. 显式清掉 UA 给 `[popover]` 的 `inset` / `margin` / `border`；
4. 开合时用 `scroll-pin` 的滚动守卫（`ready()` 接、`detached()` 放），显式 `showPopover()` / `hidePopover()`
   包进 `run()`。

**`popover="manual"` 是有意的。** `auto` 的 light dismiss 发生在 pointerdown 上，等 click 到达时面板已经被
浏览器关掉，再 `toggle()` 会把它重新开回来（「点第二次关不掉」）。所以外部点击由 `document` 上的
`pointerdown` + `composedPath()` 判定（`contains(e.target)` 跨 shadow 必然误判），Esc 由触发框与面板的
`keydown` 处理；关闭后需要时把焦点还给触发框。

**键盘焦点始终在触发框上。** 面板里的翻页 / 每一格都是原生 `<button>`（不是 `div on:click`），
但统一 `tabindex="-1"`：网格由触发框的方向键驱动，鼠标的 `mousedown` 被 `preventDefault`，
焦点不会跑进面板。这样「打开 → 方向键移动 → Enter 确认 → Esc 取消」是一条不断线的键盘路径，
也不产生 Tab 陷阱。

**范围之外的项目用 `data-disabled` 标记 + JS 拦截，不是原生 `disabled`。** 原生 disabled 的按钮
在部分浏览器里连 mousedown 都不派发，面板的「压掉默认聚焦」接不住，点一下就会把焦点甩回 body、
顺带把面板收掉。所以格子保持可点击，由 `onPanelClick()` 与 `selectKey()` 双重拦下，
样式也全由 `data-disabled` 走。

**状态写成宿主钩子**：`data-open`（面板正在显示）/ `data-filled`（有值）/ `data-empty`（没值）/
`data-overflow`（触发框内容被省略号裁掉）挂在宿主上。
组件自己的 shadow CSS 靠它们换样式（`:host([data-empty]) .mc-value`、`:host([clearable][data-filled]) .mc-clear`），
外层也拿它按状态写样式 —— `mc-date-picker[data-filled] { … }`，或配 `::part()`。

**季度之类的扩展只动类型表。** 新增 `quarter` 时：加 `TYPE_DEFAULTS.quarter`、`TYPE_PLACEHOLDERS.quarter`、
`periodOfKey` / `parseKey` / `renderCoarsePanel` 的季度分支，再给 `compileFormat` 加 `Q` 占位符与
「年 + 季度」的必需字段；选择 / 多选 / 范围 / 格式化的主流程不用改。**刻意不做**：时间维度、周起始可配、
月 / 年快速跳转；需求出现前它们只会变成演示覆盖不到的承诺。

## 令牌

写在宿主 `style="…"` 上按实例覆盖：

| 令牌                                  | 默认                        | 作用                                           |
| ------------------------------------- | --------------------------- | ---------------------------------------------- |
| `--mc-date-picker-control-bg`         | `--mc-color-surface`        | 触发框底色                                     |
| `--mc-date-picker-control-border`     | `--mc-color-border`         | 触发框边框色（`invalid` 时被换成危险色）       |
| `--mc-date-picker-control-radius`     | `--mc-radius-md`            | 触发框圆角                                     |
| `--mc-date-picker-control-pad-x`      | `--mc-space-4`              | 触发框左右内边距                               |
| `--mc-date-picker-control-width`      | `12rem`                     | 触发框固定宽度（不随占位 / 值长度跳）          |
| `--mc-date-picker-offset`             | `--mc-space-2`              | 面板到触发框的距离                             |
| `--mc-date-picker-panel-bg`           | `--mc-color-surface-raised` | 面板底色                                       |
| `--mc-date-picker-panel-border`       | `--mc-color-border-strong`  | 面板**轮廓色**（drop-shadow 画的，不是真边框） |
| `--mc-date-picker-panel-radius`       | `--mc-radius-lg`            | 面板圆角                                       |
| `--mc-date-picker-panel-pad`          | `--mc-space-3`              | 面板内边距                                     |
| `--mc-date-picker-panel-width`        | `18rem`                     | 面板宽度                                       |
| `--mc-date-picker-nav-color`          | `--mc-color-fg-muted`       | 翻页按钮的颜色                                 |
| `--mc-date-picker-nav-bg-hover`       | `--mc-color-surface-sunken` | 翻页按钮的悬停底色                             |
| `--mc-date-picker-weekday-color`      | `--mc-color-fg-subtle`      | 星期行文字色                                   |
| `--mc-date-picker-day-color`          | `--mc-color-fg`             | 日期数字色                                     |
| `--mc-date-picker-day-color-outside`  | `--mc-color-fg-subtle`      | 相邻月份补位日期的颜色                         |
| `--mc-date-picker-day-color-selected` | `--mc-color-primary-fg`     | 选中项的文字色                                 |
| `--mc-date-picker-day-bg-hover`       | `--mc-color-surface-sunken` | 悬停 / 键盘高亮的底色                          |
| `--mc-date-picker-day-bg-selected`    | `--mc-color-primary`        | 选中项的底色（范围中间用它的 18% 浅色）        |
| `--mc-date-picker-today-border`       | `--mc-color-primary`        | 「今天」的内描边色                             |
| `--mc-date-picker-placeholder-color`  | `--mc-color-fg-subtle`      | 占位文案的颜色                                 |
| `--mc-date-picker-icon-color`         | `--mc-color-fg-subtle`      | 右端日历图标的颜色                             |
| `--mc-date-picker-clear-color`        | `--mc-color-fg-muted`       | × 按钮的颜色                                   |
| `--mc-date-picker-clear-bg-hover`     | `--mc-color-surface-sunken` | × 按钮悬停底色                                 |

> 令牌不进**文档页**（页面参考区只渲染 api.md 的白名单四节），将来由主题编辑器展示。
> 还有一个 `--mc-date-picker-anchor`（锚点标识）：它是组件内部的接线，不是使用者的覆盖点，在代码里标了 `@internal`。

## 相邻单元

- 复用 [`../boot/scroll-pin.js`](../boot/scroll-pin.js)：浮层开合的滚动守卫。
- 复用 [`../boot/overflow-tip.js`](../boot/overflow-tip.js)：多选 / 范围 / 长格式化文本被裁掉时的完整文案提示。
- 复用 [`../boot/date.js`](../boot/date.js)：**日历日运算 / canonical key / 格式串**全在那里
  （2026-10 从本组件抽出去的；以后的 time-picker、calendar、表格日期列都该用它，别各写一份）。
  本组件只剩业务胶水：`type` 的三种默认格式与占位文案。
- 与 [`mc-popover`](../popover/) / [`mc-select`](../select/) / [`mc-tree-select`](../tree-select/) 共用同一套浮层形态
  （原生 popover + CSS 锚点定位）；select 是「选项列表」，date-picker 是「日历 / 周 / 月 / 年网格」。
- 表单取值由 [`mc-form`](../form/) 统一收：它按「有 `value` property 的值载体」识别控件；
  `multiple` / `range` 时表单拿到的是数组（同 `mc-select` 的 multiple）。

<!-- hand:end -->

## 改这个单元之前

- 跨组件约定、组件索引与文档页规范：[`packages/README.md`](../README.md)
