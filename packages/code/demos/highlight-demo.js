// 片段文件（src）示例：文件是什么就渲染什么，不用转义
import { createGenerator } from './generator.js';

const uno = createGenerator({ presets: [] });

/** 逐行标注，行号由 mc-code 负责 */
export function annotate(code, language) {
  const lines = code.split('\n');
  return lines.map((text, i) => ({ line: i + 1, text, language }));
}

console.log(annotate('const a = 1;', 'javascript'));
