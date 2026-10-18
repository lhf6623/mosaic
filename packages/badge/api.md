# mc-badge

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./badge.html` · **已实现**

徽标：挂在容器（按钮、头像…）角上的语义色小片，可只留一个圆点，也可按上限截断数字。
容器写进默认插槽、徽标贴到它的角上；不写容器时就是一块独立徽标。
和 `mc-tag` 的分工：badge 是「挂在别的元素上」的标记（计数、圆点，本就不交互），
tag 是「内容本身」的标签 —— 它才有关闭与选中。

```html
<mc-badge content="5"><mc-button>消息</mc-button></mc-badge>
<mc-badge content="120" max="99" color="danger" variant="solid">
  <mc-button>消息</mc-button>
</mc-badge>
<mc-badge dot color="success"><mc-button>在线</mc-button></mc-badge>
<mc-badge content="新"></mc-badge>
```

> **破坏性变更**：徽标内容从默认插槽文本改成了 `content` 属性，默认插槽现在放容器。
> 旧写法 `<mc-badge>新</mc-badge>` 要改成 `<mc-badge content="新"></mc-badge>`；
> 原来自己写的 `position: relative` 外层容器与绝对定位也可以去掉了。

---

## 属性

| 名称        | 值                                                           | 默认      | 说明                                                                                                 |
| ----------- | ------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `content`   | `string`                                                     | —         | 徽标文字；纯数字且超过 `max` 时显示 `max+`。空且没开 `dot` 时整块不渲染                              |
| `placement` | `'top-end' \| 'top-start' \| 'bottom-end' \| 'bottom-start'` | `top-end` | 有容器时徽标块贴哪个角（中心压在角上）；没有容器时不生效                                             |
| `color`     | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger'`  | `primary` | 语义色或 hex（`#fff000` / `#fc0`）；浅底按主题派生、实心上的文字色按对比度自动给。**没有 `neutral`** |
| `variant`   | `'subtle' \| 'solid' \| 'outline'`                           | `subtle`  | 浅底深字 / 实心 / 描边（三档都保留 1px 边框，切换时高度不抖）                                        |
| `size`      | `'sm' \| 'md'`                                               | `md`      | 徽标不是控件，只有两档：高度 16 / 20px、字号 10 / 12px                                               |
| `dot`       | `boolean`                                                    | —         | 只显示一个圆点，整块变正圆；打开时 `content` 不渲染                                                  |
| `invisible` | `boolean`                                                    | —         | 隐藏徽标块（容器照常保留）；不写就是显示                                                             |
| `max`       | `number`                                                     | —         | `content` 是纯数字且超过它时改显示 `${max}+`；内容里混了文字（`v2`、`新`）就原样显示                 |

## 插槽

| 名称     | 说明                                                             |
| -------- | ---------------------------------------------------------------- |
| （默认） | 被挂载的容器（**只放一个**，比如 `mc-button`）；不写就是独立徽标 |

## part

| 名称        | 说明                                                   |
| ----------- | ------------------------------------------------------ |
| `indicator` | 徽标块本体；视觉、圆点与挂载模式下的绝对定位都在它上面 |
