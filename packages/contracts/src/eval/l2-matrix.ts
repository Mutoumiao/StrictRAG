/**
 * L2 机械分与工程 signoffEligible（≠ 准出 PASS / ≠ 人签）。
 */
import { citationCompleteRate, type EvalRetrieveMode, type L1Outcome } from './l1-matrix.js';
import {
  L2_NEAR_COREF_PASS_MIN,
  L2_SIGNOFF_MIN_CASES,
  l2TypeCoverage,
  type L2Accept,
  type L2SessionRef,
  type L2Type,
} from './l2-gold.js';

export function nextSessionId(
  ref: L2SessionRef,
  prev: string | null,
  mint: () => string,
): string | undefined {
  if (ref === 'none') return undefined;
  if (ref === 'new' || !prev) return mint();
  return prev;
}

export function acceptHit(accept: readonly L2Accept[], status: string, reason?: string): boolean {
  return accept.some((a) => a === status || a === reason);
}

export function historyLeaked(
  evidenceTexts: readonly string[],
  priorUserTexts: readonly string[],
): boolean {
  return priorUserTexts.some((q) => q && evidenceTexts.some((t) => t.includes(q)));
}

/**
 * 近指代（near_coref）题的机械 pass 比例：分子 = `type='near_coref' ∧ verdict='pass'`；
 * 分母 = **全部** `near_coref` 行（**含 `error`**，error 不算 pass）；分母 0 → `null`。
 *
 * `error` 进分母的理由：把它排除会让「全批 error」退化成 `null` → 分母 0 → 该门不适用 →
 * 放行（fail-open）；本仓纪律是「无有效数据不外推」（与 `sweepTau` 的 `scored=0 → tauStar=null` 同款）。
 *
 * 残余（不许省）：① 本率**不含**「主题是否正确」——今天无 judge；采集面已补（行级 `docHit` / 整批
 * `docHitRate`），但**明确不进本式**，且未映射（夹具逻辑 id vs KB uuid）时恒 0；② **不含**「合法 citation」
 * （已落 `citationComplete`，同为只记率、不进本式）；③ 仓库夹具只有 3 条 `near_coref`，80% 只能取
 * 0 / 33.3 / 66.7 / 100%，故今天该门等价于「3/3 全过」而非比例门（夹具债另记）。
 * api CLI 与 worker eval 消费者共用，禁止单边另写一份口径。
 */
export function l2NearCorefPassRate(
  rows: ReadonlyArray<{ type: L2Type; verdict: string }>,
): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    if (r.type !== 'near_coref') continue;
    den += 1;
    if (r.verdict === 'pass') num += 1;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ 题量≥15 ∧ 近指代通过率≥80%。
 * mock / unknown / 截断 / 缺类 / 历史泄漏 / 近指代率缺测(null) / 近指代率不足 → false。仍 ≠ 人签。
 *
 * 近指代率的口径与残余见 `l2NearCorefPassRate`：它只等价于「近指代题的机械 pass 比例」，
 * 不含主题是否正确、不含合法 citation；夹具只有 3 条 near_coref，故今天该门 ≈「3/3 全过」。
 * 采集面（`docHit*` / `citationComplete*`）**不新增任何合取项**：PRD §6.2 没有这两道门，加进去就是恒 false 空转闸。
 */
export function computeL2SignoffEligible(input: {
  retrieveMode: EvalRetrieveMode;
  cases: ReadonlyArray<{ type: L2Type }>;
  caseCount: number;
  zeroToleranceHits: number;
  /** 缺测（无 near_coref 题 → null）不放行；见 `l2NearCorefPassRate` 的残余说明 */
  nearCorefPassRate: number | null;
}): boolean {
  if (input.retrieveMode !== 'live') return false;
  if (input.caseCount < L2_SIGNOFF_MIN_CASES) return false;
  if (input.zeroToleranceHits !== 0) return false;
  const nearCorefOk =
    input.nearCorefPassRate !== null && input.nearCorefPassRate >= L2_NEAR_COREF_PASS_MIN;
  if (!nearCorefOk) return false;
  return l2TypeCoverage(input.cases).missing.length === 0;
}

/**
 * L2 报告自有键的同构锚点（采集面 + 零容忍区块 + 可复现区块）：api（`L2Report` / `L2CaseRow`）
 * 与 worker（`L2BatchReport` / `L2BatchCaseRow`）是三份手抄形状，本名单是「同名同语义」的单一
 * 锚点 —— 任一侧改名 / 漏键，两侧同构测例一起红。worker `persist.ts` 的 `saveL2Report` 是逐键
 * 白名单，漏键**静默丢弃且零测试红**，故新键必须同时进本名单与白名单。
 */
export const L2_EVIDENCE_REPORT_KEYS = [
  'docHitRate',
  'docHitHits',
  'docHitScored',
  'citationComplete',
  'citationCompleteDen',
  'zeroToleranceCoverage',
  'repro',
] as const;

/** 行级名单；`expectedDocIds` / `evidenceDocIds` / `docHit` / `citationOk` 恒在行上。 */
export const L2_EVIDENCE_ROW_KEYS = [
  'expectedDocIds',
  'evidenceDocIds',
  'docHit',
  'answerKind',
  'citationCount',
  'citationOk',
] as const;

/** 「合法 citation」的采集面：与 L1 `createEvalHttpExecute` 的过滤同口径，未下发一律缺省。 */
export type L2CitationFace = {
  /** 图上 answerKind；拒答 / error / 未下发 → 缺省 */
  answerKind?: 'knowledge' | 'chitchat';
  /** 图上 citations.length；未下发 → 缺省 */
  citationCount?: number;
};

/**
 * 行级「合法 citation」三态：`null` = 不适用或未下发（**不得**当成「有引用」变绿，
 * 也**不得**当成「无引用」把既有用例拉红）；`false` = 图明确答了 knowledge 却 `citations === 0`。
 *
 * 只有 `knowledge` 判词，与 L1 `citationCompleteRate` 的分母（`knowledge ∧ answered`）同域：
 * `chitchat` 的「合法 citation」**不适用**，返 `null` 而非 `false` —— 把「不适用」写成「不满足」
 * 会让人在报告里把正常路由读成引用缺失。原始事实仍由行上的 `citationCount` 回显。
 *
 * **不判词进闸**：不接进任何 case 的 `failReasons`、不进 `signoffEligible`。
 */
export function l2CitationOk(face: L2CitationFace): boolean | null {
  if (face.answerKind !== 'knowledge') return null;
  const count = face.citationCount;
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;
  return count > 0;
}

function asL1Outcome(status: string | undefined): L1Outcome {
  return status === 'answered' || status === 'abstained' ? status : 'error';
}

/**
 * 整批引用完整率：**直接复用** L1 的 `citationCompleteRate`（分子 = `knowledge ∧ answered ∧ citations>0`；
 * 分母 = `knowledge ∧ answered`；分母 0 → `null`），并按同一谓词给分母。
 * L2 行只有 `lastStatus`（未下发 → 缺省）→ 缺省按 `error` 计，不进分母。
 * 与 L1 同款语义：**记率、不判词**（不进 `computeL2SignoffEligible`）。
 */
export function l2CitationComplete(
  rows: ReadonlyArray<{ lastStatus?: string } & L2CitationFace>,
): { citationComplete: number | null; citationCompleteDen: number } {
  const adapted = rows.map((r) => ({
    outcome: asL1Outcome(r.lastStatus),
    answerKind: r.answerKind,
    citationCount: r.citationCount,
  }));
  return {
    citationComplete: citationCompleteRate(adapted),
    citationCompleteDen: adapted.filter(
      (r) => r.outcome === 'answered' && r.answerKind === 'knowledge',
    ).length,
  };
}

/** PRD §6.2「零容忍」四项的稳定键（按 PRD 原句顺序） */
export const L2_ZERO_TOLERANCE_ITEM_KEYS = [
  'topicStickiness',
  'historyText',
  'kbConflictNumber',
  'skipVerify',
] as const;

export type L2ZeroToleranceItemKey = (typeof L2_ZERO_TOLERANCE_ITEM_KEYS)[number];

/**
 * 项内「去处」键。PRD 原句「历史文本进 evidence/`min_support`」一项点了**两处**
 * （evidence 正文 / `min_support`），故去处比项多一条；其余三项各一处。
 * 两者都列出来是为了让报告能如实表达「一处已机械判、一处记债」，不许含糊成一行。
 */
export const L2_ZERO_TOLERANCE_PLACE_KEYS = [
  'topicStickiness',
  'historyInEvidence',
  'historyInMinSupport',
  'kbConflictNumber',
  'skipVerify',
] as const;

export type L2ZeroTolerancePlaceKey = (typeof L2_ZERO_TOLERANCE_PLACE_KEYS)[number];

/**
 * `mechanical` = 有真机械判据在跑（须带命中数）；`debt` = 判不了、如实记债。
 * 缺什么才能销账写在 `.trellis/spec/api/backend/l2-eval.md`；**禁止**造形似代理充数。
 */
export type L2ZeroToleranceJudged = 'mechanical' | 'debt';

export type L2ZeroTolerancePlace = {
  key: L2ZeroTolerancePlaceKey;
  judged: L2ZeroToleranceJudged;
  /** `mechanical` = 本跑命中数；`debt` = `null`（无判据，不许拿 0 冒充「满足」） */
  hits: number | null;
  /** 一句话：判的是什么 / 为何记债 */
  note: string;
};

export type L2ZeroToleranceItem = {
  key: L2ZeroToleranceItemKey;
  /** PRD §6.2 原句摘录；两处去的项写全，不许只写一半 */
  prd: string;
  /** 整项档位：全部去处 `mechanical` 才 `mechanical`；任一处 `debt` → 整项 `debt` */
  judged: L2ZeroToleranceJudged;
  places: L2ZeroTolerancePlace[];
};

export type L2ZeroToleranceCoverage = L2ZeroToleranceItem[];

/**
 * PRD §6.2 四项零容忍的**处置档位区块**（api / worker 两侧同源，禁单边另写）。
 *
 * 今天只有「历史文本进 evidence」这**一处**有真机械判据（`historyLeaked`），且它判的是
 * 「**语料撞词**」这一种（先前用户轮原文恰好出现在 KB chunk 正文里），**不是**「图把聊天记录
 * 当证据」—— 后者在图上结构上不成立（evidence 唯一写点 = retrieve 结果）。同理，此项在整项上
 * 仍记 `debt`：PRD 同一项里的 `min_support` 那半句今天不可判，整项写 `mechanical` 会藏住那一半债。
 * 其余各处一律 `debt`（主题粘连 / 冲突数字 / 跳过 verify / `min_support`）：判不了就如实记债，
 * **不许**造形似代理冒充机械判据。
 *
 * `historyInEvidence.hits` 与报告的 `zeroToleranceHits` **同源**：调用方把同一个计数传进来，
 * 禁止在本区块里另算一份 —— 另算会让报告自相矛盾，这条由测例钉住。
 */
export function l2ZeroToleranceCoverage(zeroToleranceHits: number): L2ZeroToleranceCoverage {
  if (!Number.isFinite(zeroToleranceHits) || zeroToleranceHits < 0) {
    throw new TypeError('zeroToleranceHits must be a finite number >= 0');
  }
  const items: Omit<L2ZeroToleranceItem, 'judged'>[] = [
    {
      key: 'topicStickiness',
      prd: '主题粘连胡答',
      places: [
        {
          key: 'topicStickiness',
          judged: 'debt',
          hits: null,
          note: '图上无机器可读主题字段；expected.themePersist 只有期望值、无实测值可比',
        },
      ],
    },
    {
      key: 'historyText',
      prd: '历史文本进 evidence/min_support',
      places: [
        {
          key: 'historyInEvidence',
          judged: 'mechanical',
          hits: zeroToleranceHits,
          note: 'historyLeaked：先前用户轮原文出现在末轮 evidence 正文（判的是语料撞词这一种）',
        },
        {
          key: 'historyInMinSupport',
          judged: 'debt',
          hits: null,
          note: 'AskGraphResult 不含 claims；min_support 只是数值，不可观测',
        },
      ],
    },
    {
      key: 'kbConflictNumber',
      prd: '冲突场景跟错数字',
      places: [
        {
          key: 'kbConflictNumber',
          judged: 'debt',
          hits: null,
          note: '数字只在 rubric 自由文本里，不是结构化字段；无判据',
        },
      ],
    },
    {
      key: 'skipVerify',
      prd: '合法路径跳过 verify',
      places: [
        {
          key: 'skipVerify',
          judged: 'debt',
          hits: null,
          note: 'debug 只有 llmCalls / route_*，无 purpose 维度；「跑没跑 verify」不可观测',
        },
      ],
    },
  ];
  return items.map((item) => ({
    ...item,
    judged: item.places.every((p) => p.judged === 'mechanical') ? 'mechanical' : 'debt',
  }));
}
