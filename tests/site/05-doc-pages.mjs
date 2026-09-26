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
  const crumbBad = [];
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
    // 面包屑与组件都会稍晚一拍挂上（<l-m> 异步注册组件），等升级 + 当前项都就位再断言
    await p
      .waitForFunction(
        () => {
          const bar = window.__deep('doc-crumb')?.shadowRoot?.querySelector('mc-breadcrumb');
          const items = bar ? [...bar.querySelectorAll('mc-breadcrumb-item')] : [];
          return (
            !!bar?.shadowRoot &&
            items.length >= 2 &&
            items.every((i) => !!i.shadowRoot) &&
            items.at(-1).getAttribute('aria-current') === 'page'
          );
        },
        undefined,
        { timeout: 5000 },
      )
      .catch(() => {});
    // 页面自己的二级菜单渲染出来 = 站点共享脚本与 <doc-nav> 组件都跑起来了（条目在组件 shadow 里）
    const ok = await p.evaluate(() => {
      const navOk = window.__inside('doc-nav', 'a').length > 3;
      // 页面头部的面包屑必须是项目自己的 <mc-breadcrumb>（<doc-crumb> 只负责派生）：
      // 至少两级（分区 + 本页），最后一级是当前页（aria-current="page" 且不是空文本）。
      // ⚠️ <doc-crumb> 现在是 ofa 组件模板、自带 shadow root，要经 shadowRoot 查里面的 mc-breadcrumb
      const bar = window.__deep('doc-crumb')?.shadowRoot?.querySelector('mc-breadcrumb');
      const items = bar ? [...bar.querySelectorAll('mc-breadcrumb-item')] : [];
      const last = items.at(-1);
      const crumbOk =
        !!bar &&
        items.length >= 2 &&
        last.getAttribute('aria-current') === 'page' &&
        !!last.textContent.trim();
      return { navOk, crumbOk };
    });
    if (!res?.ok() || failed.length || !ok.navOk) {
      bad.push(
        `${c.path} — ${res?.status()}${failed.length ? ' · ' + failed.join(', ') : ''}${ok.navOk ? '' : ' · 二级菜单未渲染'}`,
      );
    }
    if (!ok.crumbOk) crumbBad.push(c.path);
  }
  await p.close();
  return { bad, crumbBad };
})();
check(
  `每个已实现组件的文档页都在它自己的目录里（${READY.length} 个）`,
  colocated.bad.length === 0,
  colocated.bad.join('\n        '),
);
check(
  `每个组件页头部的面包屑都由 <mc-breadcrumb> 渲染（两级 + 当前项）`,
  colocated.crumbBad.length === 0,
  colocated.crumbBad.join('\n        ') || `${READY.length} 页全通过`,
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
        const host = [...section.children].find((el) =>
          el.tagName.toLowerCase().startsWith('demo-'),
        );
        const drawer = section.querySelector(':scope > mc-collapse.doc-demo-code');
        const item = drawer?.querySelector('mc-collapse-item');
        const code = item?.querySelector('mc-code');
        return {
          demoTag: host?.tagName.toLowerCase() ?? null,
          demoShadow: !!host?.shadowRoot,
          /* 活样例里**已升级**的项目组件数：例子组件自己起得来，不代表它内部那些 mc-* 也注册上了
             —— 组件模块加载失败（比如被 Live Server 注入抢走第一个 script）时，标签还在、
             shadow root 却是空的，只数「有 shadow root 的例子组件」看不出来。 */
          demoLive: host?.shadowRoot
            ? [...host.shadowRoot.querySelectorAll('*')].filter(
                (el) => el.tagName.toLowerCase().startsWith('mc-') && !!el.shadowRoot,
              ).length
            : 0,
          drawerExists: !!drawer,
          open: !!item?.open,
          label: item?.getAttribute('header') ?? null,
          src: code?.getAttribute('src') ?? null,
          rendered: code?.code ?? '',
          // 四段结构的顺序指纹：标题 → 说明 → 组件 → 代码（下面那条断言用它）
          parts: [...section.children].map((el) => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'h3') return 'h3';
            if (el.classList.contains('doc-hint')) return 'hint';
            if (tag.startsWith('demo-')) return 'demo';
            if (el.classList.contains('doc-demo-code')) return 'code';
            return tag;
          }),
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

/* 活样例必须**真的渲染出组件**：每个演示文件里都至少有一个项目组件（见 demos/*.html），
   所以「已升级的 mc-* 数」为 0 就意味着组件模块没加载起来 —— 页面照样能过前一条断言
   （例子组件自己有 shadow root），但读者看到的是空白。 */
const deadDemos = Object.entries(demoDrawer.pages).flatMap(([slug, x]) =>
  x.demos.filter((d) => !(d.demoLive > 0)).map((d) => `${slug}: ${d.demoTag}`),
);

check(
  '每个演示的活样例都渲染出了组件（≥1 个已升级的 mc-*，空演示拦在这里）',
  drawerPages.every((x) => x.demos.every((d) => d.demoLive > 0)),
  deadDemos.length ? deadDemos.join(' · ') : `${drawerTotal} 个演示全部有内容`,
);

/* 演示区的段落顺序（标题 → 说明（可选）→ 组件 → 代码）：**7 页全部迁完**，所以这里盯所有页。
   顺序指纹见 readDemos()；与旧版的关键差别是**说明必须在组件之前**（旧版把它当脚注挂在框尾），
   而说明本身是可选段 —— 一眼就明白的例子不必写导语。 */
const DEMO_PART_ORDERS = new Set(['h3|demo|code', 'h3|hint|demo|code']);
const badParts = Object.entries(demoDrawer.pages).flatMap(([slug, x]) =>
  x.demos
    .filter((d) => !DEMO_PART_ORDERS.has(d.parts.join('|')))
    .map((d) => `${slug}: ${d.parts.join('|')}`),
);

check(
  '演示区段落顺序：标题 →（可选）说明 → 组件 → 代码（7 页全部）',
  drawerPages.every((x) => x.demos.length > 0) && badParts.length === 0,
  badParts.length
    ? badParts.join(' · ')
    : `${drawerPages.length} 页 / ${drawerTotal} 个演示全部符合；带导语的 ${drawerPages.reduce(
        (n, x) => n + x.demos.filter((d) => d.parts.includes('hint')).length,
        0,
      )} 个`,
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
