# mc-form / mc-form-item

> 共用约定（五个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`packages/README.md`](../README.md)。
> 源码 `./form.html` + `./form-item.html` · **已实现**

表单：容器管**提交 / 重置 / 取值 / 校验**四件事，`mc-form-item` 管一行（标签 + 控件 + 错误文案）。
控件就是库里那几个表单单元（`mc-input` / `mc-textarea` / `mc-select` / `mc-checkbox` /
`mc-radio-group` / `mc-switch`），**原生的 `<input>` / `<select>` / `<textarea>` 也认** ——
容器只按 `name` 与 `value` / `checked` 读它们，不要求它们长什么样。

`mc-form` 里**没有** `<form>`，也不走原生表单提交：控件各住自己的 shadow root，原生 form owner
那套跨不过 shadow 边界（同 `mc-radio` 的「同 name 成组」）。所以这三件事都由容器编排 ——
`submit` / `invalid` 由容器发，值由容器按 `name` **从控件读**。

**容器不持有数据**：数据该放哪由「受控 / 非受控」决定（下一节），容器只做**规则与时机**。

```html
<mc-form on:submit="save($event.data.value)">
  <mc-form-item label="用户名" name="username" required>
    <mc-input></mc-input>
  </mc-form-item>
  <mc-form-item label="确认邮箱" name="confirm">
    <mc-input></mc-input>
  </mc-form-item>
  <mc-form-item>
    <mc-button type="submit">提交</mc-button>
  </mc-form-item>
</mc-form>
```

**提交怎么触发**：容器里 `type="submit"` 的 `mc-button` 被点击、或在单行输入框里按
<kbd>Enter</kbd>（textarea 里是换行，不提交）。校验没过发 `invalid`，字段逐个标红并显示文案。

**校验规则是对象数据**，两个地方都能放 —— `mc-form.rules`（按**字段名**配，适合跨字段与集中写）与
`mc-form-item` 的 `rules`（绑在**这一行**上，连 `name` 都不用写）；每处都有**两个通道**：

| 通道         | 写法                                                                                                                                   | 能表达                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **属性**     | `<mc-form rules='{"username":[{"required":true,"message":"…","trigger":"blur"}]}'>`（JSON 文本；行上是 `rules='[{"required":true}]'`） | `required` / `message` / `trigger` 这些**声明式键**   |
| **property** | `form.rules = {…}` / `item.rules = …`（对象或数组）                                                                                    | 上面那些**加上 `validator` 函数**（含 async、跨字段） |

```html
<!-- 声明式：直接写在标签上，一条 JS 都不用 -->
<mc-form
  rules='{"username":[{"required":true,"message":"用户名不能为空","trigger":["input","blur"]}]}'>
  <mc-form-item label="用户名" name="username"><mc-input></mc-input></mc-form-item>
  <!-- 行上也一样：这一行的规则直接写成属性（位置绑定，不需要 name） -->
  <mc-form-item label="备注" rules='[{"required":true,"message":"备注不能为空","trigger":"blur"}]'>
    <mc-input></mc-input>
  </mc-form-item>
</mc-form>
```

```js
/* 带函数的只能挂 property；和属性同名字段时，两条规则都会跑（属性在前、property 在后） */
form.rules = {
  phone: {
    trigger: 'blur',
    validator: async (rule, value) => {
      await new Promise((resolve) => setTimeout(resolve, 200)); // 假装远程查重
      return value.endsWith('0000') ? '这个号被占用了' : '';
    },
  },
};
item.rules = {
  validator: (rule, value, form) => (value === form.getValue().email ? '' : '两次不一致'),
};
```

> 为什么函数进不了属性：标签属性是文本，JSON 装不了函数。模板里的 `:rules="某对象"` 也一样 ——
> ofa 会先把它 `JSON.stringify` 成文本写进这个属性（实测组件里拿到的就是字符串），函数在那一步就丢了。
> 所以「声明式」能覆盖 `required` / `message` / `trigger`，「validator」只能 property。

| 键          | 值                                        | 说明                                                                         |
| ----------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `required`  | `boolean`                                 | 必填。空值口径：字符串 `trim()` 后为空 / 开关是 `false` / 同名组是空数组     |
| `validator` | `(rule, value, form) => …`                | 自定义校验；`value` 与 `getValue()` 里该字段同一份，`form` 是 `mc-form` 宿主 |
| `message`   | `string`                                  | 失败文案；`validator` 只回 `false` 时用它，没写就用内置兜底                  |
| `trigger`   | `'input' \| 'change' \| 'blur'`（或数组） | 平时什么时候**提前**校验；不写 = 只在提交时跑                                |

**`validator` 返回什么都认**：

| 返回                                 | 结果                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| `''` / `undefined` / `null` / `true` | 通过                                                     |
| 非空字符串                           | 失败，**这个字符串就是文案**（比 `message` 优先）        |
| `false`                              | 失败，文案取 `rule.message`，没写就用内置兜底            |
| `Promise`                            | 按上面同样的规则解释 resolve / reject                    |
| 抛异常 / `reject`                    | 失败，文案取 `error.message`（不静默，也不炸掉整轮校验） |

**什么时候跑**：提交时**所有**规则都跑（不用为提交写 `trigger`）；平时只跑 `trigger` 命中的那部分，
不写 `trigger` 就只在提交时跑。同一个字段一次只显示**第一条**失败文案。
一个字段的规则表按这个顺序拼：**`required` 属性 → 行内 `rules`（属性 → property）→
`form.rules[字段名]`（属性 → property）**。

**清校验状态**（提交失败后想收起那片红、或切换上下文时重置观感）—— **可以只清一个字段**：

| 想清谁 | 方法                                    | 事件                                                   |
| ------ | --------------------------------------- | ------------------------------------------------------ |
| 全部   | `form.clearValidate()`                  | `new CustomEvent('clear-validate', { bubbles: true })` |
| 某一个 | `form.clearValidate('user.name')`       | 同上，带 `detail: { fields: 'user.name' }`             |
| 某几个 | `form.clearValidate(['name', 'email'])` | `detail: { fields: ['name', 'email'] }`                |

字段名与 `getValue()` 的键**同一口径**（`mc-form-item` 或控件上的 `name`，支持 `.` 路径）。
事件派在容器上、或从容器**内部**冒上来（比如表单里的按钮派发）都收得到。

两种做法都会把**在飞的**异步校验一并作废（整表清 → 全部；按字段清 → 只作废那几个），
不会出现「刚清完又被晚回的校验标红」；这一轮里被清过的字段**只记结论、不落状态**。

```html
<mc-form on:submit="save()">
  <!-- …字段… -->
  <mc-form-item>
    <mc-button type="submit">提交</mc-button>
    <!-- 点它 = 收起所有错误提示 -->
    <mc-button type="button" on:click="clearAll()">清掉校验</mc-button>
    <!-- 只收起「标题」那一行 -->
    <mc-button type="button" on:click="clearTitle()">只清标题</mc-button>
  </mc-form-item>
</mc-form>
```

```js
proto: {
  form() {
    return this.ele.shadowRoot.querySelector('mc-form');
  },
  clearAll() {
    this.form().clearValidate(); // 或者派发冒泡的 clear-validate 事件
  },
  clearTitle() {
    this.form().clearValidate('title');
  },
},
```

**只留位置、不显示文案**：容器上写 `hide-error` —— 想静态写死就 `<mc-form hide-error>`，想让数据说了算就用
**属性绑定** `<mc-form :hide-error="showError">`（改 `showError` 就行，ofa 会把属性写好、组件当场重画）。
控件照样收 `invalid`（红边框还在）、`invalid` 事件照样报字段，只是错误文案那一格空着。
**高度不变**：那一格本来就是行间距，所以显示 / 隐藏文案不会让整张表变矮。

**校验是异步的**：`validate()` / `submit()` 返回 Promise（规则里可能有 `async` 校验），
`await form.validate()`；实时校验里异步晚回的结果会被丢弃（只认最后一次）。

## 受控 / 非受控

表单数据**不归容器**（它不存 `model`、不记快照），归属由这两种模式决定 —— 判据只有一个：
**这个控件有没有绑数据**。

|          | **受控**（绑了）                                                                                                                                                                                                                               | **非受控**（没绑）                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 真相源   | 你的 `data`（`form.user.name`）                                                                                                                                                                                                                | 控件内部的原生 `<input>` / `<select>` / checkbox           |
| 怎么写   | 文本类：写在控件上 —— sync:value="form.name"（双向）或 :value="form.name"（单向跟随）； 开关类：:checked="form.agree" **加** on:change="form.agree = $event.data.checked"（布尔的属性往返在 ofa 里会绕成字符串 checked="false"，显式回写最稳） | 不绑；初值写 default-value / default-checked（挂载读一次） |
| 取值     | 你的数据就是值 —— **不用调 `getValue()`**                                                                                                                                                                                                      | `getValue()` / `submit` 载荷 `$event.data.value`           |
| 数据进来 | `this.form = await api()`，绑定自动推进控件                                                                                                                                                                                                    | 写在属性上（`default-value`），或服务端渲染                |
| 改动回流 | 打字就地写回 `form.name`                                                                                                                                                                                                                       | 只在控件里，提交时读一次                                   |
| 重置     | 换数据：`this.form = structuredClone(this.initial)`                                                                                                                                                                                            | 容器不提供（要清就自己清控件）                             |
| 校验     | **两种模式一个口径**：值都从控件读，所以受控时等价于从数据读                                                                                                                                                                                   | 同                                                         |

```js
/* 受控：数据在 data 里，控件绑它；提交时直接用数据 */
export default {
  data: { form: { user: { name: '张三' }, agree: false } },
  proto: {
    save() {
      fetch('/api', { method: 'POST', body: JSON.stringify(this.form) });
    },
  },
};
```

**为什么容器不做「给它一份数据」的入口**（曾经的 `form.model = {…}`）：ofa 的模板绑定只能把值写成
**属性文本**（`:model="form"` 到组件里就是 JSON 文本），对象引用进不来；与其在容器里再造一层数据语义，
不如让控件直接绑你的 `data` —— 数据始终是同一个对象。

**排布不内置**：容器**没有布局属性**（除了下面那行要说的 `required` 在行上）—— 几列、哪一格跨几列是栅格的事，
套 [`mc-grid`](../grid/api.md) 把 `mc-form-item` 放进 `mc-grid-item` 就行（见文档页「栅格排布」）。
`mc-form` 只把内容竖着叠成一列，一行内部固定「标签在上、控件在下」。

---

## 属性

### mc-form（容器）

| 名称         | 值        | 默认 | 说明                                                                                                                                                                                                                       |
| ------------ | --------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules`      | `string`  | —    | 按字段名配规则：**属性通道**写 JSON 文本 `{ 字段名: 规则 \| 规则[] }`；带 `validator` 的运行时用 property `form.rules = {…}`（两个通道都写时属性在前）                                                                     |
| `hide-error` | `boolean` | —    | **只留位置、不显示错误文案**（写了就生效，去掉就展开）：控件照旧收 `invalid`（红边框还在）、`invalid` 事件照常报字段；底部那一格高度不变 —— 它是行间距，所以显示 / 隐藏文案都不会让表变矮或跳动。运行时加 / 去掉也立刻重画 |

### mc-form-item（一行）

| 名称       | 值        | 默认 | 说明                                                                                                                                                                                                                              |
| ---------- | --------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`    | `string`  | —    | 标签文案；没有标签、也不是必填时那一列不占位                                                                                                                                                                                      |
| `name`     | `string`  | —    | 字段名；不写就取内部控件自己的 `name`，两个都没有的控件不进值表；带 `.` 的按**路径**写进对象（`data.name` → `{data:{name:…}}`、`list.0.name` → `{list:[{name:…}]}`），没有点的照旧平铺                                            |
| `required` | `boolean` | —    | 必填的简写：等价于规则表最前面一条 `{ required: true }`。**星号**由规则表决定：`required` 属性、行内 `rules`、容器按字段名配的 `rules`，哪条写了 `{ required: true }` 都会画出标签前的 `*`（容器统一算，写在 `data-required` 上） |
| `rules`    | `string`  | —    | 这一行的规则：**属性通道**写 JSON 文本 `规则 \| 规则[]`；带 `validator` 的运行时用 property `item.rules = …`（两个通道都写时属性在前）                                                                                            |

## 事件

| 名称                     | 类型                                                                    | 说明                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `submit`                 | `(event: Event & { data: { value: Record<string, unknown> } }) => void` | **校验通过后触发**：值在 `$event.data.value`（与 `getValue()` 同一份），调接口写这里                           |
| `invalid`                | `(event: Event & { data: { fields: string[] } }) => void`               | **校验没过时触发**：失败字段在 `$event.data.fields`（没写 `name` 的行是空串）                                  |
| `validate()`             | `() => Promise<boolean>`                                                | **只校验、不发事件**：想在提交前问一句「过没过」时用（按钮想提前置灰也可以）                                   |
| `getValue()`             | `() => Record<string, unknown>`                                         | **读成一个对象**：非受控用法的取值口（受控时数据本来就在你手里）；同名多个给数组、单个开关给布尔，禁用控件不算 |
| `submit()`               | `() => Promise<void>`                                                   | **主动提交一次**：过就发 `submit`、没过发 `invalid`（点 `type="submit"` 按钮、单行输入框里回车的也是它）       |
| `clearValidate(fields?)` | `() => void`                                                            | **收起红框和文案**：不传 = 全收，给字段名或名字数组 = 只收这几个；也能用 `clear-validate` 事件触发             |

## 插槽

| 名称     | 说明                                                                                        |
| -------- | ------------------------------------------------------------------------------------------- |
| （默认） | **`mc-form`**：表单内容（`mc-form-item`、控件、操作按钮）；**`mc-form-item`**：这一行的控件 |

## part

| 名称    | 说明                                                                                  |
| ------- | ------------------------------------------------------------------------------------- |
| `base`  | **`mc-form`**：包住所有内容的盒子；**`mc-form-item`**：整行（标签 + 控件 + 错误文案） |
| `label` | **`mc-form-item`**：标签容器（没有标签、也不是必填时整列不占位）                      |
| `error` | **`mc-form-item`**：错误文案那一行（校验通过时常驻但不显示）                          |
