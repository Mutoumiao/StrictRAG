/**
 * 目标：worker L2 批跑必须与 api CLI 同构地按账本把逻辑 id 解析为 uuid（正常分支与 error 分支都要），
 *       账本不可用时响亮失败，且三键**不进** `computeL2SignoffEligible`。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 · §3 / §6（Hit@20 数据面）· 裁定 02（裁定 2 / 3 / 5）
 * 被测：runL2Batch（docMapPath / repoRoot）
 * 简介：不传账本 → 三键 none/0/[] 且 docHit 恒 0；传账本 → docHit 真值；kbId / 指纹 / 形状不可用一律抛错；
 *       传 / 不传账本 `signoffEligible` 逐位相同。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { L2_TYPES, type L2Case, type L2Type } from '@strict-rag/contracts';
import { buildCorpusLedger } from '@strict-rag/contracts/eval-corpus-ledger';
import { defaultRepoRoot, readFixtureCorpus } from '@strict-rag/contracts/eval-corpus-ledger-file';
import { afterEach, describe, expect, it } from 'vitest';

import { runL2Batch } from '../../src/eval/run-l2-batch.js';

const REPO_ROOT = defaultRepoRoot(import.meta.url);
const LOGICAL_A = 'ingest-samples/01-doc';
const DOC_A = '01900000-0000-7000-8000-0000000000a1';
const DOC_OTHER = '01900000-0000-7000-8000-0000000000b1';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});
function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'worker-l2-docmap-'));
  tmpDirs.push(d);
  return d;
}

function writeLedger(
  dir: string,
  kbId: string,
  docIdFor: (logicalId: string) => string = (id) => (id === LOGICAL_A ? DOC_A : DOC_OTHER),
  only?: string[],
): string {
  const files = readFixtureCorpus(REPO_ROOT).filter((f) => !only || only.includes(f.logicalId));
  const ledger = buildCorpusLedger({
    kbId,
    tenantId: '01900000-0000-7000-8000-000000000001',
    generatedAt: '2026-09-29 10:00:00',
    entries: files.map((f) => ({
      logicalId: f.logicalId,
      docId: docIdFor(f.logicalId),
      title: f.title,
      sourceFile: f.sourceFile,
      sourceSha256: f.sourceSha256,
    })),
  });
  const p = path.join(dir, `ledger-${kbId}.json`);
  writeFileSync(p, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return p;
}

function l2Case(id: string, type: L2Type, expectedDocIds?: string[]): L2Case {
  return {
    id,
    type,
    turns: [
      { role: 'user', text: `${id}-1`, session: 'same' },
      { role: 'user', text: `${id}-2`, session: 'same' },
    ],
    expected: {
      themePersist: true,
      historyInEvidence: false,
      rewriteUsed: false,
      accept: ['answered'],
    },
    ...(expectedDocIds ? { expectedDocIds } : {}),
    rubric: 'r',
  };
}

const okTurn = () => ({
  outcome: 'answered' as const,
  rewriteUsed: false,
  evidenceTexts: ['条款'],
  evidenceDocIds: [DOC_A],
  answer: 'ok',
});

describe('runL2Batch · docMap（同构三键）', () => {
  it('不传账本 → none/0/[]，docHit 恒 0（逻辑 id ≠ uuid）', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'mock',
      cases: [l2Case('l2-dm-a', 'near_coref', [LOGICAL_A])],
      executeTurn: async () => okTurn(),
    });
    expect(report.docMapSource).toBe('none');
    expect(report.docMapResolved).toBe(0);
    expect(report.docMapUnmappedIds).toEqual([]);
    expect(report.docHitRate).toBe(0);
    expect(report.docHitScored).toBe(1);
  });

  it('传账本 → 解析成 uuid；命中真值；unmapped 字典序', async () => {
    const dir = tmp();
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'mock',
      cases: [l2Case('l2-dm-a', 'near_coref', [LOGICAL_A, 'nope/missing'])],
      executeTurn: async () => okTurn(),
      docMapPath: writeLedger(dir, 'kb'),
      repoRoot: REPO_ROOT,
    });
    expect(report.docMapSource).toBe('ledger');
    expect(report.docMapResolved).toBe(1);
    expect(report.docMapUnmappedIds).toEqual(['nope/missing']);
    expect(report.docHitHits).toBe(1);
    expect(report.docHitScored).toBe(1);
    expect(report.docHitRate).toBe(1);
  });
});

describe('runL2Batch · 账本不可用 = 响亮失败（不得静默降级）', () => {
  it('kbId 不符 → 抛错', async () => {
    const dir = tmp();
    await expect(
      runL2Batch({
        kbId: 'kb',
        retrieveMode: 'mock',
        cases: [l2Case('l2-dm-a', 'near_coref', [LOGICAL_A])],
        executeTurn: async () => okTurn(),
        docMapPath: writeLedger(dir, 'other-kb'),
        repoRoot: REPO_ROOT,
      }),
    ).rejects.toThrow(/kbId/);
  });

  it('语料指纹 ≠ 当前夹具 → 抛错', async () => {
    const dir = tmp();
    await expect(
      runL2Batch({
        kbId: 'kb',
        retrieveMode: 'mock',
        cases: [l2Case('l2-dm-a', 'near_coref', [LOGICAL_A])],
        executeTurn: async () => okTurn(),
        docMapPath: writeLedger(dir, 'kb', () => DOC_A, [LOGICAL_A]),
        repoRoot: REPO_ROOT,
      }),
    ).rejects.toThrow(/corpusFingerprint/);
  });

  it('账本文件缺失 / 非 JSON / 形状非法 → 抛错', async () => {
    const dir = tmp();
    const base = {
      kbId: 'kb',
      retrieveMode: 'mock' as const,
      cases: [l2Case('l2-dm-a', 'near_coref', [LOGICAL_A])],
      executeTurn: async () => okTurn(),
      repoRoot: REPO_ROOT,
    };
    await expect(
      runL2Batch({ ...base, docMapPath: path.join(dir, 'missing.json') }),
    ).rejects.toThrow(/cannot read corpus ledger/);

    const bad = path.join(dir, 'bad.json');
    writeFileSync(bad, '{not json', 'utf8');
    await expect(runL2Batch({ ...base, docMapPath: bad })).rejects.toThrow(
      /invalid corpus ledger JSON/,
    );

    const shape = path.join(dir, 'shape.json');
    writeFileSync(shape, JSON.stringify({ version: 999 }), 'utf8');
    await expect(runL2Batch({ ...base, docMapPath: shape })).rejects.toThrow(
      /invalid corpus ledger in/,
    );
  });
});

describe('runL2Batch · error 分支也受解析影响', () => {
  it('executeTurn 抛错 → 该题 verdict=error 且 docHit 仍按解析后的名单计分', async () => {
    const dir = tmp();
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'mock',
      cases: [l2Case('l2-dm-a', 'near_coref', [LOGICAL_A])],
      executeTurn: async () => {
        throw new Error('gateway down');
      },
      docMapPath: writeLedger(dir, 'kb'),
      repoRoot: REPO_ROOT,
    });
    expect(report.cases[0]?.verdict).toBe('error');
    // 有非空 expected → 仍计分（不是 null）；证据为空 → false
    expect(report.cases[0]?.docHit).toBe(false);
    expect(report.docHitScored).toBe(1);
  });

  it('源码形状守卫：两处 hitAtKCase 都经 expectedForHit（正常分支 + error 分支）', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../src/eval/run-l2-batch.ts', import.meta.url)),
      'utf8',
    );
    const viaHelper = src.match(/hitAtKCase\(expectedForHit\(/g) ?? [];
    const rawCalls = src.match(/hitAtKCase\(c\.expectedDocIds/g) ?? [];
    expect(viaHelper).toHaveLength(2);
    expect(rawCalls).toHaveLength(0);
  });
});

describe('runL2Batch · 三键不进判定', () => {
  it('live + 九类齐 + ≥15：传 / 不传账本 signoffEligible 逐位相同', async () => {
    const cases = L2_TYPES.map((type, i) =>
      l2Case(`l2-t-${String(i).padStart(3, '0')}`, type, [LOGICAL_A]),
    );
    let fill = 0;
    while (cases.length < 15) {
      cases.push(l2Case(`l2-f-${String(fill++).padStart(3, '0')}`, 'budget', [LOGICAL_A]));
    }
    const without = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases,
      executeTurn: async () => okTurn(),
    });
    const dir = tmp();
    const with_ = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases,
      executeTurn: async () => okTurn(),
      docMapPath: writeLedger(dir, 'kb'),
      repoRoot: REPO_ROOT,
    });
    expect(without.signoffEligible).toBe(true);
    expect(with_.signoffEligible).toBe(without.signoffEligible);
    expect(without.docMapSource).toBe('none');
    expect(with_.docMapSource).toBe('ledger');
    expect(with_.docHitRate).not.toBe(without.docHitRate);
  });
});
