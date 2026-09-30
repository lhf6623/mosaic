# mc-icon

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./icon.html` · **已实现**

图标。三种来源、一个入口，优先级从高到低：默认插槽 > `src` > `name`。
`name` 先查内置（零请求、首屏即有），查不到才按需远程取一次 —— 没用到的图标一个请求都不发。

```html
<mc-icon name="search"></mc-icon>
<mc-icon name="trash" label="删除" color="danger"></mc-icon>
<mc-icon src="./logo.svg" label="品牌" style="font-size: 24px"></mc-icon>
<mc-icon name="mdi:home" icon-base="https://icons.example.com/"></mc-icon>
```

---

## 属性

| 名称        | 值                                                                                    | 默认                          | 说明                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `name`      | `string`                                                                              | —                             | 先查内置、查不到再远程；`mdi:home` 按 `mdi` 集取，`circle-check-big` 按 `icon-set` 取                |
| `src`       | `string`                                                                              | —                             | SVG 地址；相对路径按页面解析；给了它就不再查内置（品牌多色图走这条）                                 |
| `label`     | `string`                                                                              | —                             | 有值 → 宿主 `role="img"` + `aria-label`；空 → 整块 `aria-hidden="true"`                              |
| `size`      | `'sm' \| 'md' \| 'lg'`                                                                | `md`                          | `0.875em` / `1em` / `1.25em`（改的是 `font-size`，见下）                                             |
| `color`     | `'current' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `current`                     | 只往 `currentColor` 里填值；`neutral` = 次要文字色；也可以是 hex（如 `#ff6b35`），直接写宿主 `color` |
| `icon-base` | `string`                                                                              | `https://api.iconify.design/` | 远程取图标的地址前缀，一个属性换自托管 / 镜像                                                        |
| `icon-set`  | `string`                                                                              | `lucide`                      | 裸名远程回退时用哪个集                                                                               |

**`size` 是对 1.3「尺寸 = 控件高」的显式例外**：图标不是控件，改的是 `font-size`，
盒子恒为 1em —— 所以 `style="font-size: 20px"` 直接管用，不必新增档位。
`color` 同理不新增维度：`style="color: …"`、父元素继承、`class="text-primary"` 一律有效。

### 内置集（50 个）

| 分组       | 名字                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 方向与折叠 | `chevron-up` `chevron-down` `chevron-left` `chevron-right` `chevrons-up-down` `arrow-up` `arrow-down` `arrow-left` `arrow-right`                                          |
| 语义状态   | `info` `warning` `success` `error` `help`                                                                                                                                 |
| 通用操作   | `check` `close` `plus` `minus` `search` `menu` `more` `drag` `external` `copy` `download` `upload` `refresh` `spinner` `filter` `trash` `edit` `eye` `eye-off` `settings` |
| 对象与信息 | `user` `calendar` `clock` `link` `image` `file` `folder` `lock` `unlock` `star` `heart` `bell`                                                                            |
| 主题与播放 | `sun` `moon` `play` `pause`                                                                                                                                               |

来源 Lucide（ISC），署名见 [`icons.license.txt`](./icons.license.txt)；清单的唯一真相源是
[`tools/icon-manifest.mjs`](../../tools/icon-manifest.mjs) —— 加图标 = 加一行 + `pnpm icons`，
使用者的 HTML 一个字都不用改。

## 插槽与 part

| 名称          | 说明                                                      |
| ------------- | --------------------------------------------------------- |
| 插槽 （默认） | 自定义图形；有内容时内置 / 远程图形让位（零依赖的逃生口） |
| part="glyph"  | 图形槽：内置图标类名与取回的 `<svg>` 都挂在它里面         |
