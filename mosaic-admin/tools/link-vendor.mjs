#!/usr/bin/env node
/**
 * vendor/mosaic 链接：开发期指向仓库的 packages/，签出时换成真实副本。
 *
 * 为什么是链接：应用里所有库引用都写 vendor/mosaic/…，开发期 URL 形状与生产一致；
 * 签出到独立仓库只要把链接换成副本（附录 A），应用代码一个字都不用改。
 *
 * 用法：node mosaic-admin/tools/link-vendor.mjs [--check]
 *   --check 只检查、不创建；缺链接或指错地方退出 1（check:app 复用这里的 check()）。
 *
 * 平台差异：Windows 建 junction（不需要管理员权限 / 开发者模式），目标必须是绝对路径；
 * 其它平台建相对 symlink（链接在 vendor/ 下，所以目标是 ../../packages）。
 */
import { lstat, mkdir, realpath, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** mosaic-admin/ */
export const ADMIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** 仓库根 D:\mosaic\ */
export const REPO_ROOT = resolve(ADMIN_ROOT, '..');
export const LINK_PATH = join(ADMIN_ROOT, 'vendor', 'mosaic');
export const TARGET_PATH = join(REPO_ROOT, 'packages');
/** POSIX symlink 的目标：相对链接所在目录（mosaic-admin/vendor/）解析 */
const RELATIVE_TARGET = '../../packages';

const isLink = (path) =>
  lstat(path).then(
    (info) => info.isSymbolicLink(),
    () => false,
  );

const realOrNull = (path) =>
  realpath(path).then(
    (real) => real,
    () => null,
  );

/**
 * 检查链接状态，返回 { ok, mode, messages }。
 * mode：'link' = 指向仓库 packages/；'copy' = 真实目录副本（签出模式）。
 */
export async function check() {
  const messages = [];

  if (!(await realOrNull(TARGET_PATH))) {
    messages.push(
      `找不到 ${TARGET_PATH}：签出后的仓库里 vendor/mosaic 应该是真实副本（见 docs/plan-collaboration.md 附录 A），不会再有仓库 packages/。`,
    );
    return { ok: false, mode: null, messages };
  }

  if (!(await isLink(LINK_PATH))) {
    if (await realOrNull(LINK_PATH)) {
      // 签出模式：副本不是链接。只要副本里有库入口就认。
      const entry = await realOrNull(join(LINK_PATH, 'boot', 'mosaic.css'));
      if (entry) return { ok: true, mode: 'copy', messages };
      messages.push(`${LINK_PATH} 是真实目录但缺 boot/mosaic.css：这不是有效的库副本。`);
      return { ok: false, mode: null, messages };
    }
    messages.push(`缺 ${LINK_PATH}：先跑 node mosaic-admin/tools/link-vendor.mjs。`);
    return { ok: false, mode: null, messages };
  }

  const actual = await realOrNull(LINK_PATH);
  const expected = await realOrNull(TARGET_PATH);
  if (actual !== expected) {
    messages.push(
      `${LINK_PATH} 指向 ${actual ?? '(坏的链接)'}，应指向 ${expected}：链接是生成物，别手改，删掉重跑本脚本。`,
    );
    return { ok: false, mode: null, messages };
  }

  return { ok: true, mode: 'link', messages };
}

/** 建链接；已就绪时不动它（永远不覆盖手改过的链接 / 副本） */
export async function ensure() {
  const status = await check();
  if (status.ok) return status;

  if (await realOrNull(LINK_PATH)) {
    // 存在但不对：真实副本可能是签出模式（check 已认）或真的指错——不猜，直接抛
    throw new Error(status.messages.join('\n'));
  }

  await mkdir(dirname(LINK_PATH), { recursive: true });
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  const target = process.platform === 'win32' ? TARGET_PATH : RELATIVE_TARGET;
  await symlink(target, LINK_PATH, type);
  return check();
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const checkOnly = process.argv.includes('--check');
  try {
    const status = checkOnly ? await check() : await ensure();
    const label = status.mode === 'copy' ? '真实副本' : '链接';
    if (status.ok) {
      console.log(
        checkOnly
          ? `vendor/mosaic ✓（${label}，${status.mode === 'copy' ? LINK_PATH : TARGET_PATH}）`
          : `vendor/mosaic 已就绪（${label}）`,
      );
    } else {
      for (const message of status.messages) console.error(message);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
