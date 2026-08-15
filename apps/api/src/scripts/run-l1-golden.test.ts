import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { ExecuteAskParams, ExecuteAskResult } from '../services/ask/index.js';
import {
  GoldLoadError,
  buildEvalRunInsert,
  evalRunDbRanAt,
  loadGold,
  resolveEvalMode,
  runL1Golden,
  writeL1Report,
  type L1Report,
} from './run-l1-golden.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l1-'));
  tmpDirs.push(d);
  return d;
}

function goldFile(
  dir: string,
  cases: Array<{ id: string; question: string; type: string }>,
): string {
  const p = path.join(dir, 'gold.yaml');
  writeFileSync(p, JSON.stringify({ cases }), 'utf8');
  return p;
}

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
      citations: [],
      minSupport: 0.9,
      reason: 'verified',
      userMessage: 'ok',
      suggestedActions: [],
      mode: 'balanced',
      sessionId: null,
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
      reason: 'unsupported_claims',
      userMessage: '拒答',
    },
  };
}

describe('loadGold', () => {
  it('loads repo fixtures/l1/gold.yaml (≥30 ans + ≥30 unanswerable-class)', () => {
    // real shipped fixture path
    const p = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../fixtures/l1/gold.yaml',
    );
    const cases = loadGold(p);
    const by = { answerable: 0, unanswerable: 0, false_premise: 0 };
    for (const c of cases) by[c.type] += 1;
    expect(by.answerable).toBeGreaterThanOrEqual(30);
    // unanswerable-class = unanswerable + false_premise
    expect(by.unanswerable + by.false_premise).toBeGreaterThanOrEqual(30);
    expect(by.false_premise).toBeGreaterThanOrEqual(3);
    expect(cases.length).toBeGreaterThanOrEqual(60);
  });

  it('loads JSON-shaped gold', () => {
    const dir = tmp();
    const p = goldFile(dir, [
      { id: 'a', question: 'q1', type: 'answerable' },
      { id: 'b', question: 'q2', type: 'unanswerable' },
    ]);
    const cases = loadGold(p);
    expect(cases).toHaveLength(2);
    expect(cases[0]?.type).toBe('answerable');
  });

  it('bad YAML/JSON → GoldLoadError', () => {
    const dir = tmp();
    const p = path.join(dir, 'bad.yaml');
    writeFileSync(p, 'not: [valid json', 'utf8');
    expect(() => loadGold(p)).toThrow(GoldLoadError);
  });

  it('missing type → GoldLoadError', () => {
    const dir = tmp();
    const p = path.join(dir, 'g.yaml');
    writeFileSync(p, JSON.stringify({ cases: [{ id: 'x', question: 'q' }] }), 'utf8');
    expect(() => loadGold(p)).toThrow(/type/);
  });
});

describe('resolveEvalMode', () => {
  it('maps mock|http|other', () => {
    expect(resolveEvalMode('mock')).toBe('mock');
    expect(resolveEvalMode('http')).toBe('live');
    expect(resolveEvalMode('')).toBe('unknown');
    expect(resolveEvalMode('weird')).toBe('unknown');
  });
});

describe('persistEvalRun gate', () => {
  it('default path does not require DB when persistEval false', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [{ id: '1', question: 'q', type: 'answerable' }]);
    const report = await runL1Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async () => abstained(),
    });
    expect(report.evalRunId).toBeUndefined();
    expect(report.matrix.B).toBe(1);
  });
});

describe('buildEvalRunInsert / evalRunDbRanAt', () => {
  it('maps report → insert row; ran_at is local format not ISO-Z', () => {
    const report: L1Report = {
      mode: 'mock',
      retrieve_mode: 'mock',
      signoffEligible: false,
      ranAt: '2026-08-09T12:34:56.000Z',
      caseCount: 2,
      answerableCount: 1,
      unanswerableClassCount: 1,
      matrix: { A: 1, B: 0, C: 0, D: 1 },
      coverage: 1,
      errorCount: 0,
      cases: [],
      kbId: '01900000-0000-7000-8000-0000000000aa',
    };
    const row = buildEvalRunInsert(report, {
      goldPath: '/g.yaml',
      tenantId: '01900000-0000-7000-8000-000000000001',
      notes: 'mock run — not for business sign-off',
    });
    expect(row.retrieveMode).toBe('mock');
    expect(row.signoffEligible).toBe('0');
    expect(row.matrixA).toBe(1);
    expect(row.matrixD).toBe(1);
    expect(row.caseCount).toBe(2);
    expect(row.goldPath).toBe('/g.yaml');
    expect(row.notes).toContain('mock');
    expect(row.ranAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(row.ranAt).not.toContain('T');
    expect(row.ranAt).not.toContain('Z');
    expect(evalRunDbRanAt(report.ranAt)).toBe(row.ranAt);
    // mock → not signoff
    expect(report.signoffEligible).toBe(false);
  });

  it('live signoffEligible maps to text 1', () => {
    const report: L1Report = {
      mode: 'live',
      retrieve_mode: 'live',
      signoffEligible: true,
      ranAt: '2026-08-09T00:00:00.000Z',
      caseCount: 60,
      answerableCount: 30,
      unanswerableClassCount: 30,
      matrix: { A: 0, B: 0, C: 0, D: 0 },
      coverage: null,
      errorCount: 0,
      cases: [],
      kbId: 'k',
    };
    expect(buildEvalRunInsert(report, {}).signoffEligible).toBe('1');
  });
});

describe('runL1Golden mock graphDeps path', () => {
  it('serial loop → matrix + report files with required fields', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      { id: 'ans1', question: 'a1', type: 'answerable' },
      { id: 'ans2', question: 'a2', type: 'answerable' },
      { id: 'una1', question: 'u1', type: 'unanswerable' },
      { id: 'fp1', question: 'f1', type: 'false_premise' },
      { id: 'err1', question: 'e1', type: 'answerable' },
    ]);
    const outDir = path.join(dir, 'out');
    let calls = 0;
    const execute = async (params: ExecuteAskParams): Promise<ExecuteAskResult> => {
      calls += 1;
      expect(params.membership).toBe('member');
      expect(params.body.question).toBeTruthy();
      if (params.body.question === 'e1') throw new Error('boom');
      if (params.body.question === 'a1') return answered();
      return abstained();
    };

    const report = await runL1Golden({
      goldPath,
      outDir,
      kbId: 'kb-test',
      persistEval: false,
      execute,
    });

    expect(calls).toBe(5);
    expect(report.caseCount).toBe(5);
    expect(report.matrix).toEqual({ A: 1, B: 1, C: 0, D: 2 });
    expect(report.errorCount).toBe(1);
    expect(report.coverage).toBe(0.5);
    expect(report.mode).toMatch(/mock|live|unknown/);
    expect(report.retrieve_mode).toBe(report.mode);
    expect(report.answerableCount).toBe(3);
    expect(report.unanswerableClassCount).toBe(2);
    // 截断/小集：即使进程是 live 也不可签字
    expect(report.signoffEligible).toBe(false);
    expect(report.kbId).toBe('kb-test');
    expect(report.cases.some((c) => c.outcome === 'error')).toBe(true);

    const json = JSON.parse(readFileSync(path.join(outDir, 'l1-last-run.json'), 'utf8')) as L1Report;
    expect(json.matrix).toEqual(report.matrix);
    expect(json.errorCount).toBe(1);
    expect(json.cases).toHaveLength(5);
    expect(json).toHaveProperty('mode');
    expect(json).toHaveProperty('retrieve_mode');
    expect(json).toHaveProperty('signoffEligible');
    expect(json.signoffEligible).toBe(false);
    expect(json).toHaveProperty('answerableCount');
    expect(json).toHaveProperty('unanswerableClassCount');
    expect(json).toHaveProperty('ranAt');
    expect(json).toHaveProperty('coverage');

    const md = readFileSync(path.join(outDir, 'l1-last-run.md'), 'utf8');
    expect(md).toContain('retrieve_mode:');
    expect(md).toContain('A=1');
    expect(md).toContain('errorCount');
  });

  it('L1_MAX_CASES truncates', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      { id: '1', question: 'q1', type: 'answerable' },
      { id: '2', question: 'q2', type: 'answerable' },
      { id: '3', question: 'q3', type: 'answerable' },
    ]);
    const report = await runL1Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      maxCases: 2,
      persistEval: false,
      execute: async () => abstained(),
    });
    expect(report.caseCount).toBe(2);
    expect(report.answerableCount).toBe(2);
    expect(report.unanswerableClassCount).toBe(0);
    expect(report.matrix.B).toBe(2);
    expect(report.signoffEligible).toBe(false);
  });

  it('live + 各≥30 → signoffEligible；同规模 mock → false', async () => {
    const dir = tmp();
    const cases = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `a${i}`,
        question: `aq${i}`,
        type: 'answerable',
      })),
      ...Array.from({ length: 27 }, (_, i) => ({
        id: `u${i}`,
        question: `uq${i}`,
        type: 'unanswerable',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `f${i}`,
        question: `fq${i}`,
        type: 'false_premise',
      })),
    ];
    const goldPath = goldFile(dir, cases);
    const live = await runL1Golden({
      goldPath,
      outDir: path.join(dir, 'out-live'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      execute: async () => abstained(),
    });
    expect(live.retrieve_mode).toBe('live');
    expect(live.answerableCount).toBe(30);
    expect(live.unanswerableClassCount).toBe(30);
    expect(live.signoffEligible).toBe(true);

    const mock = await runL1Golden({
      goldPath,
      outDir: path.join(dir, 'out-mock'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'mock',
      execute: async () => abstained(),
    });
    expect(mock.retrieve_mode).toBe('mock');
    expect(mock.signoffEligible).toBe(false);
  });
});

describe('writeL1Report', () => {
  it('writes json+md', () => {
    const dir = tmp();
    const report: L1Report = {
      mode: 'mock',
      retrieve_mode: 'mock',
      signoffEligible: false,
      ranAt: '2026-08-09T00:00:00.000Z',
      caseCount: 0,
      answerableCount: 0,
      unanswerableClassCount: 0,
      matrix: { A: 0, B: 0, C: 0, D: 0 },
      coverage: null,
      errorCount: 0,
      cases: [],
      kbId: 'k',
    };
    const { jsonPath, mdPath } = writeL1Report(dir, report);
    expect(readFileSync(jsonPath, 'utf8')).toContain('"mode": "mock"');
    expect(readFileSync(mdPath, 'utf8')).toContain('coverage');
  });
});
