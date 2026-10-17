/**
 * code-editor.mjs —— 文档站「可编辑示例」用的代码编辑器（站点内部工具，不随组件发布）。
 *
 * 编辑器是本地 vendor 的 CodeMirror 5（见 docs/vendor/codemirror/SOURCES.txt）：
 *   · 懒加载：第一次点开编辑抽屉才注入 core / 模式 / 插件，页面首屏不为它付钱；
 *   · 只在 shadow root 里生效：CM 的样式表取回后**和下面的主题一起**塞进一个 <style>，
 *     顺序在 CM 基础样式之后 —— 主题覆盖同权重靠后就能赢，不用 !important；
 *   · 失败降级成 textarea：CDN 不可达 / 取不到文件时仍然能改代码（只是没有高亮）。
 *
 * 对外只暴露一个 mountCodeEditor(container, options)，返回统一的控制器，
 * 调用方（doc-playground）不关心底下是 CM 还是 textarea。
 */

const CM_BASE = new URL('../vendor/codemirror/', import.meta.url);

/** CM 的语法配色对齐 mc-code 的 github / github-dark 主题，文档站里两种代码块看起来是一套东西 */
const THEME_CSS = `
:host {
  --cm-keyword: #d73a49;
  --cm-string: #032f62;
  --cm-comment: #6a737d;
  --cm-tag: #22863a;
  --cm-attribute: #6f42c1;
  --cm-number: #005cc5;
  --cm-variable: #e36209;
  --cm-def: #6f42c1;
}
:host([data-dark]) {
  --cm-keyword: #ff7b72;
  --cm-string: #a5d6ff;
  --cm-comment: #8b949e;
  --cm-tag: #7ee787;
  --cm-attribute: #d2a8ff;
  --cm-number: #79c0ff;
  --cm-variable: #ffa657;
  --cm-def: #d2a8ff;
}
.cm-s-default.CodeMirror {
  height: 100%;
  background: transparent;
  color: rgb(var(--mc-color-fg));
  font-family: var(--mc-font-mono, monospace);
  font-size: var(--mc-text-sm);
  line-height: 1.7;
}
.cm-s-default .CodeMirror-gutters {
  border-right: 1px solid rgb(var(--mc-color-border));
  background: transparent;
}
.cm-s-default .CodeMirror-linenumber {
  color: rgb(var(--mc-color-fg-subtle));
}
.cm-s-default .CodeMirror-cursor {
  border-left-color: rgb(var(--mc-color-fg));
}
.cm-s-default .CodeMirror-selected {
  background: rgb(var(--mc-color-primary-subtle)) !important;
}
.cm-s-default .CodeMirror-activeline-background {
  background: rgb(var(--mc-color-surface-sunken)) !important;
}
.cm-s-default .CodeMirror-matchingbracket {
  color: rgb(var(--mc-color-primary)) !important;
  text-decoration: underline;
}
.cm-s-default .cm-keyword,
.cm-s-default .cm-type,
.cm-s-default .cm-builtin {
  color: var(--cm-keyword);
}
.cm-s-default .cm-string,
.cm-s-default .cm-string-2 {
  color: var(--cm-string);
}
.cm-s-default .cm-comment {
  color: var(--cm-comment);
  font-style: normal;
}
.cm-s-default .cm-tag,
.cm-s-default .cm-name {
  color: var(--cm-tag);
}
.cm-s-default .cm-attribute,
.cm-s-default .cm-qualifier {
  color: var(--cm-attribute);
}
.cm-s-default .cm-number,
.cm-s-default .cm-atom {
  color: var(--cm-number);
}
.cm-s-default .cm-variable,
.cm-s-default .cm-variable-2,
.cm-s-default .cm-variable-3 {
  color: var(--cm-variable);
}
.cm-s-default .cm-def {
  color: var(--cm-def);
}
.cm-s-default .cm-bracket,
.cm-s-default .cm-operator {
  color: rgb(var(--mc-color-fg-muted));
}
`;

/** @type {Promise<any> | undefined} */
let cmPromise;
/** @type {Promise<string> | undefined} */
let cssPromise;

/**
 * 注入一个经典脚本并等它执行完。
 * @param {string} src
 * @returns {Promise<void>}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`编辑器脚本加载失败：${src}`));
    document.head.append(script);
  });
}

/** CM 的样式文本（基础样式 + 主题），只取一次 */
function loadCssText() {
  if (!cssPromise) {
    cssPromise = fetch(new URL('lib/codemirror.min.css', CM_BASE)).then(async (res) => {
      if (!res.ok) throw new Error(`编辑器样式加载失败：HTTP ${res.status}`);
      return (await res.text()) + '\n' + THEME_CSS;
    });
    cssPromise.catch(() => {
      cssPromise = undefined; // 失败不缓存，允许下次重试
    });
  }
  return cssPromise;
}

/** 懒加载 CodeMirror：core → 语言模式 → 两个编辑插件，只加载一次 */
async function loadCodeMirror() {
  if (!cmPromise) {
    cmPromise = (async () => {
      if (/** @type {any} */ (window).CodeMirror) return /** @type {any} */ (window).CodeMirror;
      await loadScript(new URL('lib/codemirror.min.js', CM_BASE).href);
      const files = [
        'mode/xml/xml.min.js',
        'mode/javascript/javascript.min.js',
        'mode/css/css.min.js',
        'mode/htmlmixed/htmlmixed.min.js',
        'addon/edit/closebrackets.min.js',
        'addon/edit/closetag.min.js',
      ];
      for (const file of files) await loadScript(new URL(file, CM_BASE).href);
      return /** @type {any} */ (window).CodeMirror;
    })();
    cmPromise.catch(() => {
      cmPromise = undefined; // 失败不缓存：网络抖一下就永久降级很难受
    });
  }
  return cmPromise;
}

/**
 * 把 CM 的样式塞进组件所在的 shadow root（每个实例一次）。用 <style> 而不是 adoptedStyleSheets：
 * adopted 表的优先级高于组件自己的 <style>，以后组件里想再调编辑器外观会被压住。
 * @param {ShadowRoot | HTMLElement} root
 * @param {string} css
 */
function injectStyle(root, css) {
  const scope = root instanceof ShadowRoot ? root : document.head;
  if (scope.querySelector('style[data-doc-editor]')) return;
  const style = document.createElement('style');
  style.dataset.docEditor = '';
  style.textContent = css;
  scope.append(style);
}

/**
 * @typedef {object} CodeEditor
 * @property {() => string} getValue
 * @property {(value: string) => void} setValue
 * @property {() => void} focus
 * @property {() => void} destroy
 */

/**
 * 挂一个编辑器到 container（container 必须在 shadow root 里；否则 CM 样式会退化）。
 * @param {HTMLElement} container
 * @param {{ value?: string, onChange?: () => void, onRun?: () => void }} [options]
 * @returns {Promise<CodeEditor>}
 */
export async function mountCodeEditor(container, options = {}) {
  const { value = '', onChange, onRun } = options;
  const rootNode = container.getRootNode();

  try {
    const css = await loadCssText();
    if (!container.isConnected) return inertEditor();
    injectStyle(rootNode instanceof ShadowRoot ? rootNode : document.head, css);

    const CodeMirror = await loadCodeMirror();
    if (!container.isConnected) return inertEditor();

    let muting = false;
    /** @type {any} */
    const cm = CodeMirror(container, {
      value,
      mode: 'htmlmixed',
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      viewportMargin: 20,
      autoCloseBrackets: true,
      autoCloseTags: true,
      extraKeys: {
        /* Tab 插两个空格（演示源码统一两空格缩进）；有选区时整体缩进，别把选区吃掉 */
        Tab: (/** @type {any} */ editor) => {
          if (editor.somethingSelected()) editor.indentSelection('add');
          else editor.replaceSelection(' '.repeat(editor.getOption('indentUnit')));
        },
        'Shift-Tab': (/** @type {any} */ editor) => editor.indentSelection('subtract'),
        'Cmd-Enter': () => onRun?.(),
        'Ctrl-Enter': () => onRun?.(),
        /* Tab 被编辑器吃掉了（缩进），Esc 是键盘用户离开编辑器的出口 */
        Esc: (/** @type {any} */ editor) => editor.getInputField().blur(),
      },
    });

    cm.on('change', () => {
      if (!muting) onChange?.();
    });
    /* 抽屉刚展开时量到的宽度可能还是 0：下一帧再量一次，行号 / 行宽才对 */
    requestAnimationFrame(() => cm.refresh());

    return {
      getValue: () => cm.getValue(),
      setValue: (next) => {
        muting = true;
        cm.setValue(next);
        muting = false;
      },
      focus: () => cm.focus(),
      destroy: () => {
        cm.getWrapperElement()?.remove();
      },
    };
  } catch (error) {
    console.warn('[mosaic] 编辑器加载失败，已降级为普通文本框（代码照常可改、可运行）：', error);
    if (!container.isConnected) return inertEditor();
    return mountFallback(container, { value, onChange, onRun });
  }
}

/**
 * 降级：朴素的 textarea，行内样式由 doc-playground 的 .fallback-editor 给。
 * @param {HTMLElement} container
 * @param {{ value: string, onChange?: () => void, onRun?: () => void }} options
 * @returns {CodeEditor}
 */
function mountFallback(container, { value, onChange, onRun }) {
  const textarea = document.createElement('textarea');
  textarea.className = 'fallback-editor';
  textarea.spellcheck = false;
  textarea.value = value;
  container.append(textarea);

  const onInput = () => onChange?.();
  const onKeydown = (/** @type {KeyboardEvent} */ event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onRun?.();
    } else if (event.key === 'Escape') {
      textarea.blur();
    }
  };
  textarea.addEventListener('input', onInput);
  textarea.addEventListener('keydown', onKeydown);

  return {
    getValue: () => textarea.value,
    setValue: (next) => {
      textarea.value = next;
    },
    focus: () => textarea.focus(),
    destroy: () => {
      textarea.removeEventListener('input', onInput);
      textarea.removeEventListener('keydown', onKeydown);
      textarea.remove();
    },
  };
}

/** 还没挂载就被卸载（异步加载期间切页）时用的空控制器 */
function inertEditor() {
  return {
    getValue: () => '',
    setValue: () => {},
    focus: () => {},
    destroy: () => {},
  };
}
