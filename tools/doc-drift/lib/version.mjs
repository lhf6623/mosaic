/**
 * 引擎版本。仓库里通常会**内置一份引擎副本**（这样 CI / 别人 clone 都能跑，不依赖本机 skill），
 * 副本与 skill 里这份的版本号不一致时，说明仓库那份落后了 —— 见 SKILL.md 的「引擎副本」一节。
 *
 * 1.0.1：修 `skeleton.referenceOrder`。原来 `present` 是从声明顺序里过滤出来的，
 *        比较恒成立、参考区乱序从不报错；现在按文档**实际顺序**判，乱序当场红。
 *        已 vendor 过 1.0.0 的仓库重跑一次 vendor 即可（`--check` 会提示版本落后）。
 *
 * 1.0.2：三处都是被仓库副本先手改、这次提回上游的：
 *        ① `plannedSpec.group` —— filePattern 有多个捕获组时，原来只取第 1 组会取空；
 *           现在配置可指定备选组号（同一个 slug 有两种住处：已实现的
 *           `packages/<slug>/api.md` 与草案 `agent/api/<slug>.md`）。不写 group 行为不变；
 *        ② `custom` 规则的调用签名 —— 调用方传的是展开后的字段，包装器却在取嵌套的 `api`，
 *           于是任何带 custom 规则的配置都会 `components is not iterable` 崩掉；
 *        ③ 目录树规则认得 CRLF（Windows autocrlf 下 `\r\n`，原来永远匹配不上那个代码块）。
 */
export const ENGINE_VERSION = '1.0.2';
