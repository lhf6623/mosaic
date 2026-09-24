/**
 * 站点 · 组件文档页（第 11 / 11.3 节）：文档跟着组件走、每个演示都能点开看代码
 */
import { READY, slugOf } from '../../docs/site-map.js';

export default async function run({ page, visit, check, newPage }) {
/* ------------------------------------------------------------------ *
 * 11. 文档跟着组件走 —— 组件的文档页就在它自己的目录里
 * ------------------------------------------------------------------ */

const colocated = await (async () => {
  const p = await newPage();
  const bad = [];
  for (const c of READY) {
    // 必须经由路由打开（page.html 是 <template page>，当独立网页打开会渲染成空白）；
    // query 也必须有 —— 同文档 hash 跳转时 goto() 返回 null（不是 Response），断言会假失败
    const url = `/index.html?c=${slugOf(c)}#/${c.path}`;
    const failed = [];
    p.removeAllListeners('response');
    p.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    p.removeAllListeners('pageerror');
    p.on('pageerror', (e) => failed.push(String(e)));
    const res = await visit(p, url);
    // 页面自己的二级菜单渲染出来 = 站点共享脚本与 <doc-nav> 组件都跑起来了（条目在组件 shadow 里）
    const navOk = await p.evaluate(() => {
      return window.__inside('doc-nav', 'a').length > 3;
    });
    if (!res?.ok() || failed.length || !navOk) {
      bad.push(`${c.path} — ${res?.status()}${failed.length ? ' · ' + failed.join(', ') : ''}${navOk ? '' : ' · 二级菜单未渲染'}`);
    }
  }
  await p.close();
  return bad;
})();
check(
  `每个已实现组件的文档页都在它自己的目录里（${READY.length} 个）`,
  colocated.length === 0,
  colocated.join('\n        '),
);

/* ------------------------------------------------------------------ *
 * 11.3 演示区：例子是独立文件（demos/*.html），抽屉就是作者写的一行 mc-collapse + mc-code；
 * 所以要盯：例子来自 demos/、代码面板引用的就是同一个文件（渲染文本 == 文件原文）、每个演示都能点开
 * ------------------------------------------------------------------ */

const demoDrawer = await (async () => {
  const failed = [];
  const onResponse = (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  };
  const onError = (e) => failed.push(String(e));
  page.on('response', onResponse);
  page.on('pageerror', onError);

  /** 每个页面冷启动加载一次（加 query 才会真正重新加载，同文档 hash 跳转不算） */
  const visitDemoPage = async (slug) => {
    await visit(page, `/index.html?demo=${slug}#/packages/${slug}/page.html`);
    await page
      .waitForFunction(
        () => {
          const sections = window.__deepAll('section.doc-demo');
          const drawers = window.__deepAll('section.doc-demo > mc-collapse.doc-demo-code');
          return (
            sections.length > 0 &&
            sections.length === drawers.length &&
            drawers.every((d) => d.querySelector('mc-collapse-item mc-code[src]'))
          );
        },
        { timeout: 8000 },
      )
      .catch(() => {});
  };

  /** 读一页的演示区：例子组件（自己的 shadow root）+ 抽屉里那块 mc-code */
  const readDemos = () =>
    page.evaluate(() =>
      window.__deepAll('section.doc-demo').map((section) => {
        const host = [...section.children].find((el) => el.tagName.toLowerCase().startsWith('demo-'));
        const drawer = section.querySelector(':scope > mc-collapse.doc-demo-code');
        const item = drawer?.querySelector('mc-collapse-item');
        const code = item?.querySelector('mc-code');
        return {
          demoTag: host?.tagName.toLowerCase() ?? null,
          demoShadow: !!host?.shadowRoot,
          drawerExists: !!drawer,
          open: !!item?.open,
          label: item?.getAttribute('header') ?? null,
          src: code?.getAttribute('src') ?? null,
          rendered: code?.code ?? '',
        };
      }),
    );

  const pages = {};
  for (const c of READY) {
    const slug = slugOf(c);
    await visitDemoPage(slug);

    const demos = await readDemos();

    // 逐个点开（第一个走真实点击，其余直接点头部）
    await page
      .locator('section.doc-demo > mc-collapse.doc-demo-code mc-collapse-item .mc-header')
      .first()
      .click();
    await page.evaluate(() => {
      for (const item of window.__deepAll(
        'section.doc-demo > mc-collapse.doc-demo-code mc-collapse-item',
      )) {
        if (!item.open) item.shadowRoot.querySelector('.mc-header').click();
      }
    });
    await page.waitForTimeout(300);

    // 代码面板里的文本 == 它 src 指向的那个文件（同一份，不抄第二遍）
    const fileMatch = await page.evaluate(async () => {
      const codes = window.__deepAll(
        'section.doc-demo > mc-collapse.doc-demo-code mc-collapse-item mc-code',
      );
      const out = [];
      for (const code of codes) {
        const url = code.getAttribute('src');
        const text = await (await fetch(url)).text();
        out.push({ url, same: code.code.trim() === text.trim() });
      }
      return out;
    });

    const opened = await readDemos();
    pages[slug] = { demos, opened, fileMatch };
  }

  page.off('response', onResponse);
  page.off('pageerror', onError);
  return { pages, failed };
})();

const drawerPages = Object.values(demoDrawer.pages);
const drawerTotal = drawerPages.reduce((n, x) => n + x.demos.length, 0);
const drawerSummary = Object.fromEntries(
  Object.entries(demoDrawer.pages).map(([slug, x]) => [slug, `${x.demos.length} 个演示`]),
);

check(
  `每个演示区 = 一个例子组件 + 一个「查看代码」抽屉（${READY.length} 页 / ${drawerTotal} 个演示）`,
  drawerPages.every(
    (x) => x.demos.length > 0 && x.demos.every((d) => d.demoTag && d.demoShadow && d.drawerExists),
  ),
  JSON.stringify(drawerSummary),
);

check(
  '抽屉就是项目自己的折叠面板（mc-collapse + mc-collapse-item + mc-code）',
  drawerPages.every((x) =>
    x.demos.every((d) => d.drawerExists && d.label === '查看代码'),
  ),
  JSON.stringify(drawerPages[0]?.demos.slice(0, 1)),
);

check(
  '例子来自 demos/ 里独立的组件文件，一个演示一个文件（不重复用）',
  Object.entries(demoDrawer.pages).every(([slug, x]) => {
    const srcs = x.demos.map((d) => d.src ?? '');
    return (
      srcs.every((src) => src.includes(`/packages/${slug}/demos/`)) &&
      new Set(srcs).size === srcs.length &&
      new Set(x.demos.map((d) => d.demoTag)).size === x.demos.length
    );
  }),
  JSON.stringify(drawerPages[0]?.demos.map((d) => d.src?.split('/').pop())),
);

check(
  '代码面板里的代码就是那个文件的原文（渲染文本 == 文件内容，逐字相同）',
  drawerPages.every((x) => x.fileMatch.length === x.demos.length && x.fileMatch.every((f) => f.same)),
  JSON.stringify(
    drawerPages
      .flatMap((x) => x.fileMatch)
      .slice(0, 3)
      .map((f) => `${f.url.split('/').pop()}=${f.same}`),
  ),
);

check(
  '点开后每个抽屉都展开且有内容',
  drawerPages.every((x) => x.opened.every((d) => d.open && d.rendered.trim())),
  JSON.stringify(drawerPages[0]?.opened.map((d) => ({ open: d.open, 字符: d.rendered.length }))),
);

/* 演示的代码里必须出现它在演示的标签 —— 期望值从登记表来，加组件不用改这里 */
const tagHits = Object.entries(demoDrawer.pages).map(([slug, x]) => {
  const tag = READY.find((c) => slugOf(c) === slug)?.tagName ?? '';
  return {
    slug,
    tag,
    hit: x.opened.filter((d) => d.rendered.includes(`<${tag}`)).length,
    total: x.opened.length,
  };
});

check(
  `每个演示的代码都提到它在演示的标签（${tagHits.length} 页 / ${drawerTotal} 个演示）`,
  tagHits.every((h) => h.tag && h.total > 0 && h.hit === h.total),
  tagHits.map((h) => `${h.slug} <${h.tag}> ${h.hit}/${h.total}`).join(' · '),
);

check(
  '演示文件里是作者写的原样标记，没有 ofa 反射出来的默认属性',
  demoDrawer.pages.button.opened.some((d) =>
    d.rendered.includes('<mc-button color="primary">主要</mc-button>'),
  ) &&
    !demoDrawer.pages.button.opened.some(
      (d) => d.rendered.includes('variant="filled"') || d.rendered.includes('type="button"'),
    ),
  demoDrawer.pages.button.opened[0]?.rendered.split('\n')[1] ?? '（Button 第一个例子为空）',
);

check(
  '打开演示页与代码面板没有 404 / 运行时报错',
  demoDrawer.failed.length === 0,
  demoDrawer.failed.join(' | ') || '无',
);
}
