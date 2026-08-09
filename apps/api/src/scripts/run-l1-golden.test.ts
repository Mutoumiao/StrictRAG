import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { ExecuteAskParams, ExecuteAskResult } from '../services/ask/index.js';
import {
  GoldLoadError,
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
  it('loads repo fixtures/l1/gold.yaml (≥30, type mix)', () => {
    // real shipped fixture path
    const p = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../fixtures/l1/gold.yaml',
    );
    const cases = loadGold(p);
    expect(cases.length).toBeGreaterThanOrEqual(30);
    const by = { answerable: 0, unanswerable: 0, false_premise: 0 };
    for (const c of cases) by[c.type] += 1;
    expect(by.answerable).toBeGreaterThan(0);
    expect(by.unanswerable).toBeGreaterThan(0);
    expect(by.false_premise).toBeGreaterThanOrEqual(3);
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
      execute,
    });

    expect(calls).toBe(5);
    expect(report.caseCount).toBe(5);
    expect(report.matrix).toEqual({ A: 1, B: 1, C: 0, D: 2 });
    expect(report.errorCount).toBe(1);
    expect(report.coverage).toBe(0.5);
    expect(report.mode).toMatch(/mock|live|unknown/);
    expect(report.kbId).toBe('kb-test');
    expect(report.cases.some((c) => c.outcome === 'error')).toBe(true);

    const json = JSON.parse(readFileSync(path.join(outDir, 'l1-last-run.json'), 'utf8')) as L1Report;
    expect(json.matrix).toEqual(report.matrix);
    expect(json.errorCount).toBe(1);
    expect(json.cases).toHaveLength(5);
    expect(json).toHaveProperty('mode');
    expect(json).toHaveProperty('ranAt');
    expect(json).toHaveProperty('coverage');

    const md = readFileSync(path.join(outDir, 'l1-last-run.md'), 'utf8');
    expect(md).toContain('mode:');
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
      execute: async () => abstained(),
    });
    expect(report.caseCount).toBe(2);
    expect(report.matrix.B).toBe(2);
  });
});

describe('writeL1Report', () => {
  it('writes json+md', () => {
    const dir = tmp();
    const report: L1Report = {
      mode: 'mock',
      ranAt: '2026-08-09T00:00:00.000Z',
      caseCount: 0,
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
