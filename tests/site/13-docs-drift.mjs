/**
 * 站点 · 文档与代码对账（node-only）
 *
 * 跑的是 `tools/doc-drift/`（通用引擎的仓库副本）+ `tools/doc-drift.config.mjs`（本仓约定）：
 *   · 引擎只认配置，零仓库知识 —— 改约定动配置，不动引擎；
 *   · 引擎与 skill `doc-code-drift` 里的那份同源，版本号在 `node tools/doc-drift/drift.mjs --version`。
 *
 * 这里只做三件事：
 *   ① 每组一条断言（失败时把逐条问题原样打出来，不用再去翻工具输出）；
 *   ② 组数写死 —— 有人在配置里误删一整个面（比如把 sitemap/索引那组摘了）要当场红，
 *      否则守卫会安静地少守一个面；
 *   ③ 不碰浏览器：站点套件里第二个 node-only 的（另一个是 11 号写法守卫）。
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit } from '../../tools/doc-drift/drift.mjs';
import config from '../../tools/doc-drift.config.mjs';

/** 仓库根（本文件在 tests/site/ 下） */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** 应有的组数：组件文档 4 个面（API 规范 / 单元令牌 / 页面骨架 / 演示区）
 *  + 开发文档 13 条规则（索引 / 路径与目录树 / 命令 / 数字 / 防回潮 /
 *  doc-spec 接线 / 插槽与 part 的节名 / 演示覆盖 / 值列类型 / 参考节只有表 /
 *  单元 README / 文档链接 / 顶部加载条只有一条）+ 自检 1。
 *  ⚠️ 这个数是**写死**的，故意不从配置里推 —— 推出来的话这条断言恒成立，等于没有；
 *  它就是用来抓「配置里少了一整个面 / 一条规则」的。所以在
 *  `tools/doc-drift.config.mjs` 的 rules 里加删规则时，这里要同步（`pnpm check:docs`
 *  跑完会打印实际组数）。
 *  ⚠️ `page-api`（页面手写参考表格 ↔ 代码）在 S3 之后整个删了 —— 参考区改由 md 渲染，
 *  那一面没有对象可对了；它的两块职责分别归 `api-spec` 面与两条 custom 规则。
 *  ⚠️ `dev-tree`（目录树）/ `read-budget`（必读闭包）/ `howto-contract`（食谱契约）随
 *  `agent/` 一并删了 —— 它们的对象就是那批规范 Markdown，文档没了，没有可对的东西了。 */
const EXPECTED_GROUPS = 18;

/** skill 里那份引擎（本机装了才对账；CI 上不一定有） */
const SKILL_ENGINE = join(homedir(), '.dsh/skills/doc-code-drift/scripts');

/** 仓库副本必须和 skill 里那份**逐字节相同** —— 否则「副本是最新的」这句话就不成立 */
function engineCopyCheck(check) {
  if (!existsSync(SKILL_ENGINE)) {
    check('引擎副本与 skill 同源', true, `本机没装 skill（${SKILL_ENGINE} 不存在）→ 跳过，CI 上正常`);
    return;
  }
  const files = ['drift.mjs', 'lib/parse.mjs', 'lib/version.mjs'];
  const drifted = files.filter(
    (file) => readFileSync(join(ROOT, 'tools/doc-drift', file), 'utf8') !==
      readFileSync(join(SKILL_ENGINE, file), 'utf8'),
  );
  check(
    `引擎副本与 skill 同源（${files.length} 个文件逐字节比）`,
    drifted.length === 0,
    drifted.length
      ? `${drifted.join(' / ')} 分叉了 —— 别再手改副本：node ~/.dsh/skills/doc-code-drift/recipes/vendor.mjs --repo .`
      : '同字节',
  );
}

export default async function run({ check }) {
  const groups = audit({ root: ROOT, config });

  for (const group of groups) {
    check(
      group.title,
      group.ok,
      group.problems.join('\n        ') ||
        '对齐：文档写的东西代码里都有，代码有的文档都写了',
    );
  }

  check(
    `对账组齐全（${groups.length} / ${EXPECTED_GROUPS} 组）`,
    groups.length === EXPECTED_GROUPS,
    groups.length === EXPECTED_GROUPS
      ? groups.map((group) => group.id).join(' / ')
      : groups.length < EXPECTED_GROUPS
        ? `配置里的 surfaces + rules 少了 ${EXPECTED_GROUPS - groups.length} 组 —— 少一组就是少守一个面，见 tools/doc-drift.config.mjs`
        : `配置里的 surfaces + rules 多了 ${groups.length - EXPECTED_GROUPS} 组（配置里是 ${groups.length}、常量写的是 ${EXPECTED_GROUPS}）—— 加了面对账面就把这个常量一起改，见 tools/doc-drift.config.mjs`,
  );

  engineCopyCheck(check);
}
