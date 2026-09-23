/**
 * L2 报告「可复现区块」（评测 PRD §8 :224 的 L2 侧条目）与 L2 剧本集哈希。
 *
 * 为什么走子路径导出（`@strict-rag/contracts/eval-repro-l2`）而不进主入口：本文件间接使用
 * `node:crypto`（哈希实现逐字复用 `./l1-repro.js` 的 `l1QuestionIdsHash`），而 contracts 主入口
 * 会被 web / admin 客户端打包（`transpilePackages`）—— node 内置模块进客户端图会让 Next 构建失败。
 *
 * 纪律（工单 05 裁定 7）：
 * - 能取到的取真值；**取不到的一律 `null`**，禁止 `''` / `'unknown'` / `'-'` 之类占位串。
 * - 「无版本载体」的字段类型钉成 `null` 字面量：编一个假版本号过不了类型检查；**禁止**拿源码
 *   文本哈希顶替（会随任意重构噪声跳变，形似而非语义）。
 * - 哈希**不另发明**：`l2GoldSetHash` 逐字复用 L1 的 `l1QuestionIdsHash` 口径。
 * - 区块范围就到这三个键：§8 的通用字段（`models` / `retrieveK` / `tauClaim` / …）在 L1 侧已有落点，
 *   L2 侧**本图不扩**（记债）。
 * - api CLI 与 worker 批跑共用本形状，禁止单边另写一份。
 */
import { l1QuestionIdsHash } from './l1-repro.js';

/**
 * §8「L2 剧本集哈希」：对**本跑实际使用**的 L2 case id **集合**算 sha256。
 *
 * 口径 = 逐字复用 `l1QuestionIdsHash`（逐项 trim → 去空 → **升序** → `JSON.stringify` → sha256），
 * **不另发明哈希**；升序不是可选项 —— 剧本集是集合，gold 文件重排不算换集。
 * 空集 → `null`（无题面可指纹；不得拿空串的哈希冒充）。
 *
 * 算的是「本跑实际用的题面集」：运行集会受 `L2_MAX_CASES` 截断（截断即另一个题面集，哈希随之变）。
 * L2 case id 受 `/^l2-[a-z0-9-]+$/` 约束且夹具内唯一（`eval/l2-gold.ts`），故跨进程稳定。
 */
export function l2GoldSetHash(ids: readonly string[]): string | null {
  return l1QuestionIdsHash(ids);
}

/**
 * L2 报告可复现区块。键名与 `L1Repro` 同风格（`l2GoldSetHash` 在 L1 侧是恒 `null` 的保留键，
 * 由 `emptyL1Repro()` 铺底 —— L1 不加载 L2 夹具，**不要**顺手去填它；L2 侧在此给出真值）。
 */
export type L2Repro = {
  /** §8「L2 剧本集哈希」（`l2GoldSetHash` 纯函数）；空集 → `null` */
  l2GoldSetHash: string | null;
  /** §8「session 策略版本」：全仓无版本载体（`SESSION_REWRITE_ENABLED` 只是布尔）→ 恒 null */
  sessionStrategyVersion: null;
  /** §8「rewrite prompt 版本」：`rewriteSystemPrompt()` 是内联字符串、无版本常量 → 恒 null */
  rewritePromptVersion: null;
};

/** 全 `null` 区块：报告的起点，也用于「空集渲染」与「版本键只可能是 null」测例。 */
export function emptyL2Repro(): L2Repro {
  return {
    l2GoldSetHash: null,
    sessionStrategyVersion: null,
    rewritePromptVersion: null,
  };
}
