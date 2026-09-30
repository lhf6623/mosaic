/**
 * mc-scroll-area · 滚动容器：不溢出时「什么都没有」（无条子、无 tabindex / role，不占 tab 停靠点）、
 * 溢出时 a11y 三连 + 滑块比例与位置、原生滚动条被藏掉、条子是覆盖式（不占内容宽度）、
 * scroll 事件从宿主冒泡、拖滑块真的能滚、内容变高滑块跟着变短、axis="x" 横向
 */

export default async function run({ page, visit, check }) {
  const area = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?scroll-area=1#/packages/scroll-area/page.html');
    await page
      .waitForFunction(() => !!customElements.get('mc-scroll-area'), { timeout: 8000 })
      .catch(() => {});

    /* 探针：一条不溢出的、一条溢出 3 倍的、一条横向的。都放进一个固定定位的盒子里量尺寸 */
    await page.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'sa-probe';
      box.style.cssText = 'position:fixed;left:0;top:0;width:300px;z-index:1200';
      box.innerHTML =
        '<mc-scroll-area id="sa-fit" label="装得下" style="height:60px">' +
        '<div style="height:40px">a</div></mc-scroll-area>' +
        '<mc-scroll-area id="sa-over" label="装不下" style="height:100px">' +
        '<div id="sa-content" style="height:400px">b</div></mc-scroll-area>' +
        '<mc-scroll-area id="sa-x" axis="x" label="横向" style="height:60px">' +
        '<div style="width:900px">c</div></mc-scroll-area>';
      document.body.append(box);
      /* scroll 事件是从宿主上重发的，挂在 document 上就说明它真的冒泡出来了 */
      window.__saScrolls = 0;
      box.addEventListener('scroll', () => {
        window.__saScrolls++;
      });
    });
    await page
      .waitForFunction(() => !!document.getElementById('sa-over')?.shadowRoot, { timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(150);

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const q = (id, sel) => el(id).shadowRoot.querySelector(sel);
      const fit = el('sa-fit');
      const over = el('sa-over');
      const vp = q('sa-over', '.mc-viewport');
      const host = over.getBoundingClientRect();
      return {
        fit: {
          overflow: fit.hasAttribute('data-overflow'),
          attrs: ['tabindex', 'role', 'aria-label'].filter((a) =>
            q('sa-fit', '.mc-viewport').hasAttribute(a),
          ),
          barOpacity: getComputedStyle(q('sa-fit', '.mc-bar')).opacity,
        },
        over: {
          overflow: over.hasAttribute('data-overflow'),
          dataAxis: over.getAttribute('data-axis'),
          tabindex: vp.getAttribute('tabindex'),
          role: vp.getAttribute('role'),
          ariaLabel: vp.getAttribute('aria-label'),
          scrollbarWidth: getComputedStyle(vp).scrollbarWidth,
          /* 覆盖式：viewport 宽度 == 宿主宽度（条子不占内容宽度） */
          widthMatches: Math.round(vp.clientWidth) === Math.round(host.width),
        },
        thumb: (() => {
          const bar = q('sa-over', '.mc-bar');
          const thumb = q('sa-over', '.mc-thumb');
          return {
            barH: Math.round(bar.clientHeight),
            thumbH: Math.round(thumb.clientHeight),
            top: Math.round(thumb.getBoundingClientRect().top),
          };
        })(),
        structure: {
          parts: [...over.shadowRoot.querySelectorAll('[part]')].map((n) => n.getAttribute('part')),
          barHidden: q('sa-over', '.mc-bar').getAttribute('aria-hidden'),
          slots: over.shadowRoot.querySelectorAll('slot').length,
          thumbHidden: q('sa-over', '.mc-thumb').parentElement.getAttribute('aria-hidden'),
        },
        x: {
          dataAxis: el('sa-x').getAttribute('data-axis'),
          overflow: el('sa-x').hasAttribute('data-overflow'),
          scrollable: (() => {
            const v = q('sa-x', '.mc-viewport');
            return v.scrollWidth > v.clientWidth;
          })(),
        },
      };
    });

    /* 滚到底：滑块应当贴到条子底部，且 scroll 事件从宿主冒泡出来 */
    await page.evaluate(() =>
      document.getElementById('sa-over').shadowRoot.querySelector('.mc-viewport').scrollTo(0, 300),
    );
    await page.waitForTimeout(120);
    const scrolled = await page.evaluate(() => {
      const over = document.getElementById('sa-over');
      const vp = over.shadowRoot.querySelector('.mc-viewport');
      const bar = over.shadowRoot.querySelector('.mc-bar');
      const thumb = over.shadowRoot.querySelector('.mc-thumb');
      return {
        scrollTop: Math.round(vp.scrollTop),
        thumbBottom: Math.round(thumb.getBoundingClientRect().bottom),
        barBottom: Math.round(bar.getBoundingClientRect().bottom),
        events: window.__saScrolls,
      };
    });

    /* 拖滑块：真实指针拖拽（pointerdown → pointermove → pointerup） */
    const drag = await (async () => {
      /* ⚠️ 先滚回顶部：上一条断言把内容滚到底了，滑块已经在底部，再往下拖当然不动 */
      await page.evaluate(() =>
        document.getElementById('sa-over').shadowRoot.querySelector('.mc-viewport').scrollTo(0, 0),
      );
      await page.waitForTimeout(80);
      const box = await page.evaluate(() => {
        const thumb = document
          .getElementById('sa-over')
          .shadowRoot.querySelector('.mc-thumb')
          .getBoundingClientRect();
        return { x: thumb.x + thumb.width / 2, y: thumb.y + thumb.height / 2 };
      });
      const before = await page.evaluate(
        () => document.getElementById('sa-over').shadowRoot.querySelector('.mc-viewport').scrollTop,
      );
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      await page.mouse.move(box.x, box.y + 30, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(120);
      const after = await page.evaluate(
        () => document.getElementById('sa-over').shadowRoot.querySelector('.mc-viewport').scrollTop,
      );
      return { before: Math.round(before), after: Math.round(after) };
    })();

    /* 内容长高 → 滑块变短（ResizeObserver 盯的是插槽里那些元素，不是视口本身） */
    const grown = await (async () => {
      const read = () =>
        page.evaluate(() => ({
          thumbH: Math.round(
            document
              .getElementById('sa-over')
              .shadowRoot.querySelector('.mc-thumb')
              .getBoundingClientRect().height,
          ),
          scrollable: (() => {
            const v = document.getElementById('sa-over').shadowRoot.querySelector('.mc-viewport');
            return v.scrollHeight > v.clientHeight;
          })(),
        }));
      const before = await read();
      await page.evaluate(() => {
        document.getElementById('sa-content').style.height = '1600px';
      });
      await page.waitForTimeout(250);
      return { before, after: await read() };
    })();

    /* 滚轮：既要在容器里滚得动，也不能把鼠标锁在里面。
       这两条是第一版**漏掉**的（那时只测了 scrollTo 与拖拽）—— 结果 viewport 上的
       overscroll-behavior: contain 让「容器滚到底后整页动不了」，使用者感受就是「滚动被锁住了」 */
    const wheel = await (async () => {
      /* 探针插在正文**最前面**（插在末尾会落在视口外：鼠标停不到视口外的坐标，滚轮就不生效 ——
         第一版就栽在这），随后把它滚到视口里再开测。
         位置必须在 .doc-body 里：那在**外壳正文带（.doc-main）内部**，滚到头的接力才有去处
         （挂在 body 上试不出来：链子到不了那个内部滚动容器）。 */
      await page.evaluate(() => {
        window
          .__deep('.doc-body')
          .insertAdjacentHTML(
            'afterbegin',
            '<mc-scroll-area id="sa-wheel" label="滚轮" style="height:120px">' +
              '<div style="height:900px">w</div></mc-scroll-area>',
          );
      });
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        const main = window.__deep('.doc-main');
        const el = window.__deep('#sa-wheel');
        main.scrollTop += el.getBoundingClientRect().top - 200;
      });
      await page.waitForTimeout(250);

      const at = await page.evaluate(() => {
        const r = window.__deep('#sa-wheel').getBoundingClientRect();
        return {
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + Math.min(50, r.height / 2)),
          visible: r.top >= 0 && r.bottom <= window.innerHeight,
        };
      });
      const read = () =>
        page.evaluate(() => {
          const vp = window.__deep('#sa-wheel').shadowRoot.querySelector('.mc-viewport');
          const main = window.__deep('.doc-main');
          return {
            inner: Math.round(vp.scrollTop),
            max: vp.scrollHeight - vp.clientHeight,
            page: Math.round(main.scrollTop),
            pageMax: main.scrollHeight - main.clientHeight,
          };
        });

      const base = await read();
      await page.mouse.move(at.x, at.y);
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(300);
      const scrolled = await read();
      await page.mouse.wheel(0, 3000); // 一路滚到容器底
      await page.waitForTimeout(300);
      const bottom = await read();
      await page.mouse.wheel(0, 300); // 到底之后再滚：应当由页面接管
      await page.waitForTimeout(300);
      const after = await read();
      await page.evaluate(() => window.__deep('#sa-wheel')?.remove());
      return { at, base, scrolled, bottom, after };
    })();

    await page.evaluate(() => {
      document.getElementById('sa-probe')?.remove();
    });

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { probe, scrolled, drag, grown, wheel, failed };
  })();

  check(
    '不溢出时什么都没有：无条子（opacity 0）、也没有 tabindex / role / aria-label —— 不留没用的 tab 停靠点',
    area.probe.fit.overflow === false &&
      area.probe.fit.attrs.length === 0 &&
      area.probe.fit.barOpacity === '0',
    JSON.stringify(area.probe.fit),
  );

  check(
    '溢出时挂上 a11y 三连（tabindex=0 / region / label）、标出 [data-overflow]，轴落到 [data-axis]',
    area.probe.over.overflow === true &&
      area.probe.over.tabindex === '0' &&
      area.probe.over.role === 'region' &&
      area.probe.over.ariaLabel === '装不下' &&
      area.probe.over.dataAxis === 'y',
    JSON.stringify(area.probe.over),
  );

  check(
    '原生滚动条被藏掉（scrollbar-width: none），条子**覆盖式**：viewport 宽度 == 宿主宽度，不占内容宽度',
    area.probe.over.scrollbarWidth === 'none' && area.probe.over.widthMatches === true,
    JSON.stringify({
      scrollbarWidth: area.probe.over.scrollbarWidth,
      widthMatches: area.probe.over.widthMatches,
    }),
  );

  check(
    '结构与约定一致：part 是 viewport / bar / thumb，条子对读屏隐藏，内容走默认插槽',
    JSON.stringify(area.probe.structure.parts) === JSON.stringify(['viewport', 'bar', 'thumb']) &&
      area.probe.structure.barHidden === 'true' &&
      area.probe.structure.thumbHidden === 'true' &&
      area.probe.structure.slots === 1,
    JSON.stringify(area.probe.structure),
  );

  check(
    '滑块长度按比例（内容 4 倍高 → 约 1/4 轨道），滚到底后贴到条子底部',
    Math.abs(area.probe.thumb.thumbH - area.probe.thumb.barH / 4) <= 2 &&
      Math.abs(area.scrolled.thumbBottom - area.scrolled.barBottom) <= 1,
    JSON.stringify({ ...area.probe.thumb, ...area.scrolled }),
  );

  check(
    'scroll 事件从**宿主**冒泡出来（原生 scroll 不冒泡，viewport 又在 shadow 里，外面够不着）',
    area.scrolled.events > 0,
    JSON.stringify({ events: area.scrolled.events }),
  );

  check(
    '拖滑块能滚（真实指针拖拽）：往下拖 30px，内容跟着往下滚',
    area.drag.after > area.drag.before,
    JSON.stringify(area.drag),
  );

  check(
    '内容长高 → 滑块跟着变短（ResizeObserver 盯的是插槽里的内容，不是视口本身）',
    area.grown.after.thumbH < area.grown.before.thumbH,
    JSON.stringify(area.grown),
  );

  check(
    'axis="x"：横向可滚，轴照样落到 [data-axis]',
    area.probe.x.dataAxis === 'x' &&
      area.probe.x.overflow === true &&
      area.probe.x.scrollable === true,
    JSON.stringify(area.probe.x),
  );

  check(
    '滚轮在容器里滚得动：滚 150 内部动、页面不动（第一版漏了这条，只测了 scrollTo 与拖拽）',
    area.wheel.at.visible === true &&
      area.wheel.scrolled.inner > 0 &&
      area.wheel.scrolled.page === area.wheel.base.page,
    JSON.stringify({ at: area.wheel.at, base: area.wheel.base, scrolled: area.wheel.scrolled }),
  );

  check(
    '滚到底后滚轮**交给外层页面**，不把鼠标锁在容器里（容器 contain 住的话这里页面不会动）',
    area.wheel.bottom.inner === area.wheel.bottom.max &&
      area.wheel.after.page > area.wheel.bottom.page,
    JSON.stringify({ bottom: area.wheel.bottom, after: area.wheel.after }),
  );

  check('滚动容器文档页没有 404 / 运行时报错', area.failed.length === 0, area.failed.join(' | ') || '无');
}
