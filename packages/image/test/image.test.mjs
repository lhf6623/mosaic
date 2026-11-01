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
        // 没开 preview 的图不该带任何交互语义（开了的那几张见后面的预览断言）
        ariaWithoutPreview: list
          .filter((el) => !el.hasAttribute('preview'))
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
        '<mc-image id="i-natural" src="./packages/image/demos/photo.svg" alt="山间的日出"></mc-image>',
        '<mc-image id="i-box" src="./packages/image/demos/photo.svg" fit="contain" style="width:160px;height:100px"></mc-image>',
        '<mc-image id="i-cover" src="./packages/image/demos/photo.svg" fit="cover" style="width:160px;height:100px"></mc-image>',
        '<mc-image id="i-fill" src="./packages/image/demos/photo.svg" fit="fill" style="width:160px;height:100px"></mc-image>',
        '<div id="i-ratio-wrap" style="width:200px"><mc-image id="i-ratio" src="./packages/image/demos/photo.svg" ratio="1/1"></mc-image></div>',
        '<div id="i-ratio-bad-wrap" style="width:200px"><mc-image id="i-ratio-bad" src="./packages/image/demos/photo.svg" ratio="宽高比"></mc-image></div>',
        '<div id="ref-lg" style="border-radius: var(--mc-radius-lg)"></div>',
        '<div id="ref-full" style="border-radius: var(--mc-radius-full)"></div>',
        '<mc-image id="i-radius-lg" src="./packages/image/demos/photo.svg" radius="lg" style="width:80px;height:80px"></mc-image>',
        '<mc-image id="i-radius-full" src="./packages/image/demos/photo.svg" radius="full" style="width:80px;height:80px"></mc-image>',
        '<mc-image id="i-radius-none" src="./packages/image/demos/photo.svg" style="width:80px;height:80px"></mc-image>',
        '<mc-image id="i-broken" src="data:image/png;base64,AAAA" alt="坏图" style="width:160px;height:100px"></mc-image>',
        '<mc-image id="i-slot" src="data:image/png;base64,AAAA" alt="坏图" style="width:160px;height:100px"><span>重试</span></mc-image>',
        '<mc-image id="i-lazy" src="./packages/image/demos/photo.svg" lazy style="width:80px"></mc-image>',
        '<mc-image id="i-eager" src="./packages/image/demos/photo.svg" style="width:80px"></mc-image>',
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
        el.setAttribute('src', './packages/image/demos/photo.svg');
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
          '<mc-image id="pv-single" src="./packages/image/demos/photo.svg" alt="单张" preview style="width:80px;height:60px"></mc-image>',
          '<mc-image id="pv-plain" src="./packages/image/demos/photo.svg" alt="不可点" style="width:80px;height:60px"></mc-image>',
          '<mc-image id="pv-broken-preview" src="data:image/png;base64,AAAA" alt="坏图" preview style="width:80px;height:60px"></mc-image>',
          '<mc-image-group id="pv-group">',
          '  <mc-image id="pv-a" src="./packages/image/demos/photo.svg" alt="第一张" preview style="width:80px;height:60px"></mc-image>',
          '  <mc-image id="pv-b" src="./packages/image/demos/portrait.svg" alt="第二张" preview style="width:80px;height:60px"></mc-image>',
          '  <mc-image id="pv-c" src="./packages/image/demos/photo.svg" alt="第三张" preview style="width:80px;height:60px"></mc-image>',
          '</mc-image-group>',
          '<mc-image-group id="pv-loop" loop>',
          '  <mc-image id="pv-l1" src="./packages/image/demos/photo.svg" alt="循环一" preview style="width:80px;height:60px"></mc-image>',
          '  <mc-image id="pv-l2" src="./packages/image/demos/portrait.svg" alt="循环二" preview style="width:80px;height:60px"></mc-image>',
          '</mc-image-group>',
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
          const layer = document.querySelector('.mc-image-preview');
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
          const layer = document.querySelector('.mc-image-preview');
          layer.querySelector(dir > 0 ? '.mcp-next' : '.mcp-prev').click();
          return window.__pvRead();
        };
        window.__pvKey = (key) => {
          document
            .querySelector('[data-mc-image-preview]')
            .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
          return window.__pvRead();
        };
      });

      await page
        .waitForFunction(
          () => {
            const ids = ['pv-single', 'pv-a', 'pv-b', 'pv-c', 'pv-l1', 'pv-l2', 'pv-slot-named'];
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
          plain: attrs('pv-plain'),
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
        return { exists: !!document.querySelector('.mc-image-preview') };
      });

      const singleOpen = await page.evaluate(() => ({
        ...window.__pvClick('pv-single'),
        focused: document.activeElement?.classList?.contains('mcp-close') ?? false,
      }));

      await page.evaluate(() => {
        document.querySelector('.mc-image-preview .mcp-close').click();
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

      const loopOpen = await page.evaluate(() => window.__pvClick('pv-l2'));
      const loopWrap = await page.evaluate(() => window.__pvStep(1));

      await page.evaluate(() => window.__pvKey('Escape'));
      await page.waitForTimeout(150);
      const afterEsc = await page.evaluate(() => window.__pvRead());

      await page.evaluate(() => document.getElementById('image-preview-probe')?.remove());
      return {
        before,
        brokenClick,
        singleOpen,
        singleClosed,
        groupOpen,
        groupLast,
        groupEnd,
        groupBack,
        loopOpen,
        loopWrap,
        afterEsc,
      };
    })();

    page.off('response', onResponse);
    page.off('pageerror', onError);
    return { tokens, overview, probe, events, runtime, preview, failed };
  })();

  check(
    'mc-image 注册并渲染：默认 + fallback 两个插槽、image / fallback 两个 part、不开 preview 时没有交互元素与 role / aria-*',
    image.overview.upgraded &&
      image.overview.total >= 8 &&
      JSON.stringify(image.overview.slotCounts) === JSON.stringify([2]) &&
      JSON.stringify(image.overview.parts) === JSON.stringify(['fallback', 'image']) &&
      image.overview.controls === 0 &&
      image.overview.ariaWithoutPreview === false &&
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
    'preview 只把「有图 + 开了 preview」变成按钮：role=button / tabindex=0；普通图与坏图都没有',
    image.preview.before.single.role === 'button' &&
      image.preview.before.single.tabindex === '0' &&
      image.preview.before.plain.role === null &&
      image.preview.before.plain.tabindex === null &&
      image.preview.before.broken.role === null &&
      image.preview.before.broken.tabindex === null,
    JSON.stringify(image.preview.before),
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
}
