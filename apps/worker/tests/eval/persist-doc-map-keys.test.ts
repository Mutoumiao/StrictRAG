/**
 * 目标：worker 落库白名单必须带映射来源三键，且**取报告真值**（带账本 → ledger/非 0；不带 → none/0/[]），
 *       使库内形状与 api CLI 不分叉（漏键即静默丢失）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 2 / 6）
 * 被测：evalPersist.saveReport · evalPersist.saveL2Report（reportJson 逐键白名单）
 * 简介：捕获 set 载荷，断言三键来自报告真值而非硬编码常量；无账本时恰为 none/0/[]。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildCorpusLedger } from '@strict-rag/contracts/eval-corpus-ledger';
import { defaultRepoRoot, readFixtureCorpus } from '@strict-rag/contracts/eval-corpus-ledger-file';
import { describe, expect, it, vi, afterEach } from 'vitest';

/** saveReport / saveL2Report 写入的 set 载荷（不连真 PG） */
const captured: Array<Record<string, unknown>> = [];

vi.mock('../../src/env.js', () => ({ env: { EVAL_L2_GOLD_PATH: '', JUDGE_CALIB_SCORER: 'off' } }));
vi.mock('../../src/db.js', () => ({
  getDb: () => ({
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          captured.push(values);
        },
      }),
    }),
  }),
}));

const { runL1Batch } = await import('../../src/eval/run-l1-batch.js');
const { runL2Batch } = await import('../../src/eval/run-l2-batch.js');
const { evalPersist } = await import('../../src/eval/persist.js');

const RUN_ID = '01900000-0000-7000-8000-0000000000aa';
const REPO_ROOT = defaultRepoRoot(import.meta.url);
const LOGICAL_A = 'ingest-samples/01-doc';
const DOC_A = '01900000-0000-7000-8000-0000000000a1';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});
function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'persist-docmap-'));
  tmpDirs.push(d);
  return d;
}

/** 造一份指纹自洽的账本：LOGICAL_A → DOC_A。 */
function writeLedger(dir: string, kbId: string): string {
  const files = readFixtureCorpus(REPO_ROOT);
  const ledger = buildCorpusLedger({
    kbId,
    tenantId: '01900000-0000-7000-8000-000000000001',
    generatedAt: '2026-09-29 10:00:00',
    entries: files.map((f) => ({
      logicalId: f.logicalId,
      docId: f.logicalId === LOGICAL_A ? DOC_A : '01900000-0000-7000-8000-0000000000b1',
      title: f.title,
      sourceFile: f.sourceFile,
      sourceSha256: f.sourceSha256,
    })),
  });
  const p = path.join(dir, `ledger-${kbId}.json`);
  writeFileSync(p, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return p;
}

function reportJsonOfLast(): Record<string, unknown> | undefined {
  return captured.at(-1)?.reportJson as Record<string, unknown> | undefined;
}

describe('persist · 映射来源三键白名单（取自报告真值）', () => {
  it('saveReport（L1）不带账本 → reportJson 三键恰为 none/0/[]', async () => {
    const report = await runL1Batch({
      kbId: 'kb-1',
      retrieveMode: 'mock',
      cases: [{ caseKey: 'a1', question: '可答题', type: 'answerable' }],
      execute: async () => ({ outcome: 'answered' }),
    });
    captured.length = 0;
    await evalPersist.saveReport(RUN_ID, report);

    const reportJson = reportJsonOfLast();
    expect(reportJson?.docMapSource).toBe('none');
    expect(reportJson?.docMapResolved).toBe(0);
    expect(reportJson?.docMapUnmappedIds).toEqual([]);
  });

  it('saveReport（L1）带账本 → reportJson 三键 = 报告真值（ledger / 非 0 / unmapped）', async () => {
    const dir = tmp();
    const report = await runL1Batch({
      kbId: 'kb-1',
      retrieveMode: 'mock',
      cases: [
        {
          caseKey: 'a1',
          question: '可答题',
          type: 'answerable',
          expectedDocIds: [LOGICAL_A, 'nope/missing'],
        },
      ],
      execute: async () => ({ outcome: 'answered', evidenceDocIds: [DOC_A] }),
      docMapPath: writeLedger(dir, 'kb-1'),
      repoRoot: REPO_ROOT,
    });
    expect(report.docMapSource).toBe('ledger');
    captured.length = 0;
    await evalPersist.saveReport(RUN_ID, report);

    const reportJson = reportJsonOfLast();
    expect(reportJson?.docMapSource).toBe('ledger');
    expect(reportJson?.docMapResolved).toBe(1);
    expect(reportJson?.docMapUnmappedIds).toEqual(['nope/missing']);
  });

  it('saveL2Report（L2）不带账本 → reportJson 三键恰为 none/0/[]', async () => {
    const report = await runL2Batch({
      kbId: 'kb-1',
      retrieveMode: 'mock',
      cases: [],
      executeTurn: async () => ({ outcome: 'answered' }),
    });
    captured.length = 0;
    await evalPersist.saveL2Report(RUN_ID, report);

    const reportJson = reportJsonOfLast();
    expect(reportJson?.docMapSource).toBe('none');
    expect(reportJson?.docMapResolved).toBe(0);
    expect(reportJson?.docMapUnmappedIds).toEqual([]);
  });

  it('saveL2Report（L2）带账本 → reportJson 三键 = 报告真值', async () => {
    const dir = tmp();
    const report = await runL2Batch({
      kbId: 'kb-1',
      retrieveMode: 'mock',
      cases: [
        {
          id: 'l2-persist-1',
          type: 'near_coref',
          turns: [
            { role: 'user', text: '住宿？', session: 'same' },
            { role: 'user', text: '那餐补呢', session: 'same' },
          ],
          expected: { themePersist: true, historyInEvidence: false, rewriteUsed: false, accept: ['answered'] },
          expectedDocIds: [LOGICAL_A, 'nope/missing'],
          rubric: 'r',
        },
      ],
      executeTurn: async () => ({
        outcome: 'answered',
        rewriteUsed: false,
        evidenceTexts: ['条款'],
        evidenceDocIds: [DOC_A],
        answer: 'ok',
      }),
      docMapPath: writeLedger(dir, 'kb-1'),
      repoRoot: REPO_ROOT,
    });
    expect(report.docMapSource).toBe('ledger');
    captured.length = 0;
    await evalPersist.saveL2Report(RUN_ID, report);

    const reportJson = reportJsonOfLast();
    expect(reportJson?.docMapSource).toBe('ledger');
    expect(reportJson?.docMapResolved).toBe(1);
    expect(reportJson?.docMapUnmappedIds).toEqual(['nope/missing']);
  });
});
