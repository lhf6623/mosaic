# mc-table

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./table.html` · **已实现**

数据表格：真 `<table>` + `<th scope="col">`，列定义与行数据都是**对象数组**，运行时推荐用 property 传（绑定通道落点不稳定）。

```html
<mc-table id="t"></mc-table>
<script type="module">
  const t = document.querySelector('#t');
  t.columns = [{ key: 'name', title: '姓名' }];
  t.data = [{ name: '张三' }];
</script>
```

## 使用环境

同一标签在两种环境里使用；完整约束见 [packages/README.md](../README.md) 的「1.1.1 使用环境」。

**普通 HTML**：没有模板编译；用普通属性 / JS property，对象 / 数组在 JS 里赋。

```html
<script src="https://cdn.jsdelivr.net/gh/ofajs/ofa.js/dist/ofa.min.mjs" type="module"></script>
<l-m src="./packages/table/table.html"></l-m>

<mc-table id="demo"></mc-table>

<script type="module">
  await customElements.whenDefined('mc-table');
  // 对象 / 数组属性：$("#demo").xxx = ...
</script>
```

**ofa 模板**：在 template page / template component 里可以写绑定。

```html
<l-m src="./packages/table/table.html"></l-m>

<mc-table></mc-table>
<!-- 动态标量：:xxx="value"；布尔：attr:xxx="bool"；对象 / 数组：data + :xxx="objectValue" -->
```

---

## 属性

| 名称         | 值                     | 默认       | 说明                                                                                |
| ------------ | ---------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `columns`    | `string`               | —          | 列定义的 JSON 字符串（属性通道只作初始值）；运行时用 property 传 `{ key, title }[]` |
| `striped`    | `boolean`              | —          | 斑马纹：偶数行换底色                                                                |
| `hoverable`  | `boolean`              | —          | 悬停行换底色                                                                        |
| `bordered`   | `boolean`              | —          | 外边框：整块一圈描边 + 圆角（单元格横线不变）                                       |
| `size`       | `'sm' \| 'md' \| 'lg'` | `md`       | 密度三档：字号 + 单元格内边距（行高不跟着走，见单元 README）                        |
| `loading`    | `boolean`              | —          | 加载中：盖在表格上的一层 + 显示 `loading` 插槽                                      |
| `empty-text` | `string`               | `暂无数据` | 没有数据时兜底 `mc-empty` 的文案（绑到它的 `description`）                          |

## 插槽

| 名称      | 说明                                                                      |
| --------- | ------------------------------------------------------------------------- |
| `empty`   | 空态内容；给了就整块顶掉兜底的 `mc-empty`（此时 `empty-text` 不参与）     |
| `loading` | 加载态内容；`loading` 为真时显示，不给则是 `mc-spinner` + 一行「加载中…」 |

## part

| 名称    | 说明                                          |
| ------- | --------------------------------------------- |
| `table` | 表格本体（`<table>`）                         |
| `row`   | 数据行（`<tr>`，表头行不带 part）             |
| `cell`  | 表头格与数据格（`<th scope="col">` / `<td>`） |
