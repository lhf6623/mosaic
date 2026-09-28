# 怎么给组件加一个演示

> **这是食谱**：演示区的规范（四段结构、取词规则）在 [`../doc-pages.md`](../doc-pages.md)，
> 这里只讲「加一个演示」要动的三个地方。

例子：给 `mc-tag` 加一个「尺寸」演示。

---

## 步骤

**1. 建 `packages/tag/demos/sizes.html`** —— 一个演示一个文件：

```html
<template component>
  <div class="flex flex-wrap items-center gap-3">
    <mc-tag size="sm">小号</mc-tag>
    <mc-tag>默认</mc-tag>
  </div>

  <script>
    export default async () => ({ tag: 'demo-tag-sizes' });
  </script>
</template>
```

标签名必须是 `demo-<slug>-<name>`，全仓库不重复（05 号套件盯着）。

**2. 在 `page.html` 顶部引入**

```html
<l-m src="./demos/sizes.html"></l-m>
```

**3. 在 `page.html` 的演示区加一段**（四段：标题 → 说明（可选）→ 组件 → 代码）

```html
<section class="doc-demo">
  <h3>尺寸</h3>
  <demo-tag-sizes></demo-tag-sizes>
  <mc-collapse class="doc-demo-code">
    <mc-collapse-item header="查看代码"
      ><mc-code language="html" src="./demos/sizes.html"></mc-code
    ></mc-collapse-item>
  </mc-collapse>
</section>
```

⚠️ `<mc-code src>` 和上面的 `<l-m src>` 指向**同一个文件** ——
活样例和「查看代码」里显示的是同一份源码，冒烟测试会拉下来逐字比对。
抄第二遍（哪怕只差一个空格）就会红。

---

## 验证

```bash
node tests/smoke.mjs --site  # 05 号套件：演示区段落顺序 + 代码面板内容 == 文件原文
```

页面上看：演示能渲染、点「查看代码」能看到那个文件的原文。

---

## 这一步最容易踩的

- **一个演示一个文件，不复用** —— 05 号套件会拦「同一个 src 出现两次」
- **抽屉里的代码是收起的** —— `mc-collapse` 收起时尺寸是 0，写位置断言前先点开
- **`h3` 只写中文名**（尽量短），说明只在「看一眼看不出来」时才写（取词规则见 doc-pages.md）
