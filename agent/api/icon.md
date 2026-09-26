# mc-icon

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](./README.md)；踩坑见 [`../pitfalls/`](../pitfalls/README.md)。

---

`packages/icon/icon.html` · **已实现**

图标。三种来源、一个入口，优先级从高到低：默认插槽 > `src` > `name`。
`name` 先查内置（零请求、首屏即有），查不到才按需远程取一次 —— 没用到的图标一个请求都不发。

| 名称        | 值                                                                | 默认                          | 说明                                                                                  |
| ----------- | ----------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| `name`      | 内置图标名 / `集名:图标名`                                        | —                             | 先查内置、查不到再远程；`mdi:home` 按 `mdi` 集取，`circle-check-big` 按 `icon-set` 取 |
| `src`       | SVG 地址                                                          | —                             | 相对路径按页面解析；给了它就不再查内置（品牌多色图走这条）                            |
| `label`     | 字符串                                                            | —                             | 有值 → 宿主 `role="img"` + `aria-label`；空 → 整块 `aria-hidden="true"`               |
| `size`      | `sm` `md` `lg`                                                    | `md`                          | `0.875em` / `1em` / `1.25em`（改的是 `font-size`，见下）                              |
| `color`     | `current` `primary` `info` `success` `warning` `danger` `neutral` | `current`                     | 只往 `currentColor` 里填值；`neutral` = 次要文字色                                    |
| `icon-base` | URL 前缀                                                          | `https://api.iconify.design/` | 远程取图标的地址前缀，一个属性换自托管 / 镜像                                         |
| `icon-set`  | 图标集名                                                          | `lucide`                      | 裸名远程回退时用哪个集                                                                |

| 名称           | 说明                                                      |
| -------------- | --------------------------------------------------------- |
| （默认）       | 自定义图形；有内容时内置 / 远程图形让位（零依赖的逃生口） |
| `part="glyph"` | 图形槽：内置图标类名与取回的 `<svg>` 都挂在它里面         |

**没有自定义事件**：图标是纯展示元素，不用 `on:` 监听任何东西；无障碍只看 `label`
（有值才是有语义的图标，否则整块对读屏隐藏）。

**`size` 是对 1.3「尺寸 = 控件高」的显式例外**：图标不是控件，改的是 `font-size`，
盒子恒为 1em —— 所以 `style="font-size: 20px"` 直接管用，不必新增档位。
`color` 同理不新增维度：`style="color: …"`、父元素继承、`class="text-primary"` 一律有效。

**「本地」的定义是「你发出去的那份样式表里有什么」**：内置集由构建期 presetIcons 编译成
data-URI 的 `mask-image` 规则（`.mc-icon-<名字>`），组件给图形槽挂上类名、问
`getComputedStyle().maskImage` 判定命中 —— 不是抄一份名单，扩了内置集自动生效。
`lucide:search`（集名等于内置来源集）会退化成裸名再查一次本地，命中就零请求；
`mdi:home` 本地没有 → 取 `{icon-base}mdi/home.svg`；`circle-check-big`（无冒号）→ 按
`icon-set` 拼。

**取不到图标 = 空盒子 + 一条警告**：占住 1em、不跳版、不抛错，控制台只留一条 `[mosaic]`
警告；同一个图标（含取失败的名字）全页只请求一次。

**不用 `<use> + symbol` sprite**：跨域 `<use>` 被 Chrome 与 WebKit 一致拒绝，shadow root 里
引用文档级 `#id` 也不成立（实测数据见 [`../research/iconify.md`](../research/iconify.md)）；
组件把取回的 SVG 直接内联。**内置图标是 mask 单色渲染，改不了描边粗细**，品牌多色图用
`src` 或默认插槽。

**没有 `--mc-icon-*` 令牌**：颜色走 `currentColor`、尺寸走 `font-size`，两个控制点都是原生
CSS —— 按实例改样式直接写宿主 `style="…"`，要进内部就用 `::part(glyph)`。

**在按钮里会被按钮接管两件事**（见 [button.md](./button.md)）：字号走 `--mc-button-icon-size`
（默认 `1.25em`，比按钮文字大一档），颜色强制跟随按钮文字色 —— 所以 **`color` 属性在按钮内部不生效**。
这是按钮层的特调，图标集本身（描边、尺寸比例）保持与上游一致。

### 内置集（50 个）

**组件内部怎么用内置图标**（框架自己消费这套图标时的约定）：

- **静态**图标直接用类名：`<span class="mc-loader mc-icon-spinner" aria-hidden="true"></span>`
  —— 类规则已经在 `mosaic.css` 里、也被 adopt 进每个 shadow root，所以**零请求、零额外依赖**
  （`mc-button` 的 loading 指示器、`mc-collapse-item` 的折叠箭头都是这么写的）。
- **动态**换名 / 需要 `src` / 需要插槽时才用 `<mc-icon>` 组件：`mc-alert` 的左侧图形跟着
  `color` 变，所以它 `await load('../icon/icon.html')` —— 只引 `mc-alert` 的使用者会多取一次
  `icon.html`（约 5.7 KB gzip）。**能不引就不引**，静态图标没理由付这个钱。
- `mc-icon-` 前缀归图标集专用：组件内部类不要叫这个名字。`tools/gen-icons.mjs` 会守两头——
  组件里引用的 `mc-icon-x` 必须真的存在，组件 `<style>` 里的 `.mc-icon-x` 选择器不许和图标同名。

来源 Lucide（ISC），署名见
[`packages/icon/icons.license.txt`](../../packages/icon/icons.license.txt)；清单的唯一真相源是
[`tools/icon-manifest.mjs`](../../tools/icon-manifest.mjs) —— 加图标 = 加一行 + `pnpm icons`，
使用者的 HTML 一个字都不用改。

| 分组       | 名字                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 方向与折叠 | `chevron-up` `chevron-down` `chevron-left` `chevron-right` `chevrons-up-down` `arrow-up` `arrow-down` `arrow-left` `arrow-right`                                          |
| 语义状态   | `info` `warning` `success` `error` `help`                                                                                                                                 |
| 通用操作   | `check` `close` `plus` `minus` `search` `menu` `more` `drag` `external` `copy` `download` `upload` `refresh` `spinner` `filter` `trash` `edit` `eye` `eye-off` `settings` |
| 对象与信息 | `user` `calendar` `clock` `link` `image` `file` `folder` `lock` `unlock` `star` `heart` `bell`                                                                            |
| 主题与播放 | `sun` `moon` `play` `pause`                                                                                                                                               |

```html
<mc-icon name="search"></mc-icon>
<mc-icon name="trash" label="删除" color="danger"></mc-icon>
<mc-icon src="./logo.svg" label="品牌" style="font-size: 24px"></mc-icon>
<mc-icon name="mdi:home" icon-base="https://icons.example.com/"></mc-icon>
```

---
