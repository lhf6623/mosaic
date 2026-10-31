/**
 * 文档 / 示例里 CDN 地址的唯一版本源 —— 改这里，然后跑 `pnpm versions`。
 *
 * ⚠️ 不要把版本号再写进别的常量或正文里：URL 用精确 tag，正文只说「版本 / 首个版本」。
 * ⚠️ 预览不看版本（docs/components/example.html 会把 mosaic@任意版本 映射到本地仓库），
 *    所以没打 tag 的版本也能在文档站里跑；这里只影响**展示 / 复制出去的代码**。
 */
export const MOSAIC_VERSION = '0.1.0';
export const OFA_VERSION = '4.7.5';

/** `pnpm versions` 会重写、check:docs 会对账的文件（仓库相对 glob）。 */
export const VERSIONED_GLOBS = [
  'README.md',
  'index.html',
  'packages/README.md',
  'docs/**/*.html',
  'docs/**/*.md',
  'packages/**/*.html',
  'packages/**/*.md',
];
