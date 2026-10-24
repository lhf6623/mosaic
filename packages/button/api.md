# mc-button

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `packages/button/button.html` · **已实现**

```html
<mc-button color="danger" variant="outline">删除</mc-button>
<mc-button color="success" loading>正在保存…</mc-button>
<mc-button>
  <mc-icon slot="prefix" name="search"></mc-icon>
  搜索
</mc-button>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/button/button.html"></l-m>

<mc-button id="demo"></mc-button>

<script type="module">
  await customElements.whenDefined('mc-button');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/button/button.html"></l-m>

<mc-button></mc-button>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称       | 值                                                                       | 默认      | 说明                                                                                |
| ---------- | ------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------- |
| `color`    | `'primary' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `primary` | 语义色；也可以是 hex（`#fff000` / `#fc0`），此时文字色按对比度自动给                |
| `variant`  | `'filled' \| 'outline' \| 'ghost'`                                       | `filled`  | 外观样式                                                                            |
| `size`     | `'sm' \| 'md' \| 'lg'`                                                   | `md`      | 尺寸                                                                                |
| `type`     | `'button' \| 'submit' \| 'reset'`                                        | `button`  | 转发给内部原生 button                                                               |
| `disabled` | `boolean`                                                                | —         | 禁用                                                                                |
| `loading`  | `boolean`                                                                | —         | 加载中，显示 spinner 且不可点；spinner 占 `prefix` 的位置，加载中 `prefix` 插槽隐藏 |
| `block`    | `boolean`                                                                | —         | 撑满父容器宽度                                                                      |
| `inline`   | `boolean`                                                                | —         | **行内文字按钮**形态：盒子交给文字，`size` 只选文字档位                             |

## 插槽

| 名称     | 说明     |
| -------- | -------- |
| （默认） | 按钮文案 |
| `prefix` | 前置图标 |
| `suffix` | 后置图标 |
