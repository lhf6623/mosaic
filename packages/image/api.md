# mc-image / mc-image-group / mc-image-preview

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./image.html` + `./image-group.html` + `./image-preview.html` · **已实现**

图像，**容器 + 子项 + 无渲染入口**三个标签：`mc-image` 是一张图加一个框（填充方式、宽高比、圆角、失败兜底、点了看大图）；
`mc-image-group` 把若干张图排成一行并给预览划范围 —— 组内点开预览能左右切换；
`mc-image-preview` **不渲染任何内容**，只交出「预览图 + 起点」—— 图不适合铺在页面上时用这个。

**预览默认就是开的**：图加载好就能点开，不用写属性；纯装饰、不该被点的图写 `preview-disabled` 关掉
（正向开关：写了才禁，`:preview-disabled="false"` 仍然是开）。
三个标签都提供 `open()`：不想等点击、或者图上叠了自己的按钮 / 手势时，主动调它打开 —— 关闭后焦点会还给调用时的那个元素。
预览浮层**整页只有一个**（挂在 `document.body` 的 top layer 上，与 `mc-dialog` 同一条 popover 路子）：
单张图点开就是它自己，组内点开就是整组，`mc-image-preview` 打开的是它自己的列表（`src` 或子元素）。
失败兜底按「具名 `fallback` 槽 > 默认插槽 > `alt`」取第一个有内容的。

```html
<mc-image src="./photo.jpg" alt="山间的日出"></mc-image>
<mc-image src="./cover.jpg" alt="封面" ratio="16/9"></mc-image>
<mc-image src="./a.jpg" style="width: 160px; height: 100px" fit="contain"></mc-image>

<!-- 默认就能点开看大图；Tab 能停上去，Enter / Space 能开 -->
<mc-image src="./photo.jpg" alt="山间的日出" style="width: 200px"></mc-image>

<!-- 纯装饰的图不要交互：写 preview-disabled 关掉 -->
<mc-image src="./texture.jpg" alt="" preview-disabled style="width: 200px"></mc-image>

<!-- 组内预览：从点的那张开始，左右走完整组 -->
<mc-image-group loop>
  <mc-image src="./a.jpg" alt="第一张" style="width: 140px"></mc-image>
  <mc-image src="./b.jpg" alt="第二张" style="width: 140px"></mc-image>
</mc-image-group>

<mc-image src="./broken.jpg" alt="山间的日出">
  <span slot="fallback">重新上传</span>
</mc-image>

<!-- 图不铺在页面上，只用按钮打开预览：组件不占位，谁调 method 谁说了算 -->
<mc-image-preview id="big-photo" src="./big.jpg" alt="车间全景"></mc-image-preview>
<mc-button on:click="openBig()">查看大图</mc-button>

<!-- 多张：子元素就是相册，工具条里能左右切；open(1) 从第二张开始 -->
<mc-image-preview id="album" loop>
  <img src="./a.jpg" alt="第一张" />
  <img src="./b.jpg" alt="第二张" />
</mc-image-preview>
<mc-button on:click="document.getElementById('album').open(1)">看第二张</mc-button>

<!-- 图在页面上，但入口是自己的按钮：直接调那张图的 open()，组内则从这张开始 -->
<mc-image id="cover" src="./cover.jpg" alt="封面"></mc-image>
<mc-button on:click="document.getElementById('cover').open()">放大封面</mc-button>

<!-- 组：open(index) 从第 index 张开始，左右仍能走完整组 -->
<mc-image-group id="gallery">
  <mc-image src="./a.jpg" alt="第一张"></mc-image>
  <mc-image src="./b.jpg" alt="第二张"></mc-image>
</mc-image-group>
<mc-button on:click="document.getElementById('gallery').open(1)">从第二张看起</mc-button>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/image/image.html"></l-m>
<l-m src="./packages/image/image-group.html"></l-m>
<l-m src="./packages/image/image-preview.html"></l-m>

<mc-image id="demo" src="./photo.jpg"></mc-image>

<script type="module">
  await customElements.whenDefined('mc-image');
  $('#demo').addEventListener('open', (event) => console.log(event.data));
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/image/image.html"></l-m>
<l-m src="./packages/image/image-group.html"></l-m>
<l-m src="./packages/image/image-preview.html"></l-m>

<mc-image :src="url" :alt="title" attr:preview-disabled="readonly"></mc-image>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
<!-- 正向布尔正好贴合 ofa：attr:preview-disabled 绑 true 写成 preview-disabled，
     绑 false 写成 preview-disabled="false"（= 不关），不用为「默认开」做反向读法 -->
```

---

## 属性

### mc-image

| 名称               | 值                                                         | 默认    | 说明                                                                                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`              | `string`                                                   | —       | 图片地址（按页面解析）；换地址会重新加载，同一个失败地址不会自动重试                                                                                                                                                                                                |
| `alt`              | `string`                                                   | —       | 图片的 `alt`；加载失败时也是兜底文字（插槽有内容时让位）                                                                                                                                                                                                            |
| `fit`              | `'cover' \| 'contain' \| 'fill' \| 'none' \| 'scale-down'` | `cover` | 图片怎么落进框里（`object-fit`）；框没有确定尺寸时看不出差别                                                                                                                                                                                                        |
| `ratio`            | `string`                                                   | —       | 宽高比，写法同 CSS `aspect-ratio`（`16/9` / `4/3` / `1.5`）；写了就占满父级宽度、高度按比例算                                                                                                                                                                       |
| `radius`           | `'none' \| 'sm' \| 'md' \| 'lg' \| 'full'`                 | `none`  | 圆角四档 + 全圆                                                                                                                                                                                                                                                     |
| `lazy`             | `boolean`                                                  | —       | 转发给内部 `<img>` 的 `loading="lazy"`：滚到附近才开始下载                                                                                                                                                                                                          |
| `preview-disabled` | `boolean`                                                  | —       | 关掉点击预览：**默认就是开的**，不用写；写了这个属性才是「一张普通图」（没有放大镜光标、Tab 停不上去、也不进组相册）。`="false"` 不算写。其他预览能力：底部工具条带缩放 / 旋转 / 还原 / 下载 / 关闭，放大后按住图可拖动，组内还能左右切换；图没加载成功时同样不响应 |

### mc-image-group

| 名称   | 值        | 默认 | 说明                                                                       |
| ------ | --------- | ---- | -------------------------------------------------------------------------- |
| `loop` | `boolean` | —    | 组内预览切到末尾后绕回第一张；不写就停在两端（箭头禁用），方向键也不再前进 |

### mc-image-preview

| 名称   | 值        | 默认 | 说明                                                                   |
| ------ | --------- | ---- | ---------------------------------------------------------------------- |
| `src`  | `string`  | —    | 要预览的图（按页面解析）。有子元素时不用它：子元素就是相册             |
| `alt`  | `string`  | —    | 预览里的说明兼失败兜底文字；多张时每张各取自己的 `alt`（写在子元素上） |
| `loop` | `boolean` | —    | 多张时切到末尾绕回第一张；不写就停在两端（箭头禁用），方向键也不再前进 |

## 事件

### mc-image

| 名称            | 类型                                                                                | 说明                                                                                              |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `load`          | `(event: Event & { data: { src: string; width: number; height: number } }) => void` | 图片解码完成；`width` / `height` 是原图尺寸，不是框的尺寸                                         |
| `error`         | `(event: Event & { data: { src: string } }) => void`                                | 加载失败：地址写错 / 图片损坏；同时落到兜底                                                       |
| `open`          | `(event: Event & { data: { src: string; index: number; total: number } }) => void`  | 预览打开；`index` 从 0 起、`total` 是这次可切换的张数                                             |
| `close`         | `(event: Event) => void`                                                            | 预览关闭（工具条关闭按钮 / Esc / 点遮罩，每条路都只发一次）                                       |
| `open(opener?)` | `(opener?: Element \| null) => { src, index, total } \| null`                       | 主动打开自己的预览（不等点击）：组内从这张开始、能左右走完整组。`opener` 不传就记调用时的焦点元素 |
| `close()`       | `() => void`                                                                        | 关掉当前预览（整页只有一层，和 `mc-image-preview.close()` 是同一个）                              |

### mc-image-group

| 名称                    | 类型                                                                          | 说明                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `open(index?, opener?)` | `(index?: number, opener?: Element \| null) => { src, index, total } \| null` | 打开组里的预览：`index` 是可预览成员（没写 `preview-disabled`）的序号，从 0 起，越界夹到两端；整组都没得看时返回 `null` |

### mc-image-preview

| 名称                    | 类型                                                                               | 说明                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `open`                  | `(event: Event & { data: { src: string; index: number; total: number } }) => void` | 预览打开；`index` 从 0 起、`total` 是这次可切换的张数                                              |
| `close`                 | `(event: Event) => void`                                                           | 预览关闭（工具条关闭按钮 / Esc / 点遮罩，每条路都只发一次）                                        |
| `open(index?, opener?)` | `(index?: number, opener?: Element \| null) => void`                               | 打开预览：`index` 从 0 起（越界夹到两端）；`opener` 是关闭后要还焦点的元素，不传就记住调用时的焦点 |
| `close()`               | `() => void`                                                                       | 关掉当前预览（整页只有一层）                                                                       |

## 插槽

### mc-image

| 名称       | 说明                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| （默认）   | 失败兜底的一句话（文字 / 简单行内元素）；有内容时不再显示 `alt`；图正常时不占位         |
| `fallback` | 失败兜底的任意内容（图标、按钮、多行结构）；有内容时默认插槽与 `alt` 都让位；同样不占位 |

### mc-image-group

| 名称     | 说明                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| （默认） | 放若干 `mc-image`；默认每张都能点开预览，某张写了 `preview-disabled` 就不进相册 |

## part

### mc-image

| 名称       | 说明                                                      |
| ---------- | --------------------------------------------------------- |
| `image`    | 内部 `<img>` 本体：滤镜、`object-position` 这类改在它上面 |
| `fallback` | 失败兜底层：背景、字重、内边距这类改在它上面              |
