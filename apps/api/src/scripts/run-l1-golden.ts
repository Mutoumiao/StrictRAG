/**
 * L1 黄金集批跑 CLI：串行 executeAsk(skipTrace) → 2×2 报告。
 * 默认入口：pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evalRuns, formatLocalDateTime } from '@strict-rag/db';
import { uuidv7 } from 'uuidv7';

import {
  bindQualitySnapshotToEval,
  PILOT_HARD_GATES,
  writeBoundSnapshot,
  type Adr046Snapshot,
  type BindVerdict,
  type HardGates,
} from '../eval/adr046-snapshot.js';
import {
  accumulate,
  accumulateHitAtK,
  computeSignoffEligible,
  coverage,
  emptyHitAtK,
  emptyMatrix,
  goldTypeCounts,
  hitAtKCase,
  hitAtKRate,
  judgeAurocFromScored,
  parseExpectedDocIds,
  parseJudgeCalibration,
  parseMinSupport,
  sweepTau,
  type GoldType,
  type JudgeCalibCase,
  type L1Cell,
  type L1Matrix,
  type L1Outcome,
  type TauSweepPoint,
  cellFor,
} from '../eval/l1-matrix.js';
import { env } from '../env.js';
import {
  executeAsk,
  type ExecuteAskDeps,
  type ExecuteAskParams,
  type ExecuteAskResult,
} from '../services/ask/index.js';
import { getDb } from '../services/db.js';

export type GoldCase = {
  id: string;
  question: string;
  type: GoldType;
  expectedDocIds?: string[];
  expectedChunkIds?: string[];
  rubric?: string;
};

export type L1CaseRow = {
  id: string;
  type: GoldType;
  outcome: L1Outcome;
  cell: L1Cell | null;
  reason?: string;
  errorMessage?: string;
  /** null = 本题无 expectedDocIds，不计分 */
  hitAtK?: boolean | null;
  /** 进 judge 后的 min 分；未进 judge → 缺省 */
  minSupport?: number | null;
};

export type L1Report = {
  /** 与 retrieve_mode 同义（历史字段） */
  mode: 'mock' | 'live' | 'unknown';
  /** OPS-1：签字归因字段；与 mode 同步 */
  retrieve_mode: 'mock' | 'live' | 'unknown';
  /** mock 一律 false；仅 live 可考虑进签字包（仍须人审） */
  signoffEligible: boolean;
  ranAt: string;
  caseCount: number;
  /** 本跑实际题量（受 L1_MAX_CASES 截断） */
  answerableCount: number;
  unanswerableClassCount: number;
  matrix: L1Matrix;
  coverage: number | null;
  /** 有 expectedDocIds 的题：evidence.docId 交集率；无计分题 → null。不进 signoffEligible */
  hitAtK: number | null;
  hitAtKHits: number;
  hitAtKScored: number;
  /** 离线网格上满足试点硬门的最大 τ；没有 → null。不改本跑 2×2 / signoffEligible */
  tauStar: number | null;
  tauSweep: TauSweepPoint[];
  /** 独立校准集 Mann-Whitney；无打分器或单类 → null。不进签字公式 */
  judgeAuroc: number | null;
  judgeAurocScored: number;
  errorCount: number;
  cases: L1CaseRow[];
  kbId: string;
  /** 写入 eval_runs 后的 id（可选） */
  evalRunId?: string;
  /** ADR-046 配置快照（绑定本跑身份；≠ 业务 PASS） */
  gateSnapshot?: Adr046Snapshot;
  gateVerdict?: BindVerdict;
};

export type RunL1Options = {
  goldPath: string;
  outDir: string;
  kbId: string;
  maxCases?: number;
  tenantId?: string;
  userId?: string;
  /** 可注入（单测 mock graph） */
  execute?: (params: ExecuteAskParams, deps?: ExecuteAskDeps) => Promise<ExecuteAskResult>;
  executeDeps?: ExecuteAskDeps;
  /** 写入 PG eval_runs；默认看 L1_PERSIST_EVAL */
  persistEval?: boolean;
  /** 单测注入；默认读 env.RETRIEVE_ES_MODE */
  esMode?: string;
  /** ADR-046 快照覆盖（默认 τ=env.TAU_CLAIM、试点硬门、不代签） */
  snapshot?: {
    snapshotId?: string;
    tauClaim?: number;
    gates?: HardGates;
    proposal?: boolean;
    businessR?: boolean;
    productA?: boolean;
  };
  /** 校准集路径；默认仓根 fixtures/l1/judge-calibration.json */
  judgeCalibPath?: string;
  /** 预解析校准题；有则不再读文件 */
  judgeCalibCases?: readonly JudgeCalibCase[];
  /**
   * 按校准题打分。缺省不跑 live judge → judgeAuroc=null。
   * 返回与 cases 等长；缺/越界分数跳过。
   */
  scoreJudge?: (cases: readonly JudgeCalibCase[]) => Promise<Array<number | null>>;
};

/** 报告 ranAt(ISO) → 写库本地格式串；纯函数便于单测 */
export function evalRunDbRanAt(ranAtIso: string): string {
  const d = new Date(ranAtIso);
  return formatLocalDateTime(Number.isNaN(d.getTime()) ? new Date() : d);
}

/** insert 行形状（不含 id）；纯映射，DB I/O 在 persistEvalRun */
export function buildEvalRunInsert(
  report: L1Report,
  opts: { goldPath?: string; tenantId?: string; notes?: string },
): Omit<typeof evalRuns.$inferInsert, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    tenantId: opts.tenantId ?? null,
    kbId: report.kbId,
    runType: 'golden_2x2',
    retrieveMode: report.retrieve_mode,
    signoffEligible: report.signoffEligible ? '1' : '0',
    goldPath: opts.goldPath ?? null,
    caseCount: report.caseCount,
    matrixA: report.matrix.A,
    matrixB: report.matrix.B,
    matrixC: report.matrix.C,
    matrixD: report.matrix.D,
    coverage: report.coverage,
    errorCount: report.errorCount,
    // 报告 artifact 仍用 ISO；写库列走本地串（db guidelines）
    ranAt: evalRunDbRanAt(report.ranAt),
    status: 'succeeded',
    jobId: null,
    errorMessage: null,
    reportJson: report,
    notes: opts.notes ?? null,
  };
}

/** 将 L1 报告插入 eval_runs；返回 id */
export async function persistEvalRun(
  report: L1Report,
  opts: { goldPath?: string; tenantId?: string; notes?: string },
): Promise<string> {
  const id = uuidv7();
  const db = getDb();
  await db.insert(evalRuns).values({
    id,
    ...buildEvalRunInsert(report, opts),
  });
  return id;
}

export class GoldLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoldLoadError';
  }
}

const GOLD_TYPES = new Set<GoldType>(['answerable', 'unanswerable', 'false_premise']);

export function resolveRepoRoot(fromFile = import.meta.url): string {
  // apps/api/src/scripts → monorepo root
  return path.resolve(path.dirname(fileURLToPath(fromFile)), '../../../..');
}

export function defaultGoldPath(repoRoot = resolveRepoRoot()): string {
  return path.join(repoRoot, 'fixtures/l1/gold.yaml');
}

export function defaultOutDir(repoRoot = resolveRepoRoot()): string {
  return path.join(repoRoot, 'artifacts');
}

export function defaultJudgeCalibPath(repoRoot = resolveRepoRoot()): string {
  return path.join(repoRoot, 'fixtures/l1/judge-calibration.json');
}

export function loadJudgeCalib(calibPath: string): JudgeCalibCase[] {
  let raw: string;
  try {
    raw = readFileSync(calibPath, 'utf8');
  } catch (err) {
    throw new GoldLoadError(`cannot read judge calibration: ${calibPath}: ${(err as Error).message}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new GoldLoadError(`invalid judge calibration JSON in ${calibPath}: ${(err as Error).message}`);
  }
  try {
    return parseJudgeCalibration(data);
  } catch (err) {
    throw new GoldLoadError(
      `invalid judge calibration in ${calibPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function scoreJudgeAuroc(opts: RunL1Options): Promise<{
  judgeAuroc: number | null;
  judgeAurocScored: number;
}> {
  if (!opts.scoreJudge) return { judgeAuroc: null, judgeAurocScored: 0 };
  const cases =
    opts.judgeCalibCases !== undefined
      ? [...opts.judgeCalibCases]
      : loadJudgeCalib(opts.judgeCalibPath ?? defaultJudgeCalibPath());
  if (cases.length === 0) return { judgeAuroc: null, judgeAurocScored: 0 };
  const scores = await opts.scoreJudge(cases);
  if (scores.length !== cases.length) {
    throw new GoldLoadError(
      `scoreJudge length ${scores.length} !== calibration cases ${cases.length}`,
    );
  }
  const scored = judgeAurocFromScored(
    cases.map((c, i) => ({ label: c.label, score: scores[i] })),
  );
  return { judgeAuroc: scored.auroc, judgeAurocScored: scored.scored };
}

export function resolveEvalMode(
  esMode: string | undefined = env.RETRIEVE_ES_MODE,
): L1Report['mode'] {
  if (esMode === 'mock') return 'mock';
  if (esMode === 'http') return 'live';
  return 'unknown';
}

export function loadGold(goldPath: string): GoldCase[] {
  let raw: string;
  try {
    raw = readFileSync(goldPath, 'utf8');
  } catch (err) {
    throw new GoldLoadError(`cannot read gold file: ${goldPath}: ${(err as Error).message}`);
  }
  let data: unknown;
  try {
    // ponytail: gold.yaml is JSON-shaped (zero yaml dep); .json also ok
    data = JSON.parse(raw);
  } catch (err) {
    throw new GoldLoadError(`invalid gold JSON in ${goldPath}: ${(err as Error).message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new GoldLoadError('gold root must be object');
  }
  const cases = (data as { cases?: unknown }).cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new GoldLoadError('gold.cases must be a non-empty array');
  }
  const out: GoldCase[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (!c || typeof c !== 'object') {
      throw new GoldLoadError(`cases[${i}] must be object`);
    }
    const row = c as Record<string, unknown>;
    const id = row.id;
    const question = row.question;
    const type = row.type;
    if (typeof id !== 'string' || !id) {
      throw new GoldLoadError(`cases[${i}].id required string`);
    }
    if (typeof question !== 'string' || !question) {
      throw new GoldLoadError(`cases[${i}].question required string`);
    }
    if (typeof type !== 'string' || !GOLD_TYPES.has(type as GoldType)) {
      throw new GoldLoadError(
        `cases[${i}].type must be answerable|unanswerable|false_premise`,
      );
    }
    let expectedDocIds: string[] | undefined;
    try {
      expectedDocIds = parseExpectedDocIds(row.expectedDocIds) ?? undefined;
    } catch (err) {
      throw new GoldLoadError(
        `cases[${i}].expectedDocIds ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    out.push({
      id,
      question,
      type: type as GoldType,
      expectedDocIds,
      expectedChunkIds: Array.isArray(row.expectedChunkIds)
        ? (row.expectedChunkIds as string[])
        : undefined,
      rubric: typeof row.rubric === 'string' ? row.rubric : undefined,
    });
  }
  return out;
}

export function writeL1Report(outDir: string, report: L1Report): { jsonPath: string; mdPath: string } {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'l1-last-run.json');
  const mdPath = path.join(outDir, 'l1-last-run.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, formatReportMd(report), 'utf8');
  return { jsonPath, mdPath };
}

export function formatReportMd(report: L1Report): string {
  const { matrix: m } = report;
  const cov =
    report.coverage === null ? 'null' : String(Math.round(report.coverage * 1000) / 1000);
  const lines = [
    '# L1 last run',
    '',
    `> **retrieve_mode: ${report.retrieve_mode}** — mock 数字禁止写入业务签字页（signoffEligible=${report.signoffEligible}）`,
    '',
    `| 字段 | 值 |`,
    `|------|-----|`,
    `| ranAt | ${report.ranAt} |`,
    `| kbId | ${report.kbId} |`,
    `| caseCount | ${report.caseCount} |`,
    `| answerableCount | ${report.answerableCount} |`,
    `| unanswerableClassCount | ${report.unanswerableClassCount} |`,
    `| retrieve_mode | **${report.retrieve_mode}** |`,
    `| mode | ${report.mode} |`,
    `| signoffEligible | ${report.signoffEligible} |`,
    `| errorCount | ${report.errorCount} |`,
    `| coverage | ${cov} |`,
    `| hitAtK | ${
      report.hitAtK === null ? 'null' : String(Math.round(report.hitAtK * 1000) / 1000)
    } (${report.hitAtKHits}/${report.hitAtKScored}) |`,
    `| tauStar | ${report.tauStar === null ? 'null' : String(report.tauStar)} |`,
    `| judgeAuroc | ${
      report.judgeAuroc === null ? 'null' : String(Math.round(report.judgeAuroc * 1000) / 1000)
    } (${report.judgeAurocScored}) |`,
    `| gate_bundle | ${report.gateSnapshot?.gate_bundle ?? '—'} |`,
    `| signedPackage | ${report.gateVerdict?.signedPackage ?? false} |`,
    `| businessPass | ${report.gateVerdict?.businessPass ?? false} |`,
    '',
    '## 2×2',
    '',
    '|  | answered | abstained |',
    '|--|----------|-----------|',
    `| 可答 | A=${m.A} | B=${m.B} |`,
    `| 不可答 | C=${m.C} | D=${m.D} |`,
    '',
    '## cases',
    '',
    '| id | type | outcome | cell | hitAtK | reason |',
    '|----|------|---------|------|--------|--------|',
    ...report.cases.map(
      (c) =>
        `| ${c.id} | ${c.type} | ${c.outcome} | ${c.cell ?? '—'} | ${c.hitAtK === null || c.hitAtK === undefined ? '—' : String(c.hitAtK)} | ${c.reason ?? c.errorMessage ?? ''} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

/** 串行批跑；outcome=error 不进矩阵格 */
export async function runL1Golden(opts: RunL1Options): Promise<L1Report> {
  const all = loadGold(opts.goldPath);
  const cases = opts.maxCases && opts.maxCases > 0 ? all.slice(0, opts.maxCases) : all;
  const run = opts.execute ?? executeAsk;
  const matrix = emptyMatrix();
  const hitAcc = emptyHitAtK();
  let errorCount = 0;
  const rows: L1CaseRow[] = [];
  const tenantId = opts.tenantId ?? process.env.L1_TENANT_ID ?? '01900000-0000-7000-8000-000000000001';
  const userId = opts.userId ?? process.env.L1_USER_ID ?? '01900000-0000-7000-8000-0000000000e1';

  for (const c of cases) {
    const requestId = uuidv7();
    const params: ExecuteAskParams = {
      requestId,
      kbId: opts.kbId,
      tenantId,
      userId,
      membership: 'member',
      body: { question: c.question, options: { stream: false } },
    };
    let outcome: L1Outcome;
    let reason: string | undefined;
    let errorMessage: string | undefined;
    let evidenceDocIds: string[] = [];
    let minSupport: number | null = null;
    try {
      const result = await run(params, {
        skipTrace: true,
        ...opts.executeDeps,
      });
      outcome = result.graph.status;
      reason = result.graph.reason;
      evidenceDocIds = (result.graph.evidence_snapshot ?? [])
        .map((e) => e.docId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      minSupport = parseMinSupport(result.graph.minSupport);
    } catch (err) {
      outcome = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    errorCount += accumulate(matrix, c.type, outcome);
    const hit = hitAtKCase(c.expectedDocIds, evidenceDocIds);
    accumulateHitAtK(hitAcc, hit);
    rows.push({
      id: c.id,
      type: c.type,
      outcome,
      cell: cellFor(c.type, outcome),
      reason,
      errorMessage,
      hitAtK: hit,
      minSupport,
    });
  }

  const mode = resolveEvalMode(opts.esMode);
  const counts = goldTypeCounts(cases);
  const swept = sweepTau(rows);
  const calib = await scoreJudgeAuroc(opts);
  const report: L1Report = {
    mode,
    retrieve_mode: mode,
    // ponytail: live≠自动签字；规模不足/mock 一律 false
    signoffEligible: computeSignoffEligible(mode, counts),
    ranAt: new Date().toISOString(),
    caseCount: rows.length,
    answerableCount: counts.answerable,
    unanswerableClassCount: counts.unanswerableClass,
    matrix,
    coverage: coverage(matrix),
    hitAtK: hitAtKRate(hitAcc),
    hitAtKHits: hitAcc.hits,
    hitAtKScored: hitAcc.scored,
    tauStar: swept.tauStar,
    tauSweep: swept.grid,
    judgeAuroc: calib.judgeAuroc,
    judgeAurocScored: calib.judgeAurocScored,
    errorCount,
    cases: rows,
    kbId: opts.kbId,
  };

  const wantPersist =
    opts.persistEval === true ||
    (opts.persistEval !== false &&
      (process.env.L1_PERSIST_EVAL === '1' || process.env.L1_PERSIST_EVAL === 'true'));
  if (wantPersist) {
    try {
      report.evalRunId = await persistEvalRun(report, {
        goldPath: opts.goldPath,
        tenantId,
        notes: mode === 'mock' ? 'mock run — not for business sign-off' : undefined,
      });
    } catch (err) {
      console.error(
        'persist eval_runs failed (report files still written):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ponytail: 快照绑本跑身份；默认不代签。coverage=0 / internal_guard 不会翻 businessPass
  const snapIn = opts.snapshot;
  const bound = bindQualitySnapshotToEval({
    snapshotId: snapIn?.snapshotId ?? uuidv7(),
    kbId: report.kbId,
    evalRunId: report.evalRunId ?? null,
    ranAt: report.ranAt,
    retrieve_mode: mode,
    tauClaim: snapIn?.tauClaim ?? env.TAU_CLAIM,
    gates: snapIn?.gates ?? { ...PILOT_HARD_GATES },
    proposal: snapIn?.proposal,
    businessR: snapIn?.businessR,
    productA: snapIn?.productA,
    signoffEligible: report.signoffEligible,
    coverage: report.coverage,
    caseReasons: rows.map((r) => r.reason),
  });
  report.gateSnapshot = bound.snapshot;
  report.gateVerdict = bound.verdict;
  writeBoundSnapshot(opts.outDir, bound.snapshot, bound.verdict);

  writeL1Report(opts.outDir, report);
  return report;
}

async function main(): Promise<void> {
  const kbId = process.env.L1_KB_ID;
  if (!kbId) {
    console.error('L1_KB_ID is required');
    process.exit(2);
  }
  const maxRaw = process.env.L1_MAX_CASES;
  const maxCases = maxRaw ? Number(maxRaw) : undefined;
  if (maxRaw && (!Number.isFinite(maxCases) || (maxCases as number) < 1)) {
    console.error('L1_MAX_CASES must be a positive number');
    process.exit(2);
  }
  const repoRoot = resolveRepoRoot();
  const goldPath = process.env.L1_GOLD_PATH ?? defaultGoldPath(repoRoot);
  const outDir = process.env.L1_OUT_DIR ?? defaultOutDir(repoRoot);

  try {
    const report = await runL1Golden({
      goldPath,
      outDir,
      kbId,
      maxCases,
    });
    console.log(
      JSON.stringify(
        {
          mode: report.mode,
          retrieve_mode: report.retrieve_mode,
          signoffEligible: report.signoffEligible,
          evalRunId: report.evalRunId ?? null,
          evalBindId: report.gateSnapshot?.evalBindId ?? null,
          signedPackage: report.gateVerdict?.signedPackage ?? false,
          businessPass: report.gateVerdict?.businessPass ?? false,
          caseCount: report.caseCount,
          answerableCount: report.answerableCount,
          unanswerableClassCount: report.unanswerableClassCount,
          matrix: report.matrix,
          coverage: report.coverage,
          hitAtK: report.hitAtK,
          hitAtKHits: report.hitAtKHits,
          hitAtKScored: report.hitAtKScored,
          tauStar: report.tauStar,
          judgeAuroc: report.judgeAuroc,
          judgeAurocScored: report.judgeAurocScored,
          errorCount: report.errorCount,
          outDir,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    if (err instanceof GoldLoadError) {
      console.error(err.message);
      process.exit(2);
    }
    console.error(err);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  void main();
}
