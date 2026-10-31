/**
 * mc-code-editor · 代码编辑器：懒加载、语法高亮、行号、值 / 事件、受控、状态、自适应高度、降级（packages/code-editor）
 */

const PAGE = '/index.html#/packages/code-editor/page.html';

export default async function run({ page, newPage, visit, goHash, check }) {
  /** 取一个可见的编辑器实例（页面里还有 doc-example 收起的编辑器，尺寸为 0） */
  const installHelpers = (target) =>
    target.evaluate(() => {
      window.__findVisible = (value) =>
        window.__deepAll('mc-code-editor').find(
          (el) => el.getBoundingClientRect().width > 0 && el.value.startsWith(value),
        );
    });
  /* ------------------------------------------------------------------ *
   * 1. 文档页：懒加载 + 高亮 + 行号
   * ------------------------------------------------------------------ */
  await visit(page, PAGE);
  await installHelpers(page);
  await page
    .waitForFunction(
      () => {
        const editors = window.__deepAll('mc-code-editor');
        return (
          editors.length >= 12 &&
          editors.filter((el) => el.getBoundingClientRect().width > 0).length >= 6
        );
      },
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1500);

  const pageState = await page.evaluate(() => {
    const all = window.__deepAll('mc-code-editor');
    const visible = all.filter((el) => el.getBoundingClientRect().width > 0);
    const hidden = all.filter((el) => el.getBoundingClientRect().width === 0);
    const count = (el, sel) => el.shadowRoot?.querySelectorAll(sel).length ?? 0;
    return {
      total: all.length,
      visible: visible.length,
      hidden: hidden.length,
      mounted: visible.filter((el) => !!el.shadowRoot?.querySelector('.CodeMirror')).length,
      fallbacks: all.filter((el) => el.hasAttribute('data-fallback')).length,
      lineNumbers: visible.filter((el) => count(el, '.CodeMirror-linenumber') > 0).length,
      htmlTags: visible.filter((el) => count(el, '.cm-tag') > 0).length,
      loadingHidden: visible.every(
        (el) => el.shadowRoot?.querySelector('.mc-loading')?.hasAttribute('hidden') ?? false,
      ),
    };
  });

  check(
    '文档页渲染出 6 个可见编辑器 + 6 个 doc-example 的收起编辑器',
    pageState.visible === 6 && pageState.hidden === 6,
    JSON.stringify({ total: pageState.total, visible: pageState.visible, hidden: pageState.hidden }),
  );
  check(
    '可见实例都挂上了 CodeMirror，没有降级',
    pageState.mounted === pageState.visible && pageState.fallbacks === 0,
    JSON.stringify({ mounted: pageState.mounted, fallbacks: pageState.fallbacks }),
  );
  check(
    '行号、HTML 标签高亮都出来了',
    pageState.lineNumbers === pageState.visible && pageState.htmlTags >= 3,
    JSON.stringify(pageState),
  );
  check(
    '加载态在挂上编辑器后收起',
    pageState.loadingHidden,
    String(pageState.loadingHidden),
  );

  /* ------------------------------------------------------------------ *
   * 1b. 语言动态切换：一个编辑器 + 分段切换器，换 language 就换高亮语法
   * ------------------------------------------------------------------ */
  const switchLang = async (value) => {
    await page.evaluate((lang) => {
      const demo = window.__deep('demo-code-editor-language');
      const tab = demo?.shadowRoot?.querySelector(`mc-tab[value="${lang}"]`);
      tab?.shadowRoot?.querySelector('.mc-base')?.click();
    }, value);
    await page.waitForTimeout(600);
  };
  const readLanguageDemo = () =>
    page.evaluate(() => {
      const demo = window.__deep('demo-code-editor-language');
      const editor = demo?.shadowRoot?.querySelector('mc-code-editor');
      const count = (sel) => editor?.shadowRoot?.querySelectorAll(sel).length ?? 0;
      return {
        language: editor?.getAttribute('language'),
        value: editor?.value,
        keywords: count('.cm-keyword'),
        cssTokens: count('.cm-property') + count('.cm-qualifier'),
        tags: count('.cm-tag'),
      };
    });

  await switchLang('js');
  const languageJs = await readLanguageDemo();
  await switchLang('css');
  const languageCss = await readLanguageDemo();
  await switchLang('html');
  const languageHtml = await readLanguageDemo();
  check(
    '语言：分段切换器动态改 language，JS / CSS / HTML 高亮跟着换',
    languageJs.language === 'js' &&
      languageJs.value === 'const answer = 42;' &&
      languageJs.keywords > 0 &&
      languageCss.language === 'css' &&
      languageCss.value === '.card { color: red; }' &&
      languageCss.cssTokens > 0 &&
      languageHtml.language === 'html' &&
      languageHtml.tags > 0,
    JSON.stringify({ languageJs, languageCss, languageHtml }),
  );

  /* ------------------------------------------------------------------ *
   * 2. 受控：输入写回 value 属性，sync:value 再把数据带回来
   * ------------------------------------------------------------------ */
  const controlled = await page.evaluateHandle(() => window.__findVisible('<p>改这里'));
  const controlledBox = await controlled.evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(controlledBox.x, controlledBox.y);
  await page.keyboard.type('X');
  await page.waitForTimeout(400);

  const controlledState = await page.evaluate(() => {
    const demo = window.__deep('demo-code-editor-controlled');
    const editor = window.__findVisible('<p>改这里');
    return {
      value: editor?.value,
      attr: editor?.getAttribute('value'),
      text: demo?.shadowRoot?.querySelector('.text-sm')?.textContent?.trim() ?? '',
    };
  });
  check(
    '受控：输入写回 value 属性，sync:value 更新数据（页面文案跟着变）',
    !!controlledState.value?.endsWith('X') &&
      controlledState.attr === controlledState.value &&
      /\d+ 个字符/.test(controlledState.text),
    JSON.stringify(controlledState),
  );

  /* ------------------------------------------------------------------ *
   * 3. 事件：input 每次输入、change 失焦才发；降级路径也要有同一套
   * ------------------------------------------------------------------ */
  const events = await page.evaluateHandle(() => window.__findVisible('<p>在这里打字'));
  const eventsBox = await events.evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(eventsBox.x, eventsBox.y);
  await page.keyboard.type('Y');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  const eventState = await page.evaluate(() => {
    const demo = window.__deep('demo-code-editor-events');
    const editor = window.__findVisible('<p>在这里打字');
    return {
      value: editor?.value,
      text: demo?.shadowRoot?.querySelector('.text-sm')?.textContent?.trim() ?? '',
    };
  });
  check(
    '事件：input 带 data.value，change 在失焦且值变过时发（页面文案跟着变）',
    !!eventState.value?.endsWith('Y') &&
      /input 1 次/.test(eventState.text) &&
      eventState.text.includes('<p>在这里打字</p>Y'),
    JSON.stringify(eventState),
  );

  /* ------------------------------------------------------------------ *
   * 4. 状态切换器：正常 / 只读 / 禁用 / 校验失败
   * ------------------------------------------------------------------ */
  const switchState = async (value) => {
    await page.evaluate((state) => {
      const demo = window.__deep('demo-code-editor-states');
      const tab = demo?.shadowRoot?.querySelector(`mc-tab[value="${state}"]`);
      tab?.shadowRoot?.querySelector('.mc-base')?.click();
    }, value);
    await page.waitForTimeout(500);
  };
  const readStateDemo = () =>
    page.evaluate(() => {
      const demo = window.__deep('demo-code-editor-states');
      const editor = demo?.shadowRoot?.querySelector('mc-code-editor');
      return {
        value: editor?.value,
        readonly: editor?.hasAttribute('readonly') ?? false,
        disabled: editor?.hasAttribute('disabled') ?? false,
        invalid: editor?.hasAttribute('invalid') ?? false,
      };
    });

  const normalState = await readStateDemo();
  check(
    '状态：默认正常，readonly / disabled / invalid 三个布尔属性都不在',
    normalState.value === '<p>正常：可以编辑</p>' &&
      !normalState.readonly &&
      !normalState.disabled &&
      !normalState.invalid,
    JSON.stringify(normalState),
  );

  await switchState('readonly');
  const readonlyState = await readStateDemo();
  /* 点进编辑器打一个字：readonly 只聚焦，不改值 */
  const readonlyBox = await page.evaluate(() => {
    const demo = window.__deep('demo-code-editor-states');
    const editor = demo?.shadowRoot?.querySelector('mc-code-editor');
    editor?.scrollIntoView({ block: 'center' });
    const r = editor?.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(readonlyBox.x, readonlyBox.y);
  await page.keyboard.type('Z');
  await page.waitForTimeout(250);
  const readonlyAfter = await page.evaluate(() => {
    const demo = window.__deep('demo-code-editor-states');
    return demo?.shadowRoot?.querySelector('mc-code-editor')?.value;
  });
  check(
    'readonly：可聚焦但打字不改变值',
    readonlyState.readonly &&
      !readonlyState.disabled &&
      readonlyAfter === '<p>只读：可以选中和复制</p>',
    JSON.stringify({ readonlyState, readonlyAfter }),
  );

  await switchState('disabled');
  const disabledState = await readStateDemo();
  check(
    'disabled：状态切过去后 disabled 属性在、其余状态位摘掉',
    disabledState.disabled && !disabledState.readonly && !disabledState.invalid,
    JSON.stringify(disabledState),
  );

  await switchState('invalid');
  const invalidState = await readStateDemo();
  check(
    'invalid：状态切过去后 invalid 属性在、其余状态位摘掉',
    invalidState.invalid && !invalidState.readonly && !invalidState.disabled,
    JSON.stringify(invalidState),
  );

  await switchState('normal');

  /* ------------------------------------------------------------------ *
   * 5. auto-resize：内容变高，宿主跟着变高
   * ------------------------------------------------------------------ */
  const auto = await page.evaluateHandle(() => window.__findVisible('<div>\n  <p>改这几行'));
  const autoBefore = await auto.evaluate((el) => Math.round(el.getBoundingClientRect().height));
  const autoBox = await auto.evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(autoBox.x, autoBox.y);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('<p>new</p>');
  await page.waitForTimeout(500);
  const autoAfter = await auto.evaluate((el) => Math.round(el.getBoundingClientRect().height));
  check(
    'auto-resize：输入新行后宿主高度变大',
    autoAfter > autoBefore,
    `${autoBefore}px → ${autoAfter}px`,
  );

  /* ------------------------------------------------------------------ *
   * 6. 主题：color-scheme 一换，语法色跟着换
   * ------------------------------------------------------------------ */
  const theme = await page.evaluate(() => {
    /* 语言 demo 现在可切换（切完停在 HTML），别绑死某个编辑器的值：取任意可见编辑器里的 keyword */
    const keyword = window
      .__deepAll('mc-code-editor')
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => el.shadowRoot?.querySelector('.cm-keyword'))
      .find(Boolean);
    const original = document.documentElement.dataset.theme;
    const read = () => (keyword ? getComputedStyle(keyword).color : '');
    const light = read();
    document.documentElement.dataset.theme = 'dark';
    const dark = read();
    if (original === undefined) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = original;
    return { light, dark };
  });
  check(
    '主题：light-dark() 跟随 color-scheme 换语法色',
    !!theme.light && !!theme.dark && theme.light !== theme.dark,
    JSON.stringify(theme),
  );

  /* ------------------------------------------------------------------ *
   * 7. 懒加载：收起在 doc-example 里的编辑器，没有打开代码区就不该下 CM
   * ------------------------------------------------------------------ */
  await goHash('packages/button/page.html');
  await page.waitForTimeout(500);
  const lazyBefore = await page.evaluate(() => {
    const demo = window.__deep('doc-example');
    const editor = demo?.shadowRoot?.querySelector('mc-code-editor');
    return {
      exists: !!editor,
      cm: !!editor?.shadowRoot?.querySelector('.CodeMirror'),
      hidden: demo?.shadowRoot?.querySelector('.panel')?.hasAttribute('hidden'),
    };
  });
  await page.evaluate(() => {
    const demo = window.__deep('doc-example');
    demo?.shadowRoot?.querySelector('.actions mc-button[title="查看代码"]')?.click();
  });
  await page
    .waitForFunction(
      () => {
        const demo = window.__deep('doc-example');
        return !!demo?.shadowRoot?.querySelector('mc-code-editor .CodeMirror');
      },
      { timeout: 10000 },
    )
    .catch(() => {});
  const lazyOpen = await page.evaluate(() => {
    const demo = window.__deep('doc-example');
    const editor = demo?.shadowRoot?.querySelector('mc-code-editor');
    return {
      cm: !!editor?.shadowRoot?.querySelector('.CodeMirror'),
      value: editor?.value?.slice(0, 40),
      lineNumbers: !!editor?.shadowRoot?.querySelector('.CodeMirror-linenumber'),
    };
  });
  check(
    '懒加载：doc-example 收起时没有 CM；点开代码区后才挂上，并带出源文件',
    lazyBefore.exists && !lazyBefore.cm && lazyBefore.hidden && lazyOpen.cm && !!lazyOpen.value,
    JSON.stringify({ lazyBefore, lazyOpen }),
  );

  /* ------------------------------------------------------------------ *
   * 8. 降级：vendor 不可达时换成 textarea，值 / 事件契约不变
   * ------------------------------------------------------------------ */
  const fallbackPage = await newPage();
  /* 不靠 route.abort()：浏览器会为每个失败请求打一条 console error，跑器的「无报错」会红。
     在页面脚本之前把 vendor 的 fetch 掐掉，组件的 catch 路径看到的是同一个失败。 */
  await fallbackPage.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input?.url ?? '');
      if (url.includes('/packages/code-editor/vendor/')) {
        return Promise.reject(new Error('offline: code-editor vendor'));
      }
      return original(input, init);
    };
  });
  await visit(fallbackPage, PAGE);
  await installHelpers(fallbackPage);
  await fallbackPage
    .waitForFunction(
      () => {
        const editors = window.__deepAll('mc-code-editor').filter(
          (el) => el.getBoundingClientRect().width > 0,
        );
        return editors.length > 0 && editors.every((el) => el.hasAttribute('data-fallback'));
      },
      { timeout: 20000 },
    )
    .catch(() => {});
  await fallbackPage.waitForTimeout(300);

  const fallback = await fallbackPage.evaluate(async () => {
    const editors = window.__deepAll('mc-code-editor').filter(
      (el) => el.getBoundingClientRect().width > 0,
    );
    const target = editors.find((el) => el.value.includes('在这里打字')) ?? editors[0];
    const input = target?.shadowRoot?.querySelector('textarea');
    const seen = [];
    target?.addEventListener('input', (e) => seen.push(e.data?.value));
    input?.focus();
    input.value = '<p>fallback</p>';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      total: editors.length,
      allFallback: editors.every((el) => el.hasAttribute('data-fallback')),
      textareaVisible: input ? getComputedStyle(input).display !== 'none' : false,
      value: target?.value,
      attr: target?.getAttribute('value'),
      seen,
    };
  });
  check(
    '降级：vendor 不可达时所有可见实例换成 textarea，input 事件照常带 data.value',
    fallback.allFallback &&
      fallback.textareaVisible &&
      fallback.value === '<p>fallback</p>' &&
      fallback.attr === '<p>fallback</p>' &&
      fallback.seen.includes('<p>fallback</p>'),
    JSON.stringify(fallback),
  );

  await fallbackPage.close();
}
