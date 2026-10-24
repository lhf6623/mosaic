# mc-icon

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./icon.html` · **已实现**

图标。三种来源、一个入口，优先级从高到低：默认插槽 > `src` > `name`。
`name` 先查内置（零请求、首屏即有），查不到才按需远程取一次 —— 没用到的图标一个请求都不发。

```html
<mc-icon name="search"></mc-icon>
<mc-icon name="trash" color="danger"></mc-icon>
<mc-icon src="./logo.svg" style="font-size: 24px"></mc-icon>
<mc-icon name="mdi:home" icon-base="https://icons.example.com/"></mc-icon>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/icon/icon.html"></l-m>

<mc-icon id="demo"></mc-icon>

<script type="module">
  await customElements.whenDefined('mc-icon');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/icon/icon.html"></l-m>

<mc-icon></mc-icon>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称        | 值                                                                                    | 默认                          | 说明                                                                                               |
| ----------- | ------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `name`      | `string`                                                                              | —                             | 先查内置、查不到再远程；`mdi:home` 按 `mdi` 集取，`circle-check-big` 按 `icon-set` 取              |
| `src`       | `string`                                                                              | —                             | SVG 地址；相对路径按页面解析；给了它就不再查内置（品牌多色图走这条）                               |
| `size`      | `'sm' \| 'md' \| 'lg' \| number`                                                      | `md`                          | `0.875em` / `1em` / `1.25em`（改的是 `font-size`）；纯数字按 px 设图标盒大小（`size="32"` → 32px） |
| `color`     | `'current' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `current`                     | 颜色：语义色名或 hex（如 `#ff6b35`）；`neutral` = 次要文字色，不写就用 `currentColor`              |
| `icon-base` | `string`                                                                              | `https://api.iconify.design/` | 远程取图标的地址前缀，一个属性换自托管 / 镜像                                                      |
| `icon-set`  | `string`                                                                              | `lucide`                      | 裸名远程回退时用哪个集                                                                             |

## 插槽

| 名称     | 说明                                                      |
| -------- | --------------------------------------------------------- |
| （默认） | 自定义图形；有内容时内置 / 远程图形让位（零依赖的逃生口） |

## part

| 名称    | 说明                                              |
| ------- | ------------------------------------------------- |
| `glyph` | 图形槽：内置图标类名与取回的 `<svg>` 都挂在它里面 |
