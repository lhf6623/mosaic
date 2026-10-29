/**
 * mc-qrcode · 二维码：默认 canvas 渲染与 160px 边长、空内容不画、
 * level / value / margin / color / background 重绘、svg 渲染（viewBox / path / 隐藏 canvas）、
 * 中间图案（底座圆角 + 图片）、超容量标 data-error、toDataURL 两条通道、::part(image)。
 * 编码核心的矩阵正确性在写它时做过交叉验证（与成熟实现逐位一致 + jsQR 解码还原），
 * 这里只验组件接线。跑法 node tests/smoke.mjs qrcode。
 */

export default async function run({ page, visit, check }) {
  await visit(page, '/index.html?qrcode=1#/packages/qrcode/page.html');
  const pageRegistered = await page
    .waitForFunction(() => !!customElements.get('mc-qrcode'), { timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  /* 搭探针：固定容器 + 一批独立实例；纯色方块当 logo（中心点颜色稳定，不受图形细节影响） */
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'qr-probe';
    host.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:8px;' +
      'display:flex;flex-wrap:wrap;gap:8px;width:640px';
    document.body.append(host);

    const LOGO =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%230f766e'/%3E%3C/svg%3E";

    const put = (id, attrs = {}) => {
      const el = document.createElement('mc-qrcode');
      el.id = id;
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      host.append(el);
      return el;
    };

    put('qr-plain', { value: 'https://mofas.dev/mosaic/qrcode' });
    put('qr-empty');
    put('qr-level-h', { value: 'https://mofas.dev/mosaic/qrcode', level: 'H' });
    put('qr-svg', { value: 'https://mofas.dev/mosaic/qrcode', renderer: 'svg' });
    put('qr-color', {
      value: 'https://mofas.dev/mosaic/qrcode',
      color: '#0f766e',
      background: '#f0fdfa',
    });
    put('qr-margin0', { value: 'https://mofas.dev/mosaic/qrcode', margin: '0' });
    put('qr-logo', { value: 'https://mofas.dev/mosaic/qrcode', logo: LOGO });
    put('qr-logo-svg', {
      value: 'https://mofas.dev/mosaic/qrcode',
      renderer: 'svg',
      logo: LOGO,
      'logo-background': '#ffffff',
      'logo-radius': '8',
    });
    put('qr-overflow', { value: 'x'.repeat(4000), level: 'H' });
    put('qr-export', { value: 'https://mofas.dev/mosaic/qrcode' });
    put('qr-export-svg', { value: 'https://mofas.dev/mosaic/qrcode', renderer: 'svg' });
    put('qr-change', { value: 'https://mofas.dev/mosaic/qrcode' });
    put('qr-part', { value: 'https://mofas.dev/mosaic/qrcode' });

    const style = document.createElement('style');
    style.id = 'qr-part-style';
    style.textContent = '#qr-part::part(image) { border-radius: 18px; }';
    document.head.append(style);
  });

  await page
    .waitForFunction(
      () => [...document.querySelectorAll('#qr-probe mc-qrcode')].every((el) => !!el.shadowRoot),
      { timeout: 5000 },
    )
    .catch(() => {});

  /* logo 是异步解码的，等它落笔 */
  await page.waitForTimeout(300);

  const base = await page.evaluate(() => {
    const snap = (id) => {
      const el = document.getElementById(id);
      const root = el.shadowRoot;
      const canvas = root.querySelector('canvas');
      const svg = root.querySelector('svg');
      const rect = el.getBoundingClientRect();
      const ctx = canvas.width ? canvas.getContext('2d') : null;
      const dpr = canvas.width && rect.width ? canvas.width / rect.width : 0;

      /* 全画布统计：深色像素数 + 第一个深色 / 浅色样本，比点采样稳 */
      const stats = () => {
        if (!ctx) return { dark: 0, sample: null, light: null, corner: null };
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let dark = 0;
        let sample = null;
        let light = null;
        for (let i = 0; i < data.length; i += 4) {
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (lum < 128) {
            dark++;
            if (!sample) sample = [data[i], data[i + 1], data[i + 2]];
          } else if (lum > 245 && !light) {
            light = [data[i], data[i + 1], data[i + 2]];
          }
        }
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return { dark, sample, light, corner: [d[0], d[1], d[2], d[3]] };
      };

      const center = (() => {
        if (!ctx) return null;
        const d = ctx.getImageData(
          Math.round(canvas.width / 2),
          Math.round(canvas.height / 2),
          1,
          1,
        ).data;
        return [d[0], d[1], d[2], d[3]];
      })();

      return {
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        canvasW: canvas.width,
        canvasShown: getComputedStyle(canvas).display !== 'none',
        svgShown: getComputedStyle(svg).display !== 'none',
        svgBox: svg.getAttribute('viewBox'),
        svgPath: (svg.querySelector('path')?.getAttribute('d') ?? '').length,
        svgImages: svg.querySelectorAll('image').length,
        svgRects: [...svg.querySelectorAll('rect')].map((r) => ({
          rx: r.getAttribute('rx'),
          fill: r.getAttribute('fill'),
        })),
        parts: [...new Set([...root.querySelectorAll('[part]')].map((n) => n.getAttribute('part')))].sort(),
        error: el.getAttribute('data-error'),
        center,
        ...stats(),
      };
    };
    return {
      plain: snap('qr-plain'),
      empty: snap('qr-empty'),
      levelH: snap('qr-level-h'),
      svg: snap('qr-svg'),
      color: snap('qr-color'),
      margin0: snap('qr-margin0'),
      logo: snap('qr-logo'),
      logoSvg: snap('qr-logo-svg'),
      overflow: snap('qr-overflow'),
      part: snap('qr-part'),
    };
  });

  check(
    '文档页注册 mc-qrcode；默认 160×160、canvas 按 DPR 撑满、svg 默认隐藏；part 只有 image',
    pageRegistered &&
      base.plain.w === 160 &&
      base.plain.h === 160 &&
      base.plain.canvasW >= 160 &&
      base.plain.canvasW % 160 === 0 &&
      base.plain.canvasShown === true &&
      base.plain.svgShown === false &&
      JSON.stringify(base.plain.parts) === JSON.stringify(['image']),
    JSON.stringify({ pageRegistered, plain: base.plain }),
  );

  check(
    '空 value 不绘制（canvas 归零、没有路径）；有内容时灰阶分明：深色模块够多、静区是白',
    base.empty.canvasW === 0 &&
      base.plain.canvasW > 0 &&
      base.plain.dark > 500 &&
      base.plain.light !== null &&
      base.plain.svgPath === 0,
    JSON.stringify({ empty: base.empty, plain: base.plain }),
  );

  check(
    'level="H" 与默认 M 渲染出不同图（同内容更高纠错 → 版本更大、格子更密）',
    base.levelH.dark !== base.plain.dark && base.levelH.dark > 500,
    JSON.stringify({ m: base.plain.dark, h: base.levelH.dark }),
  );

  check(
    'renderer="svg"：canvas 隐藏、svg 可见，viewBox = 模块数 + 静区（含 4 模块边距）、path 有内容',
    base.svg.canvasShown === false &&
      base.svg.svgShown === true &&
      /^0 0 \d+ \d+$/.test(base.svg.svgBox ?? '') &&
      Number(base.svg.svgBox.split(' ')[2]) > 21 &&
      base.svg.svgPath > 50,
    JSON.stringify(base.svg),
  );

  check(
    'color / background 生效：深色样本取 color、浅色样本取 background；margin=0 时左上角不再是白',
    base.color.sample !== null &&
      base.color.sample[0] === 0x0f &&
      base.color.sample[1] === 0x76 &&
      base.color.sample[2] === 0x6e &&
      base.color.light !== null &&
      base.color.light[0] === 0xf0 &&
      base.color.light[1] === 0xfd &&
      base.color.light[2] === 0xfa &&
      base.margin0.corner.slice(0, 3).every((v) => v < 128),
    JSON.stringify({
      color: { sample: base.color.sample, light: base.color.light },
      margin0Corner: base.margin0.corner,
    }),
  );

  check(
    'logo：canvas 中心是图案色（底座圆角矩形 + 图片绘上去）；svg 侧是 <rect rx> + <image>',
    base.logo.center !== null &&
      base.logo.center[0] === 0x0f &&
      base.logo.center[1] === 0x76 &&
      base.logo.center[2] === 0x6e &&
      base.logoSvg.svgImages === 1 &&
      base.logoSvg.svgRects.some((r) => r.rx !== null && Number(r.rx) > 0 && r.fill === '#ffffff'),
    JSON.stringify({ center: base.logo.center, rects: base.logoSvg.svgRects }),
  );

  check(
    '内容超出容量：清掉图形并给宿主标 data-error="capacity"',
    base.overflow.error === 'capacity' && base.overflow.canvasW === 0,
    JSON.stringify({ error: base.overflow.error, w: base.overflow.canvasW }),
  );

  const exported = await page.evaluate(() => {
    const png = document.getElementById('qr-export').toDataURL();
    const svg = document.getElementById('qr-export-svg').toDataURL();
    return {
      png: png.slice(0, 22),
      pngLength: png.length,
      svg: svg.slice(0, 40),
      svgHasTag: decodeURIComponent(svg.slice(svg.indexOf(',') + 1)).includes('<svg'),
    };
  });
  check(
    'toDataURL()：canvas 通道给 PNG data URL，svg 通道给 image/svg+xml 且内容是完整 <svg>',
    exported.png === 'data:image/png;base64,' &&
      exported.pngLength > 1000 &&
      exported.svg.startsWith('data:image/svg+xml;charset=utf-8,') &&
      exported.svgHasTag,
    JSON.stringify(exported),
  );

  /* ---------- 下载 ---------- */
  const downloaded = await page.evaluate(() => {
    const calls = [];
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      calls.push({ name: this.download, href: this.href.slice(0, 32) });
    };
    const canvasOk = document.getElementById('qr-export').download();
    const svgOk = document.getElementById('qr-export-svg').download('my-code.svg');
    const emptyOk = document.getElementById('qr-empty').download();
    HTMLAnchorElement.prototype.click = original;
    return { canvasOk, svgOk, emptyOk, calls };
  });
  check(
    'download()：canvas 存 PNG、svg 存 .svg（文件名可指定）；空内容返回 false 且不触发下载',
    downloaded.canvasOk === true &&
      downloaded.svgOk === true &&
      downloaded.emptyOk === false &&
      downloaded.calls.length === 2 &&
      downloaded.calls[0].name === 'qrcode.png' &&
      downloaded.calls[0].href.startsWith('data:image/png;base64,') &&
      downloaded.calls[1].name === 'my-code.svg' &&
      downloaded.calls[1].href.startsWith('data:image/svg+xml'),
    JSON.stringify(downloaded),
  );

  const redraw = await page.evaluate(async () => {
    const el = document.getElementById('qr-change');
    const grab = () => {
      const c = el.shadowRoot.querySelector('canvas');
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum = (sum + data[i] * (i + 1)) % 1e9;
      return sum;
    };
    const before = grab();
    el.setAttribute('value', 'https://example.com/a-totally-different-payload');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const after = grab();
    el.setAttribute('value', 'https://example.com/short');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const third = grab();
    return { before, after, third, changed: before !== after && after !== third };
  });
  check(
    '改 value 会重绘（三份不同内容的画布指纹互不相同）',
    redraw.before > 0 && redraw.after > 0 && redraw.third > 0 && redraw.changed,
    JSON.stringify(redraw),
  );

  const styling = await page.evaluate(async () => {
    const themed = document.createElement('mc-qrcode');
    themed.id = 'qr-themed';
    themed.setAttribute('value', 'https://mofas.dev/mosaic/qrcode');
    themed.style.setProperty('--mc-qrcode-size', '200px');
    document.getElementById('qr-probe').append(themed);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const box = themed.getBoundingClientRect();
    return {
      radius: getComputedStyle(document.getElementById('qr-part').shadowRoot.querySelector('canvas'))
        .borderRadius,
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  });
  check(
    '::part(image) 改得到内部画布（圆角 18px）；--mc-qrcode-size 改得到宿主边长（200×200）',
    styling.radius === '18px' && styling.width === 200 && styling.height === 200,
    JSON.stringify(styling),
  );
}
