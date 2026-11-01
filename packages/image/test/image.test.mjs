/**
 * mc-image · 图像：src / alt 落到内部 img、fit 五档、ratio 按父级宽度算高、radius 五档、
 * 加载中 / 成功的状态属性（data-loading / data-has-image / data-error）、失败兜底（alt ↔ 默认插槽）、
 * lazy 转发原生 loading、load / error 的载荷、::part(image|fallback)、无 role / aria / 交互元素。
 */

export default async function run({ page, visit, check }) {
  const image = await (async () => {
    const failed = [];
    const onResponse = (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    };
    const onError = (e) => failed.push(String(e));
    page.on('response', onResponse);
    page.on('pageerror', onError);

    await visit(page, '/index.html?image=1#/packages/image/page.html');
    await page
      .waitForFunction(
        () => {
          const list = window.__deepAll('mc-image');
          return list.length >= 8 && list.every((el) => !!el.shadowRoot);
        },
        { timeout: 8000 },
      )
      .catch(() => {});

    /** 令牌解析：圆角与兜底底色都来自令牌，期望值按当前主题算 */
    const tokens = await page.evaluate(() => {
      const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return {
        radiusLg: read('--mc-radius-lg'),
        radiusFull: read('--mc-radius-full'),
        placeholder: 'rgb(' + read('--mc-color-surface-sunken').split(/\s+/).join(', ') + ')',
      };
    });

    /** 全局：实例数、插槽 / part / 控件 / aria */
    const overview = await page.evaluate(() => {
      const list = window.__deepAll('mc-image');
      return {
        total: list.length,
        upgraded: list.every((el) => !!el.shadowRoot),
        slotCounts: [...new Set(list.map((el) => el.shadowRoot.querySelectorAll('slot').length))],
        parts: [
          ...new Set(
            list.flatMap((el) =>
              [...el.shadowRoot.querySelectorAll('[part]')].map((n) => n.getAttribute('part')),
            ),
          ),
        ].sort(),
        controls: list.reduce(
          (n, el) => n + el.shadowRoot.querySelectorAll('button, a, input, select, textarea').length,
          0,
        ),
        // 预览默认开启后，交互语义的守门人变成「有没有图」：没图 / 坏图不该带 role / aria-*
        ariaWithoutImage: list
          .filter((el) => !el.hasAttribute('data-has-image'))
          .some(
            (el) =>
              el.hasAttribute('role') ||
              [...el.attributes].some((attr) => attr.name.indexOf('aria-') === 0),
          ),
      };
    });

    /** 现搭现拆探针：尺寸 / fit / ratio / radius / 状态 / 兜底 / lazy / 事件载荷 */
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'image-probe';
      host.style.cssText =
        'position:fixed;left:0;top:0;z-index:99999;width:600px;background:#fff;padding:8px';
      host.innerHTML = [
        '<mc-image id="i-natural" src="./packages/image/test/photo.svg" alt="山间的日出"></mc-image>',
        '<mc-image id="i-box" src="./packages/image/test/photo.svg" fit="contain" style="width:160px;height:100px"></mc-image>',
        '<mc-image id="i-cover" src="./packages/image/test/photo.svg" fit="cover" style="width:160px;height:100px"></mc-image>',
        '<mc-image id="i-fill" src="./packages/image/test/photo.svg" fit="fill" style="width:160px;height:100px"></mc-image>',
        '<div id="i-ratio-wrap" style="width:200px"><mc-image id="i-ratio" src="./packages/image/test/photo.svg" ratio="1/1"></mc-image></div>',
        '<div id="i-ratio-bad-wrap" style="width:200px"><mc-image id="i-ratio-bad" src="./packages/image/test/photo.svg" ratio="宽高比"></mc-image></div>',
        '<div id="ref-lg" style="border-radius: var(--mc-radius-lg)"></div>',
        '<div id="ref-full" style="border-radius: var(--mc-radius-full)"></div>',
        '<mc-image id="i-radius-lg" src="./packages/image/test/photo.svg" radius="lg" style="width:80px;height:80px"></mc-image>',
        '<mc-image id="i-radius-full" src="./packages/image/test/photo.svg" radius="full" style="width:80px;height:80px"></mc-image>',
        '<mc-image id="i-radius-none" src="./packages/image/test/photo.svg" style="width:80px;height:80px"></mc-image>',
        '<mc-image id="i-broken" src="data:image/png;base64,AAAA" alt="坏图" style="width:160px;height:100px"></mc-image>',
        '<mc-image id="i-slot" src="data:image/png;base64,AAAA" alt="坏图" style="width:160px;height:100px"><span>重试</span></mc-image>',
        '<mc-image id="i-lazy" src="./packages/image/test/photo.svg" lazy style="width:80px"></mc-image>',
        '<mc-image id="i-eager" src="./packages/image/test/photo.svg" style="width:80px"></mc-image>',
        '<mc-image id="i-empty"></mc-image>',
      ].join('');
      document.body.append(host);

      // 事件载荷：先挂监听再等 load / error（元素这时才第一次写 src）
      window.__imageEvents = { load: null, error: null };
      const lazy = document.getElementById('i-lazy');
      lazy.addEventListener('load', (event) => {
        window.__imageEvents.load = event.data ?? null;
      });
      const broken = document.getElementById('i-broken');
      broken.addEventListener('error', (event) => {
        window.__imageEvents.error = event.data ?? null;
      });
    });

    await page
      .waitForFunction(
        () => {
          const ids = ['i-natural', 'i-box', 'i-ratio', 'i-broken', 'i-slot', 'i-lazy'];
          return ids.every((id) => !!document.getElementById(id)?.shadowRoot);
        },
        { timeout: 5000 },
      )
      .catch(() => {});
    await page
      .waitForFunction(
        () => {
          const done = (id) =>
            document.getElementById(id)?.hasAttribute('data-has-image') ||
            document.getElementById(id)?.hasAttribute('data-error');
          return ['i-natural', 'i-box', 'i-ratio', 'i-broken', 'i-slot'].every(done);
        },
        { timeout: 8000 },
      )
      .catch(() => {});
    await page.waitForTimeout(300);

    const probe = await page.evaluate(() => {
      const el = (id) => document.getElementById(id);
      const root = (id) => el(id).shadowRoot;
      const box = (id) => {
        const rect = el(id).getBoundingClientRect();
        return { w: Math.round(rect.width), h: Math.round(rect.height) };
      };
      const img = (id) => root(id).querySelector('.mc-image');
      const cs = (id) => getComputedStyle(el(id));
      const fallback = (id) => root(id).querySelector('.mc-fallback');
      const altText = (id) => root(id).querySelector('.mc-alt').textContent;
      const has = (id, name) => el(id).hasAttribute(name);
      return {
        sizes: {
          natural: box('i-natural'),
          box: box('i-box'),
          ratio: box('i-ratio'),
        },
        fit: {
          cover: getComputedStyle(img('i-cover')).objectFit,
          contain: getComputedStyle(img('i-box')).objectFit,
          fill: getComputedStyle(img('i-fill')).objectFit,
        },
        ratio: {
          inline: el('i-ratio').style.getPropertyValue('--mc-image-ratio').trim(),
          badInline: el('i-ratio-bad').style.getPropertyValue('--mc-image-ratio').trim(),
        },
        radius: {
          none: cs('i-radius-none').borderTopLeftRadius,
          lg: cs('i-radius-lg').borderTopLeftRadius,
          full: cs('i-radius-full').borderTopLeftRadius,
          refLg: getComputedStyle(el('ref-lg')).borderTopLeftRadius,
          refFull: getComputedStyle(el('ref-full')).borderTopLeftRadius,
        },
        states: {
          loaded: has('i-natural', 'data-has-image'),
          loadingAfterLoad: has('i-natural', 'data-loading'),
          brokenError: has('i-broken', 'data-error'),
          brokenImage: has('i-broken', 'data-has-image'),
          brokenBg: cs('i-broken').backgroundColor,
          emptySrc: el('i-empty').shadowRoot.querySelector('.mc-image').getAttribute('src'),
          emptyError: has('i-empty', 'data-error'),
        },
        fallback: {
          display: getComputedStyle(fallback('i-broken')).display,
          alt: altText('i-broken'),
          imgAlt: img('i-broken').alt,
          slotHas: has('i-slot', 'data-has-fallback'),
          slotAltDisplay: getComputedStyle(root('i-slot').querySelector('.mc-alt')).display,
          slotText: root('i-slot').querySelector('slot').assignedNodes().length,
          loadedFallback: getComputedStyle(fallback('i-natural')).display,
        },
        lazy: {
          lazy: img('i-lazy').loading,
          eager: img('i-eager').loading,
        },
        alt: img('i-natural').alt,
      };
    });

    const events = await page.evaluate(() => window.__imageEvents);

    /** 运行时：换地址（好坏互切）、改 alt、清空 src */
    const runtime = await (async () => {
      await page.evaluate(() => {
        document.getElementById('i-natural').setAttribute('src', 'data:image/png;base64,AAAA');
      });
      await page
        .waitForFunction(() => document.getElementById('i-natural').hasAttribute('data-error'), {
          timeout: 5000,
        })
        .catch(() => {});
      const broken = await page.evaluate(() => {
        const el = document.getElementById('i-natural');
        return {
          error: el.hasAttribute('data-error'),
          image: el.hasAttribute('data-has-image'),
          altText: el.shadowRoot.querySelector('.mc-alt').textContent,
        };
      });

      await page.evaluate(() => {
        const el = document.getElementById('i-natural');
        el.setAttribute('src', './packages/image/test/photo.svg');
        el.setAttribute('alt', '换过说明');
      });
      await page
        .waitForFunction(
          () =>
            document.getElementById('i-natural').hasAttribute('data-has-image') &&
            document.getElementById('i-natural').shadowRoot.querySelector('.mc-alt')
              .textContent === '换过说明',
          { timeout: 5000 },
        )
        .catch(() => {});
      const restored = await page.evaluate(() => {
        const el = document.getElementById('i-natural');
        return {
          image: el.hasAttribute('data-has-image'),
          error: el.hasAttribute('data-error'),
          altText: el.shadowRoot.querySelector('.mc-alt').textContent,
        };
      });

      await page.evaluate(() => {
        document.getElementById('i-lazy').setAttribute('src', '');
      });
      await page.waitForTimeout(200);
      const cleared = await page.evaluate(() => {
        const el = document.getElementById('i-lazy');
        return {
          src: el.shadowRoot.querySelector('.mc-image').getAttribute('src'),
          image: el.hasAttribute('data-has-image'),
          loading: el.hasAttribute('data-loading'),
        };
      });

      return { broken, restored, cleared };
    })();

    await page.evaluate(() => document.getElementById('image-probe')?.remove());

    /** 预览 / 图片组 / 具名兜底槽：现搭现拆（浮层是 document 级单例，直接在 document 上查） */
    const preview = await (async () => {
      await page.evaluate(() => {
        const host = document.createElement('div');
        host.id = 'image-preview-probe';
        host.innerHTML = [
          '<mc-image id="pv-single" src="./packages/image/test/photo.svg" alt="单张" style="width:80px;height:60px"></mc-image>',
          // 默认就开预览：不写属性也应可点
          '<mc-image id="pv-default" src="./packages/image/test/photo.svg" alt="默认可点" style="width:80px;height:60px"></mc-image>',
          '<mc-image id="pv-off" src="./packages/image/test/photo.svg" alt="关掉预览" preview-disabled style="width:80px;height:60px"></mc-image>',
          // ofa 的布尔绑定：`attr:preview-disabled="false"` 会把属性写成 preview-disabled="false"
          '<mc-image id="pv-off-false" src="./packages/image/test/photo.svg" alt="绑定成 false" preview-disabled="false" style="width:80px;height:60px"></mc-image>',
          '<mc-image id="pv-broken-preview" src="data:image/png;base64,AAAA" alt="坏图" style="width:80px;height:60px"></mc-image>',
          '<mc-image-group id="pv-group">',
          '  <mc-image id="pv-a" src="./packages/image/test/photo.svg" alt="第一张" style="width:80px;height:60px"></mc-image>',
          '  <mc-image id="pv-b" src="./packages/image/test/portrait.svg" alt="第二张" style="width:80px;height:60px"></mc-image>',
          '  <mc-image id="pv-c" src="./packages/image/test/photo.svg" alt="第三张" style="width:80px;height:60px"></mc-image>',
          '</mc-image-group>',
          '<mc-image-group id="pv-loop" loop>',
          '  <mc-image id="pv-l1" src="./packages/image/test/photo.svg" alt="循环一" style="width:80px;height:60px"></mc-image>',
          '  <mc-image id="pv-l2" src="./packages/image/test/portrait.svg" alt="循环二" style="width:80px;height:60px"></mc-image>',
          '</mc-image-group>',
          // 按钮钉在视口左上：probe 容器可能被页面内容盖住，真鼠标点不到（浮层在 top layer，不受它影响）
          '<button id="pv-open-btn" type="button" style="position:fixed;left:8px;top:8px;z-index:2147483647">放大默认图</button>',
          '<mc-image id="pv-slot-named" src="data:image/png;base64,AAAA" alt="坏图" style="width:160px;height:100px">',
          '  <span slot="fallback" id="pv-named-content">重新上传</span>',
          '  <span id="pv-plain-content">默认槽</span>',
          '</mc-image>',
        ].join('');
        document.body.append(host);

        window.__pvEvents = { open: [], close: 0 };
        const single = document.getElementById('pv-single');
        single.addEventListener('open', (event) => window.__pvEvents.open.push(event.data));
        single.addEventListener('close', () => (window.__pvEvents.close += 1));

        window.__pvRead = () => {
          const layer = document.querySelector('.mc-image-viewer');
          return {
            open: !!layer?.matches(':popover-open'),
            count: layer?.querySelector('.mcp-count').textContent,
            src: layer?.querySelector('.mcp-img').getAttribute('src'),
            prev: layer?.querySelector('.mcp-prev').disabled,
            next: layer?.querySelector('.mcp-next').disabled,
            single: layer?.hasAttribute('data-single'),
          };
        };
        window.__pvClick = (id) => {
          document.getElementById(id).shadowRoot.querySelector('.mc-image').click();
          return window.__pvRead();
        };
        window.__pvStep = (dir) => {
          const layer = document.querySelector('.mc-image-viewer');
          layer.querySelector(dir > 0 ? '.mcp-next' : '.mcp-prev').click();
          return window.__pvRead();
        };
        // 按钮的点击回调：调的是图上挂出来的 open()
        document.getElementById('pv-open-btn').addEventListener('click', () => {
          document.getElementById('pv-default').open();
        });
        window.__pvKey = (key) => {
          document
            .querySelector('.mc-image-viewer')
            .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
          return window.__pvRead();
        };
      });

      await page
        .waitForFunction(
          () => {
            const ids = [
              'pv-single',
              'pv-default',
              'pv-off',
              'pv-off-false',
              'pv-a',
              'pv-b',
              'pv-c',
              'pv-l1',
              'pv-l2',
              'pv-slot-named',
            ];
            return ids.every((id) => {
              const el = document.getElementById(id);
              return (
                el?.hasAttribute('data-has-image') || el?.hasAttribute('data-error')
              );
            });
          },
          { timeout: 8000 },
        )
        .catch(() => {});

      const before = await page.evaluate(() => {
        const el = (id) => document.getElementById(id);
        const attrs = (id) => ({
          role: el(id).getAttribute('role'),
          tabindex: el(id).getAttribute('tabindex'),
        });
        const slotDisplay = (id, sel) =>
          getComputedStyle(el(id).shadowRoot.querySelector(sel)).display;
        return {
          single: attrs('pv-single'),
          defaultOn: attrs('pv-default'),
          off: attrs('pv-off'),
          offFalse: attrs('pv-off-false'),
          offCursor: getComputedStyle(el('pv-off')).cursor,
          offFalseCursor: getComputedStyle(el('pv-off-false')).cursor,
          broken: attrs('pv-broken-preview'),
          named: {
            hasNamed: el('pv-slot-named').hasAttribute('data-has-named'),
            hasFallback: el('pv-slot-named').hasAttribute('data-has-fallback'),
            plainSlot: slotDisplay('pv-slot-named', 'slot:not([name])'),
            namedSlot: slotDisplay('pv-slot-named', 'slot[name="fallback"]'),
          },
        };
      });

      // 坏图（带 preview）点了不该开：没有图可看
      const brokenClick = await page.evaluate(() => {
        window.__pvClick('pv-broken-preview');
        return { exists: !!document.querySelector('.mc-image-viewer') };
      });

      const singleOpen = await page.evaluate(() => ({
        ...window.__pvClick('pv-single'),
        focused: document.activeElement?.classList?.contains('mcp-close') ?? false,
      }));

      await page.evaluate(() => {
        document.querySelector('.mc-image-viewer .mcp-close').click();
      });
      await page.waitForTimeout(150);
      const singleClosed = await page.evaluate(() => ({
        ...window.__pvRead(),
        events: window.__pvEvents,
        focusedBack: document.activeElement === document.getElementById('pv-single'),
      }));

      const groupOpen = await page.evaluate(() => window.__pvClick('pv-b'));
      const groupLast = await page.evaluate(() => window.__pvStep(1));
      const groupEnd = await page.evaluate(() => window.__pvStep(1));
      const groupBack = await page.evaluate(() => window.__pvKey('ArrowLeft'));

      /** 底部工具条：缩放档位、旋转换约束、还原、换图归位、滚轮 */
      const toolbar = await page.evaluate(() => {
        const layer = document.querySelector('.mc-image-viewer');
        const q = (sel) => layer.querySelector(sel);
        const read = () => {
          const img = q('.mcp-img');
          const frame = q('.mcp-frame').getBoundingClientRect();
          return {
            zoom: q('.mcp-zoom-value').textContent,
            transform: img.style.transform.replace(/^translate3d\([^)]*\)\s*/, ''),
            maxW: img.style.maxWidth,
            maxH: img.style.maxHeight,
            maxWNum: Math.round(parseFloat(img.style.maxWidth) || 0),
            maxHNum: Math.round(parseFloat(img.style.maxHeight) || 0),
            frameW: Math.round(frame.width),
            frameH: Math.round(frame.height),
            reset: q('.mcp-reset').disabled,
            zoomIn: q('.mcp-zoom-in').disabled,
            zoomOut: q('.mcp-zoom-out').disabled,
            rotate: q('.mcp-rotate-left').disabled,
            download: q('.mcp-download').disabled,
          };
        };
        const click = (sel) => {
          q(sel).click();
          return read();
        };
        const init = read();
        const plus1 = click('.mcp-zoom-in');
        const plus2 = click('.mcp-zoom-in');
        for (let i = 0; i < 4; i += 1) click('.mcp-zoom-in');
        const max = read();
        const rot = click('.mcp-rotate-right');
        const rotBack = click('.mcp-rotate-left');
        const reset = click('.mcp-reset');
        q('.mcp-img').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        const dbl = read();
        click('.mcp-reset');
        const next = click('.mcp-next');
        layer.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
        const wheel = read();
        return {
          tools: layer.querySelectorAll('.mcp-bar .mcp-btn').length,
          init,
          plus1,
          plus2,
          max,
          rot,
          rotBack,
          reset,
          dbl,
          next,
          wheel,
        };
      });

      /**
       * 旋转方向：左转必须落成 rotate(-90deg)。
       * 折成 270deg 视觉一样，但 transform 的过渡按数值插值，会顺时针绕 3/4 圈 ——
       * 看着就像「按了左转却右转好几圈」。
       */
      const rotateDir = await page.evaluate(() => {
        const layer = document.querySelector('.mc-image-viewer');
        const q = (sel) => layer.querySelector(sel);
        const rot = () => (q('.mcp-img').style.transform.match(/rotate\(-?\d+deg\)/) ?? [''])[0];
        const before = rot();
        q('.mcp-rotate-left').click();
        const oneLeft = rot();
        q('.mcp-rotate-left').click();
        q('.mcp-rotate-left').click();
        const threeLeft = rot();
        q('.mcp-reset').click();
        return { before, oneLeft, threeLeft, after: rot() };
      });

      /**
       * 拖动平移：图比框大才有得拖（100% 时拖不动）、拖到边就停（框永远被图铺满）、
       * 还原 / 换图把位移归零；拖完在遮罩上松手也不该把浮层关掉。
       */
      const drag = await (async () => {
        const clickTool = (sel) =>
          page.evaluate((s) => document.querySelector(`.mc-image-viewer ${s}`).click(), sel);

        /** 一路放到最大档（4 倍）：这个倍数下不管横图竖图，两个方向都超出框 */
        const zoomMax = () =>
          page.evaluate(() => {
            const plus = document.querySelector('.mc-image-viewer .mcp-zoom-in');
            for (let i = 0; i < 8 && !plus.disabled; i += 1) plus.click();
          });

        const panel = await page.evaluate(() => {
          const layer = document.querySelector('.mc-image-viewer');
          const q = (sel) => layer.querySelector(sel);
          q('.mcp-reset').click(); // 上一段收尾在 100%，这里只是确保
          const frame = q('.mcp-frame').getBoundingClientRect();
          return {
            cx: Math.round(frame.left + frame.width / 2),
            cy: Math.round(frame.top + frame.height / 2),
            outsideY: 6, // 框外的遮罩（舞台上下留白）上
          };
        });
        await zoomMax();

        const read = () =>
          page.evaluate(() => {
            const layer = document.querySelector('.mc-image-viewer');
            const q = (sel) => layer.querySelector(sel);
            const img = q('.mcp-img');
            const hit = img.style.transform.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/);
            const box = img.getBoundingClientRect();
            const frame = q('.mcp-frame').getBoundingClientRect();
            /* 图比框大的那个轴必须把框铺满（露出黑边就是拖过头了）；比框小的轴本来就居中留白 */
            const fills = (imgLo, imgHi, frameLo, frameHi) =>
              imgHi - imgLo <= frameHi - frameLo ||
              (imgLo <= frameLo + 1.5 && imgHi >= frameHi - 1.5);
            return {
              open: !!layer.matches(':popover-open'),
              x: Math.round(Number(hit?.[1] ?? 0)),
              y: Math.round(Number(hit?.[2] ?? 0)),
              pannable: layer.hasAttribute('data-pannable'),
              reset: q('.mcp-reset').disabled,
              covered:
                fills(box.left, box.right, frame.left, frame.right) &&
                fills(box.top, box.bottom, frame.top, frame.bottom),
            };
          });

        /** 从框中心按住拖到 (x, y) 松开 —— 用真鼠标，指针捕获才成立 */
        const dragTo = async (x, y) => {
          await page.mouse.move(panel.cx, panel.cy);
          await page.mouse.down();
          await page.mouse.move(x, y, { steps: 8 });
          await page.mouse.up();
          await page.waitForTimeout(120);
          return read();
        };

        const before = await read();
        const moved = await dragTo(panel.cx + 150, panel.cy + 90);
        // 拖到远超可拖范围：夹在边界上，再拖一次也不该动
        const capped = await dragTo(panel.cx + 600, panel.cy + 400);
        const cappedAgain = await dragTo(panel.cx + 600, panel.cy + 400);
        // 在框外的遮罩上松手：这次 click 要是没被吃掉，浮层就关了
        const releasedOutside = await dragTo(panel.cx, panel.outsideY);

        await clickTool('.mcp-reset');
        const afterReset = await read();
        const atHome = await dragTo(panel.cx + 150, panel.cy + 90);

        await zoomMax();
        const panned = await dragTo(panel.cx + 150, panel.cy + 90);
        await clickTool('.mcp-prev'); // 换图：位移跟着归零（3/3 的 next 是禁用的）
        const afterSwitch = await read();

        return {
          panel,
          before,
          moved,
          capped,
          cappedAgain,
          releasedOutside,
          afterReset,
          atHome,
          panned,
          afterSwitch,
        };
      })();

      const loopOpen = await page.evaluate(() => window.__pvClick('pv-l2'));
      const loopWrap = await page.evaluate(() => window.__pvStep(1));

      await page.evaluate(() => window.__pvKey('Escape'));
      await page.waitForTimeout(150);
      const afterEsc = await page.evaluate(() => window.__pvRead());

      /**
       * 主动打开：mc-image.open() 不等点击；组上 open(index) 从第 index 张开始。
       * 关闭后焦点回到「调用时的那个元素」—— 这次是页面上的按钮。
       */
      await page.click('#pv-open-btn');
      await page.waitForTimeout(150);
      const byButton = await page.evaluate(() => ({
        ...window.__pvRead(),
        focusedClose: document.activeElement?.classList?.contains('mcp-close') ?? false,
      }));
      await page.evaluate(() => document.querySelector('.mc-image-viewer .mcp-close').click());
      await page.waitForTimeout(150);
      const focusedAfter = await page.evaluate(() => document.activeElement?.id ?? '');

      const byMethod = await page.evaluate(async () => {
        const openGroup = (index) => {
          document.getElementById('pv-group').open(index);
          return window.__pvRead();
        };
        const fromFirst = openGroup(0);
        const fromSecond = openGroup(1);
        const overflow = openGroup(9);
        const negative = openGroup(-3);
        document.querySelector('.mc-image-viewer .mcp-close').click();

        // 组内写了 preview-disabled 的图自己也能开，只是这一趟只有它自己
        document.getElementById('pv-off').open();
        const offSelf = window.__pvRead();
        document.querySelector('.mc-image-viewer .mcp-close').click();

        // 空组（还没有成员）什么也不做 —— 等它升级完再调，才算测到「方法在、但没得开」
        const emptyHost = document.createElement('mc-image-group');
        emptyHost.id = 'pv-empty-group';
        document.body.append(emptyHost);
        await new Promise((resolve) => setTimeout(resolve, 200));
        const empty = emptyHost.open?.(0) ?? undefined;
        emptyHost.remove();

        return { fromFirst, fromSecond, overflow, negative, offSelf, empty: empty === null || empty === undefined };
      });

      await page.evaluate(() => document.getElementById('image-preview-probe')?.remove());

      /**
       * 无渲染入口 mc-image-preview：宿主不占位，拿到实例调 open() 就开（哪个按钮都行）、
       * 不传 opener 时关闭后焦点回到调用它的按钮、open(index) 夹到两端。
       */
      const entry = await (async () => {
        await page.evaluate(() => {
          const host = document.createElement('div');
          host.id = 'image-entry-probe';
          host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px';
          host.innerHTML = [
            '<mc-image-preview id="tp-one" src="./packages/image/test/photo.svg" alt="单张入口"></mc-image-preview>',
            '<button id="tp-btn" type="button">看大图</button>',
            '<mc-image-preview id="tp-album" loop>',
            '<img src="./packages/image/test/photo.svg" alt="相册一" />',
            '<img src="./packages/image/test/portrait.svg" alt="相册二" />',
            '</mc-image-preview>',
            '<button id="tp-album-btn" type="button">看相册</button>',
            '<mc-image-preview id="tp-empty"></mc-image-preview>',
          ].join('');
          document.body.append(host);

          // 按钮上的 on:click 换成一个普通监听：调的就是宿主暴露的 open()
          [
            ['tp-btn', 'tp-one', 0],
            ['tp-album-btn', 'tp-album', 0],
          ].forEach(([btn, id, index]) => {
            document.getElementById(btn).addEventListener('click', () => {
              document.getElementById(id).open(index);
            });
          });

          window.__tp = { open: [], close: 0 };
          const one = document.getElementById('tp-one');
          one.addEventListener('open', (event) => window.__tp.open.push(event.data));
          one.addEventListener('close', () => (window.__tp.close += 1));

          const layer = () => document.querySelector('.mc-image-viewer');
          window.__tpRead = () => {
            const el = layer();
            return {
              open: !!el?.matches(':popover-open'),
              count: el?.querySelector('.mcp-count').textContent,
              src: el?.querySelector('.mcp-img').getAttribute('src'),
              focusedClose: document.activeElement?.classList?.contains('mcp-close') ?? false,
              focused: document.activeElement?.id ?? '',
            };
          };
          window.__tpTool = (sel) => {
            document.querySelector(`.mc-image-viewer ${sel}`).click();
            return window.__tpRead();
          };
        });

        await page
          .waitForFunction(
            () =>
              ['tp-one', 'tp-album', 'tp-empty'].every(
                (id) => !!document.getElementById(id)?.shadowRoot,
              ),
            { timeout: 8000 },
          )
          .catch(() => {});

        const box = await page.evaluate(() => {
          const el = document.getElementById('tp-one');
          const rect = el.getBoundingClientRect();
          return {
            display: getComputedStyle(el).display,
            w: rect.width,
            h: rect.height,
            slots: el.shadowRoot.querySelectorAll('slot').length,
            parts: el.shadowRoot.querySelectorAll('[part]').length,
            controls: el.shadowRoot.querySelectorAll('button, a, input').length,
            tabindex: el.getAttribute('tabindex'),
            hasOpen: typeof el.open === 'function',
            hasClose: typeof el.close === 'function',
          };
        });

        // 真鼠标点按钮 → 按钮拿到焦点 → 处理函数调 open()：开，载荷 {src, index, total}
        await page.click('#tp-btn');
        await page.waitForTimeout(150);
        const opened = await page.evaluate(() => window.__tpRead());

        // 用工具条的关闭按钮关：焦点回到刚才那个按钮（没传 opener，靠 open() 自己记住）
        const closed = await page.evaluate(async () => {
          window.__tpTool('.mcp-close');
          await new Promise((resolve) => setTimeout(resolve, 150)); // toggle 是排队的，close 事件晚一步
          return { ...window.__tpRead(), events: { ...window.__tp } }; // 焦点也是下一帧才还回来，读晚了才算数
        });

        // 多张：子元素就是相册，2/2 之后 loop 绕回 1/2
        const album = await page.evaluate(async () => {
          const btn = document.getElementById('tp-album-btn');
          btn.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const opened = window.__tpRead();
          const next = window.__tpTool('.mcp-next');
          const wrap = window.__tpTool('.mcp-next');
          window.__tpTool('.mcp-close');
          return { opened, next, wrap };
        });

        // open(index) 越界夹到两端；一张图都没有就什么也不做；close() 也能关
        const direct = await page.evaluate(async () => {
          const empty = (() => {
            document.getElementById('tp-empty').open();
            return window.__tpRead();
          })();
          const overflow = (() => {
            document.getElementById('tp-album').open(9);
            return window.__tpRead();
          })();
          const negative = (() => {
            document.getElementById('tp-album').open(-3);
            return window.__tpRead();
          })();
          document.getElementById('tp-album').close();
          await new Promise((resolve) => setTimeout(resolve, 150));
          return { empty, overflow, negative, afterClose: window.__tpRead() };
        });

        await page.evaluate(() => document.getElementById('image-entry-probe')?.remove());
        return { box, opened, closed, album, direct };
      })();

      return {
        before,
        brokenClick,
        singleOpen,
        singleClosed,
        groupOpen,
        groupLast,
        groupEnd,
        groupBack,
        toolbar,
        rotateDir,
        drag,
        loopOpen,
        loopWrap,
        afterEsc,
        entry,
        method: { byButton, focusedAfter, ...byMethod },
      };
    })();

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { tokens, overview, probe, events, runtime, preview, entry: preview.entry, method: preview.method, failed };
  })();

  check(
    'mc-image 注册并渲染：默认 + fallback 两个插槽、image / fallback 两个 part、无图实例不带 role / aria-*',
    image.overview.upgraded &&
      image.overview.total >= 8 &&
      JSON.stringify(image.overview.slotCounts) === JSON.stringify([2]) &&
      JSON.stringify(image.overview.parts) === JSON.stringify(['fallback', 'image']) &&
      image.overview.controls === 0 &&
      image.overview.ariaWithoutImage === false &&
      image.failed.length === 0,
    JSON.stringify(image.overview) + ' · ' + (image.failed.join(' | ') || '无 404 / 报错'),
  );

  check(
    '尺寸：不给盒子按原图 480×320；给 160×100 就是那个盒；ratio 按父级 200 宽算成 200×200',
    image.probe.sizes.natural.w === 480 &&
      image.probe.sizes.natural.h === 320 &&
      image.probe.sizes.box.w === 160 &&
      image.probe.sizes.box.h === 100 &&
      image.probe.sizes.ratio.w === 200 &&
      image.probe.sizes.ratio.h === 200,
    JSON.stringify(image.probe.sizes),
  );

  check(
    'fit 落到内部 img 的 object-fit；ratio 写进 --mc-image-ratio（非法值照写、CSS 退回内容高度）',
    image.probe.fit.cover === 'cover' &&
      image.probe.fit.contain === 'contain' &&
      image.probe.fit.fill === 'fill' &&
      image.probe.ratio.inline === '1/1' &&
      image.probe.ratio.badInline === '宽高比',
    JSON.stringify({ fit: image.probe.fit, ratio: image.probe.ratio }),
  );

  check(
    'radius：默认 none、lg / full 走 --mc-radius-lg / --mc-radius-full',
    image.probe.radius.none === '0px' &&
      image.probe.radius.lg === image.probe.radius.refLg &&
      image.probe.radius.full === image.probe.radius.refFull,
    JSON.stringify(image.probe.radius),
  );

  check(
    '状态：成功后 data-has-image（加载中的加载位撤掉）；失败 data-error + 占位底；空 src 不写 src、不算失败',
    image.probe.states.loaded === true &&
      image.probe.states.loadingAfterLoad === false &&
      image.probe.states.brokenError === true &&
      image.probe.states.brokenImage === false &&
      image.probe.states.brokenBg === image.tokens.placeholder &&
      image.probe.states.emptySrc === null &&
      image.probe.states.emptyError === false,
    JSON.stringify(image.probe.states),
  );

  check(
    '失败兜底：显示兜底层、文字取 alt；默认插槽有内容时 alt 让位；成功时兜底层不占位',
    image.probe.fallback.display === 'flex' &&
      image.probe.fallback.alt === '坏图' &&
      image.probe.fallback.imgAlt === '坏图' &&
      image.probe.fallback.slotHas === true &&
      image.probe.fallback.slotAltDisplay === 'none' &&
      image.probe.fallback.slotText === 1 &&
      image.probe.fallback.loadedFallback === 'none',
    JSON.stringify(image.probe.fallback),
  );

  check(
    'lazy 转发成内部 img 的原生 loading：写了 lazy 是 lazy，不写是 eager；alt 落到内部 img',
    image.probe.lazy.lazy === 'lazy' &&
      image.probe.lazy.eager === 'eager' &&
      image.probe.alt === '山间的日出',
    JSON.stringify({ ...image.probe.lazy, alt: image.probe.alt }),
  );

  check(
    'load 载荷是 { src, width, height }（原图尺寸）；error 载荷是 { src }',
    image.events.load?.width === 480 &&
      image.events.load?.height === 320 &&
      String(image.events.load?.src).includes('photo.svg') &&
      String(image.events.error?.src).startsWith('data:image/png'),
    JSON.stringify(image.events),
  );

  check(
    '运行时：换成坏地址落兜底、换回好地址恢复；alt 跟着改；清空 src 撤掉图与状态',
    image.runtime.broken.error === true &&
      image.runtime.broken.image === false &&
      image.runtime.broken.altText === '山间的日出' &&
      image.runtime.restored.image === true &&
      image.runtime.restored.error === false &&
      image.runtime.restored.altText === '换过说明' &&
      image.runtime.cleared.src === null &&
      image.runtime.cleared.image === false &&
      image.runtime.cleared.loading === false,
    JSON.stringify(image.runtime),
  );

  check(
    '具名 fallback 槽：有内容时 data-has-named，默认插槽让位（display:none），兜底层照常显示',
    image.preview.before.named.hasNamed === true &&
      image.preview.before.named.hasFallback === true &&
      image.preview.before.named.plainSlot === 'none' &&
      image.preview.before.named.namedSlot !== 'none',
    JSON.stringify(image.preview.before.named),
  );

  check(
    'preview 默认开：不写属性也是按钮（role=button / tabindex=0）；写了 preview-disabled 才退回普通图（坏图也开不了）',
    image.preview.before.single.role === 'button' &&
      image.preview.before.single.tabindex === '0' &&
      image.preview.before.defaultOn.role === 'button' &&
      image.preview.before.defaultOn.tabindex === '0' &&
      image.preview.before.off.role === null &&
      image.preview.before.off.tabindex === null &&
      image.preview.before.offCursor !== 'zoom-in' &&
      image.preview.before.broken.role === null &&
      image.preview.before.broken.tabindex === null,
    JSON.stringify(image.preview.before),
  );

  check(
    'preview-disabled="false" 等于没写（ofa 布尔绑 false 的形态）：照常是按钮、光标仍是放大镜',
    image.preview.before.offFalse.role === 'button' &&
      image.preview.before.offFalse.tabindex === '0' &&
      image.preview.before.offFalseCursor === 'zoom-in',
    JSON.stringify({
      offFalse: image.preview.before.offFalse,
      cursor: image.preview.before.offFalseCursor,
    }),
  );

  check(
    '单张预览：点开整页唯一浮层（popover 已打开）、单张时藏切图控件、焦点落在关闭按钮；坏图点了不开',
    image.preview.brokenClick.exists === false &&
      image.preview.singleOpen.open === true &&
      image.preview.singleOpen.single === true &&
      image.preview.singleOpen.count === '' &&
      image.preview.singleOpen.prev === true &&
      image.preview.singleOpen.focused === true &&
      String(image.preview.singleOpen.src).includes('photo.svg'),
    JSON.stringify({ brokenClick: image.preview.brokenClick, open: image.preview.singleOpen }),
  );

  check(
    '关闭预览：× 收起浮层、焦点还给触发图、open 载荷是 {src,index,total}、close 只发一次',
    image.preview.singleClosed.open === false &&
      image.preview.singleClosed.focusedBack === true &&
      image.preview.singleClosed.events.open.length === 1 &&
      image.preview.singleClosed.events.open[0].index === 0 &&
      image.preview.singleClosed.events.open[0].total === 1 &&
      String(image.preview.singleClosed.events.open[0].src).includes('photo.svg') &&
      image.preview.singleClosed.events.close === 1,
    JSON.stringify(image.preview.singleClosed),
  );

  check(
    '组内预览：从点的那张开始（2/3）、末尾停在 3/3 且下一张禁用、方向键能回退',
    image.preview.groupOpen.count === '2 / 3' &&
      String(image.preview.groupOpen.src).includes('portrait.svg') &&
      image.preview.groupOpen.single === false &&
      image.preview.groupLast.count === '3 / 3' &&
      image.preview.groupLast.next === true &&
      image.preview.groupEnd.count === '3 / 3' &&
      image.preview.groupBack.count === '2 / 3' &&
      image.preview.groupBack.next === false,
    JSON.stringify({
      open: image.preview.groupOpen,
      last: image.preview.groupLast,
      back: image.preview.groupBack,
    }),
  );

  check(
    '底部工具条：9 个按钮；缩放 100→150→200、到 400% 放大禁用；转 90° 时宽高约束对调；还原回 100%；双击回 2 倍；换图归位；滚轮放大',
    image.preview.toolbar.tools === 9 &&
      image.preview.toolbar.init.zoom === '100%' &&
      image.preview.toolbar.init.reset === true &&
      image.preview.toolbar.plus1.zoom === '150%' &&
      image.preview.toolbar.plus2.zoom === '200%' &&
      image.preview.toolbar.max.zoom === '400%' &&
      image.preview.toolbar.max.zoomIn === true &&
      image.preview.toolbar.max.zoomOut === false &&
      image.preview.toolbar.rot.transform === 'rotate(90deg) scale(4)' &&
      image.preview.toolbar.rot.maxWNum === image.preview.toolbar.rot.frameH &&
      image.preview.toolbar.rot.maxHNum === image.preview.toolbar.rot.frameW &&
      image.preview.toolbar.rotBack.transform === 'rotate(0deg) scale(4)' &&
      image.preview.toolbar.rotBack.maxW === '' &&
      image.preview.toolbar.reset.zoom === '100%' &&
      image.preview.toolbar.reset.transform === 'rotate(0deg) scale(1)' &&
      image.preview.toolbar.reset.reset === true &&
      image.preview.toolbar.dbl.zoom === '200%' &&
      image.preview.toolbar.next.zoom === '100%' &&
      image.preview.toolbar.wheel.zoom === '150%',
    JSON.stringify(image.preview.toolbar),
  );

  check(
    '旋转方向：左转落 rotate(-90deg)（不折成 270，否则过渡顺时针绕 3/4 圈）；攒到 -270 后还原回 0',
    image.preview.rotateDir.before === 'rotate(0deg)' &&
      image.preview.rotateDir.oneLeft === 'rotate(-90deg)' &&
      image.preview.rotateDir.threeLeft === 'rotate(-270deg)' &&
      image.preview.rotateDir.after === 'rotate(0deg)',
    JSON.stringify(image.preview.rotateDir),
  );

  check(
    '拖动平移：放大后拖得动（位移跟着指针走）、拖到边就停（框始终被图铺满）、松手在遮罩上不关浮层',
    image.preview.drag.before.pannable === true &&
      image.preview.drag.before.x === 0 &&
      image.preview.drag.before.y === 0 &&
      image.preview.drag.moved.x > 0 &&
      image.preview.drag.moved.y > 0 &&
      image.preview.drag.moved.reset === false &&
      image.preview.drag.moved.covered === true &&
      image.preview.drag.capped.covered === true &&
      image.preview.drag.cappedAgain.covered === true &&
      image.preview.drag.cappedAgain.x === image.preview.drag.capped.x &&
      image.preview.drag.cappedAgain.y === image.preview.drag.capped.y &&
      image.preview.drag.releasedOutside.open === true,
    JSON.stringify(image.preview.drag),
  );

  check(
    '位移归零：还原把位移清掉并退出可拖状态；100% 时图没超出框，拖不动；换图也归零',
    image.preview.drag.afterReset.x === 0 &&
      image.preview.drag.afterReset.y === 0 &&
      image.preview.drag.afterReset.pannable === false &&
      image.preview.drag.atHome.x === 0 &&
      image.preview.drag.atHome.y === 0 &&
      image.preview.drag.panned.pannable === true &&
      image.preview.drag.panned.x > 0 &&
      image.preview.drag.afterSwitch.x === 0 &&
      image.preview.drag.afterSwitch.y === 0 &&
      image.preview.drag.afterSwitch.pannable === false,
    JSON.stringify({
      reset: image.preview.drag.afterReset,
      home: image.preview.drag.atHome,
      panned: image.preview.drag.panned,
      switched: image.preview.drag.afterSwitch,
    }),
  );

  check(
    '组上 loop：末尾的下一张仍可点、绕回第一张；Esc 关掉浮层',
    image.preview.loopOpen.count === '2 / 2' &&
      image.preview.loopOpen.next === false &&
      image.preview.loopWrap.count === '1 / 2' &&
      image.preview.afterEsc.open === false,
    JSON.stringify({
      loop: image.preview.loopOpen,
      wrap: image.preview.loopWrap,
      esc: image.preview.afterEsc,
    }),
  );

  check(
    'mc-image.open()：按钮一调就开（不用点击图本身）、焦点落关闭按钮、关掉后焦点回到那个按钮',
    image.method.byButton.open === true &&
      image.method.byButton.focusedClose === true &&
      image.method.byButton.count === '' &&
      String(image.method.byButton.src).includes('photo.svg') &&
      image.method.focusedAfter === 'pv-open-btn',
    JSON.stringify({ opened: image.method.byButton, focusedAfter: image.method.focusedAfter }),
  );

  check(
    'mc-image-group.open(index)：0 → 1/3、1 → 2/3、越界 9 → 3/3、-3 → 1/3（序号只数能进相册的成员）',
    image.method.fromFirst.count === '1 / 3' &&
      image.method.fromSecond.count === '2 / 3' &&
      image.method.overflow.count === '3 / 3' &&
      image.method.negative.count === '1 / 3' &&
      String(image.method.fromSecond.src).includes('portrait.svg'),
    JSON.stringify({
      first: image.method.fromFirst,
      second: image.method.fromSecond,
      overflow: image.method.overflow,
      negative: image.method.negative,
    }),
  );

  check(
    'preview-disabled 的图自己 open() 只看自己（不进别人的相册，也不被组当成成员）；空组 open() 什么也不开',
    image.method.offSelf.open === true &&
      image.method.offSelf.count === '' &&
      image.method.offSelf.single === true &&
      image.method.empty === true,
    JSON.stringify({ offSelf: image.method.offSelf, empty: image.method.empty }),
  );

  check(
    'mc-image-preview 不渲染：宿主 display:none、盒子 0×0、shadow 里没有 slot / part / 控件、也聚焦不到；open / close 挂在宿主上',
    image.entry.box.display === 'none' &&
      image.entry.box.w === 0 &&
      image.entry.box.h === 0 &&
      image.entry.box.slots === 0 &&
      image.entry.box.parts === 0 &&
      image.entry.box.controls === 0 &&
      image.entry.box.tabindex === null &&
      image.entry.box.hasOpen === true &&
      image.entry.box.hasClose === true,
    JSON.stringify(image.entry.box),
  );

  check(
    'open() 随便哪个按钮都能调：点按钮弹出整页唯一浮层、焦点落在关闭按钮、载荷 {src,index,total}',
    image.entry.opened.open === true &&
      image.entry.opened.focusedClose === true &&
      image.entry.opened.count === '' &&
      String(image.entry.opened.src).includes('photo.svg') &&
      image.entry.closed.events.open.length === 1 &&
      image.entry.closed.events.open[0].index === 0 &&
      image.entry.closed.events.open[0].total === 1 &&
      String(image.entry.closed.events.open[0].src).includes('photo.svg'),
    JSON.stringify({ opened: image.entry.opened, events: image.entry.closed.events }),
  );

  check(
    '关掉之后焦点回到调用它的那个按钮（没传 opener 也能还），close 只发一次、也不会自己重开',
    image.entry.closed.open === false &&
      image.entry.closed.events.close === 1 &&
      image.entry.closed.events.open.length === 1 &&
      image.entry.closed.focused === 'tp-btn',
    JSON.stringify({
      open: image.entry.closed.open,
      close: image.entry.closed.events.close,
      focused: image.entry.closed.focused,
    }),
  );

  check(
    '多张：子元素就是相册（1/2 → 2/2），loop 时末尾再往前绕回 1/2',
    image.entry.album.opened.count === '1 / 2' &&
      image.entry.album.next.count === '2 / 2' &&
      image.entry.album.wrap.count === '1 / 2',
    JSON.stringify(image.entry.album),
  );

  check(
    'open(index)：越界夹到两端（9 → 2/2、-3 → 1/2）；一张图都没有时什么也不做；close() 能关',
    image.entry.direct.empty.open === false &&
      image.entry.direct.overflow.count === '2 / 2' &&
      image.entry.direct.negative.count === '1 / 2' &&
      image.entry.direct.afterClose.open === false,
    JSON.stringify(image.entry.direct),
  );
}
