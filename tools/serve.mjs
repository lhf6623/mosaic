#!/usr/bin/env node
/**
 * mosaic — 本地静态服务器（零依赖）
 *
 * 替代 `npx http-server -c-1`：少一个依赖，而且缓存策略由我们完全控制。
 *
 * ⚠️ 为什么必须禁缓存：改完 page.html 或 mosaic.js 之后，如果浏览器继续用旧模块，
 * 表象是「改了没生效」或诡异报错，排查极耗时。这是 ofa.js 社区记录在案的坑。
 *
 * 用法：node tools/serve.mjs [--port 8642] [--inject]
 *
 *   --inject  模拟 VS Code Live Server 的 HTML 注入（见下方）。给冒烟测试用：
 *             页面模块一旦被注入的脚本抢走「第一个 <script>」就会加载失败，
 *             这条路径必须被测到，否则很容易在改动注释或模板结构时静默回归。
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const portArg = process.argv.indexOf('--port');
const PORT = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT || 8642);

/**
 * 模拟 Live Server 的注入。
 *
 * 规则照抄它的实现（live-server/index.js）：
 *   注入点依次找 </body> → </svg> → </head>，取响应里第一个命中的位置。
 *
 * 注意注入内容**自带一个 HTML 注释** —— 这不是凑数，正是它把目标文件的注释
 * 提前闭合、让注入的 script 变成真实元素的。漏掉这个细节就复现不出那个 bug。
 */
const INJECT = process.argv.includes('--inject');
const INJECTED =
  '<!-- Code injected by live-server -->\n' +
  '<script>\n' +
  "  console.log('Live reload enabled.');\n" +
  '</script>\n';

function injectLikeLiveServer(html) {
  const candidates = [/<\/body>/i, /<\/svg>/, /<\/head>/i];
  for (const re of candidates) {
    const m = re.exec(html);
    if (m) return html.slice(0, m.index) + INJECTED + html.slice(m.index);
  }
  return html; // 三个都没命中就不注入 —— 和 live-server 行为一致
}

/** 和 jsDelivr 的实际行为对齐：.html 以 text/plain 提供（ofa.js 用 fetch + 文本解析） */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  // 防目录穿越：解析成绝对路径后必须仍在 ROOT 之内
  const target = resolve(join(ROOT, normalize(pathname)));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      res.writeHead(302, { location: pathname + '/' }).end();
      return;
    }

    let body = await readFile(target);
    if (INJECT && extname(target).toLowerCase() === '.html') {
      body = injectLikeLiveServer(body.toString('utf8'));
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
      // 禁缓存。改完立刻生效，不用手动 hard reload
      'cache-control': 'no-store, must-revalidate',
      // 和 jsDelivr 一样允许跨域读取，方便本地复现 CDN 场景
      'access-control-allow-origin': '*',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`404 ${pathname}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Mosaic docs  →  http://127.0.0.1:${PORT}/\n`);
});
