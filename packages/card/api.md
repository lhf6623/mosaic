# mc-card

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./card.html` · **已实现**

一块带底/描边的容器面，头尾可选。

```html
<mc-card variant="outline" border="none">
  <span slot="header">项目设置</span>
  <span slot="suffix">草稿</span>
  主体内容
  <div slot="footer"><mc-button size="sm">保存</mc-button></div>
</mc-card>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/card/card.html"></l-m>

<mc-card id="demo"></mc-card>

<script type="module">
  await customElements.whenDefined('mc-card');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/card/card.html"></l-m>

<mc-card></mc-card>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称      | 值                               | 默认      | 说明                                                        |
| --------- | -------------------------------- | --------- | ----------------------------------------------------------- |
| `variant` | `'surface' \| 'outline'`         | `surface` | 有底色 / 只有描边（外框默认 1px）                           |
| `border`  | `'line' \| 'none'`               | `line`    | 外框与头尾分隔线一起开关；`none` 只改颜色不改宽度，尺寸不抖 |
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | `md`      | 内边距，映射 `--mc-space-3/4/6`                             |
| `float`   | `boolean`                        | —         | 浮起：鼠标移入加一层阴影、移出复原，不占布局                |

## 插槽

| 名称     | 说明                                                           |
| -------- | -------------------------------------------------------------- |
| （默认） | 主体内容                                                       |
| `header` | 头部那一行左侧的内容；通长，下方一条分隔线；没内容不占位       |
| `footer` | 页脚内容；通长，上方一条分隔线；没内容不占位                   |
| `suffix` | 头部那一行贴右边的附加物（徽标 / 状态 / 小按钮）；有它也算有头 |

## part

| 名称     | 说明                                   |
| -------- | -------------------------------------- |
| `base`   | 内层盒子：内边距声明在它上面           |
| `header` | 头部那一整条（贴卡片边缘，可以换底色） |
| `body`   | 正文那块                               |
| `footer` | 页脚那一整条（贴卡片边缘，可以换底色） |
