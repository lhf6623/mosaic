// 生成物，勿手改：node mosaic-admin/tools/page-registry.mjs
// 页面清单的唯一手写源是 pages/**/*.html 第一行的 <!-- page: {...} --> 元信息；
// check:app 会重生成并逐字节对账 —— 注册表过期直接失败。

export const PAGES = [
  {
    "file": "pages/login.html",
    "label": "登录",
    "group": "概览",
    "order": 5,
    "hidden": true
  },
  {
    "file": "pages/home.html",
    "label": "工作台",
    "group": "概览",
    "order": 10,
    "hidden": false
  },
  {
    "file": "pages/system/user/list.html",
    "label": "用户列表",
    "group": "系统",
    "order": 20,
    "hidden": false
  },
  {
    "file": "pages/import-order/list.html",
    "label": "委托单列表",
    "group": "委托",
    "order": 30,
    "hidden": false
  }
];

export const MENU = [
  {
    "key": "group:概览",
    "type": "group",
    "label": "概览",
    "children": [
      {
        "key": "pages/home.html",
        "label": "工作台",
        "href": "#/pages/home.html"
      }
    ]
  },
  {
    "key": "group:系统",
    "type": "group",
    "label": "系统",
    "children": [
      {
        "key": "pages/system/user/list.html",
        "label": "用户列表",
        "href": "#/pages/system/user/list.html"
      }
    ]
  },
  {
    "key": "group:委托",
    "type": "group",
    "label": "委托",
    "children": [
      {
        "key": "pages/import-order/list.html",
        "label": "委托单列表",
        "href": "#/pages/import-order/list.html"
      }
    ]
  }
];
