/**
 * 引擎版本。仓库里通常会**内置一份引擎副本**（这样 CI / 别人 clone 都能跑，不依赖本机 skill），
 * 副本与 skill 里这份的版本号不一致时，说明仓库那份落后了 —— 见 SKILL.md 的「引擎副本」一节。
 *
 * 1.0.1：修 `skeleton.referenceOrder`。原来 `present` 是从声明顺序里过滤出来的，
 *        比较恒成立、参考区乱序从不报错；现在按文档**实际顺序**判，乱序当场红。
 *        已 vendor 过 1.0.0 的仓库重跑一次 vendor 即可（`--check` 会提示版本落后）。
 */
export const ENGINE_VERSION = '1.0.1';
