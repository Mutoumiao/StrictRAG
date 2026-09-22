/**
 * L1 报告「可复现区块」（评测 PRD §8 :222）与 L1 侧两条哈希的稳定纯函数。
 *
 * 为什么走子路径导出（`@strict-rag/contracts/eval-repro`）而不进主入口：本文件用 `node:crypto`
 * （与 `apps/api/src/eval/l2-fingerprint.ts` 同一套 `createHash('sha256')` 用法），而 contracts 主入口
 * 会被 web / admin 客户端打包（`transpilePackages`）—— node 内置模块进客户端图会让 Next 构建失败。
 *
 * 纪律（工单 05 裁定）：
 * - 能取到的取真值；**取不到的一律 `null`**，禁止 `''` / `'unknown'` / `'-'` 之类占位串（`null` 是「没测到」的唯一写法）。
 * - 「无版本载体 / 功能未实现」的字段类型钉成 `null` 字面量：编一个假版本号过不了类型检查。
 * - 区块内**没有** `mode` 键 —— 既有顶层 `mode` 是 `retrieve_mode` 的历史别名（§8 `mode`/`contextMode`
 *   语义歧义记债），不许在本区块里再造一个第二源。
 * - 哈希是稳定纯函数：同一输入跨进程同值；输入变一个字节即变值。
 * - api CLI 与 worker 批跑共用本形状，禁止单边另写一份。
 */
import { createHash } from 'node:crypto';

/** sha256 十六进制（小写）。 */
function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * §8「题面 ID 哈希」：对题面 id **集合**算 sha256。
 *
 * 规范化：逐项 trim → 去空项 → **升序** → JSON 序列化。升序不是可选项：题面集是集合，
 * 换序（例如 gold 文件重排、worker 侧 DB 查询无 ORDER BY）不算换集，跨进程复跑必须同值。
 * 规范化后为空 → `null`（无题面可指纹；不得拿空串的哈希冒充）。
 */
export function l1QuestionIdsHash(ids: readonly string[]): string | null {
  const list = ids
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .sort();
  if (list.length === 0) return null;
  return sha256Hex(JSON.stringify(list));
}

/**
 * §8「校准集哈希」：对校准集**文件内容**算 sha256。
 *
 * 逐字节（含行尾），不做任何归一 —— 「输入变一个字节即变值」是硬要求。
 * 内容缺失 / 全空白 → `null`（没有内容可指纹）。
 */
export function l1CalibSetHash(rawContent: string | null | undefined): string | null {
  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) return null;
  return sha256Hex(rawContent);
}

/** §8 `models` 的 KB 侧 `model_bindings` 行（`packages/db` 的 `model_bindings` 表映出）。 */
export type L1ReproKbBinding = {
  purpose: string;
  primaryRef: string;
  fallbackRefs: readonly string[];
};

/** §8 `models`：网关 env 侧三个模型 + KB 级绑定（两者都可能取不到 → 分项 `null`）。 */
export type L1ReproModels = {
  /** `GATEWAY_CHAT_MODEL` / `GATEWAY_EMBED_MODEL` / `GATEWAY_RERANK_MODEL`；取不到 → null */
  env: {
    chat: string | null;
    embed: string | null;
    rerank: string | null;
  };
  /** KB 级绑定（需读库）；未读到 / 无绑定 / 调用方未提供 → null */
  kbBindings: readonly L1ReproKbBinding[] | null;
};

/**
 * 报告可复现区块。键 = PRD §8 的条目（`mode` 见文件头：不进本区块）。
 * `null` 字面量的键是「今天取不到」的记债项，销账路径见工单 05 `## Answer` 的去向表。
 */
export type L1Repro = {
  /** §8 seed：仓库无随机种子载体 → 恒 null */
  seed: null;
  /** §8 models：env 三模型 + KB 绑定（分项可为 null） */
  models: L1ReproModels;
  /** §8 fallbackChains 版本：链内容可取但**无版本载体** → 恒 null（不拿源码/链内容哈希顶替） */
  fallbackChainsVersion: null;
  /** §8 retrieveK：本次 run 档位（`graph/budget.ts` 冻结表）派生；档位取不到 → null */
  retrieveK: number | null;
  /** §8 rerankTopN：同 retrieveK */
  rerankTopN: number | null;
  /** §8 tauClaim：ADR-007 唯一源 `TAU_CLAIM`；取不到 → null */
  tauClaim: number | null;
  /** §8 `crag*`：功能未实现 → 恒 null */
  crag: null;
  /** §8 contextMode：KB/文档分片参数是逐策略/逐文档的语料制备口径，L1 run 无单一值 → 恒 null */
  contextMode: null;
  /** §8 promptVersions：prompt 无版本常量 → 恒 null */
  promptVersions: null;
  /** §8 题面 ID 哈希（`l1QuestionIdsHash`） */
  questionIdsHash: string | null;
  /** §8 校准集哈希（`l1CalibSetHash`） */
  calibrationHash: string | null;
  /** §8 lifecycle 过滤规则版本：规则是代码谓词、无版本常量 → 恒 null */
  lifecycleFilterVersion: null;
  /** §8 session 策略版本 / rewrite prompt 版本：无版本载体 → 恒 null */
  sessionStrategyVersion: null;
  /** §8 L2 剧本集哈希：L2 侧归下一张图 → 恒 null */
  l2GoldSetHash: null;
};

/** 全 `null` 区块：报告的起点，也用于「取不到一律 null」与「全 null 渲染」测例。 */
export function emptyL1Repro(): L1Repro {
  return {
    seed: null,
    models: { env: { chat: null, embed: null, rerank: null }, kbBindings: null },
    fallbackChainsVersion: null,
    retrieveK: null,
    rerankTopN: null,
    tauClaim: null,
    crag: null,
    contextMode: null,
    promptVersions: null,
    questionIdsHash: null,
    calibrationHash: null,
    lifecycleFilterVersion: null,
    sessionStrategyVersion: null,
    l2GoldSetHash: null,
  };
}
