# 组件验收：清单、尺寸与无障碍基线、交付检查

组件写完 / 改完对照这里过一遍。尺寸与无障碍是**基线**（每个组件都要满足），
最后一节是逐项交付检查清单。

> **读这份的场合**：提交组件前自检、给新组件写套件、评审别人的组件。

---

## 一、组件清单

**组件清单和各自的 API 定义在 [组件 API 规范](api/README.md)，本文不重复。**
那里是唯一真相源；改了组件 API 请改那一份。

里程碑分批：

| 批次   | 内容                                                                                                                                                | 备注                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **M1** | `mc-button`（已实现）/ `mc-code`（已实现）/ `mc-collapse`（已实现）/ `mc-card`（已实现）/ `mc-tag`（已实现）/ `mc-icon` / `mc-badge` / `mc-spinner` | 产出可发布的 0.1.0                                                           |
| **M2** | 表单与反馈 9 个                                                                                                                                     | 会大量撞上 [P6](pitfalls/01-props.md) / [P18–P20](pitfalls/04-dom-events.md) |
| **M3** | 浮层与布局 6 个                                                                                                                                     | 开工前必须先验证图层问题（见下）                                             |

> ⚠️ **M3 开头必须先验证图层问题**：宿主页面上的 `transform` / `filter` / `contain`
> 会创建新的层叠上下文，可能把 shadow root 里的 `position: fixed` 困住。
> 验证后再决定继续用 `position: fixed`、改用 popover API，还是挂载到 `document.body`。
> 详见 [`design-spec.md` 第七节](./design-spec.md#七层级)。

---

---

## 二、尺寸与无障碍基线

### 尺寸

| 尺寸         | 控件高                        | 内边距         | 字号             |
| ------------ | ----------------------------- | -------------- | ---------------- |
| `sm`         | `--mc-control-h-sm` (1.75rem) | `--mc-space-3` | `--mc-text-xs`   |
| `md`（默认） | `--mc-control-h-md` (2.25rem) | `--mc-space-4` | `--mc-text-sm`   |
| `lg`         | `--mc-control-h-lg` (2.75rem) | `--mc-space-5` | `--mc-text-base` |

所有组件的 `size` 都必须只支持这三个值（`sm` / `md` / `lg`），
新增尺寸要先加 `--mc-control-h-*` 令牌，**不允许在组件里写死像素值**。

### 无障碍

| 要求     | 落地                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------ |
| 键盘可达 | 可交互元素必须是原生 `<button>` / `<input>` / `<a>`，不要用 `<div on:click>`                           |
| 焦点可见 | 必须有焦点样式。统一用 `focus-visible:ring-2 ring-ring`                                                |
| 对比度   | 令牌层已保证（见 [design-tokens.md](./design-tokens.md#四对比度自检)），组件**不得绕过令牌直接写颜色** |
| 禁用态   | 用 `disabled` 属性而非仅 `opacity`，保证屏幕阅读器可感知                                               |
| 动效     | 尊重 `prefers-reduced-motion`，已在 `shadow-base.css` 里统一把 `--mc-duration-*` 压到 1ms              |
| 图标按钮 | 必须有 `aria-label`；纯装饰 SVG 加 `aria-hidden="true"`                                                |

---

---

## 三、写新组件的交付检查清单

> 「ofa.js 正确性」这一节的每一条都对应 [踩坑清单](pitfalls/README.md) 里的一个坑，
> 踩中的代价是**静默失效**（不报错、表象像"没生效"），所以不要跳。

```
目录与命名
[ ] packages/{name}/{name}.html 组件本体 + page.html 文档页
[ ] 文档页以 <template page> 开头，并 <link> 了 ../../docs/content.css
[ ] 每个演示一个 demos/*.html（ofa 组件），页面里是标签 + 一行 mc-collapse 抽屉
[ ] 组件自己的断言在 test/*.test.mjs，`node tests/smoke.mjs <name>` 能单飞
[ ] 文档页只写用法（属性表 / 演示 / 注意事项），实现说明留在组件文件头与 agent/
[ ] 注释只写「为什么」：不显然的取舍、坑的编号（P1…）、必须知道的前提；
      成段的原理 / 历史 / 与 agent/ 重复的长篇不抄进代码，需要就指一句过去
[ ] 文档页里的站点资产相对路径正确（../boot/...、../../docs/...）
[ ] 已在 docs/site-map.js 的树里加了一个节点（label / order / path / tagName / stage / summary），
      左栏菜单 / 总览 / 首页 / 面包屑翻页都会自动带上
[ ] 标签名 = mc- + 目录名，三方一致

结构
[ ] 用 <template component> 写，**不手写 class 扩展 HTMLElement**（站点级元素也一样；
      tests/site/11-no-class-components.mjs 会拦）
[ ] <style> 按五个分区顺序书写
[ ] 视觉定义在 :host 上，外部 style="height:32px" 能直接覆盖
[ ] 颜色全部走 L3 组件令牌，模板 class 里没有任何颜色工具类
[ ] 变体全部用 :host([attr]) 驱动，没有拼接类名
[ ] 每个组件至少暴露一个 part，或用 :host 直接可定制
[ ] 使用 ::slotted() 而不是 <inject-host>
[ ] P33 有插槽交互元素时，行盒子（尺寸/内边距/底色/颜色）写在宿主上，
      ::slotted() 只放祖先 shadow 树里没声明过的属性；插槽里 <a> 与 <button> 外观一致

ofa.js 正确性  ← 逐条对照 agent/pitfalls/
[ ] P1  布尔属性默认值写成 null，不是 false
[ ] P1  所有对外属性都进了 attrs（没声明就不是 observed attribute）
[ ] P2  转发给内部原生元素用 :disabled，不用 attr:disabled
[ ] P3  外部改状态走 setAttribute / removeAttribute
[ ] P5  watch 里跳过初始化时的首次触发
[ ] P8  {{...}} 只用在文本节点，属性一律用指令
[ ] P9  attr: 的值是 JS 表达式 —— 静态中文文案绝不能用 attr:
        （代价：抛 ReferenceError 并中断整个 render，表象像"绑定不生效"）
[ ] P10 运行时会切换的显隐用 :host([attr]) + 常驻 DOM，不用 o-if
[ ] P11 用了 o-fill 时内部只能写 $data / $index / $host
[ ] P13 模板里用了 <l-m> 就同时写 l-m { display: none }
[ ] P14 没有使用 :host(:not([attr]))
[ ] P17 动态插节点走 this.ele.shadowRoot.appendChild
[ ] P19 内部原生 change 事件已转发为 composed: true
[ ] P20 判断点击外部用了 composedPath()，不是 contains()
[ ] P21 内部透明交互层有 z-index，且宿主是 position: relative
[ ] detached() 里清理了所有定时器和全局监听
[ ] 含 data() 的样式单独放在一个 <style> 里
[ ] proto 方法名避开了 $.fn 上的通用名（get/set/text/html/data/watch/on/emit/class/style/remove/refresh/sync）
[ ] attrs 的键也不撞保留名（已知 wrap 会让 createElement 直接坏，见 P31）
[ ] ready() / 构造期没有往宿主元素写属性（style 也算），要写就写 shadow root 内部元素（P31）
[ ] P41 组件文件里没有 body / svg / head 的结束标签排在模块 <script> 之前
      （内联 svg 最自然就会踩：Live Server 往那儿注入，抢走 ofa 的第一个 script —— 07 / 05 号套件守着）

质量
[ ] 键盘可完成全部操作，焦点环可见且用的是 ring 令牌不是 currentColor（P16）
[ ] 亮色 + 暗色都肉眼过一遍
[ ] 禁用态用 :disabled 而非只有 opacity（屏幕阅读器可感知）
[ ] sr-only 文案齐全（图标按钮、纯图标状态）
[ ] 在"没有任何 reset 的脏宿主页面"里渲染正常（C3 约束）

工程
[ ] pnpm build 通过，产物体积没有异常增长
[ ] 新增的令牌已加进 tools/gen-tokens.mjs（如果涉及色板）
[ ] 新增的公共工具类已加进 uno.config.ts 的精选子集（如果使用者会用到）
[ ] pnpm dev 验收页确认无误（`tools/serve.mjs`，零依赖、`no-store`；不要用别的静态服务器，见 P24）
[ ] 测试只跑本次改动命中的范围：`pnpm test:changed`（选测中间层；加 / 挪了套件先 `pnpm test:record`），
      或按标签挑 `node tests/smoke.mjs <slug> / --site <关键词>`；全量只在收尾验收跑一次
      —— 中途重复全量既慢，又会掩盖「这次改动影响了什么」
```
