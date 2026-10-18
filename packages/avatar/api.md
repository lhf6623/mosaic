# mc-avatar

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./avatar.html` · **已实现**

头像：优先显示 `src` 图片；没有图、加载中或加载失败时落到兜底 —— `name` 的首字母 / 首字，
或默认插槽里的自定义内容。

```html
<mc-avatar src="./me.png" name="张三"></mc-avatar>
<mc-avatar name="John Doe" color="primary"></mc-avatar>
<mc-avatar size="lg" shape="square" name="李雷"></mc-avatar>
<mc-avatar size="48" name="张三"></mc-avatar>
<mc-avatar name="张三"><span>@</span></mc-avatar>
```

---

## 属性

| 名称    | 值                                                                       | 默认      | 说明                                                                                                         |
| ------- | ------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------ |
| `src`   | `string`                                                                 | —         | 图片地址（按页面解析）；为空、加载中或加载失败时显示兜底                                                     |
| `alt`   | `string`                                                                 | —         | 图片的 `alt`；不写就用 `name`                                                                                |
| `name`  | `string`                                                                 | —         | 显示名。兜底时：非拉丁名取第一个字，拉丁名取前两个词的首字母（最多两个字符，大写）                           |
| `size`  | `'sm' \| 'md' \| 'lg' \| number`                                         | `md`      | 三档 24 / 32 / 40px；纯数字按 px（`size="48"` → 48px，非法值回落 `md`）；更自由的尺寸覆盖 `--mc-avatar-size` |
| `shape` | `'circle' \| 'square'`                                                   | `circle`  | 正圆 / 圆角方块（方块的圆角走 `--mc-avatar-radius`）                                                         |
| `color` | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `neutral` | 兜底的浅底与文字色（图片就绪后被盖住，不影响图片）；也收 hex（`#1a7f5a` / `#fc0`）                           |

## 插槽

| 名称     | 说明                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| （默认） | 自定义兜底内容（文字 / emoji / 图标）；有内容时不再显示 `name` 的首字母，图片就绪后整块让位给图片 |
