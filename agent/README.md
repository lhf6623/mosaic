# agent/ 导航：什么时候读哪一份

这里是**规范与踩坑记录**，不是给人从头读的。新会话按任务挑 1～2 份，其余别读 ——
全量六千多行，读完也记不住，还会把上下文挤掉。

| 我要做什么                                           | 读这份                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| 改文档站外壳 / 顶栏 / 主题 / 两栏定位 / 滚动         | [`doc-site.md`](./doc-site.md)                                   |
| 写或改组件文档页（骨架、演示区四段、表格口径）       | [`doc-pages.md`](./doc-pages.md)                                 |
| 造新组件（命名、职责、四维正交、ofa 骨架）           | [`authoring.md`](./authoring.md)                                 |
| 写组件的 `<style>` / 事件 / 插槽与定制点             | [`authoring-style.md`](./authoring-style.md)                     |
| 提交前自检、尺寸与无障碍基线                         | [`checklist.md`](./checklist.md)                                 |
| 查某个组件的接口（属性 / 事件 / 插槽与 part / 令牌） | [组件 API 规范](api/README.md) §`mc-xxx`                         |
| 写组件前扫一遍「静默失效」的坑                       | [踩坑清单](pitfalls/README.md)（40 条，按主题分节）              |
| 改配色 / 加令牌 / 换肤                               | [`design-tokens.md`](./design-tokens.md)                         |
| 选间距 / 排版 / 动效 / 层级 / 文案                   | [`design-spec.md`](./design-spec.md)                             |
| 项目定位、关键决策、里程碑、风险                     | [`plan/`](./plan/README.md)（定位 / 决策 / 目录与构建 / 里程碑） |

**默认不用读的**（除非明确要考古）：

- [`docs-refactor.md`](./docs-refactor.md) —— 已完成的一次文档站重构记录，留着是给将来的大改做参照；
- [`research/`](./research/) —— 外部资料的抓取原文（unocss / jsdelivr / ofa 状态）。

## 分工约定

- `agent/` 只放**规范**：怎么造、怎么写、踩过什么坑；
- **实现说明**写在组件文件头（`packages/<name>/*.html` 顶部的注释块）；
- **页面上的用法**写在文档页自己（`packages/<name>/page.html`）；
- 组件清单与逐组件接口的**唯一真相源**是 [组件 API 规范](api/README.md)，
  改了组件 API 先改它，再改文档页。

## 现在长什么样

```
agent/
├── README.md            ← 这份：先读它挑模块
├── doc-site.md          文档站外壳（布局 / 顶栏 / 滚动）
├── doc-pages.md         文档页规范（骨架 / 演示区 / 参考区）
├── authoring.md         造组件（命名 / 职责 / 四维 / ofa 骨架）
├── authoring-style.md   <style> 五分区 / 事件 / 插槽与 part
├── checklist.md         尺寸与无障碍基线 / 交付检查
├── design-spec.md       间距 / 排版 / 动效 / 层级
├── design-tokens.md     令牌体系 / 换色 / 换肤
├── api/                 组件 API 规范（README = 共用约定 + 索引，逐组件一个文件）
├── pitfalls/            ofa.js 踩坑清单（README = 40 条索引，按主题分文件）
├── plan/                规划总纲（定位 / 决策 / 目录与构建 / 里程碑）
├── docs-refactor.md     已完成的重构记录（考古用，默认不读）
└── research/            外部资料抓取原文（默认不读）
```

单份最大 ~290 行（`plan/decisions.md`、`api/README.md`），按任务挑一份就够。
