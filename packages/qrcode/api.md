# mc-qrcode

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./qrcode.html` · **已实现**

二维码：把一段文字编成可扫的图形。编码核心内联在组件里（零依赖、不经构建），
支持版本 1–40 自动选择、四档纠错、两种渲染方式、中间图案与自定义配色。

```html
<mc-qrcode value="https://mofas.dev/mosaic/qrcode"></mc-qrcode>
<mc-qrcode value="https://example.com" size="240" level="Q"></mc-qrcode>
<mc-qrcode value="https://example.com" renderer="svg" color="#0f766e"></mc-qrcode>
<mc-qrcode value="https://example.com" logo="./logo.png" logo-size="0.18"></mc-qrcode>
```

内容按 **UTF-8 字节模式**编码（中文、emoji 都能扫出来）；版本由内容长度与纠错等级自动决定，
不用手写。内容超出二维码容量上限时清空图形并给宿主标 `data-error="capacity"`。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/qrcode/qrcode.html"></l-m>

<mc-qrcode id="demo"></mc-qrcode>

<script type="module">
  await customElements.whenDefined('mc-qrcode');
  const el = $('#demo');
  el.setAttribute('value', 'https://example.com');
  el.logo = './logo.png'; // 运行时改值走 property / setAttribute
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/qrcode/qrcode.html"></l-m>

<mc-qrcode :value="link" :logo="logoUrl" logo-size="0.18"></mc-qrcode>
<!-- 动态标量：:xxx="value"；运行时改值也认 setAttribute -->
```

---

## 属性

| 名称              | 值                         | 默认      | 说明                                                                                                                            |
| ----------------- | -------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `value`           | `string`                   | —         | 要编码的内容；空 = 不绘制。中文 / emoji 按 UTF-8 编码，不做数字化 / 字母数字模式的压缩                                          |
| `size`            | `number`                   | `160`     | 边长（px），同时决定盒子尺寸与绘制分辨率：canvas 按它乘设备像素比重建画布，svg 按它写外框；宿主上的 `--mc-qrcode-size` 会盖过它 |
| `level`           | `'L' \| 'M' \| 'Q' \| 'H'` | `M`       | 纠错等级：可恢复约 7% / 15% / 25% / 30% 的模块损坏；等级越高、同样内容需要的版本越大（格子越密）                                |
| `renderer`        | `'canvas' \| 'svg'`        | `canvas`  | 渲染方式：canvas 是位图（适合固定尺寸、导出 PNG），svg 是矢量路径（缩放打印不糊、也便于导出）                                   |
| `color`           | `string`                   | `#000000` | 深色模块的颜色，收任意 CSS 颜色                                                                                                 |
| `background`      | `string`                   | `#ffffff` | 底色（含静区），收任意 CSS 颜色；`transparent` = 不铺底                                                                         |
| `margin`          | `number`                   | `4`       | 静区宽度，单位是模块（规范要求 4）；0 只建议用在四周本来就有白底的地方                                                          |
| `logo`            | `string`                   | —         | 中间图案的图片地址（URL / data URI）；空 = 不放                                                                                 |
| `logo-size`       | `number`                   | `0.2`     | 图案边长占二维码边长的比例，夹在 0.05–0.4 之间（越大压住的模块越多）                                                            |
| `logo-padding`    | `number`                   | `2`       | 图案四周留白（px），底座跟着变大                                                                                                |
| `logo-radius`     | `number`                   | `4`       | 图案底座的圆角（px）                                                                                                            |
| `logo-background` | `string`                   | —         | 图案底座颜色；不写 / 空 = 跟随 `background`，写 `transparent` = 不留底座                                                        |

## 事件

| 名称                       | 类型                        | 说明                                                                                                                              |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `toDataURL(type?: string)` | `(type?: string) => string` | 导出当前图形：canvas 返回 PNG（或 `type` 指定的格式）data URL，svg 返回 `image/svg+xml` 的 data URL；画布被跨域图案污染时返回空串 |

## part

| 名称    | 说明                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------- |
| `image` | 画布 / 矢量图本体（当前渲染方式那一个）；圆角、描边、滤镜都改它 —— 圆角会连带裁掉二维码的角，靠纠错兜底 |
