# mc-tabs / mc-tab

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./tabs.html` + `./tab.html` · **已实现**

标签页，**容器 + 标签**两个标签：容器管标签条、面板显隐与键盘，标签就是那一颗能点的按钮。

初始值写属性 `default-value`，运行时值读写宿主 property `value`：它不是 `attrs` 键，也不会反射成属性。

```html
<mc-tabs default-value="a">
  <mc-tab value="a">标签 A</mc-tab>
  <mc-tab value="b">标签 B</mc-tab>
  <div slot="panel" value="a">面板 A</div>
  <div slot="panel" value="b">面板 B</div>
</mc-tabs>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/tabs/tabs.html"></l-m>

<mc-tabs id="demo"></mc-tabs>

<script type="module">
  await customElements.whenDefined('mc-tabs');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/tabs/tabs.html"></l-m>

<mc-tabs></mc-tabs>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

### mc-tabs

| 名称            | 值       | 默认 | 说明                                                           |
| --------------- | -------- | ---- | -------------------------------------------------------------- |
| `default-value` | `string` | —    | 初始激活项的 `value`；指向禁用项、或干脆不写，就是第一个可用项 |

### mc-tab

| 名称       | 值        | 默认 | 说明                                                 |
| ---------- | --------- | ---- | ---------------------------------------------------- |
| `value`    | `string`  | —    | 标识；容器拿它匹配面板，也是 `change` 载荷里的那个值 |
| `disabled` | `boolean` | —    | 点不动、方向键跳过、不会被选中                       |

## 事件

| 名称     | 类型                                                   | 说明                                                                       |
| -------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `change` | `(event: Event & { data: { value: string } }) => void` | 激活项**真的变了**（点击或方向键）时在 `mc-tabs` 上触发；冒泡 + `composed` |

## 插槽

| 名称     | 说明                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| （默认） | **`mc-tabs`**：放若干 `<mc-tab>`；**`mc-tab`**：标签文案                                                                   |
| `panel`  | **`mc-tabs`**：带 `slot="panel"` 且带 `value` 属性的子元素，按激活项的 `value` 匹配；非激活的挂 `hidden`（常驻 DOM，不删） |

## part

| 名称        | 说明                                                                  |
| ----------- | --------------------------------------------------------------------- |
| `list`      | **`mc-tabs`**：标签条                                                 |
| `indicator` | **`mc-tabs`**：跟随激活项的指示条（位置 / 宽度写在 shadow 内）        |
| `panel`     | **`mc-tabs`**：面板容器（面板本身是使用者的元素，样式写在它自己身上） |
| `base`      | **`mc-tab`**：内部那颗原生 `<button>`                                 |
