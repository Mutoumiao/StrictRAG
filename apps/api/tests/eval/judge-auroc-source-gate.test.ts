/**
 * 目标：Judge AUROC 硬门必须带「来源判别（只认 live）」与「PRD §4 校准规模（≥100）」两条 fail-closed 闸，
 *       mock / 缺测 / 规模不足一律不放行，且三种红各自可分辨；live 全绿时该门确实能变绿（不是空转闸）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §4（校准集 ≥100 条）· §6（Judge AUROC ≥0.65）· §6.1（mock 数字禁进签字包）· ADR-046 · ADR-061
 * 被测：evaluateAdr046Bind · judgeAurocSourceFor · mockJudgeScorer · judgeScorerGoNoGo · createGatewayJudgeScorer · runL1Golden
 * 简介：门级逐项边界（对数 99/100/101 × 值 0.64/0.65/0.66 × 来源 live/mock/none）+ 入口级「只差声明」对照
 *       （同一份全绿跑次：http → 绿；mock → 红且 reason=judge_auroc_source_not_live；off → 红且 reason=judge_auroc_missing_or_below_min）。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  JUDGE_AUROC_SOURCES,
  JUDGE_CALIB_MIN_CASES,
  JUDGE_CALIB_SCORER_MODES,
  judgeAurocSourceFor,
  mockJudgeScorer,
  type JudgeAurocSource,
  type JudgeCalibCase,
} from '@strict-rag/contracts';

import {
  PILOT_HARD_GATES,
  compareHardGates,
  evaluateAdr046Bind,
  fourElementsOf,
} from '../../src/eval/adr046-snapshot.js';
import { createGatewayJudgeScorer, judgeScorerGoNoGo } from '../../src/eval/judge-scorer.js';
import { runL1Golden } from '../../src/scripts/run-l1-golden.js';
import type { ExecuteAskParams, ExecuteAskResult } from '../../src/services/ask/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
/** 合法抽检账本样例（20 条 / 错 1，恰在 §6 门限上）：本文件测 AUROC 门，其余门用真实样例喂满 */
const EXAMPLE_LEDGER = path.join(repoRoot, 'fixtures/l1/human-spot.example.json');

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l1-judge-src-'));
  tmpDirs.push(d);
  return d;
}

/** 其余实测门全绿；被测只改 AUROC 的来源 / 值 / 对数 */
const OTHER_GATES_PASS = {
  coverage: 0.5,
  cRate: 0.03,
  hitAtK: 0.75,
  citationComplete: 1,
  humanSpot: { checked: PILOT_HARD_GATES.humanSpotMin, errors: PILOT_HARD_GATES.humanSpotErrorMax },
  signoffEligible: true,
  caseReasons: ['verified'],
};

function bind(over: {
  judgeAuroc?: number | null;
  judgeAurocSource?: JudgeAurocSource | null;
  judgeCalibPairs?: number | null;
}) {
  const gates = { ...PILOT_HARD_GATES };
  const four = fourElementsOf({
    kbId: 'kb-1',
    tauClaim: 0.5,
    gates,
    evalRunId: 'eval-1',
    ranAt: '2026-09-23T00:00:00.000Z',
    proposal: true,
    businessR: true,
    productA: true,
  });
  return evaluateAdr046Bind({
    four,
    diff: compareHardGates(gates),
    ...OTHER_GATES_PASS,
    ...over,
  });
}

/** 恰在门限上：来源 live ∧ 值 judgeAurocMin ∧ 对数 JUDGE_CALIB_MIN_CASES */
const AT_GATE = {
  judgeAuroc: PILOT_HARD_GATES.judgeAurocMin,
  judgeAurocSource: 'live' as const,
  judgeCalibPairs: JUDGE_CALIB_MIN_CASES,
};

describe('打分器来源三态映射（api CLI 与 worker 批跑同源）', () => {
  it('off / 未声明 / 非法值 → none；mock → mock；http → live', () => {
    expect(judgeAurocSourceFor('off')).toBe('none');
    expect(judgeAurocSourceFor('mock')).toBe('mock');
    expect(judgeAurocSourceFor('http')).toBe('live');
    // fail-closed：未声明与脏值都不得当成 live
    expect(judgeAurocSourceFor(undefined)).toBe('none');
    expect(judgeAurocSourceFor(null)).toBe('none');
    expect(judgeAurocSourceFor('')).toBe('none');
    expect(judgeAurocSourceFor('weird')).toBe('none');
  });

  it('声明的每个取值都映射到报告三态之一，且只有 http 落 live', () => {
    const mapped = JUDGE_CALIB_SCORER_MODES.map((m) => judgeAurocSourceFor(m));
    for (const source of mapped) expect(JUDGE_AUROC_SOURCES).toContain(source);
    expect(mapped.filter((s) => s === 'live')).toHaveLength(1);
    expect(JUDGE_CALIB_SCORER_MODES).toContain('off');
    expect(JUDGE_CALIB_SCORER_MODES).toHaveLength(3);
  });
});

describe('evaluateAdr046Bind · AUROC 门只认 live + PRD §4 规模', () => {
  it('可达性：来源 live + 值恰 0.65 + 对数恰 100 + 其余门全绿 → 业务 PASS 为真', () => {
    const verdict = bind({ ...AT_GATE });
    expect(verdict.signedPackage).toBe(true);
    expect(verdict.businessPass).toBe(true);
    expect(verdict.reasons).not.toContain('judge_auroc_source_not_live');
    expect(verdict.reasons).not.toContain('judge_auroc_calib_too_small');
    expect(verdict.reasons).not.toContain('judge_auroc_missing_or_below_min');
  });

  it('值边界：0.64 不过（missing_or_below_min）；0.65 / 0.66 过', () => {
    const below = bind({ ...AT_GATE, judgeAuroc: 0.64 });
    expect(below.businessPass).toBe(false);
    expect(below.reasons).toContain('judge_auroc_missing_or_below_min');

    expect(bind({ ...AT_GATE, judgeAuroc: 0.65 }).businessPass).toBe(true);
    expect(bind({ ...AT_GATE, judgeAuroc: 0.66 }).businessPass).toBe(true);
  });

  it('规模边界：99 不过（calib_too_small）；100 / 101 过', () => {
    const small = bind({ ...AT_GATE, judgeCalibPairs: JUDGE_CALIB_MIN_CASES - 1 });
    expect(small.businessPass).toBe(false);
    expect(small.reasons).toContain('judge_auroc_calib_too_small');
    // 与「缺测」可分辨：值在、来源 live，只差规模
    expect(small.reasons).not.toContain('judge_auroc_missing_or_below_min');
    expect(small.reasons).not.toContain('judge_auroc_source_not_live');

    expect(bind({ ...AT_GATE, judgeCalibPairs: JUDGE_CALIB_MIN_CASES }).businessPass).toBe(true);
    expect(bind({ ...AT_GATE, judgeCalibPairs: JUDGE_CALIB_MIN_CASES + 1 }).businessPass).toBe(true);
  });

  it('来源 mock：数字再漂亮也不放行（PRD §6.1 / ADR-061）', () => {
    const mocked = bind({ ...AT_GATE, judgeAurocSource: 'mock', judgeAuroc: 1 });
    expect(mocked.businessPass).toBe(false);
    expect(mocked.reasons).toContain('judge_auroc_source_not_live');
    expect(mocked.reasons).not.toContain('judge_auroc_missing_or_below_min');
    expect(mocked.reasons).not.toContain('judge_auroc_calib_too_small');
  });

  it('缺测：不传来源 / 值 / 对数 → 红，且只报 missing（三种红可分辨）', () => {
    const verdict = bind({ judgeAuroc: null });
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('judge_auroc_missing_or_below_min');
    expect(verdict.reasons).not.toContain('judge_auroc_source_not_live');
    expect(verdict.reasons).not.toContain('judge_auroc_calib_too_small');
  });

  it('来源 none 但值非 null（自相矛盾）→ 仍不放行，且红在来源而非值', () => {
    const verdict = bind({ ...AT_GATE, judgeAurocSource: 'none' });
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('judge_auroc_source_not_live');
  });

  it('mock 伪打分器的产出代入判定：对数达标、AUROC=1，业务 PASS 仍为假', () => {
    const calib: JudgeCalibCase[] = [
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `jc-p${i}`,
        claim: `c${i}`,
        evidence: `e${i}`,
        label: 1 as const,
      })),
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `jc-n${i}`,
        claim: `c${i}`,
        evidence: `e${i}`,
        label: 0 as const,
      })),
    ];
    const scores = mockJudgeScorer(calib);
    // 确定性：同样输入 → 同样输出
    expect(mockJudgeScorer(calib)).toEqual(scores);
    expect(scores).toHaveLength(JUDGE_CALIB_MIN_CASES);

    const pairs = calib
      .map((c, i) => ({ label: c.label, score: scores[i] }))
      .filter((p): p is { label: 0 | 1; score: number } => typeof p.score === 'number');
    const pos = pairs.filter((p) => p.label === 1).length;
    const neg = pairs.filter((p) => p.label === 0).length;
    expect(pos + neg).toBe(JUDGE_CALIB_MIN_CASES);
    // label 分离 → Mann-Whitney 恒 1（这正是「数字漂亮」的由来，也是必须不看它的原因）
    const mocked = bind({ judgeAuroc: 1, judgeAurocSource: 'mock', judgeCalibPairs: pairs.length });
    expect(mocked.businessPass).toBe(false);
    expect(mocked.reasons).toContain('judge_auroc_source_not_live');
  });

  it('判定处不写裸数字：AUROC 门限读 PILOT_HARD_GATES、规模读 JUDGE_CALIB_MIN_CASES', () => {
    const gateKeys = Object.keys(PILOT_HARD_GATES);
    expect(gateKeys).toContain('judgeAurocMin');
    expect(JUDGE_CALIB_MIN_CASES).toBe(100);
  });
});

// --- 入口级：同一份全绿跑次，只改来源声明 ---
function answered(): ExecuteAskResult {
  const base: ExecuteAskResult = {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status: 'answered',
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [{ chunkId: 'c-1', docId: 'd-1' }],
      minSupport: 0.9,
      reason: 'verified',
      userMessage: 'ok',
      suggestedActions: [],
      latencyMs: 1,
      mode: 'balanced',
      sessionId: null,
    },
    graph: {
      requestId: 'r',
      status: 'answered',
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [{ chunkId: 'c-1', docId: 'd-1' }],
      minSupport: 0.9,
      reason: 'verified',
      userMessage: 'ok',
      suggestedActions: [],
      mode: 'balanced',
      sessionId: null,
      rewriteUsed: false,
      sessionDeepened: false,
      evidence_snapshot: [],
    },
  };
  return base;
}

function abstained(): ExecuteAskResult {
  const base = answered();
  return {
    ...base,
    response: {
      ...base.response,
      status: 'abstained',
      answer: '',
      citations: [],
      reason: 'unsupported_claims',
      userMessage: '拒答',
    },
    graph: {
      ...base.graph,
      status: 'abstained',
      answer: '',
      citations: [],
      reason: 'unsupported_claims',
      userMessage: '拒答',
      minSupport: undefined,
    },
  };
}

/** 50 支持 + 50 不支持 = 恰 100 条（满足 PRD §4）；scorer 与 label 同源 → AUROC 恒 1 */
function calib100(): JudgeCalibCase[] {
  return [
    ...Array.from({ length: 50 }, (_, i) => ({
      id: `jc-p${i}`,
      claim: `c${i}`,
      evidence: `e${i}`,
      label: 1 as const,
    })),
    ...Array.from({ length: 50 }, (_, i) => ({
      id: `jc-n${i}`,
      claim: `c${i}`,
      evidence: `e${i}`,
      label: 0 as const,
    })),
  ];
}

const fakeScorer = async (cases: readonly JudgeCalibCase[]): Promise<Array<number | null>> =>
  cases.map((c) => (c.label === 1 ? 0.9 : 0.1));

/** 除「打分器来源声明」外全绿（live 规模 30/30 + 合法抽检账本 + 注入 execute，不打真网络） */
function greenRun(dir: string, judgeScorerMode: 'off' | 'mock' | 'http') {
  const goldPath = path.join(dir, `gold-${judgeScorerMode}.yaml`);
  writeFileSync(
    goldPath,
    JSON.stringify({
      cases: [
        ...Array.from({ length: 30 }, (_, i) => ({
          id: `a${i}`,
          question: `aq${i}`,
          type: 'answerable',
        })),
        ...Array.from({ length: 30 }, (_, i) => ({
          id: `u${i}`,
          question: `uq${i}`,
          type: 'unanswerable',
        })),
      ],
    }),
    'utf8',
  );
  const execute = async (params: ExecuteAskParams): Promise<ExecuteAskResult> =>
    params.body.question.startsWith('aq') ? answered() : abstained();
  return runL1Golden({
    goldPath,
    outDir: path.join(dir, `out-${judgeScorerMode}`),
    kbId: 'kb-judge',
    persistEval: false,
    esMode: 'http',
    execute,
    judgeScorerMode,
    judgeCalibCases: calib100(),
    scoreJudge: fakeScorer,
    humanSpotPath: EXAMPLE_LEDGER,
    snapshot: { proposal: true, businessR: true, productA: true },
  });
}

describe('runL1Golden · 来源声明是判定唯一开关（同一份全绿跑次）', () => {
  it('声明 http（live）→ 该门真变绿：业务 PASS 为真', async () => {
    const dir = tmp();
    const report = await greenRun(dir, 'http');
    expect(report.retrieve_mode).toBe('live');
    expect(report.signoffEligible).toBe(true);
    expect(report.judgeAurocSource).toBe('live');
    expect(report.judgeAuroc).toBe(1);
    expect(report.judgeAurocScored).toBe(JUDGE_CALIB_MIN_CASES);
    expect(report.gateVerdict?.businessPass).toBe(true);
  });

  it('声明 mock（值 1 与对数 100 都不变）→ 业务 PASS 立刻变红，reason = judge_auroc_source_not_live', async () => {
    const dir = tmp();
    const report = await greenRun(dir, 'mock');
    expect(report.judgeAurocSource).toBe('mock');
    expect(report.judgeAuroc).toBe(1);
    expect(report.judgeAurocScored).toBe(JUDGE_CALIB_MIN_CASES);
    // mock 数字可打印但绝不进签字包（PRD §6.1 / ADR-061）
    expect(report.gateVerdict?.businessPass).toBe(false);
    expect(report.gateVerdict?.reasons).toContain('judge_auroc_source_not_live');
    expect(report.gateVerdict?.reasons).not.toContain('judge_auroc_missing_or_below_min');
  });

  it('声明 off（默认）→ 缺测：值为 null、来源 none、reason = judge_auroc_missing_or_below_min', async () => {
    const dir = tmp();
    const report = await greenRun(dir, 'off');
    expect(report.judgeAurocSource).toBe('none');
    expect(report.judgeAuroc).toBeNull();
    expect(report.judgeAurocScored).toBe(0);
    expect(report.gateVerdict?.businessPass).toBe(false);
    expect(report.gateVerdict?.reasons).toContain('judge_auroc_missing_or_below_min');
    expect(report.gateVerdict?.reasons).not.toContain('judge_auroc_source_not_live');
  });
});

describe('http（live）打分器接线：go/no-go 与可注入的假 gateway 客户端', () => {
  it('go/no-go：声明 http 而 Gateway 仍是 mock → 拒绝（mock 分数不得标成 live）', () => {
    const blocked = judgeScorerGoNoGo({ scorerMode: 'http', gatewayMode: 'mock' });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toContain('GATEWAY_MODE=http');
    expect(judgeScorerGoNoGo({ scorerMode: 'http', gatewayMode: 'http' }).ok).toBe(true);
  });

  it('go/no-go：非 http 声明不打真 Gateway，无需检查', () => {
    expect(judgeScorerGoNoGo({ scorerMode: 'off', gatewayMode: 'mock' }).ok).toBe(true);
    expect(judgeScorerGoNoGo({ scorerMode: 'mock', gatewayMode: 'mock' }).ok).toBe(true);
  });

  it('注入假 gateway 客户端：每条校准题一次 judge 调用，回复解析成 (score, label) 对数', async () => {
    const prompts: string[] = [];
    const scorer = createGatewayJudgeScorer(async (req) => {
      prompts.push(req.messages.map((m) => m.content).join('\n'));
      // 两条校准题：第一条回复支持分 0.8，第二条回复 0.2（与 label 同序）
      return `{"scores":[${prompts.length === 1 ? 0.8 : 0.2}]}`;
    });
    const calib: JudgeCalibCase[] = [
      { id: 'p', claim: '年假五天', evidence: '年假每次不超过5个工作日', label: 1 },
      { id: 'n', claim: '年假六十天', evidence: '年假每次不超过5个工作日', label: 0 },
    ];
    const scores = await scorer(calib);
    expect(scores).toEqual([0.8, 0.2]);
    expect(prompts).toHaveLength(2);
    // 复用 ask 的 judge prompt 口径（不是另写一份）
    expect(prompts[0]).toContain('CLAIM[0]: 年假五天');
    expect(prompts[0]).toContain('年假每次不超过5个工作日');
  });

  it('真打分器回复坏 JSON → 抛错，不得静默降级成缺测', async () => {
    const scorer = createGatewayJudgeScorer(async () => 'not json');
    await expect(
      scorer([{ id: 'p', claim: 'c', evidence: 'e', label: 1 }]),
    ).rejects.toThrow();
  });
});
