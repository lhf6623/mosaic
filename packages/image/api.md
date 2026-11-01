# mc-image / mc-image-group

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./image.html` + `./image-group.html` · **已实现**

图像，**容器 + 子项**两个标签：`mc-image` 是一张图加一个框（填充方式、宽高比、圆角、失败兜底）；
`mc-image-group` 把若干张图排成一行并给预览划范围 —— 组内点开预览能左右切换。

预览浮层**整页只有一个**（挂在 `document.body` 的 top layer 上，与 `mc-dialog` 同一条 popover 路子）：
单张图点开就是它自己，组内点开就是整组。失败兜底按「具名 `fallback` 槽 > 默认插槽 > `alt`」取第一个有内容的。

```html
<mc-image src="./photo.jpg" alt="山间的日出"></mc-image>
<mc-image src="./cover.jpg" alt="封面" ratio="16/9"></mc-image>
<mc-image src="./a.jpg" style="width: 160px; height: 100px" fit="contain"></mc-image>

<!-- 点开看大图；Tab 能停上去，Enter / Space 能开 -->
<mc-image src="./photo.jpg" alt="山间的日出" preview style="width: 200px"></mc-image>

<!-- 组内预览：从点的那张开始，左右走完整组 -->
<mc-image-group loop>
  <mc-image src="./a.jpg" alt="第一张" preview style="width: 140px"></mc-image>
  <mc-image src="./b.jpg" alt="第二张" preview style="width: 140px"></mc-image>
</mc-image-group>

<mc-image src="./broken.jpg" alt="山间的日出">
  <span slot="fallback">重新上传</span>
</mc-image>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/image/image.html"></l-m>
<l-m src="./packages/image/image-group.html"></l-m>

<mc-image id="demo" preview></mc-image>

<script type="module">
  await customElements.whenDefined('mc-image');
  $('#demo').addEventListener('open', (event) => console.log(event.data));
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/image/image.html"></l-m>
<l-m src="./packages/image/image-group.html"></l-m>

<mc-image :src="url" :alt="title" attr:preview="previewable"></mc-image>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

### mc-image

| 名称      | 值                                                         | 默认    | 说明                                                                                          |
| --------- | ---------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `src`     | `string`                                                   | —       | 图片地址（按页面解析）；换地址会重新加载，同一个失败地址不会自动重试                          |
| `alt`     | `string`                                                   | —       | 图片的 `alt`；加载失败时也是兜底文字（插槽有内容时让位）                                      |
| `fit`     | `'cover' \| 'contain' \| 'fill' \| 'none' \| 'scale-down'` | `cover` | 图片怎么落进框里（`object-fit`）；框没有确定尺寸时看不出差别                                  |
| `ratio`   | `string`                                                   | —       | 宽高比，写法同 CSS `aspect-ratio`（`16/9` / `4/3` / `1.5`）；写了就占满父级宽度、高度按比例算 |
| `radius`  | `'none' \| 'sm' \| 'md' \| 'lg' \| 'full'`                 | `none`  | 圆角四档 + 全圆                                                                               |
| `lazy`    | `boolean`                                                  | —       | 转发给内部 `<img>` 的 `loading="lazy"`：滚到附近才开始下载                                    |
| `preview` | `boolean`                                                  | —       | 点击打开大图预览；图没加载成功时不响应（失败图点了也没东西看）                                |

### mc-image-group

| 名称   | 值        | 默认 | 说明                                                                       |
| ------ | --------- | ---- | -------------------------------------------------------------------------- |
| `loop` | `boolean` | —    | 组内预览切到末尾后绕回第一张；不写就停在两端（箭头禁用），方向键也不再前进 |

## 事件

### mc-image

| 名称    | 类型                                                                                | 说明                                                      |
| ------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `load`  | `(event: Event & { data: { src: string; width: number; height: number } }) => void` | 图片解码完成；`width` / `height` 是原图尺寸，不是框的尺寸 |
| `error` | `(event: Event & { data: { src: string } }) => void`                                | 加载失败：地址写错 / 图片损坏；同时落到兜底               |
| `open`  | `(event: Event & { data: { src: string; index: number; total: number } }) => void`  | 预览打开；`index` 从 0 起、`total` 是这次可切换的张数     |
| `close` | `(event: Event) => void`                                                            | 预览关闭（× / Esc / 点遮罩，三条路都发一次）              |

## 插槽

### mc-image

| 名称       | 说明                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| （默认）   | 失败兜底的一句话（文字 / 简单行内元素）；有内容时不再显示 `alt`；图正常时不占位         |
| `fallback` | 失败兜底的任意内容（图标、按钮、多行结构）；有内容时默认插槽与 `alt` 都让位；同样不占位 |

### mc-image-group

| 名称     | 说明                                                       |
| -------- | ---------------------------------------------------------- |
| （默认） | 放若干 `mc-image`；写不写 `preview` 各自决定能不能点开预览 |

## part

### mc-image

| 名称       | 说明                                                      |
| ---------- | --------------------------------------------------------- |
| `image`    | 内部 `<img>` 本体：滤镜、`object-position` 这类改在它上面 |
| `fallback` | 失败兜底层：背景、字重、内边距这类改在它上面              |
