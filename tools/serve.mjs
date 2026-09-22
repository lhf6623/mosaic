#!/usr/bin/env node
/* mosaic — 本地静态服务器（零依赖）。必须禁缓存：浏览器用旧模块时表象是「改了没生效」，极难排查。
 * 用法：node tools/serve.mjs [--port 8642] [--prefix /mosaic] [--inject]
 * --prefix 复现 GitHub Pages 子路径；--inject 模拟 Live Server 注入（见下），给冒烟测试用。 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const portArg = process.argv.indexOf('--port');
const PORT = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT || 8642);

/* 部署前缀：GitHub Pages 项目页挂在 `/<repo>/` 下。`--prefix /mosaic` 用来在本地复现
 * 线上子路径行为 —— 站内链接、菜单高亮在两种前缀下都必须对得上。 */
const prefixArg = process.argv.indexOf('--prefix');
const PREFIX = (prefixArg > -1 ? process.argv[prefixArg + 1] : '').replace(/\/+$/, '');

/* 模拟 Live Server 注入（规则照抄 live-server/index.js）：注入点依次找 </body> → </svg> → </head>，
 * 取第一个命中处。注入内容自带 HTML 注释，会把目标文件的注释提前闭合 —— 少了它，注入的 script
 * 就会抢走页面模块的「第一个 <script>」而加载失败，正是冒烟测试要覆盖的那条路径。 */
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

  if (PREFIX && !pathname.startsWith(PREFIX)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`404 ${pathname}`);
    return;
  }
  if (PREFIX) {
    // 不带尾斜杠的入口重定向一次 —— 和 GitHub Pages 行为一致，相对路径才有正确基准
    if (pathname === PREFIX) {
      res.writeHead(302, { location: `${PREFIX}/` }).end();
      return;
    }
    pathname = pathname.slice(PREFIX.length) || '/';
  }
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
  console.log(`\n  Mosaic docs  →  http://127.0.0.1:${PORT}${PREFIX}/\n`);
});
