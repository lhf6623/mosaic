# mc-table

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./table.html` · M3 · **已实现**

数据表格：真 `<table>` + `<th scope="col">`，列定义与行数据都是**对象数组**，运行时一律用 property 传。

```html
<mc-table id="t"></mc-table>
<script type="module">
  const t = document.querySelector('#t');
  t.columns = [{ key: 'name', title: '姓名' }];
  t.data = [{ name: '张三' }];
</script>
```

---

## 属性

| 名称         | 值        | 默认       | 说明                                                                                |
| ------------ | --------- | ---------- | ----------------------------------------------------------------------------------- |
| `columns`    | `string`  | —          | 列定义的 JSON 字符串（属性通道只作初始值）；运行时用 property 传 `{ key, title }[]` |
| `striped`    | `boolean` | —          | 斑马纹：偶数行换底色                                                                |
| `hoverable`  | `boolean` | —          | 悬停行换底色                                                                        |
| `loading`    | `boolean` | —          | 加载中：表格 `aria-busy="true"`，并显示 `loading` 插槽                              |
| `empty-text` | `string`  | `暂无数据` | 没有数据时 `empty` 插槽里的兜底文案                                                 |

### 宿主 property（对象数据只能走这里）

| 宿主 property | 值                                 | 默认 | 说明                                                                                                              |
| ------------- | ---------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `columns`     | `{ key: string; title: string }[]` | `[]` | 列定义；`title` 缺省退回 `key`，可选 `width` 作列宽                                                               |
| `data`        | `{ [key: string]: unknown }[]`     | `[]` | 行数据；每个 `key` 对应 `columns` 里的一列。属性写法 `data='[{…}]'` 只是 JSON 兼容的初始值，运行时一律用 property |

> ⚠️ **`data` 只做宿主 property，不进 `attrs`**：`data` 是 ofa.js 元素代理上的保留名
> （`$.fn.data`），声明进 `attrs` 之后属性同步会往代理写 `data`，整个组件渲染不出来
> （同族的保留名问题）。属性写法 `data='[{…}]'` 仍然认，
> 由组件自己观察，但它只是初始值的兼容入口。

```js
// 运行时赋值立刻重渲染；读回的是规范化后的数组
t.columns = [{ key: 'name', title: '姓名', width: '40%' }];
t.data = [{ name: '张三' }, { name: '李四' }];
t.data = []; // 空态
```

## 插槽与 part

| 名称           | 说明                                                      |
| -------------- | --------------------------------------------------------- |
| 插槽 `empty`   | 空态内容；给了就覆盖 `empty-text` 的纯文本                |
| 插槽 `loading` | 加载态内容；`loading` 为真时显示，不给则是一行「加载中…」 |
| part="table"   | 表格本体（`<table>`）                                     |
| part="row"     | 数据行（`<tr>`，表头行不带 part）                         |
| part="cell"    | 表头格与数据格（`<th scope="col">` / `<td>`）             |
