/**
 * L1 黄金集批跑 CLI：串行 executeAsk(skipTrace) → 2×2 报告。
 * 默认入口：pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AskModeSchema, toHumanSpotReport, type HumanSpotReport } from '@strict-rag/contracts';
import {
  emptyL1Repro,
  l1CalibSetHash,
  l1QuestionIdsHash,
  type L1Repro,
  type L1ReproKbBinding,
} from '@strict-rag/contracts/eval-repro';
import {
  resolveExpectedDocIds,
  summarizeDocMap,
  type DocMapSource,
} from '@strict-rag/contracts/eval-corpus-ledger';
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
import { CorpusLedgerError, resolveCorpusLedgerForRun } from '../eval/corpus-map.js';
import { HumanSpotLoadError, loadHumanSpotLedger } from '../eval/human-spot.js';
import { liveJudgeScorerFromEnv } from '../eval/judge-scorer.js';
import {
  accumulate,
  accumulateHitAtK,
  citationCompleteRate,
  computeSignoffEligible,
  coverage,
  cRate,
  emptyHitAtK,
  emptyMatrix,
  goldTypeCounts,
  hitAtKCase,
  hitAtKRate,
  judgeAurocFromScored,
  judgeAurocSourceFor,
  mockJudgeScorer,
  parseExpectedDocIds,
  parseJudgeCalibration,
  parseMinSupport,
  sweepTau,
  type GoldType,
  type JudgeAurocSource,
  type JudgeCalibCase,
  type JudgeCalibScorerMode,
  type L1Cell,
  type L1Matrix,
  type L1Outcome,
  type TauSweepPoint,
  cellFor,
} from '../eval/l1-matrix.js';
import { env } from '../env.js';
import { retrieveBudgetForMode } from '../graph/budget.js';
import {
  executeAsk,
  type ExecuteAskDeps,
  type ExecuteAskParams,
  type ExecuteAskResult,
} from '../services/ask/index.js';
import { getDb } from '../services/db.js';
import { modelGatewayRepo } from '../services/model-gateway.js';

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
  /** 图上的答案域；拒答 / error 无该字段 */
  answerKind?: 'knowledge' | 'chitchat';
  /** 图上 citations.length；采不到（error）→ 缺省 */
  citationCount?: number;
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
  /**
   * 打分器来源三态（判定只认 `live`）：`off` → `none`、`mock` → `mock`、`http` → `live`。
   * mock 值可打印但**绝不进判定**（PRD §6.1 / ADR-061）。
   */
  judgeAurocSource: JudgeAurocSource;
  /**
   * 引用完整率：分子 = answerKind='knowledge' ∧ outcome='answered' ∧ citations>0；
   * 分母 = answerKind='knowledge' ∧ outcome='answered'；分母 0 → null（该门不适用）。
   * 图在 answered ∧ knowledge 时结构上必带合法 citation（graph/run.ts validIds 闸），
   * 故本率结构上只能是 1 或 null —— 此门钉的是该不变式，不是筛掉不合格跑次。
   */
  citationComplete: number | null;
  /** 引用完整率分母（knowledge ∧ answered 题数） */
  citationCompleteDen: number;
  /** 人工抽检（PRD §6 硬门）：账本登记的条数 / 错数 / 来源；缺测 → null（该门不放行） */
  humanSpot: HumanSpotReport | null;
  /**
   * PRD §8 可复现区块：能取到的取真值，取不到的一律 `null`（禁止占位串）。
   * 形状 = `@strict-rag/contracts/eval-repro` 的 `L1Repro`，与 worker 批跑同构；不进任何判定。
   */
  repro: L1Repro;
  errorCount: number;
  cases: L1CaseRow[];
  kbId: string;
  /**
   * 映射来源三态（**如实标注，不进任何判定**）：`ledger` = 按账本解析；`none` = 未传账本
   * （逐位保持今天语义）。缺映射**继续算 miss**，绝不变成 `null` / 「该门不适用」。
   */
  docMapSource: DocMapSource;
  /** 成功换成 uuid 的去重逻辑 id 数（未传账本 → 0） */
  docMapResolved: number;
  /** 账本里没有的逻辑 id（字典序去重）；这些 id 原样进比对，必然 miss */
  docMapUnmappedIds: string[];
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
   * 打分器来源声明（默认读 env `JUDGE_CALIB_SCORER` = `off`）。**声明是来源的唯一决定者**：
   * `off` 不跑任何打分器（注入的 `scoreJudge` 也不跑）→ 缺测；`mock` 跑内置确定性伪打分器；
   * `http` 才用注入的（= 真 Gateway）打分器。禁止用注入绕过声明，也禁止 mock 冒充 live。
   */
  judgeScorerMode?: JudgeCalibScorerMode;
  /**
   * 按校准题打分。只在声明 `http`（live）时生效；缺省不跑 live judge → judgeAuroc=null。
   * 返回与 cases 等长；缺/越界分数跳过。
   */
  scoreJudge?: (cases: readonly JudgeCalibCase[]) => Promise<Array<number | null>>;
  /** 人工抽检账本路径（CLI `--human-spot <path>`）；**不传 = 缺测**（该门不放行） */
  humanSpotPath?: string;
  /**
   * 映射账本路径（env `L1_DOC_MAP`，可选）。不传 → 与今天**逐位一致**（`docMapSource='none'`）；
   * 传了 → 读账本并按 `hitAtKCase` 之前解析 `expectedDocIds`（kbId / 指纹不符 → 抛错拒跑）。
   */
  docMapPath?: string;
  /** 夹具根（账本新鲜度校验用）；默认 `resolveRepoRoot()` */
  repoRoot?: string;
  /**
   * §8 `models.kbBindings` 读取器（需读库；CLI `main()` 注入 `modelGatewayRepo.listKbBindings`）。
   * 不注入 / 读库失败 = 取不到 → `null`（不得编造绑定）。
   */
  readKbBindings?: (kbId: string, tenantId: string) => Promise<readonly L1ReproKbBinding[]>;
};

/** CLI 参数解析结果：`ok:false` 时由 `main()` 打 stderr + exit 2 */
export type L1CliArgs = { ok: true; humanSpotPath?: string } | { ok: false; error: string };

/**
 * `--human-spot <path>` / `--human-spot=<path>`；不传 = 缺测。
 * 其余键仍走 env（`L1_*`），未知参数忽略（保持既有 CLI 兼容）。
 */
export function parseL1CliArgs(argv: readonly string[]): L1CliArgs {
  let humanSpotPath: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    let value: string | undefined;
    if (arg === '--human-spot') {
      value = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--human-spot=')) {
      value = arg.slice('--human-spot='.length);
    } else {
      continue;
    }
    if (!value || value.startsWith('--')) {
      return { ok: false, error: '--human-spot requires a ledger path' };
    }
    humanSpotPath = value;
  }
  return { ok: true, humanSpotPath };
}

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

/**
 * 校准打分器 → (值, 有效对数, 来源)。
 * 来源只由声明决定（env / 单测入参），注入的打分器只是「怎么打分」：
 * - `off`（默认）→ 不跑任何打分器 → `none` + null（把「未测」显形为红）；
 * - `mock` → 内置确定性伪打分器 → `mock`（值可打印，**判定不认**）；
 * - `http` → 注入的真 Gateway 打分器 → `live`（没注入 = 没测 → null）。
 */
async function scoreJudgeAuroc(opts: RunL1Options): Promise<{
  judgeAuroc: number | null;
  judgeAurocScored: number;
  judgeAurocSource: JudgeAurocSource;
}> {
  const mode = opts.judgeScorerMode ?? env.JUDGE_CALIB_SCORER;
  const judgeAurocSource = judgeAurocSourceFor(mode);
  const scorer =
    mode === 'mock'
      ? async (cases: readonly JudgeCalibCase[]) => mockJudgeScorer(cases)
      : mode === 'http'
        ? opts.scoreJudge
        : undefined;
  if (!scorer) return { judgeAuroc: null, judgeAurocScored: 0, judgeAurocSource };
  const cases =
    opts.judgeCalibCases !== undefined
      ? [...opts.judgeCalibCases]
      : loadJudgeCalib(opts.judgeCalibPath ?? defaultJudgeCalibPath());
  if (cases.length === 0) return { judgeAuroc: null, judgeAurocScored: 0, judgeAurocSource };
  const scores = await scorer(cases);
  if (scores.length !== cases.length) {
    throw new GoldLoadError(
      `scoreJudge length ${scores.length} !== calibration cases ${cases.length}`,
    );
  }
  const scored = judgeAurocFromScored(
    cases.map((c, i) => ({ label: c.label, score: scores[i] })),
  );
  return { judgeAuroc: scored.auroc, judgeAurocScored: scored.scored, judgeAurocSource };
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

/** env 侧模型 id：未配 / 空白 → null（不得把空串当「已配」写进报告）。 */
function envModelOrNull(value: string): string | null {
  return value.trim().length > 0 ? value : null;
}

/**
 * §8 `retrieveK` / `rerankTopN`：本次 run 档位（图上回包 `graph.mode`）→ `graph/budget.ts` 冻结表。
 * 档位非法 / 整批无回包 → null（不得拿 `balanced` 默认值替图上实际档位）。
 */
function reproBudgetForAskMode(mode: unknown): { retrieveK: number; rerankTopN: number } | null {
  const parsed = AskModeSchema.safeParse(mode);
  if (!parsed.success) return null;
  return retrieveBudgetForMode(parsed.data);
}

/**
 * §8 校准集内容：只为算哈希读文件；读不到 → null（无打分器时该文件非必需，**不得**因此抛错）。
 */
function readJudgeCalibContentIfPresent(calibPath: string): string | null {
  try {
    return readFileSync(calibPath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * §8 可复现区块：能取到的取真值，取不到一律 `null`（禁止 `''` / `'unknown'` / `'-'` 占位串）。
 * 恒 `null` 的记债项（seed / fallbackChains 版本 / crag* / promptVersions / lifecycle 规则
 * / session 策略 / L2 剧本集哈希）由 `emptyL1Repro()` 铺底，不在此处编造。
 */
function buildL1Repro(input: {
  goldIds: readonly string[];
  calibContent: string | null;
  askMode: unknown;
  tauClaim: number | null;
  kbBindings: readonly L1ReproKbBinding[] | null;
}): L1Repro {
  const budget = reproBudgetForAskMode(input.askMode);
  return {
    ...emptyL1Repro(),
    models: {
      env: {
        chat: envModelOrNull(env.GATEWAY_CHAT_MODEL),
        embed: envModelOrNull(env.GATEWAY_EMBED_MODEL),
        rerank: envModelOrNull(env.GATEWAY_RERANK_MODEL),
      },
      kbBindings: input.kbBindings,
    },
    retrieveK: budget ? budget.retrieveK : null,
    rerankTopN: budget ? budget.rerankTopN : null,
    tauClaim: input.tauClaim,
    questionIdsHash: l1QuestionIdsHash(input.goldIds),
    calibrationHash: l1CalibSetHash(input.calibContent),
  };
}

/** §8 区块的 md 行；取不到的渲染成「—」（不得渲染成 `null` / 空串）。 */
function reproMdLines(repro: L1Repro): string[] {
  const dash = (value: string | number | null): string => (value === null ? '—' : String(value));
  const bindings = repro.models.kbBindings;
  const rows: Array<[string, string]> = [
    ['models.env.chat', dash(repro.models.env.chat)],
    ['models.env.embed', dash(repro.models.env.embed)],
    ['models.env.rerank', dash(repro.models.env.rerank)],
    [
      'models.kbBindings',
      bindings === null
        ? '—'
        : bindings.length === 0
          ? '（无绑定）'
          : bindings
              .map(
                (b) =>
                  `${b.purpose}=${b.primaryRef}${b.fallbackRefs.length > 0 ? ` (+${b.fallbackRefs.length} 备)` : ''}`,
              )
              .join('；'),
    ],
    ['retrieveK', dash(repro.retrieveK)],
    ['rerankTopN', dash(repro.rerankTopN)],
    ['tauClaim', dash(repro.tauClaim)],
    ['contextMode', dash(repro.contextMode)],
    ['questionIdsHash', dash(repro.questionIdsHash)],
    ['calibrationHash', dash(repro.calibrationHash)],
    ['seed', dash(repro.seed)],
    ['fallbackChainsVersion', dash(repro.fallbackChainsVersion)],
    ['crag', dash(repro.crag)],
    ['promptVersions', dash(repro.promptVersions)],
    ['lifecycleFilterVersion', dash(repro.lifecycleFilterVersion)],
    ['sessionStrategyVersion', dash(repro.sessionStrategyVersion)],
    ['l2GoldSetHash', dash(repro.l2GoldSetHash)],
  ];
  return [
    '',
    '## 可复现（PRD §8）',
    '',
    '| 字段 | 值 |',
    '|------|-----|',
    ...rows.map(([key, value]) => `| ${key} | ${value} |`),
  ];
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
  const cr = cRate(m);
  const crText = cr === null ? 'null' : String(Math.round(cr * 1000) / 1000);
  const ccText =
    report.citationComplete === null
      ? 'null'
      : String(Math.round(report.citationComplete * 1000) / 1000);
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
    `| cRate | ${crText} |`,
    `| hitAtK | ${
      report.hitAtK === null ? 'null' : String(Math.round(report.hitAtK * 1000) / 1000)
    } (${report.hitAtKHits}/${report.hitAtKScored}) |`,
    `| docMapSource | ${report.docMapSource}${
      report.docMapSource === 'ledger'
        ? `（resolved=${report.docMapResolved}，unmapped=${report.docMapUnmappedIds.join(',') || '—'}）`
        : '（未传账本：逻辑 id 映射未启用，缺映射仍算 miss）'
    } |`,
    `| citationComplete | ${ccText} (den=${report.citationCompleteDen}) |`,
    `| humanSpot | ${
      report.humanSpot === null
        ? '—（缺测：未登记账本）'
        : `${report.humanSpot.checked} 条 / 错 ${report.humanSpot.errors}（来源：${report.humanSpot.source}）`
    } |`,
    `| tauStar | ${report.tauStar === null ? 'null' : String(report.tauStar)} |`,
    `| judgeAuroc | ${
      report.judgeAuroc === null ? 'null' : String(Math.round(report.judgeAuroc * 1000) / 1000)
    } (${report.judgeAurocScored}) |`,
    `| judgeAurocSource | ${report.judgeAurocSource}${
      report.judgeAurocSource === 'live' ? '' : '（不入判定）'
    } |`,
    `| gate_bundle | ${report.gateSnapshot?.gate_bundle ?? '—'} |`,
    `| signedPackage | ${report.gateVerdict?.signedPackage ?? false} |`,
    `| businessPass | ${report.gateVerdict?.businessPass ?? false} |`,
    ...reproMdLines(report.repro),
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
  // 账本先读：账本坏了立刻失败，别跑完一整批才发现登记面不可用
  const humanSpot = opts.humanSpotPath
    ? toHumanSpotReport(loadHumanSpotLedger(opts.humanSpotPath), opts.humanSpotPath)
    : null;
  const cases = opts.maxCases && opts.maxCases > 0 ? all.slice(0, opts.maxCases) : all;
  // 账本先读：kbId / 指纹不符立刻失败，别跑完一整批才发现映射不可用
  const ledger = opts.docMapPath
    ? resolveCorpusLedgerForRun({
        ledgerPath: opts.docMapPath,
        kbId: opts.kbId,
        repoRoot: opts.repoRoot ?? resolveRepoRoot(),
      })
    : null;
  const run = opts.execute ?? executeAsk;
  const matrix = emptyMatrix();
  const hitAcc = emptyHitAtK();
  let errorCount = 0;
  /** 图上回包的实际 ask 档位（§8 retrieveK/rerankTopN 的来源）；整批无回包 → null */
  let askMode: string | null = null;
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
    let answerKind: 'knowledge' | 'chitchat' | undefined;
    let citationCount: number | undefined;
    try {
      const result = await run(params, {
        skipTrace: true,
        ...opts.executeDeps,
      });
      outcome = result.graph.status;
      reason = result.graph.reason;
      answerKind = result.graph.answerKind;
      // §8 retrieveK / rerankTopN 的来源：图上实际档位（批跑整批同档位，取第一个成功回包）
      if (askMode === null && typeof result.graph.mode === 'string') askMode = result.graph.mode;
      const citations = result.graph.citations;
      citationCount = Array.isArray(citations) ? citations.length : 0;
      evidenceDocIds = (result.graph.evidence_snapshot ?? [])
        .map((e) => e.docId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      minSupport = parseMinSupport(result.graph.minSupport);
    } catch (err) {
      outcome = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    errorCount += accumulate(matrix, c.type, outcome);
    // 有账本时把逻辑 id 换成 uuid（缺映射原样保留 → 必然 miss）；无账本逐位保持今天语义
    const expectedDocIds = ledger
      ? resolveExpectedDocIds(c.expectedDocIds, ledger)
      : c.expectedDocIds;
    const hit = hitAtKCase(expectedDocIds, evidenceDocIds);
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
      answerKind,
      citationCount,
    });
  }

  const mode = resolveEvalMode(opts.esMode);
  const counts = goldTypeCounts(cases);
  // 映射来源三键（如实标注，不进任何判定）：未传账本 → none/0/[]
  const docMap = summarizeDocMap(
    cases.map((c) => c.expectedDocIds),
    ledger,
  );
  const swept = sweepTau(rows);
  const calib = await scoreJudgeAuroc(opts);
  const snapIn = opts.snapshot;
  // τ 唯一源：快照覆盖 ?? ADR-007 的 env.TAU_CLAIM。报告与快照读同一个值，不出现两个 τ
  const tauClaim = snapIn?.tauClaim ?? env.TAU_CLAIM;

  // §8 models.kbBindings：需读库，读不到 = 取不到 → null（不得编造绑定）
  let kbBindings: readonly L1ReproKbBinding[] | null = null;
  if (opts.readKbBindings) {
    try {
      kbBindings = await opts.readKbBindings(opts.kbId, tenantId);
    } catch (err) {
      console.error(
        'repro: read KB model bindings failed (models.kbBindings=null):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // §8 校准集内容：注入校准题（单测）时无文件内容 → 哈希取不到；恒 null 字段由 emptyL1Repro 铺底
  const calibContent =
    opts.judgeCalibCases !== undefined
      ? null
      : readJudgeCalibContentIfPresent(opts.judgeCalibPath ?? defaultJudgeCalibPath());

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
    judgeAurocSource: calib.judgeAurocSource,
    citationComplete: citationCompleteRate(rows),
    citationCompleteDen: rows.filter(
      (r) => r.outcome === 'answered' && r.answerKind === 'knowledge',
    ).length,
    humanSpot,
    repro: buildL1Repro({
      goldIds: all.map((c) => c.id),
      calibContent,
      askMode,
      tauClaim,
      kbBindings,
    }),
    errorCount,
    cases: rows,
    kbId: opts.kbId,
    docMapSource: docMap.docMapSource,
    docMapResolved: docMap.docMapResolved,
    docMapUnmappedIds: docMap.docMapUnmappedIds,
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

  // ponytail: 快照绑本跑身份；默认不代签。实测硬门（覆盖 / C 率 / Hit@k / AUROC / 引用完整率）
  // 全量传进闸；缺测 null → 不放行（hit@k 无标注、引用完整率分母 0 除外）
  const bound = bindQualitySnapshotToEval({
    snapshotId: snapIn?.snapshotId ?? uuidv7(),
    kbId: report.kbId,
    evalRunId: report.evalRunId ?? null,
    ranAt: report.ranAt,
    retrieve_mode: mode,
    tauClaim,
    gates: snapIn?.gates ?? { ...PILOT_HARD_GATES },
    proposal: snapIn?.proposal,
    businessR: snapIn?.businessR,
    productA: snapIn?.productA,
    signoffEligible: report.signoffEligible,
    coverage: report.coverage,
    cRate: cRate(matrix),
    hitAtK: report.hitAtK,
    judgeAuroc: report.judgeAuroc,
    judgeAurocSource: report.judgeAurocSource,
    judgeCalibPairs: report.judgeAurocScored,
    citationComplete: report.citationComplete,
    humanSpot: report.humanSpot,
    caseReasons: rows.map((r) => r.reason),
  });
  report.gateSnapshot = bound.snapshot;
  report.gateVerdict = bound.verdict;
  writeBoundSnapshot(opts.outDir, bound.snapshot, bound.verdict);

  writeL1Report(opts.outDir, report);
  return report;
}

async function main(): Promise<void> {
  const args = parseL1CliArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.error);
    process.exit(2);
  }
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
  // 映射账本路径（可选）：不设 → 与今天逐位一致；设了但不可用 → CorpusLedgerError → exit 2
  const docMapPath = process.env.L1_DOC_MAP?.trim() || undefined;

  // 打分器来源声明（默认 off = 缺测）。声明 http 时才接真 Gateway：
  // Gateway 侧不齐（仍是 mock）→ 直接 exit 2，禁止把 mock 分数标成 live。
  const judgeScorerMode = env.JUDGE_CALIB_SCORER;
  let scoreJudge: RunL1Options['scoreJudge'];
  if (judgeScorerMode === 'http') {
    try {
      scoreJudge = liveJudgeScorerFromEnv();
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(2);
    }
  }

  try {
    const report = await runL1Golden({
      goldPath,
      outDir,
      kbId,
      maxCases,
      humanSpotPath: args.humanSpotPath,
      docMapPath,
      judgeScorerMode,
      scoreJudge,
      // §8 models.kbBindings：读库失败走 runL1Golden 的 catch → null（不得编造绑定）
      readKbBindings: async (kb, tenant) =>
        (await modelGatewayRepo.listKbBindings(tenant, kb)).map((r) => ({
          purpose: r.purpose,
          primaryRef: r.primaryRef,
          fallbackRefs: r.fallbackRefs,
        })),
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
          docMapSource: report.docMapSource,
          docMapResolved: report.docMapResolved,
          docMapUnmappedIds: report.docMapUnmappedIds,
          citationComplete: report.citationComplete,
          citationCompleteDen: report.citationCompleteDen,
          tauStar: report.tauStar,
          judgeAuroc: report.judgeAuroc,
          judgeAurocScored: report.judgeAurocScored,
          judgeAurocSource: report.judgeAurocSource,
          humanSpot: report.humanSpot,
          repro: report.repro,
          errorCount: report.errorCount,
          outDir,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    if (
      err instanceof GoldLoadError ||
      err instanceof HumanSpotLoadError ||
      err instanceof CorpusLedgerError
    ) {
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
