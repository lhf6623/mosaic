/**
 * code-editor.mjs —— 文档站「可编辑示例」的代码编辑器（站点内部工具，不随组件发布）。
 * 本地 vendor 的 CodeMirror 5：懒加载、样式只进 shadow root、失败降级成 textarea。
 * 对外只暴露 mountCodeEditor(container, options)，返回统一控制器（调用方不关心底下是 CM 还是 textarea）。
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
/* 行号列必须是不透明实底（和 .editor-host 同色）：CM 的 gutters 是叠在滚动内容之上的绝对定位层，
   横向滚动时行会被带到它下面；底色透明的话代码就从行号底下透出来，数字压在文字上。
   mc-code 的 .mc-ln 也是同一个道理（那边用 sticky + 实底）。 */
.cm-s-default .CodeMirror-gutters {
  border-right: 1px solid rgb(var(--mc-color-border));
  background-color: rgb(var(--mc-color-surface-sunken));
}
/* 横竖滚动条交汇的两个角：CM 内置是白底（.CodeMirror-gutter-filler / -scrollbar-filler），
   跟浅色 sunken 只差一点点、深色主题下直接是一块白斑，统一成编辑器底色 */
.cm-s-default .CodeMirror-gutter-filler,
.cm-s-default .CodeMirror-scrollbar-filler {
  background-color: rgb(var(--mc-color-surface-sunken));
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
/* 折叠：行号旁的三角 / 折叠后的占位符，配色跟当前主题走 */
.cm-s-default .CodeMirror-foldgutter {
  width: 0.9em;
}
.cm-s-default .CodeMirror-foldgutter-open,
.cm-s-default .CodeMirror-foldgutter-folded {
  color: rgb(var(--mc-color-fg-subtle));
}
.cm-s-default .CodeMirror-foldgutter-open:hover,
.cm-s-default .CodeMirror-foldgutter-folded:hover {
  color: rgb(var(--mc-color-fg));
}
.cm-s-default .CodeMirror-foldmarker {
  padding: 0 4px;
  border-radius: var(--mc-radius-sm, 4px);
  background-color: rgb(var(--mc-color-primary-subtle));
  color: rgb(var(--mc-color-primary));
  font-family: var(--mc-font-mono, monospace);
  line-height: 1;
  text-shadow: none;
  cursor: pointer;
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

/** CM 的样式文本（基础样式 + 折叠 / 补全样式 + 主题），只取一次 */
function loadCssText() {
  if (!cssPromise) {
    cssPromise = (async () => {
      const files = [
        'lib/codemirror.min.css',
        'addon/fold/foldgutter.min.css',
        'addon/hint/show-hint.min.css',
      ];
      const parts = [];
      for (const file of files) {
        const res = await fetch(new URL(file, CM_BASE));
        if (!res.ok) throw new Error(`编辑器样式加载失败：HTTP ${res.status}`);
        parts.push(await res.text());
      }
      return parts.join('\n') + '\n' + THEME_CSS;
    })();
    cssPromise.catch(() => {
      cssPromise = undefined; // 失败不缓存，允许下次重试
    });
  }
  return cssPromise;
}

/** 懒加载 CodeMirror：core → 语言模式 → 折叠 / 编辑辅助 / 补全插件，只加载一次 */
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
        /* 折叠：行号旁三角 + HTML 标签 / JS·CSS 括号 / 注释各自的折叠范围 */
        'addon/fold/foldcode.min.js',
        'addon/fold/foldgutter.min.js',
        'addon/fold/brace-fold.min.js',
        'addon/fold/xml-fold.min.js',
        'addon/fold/comment-fold.min.js',
        /* 写作辅助：括号配对高亮、注释切换、补全 */
        'addon/edit/matchbrackets.min.js',
        'addon/comment/comment.min.js',
        'addon/hint/show-hint.min.js',
        'addon/hint/xml-hint.min.js',
        'addon/hint/html-hint.min.js',
        'addon/hint/css-hint.min.js',
        'addon/hint/javascript-hint.min.js',
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
 * @property {() => number} getContentHeight 内容总高（px），给调用方做自适应高度
 * @property {() => void} refresh 容器尺寸变化后重排
 */

/**
 * 挂一个编辑器到 container（container 必须在 shadow root 里；否则 CM 样式会退化）。
 * @param {HTMLElement} container
 * @param {{ value?: string, onChange?: () => void, onRun?: () => void, onFold?: () => void }} [options]
 * @returns {Promise<CodeEditor>}
 */
export async function mountCodeEditor(container, options = {}) {
  const { value = '', onChange, onRun, onFold } = options;
  const rootNode = container.getRootNode();

  try {
    const css = await loadCssText();
    if (!container.isConnected) return inertEditor();
    injectStyle(rootNode instanceof ShadowRoot ? rootNode : document.head, css);

    const CodeMirror = await loadCodeMirror();
    if (!container.isConnected) return inertEditor();

    let muting = false;

    /** 按光标处的内联模式选 hint：HTML 标签/属性、CSS 属性、JS 关键字 */
    const autocomplete = (/** @type {any} */ editor) => {
      const token = editor.getTokenAt(editor.getCursor(), true);
      let mode = '';
      try {
        mode = CodeMirror.innerMode(editor.getMode(), token.state)?.mode?.name ?? '';
      } catch {
        mode = editor.getMode()?.name ?? '';
      }
      const hint =
        (mode === 'javascript' && CodeMirror.hint.javascript) ||
        (mode === 'css' && CodeMirror.hint.css) ||
        CodeMirror.hint.html ||
        CodeMirror.hint.auto;
      if (hint) editor.showHint({ hint });
      return true; // 拦掉浏览器默认行为
    };

    /** @type {any} */
    const cm = CodeMirror(container, {
      value,
      /* 高度跟随 .editor-host（它由 doc-example 按内容自适应）；CM 默认 300px 会盖掉容器 */
      height: '100%',
      mode: 'htmlmixed',
      lineNumbers: true,
      /* 行号右侧的折叠槽：三角点一下折 / 展开；Ctrl / Cmd 无关，用 Ctrl-Shift-[ / ] 也可以 */
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      /* 光标处括号配对高亮 */
      matchBrackets: true,
      lineWrapping: false,
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
        /* 折叠 / 展开：和行号旁的三角同一套命令（Keyboard 也能用） */
        'Ctrl-Shift-[': 'fold',
        'Ctrl-Shift-]': 'unfold',
        /* 注释切换：HTML 走 <!-- -->，内联 JS / CSS 走各自注释 */
        'Ctrl-/': 'toggleComment',
        'Cmd-/': 'toggleComment',
        /* 补全：Mac 的 Ctrl-Space 常被输入法占用，另给一个 Alt-/ */
        'Ctrl-Space': autocomplete,
        'Alt-/': autocomplete,
        'Cmd-Enter': () => onRun?.(),
        'Ctrl-Enter': () => onRun?.(),
        /* Tab 被编辑器吃掉了（缩进），Esc 是键盘用户离开编辑器的出口 */
        Esc: (/** @type {any} */ editor) => editor.getInputField().blur(),
      },
    });

    cm.on('change', () => {
      if (!muting) onChange?.();
    });
    /* 折叠 / 展开会改变内容高度：交给调用方重算编辑区高度（doc-example 的 fitEditorHeight） */
    cm.on('fold', () => onFold?.());
    cm.on('unfold', () => onFold?.());
    /* 抽屉刚展开时量到的宽度可能还是 0：下一帧再量一次，行号 / 行宽才对 */
    requestAnimationFrame(() => cm.refresh());

    /* 屏蔽浏览器「保存网页」：编辑区里 Ctrl / Cmd + S 都不弹保存框。
       挂在容器上而不是 extraKeys 上，是因为焦点可能落在编辑器内的辅助控件上、不一定是 CodeMirror 的输入区。 */
    const onSaveKey = (/** @type {KeyboardEvent} */ event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 's') {
        event.preventDefault();
      }
    };
    container.addEventListener('keydown', onSaveKey);

    return {
      getValue: () => cm.getValue(),
      setValue: (next) => {
        muting = true;
        cm.setValue(next);
        muting = false;
      },
      focus: () => cm.focus(),
      getContentHeight: () => {
        const sizer = cm.getWrapperElement()?.querySelector('.CodeMirror-sizer');
        return sizer ? sizer.getBoundingClientRect().height : 0;
      },
      refresh: () => cm.refresh(),
      destroy: () => {
        container.removeEventListener('keydown', onSaveKey);
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
 * 降级：朴素的 textarea，行内样式由 doc-example 的 .fallback-editor 给。
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
    getContentHeight: () => {
      const prev = textarea.style.height;
      textarea.style.height = 'auto';
      const height = textarea.scrollHeight;
      textarea.style.height = prev;
      return height;
    },
    refresh: () => {},
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
    getContentHeight: () => 0,
    refresh: () => {},
    destroy: () => {},
  };
}
