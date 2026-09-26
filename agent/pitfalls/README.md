# ofa.js 踩坑清单：40 条静默失效的坑

全部坑都是**静默失效**：表象是「绑定不生效 / 点了没反应」，不报错、不抛异常，反查成本极高。
写组件**之前**扫一遍对应主题，比事后二分快得多。

| 主题                                     | 条目                                                                                                                                                                                                       | 文件                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 一、属性与响应式（最高频，先看这节）     | [P1](./01-props.md) [P2](./01-props.md) [P3](./01-props.md) [P4](./01-props.md) [P5](./01-props.md) [P6](./01-props.md) [P7](./01-props.md) [P31](./01-props.md) [P32](./01-props.md) [P39](./01-props.md) | [`01-props.md`](./01-props.md)               |
| 二、模板语法                             | [P8](./02-template.md) [P9](./02-template.md) [P10](./02-template.md) [P11](./02-template.md) [P12](./02-template.md) [P30](./02-template.md)                                                              | [`02-template.md`](./02-template.md)         |
| 三、样式作用域                           | [P13](./03-style-scope.md) [P14](./03-style-scope.md) [P15](./03-style-scope.md) [P16](./03-style-scope.md) [P33](./03-style-scope.md)                                                                     | [`03-style-scope.md`](./03-style-scope.md)   |
| 四、DOM 与事件                           | [P17](./04-dom-events.md) [P18](./04-dom-events.md) [P19](./04-dom-events.md) [P20](./04-dom-events.md) [P21](./04-dom-events.md) [P22](./04-dom-events.md) [P34](./04-dom-events.md)                      | [`04-dom-events.md`](./04-dom-events.md)     |
| 五、页面模块与静态服务器                 | [P26](./05-pages.md) [P27](./05-pages.md) [P40](./05-pages.md)                                                                                                                                             | [`05-pages.md`](./05-pages.md)               |
| 六、平台与环境                           | [P23](./06-platform.md) [P24](./06-platform.md) [P25](./06-platform.md)                                                                                                                                    | [`06-platform.md`](./06-platform.md)         |
| 七、布局页（嵌套页面/路由）              | [P28](./07-layout.md) [P29](./07-layout.md)                                                                                                                                                                | [`07-layout.md`](./07-layout.md)             |
| 八、状态管理（`$.stanz` / `o-provider`） | [P35](./08-state.md) [P36](./08-state.md) [P37](./08-state.md)                                                                                                                                             | [`08-state.md`](./08-state.md)               |
| 九、模板控制流与插槽                     | [P38](./09-control-flow.md)                                                                                                                                                                                | [`09-control-flow.md`](./09-control-flow.md) |
| 附：Mosaic 参考组件曾踩中的条目          | —                                                                                                                                                                                                          | [`10-appendix.md`](./10-appendix.md)         |

> **读这份的场合**：写组件前；遇到「改了没反应」时按主题翻。
> 逐条都记了现象、原因、正确写法；配套的组件实现说明在各自的组件文件头。
