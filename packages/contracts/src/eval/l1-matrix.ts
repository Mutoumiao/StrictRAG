/**
 * L1 2×2 矩阵纯函数（评测 PRD §2）。
 * error 不进 A–D，由调用方累计 errorCount。
 * api CLI 与 worker eval 消费者共用。
 */

export const GOLD_TYPES = ['answerable', 'unanswerable', 'false_premise'] as const;
export type GoldType = (typeof GOLD_TYPES)[number];
export type L1Outcome = 'answered' | 'abstained' | 'error';
export type L1Cell = 'A' | 'B' | 'C' | 'D';
export type EvalRetrieveMode = 'mock' | 'live' | 'unknown';

export type L1Matrix = { A: number; B: number; C: number; D: number };

export function emptyMatrix(): L1Matrix {
  return { A: 0, B: 0, C: 0, D: 0 };
}

/** type×outcome → 格；error → null（不计格） */
export function cellFor(type: GoldType, outcome: L1Outcome): L1Cell | null {
  if (outcome === 'error') return null;
  if (type === 'answerable') {
    return outcome === 'answered' ? 'A' : 'B';
  }
  return outcome === 'answered' ? 'C' : 'D';
}

/**
 * 就地累加一格。返回 error 增量（0 或 1）。
 */
export function accumulate(matrix: L1Matrix, type: GoldType, outcome: L1Outcome): number {
  const cell = cellFor(type, outcome);
  if (!cell) return 1;
  matrix[cell] += 1;
  return 0;
}

/** 覆盖率 = A/(A+B)；分母 0 → null */
export function coverage(matrix: L1Matrix): number | null {
  const den = matrix.A + matrix.B;
  if (den === 0) return null;
  return matrix.A / den;
}

/** 签字规模门：可答 / 不可答类各 ≥30（B10-followup） */
export const SIGNOFF_MIN_PER_CLASS = 30;

export type GoldTypeCounts = {
  answerable: number;
  /** unanswerable + false_premise */
  unanswerableClass: number;
};

export function goldTypeCounts(cases: ReadonlyArray<{ type: GoldType }>): GoldTypeCounts {
  let answerable = 0;
  let unanswerableClass = 0;
  for (const c of cases) {
    if (c.type === 'answerable') answerable += 1;
    else unanswerableClass += 1;
  }
  return { answerable, unanswerableClass };
}

/**
 * mock / unknown / 截断冒烟一律不可签字。
 * live 只是必要条件；规模门不满足仍 false（≠ 业务人签 PASS）。
 */
export function computeSignoffEligible(
  retrieveMode: EvalRetrieveMode,
  counts: GoldTypeCounts,
): boolean {
  return (
    retrieveMode === 'live' &&
    counts.answerable >= SIGNOFF_MIN_PER_CLASS &&
    counts.unanswerableClass >= SIGNOFF_MIN_PER_CLASS
  );
}

/** Hit@k 累加器。scored=0 时总率为 null。不进 2×2 / signoffEligible。 */
export type HitAtKAccum = { hits: number; scored: number };

export function emptyHitAtK(): HitAtKAccum {
  return { hits: 0, scored: 0 };
}

/**
 * 加载边界：缺字段 / null / [] / 全空白 → null（不计分）。
 * 非数组或含非字符串元素 → 抛错，禁止当成无名单。
 */
export function parseExpectedDocIds(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) {
    throw new TypeError('expectedDocIds must be string[] or null');
  }
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      throw new TypeError('expectedDocIds must contain only strings');
    }
    const id = item.trim();
    if (id.length > 0) ids.push(id);
  }
  return ids.length === 0 ? null : ids;
}

/**
 * 无非空 expected → null（不计分）。
 * 否则 evidence 列表（已是 rerank 后进 verify 的集合；k=该列表长度）与 expected 是否有交集。
 */
export function hitAtKCase(
  expectedDocIds: readonly string[] | null | undefined,
  evidenceDocIds: readonly string[],
): boolean | null {
  const expected = (expectedDocIds ?? [])
    .filter((id) => typeof id === 'string')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (expected.length === 0) return null;
  const seen = new Set(
    evidenceDocIds
      .filter((id) => typeof id === 'string')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
  return expected.some((id) => seen.has(id));
}

export function accumulateHitAtK(acc: HitAtKAccum, hit: boolean | null): void {
  if (hit === null) return;
  acc.scored += 1;
  if (hit) acc.hits += 1;
}

/** scored=0 → null */
export function hitAtKRate(acc: HitAtKAccum): number | null {
  if (acc.scored === 0) return null;
  return acc.hits / acc.scored;
}

/** C 率 = C/(C+D)；分母 0 → null。不进 signoffEligible。 */
export function cRate(matrix: L1Matrix): number | null {
  const den = matrix.C + matrix.D;
  if (den === 0) return null;
  return matrix.C / den;
}

/**
 * 运行时分数加载：缺 / 非有限 / 越界 → null（该题不参与随 τ 翻转）。
 * 与 gold 名单不同：脏分数不当抛错，避免一次坏 judge 拖垮整批扫描。
 */
export function parseMinSupport(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (raw < 0 || raw > 1) return null;
  return raw;
}

/**
 * 有 minSupport 才按 τ 重阈（min 否决：minSupport≥τ → answered）。
 * 无分数保持原 outcome（未进 judge 的拒答不得因降 τ 变成 answered）。
 * error 在每一档仍是 error。
 */
export function outcomeAtTau(
  original: L1Outcome,
  minSupport: number | null,
  tau: number,
): L1Outcome {
  if (original === 'error') return 'error';
  if (minSupport === null) return original;
  return minSupport >= tau ? 'answered' : 'abstained';
}

/** 0.30…0.90 步长 0.05（含端点）。升序；取最大合格 τ。 */
export const TAU_SWEEP_GRID: readonly number[] = [
  0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9,
];

/** 与试点硬门 coverageMin / cRateMax 对齐；不从 api adr046 反引。 */
export const TAU_STAR_COVERAGE_MIN = 0.4;
export const TAU_STAR_C_RATE_MAX = 0.05;

export type TauSweepCase = {
  type: GoldType;
  outcome: L1Outcome;
  minSupport?: number | null;
};

export type TauSweepPoint = {
  tau: number;
  matrix: L1Matrix;
  coverage: number | null;
  cRate: number | null;
};

export type TauSweepResult = {
  grid: TauSweepPoint[];
  tauStar: number | null;
};

export type TauStarGates = {
  coverageMin?: number;
  cRateMax?: number;
};

/**
 * 离线扫网格。本跑真实 2×2 不在这里改。
 * tau* = 同时满足 coverage≥coverageMin 且 cRate≤cRateMax 的最大 τ；没有 → null。
 * 整批无有效 minSupport → tauStar 必 null（禁止把原格碰巧过门写成网格上沿）。
 */
export function sweepTau(
  cases: readonly TauSweepCase[],
  grid: readonly number[] = TAU_SWEEP_GRID,
  gates: TauStarGates = {},
): TauSweepResult {
  const coverageMin = gates.coverageMin ?? TAU_STAR_COVERAGE_MIN;
  const cRateMax = gates.cRateMax ?? TAU_STAR_C_RATE_MAX;
  const points: TauSweepPoint[] = [];
  let scored = 0;
  for (const c of cases) {
    if (parseMinSupport(c.minSupport) !== null) scored += 1;
  }
  let tauStar: number | null = null;
  for (const tau of grid) {
    const matrix = emptyMatrix();
    for (const c of cases) {
      const min = parseMinSupport(c.minSupport);
      accumulate(matrix, c.type, outcomeAtTau(c.outcome, min, tau));
    }
    const cov = coverage(matrix);
    const cr = cRate(matrix);
    points.push({ tau, matrix, coverage: cov, cRate: cr });
    if (
      cov !== null &&
      cr !== null &&
      cov >= coverageMin &&
      cr <= cRateMax &&
      (tauStar === null || tau > tauStar)
    ) {
      tauStar = tau;
    }
  }
  if (scored === 0) tauStar = null;
  return { grid: points, tauStar };
}
