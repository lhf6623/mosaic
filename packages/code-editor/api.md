# mc-code-editor

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./code-editor.html` · **已实现**

轻量代码编辑器（表单控件）：在页面上改一小段 HTML / JS / CSS，值按表单控件那一套读写。
语法高亮、行号、括号配对 / 自动闭合由随组件 vendor 的 CodeMirror 5 提供；它只在本组件真正可见时才下载，
加载失败会降级成普通 `<textarea>`，值 / 事件契约不变。

**值怎么读写**：非受控的初值走属性 `default-value`；受控就把控件绑到你的数据上 ——
ofa 的 `:value="form.snippet"`（单向）/ `sync:value="form.snippet"`（双向）写的就是 `value` 属性
（运行时读写仍走宿主 property `el.value`）。放进 `mc-form` / `mc-form-item` 后按 `name`
（或 `mc-form-item` 的 `name`）收集当前值。

```html
<mc-code-editor default-value="<p>hello</p>" name="snippet" auto-resize></mc-code-editor>
<mc-code-editor language="js" sync:value="form.code"></mc-code-editor>
```

```js
const el = document.querySelector('mc-code-editor');
el.value = 'const answer = 42;';
el.addEventListener('input', (e) => console.log(e.data.value));
```

键盘：`Tab` 缩进（选中多行时整体缩进）、`Shift-Tab` 反缩进、`Esc` 离开编辑器；
`Ctrl/Cmd + /` 切换注释。不会吞 `Ctrl/Cmd + Enter`，要「运行」由宿主在 `keydown` 上接。

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/code-editor/code-editor.html"></l-m>

<mc-code-editor id="demo"></mc-code-editor>

<script type="module">
  await customElements.whenDefined('mc-code-editor');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/code-editor/code-editor.html"></l-m>

<mc-code-editor></mc-code-editor>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称            | 值                                  | 默认   | 说明                                                                                     |
| --------------- | ----------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `value`         | `string`                            | —      | 值：绑定写这里 —— `sync:value` 双向、`:value` 单向；输入会写回它，运行时读 `el.value`    |
| `default-value` | `string`                            | —      | **非受控初值**；之后改它**不会**覆盖当前值                                               |
| `name`          | `string`                            | —      | 表单字段名；`mc-form` 按它（或外层 `mc-form-item` 的 `name`）收集值                      |
| `language`      | `'html' \| 'js' \| 'css' \| 'text'` | `html` | 语言：`html` 含内联 JS / CSS；`text` 不高亮。其它值按 `text` 处理                        |
| `readonly`      | `boolean`                           | —      | 只读：可聚焦 / 选中 / 滚动，不能改                                                       |
| `disabled`      | `boolean`                           | —      | 禁用：不能聚焦，整体降透明                                                               |
| `invalid`       | `boolean`                           | —      | 校验失败：边框取 `--mc-color-danger`                                                     |
| `auto-resize`   | `boolean`                           | —      | 输入 / 换行时把宿主高度设成内容高度；不写就是固定高度（默认 `--mc-code-editor-h`，8rem） |

## 事件

| 名称     | 类型                                                   | 说明                                                                   |
| -------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `input`  | `(event: Event & { data: { value: string } }) => void` | 每次输入；`$event.data.value` 是当前值，`$event.target.value` 也读得到 |
| `change` | `(event: Event & { data: { value: string } }) => void` | 值确定变化时触发（失焦且值变过），冒泡 + `composed`                    |
