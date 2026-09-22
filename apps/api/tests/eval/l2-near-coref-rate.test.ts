/**
 * 目标：api L2 CLI 必须把「近指代通过率」落进报告与 md，并真进工程 signoffEligible。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 :188（近指代主题正确且合法作答 ≥80%）
 * 被测：runL2Golden · formatL2ReportMd
 * 简介：注入 execute + 临时 gold；分母只取 near_coref 且含 error；分母 0 → null → 不放行。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { L2_TYPES, type L2Type } from '@strict-rag/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { runL2Golden } from '../../src/scripts/run-l2-golden.js';
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

function caseRow(
  id: string,
  type: L2Type,
  turns: Array<{ text: string; session: 'same' | 'new' | 'none' }>,
): Record<string, unknown> {
  return {
    id,
    type,
    turns: turns.map((t) => ({ role: 'user', text: t.text, session: t.session })),
    expected: {
      themePersist: true,
      historyInEvidence: false,
      rewriteUsed: false,
      accept: ['answered'],
    },
    rubric: 'r',
  };
}

function pair(id: string): Array<{ text: string; session: 'same' | 'new' }> {
  return [
    { text: `${id}-1`, session: 'same' },
    { text: `${id}-2`, session: 'same' },
  ];
}

/** 九类必含（可剔除 near_coref）+ 补齐到 15 题；near_coref 题数 = nearCorefTotal */
function goldRows(
  nearCorefTotal: number,
  includeNearCorefType = true,
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const t of L2_TYPES) {
    if (t === 'near_coref' && !includeNearCorefType) continue;
    const id = `l2-${t.replace(/_/g, '-')}-001`;
    if (t === 'no_session') {
      rows.push(caseRow(id, t, [{ text: `${id}-1`, session: 'none' }]));
    } else if (t === 'session_isolation') {
      rows.push(
        caseRow(id, t, [
          { text: `${id}-1`, session: 'same' },
          { text: `${id}-2`, session: 'new' },
        ]),
      );
    } else {
      rows.push(caseRow(id, t, pair(id)));
    }
  }
  for (let i = 1; i < nearCorefTotal; i++) {
    const id = `l2-near-extra-${String(i).padStart(3, '0')}`;
    rows.push(caseRow(id, 'near_coref', pair(id)));
  }
  for (let i = 0; rows.length < 15; i++) {
    const id = `l2-fill-${String(i).padStart(3, '0')}`;
    rows.push(caseRow(id, 'budget', pair(id)));
  }
  return rows;
}

function goldFile(rows: Array<Record<string, unknown>>, dir: string): string {
  const p = path.join(dir, 'gold.yaml');
  writeFileSync(
    p,
    JSON.stringify({
      version: 1,
      run_type: 'session_multiturn',
      description: 'l2 near-coref rate test gold',
      signoffEligible: false,
      cases: rows,
    }),
    'utf8',
  );
  return p;
}

function askResult(over: {
  status: 'answered' | 'abstained';
  reason: ExecuteAskResult['graph']['reason'];
}): ExecuteAskResult {
  const answer = over.status === 'answered' ? 'ok' : '';
  const userMessage = over.status === 'answered' ? 'ok' : '拒答';
  const graph: ExecuteAskResult['graph'] = {
    requestId: 'r',
    status: over.status,
    answer,
    citations: [],
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
      citations: [],
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

const answeredTurn = (params: ExecuteAskParams) =>
  params.body.question.includes('l2-near')
    ? askResult({ status: 'answered', reason: 'verified' })
    : askResult({ status: 'abstained', reason: 'low_retrieval' });

describe('runL2Golden 近指代通过率', () => {
  it('15 题 5 条 near_coref：4 pass 1 fail = 恰好 80% → 率 0.8 且工程 signoffEligible', async () => {
    const dir = tmpDir('l2-nc-');
    const goldPath = goldFile(goldRows(5), dir);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      execute: async (params: ExecuteAskParams) =>
        params.body.question.includes('l2-near-extra-001')
          ? askResult({ status: 'abstained', reason: 'low_retrieval' })
          : askResult({ status: 'answered', reason: 'verified' }),
    });

    expect(report.nearCorefPassDen).toBe(5);
    expect(report.nearCorefPassRate).toBe(0.8);
    expect(report.caseCount).toBe(15);
    expect(report.zeroToleranceHits).toBe(0);
    expect(report.signoffEligible).toBe(true);

    const md = readFileSync(path.join(dir, 'out', 'l2-last-run.md'), 'utf8');
    expect(md).toContain('nearCorefPassRate');
    expect(md).toContain('(den=5)');
  });

  it('15 题 5 条 near_coref：2 fail = 60% → 率 0.6 且不放行', async () => {
    const dir = tmpDir('l2-nc-');
    const goldPath = goldFile(goldRows(5), dir);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      execute: async (params: ExecuteAskParams) =>
        params.body.question.includes('l2-near-extra-001') ||
        params.body.question.includes('l2-near-extra-002')
          ? askResult({ status: 'abstained', reason: 'low_retrieval' })
          : askResult({ status: 'answered', reason: 'verified' }),
    });

    expect(report.nearCorefPassDen).toBe(5);
    expect(report.nearCorefPassRate).toBe(0.6);
    expect(report.caseCount).toBe(15);
    expect(report.signoffEligible).toBe(false);
  });

  it('分母只取 near_coref：其它类全拒答不压该率', async () => {
    const dir = tmpDir('l2-nc-');
    const goldPath = goldFile(goldRows(5), dir);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      execute: async (params: ExecuteAskParams) => answeredTurn(params),
    });

    expect(report.nearCorefPassDen).toBe(5);
    expect(report.nearCorefPassRate).toBe(1);
    expect(report.failCount).toBeGreaterThan(0);
    expect(report.signoffEligible).toBe(true);
  });

  it('无 near_coref 题 → 分母 0 → 率 null → 不放行', async () => {
    const dir = tmpDir('l2-nc-');
    const goldPath = goldFile(goldRows(0, false), dir);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      execute: async () => askResult({ status: 'answered', reason: 'verified' }),
    });

    expect(report.caseCount).toBe(15);
    expect(report.nearCorefPassDen).toBe(0);
    expect(report.nearCorefPassRate).toBeNull();
    expect(report.signoffEligible).toBe(false);
  });
});
