/**
 * L2 多轮黄金集批跑 CLI：串行 executeAsk(skipTrace) + 进程内窗 → 末轮机械分。
 * 默认入口：pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts
 * 工程绿 ≠ L2 准出；signoffEligible 为工程公式，仍 ≠ 人签。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evalRuns } from '@strict-rag/db';
import { uuidv7 } from 'uuidv7';

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

import { CorpusLedgerError, resolveCorpusLedgerForRun } from '../eval/corpus-map.js';
import { l2RewriteFingerprint } from '../eval/l2-fingerprint.js';
import { defaultL2GoldPath, loadL2Gold, L2GoldLoadError } from '../eval/l2-gold.js';

import { env } from '../env.js';
import { chatFromGateway, type GraphDeps } from '../graph/index.js';
import { rewriteSystemPrompt } from '../graph/prompts.js';
import {
  executeAsk,
  type ExecuteAskDeps,
  type ExecuteAskParams,
  type ExecuteAskResult,
} from '../services/ask/index.js';
import { clipSessionWindow, isExplicitSessionBackref } from '../services/ask/session-window.js';
import { getDb } from '../services/db.js';
import { getGateway, getGatewayForTenant } from '../services/gateway/index.js';
import { createDefaultRetrieveDeps } from '../services/retrieve/index.js';
import {
  defaultOutDir,
  evalRunDbRanAt,
  resolveEvalMode,
  resolveRepoRoot,
} from './run-l1-golden.js';

type WindowTurn = { role: 'user' | 'assistant'; content: string };

export type L2Verdict = 'pass' | 'fail' | 'error';

export type L2CaseRow = {
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
  /** 末轮实测 `evidence_snapshot[].docId`；error 行 / 无证据 → `[]` */
  evidenceDocIds: string[];
  /** 命中期望文档（复用 `hitAtKCase`）；无标注 → `null`。**不进判定** */
  docHit: boolean | null;
  /** 图上 answerKind；拒答 / error / 未下发 → 缺省（不冒充 knowledge） */
  answerKind?: 'knowledge' | 'chitchat';
  /** 图上 citations.length；error 行 → 缺省 */
  citationCount?: number;
  /** 合法 citation 三态：`null` = 未下发（≠ 有引用，≠ 无引用）。**不进 failReasons** */
  citationOk: boolean | null;
  failReasons: string[];
  errorMessage?: string;
};

export type L2Report = {
  run_type: 'session_multiturn';
  signoffEligible: boolean;
  evalRunId?: string;
  retrieve_mode: 'mock' | 'live' | 'unknown';
  mode: L2Report['retrieve_mode'];
  rewriteEnabled: boolean;
  ranAt: string;
  kbId: string;
  caseCount: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  zeroToleranceHits: number;
  /**
   * PRD §6.2 四项零容忍的处置档位区块（`l2ZeroToleranceCoverage`，两侧同源）：
   * 逐项声明 `judged: 'mechanical' | 'debt'`，`mechanical` 处带命中数。
   * 今天只有 `historyInEvidence` 一处是机械判（`hits` 与 `zeroToleranceHits` **同源**），
   * 其余四处一律 debt。**如实声明，不进任何判定**。
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
   * 命中期望文档率（复用 `hitAtKCase` / `emptyHitAtK` / `accumulateHitAtK` / `hitAtKRate`）：
   * 分母 = 有非空 `expectedDocIds` 的题数（含 error 题）；分母 0 → null。
   * **未映射（夹具逻辑 id vs `documents.id` uuid）时恒 0，不得当成绩** ——
   * 夹具 `l2-corpus/*` 从未入库、`documents` 无 `external_id`。
   * **不进 `computeL2SignoffEligible`**（PRD §6.2 没有这道门）。
   */
  docHitRate: number | null;
  docHitHits: number;
  docHitScored: number;
  /**
   * 引用完整率：口径 = L1 `citationCompleteRate`（分子 = knowledge ∧ answered ∧ citations>0；
   * 分母 = knowledge ∧ answered；分母 0 → null）。与 L1 同款：**记率、不判词**
   * （不进 `signoffEligible`，不进任何 case 的 `failReasons`）。
   */
  citationComplete: number | null;
  /** 引用完整率分母（knowledge ∧ answered 题数） */
  citationCompleteDen: number;
  /**
   * PRD §8 可复现区块（L2 侧三键）：`l2GoldSetHash` 取真值（本跑实际题面 id 集合，口径 = L1
   * `l1QuestionIdsHash`）；两个版本键**全仓无载体** → 恒 `null`（禁止拿源码文本哈希顶替）。
   * 形状 = `@strict-rag/contracts/eval-repro-l2` 的 `L2Repro`，与 worker 批跑同构；**不进任何判定**。
   */
  repro: L2Repro;
  /**
   * 映射来源三键（**如实标注，不进 `computeL2SignoffEligible`**）：`ledger` = 按账本解析；
   * `none` = 未传账本（逐位保持今天语义）。缺映射继续算 `docHit=false`（恒 0），绝不变成 `null`。
   */
  docMapSource: DocMapSource;
  /** 成功换成 uuid 的去重逻辑 id 数（未传账本 → 0） */
  docMapResolved: number;
  /** 账本里没有的逻辑 id（字典序去重） */
  docMapUnmappedIds: string[];
  cases: L2CaseRow[];
};

export type L2PersistOpts = {
  goldPath?: string;
  tenantId?: string;
  notes?: string;
  /** 注入 rewrite purpose 模型身份；默认 ''。不要把窗/问句算进指纹 */
  rewriteModelId?: string;
};

export type RunL2Options = {
  goldPath: string;
  outDir: string;
  kbId: string;
  maxCases?: number;
  tenantId?: string;
  userId?: string;
  execute?: (params: ExecuteAskParams, deps?: ExecuteAskDeps) => Promise<ExecuteAskResult>;
  executeDeps?: ExecuteAskDeps;
  esMode?: string;
  rewriteEnabled?: boolean;
  /** 写入 PG eval_runs；默认看 L2_PERSIST_EVAL */
  persistEval?: boolean;
  /** 单测注入；默认 persistL2EvalRun（勿连真 PG） */
  persist?: (report: L2Report, opts: L2PersistOpts) => Promise<string>;
  /**
   * 映射账本路径（env `L2_DOC_MAP`，可选）。不传 → 与今天**逐位一致**（`docMapSource='none'`）；
   * 传了 → 读账本并按 `hitAtKCase` 之前解析 `expectedDocIds`（kbId / 指纹不符 → 抛错拒跑）。
   */
  docMapPath?: string;
  /** 夹具根（账本新鲜度校验用）；默认 `resolveRepoRoot()` */
  repoRoot?: string;
};

export type L2CliParse =
  | { ok: true; kbId: string; maxCases?: number }
  | { ok: false; exitCode: 2; message: string };

const DEV_TENANT_ID = '01900000-0000-7000-8000-000000000001';
const DEV_USER_ID = '01900000-0000-7000-8000-0000000000e1';

export { acceptHit, historyLeaked, nextSessionId };

export function parseL2CliEnv(source: NodeJS.ProcessEnv = process.env): L2CliParse {
  const kbId = source.L2_KB_ID;
  if (!kbId) {
    return { ok: false, exitCode: 2, message: 'L2_KB_ID is required' };
  }
  const maxRaw = source.L2_MAX_CASES;
  const maxCases = maxRaw ? Number(maxRaw) : undefined;
  if (maxRaw && (!Number.isFinite(maxCases) || (maxCases as number) < 1)) {
    return { ok: false, exitCode: 2, message: 'L2_MAX_CASES must be a positive number' };
  }
  return { ok: true, kbId, maxCases };
}

function resolveRewriteEnabled(optsValue: boolean | undefined): boolean {
  if (optsValue !== undefined) return optsValue;
  const raw = process.env.L2_REWRITE_ENABLED;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return env.SESSION_REWRITE_ENABLED;
}

/** insert 行形状（不含 id）；纯映射，DB I/O 在 persistL2EvalRun */
export function buildL2EvalRunInsert(
  report: L2Report,
  opts: L2PersistOpts,
): Omit<typeof evalRuns.$inferInsert, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    tenantId: opts.tenantId ?? null,
    kbId: report.kbId,
    runType: 'session_multiturn',
    retrieveMode: report.retrieve_mode,
    signoffEligible: report.signoffEligible ? '1' : '0',
    goldPath: opts.goldPath ?? null,
    caseCount: report.caseCount,
    matrixA: 0,
    matrixB: 0,
    matrixC: 0,
    matrixD: 0,
    coverage: null,
    errorCount: report.errorCount,
    ranAt: evalRunDbRanAt(report.ranAt),
    reportJson: {
      ...report,
      l2Fingerprint: l2RewriteFingerprint(rewriteSystemPrompt(), opts.rewriteModelId ?? ''),
    },
    notes: opts.notes ?? null,
  };
}

/** 将 L2 报告插入 eval_runs；返回 id。禁止调用 L1 persistEvalRun（会写死 golden_2x2）。 */
export async function persistL2EvalRun(report: L2Report, opts: L2PersistOpts): Promise<string> {
  const id = uuidv7();
  await getDb()
    .insert(evalRuns)
    .values({ id, ...buildL2EvalRunInsert(report, opts) });
  return id;
}

export function writeL2Report(
  outDir: string,
  report: L2Report,
): { jsonPath: string; mdPath: string } {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'l2-last-run.json');
  const mdPath = path.join(outDir, 'l2-last-run.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, formatL2ReportMd(report), 'utf8');
  return { jsonPath, mdPath };
}

/**
 * §8 可复现区块的 md 行；取不到的渲染成「—」（不得渲染成 `null` / 空串），照 L1 `reproMdLines` 风格。
 * 两个版本键**全仓无载体** → 恒「—」，不是「本跑没量到」。
 */
function reproMdLines(repro: L2Repro): string[] {
  const dash = (value: string | null): string => (value === null ? '—' : value);
  return [
    '',
    '## 可复现（PRD §8）',
    '',
    '> `l2GoldSetHash` = **本跑实际使用**的题面 id 集合（trim → 去空 → 升序 → sha256），口径同 L1；',
    '> `sessionStrategyVersion` / `rewritePromptVersion` **全仓无版本载体** → 恒「—」（记债，禁止拿源码文本哈希顶替）。区块不进任何判定。',
    '',
    '| 字段 | 值 |',
    '|------|-----|',
    `| l2GoldSetHash | ${dash(repro.l2GoldSetHash)} |`,
    `| sessionStrategyVersion | ${dash(repro.sessionStrategyVersion)} |`,
    `| rewritePromptVersion | ${dash(repro.rewritePromptVersion)} |`,
  ];
}

export function formatL2ReportMd(report: L2Report): string {
  const lines = [
    '# L2 last run',
    '',
    `> **run_type: ${report.run_type}** — 工程批跑；**禁止**当 L2 准出（signoffEligible=${report.signoffEligible}）`,
    '',
    '| 字段 | 值 |',
    '|------|-----|',
    `| ranAt | ${report.ranAt} |`,
    `| kbId | ${report.kbId} |`,
    `| run_type | ${report.run_type} |`,
    `| retrieve_mode | **${report.retrieve_mode}** |`,
    `| mode | ${report.mode} |`,
    `| rewriteEnabled | ${report.rewriteEnabled} |`,
    `| signoffEligible | ${report.signoffEligible} |`,
    `| evalRunId | ${report.evalRunId ?? 'n/a'} |`,
    `| caseCount | ${report.caseCount} |`,
    `| passCount | ${report.passCount} |`,
    `| failCount | ${report.failCount} |`,
    `| errorCount | ${report.errorCount} |`,
    `| zeroToleranceHits | ${report.zeroToleranceHits} |`,
    `| nearCorefPassRate | ${
      report.nearCorefPassRate === null
        ? 'null'
        : String(Math.round(report.nearCorefPassRate * 1000) / 1000)
    } (den=${report.nearCorefPassDen}) |`,
    `| docHitRate | ${
      report.docHitRate === null ? 'null' : String(Math.round(report.docHitRate * 1000) / 1000)
    } (${report.docHitHits}/${report.docHitScored}) —— **未映射时恒 0，不得当成绩**（逻辑 id ≠ KB uuid；不进 signoffEligible） |`,
    `| citationComplete | ${
      report.citationComplete === null
        ? 'null'
        : String(Math.round(report.citationComplete * 1000) / 1000)
    } (den=${report.citationCompleteDen}) —— 只记率、不进判定 |`,
    `| docMapSource | ${report.docMapSource}${
      report.docMapSource === 'ledger'
        ? `（resolved=${report.docMapResolved}，unmapped=${report.docMapUnmappedIds.join(',') || '—'}）`
        : '（未传账本：逻辑 id 映射未启用，缺映射仍算 miss）'
    } |`,
    ...reproMdLines(report.repro),
    '',
    '## zeroToleranceCoverage（PRD §6.2 四项零容忍逐条处置）',
    '',
    '> `mechanical` = 有真机械判据在跑（带命中数）；`debt` = 判不了、如实记债。**记债 ≠ 放行；机械判一处 ≠ 该项已覆盖。**',
    '',
    '| item | judged | place | judged | hits | note |',
    '|------|--------|-------|--------|------|------|',
    ...report.zeroToleranceCoverage.flatMap((item) =>
      item.places.map(
        (p) =>
          `| ${item.key} | ${item.judged} | ${p.key} | ${p.judged} | ${p.hits === null ? '—' : p.hits} | ${p.note} |`,
      ),
    ),
    '',
    '## cases',
    '',
    '| id | type | verdict | status | reason | rewriteUsed | leak | themePersist | docHit | citationOk | fail |',
    '|----|------|---------|--------|--------|-------------|------|--------------|--------|------------|------|',
    ...report.cases.map(
      (c) =>
        `| ${c.id} | ${c.type} | ${c.verdict} | ${c.lastStatus ?? '—'} | ${c.lastReason ?? c.errorMessage ?? '—'} | ${c.rewriteUsed ?? '—'} | ${c.historyInEvidence} | ${c.expectedThemePersist} | ${c.docHit === null ? '—' : String(c.docHit)} | ${c.citationOk === null ? '—' : String(c.citationOk)} | ${c.failReasons.join(',') || '—'} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

export async function runL2Golden(opts: RunL2Options): Promise<L2Report> {
  const gold = loadL2Gold(opts.goldPath);
  const cases = opts.maxCases && opts.maxCases > 0 ? gold.cases.slice(0, opts.maxCases) : gold.cases;
  // 账本先读：kbId / 指纹不符立刻失败，别跑完一整批才发现映射不可用
  const ledger = opts.docMapPath
    ? resolveCorpusLedgerForRun({
        ledgerPath: opts.docMapPath,
        kbId: opts.kbId,
        repoRoot: opts.repoRoot ?? resolveRepoRoot(),
      })
    : null;
  // 有账本时把逻辑 id 换成 uuid（缺映射原样保留 → 必然 miss）；无账本逐位保持今天语义
  const expectedForHit = (
    expected: readonly string[] | undefined,
  ): readonly string[] | undefined =>
    ledger ? resolveExpectedDocIds(expected, ledger) : expected;
  const run = opts.execute ?? executeAsk;
  const tenantId = opts.tenantId ?? process.env.L2_TENANT_ID ?? DEV_TENANT_ID;
  const userId = opts.userId ?? process.env.L2_USER_ID ?? DEV_USER_ID;
  const rewriteEnabled = resolveRewriteEnabled(opts.rewriteEnabled);
  const windows = new Map<string, WindowTurn[]>();

  let liveBase: Pick<GraphDeps, 'chat' | 'retrieveDeps'> | undefined;
  if (!opts.execute && !opts.executeDeps?.graphDeps?.chat) {
    const gw = tenantId ? await getGatewayForTenant(tenantId, opts.kbId) : getGateway();
    liveBase = {
      chat: chatFromGateway(gw),
      retrieveDeps: createDefaultRetrieveDeps(gw),
    };
  }

  const rows: L2CaseRow[] = [];
  const docHitAcc = emptyHitAtK();
  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;
  let zeroToleranceHits = 0;

  for (const c of cases) {
    let prev: string | null = null;
    let last: ExecuteAskResult | undefined;
    try {
      for (const turn of c.turns) {
        const sessionId = nextSessionId(turn.session, prev, () => uuidv7());
        if (sessionId !== undefined) prev = sessionId;

        const body: ExecuteAskParams['body'] = {
          question: turn.text,
          options: { stream: false },
        };
        if (sessionId !== undefined) body.sessionId = sessionId;

        const params: ExecuteAskParams = {
          requestId: uuidv7(),
          kbId: opts.kbId,
          tenantId,
          userId,
          membership: 'member',
          body,
        };

        const graphDeps = {
          ...liveBase,
          ...opts.executeDeps?.graphDeps,
          rewriteEnabled,
          ...(sessionId
            ? {
                loadSessionWindow: async ({ sessionId: sid }: { sessionId: string }) =>
                  clipSessionWindow(windows.get(sid) ?? [], {
                    deepened: isExplicitSessionBackref(turn.text),
                  }),
              }
            : {}),
        } as GraphDeps;

        const result = await run(params, {
          ...opts.executeDeps,
          skipTrace: true,
          graphDeps,
        });
        last = result;

        if (sessionId) {
          const hist = windows.get(sessionId) ?? [];
          hist.push({ role: 'user', content: turn.text });
          const assistant = result.graph.answer || result.graph.userMessage || '';
          if (assistant) hist.push({ role: 'assistant', content: assistant });
          windows.set(sessionId, hist);
        }
      }

      const graph = last!.graph;
      const evidenceTexts = (graph.evidence_snapshot ?? []).map((e) => e.text ?? '');
      const evidenceDocIds = (graph.evidence_snapshot ?? [])
        .map((e) => e.docId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const priorUserTexts = c.turns.slice(0, -1).map((t) => t.text);
      const leaked = historyLeaked(evidenceTexts, priorUserTexts);
      const failReasons: string[] = [];
      if (leaked) failReasons.push('history_in_evidence');
      if (!acceptHit(c.expected.accept, graph.status, graph.reason)) failReasons.push('accept');
      if (graph.rewriteUsed !== c.expected.rewriteUsed) failReasons.push('rewriteUsed');

      const verdict: L2Verdict = failReasons.length ? 'fail' : 'pass';
      if (leaked) zeroToleranceHits += 1;
      if (verdict === 'pass') passCount += 1;
      else failCount += 1;

      // 采集面（只落报告，不进 failReasons / signoffEligible）
      const answerKind =
        graph.answerKind === 'knowledge' || graph.answerKind === 'chitchat'
          ? graph.answerKind
          : undefined;
      // 与 L1 CLI 同款：回包没有 citations 数组按 0 计（answered ∧ knowledge 时代图上必有引用）
      const citationCount = Array.isArray(graph.citations) ? graph.citations.length : 0;
      const docHit = hitAtKCase(expectedForHit(c.expectedDocIds), evidenceDocIds);
      accumulateHitAtK(docHitAcc, docHit);

      rows.push({
        id: c.id,
        type: c.type,
        verdict,
        lastStatus: graph.status,
        lastReason: graph.reason,
        rewriteUsed: graph.rewriteUsed,
        historyInEvidence: leaked,
        expectedThemePersist: c.expected.themePersist,
        expectedDocIds: c.expectedDocIds,
        evidenceDocIds,
        docHit,
        // 只在下发合法值时带上；未下发保持缺省（不冒充 knowledge）
        ...(answerKind ? { answerKind } : {}),
        citationCount,
        citationOk: l2CitationOk({ answerKind, citationCount }),
        failReasons,
      });
    } catch (err) {
      errorCount += 1;
      // error 题按「未命中」计（与 L1 批跑同款）；无 expected 名单仍不计分
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

  const mode = resolveEvalMode(opts.esMode);
  const citation = l2CitationComplete(rows);
  // 映射来源三键（如实标注，不进 computeL2SignoffEligible）：未传账本 → none/0/[]
  const docMap = summarizeDocMap(
    cases.map((c) => c.expectedDocIds),
    ledger,
  );
  const report: L2Report = {
    run_type: 'session_multiturn',
    signoffEligible: computeL2SignoffEligible({
      retrieveMode: mode,
      cases,
      caseCount: rows.length,
      zeroToleranceHits,
      nearCorefPassRate: l2NearCorefPassRate(rows),
    }),
    retrieve_mode: mode,
    mode,
    rewriteEnabled,
    ranAt: new Date().toISOString(),
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
    // §8 区块：剧本集哈希取真值（本跑实际题面集，含 maxCases 截断后的形状）；版本类无载体留 null
    repro: { ...emptyL2Repro(), l2GoldSetHash: l2GoldSetHash(cases.map((c) => c.id)) },
    docMapSource: docMap.docMapSource,
    docMapResolved: docMap.docMapResolved,
    docMapUnmappedIds: docMap.docMapUnmappedIds,
    cases: rows,
  };

  writeL2Report(opts.outDir, report);

  const shouldPersist =
    opts.persistEval === true ||
    (opts.persistEval !== false &&
      (process.env.L2_PERSIST_EVAL === '1' || process.env.L2_PERSIST_EVAL === 'true'));
  if (shouldPersist) {
    // ponytail: 写完文件再 persist；失败上抛，禁止静默当已归档
    report.evalRunId = await (opts.persist ?? persistL2EvalRun)(report, {
      goldPath: opts.goldPath,
      tenantId,
    });
    writeL2Report(opts.outDir, report);
  }

  return report;
}

async function main(): Promise<void> {
  const parsed = parseL2CliEnv();
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exit(2);
  }
  const repoRoot = resolveRepoRoot();
  const goldPath = process.env.L2_GOLD_PATH ?? defaultL2GoldPath(repoRoot);
  const outDir = process.env.L2_OUT_DIR ?? defaultOutDir(repoRoot);
  // 映射账本路径（可选）：不设 → 与今天逐位一致；设了但不可用 → CorpusLedgerError → exit 2
  const docMapPath = process.env.L2_DOC_MAP?.trim() || undefined;

  try {
    const report = await runL2Golden({
      goldPath,
      outDir,
      kbId: parsed.kbId,
      maxCases: parsed.maxCases,
      docMapPath,
    });
    console.log(
      JSON.stringify(
        {
          run_type: report.run_type,
          retrieve_mode: report.retrieve_mode,
          signoffEligible: report.signoffEligible,
          evalRunId: report.evalRunId ?? null,
          rewriteEnabled: report.rewriteEnabled,
          caseCount: report.caseCount,
          passCount: report.passCount,
          failCount: report.failCount,
          errorCount: report.errorCount,
          zeroToleranceHits: report.zeroToleranceHits,
          docMapSource: report.docMapSource,
          outDir,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    if (err instanceof L2GoldLoadError || err instanceof CorpusLedgerError) {
      console.error(err.message);
      process.exit(2);
    }
    console.error(err);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  void main();
}
