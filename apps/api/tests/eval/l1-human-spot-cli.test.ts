/**
 * 目标：人工抽检账本要有可用入口（CLI `--human-spot <path>`）且报告能打印条数 / 错数 / 来源；
 *       一份合法账本必须真能让该硬门变绿（不是空转闸），缺测则照样红。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6（人工抽检 ≥20 条，错 ≤1）· ADR-046
 * 被测：parseL1CliArgs · loadHumanSpotLedger · runL1Golden
 * 简介：四态参数解析；样例账本可加载且恰好达标；坏账本抛错不静默变缺测；注入 execute 下业务 PASS 只差「有没有账本」。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { HumanSpotLoadError, loadHumanSpotLedger } from '../../src/eval/human-spot.js';
import {
  parseL1CliArgs,
  runL1Golden,
  type L1Report,
} from '../../src/scripts/run-l1-golden.js';
import type { ExecuteAskParams, ExecuteAskResult } from '../../src/services/ask/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const EXAMPLE_LEDGER = path.join(repoRoot, 'fixtures/l1/human-spot.example.json');

const DOC_ID = '01900000-0000-7000-8000-0000000000d1';
const CHUNK_ID = '01900000-0000-7000-8000-0000000000c1';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l1-human-spot-'));
  tmpDirs.push(d);
  return d;
}

function writeJson(dir: string, name: string, raw: unknown): string {
  const p = path.join(dir, name);
  writeFileSync(p, typeof raw === 'string' ? raw : JSON.stringify(raw), 'utf8');
  return p;
}

const LEGAL_LEDGER = {
  evalRunId: 'eval-1',
  sampledBy: '业务抽检人',
  sampledAt: '2026-09-23T09:00:00.000Z',
  checked: 20,
  errors: 1,
};

function answered(): ExecuteAskResult {
  return {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status: 'answered',
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [],
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
      citations: [{ chunkId: CHUNK_ID, docId: DOC_ID }],
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
}

function abstained(): ExecuteAskResult {
  const base = answered();
  return {
    ...base,
    response: {
      ...base.response,
      status: 'abstained',
      answer: '',
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

/** 30 可答 + 30 不可答：live 规模门（各 ≥30）与覆盖率 / 引用完整率同时可满足 */
function signoffScaleCases() {
  return [
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
  ];
}

function goldFile(dir: string, cases: unknown): string {
  return writeJson(dir, 'gold.yaml', { cases });
}

/** 100 条校准集（50 支持 / 50 不支持）：满足 PRD §4 的 ≥100 规模门 */
function signoffCalib(): Array<{ id: string; claim: string; evidence: string; label: 1 | 0 }> {
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

/** 确定性假 gateway 打分器（离线走链路；不打真网络）：支持 → 0.9，不支持 → 0.1 */
const fakeJudgeScorer = async (
  cases: ReadonlyArray<{ id: string; claim: string; evidence: string; label: 1 | 0 }>,
): Promise<Array<number | null>> => cases.map((c) => (c.label === 1 ? 0.9 : 0.1));

/** 除人工抽检外全绿的批跑入参（注入 execute / 声明 http 的假 gateway 打分器 / 四要素，不打 live） */
function allGreenRun(dir: string, humanSpotPath?: string) {
  const execute = async (params: ExecuteAskParams): Promise<ExecuteAskResult> =>
    params.body.question.startsWith('a') ? answered() : abstained();
  return runL1Golden({
    goldPath: goldFile(dir, signoffScaleCases()),
    outDir: path.join(dir, humanSpotPath ? 'out-ledger' : 'out-missing'),
    kbId: 'kb-test',
    persistEval: false,
    esMode: 'http',
    execute,
    // 声明 http（来源 live）+ 规模达标的校准集，否则 AUROC 门恒红、测不出抽检门
    judgeScorerMode: 'http',
    judgeCalibCases: signoffCalib(),
    scoreJudge: fakeJudgeScorer,
    snapshot: { proposal: true, businessR: true, productA: true },
    ...(humanSpotPath ? { humanSpotPath } : {}),
  });
}

describe('parseL1CliArgs · --human-spot', () => {
  it('--human-spot <path> 与 --human-spot=<path> 都认；不传 = 缺测', () => {
    expect(parseL1CliArgs(['--human-spot', 'ledger.json'])).toEqual({
      ok: true,
      humanSpotPath: 'ledger.json',
    });
    expect(parseL1CliArgs(['--human-spot=ledger.json'])).toEqual({
      ok: true,
      humanSpotPath: 'ledger.json',
    });
    expect(parseL1CliArgs([])).toEqual({ ok: true, humanSpotPath: undefined });
    expect(parseL1CliArgs(['--other', 'x']).ok).toBe(true);
  });

  it('缺值 / 值看着像另一个参数 → 报错（不得当成缺测）', () => {
    expect(parseL1CliArgs(['--human-spot']).ok).toBe(false);
    expect(parseL1CliArgs(['--human-spot', '--out']).ok).toBe(false);
    expect(parseL1CliArgs(['--human-spot=']).ok).toBe(false);
  });
});

describe('loadHumanSpotLedger', () => {
  it('仓根样例账本可加载，且恰好落在 §6 硬门边界（20 条 / 错 1）', () => {
    const ledger = loadHumanSpotLedger(EXAMPLE_LEDGER);
    expect(ledger.checked).toBe(20);
    expect(ledger.errors).toBe(1);
    expect(ledger.items).toHaveLength(20);
    expect(ledger.items?.filter((i) => i.wrong)).toHaveLength(1);
  });

  it('缺文件 / 非 JSON / 违约（errors > checked、items 对不上）→ 抛错', () => {
    const dir = tmp();
    expect(() => loadHumanSpotLedger(path.join(dir, 'missing.json'))).toThrow(HumanSpotLoadError);
    const broken = writeJson(dir, 'broken.json', 'not json');
    expect(() => loadHumanSpotLedger(broken)).toThrow(HumanSpotLoadError);
    const overErrors = writeJson(dir, 'over.json', { ...LEGAL_LEDGER, checked: 1, errors: 2 });
    expect(() => loadHumanSpotLedger(overErrors)).toThrow(/errors/);
    const itemMismatch = writeJson(dir, 'items.json', {
      ...LEGAL_LEDGER,
      items: [{ caseId: 'q-1', wrong: true }],
    });
    expect(() => loadHumanSpotLedger(itemMismatch)).toThrow(/items/);
  });

  it('账本坏了 → 批跑抛错且一题都不跑（不得退化成「没人登记」）', async () => {
    const dir = tmp();
    let calls = 0;
    const execute = async (): Promise<ExecuteAskResult> => {
      calls += 1;
      return abstained();
    };
    await expect(
      runL1Golden({
        goldPath: goldFile(dir, [{ id: 'a1', question: 'aq', type: 'answerable' }]),
        outDir: path.join(dir, 'out'),
        kbId: 'kb',
        persistEval: false,
        execute,
        humanSpotPath: writeJson(dir, 'bad.json', { ...LEGAL_LEDGER, checked: 1, errors: 9 }),
      }),
    ).rejects.toThrow(HumanSpotLoadError);
    expect(calls).toBe(0);
  });
});

describe('runL1Golden · 抽检字段进报告', () => {
  it('传账本 → 报告 json 与 md 都能读出条数 / 错数 / 来源', async () => {
    const dir = tmp();
    const ledgerPath = writeJson(dir, 'ledger.json', LEGAL_LEDGER);
    const report = await runL1Golden({
      goldPath: goldFile(dir, [{ id: 'a1', question: 'aq', type: 'answerable' }]),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async () => abstained(),
      humanSpotPath: ledgerPath,
    });

    expect(report.humanSpot).toEqual({ checked: 20, errors: 1, source: ledgerPath });
    // 单题小集：规模门不过 → 业务 PASS 仍红，但抽检门本身不是缺测
    expect(report.gateVerdict?.businessPass).toBe(false);
    expect(report.gateVerdict?.reasons).not.toContain('human_spot_missing');

    const json = JSON.parse(readFileSync(path.join(dir, 'out', 'l1-last-run.json'), 'utf8')) as
      L1Report;
    expect(json.humanSpot).toEqual(report.humanSpot);

    const md = readFileSync(path.join(dir, 'out', 'l1-last-run.md'), 'utf8');
    expect(md).toContain('humanSpot');
    expect(md).toContain('20 条 / 错 1');
    expect(md).toContain(ledgerPath);
  });

  it('不传账本 → 报告为 null 且 md 写明缺测（不是 0 条）', async () => {
    const dir = tmp();
    const report = await runL1Golden({
      goldPath: goldFile(dir, [{ id: 'a1', question: 'aq', type: 'answerable' }]),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async () => abstained(),
    });

    expect(report.humanSpot).toBeNull();
    const md = readFileSync(path.join(dir, 'out', 'l1-last-run.md'), 'utf8');
    expect(md).toContain('缺测');
  });
});

describe('runL1Golden · 该门可达（不是空转闸）', () => {
  it('其他指标全绿时：有合法账本 → 业务 PASS 为真', async () => {
    const dir = tmp();
    const report = await allGreenRun(dir, writeJson(dir, 'ledger.json', LEGAL_LEDGER));
    expect(report.signoffEligible).toBe(true);
    expect(report.coverage).toBe(1);
    expect(report.citationComplete).toBe(1);
    expect(report.judgeAuroc).toBe(1);
    // AUROC 门此时也真绿：来源 live + 有效对数 100（PRD §4 规模门）
    expect(report.judgeAurocSource).toBe('live');
    expect(report.judgeAurocScored).toBe(100);
    expect(report.humanSpot).toEqual({
      checked: 20,
      errors: 1,
      source: path.join(dir, 'ledger.json'),
    });
    expect(report.gateVerdict?.signedPackage).toBe(true);
    expect(report.gateVerdict?.businessPass).toBe(true);
    expect(report.gateVerdict?.reasons).not.toContain('human_spot_missing');
  });

  it('同一份全绿跑次只抽掉账本 → 业务 PASS 立刻变红，reason = human_spot_missing', async () => {
    const dir = tmp();
    const report = await allGreenRun(dir);
    expect(report.humanSpot).toBeNull();
    expect(report.gateVerdict?.signedPackage).toBe(true);
    expect(report.gateVerdict?.businessPass).toBe(false);
    expect(report.gateVerdict?.reasons).toContain('human_spot_missing');
  });

  it('账本达标但错超限（21 条 / 错 2）→ 红且 reason = human_spot_errors_above_max', async () => {
    const dir = tmp();
    const report = await allGreenRun(
      dir,
      writeJson(dir, 'ledger.json', { ...LEGAL_LEDGER, checked: 21, errors: 2 }),
    );
    expect(report.gateVerdict?.businessPass).toBe(false);
    expect(report.gateVerdict?.reasons).toContain('human_spot_errors_above_max');
    expect(report.gateVerdict?.reasons).not.toContain('human_spot_missing');
  });
});
