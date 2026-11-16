# vendor/lib —— 第三方 UMD 副本

只放**没有 npm 引入渠道**、必须原样进仓的第三方 UMD 副本（echarts / dayjs / xlsx / crypto-js…），
每个文件在这里登记版本与来源，便于升级与对账（硬规则 7）。

| 文件               | 版本  | 来源                                                            | 引入它的页面                                                                |
| ------------------ | ----- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `crypto-js.min.js` | 4.1.1 | <https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js> | index.html（OAuth2 密码模式登录时加密密码；与旧仓 `crypto-js@^4.1.1` 对齐） |

> 只在 `index.html` 用经典 `<script>` 引入（UMD 挂 `window.CryptoJS`），不进页面 / 不 import。
