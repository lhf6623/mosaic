# 从零做一个组件（教程 · mc-badge）

> **这是教程，不是规范。** 一条路走到底，不给选择、不解释为什么。
> 跟着做完，仓库里会多一个真能跑、能进文档站的 `mc-badge`。
>
> - 想查**规矩**（命名、分区、哪些坑）→ [`authoring.md`](./authoring.md)（参考）
> - 想理解**为什么这么定** → 别的组件 README 的「设计取舍」（解释）
> - 想看**验收标准** → [`checklist.md`](./checklist.md)
>
> 教程的原则是**保证成功**：下面每一段代码都是可以直接复制的，每一步都有「怎么知道自己做对了」。

这一课做 `mc-badge`（挂在别的元素上的徽标）。它已经在
[`api/badge.md`](./api/badge.md) 里有接口草案，照着做就是把它实现出来。

**会做到的**：`color` / `variant` / `size` / `dot` 四个维度 + 文档页 + 演示 + 测试 + 通过验收。
**不会做**：`max`（数值超过显示 `99+`）—— 它要读插槽文本再改写显示，属于进阶，见最后一节。

---

## 第 0 步 · 确认环境

```bash
pnpm check:docs            # 期望：16 组全部对齐
node tests/smoke.mjs button # 期望：全绿
pnpm dev                    # 起服务，端口 8642，后面每步都能在浏览器里看
```

两个都不绿就先修 —— 在一个红着的仓库上做新组件，最后分不清哪条红是你的。

---

## 第 1 步 · 建目录，写本体

建 `packages/badge/badge.html`。组件本体是**源 = 产物**（不过打包器），写完就是 CDN 上那份：

```html
<!--
  mc-badge — 挂在别的元素上的徽标

  设计取舍 / 实现约束（为什么这么定、踩过哪些坑）不写在这里 —— 见同目录 README.md 的「设计取舍」。
  这份文件是要经 CDN 发给使用者的产物，注释会一起发出去，所以这里只留一行定位与指针。
-->
<template component>
  <style>
    /* 1. 宿主盒模型 + 色槽默认值。尺寸/圆角/内边距写在这里，使用者 style="…" 才压得住 */
    :host {
      display: inline-flex;
      align-items: center;
      box-sizing: border-box;
      gap: var(--mc-badge-gap);
      padding-inline: var(--mc-badge-pad-x);
      padding-block: var(--mc-badge-pad-y);
      border: 1px solid transparent; /* 切 variant 时高度不抖 */
      border-radius: var(--mc-radius-full);
      font-family: var(--mc-font-sans);
      font-size: var(--mc-badge-font-size);
      line-height: var(--mc-badge-line-height);
      font-weight: var(--mc-weight-medium);
      white-space: nowrap;
      vertical-align: middle;

      /* L3 组件令牌：默认引用 L2 语义令牌。按实例覆盖写在宿主 style 上 */
      --mc-badge-gap: var(--mc-space-1);
      --mc-badge-pad-x: var(--mc-space-2);
      --mc-badge-pad-y: 0;
      --mc-badge-font-size: var(--mc-text-xs);
      --mc-badge-line-height: var(--mc-text-xs-lh);
      --mc-badge-dot-size: 6px;

      /* 色槽：fill / on-fill 是实心那套，accent 是文字与描边，subtle-fill 是浅底 */
      --mc-badge-fill: var(--mc-color-primary);
      --mc-badge-on-fill: var(--mc-color-primary-fg);
      --mc-badge-accent: var(--mc-color-primary);
      --mc-badge-subtle-fill: var(--mc-color-primary-subtle);

      /* subtle 是默认外观，直接写在 :host 上（:host(:not([variant])) 会静默失效，P14） */
      background-color: rgb(var(--mc-badge-subtle-fill));
      color: rgb(var(--mc-badge-accent));
    }

    /* 2. 维度一 color：只往色槽里填值 */
    :host([color='danger']) {
      --mc-badge-fill: var(--mc-color-danger);
      --mc-badge-on-fill: var(--mc-color-danger-fg);
      --mc-badge-accent: var(--mc-color-danger);
      --mc-badge-subtle-fill: var(--mc-color-danger-subtle);
    }
    :host([color='success']) {
      --mc-badge-fill: var(--mc-color-success);
      --mc-badge-on-fill: var(--mc-color-success-fg);
      --mc-badge-accent: var(--mc-color-success);
      --mc-badge-subtle-fill: var(--mc-color-success-subtle);
    }

    /* 3. 维度二 variant：只换用哪一套色槽 */
    :host([variant='solid']) {
      background-color: rgb(var(--mc-badge-fill));
      color: rgb(var(--mc-badge-on-fill));
    }
    :host([variant='outline']) {
      background-color: transparent;
      border-color: rgb(var(--mc-badge-accent));
      color: rgb(var(--mc-badge-accent));
    }

    /* 4. 维度三 size */
    :host([size='sm']) {
      --mc-badge-pad-x: var(--mc-space-1);
      --mc-badge-font-size: 10px;
    }

    /* 5. dot：只显示一个圆点 —— 内容常驻 DOM，靠 CSS 收起（P10：不用 o-if） */
    .mc-dot {
      display: none;
      width: var(--mc-badge-dot-size);
      height: var(--mc-badge-dot-size);
      border-radius: 9999px;
      background-color: currentColor;
    }
    :host([dot]) .mc-dot {
      display: block;
    }
    :host([dot]) .mc-text {
      display: none;
    }
  </style>

  <span class="mc-dot"></span>
  <span class="mc-text"><slot></slot></span>

  <script>
    export default () => ({
      tag: 'mc-badge',
      attrs: {
        // 布尔属性默认值写 null，不是 false（P1）
        dot: null,
        color: 'primary',
        variant: 'subtle',
        size: 'md',
      },
    });
  </script>
</template>
```

**怎么知道做对了**：先别急着看页面 —— 第 4 步挂进导航后才看得到，继续。

---

## 第 2 步 · 接口写进 `api.md`

建 `packages/badge/api.md`。它是接口事实的**唯一手写源**，会被 `<doc-spec>` 渲染进文档页，
所以只有白名单七节会显示：`属性` / `方法` / `事件` / `配置` / `插槽与 part` / `插槽` / `part`。

````markdown
# mc-badge

> 共用约定（四个正交维度、值读写、事件、插槽 / part 命名）与组件索引见 [`README.md`](../../agent/api/README.md)；踩坑见 [`../pitfalls/`](../../agent/pitfalls/README.md)。
> 源码 `packages/badge/badge.html` · M1 · **已实现**

```html
<mc-badge>新</mc-badge>
<mc-badge color="danger" variant="solid">3</mc-badge>
<mc-badge dot color="success"></mc-badge>
```

---

## 属性

| 名称      | 值                           | 默认      | 说明                                |
| --------- | ---------------------------- | --------- | ----------------------------------- |
| `color`   | `primary` `success` `danger` | `primary` | 语义色                              |
| `variant` | `solid` `subtle` `outline`   | `subtle`  | 徽标默认用浅底，比 solid 更不抢视线 |
| `size`    | `sm` `md`                    | `md`      | 徽标只有两档                        |
| `dot`     | 布尔                         | —         | 只显示一个圆点，不显示内容          |

## 插槽

| 名称     | 说明     |
| -------- | -------- |
| （默认） | 徽标内容 |
````

⚠️ **只写已经实现的东西。** `max` 还没做，就不要写进这张表 ——
`pnpm check:docs` 会拿它和组件代码对账，文档写了代码没有，当场红。
这就是「单一源 + 守卫」的意思：**文档不能超前于代码**。

---

## 第 3 步 · 文档页

建 `packages/badge/page.html`。骨架是固定的，照抄 `packages/button/page.html` 改名字即可：

```html
<template page>
  <link rel="stylesheet" href="../../docs/content.css" />
  <div class="doc-body">
    <l-m src="./badge.html"></l-m>
    <l-m src="./demos/basic.html"></l-m>

    <doc-crumb></doc-crumb>
    <h1>Badge <code>mc-badge</code></h1>
    <p class="doc-lead">挂在别的元素上的徽标。语义色 × 外观 × 尺寸三个正交维度。</p>
    <h2>例子</h2>

    <section class="doc-demo">
      <h3>基本用法</h3>
      <demo-badge-basic></demo-badge-basic>
      <mc-collapse class="doc-demo-code">
        <mc-collapse-item header="查看代码"
          ><mc-code language="html" src="./demos/basic.html"></mc-code
        ></mc-collapse-item>
      </mc-collapse>
    </section>

    <!-- 参考区由 api.md 渲染，别在这里手抄表格（有守卫盯着） -->
    <doc-spec src="./api.md"></doc-spec>

    <doc-pager></doc-pager>
  </div>
  <script>
    export const parent = '../../docs/doc-layout.html';
    export default () => ({ data: {} });
  </script>
</template>
```

---

## 第 4 步 · 挂进导航

在 `docs/site-map.js` 的 SITE 树里加一条（左栏菜单 / 总览 / 首页卡片 / 面包屑翻页**都会自动带上**）：

```js
{
  order: 10,
  label: 'Badge',
  zh: '徽标',
  path: 'packages/badge/page.html',
  tagName: 'mc-badge',
  stage: 'M1',
  summary: '挂在别的元素上的徽标。语义色 × 外观 × 尺寸三个正交维度。',
}
```

**怎么知道做对了**：打开 `http://127.0.0.1:8642/index.html#/packages/badge/page.html` ——
能看到 h1「Badge mc-badge」、一个演示、和渲染出来的属性表。看不到就先看控制台报什么。

---

## 第 5 步 · 演示

建 `packages/badge/demos/basic.html`。**一个演示一个文件**，页面上的活样例和「查看代码」
里显示的是同一份（冒烟测试会拉下来逐字比对，抄第二遍就会红）：

```html
<template component>
  <div class="flex flex-wrap items-center gap-3">
    <mc-badge>新</mc-badge>
    <mc-badge color="danger" variant="solid">3</mc-badge>
    <mc-badge dot color="success"></mc-badge>
    <mc-badge size="sm">小号</mc-badge>
  </div>

  <script>
    export default async () => ({ tag: 'demo-badge-basic' });
  </script>
</template>
```

---

## 第 6 步 · 生成 README

```bash
node tools/gen-unit-readme.mjs
```

它会给 `packages/badge/README.md` 生成状态 / 标签 / 文件清单（都从仓库事实推），
并播下一段手写区种子。然后**自己补两节**（脚本不会替你写）：

- `## 设计取舍` —— 为什么这么定、和谁分工、踩过什么坑
- `## 令牌` —— `--mc-badge-*` 那张表

⚠️ README **不许出现** `属性` / `事件` / `插槽` / `part` 这类**节标题**（那是 api.md 的地盘），
守卫 `unit-readme` 会拦。令牌那节是例外 —— 它不进文档页，放这里。

---

## 第 7 步 · 写自己的冒烟测试

建 `packages/badge/test/badge.test.mjs`：

```js
/** mc-badge：三个维度 + dot；跑法 node tests/smoke.mjs badge */

export default async function run({ page, visit, check }) {
  await visit(page, '/index.html?badge=1#/packages/badge/page.html');
  await page
    .waitForFunction(() => !!customElements.get('mc-badge'), { timeout: 8000 })
    .catch(() => {});

  const got = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'badge-probe';
    host.innerHTML =
      '<mc-badge id="b-default">新</mc-badge>' +
      '<mc-badge id="b-solid" color="danger" variant="solid">3</mc-badge>' +
      '<mc-badge id="b-dot" dot color="success">9</mc-badge>';
    document.body.append(host);
    const read = (id) => {
      const el = document.getElementById(id);
      const cs = getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        text: el.shadowRoot.querySelector('.mc-text').offsetParent !== null,
        dot: el.shadowRoot.querySelector('.mc-dot').offsetParent !== null,
      };
    };
    const out = {
      def: read('b-default'),
      solid: read('b-solid'),
      dot: read('b-dot'),
    };
    host.remove();
    return out;
  });

  check(
    '默认外观是浅底（subtle），不是实心',
    got.def.bg !== 'rgb(0, 0, 0)',
    JSON.stringify(got.def),
  );
  check('variant=solid 换成了实心那套色槽', got.solid.bg !== got.def.bg, JSON.stringify(got.solid));
  check('dot 收起文字、显示圆点', !got.dot.text && got.dot.dot, JSON.stringify(got.dot));
}
```

**怎么知道做对了**：`node tests/smoke.mjs badge` 三条全绿。

---

## 第 8 步 · 验收

```bash
pnpm check:docs             # 期望：16 组全绿（组数不变，但每个面都会多判 badge 这个单元）
node tests/smoke.mjs badge  # 期望：全绿
```

然后照 [`checklist.md`](./checklist.md) 过一遍交付清单 —— 尤其这几条最容易漏：

- 组件本体头注释 ≤ 6 行（长了 `unit-readme` 守卫会红，多余的设计说明归 README）
- 颜色**全部走令牌**，模板 class 里没有 `text-red-500` 这类颜色工具类
- 亮色 + 暗色都肉眼过一遍
- 单元六件套齐全

---

## 做完之后

把 [`api/badge.md`](./api/badge.md) 那份草案删掉（内容已经搬进 `packages/badge/api.md`），
并在 `agent/api/README.md` 的索引里更新状态。

**还想往下做**：`max`（数值超过显示 `99+`）——
难点在于内容来自**插槽**，要读 `this.ele.textContent` 判断再改写显示，
而插槽内容变化不会自动通知组件（要自己观察，见踩坑清单的 `P1` / `P3` 一族）。
做完记得**同步补进 `api.md` 的属性表**，否则对账会红。

**下次再做新组件**：这一课的步骤就是全部。真正常忘的是第 2 步（先写 api.md）和
第 6 步（生成 README）—— 漏了它们，`pnpm check:docs` 会当场告诉你。
