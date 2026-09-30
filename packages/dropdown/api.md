# mc-dropdown

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./dropdown.html` · M3 · **已实现**

下拉菜单：触发元素放在 `trigger` 插槽、面板内容放在默认插槽（通常是复用另一个单元的
`mc-menu-item`）。面板是原生浮层（进 top layer），贴边自动翻转。

与 `mc-popover` / `mc-select` 的分工：popover 是**通用容器**（触发方式与内容都由使用者给）、
select 是**表单控件**（选项与 `value` 归它管）；dropdown 是**菜单** —— 内容形态与交互方式
固定成「一个触发元素 + 一块菜单面板」，共用同一套定位与层级。

```html
<mc-dropdown>
  <mc-button slot="trigger" variant="outline">打开菜单</mc-button>
  <mc-menu-item><button type="button">个人资料</button></mc-menu-item>
  <mc-menu-item><button type="button">账号设置</button></mc-menu-item>
</mc-dropdown>
```

`open` **既是初始值也是运行时状态**（同 `mc-collapse-item`）：`<mc-dropdown open>` 首屏展开，
点触发元素开合时组件也会自己增删这个属性，所以 `el.open = true` 与
`el.setAttribute('open', '')` 两条路都成立。

---

## 属性

| 名称        | 值                                                                                                                                                                   | 默认           | 说明                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------- |
| `open`      | `boolean`                                                                                                                                                            | —              | 开合状态（初始值 + 运行时状态，会反射回宿主属性）             |
| `placement` | `'top' \| 'top-start' \| 'top-end' \| 'bottom' \| 'bottom-start' \| 'bottom-end' \| 'left' \| 'left-start' \| 'left-end' \| 'right' \| 'right-start' \| 'right-end'` | `bottom-start` | 面板相对触发元素的方向（不写后缀 = 居中）；空间不够自动翻转   |
| `trigger`   | `'click' \| 'hover'`                                                                                                                                                 | `click`        | 怎么开：点触发元素 / 指针移入；`hover` 时移出关（120ms 宽限） |

## 事件

| 名称    | 类型                     | 说明                                                   |
| ------- | ------------------------ | ------------------------------------------------------ |
| `open`  | `(event: Event) => void` | 面板已显示（属性 / property / 点触发元素三条路都会发） |
| `close` | `(event: Event) => void` | 面板已关闭（Esc / 点外部 / 再点触发元素）              |

两个事件都冒泡 + `composed`。

## 插槽与 part

| 名称           | 说明                                                             |
| -------------- | ---------------------------------------------------------------- |
| 插槽 `trigger` | 触发元素（**只放一个**；面板锚在它外面的锚点容器上）             |
| 插槽 （默认）  | 面板内容；通常是 `mc-menu-item`（也可以自己放 `mc-menu` 或表单） |
| part="panel"   | 面板本体（原生 popover，进 top layer）                           |
