/**
 * 目标：api CLI 侧 L1 runner 必须把「引用完整率」按 knowledge ∧ answered 口径落到报告。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §2 :81 · §6 :134
 * 被测：runL1Golden
 * 简介：注入 execute；只有 answerKind='knowledge' ∧ outcome='answered' 进分母，citations>0 才进分子；
 *       分母 0 → 率 null（该门不适用）。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runL1Golden } from '../../src/scripts/run-l1-golden.js';
import type { ExecuteAskParams, ExecuteAskResult } from '../../src/services/ask/index.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmpDir(prefix: string): string {
  const d = mkdtempSync(path.join(tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

function goldFile(cases: Array<{ id: string; question: string; type: string }>): string {
  const p = path.join(tmpDir('l1-cc-'), 'gold.yaml');
  writeFileSync(p, JSON.stringify({ cases }), 'utf8');
  return p;
}

const CITATION = {
  chunkId: '01900000-0000-7000-8000-0000000000c1',
  docId: '01900000-0000-7000-8000-0000000000d1',
};

function askResult(over: {
  status: 'answered' | 'abstained';
  answerKind?: 'knowledge' | 'chitchat';
  citationCount: number;
  reason: ExecuteAskResult['graph']['reason'];
}): ExecuteAskResult {
  const citations = Array.from({ length: over.citationCount }, () => ({ ...CITATION }));
  const answer = over.status === 'answered' ? 'ok' : '';
  const userMessage = over.status === 'answered' ? 'ok' : '拒答';
  const graph: ExecuteAskResult['graph'] = {
    requestId: 'r',
    status: over.status,
    answer,
    ...(over.answerKind ? { answerKind: over.answerKind } : {}),
    citations,
    reason: over.reason,
    userMessage,
    suggestedActions: [],
    mode: 'balanced',
    sessionId: null,
    rewriteUsed: false,
    sessionDeepened: false,
    evidence_snapshot: [],
  };
  return {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status: over.status,
      answer,
      ...(over.answerKind ? { answerKind: over.answerKind } : {}),
      citations,
      reason: over.reason,
      userMessage,
      suggestedActions: [],
      latencyMs: 1,
      mode: 'balanced',
      sessionId: null,
    },
    graph,
  };
}

describe('runL1Golden 引用完整率', () => {
  it('knowledge ∧ answered：有 citation 计完整，空 citations 计不完整', async () => {
    const goldPath = goldFile([
      { id: 'k1', question: 'q1', type: 'answerable' },
      { id: 'k2', question: 'q2', type: 'answerable' },
    ]);
    const report = await runL1Golden({
      goldPath,
      outDir: path.join(tmpDir('l1-cc-out-'), 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async (params: ExecuteAskParams) =>
        params.body.question === 'q1'
          ? askResult({
              status: 'answered',
              answerKind: 'knowledge',
              citationCount: 1,
              reason: 'verified',
            })
          : askResult({
              status: 'answered',
              answerKind: 'knowledge',
              citationCount: 0,
              reason: 'verified',
            }),
    });

    expect(report.citationComplete).toBe(0.5);
    expect(report.citationCompleteDen).toBe(2);
    expect(report.cases[0]?.answerKind).toBe('knowledge');
    expect(report.cases[0]?.citationCount).toBe(1);
    expect(report.cases[1]?.citationCount).toBe(0);
  });

  it('只有 chitchat / 拒答 → 分母 0 → 率 null（该门不适用）', async () => {
    const goldPath = goldFile([
      { id: 'c1', question: 'q1', type: 'answerable' },
      { id: 'u1', question: 'q2', type: 'unanswerable' },
    ]);
    const report = await runL1Golden({
      goldPath,
      outDir: path.join(tmpDir('l1-cc-out-'), 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async (params: ExecuteAskParams) =>
        params.body.question === 'q1'
          ? askResult({
              status: 'answered',
              answerKind: 'chitchat',
              citationCount: 0,
              reason: 'chitchat',
            })
          : askResult({ status: 'abstained', citationCount: 0, reason: 'unsupported_claims' }),
    });

    expect(report.citationComplete).toBeNull();
    expect(report.citationCompleteDen).toBe(0);
    expect(report.cases[0]?.answerKind).toBe('chitchat');
    expect(report.cases[1]?.answerKind).toBeUndefined();
  });
});
