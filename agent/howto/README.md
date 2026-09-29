# howto/ —— 食谱（怎么把一件事做完）

这里放**目标导向的食谱**：你已经知道规矩了，只想把这件事做完，照着走就行。

规矩不在这里 —— 命名、分区、哪些坑属于「参考」，在 [`../authoring.md`](../authoring.md) /
[`../authoring-style.md`](../authoring-style.md) / [`../doc-pages.md`](../doc-pages.md) /
[`../design-tokens.md`](../design-tokens.md)。为什么这么定属于「解释」，在各单元 README 的
「设计取舍」与 [`../plan/decisions.md`](../plan/decisions.md)。

第一次做组件走 [`../tutorial.md`](../tutorial.md)（教程，保证能成）；
做完了要改，回来这里。

| 我要做什么                             | 食谱                                     |
| -------------------------------------- | ---------------------------------------- |
| **改了接口，要同步哪些地方**（最高频） | [`change-api.md`](./change-api.md)       |
| 给已有组件加一个属性                   | [`add-attribute.md`](./add-attribute.md) |
| 给组件加一个演示                       | [`add-demo.md`](./add-demo.md)           |
| 给组件加一个令牌                       | [`add-token.md`](./add-token.md)         |
| 给应用（站点 / 后台）统一换主题色      | [`theme.md`](./theme.md)                 |
| 提交前自检                             | [`../checklist.md`](../checklist.md)     |

**写新食谱的三条**：

1. 只写**步骤与验证**，不写规矩（规矩在参考文档里，抄过来就是第二份会漂移的副本）
2. 每份都要有「怎么知道自己做对了」—— 一条能跑的命令
3. 结尾列「这一步最容易踩的」，并**链接到踩坑清单的具体条目**，不在这里复述现象
