/**
 * 目标：L2 跑批必须同构按账本解析逻辑 id（三键同形），缺映射继续算 miss，且三键不进 computeL2SignoffEligible。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 · §3 / §6（Hit@20 数据面）· 裁定 02（裁定 2 / 3 / 5）
 * 被测：runL2Golden（docMapPath）· formatL2ReportMd
 * 简介：不传账本 → 三键 none/0/[] 且 docHit 恒 0；传账本 → docHit 真值；是否传账本不改 signoffEligible。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildCorpusLedger } from '@strict-rag/contracts/eval-corpus-ledger';
import { afterEach, describe, expect, it } from 'vitest';

import { defaultL2GoldPath } from '../../src/eval/l2-gold.js';
import { defaultRepoRoot, readFixtureCorpus } from '../../src/eval/corpus-fixtures.js';
import { runL2Golden } from '../../src/scripts/run-l2-golden.js';
import type { ExecuteAskParams, ExecuteAskResult } from '../../src/services/ask/index.js';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});
function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l2-docmap-'));
  tmpDirs.push(d);
  return d;
}

const REPO_ROOT = defaultRepoRoot(import.meta.url);
const DOC_01 = '01900000-0000-7000-8000-0000000000a1';
const DOC_02 = '01900000-0000-7000-8000-0000000000a2';
const LOGICAL = 'ingest-samples/01-doc';

type Turn = { text: string; session: 'same' | 'new' | 'none' };
function pair(id: string): Turn[] {
  return [
    { text: `${id}-1`, session: 'same' },
    { text: `${id}-2`, session: 'same' },
  ];
}
function caseRow(
  id: string,
  type: string,
  turns: Turn[],
  expectedDocIds?: string[],
): Record<string, unknown> {
  return {
    id,
    type,
    turns: turns.map((t) => ({ role: 'user', text: t.text, session: t.session })),
    expected: { themePersist: true, historyInEvidence: false, rewriteUsed: false, accept: ['answered'] },
    ...(expectedDocIds ? { expectedDocIds } : {}),
    rubric: 'r',
  };
}
function goldFile(dir: string): string {
  const p = path.join(dir, 'gold.yaml');
  writeFileSync(
    p,
    JSON.stringify({
      version: 1,
      run_type: 'session_multiturn',
      description: 'l2 doc map test',
      signoffEligible: false,
      cases: [
        caseRow('l2-dm-a', 'near_coref', pair('l2-dm-a'), [LOGICAL]),
        caseRow('l2-dm-b', 'budget', pair('l2-dm-b'), [LOGICAL, 'nope/missing']),
      ],
    }),
    'utf8',
  );
  return p;
}

function askResult(question: string, rewriteUsed = false): ExecuteAskResult {
  const docId = question.includes('l2-dm-a') ? DOC_01 : DOC_02;
  const evidence = [{ chunkId: 'c', docId, text: '证据' }];
  const graph: ExecuteAskResult['graph'] = {
    requestId: 'r',
    status: 'answered',
    answer: 'ok',
    answerKind: 'knowledge',
    citations: [{ chunkId: 'c', docId }],
    minSupport: 0.9,
    reason: 'verified',
    userMessage: 'ok',
    suggestedActions: [],
    mode: 'balanced',
    sessionId: null,
    rewriteUsed,
    sessionDeepened: false,
    evidence_snapshot: evidence,
  };
  return {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status: 'answered',
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [{ chunkId: 'c', docId }],
      minSupport: 0.9,
      reason: 'verified',
      userMessage: 'ok',
      suggestedActions: [],
      latencyMs: 1,
      mode: 'balanced',
      sessionId: null,
    },
    graph,
  };
}

function writeLedger(dir: string, kbId: string, only?: string[]): string {
  const files = readFixtureCorpus(REPO_ROOT).filter((f) => !only || only.includes(f.logicalId));
  const ledger = buildCorpusLedger({
    kbId,
    tenantId: '01900000-0000-7000-8000-000000000001',
    generatedAt: '2026-09-29 10:00:00',
    entries: files.map((f) => ({
      logicalId: f.logicalId,
      docId: f.logicalId === 'ingest-samples/01-doc' ? DOC_01 : DOC_02,
      title: f.title,
      sourceFile: f.sourceFile,
      sourceSha256: f.sourceSha256,
    })),
  });
  const p = path.join(dir, `ledger-${kbId}.json`);
  writeFileSync(p, `${JSON.stringify(ledger)}`, 'utf8');
  return p;
}

describe('runL2Golden · docMap（同构三键）', () => {
  it('不传账本 → none/0/[]，docHit 恒 0（逻辑 id ≠ uuid）', async () => {
    const dir = tmp();
    const report = await runL2Golden({
      goldPath: goldFile(dir),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async (params: ExecuteAskParams) => askResult(params.body.question),
    });
    expect(report.docMapSource).toBe('none');
    expect(report.docMapResolved).toBe(0);
    expect(report.docMapUnmappedIds).toEqual([]);
    expect(report.docHitRate).toBe(0);
    expect(report.docHitScored).toBe(2);
  });

  it('传账本 → 解析成 uuid；命中真值；unmapped 字典序', async () => {
    const dir = tmp();
    const report = await runL2Golden({
      goldPath: goldFile(dir),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      docMapPath: writeLedger(dir, 'kb'),
      execute: async (params: ExecuteAskParams) => askResult(params.body.question),
    });
    expect(report.docMapSource).toBe('ledger');
    expect(report.docMapResolved).toBe(1);
    expect(report.docMapUnmappedIds).toEqual(['nope/missing']);
    // a：期望 01-doc→DOC_01，证据 DOC_01 → 命中；b：证据 DOC_02，期望含 01-doc 与 missing → 不中
    expect(report.docHitHits).toBe(1);
    expect(report.docHitScored).toBe(2);
    expect(report.docHitRate).toBe(0.5);
  });

  it('kbId 不符 → 拒跑', async () => {
    const dir = tmp();
    await expect(
      runL2Golden({
        goldPath: goldFile(dir),
        outDir: path.join(dir, 'out'),
        kbId: 'kb',
        persistEval: false,
        docMapPath: writeLedger(dir, 'other-kb'),
        execute: async (params: ExecuteAskParams) => askResult(params.body.question),
      }),
    ).rejects.toThrow(/kbId/);
  });

  it('md 渲染映射来源行', async () => {
    const dir = tmp();
    await runL2Golden({
      goldPath: goldFile(dir),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      docMapPath: writeLedger(dir, 'kb'),
      execute: async (params: ExecuteAskParams) => askResult(params.body.question),
    });
    const md = readFileSync(path.join(dir, 'out', 'l2-last-run.md'), 'utf8');
    expect(md).toContain('| docMapSource | ledger');
  });
});

describe('runL2Golden · 三键不进判定', () => {
  it('真实 gold + live 桩：传 / 不传账本，signoffEligible 逐位相同', async () => {
    const without = await runL2Golden({
      goldPath: defaultL2GoldPath(),
      outDir: path.join(tmp(), 'out'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      execute: async () => askResult('l2-dm-a', true),
    });
    const dir = tmp();
    const with_ = await runL2Golden({
      goldPath: defaultL2GoldPath(),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      docMapPath: writeLedger(dir, 'kb'),
      execute: async () => askResult('l2-dm-a', true),
    });
    expect(without.signoffEligible).toBe(true);
    expect(with_.signoffEligible).toBe(without.signoffEligible);
    expect(with_.docMapSource).toBe('ledger');
    expect(without.docMapSource).toBe('none');
    expect(with_.docHitRate).not.toBe(without.docHitRate);
  });
});
