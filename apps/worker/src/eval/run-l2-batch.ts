import {
  acceptHit,
  accumulateHitAtK,
  computeL2SignoffEligible,
  emptyHitAtK,
  historyLeaked,
  hitAtKCase,
  hitAtKRate,
  l2CitationComplete,
  l2CitationOk,
  l2NearCorefPassRate,
  l2ZeroToleranceCoverage,
  nextSessionId,
  type EvalRetrieveMode,
  type L2Case,
  type L2Type,
  type L2ZeroToleranceCoverage,
} from '@strict-rag/contracts';
import {
  emptyL2Repro,
  l2GoldSetHash,
  type L2Repro,
} from '@strict-rag/contracts/eval-repro-l2';
import {
  resolveExpectedDocIds,
  summarizeDocMap,
  type DocMapSource,
} from '@strict-rag/contracts/eval-corpus-ledger';
import {
  defaultRepoRoot,
  resolveCorpusLedgerForRun,
} from '@strict-rag/contracts/eval-corpus-ledger-file';
import { uuidv7 } from 'uuidv7';

export type L2Verdict = 'pass' | 'fail' | 'error';

export type L2TurnExecuteResult =
  | {
      outcome: 'answered' | 'abstained';
      reason?: string;
      rewriteUsed?: boolean;
      evidenceTexts?: string[];
      /** 末轮实测 evidence docId；未采集 → `[]`（与 `evidenceTexts` 同一条采集面） */
      evidenceDocIds?: string[];
      answer?: string;
      /** 图上 answerKind；拒答 / 未下发 → 缺省（不冒充 knowledge） */
      answerKind?: 'knowledge' | 'chitchat';
      /** 图上 citations.length；未下发 → 缺省（不进引用完整率分母） */
      citationCount?: number;
    }
  | { outcome: 'error'; errorMessage?: string };

export type L2TurnExecute = (input: {
  question: string;
  sessionId?: string;
  sessionWindow: { role: 'user' | 'assistant'; content: string }[];
}) => Promise<L2TurnExecuteResult>;

export type L2BatchCaseRow = {
  id: string;
  type: L2Type;
  verdict: L2Verdict;
  lastStatus?: string;
  lastReason?: string;
  rewriteUsed?: boolean;
  historyInEvidence: boolean;
  expectedThemePersist: boolean;
  /** 夹具原样（逻辑 id）；无标注 → 缺省（该题不计 docHit） */
  expectedDocIds?: string[];
  /** 末轮实测 evidence docId；error 行 / 无采集 → `[]` */
  evidenceDocIds: string[];
  /** 命中期望文档（复用 `hitAtKCase`）；无标注 → `null`。**不进判定** */
  docHit: boolean | null;
  /** 图上 answerKind；拒答 / error / 未下发 → 缺省（不冒充 knowledge） */
  answerKind?: 'knowledge' | 'chitchat';
  /** 图上 citations.length；未下发 → 缺省 */
  citationCount?: number;
  /** 合法 citation 三态：`null` = 未下发（≠ 有引用，≠ 无引用）。**不进 failReasons** */
  citationOk: boolean | null;
  failReasons: string[];
  errorMessage?: string;
};

export type L2BatchReport = {
  run_type: 'session_multiturn';
  retrieveMode: EvalRetrieveMode;
  signoffEligible: boolean;
  ranAt: string;
  kbId: string;
  caseCount: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  zeroToleranceHits: number;
  /**
   * PRD §6.2 四项零容忍的处置档位区块（`l2ZeroToleranceCoverage`，与 api CLI 同源）：
   * 逐项声明 `judged: 'mechanical' | 'debt'`，`mechanical` 处带命中数（与 `zeroToleranceHits` 同源）。
   * **如实声明，不进任何判定**；`persist.ts` 的逐键白名单必须同步带上本键（否则静默丢弃）。
   */
  zeroToleranceCoverage: L2ZeroToleranceCoverage;
  /**
   * 近指代通过率：分子 = type='near_coref' ∧ verdict='pass'；分母 = 全部 near_coref 行（含 error）；
   * 分母 0 → null（不放行）。残余（不含主题正确 / 不含合法 citation / 夹具仅 3 题）见
   * `l2NearCorefPassRate` 注释。
   */
  nearCorefPassRate: number | null;
  /** 近指代通过率分母（near_coref 题数） */
  nearCorefPassDen: number;
  /**
   * 命中期望文档率（复用 `hitAtKCase` / `emptyHitAtK` / `accumulateHitAtK` / `hitAtKRate`，与 api CLI 同口径）：
   * 分母 = 有非空 `expectedDocIds` 的题数（含 error 题）；分母 0 → null。
   * **未映射（夹具逻辑 id vs `documents.id` uuid）时恒 0，不得当成绩**。
   * **不进 `computeL2SignoffEligible`**。
   */
  docHitRate: number | null;
  docHitHits: number;
  docHitScored: number;
  /**
   * 引用完整率：口径 = L1 `citationCompleteRate`（分子 = knowledge ∧ answered ∧ citations>0；
   * 分母 = knowledge ∧ answered；分母 0 → null）。**记率、不判词**（不进 `signoffEligible`）。
   */
  citationComplete: number | null;
  /** 引用完整率分母（knowledge ∧ answered 题数） */
  citationCompleteDen: number;
  /**
   * PRD §8 可复现区块（L2 侧三键，与 api CLI 同形状 = `@strict-rag/contracts/eval-repro-l2` 的
   * `L2Repro`）：`l2GoldSetHash` 取真值（本跑实际题面 id 集合，worker 侧拿得到 case id）；两个
   * 版本键**全仓无载体** → 恒 `null`。**不进任何判定**；`persist.ts` 的逐键白名单必须同步带本键。
   */
  repro: L2Repro;
  /**
   * 映射来源三键（如实标注，**不进 `computeL2SignoffEligible`**）：`none` = 未传账本（逐位保持今天
   * 语义）；`ledger` = 按账本解析。缺映射继续算 `docHit=false`（恒 0），绝不变成 `null`。
   */
  docMapSource: DocMapSource;
  /** 成功换成 uuid 的去重逻辑 id 数（未传账本 → 0） */
  docMapResolved: number;
  /** 账本里没有的逻辑 id（字典序去重） */
  docMapUnmappedIds: string[];
  cases: L2BatchCaseRow[];
};

type WindowTurn = { role: 'user' | 'assistant'; content: string };

export async function runL2Batch(opts: {
  kbId: string;
  cases: readonly L2Case[];
  retrieveMode: EvalRetrieveMode;
  executeTurn: L2TurnExecute;
  maxCases?: number;
  mintSessionId?: () => string;
  now?: () => Date;
  /**
   * 映射账本路径（env `L2_DOC_MAP`，可选）。不传 → 与今天**逐位一致**（`docMapSource='none'`）；
   * 传了 → 读账本并在 `hitAtKCase` 之前把逻辑 id 解析为 uuid（kbId / 指纹不符 → 抛错，调用方
   * 捕获后 `markFailed`，**不得**静默降级成「未设置」）。
   */
  docMapPath?: string;
  /** 夹具根（账本新鲜度校验用）；默认按本文件位置上溯 4 层 */
  repoRoot?: string;
}): Promise<L2BatchReport> {
  const sliced =
    opts.maxCases && opts.maxCases > 0 ? opts.cases.slice(0, opts.maxCases) : opts.cases;
  // 账本先读：kbId / 指纹不符立刻抛错（消费者捕获 → markFailed），别跑完一整批才发现映射不可用
  const ledger = opts.docMapPath
    ? resolveCorpusLedgerForRun({
        ledgerPath: opts.docMapPath,
        kbId: opts.kbId,
        repoRoot: opts.repoRoot ?? defaultRepoRoot(import.meta.url),
      })
    : null;
  // 有账本时把逻辑 id 换成 uuid（缺映射原样保留 → 必然 miss）；两处比对（正常分支与 error 分支）都走它
  const expectedForHit = (
    expected: readonly string[] | undefined,
  ): readonly string[] | undefined =>
    ledger ? resolveExpectedDocIds(expected, ledger) : expected;
  const mint = opts.mintSessionId ?? (() => uuidv7());
  const windows = new Map<string, WindowTurn[]>();
  const rows: L2BatchCaseRow[] = [];
  const docHitAcc = emptyHitAtK();
  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;
  let zeroToleranceHits = 0;

  for (const c of sliced) {
    let prev: string | null = null;
    let last: Extract<L2TurnExecuteResult, { outcome: 'answered' | 'abstained' }> | undefined;
    try {
      for (const turn of c.turns) {
        const sessionId = nextSessionId(turn.session, prev, mint);
        if (sessionId !== undefined) prev = sessionId;
        const window = sessionId ? (windows.get(sessionId) ?? []) : [];
        const result = await opts.executeTurn({
          question: turn.text,
          sessionId,
          sessionWindow: window,
        });
        if (result.outcome === 'error') {
          throw new Error(result.errorMessage ?? 'execute-ask error');
        }
        last = result;
        if (sessionId) {
          const hist = windows.get(sessionId) ?? [];
          hist.push({ role: 'user', content: turn.text });
          if (result.answer) hist.push({ role: 'assistant', content: result.answer });
          windows.set(sessionId, hist);
        }
      }

      const evidenceTexts = last?.evidenceTexts ?? [];
      const priorUserTexts = c.turns.slice(0, -1).map((t) => t.text);
      const leaked = historyLeaked(evidenceTexts, priorUserTexts);
      const failReasons: string[] = [];
      if (leaked) failReasons.push('history_in_evidence');
      if (!acceptHit(c.expected.accept, last?.outcome ?? '', last?.reason)) {
        failReasons.push('accept');
      }
      if ((last?.rewriteUsed ?? false) !== c.expected.rewriteUsed) {
        failReasons.push('rewriteUsed');
      }

      const verdict: L2Verdict = failReasons.length ? 'fail' : 'pass';
      if (leaked) zeroToleranceHits += 1;
      if (verdict === 'pass') passCount += 1;
      else failCount += 1;

      // 采集面（只落报告，不进 failReasons / signoffEligible）
      const evidenceDocIds = last?.evidenceDocIds ?? [];
      const answerKind = last?.answerKind;
      const citationCount = last?.citationCount;
      const docHit = hitAtKCase(expectedForHit(c.expectedDocIds), evidenceDocIds);
      accumulateHitAtK(docHitAcc, docHit);

      rows.push({
        id: c.id,
        type: c.type,
        verdict,
        lastStatus: last?.outcome,
        lastReason: last?.reason,
        rewriteUsed: last?.rewriteUsed,
        historyInEvidence: leaked,
        expectedThemePersist: c.expected.themePersist,
        expectedDocIds: c.expectedDocIds,
        evidenceDocIds,
        docHit,
        // 只在下发合法值时带上；未下发保持缺省（不冒充 knowledge）
        ...(answerKind ? { answerKind } : {}),
        ...(typeof citationCount === 'number' && Number.isFinite(citationCount)
          ? { citationCount }
          : {}),
        citationOk: l2CitationOk({ answerKind, citationCount }),
        failReasons,
      });
    } catch (err) {
      errorCount += 1;
      // error 题按「未命中」计（与 api CLI 同款）；无 expected 名单仍不计分。有账本时同样先解析
      const docHit = hitAtKCase(expectedForHit(c.expectedDocIds), []);
      accumulateHitAtK(docHitAcc, docHit);
      rows.push({
        id: c.id,
        type: c.type,
        verdict: 'error',
        historyInEvidence: false,
        expectedThemePersist: c.expected.themePersist,
        expectedDocIds: c.expectedDocIds,
        evidenceDocIds: [],
        docHit,
        citationOk: null,
        failReasons: [],
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const citation = l2CitationComplete(rows);
  // 映射来源三键（如实标注，不进 computeL2SignoffEligible）：未传账本 → none/0/[]
  const docMap = summarizeDocMap(
    sliced.map((c) => c.expectedDocIds),
    ledger,
  );
  return {
    run_type: 'session_multiturn',
    retrieveMode: opts.retrieveMode,
    signoffEligible: computeL2SignoffEligible({
      retrieveMode: opts.retrieveMode,
      cases: sliced,
      caseCount: rows.length,
      zeroToleranceHits,
      nearCorefPassRate: l2NearCorefPassRate(rows),
    }),
    ranAt: (opts.now ?? (() => new Date()))().toISOString(),
    kbId: opts.kbId,
    caseCount: rows.length,
    passCount,
    failCount,
    errorCount,
    zeroToleranceHits,
    zeroToleranceCoverage: l2ZeroToleranceCoverage(zeroToleranceHits),
    nearCorefPassRate: l2NearCorefPassRate(rows),
    nearCorefPassDen: rows.filter((r) => r.type === 'near_coref').length,
    docHitRate: hitAtKRate(docHitAcc),
    docHitHits: docHitAcc.hits,
    docHitScored: docHitAcc.scored,
    citationComplete: citation.citationComplete,
    citationCompleteDen: citation.citationCompleteDen,
    // §8 区块：worker 只填剧本集哈希（源 = 本跑实际使用的 case id 集合，含 maxCases 截断）
    repro: { ...emptyL2Repro(), l2GoldSetHash: l2GoldSetHash(sliced.map((c) => c.id)) },
    docMapSource: docMap.docMapSource,
    docMapResolved: docMap.docMapResolved,
    docMapUnmappedIds: docMap.docMapUnmappedIds,
    cases: rows,
  };
}
