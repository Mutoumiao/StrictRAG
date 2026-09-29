/**
 * 目标：worker L1 批跑必须能按「语料映射账本」把夹具逻辑 id 解析成数据库 uuid —— 与 api CLI 同口径，
 *       且不传账本时逐位保持今天语义；账本设置但不可用时**响亮失败**（不得静默降级成「未设置」）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 2 / 3 / 6）
 * 被测：runL1Batch（docMapPath / repoRoot）
 * 简介：不传账本 → 三键 none/0/[] 且逻辑 id 直比 uuid 必 miss；传自洽账本 → 命中变真；
 *       kbId 不符 / 语料指纹不符 / 缺文件 / 非 JSON / 形状非法一律抛错（不是静默当无账本）。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildCorpusLedger } from '@strict-rag/contracts/eval-corpus-ledger';
import { defaultRepoRoot, readFixtureCorpus } from '@strict-rag/contracts/eval-corpus-ledger-file';
import { afterEach, describe, expect, it } from 'vitest';

import { runL1Batch } from '../../src/eval/run-l1-batch.js';

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
  const d = mkdtempSync(path.join(tmpdir(), 'worker-l1-docmap-'));
  tmpDirs.push(d);
  return d;
}

/** 造一份指纹自洽的账本（缺省把 LOGICAL_A 映到 DOC_A、其余映到 DOC_OTHER）。 */
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

/** 单题：期望是逻辑 id，证据是 uuid（逻辑 id ≠ uuid → 不解析必 miss，解析后才可能命中）。 */
function run(opts: { docMapPath?: string; evidence?: string[]; kbId?: string }) {
  return runL1Batch({
    kbId: opts.kbId ?? 'kb',
    retrieveMode: 'mock',
    cases: [{ caseKey: 'a1', question: '住宿？', type: 'answerable', expectedDocIds: [LOGICAL_A] }],
    execute: async () => ({ outcome: 'answered', evidenceDocIds: opts.evidence ?? [DOC_A] }),
    repoRoot: REPO_ROOT,
    ...(opts.docMapPath ? { docMapPath: opts.docMapPath } : {}),
  });
}

describe('runL1Batch · 不传账本（回归锚：逐位保持今天语义）', () => {
  it('三键恰为 none/0/[]，且逻辑 id 直比 uuid 继续算 miss', async () => {
    const report = await run({});
    expect(report.docMapSource).toBe('none');
    expect(report.docMapResolved).toBe(0);
    expect(report.docMapUnmappedIds).toEqual([]);
    // 逻辑 id ≠ uuid → miss；scored = 1（有非空 expected 名单）不是 null
    expect(report.hitAtK).toBe(0);
    expect(report.hitAtKHits).toBe(0);
    expect(report.hitAtKScored).toBe(1);
    expect(report.cases[0]?.hitAtK).toBe(false);
  });
});

describe('runL1Batch · 传自洽账本', () => {
  it('逻辑 id 被解析为 uuid → 命中数变真；三键如实标注', async () => {
    const dir = tmp();
    const report = await run({ docMapPath: writeLedger(dir, 'kb') });
    expect(report.docMapSource).toBe('ledger');
    expect(report.docMapResolved).toBe(1);
    expect(report.docMapUnmappedIds).toEqual([]);
    expect(report.cases[0]?.hitAtK).toBe(true);
    expect(report.hitAtK).toBe(1);
    expect(report.docMapResolved).toBeGreaterThan(0);
    // 判定面不变：三键不进 signoffEligible
    expect(report.signoffEligible).toBe(false);
  });

  it('缺映射逻辑 id 原样保留继续算 miss（绝不 null）；resolved 去重、unmapped 字典序', async () => {
    const dir = tmp();
    const report = await runL1Batch({
      kbId: 'kb',
      retrieveMode: 'mock',
      cases: [
        { caseKey: 'x', question: 'x', type: 'answerable', expectedDocIds: ['nope/only'] },
        { caseKey: 'y', question: 'y', type: 'answerable', expectedDocIds: [LOGICAL_A] },
      ],
      execute: async ({ caseKey }) => ({
        outcome: 'answered',
        evidenceDocIds: caseKey === 'y' ? [DOC_A] : [],
      }),
      docMapPath: writeLedger(dir, 'kb'),
      repoRoot: REPO_ROOT,
    });
    expect(report.docMapResolved).toBe(1);
    expect(report.docMapUnmappedIds).toEqual(['nope/only']);
    expect(report.hitAtKScored).toBe(2);
    expect(report.hitAtKHits).toBe(1);
  });
});

describe('runL1Batch · 账本不可用 = 响亮失败（不得静默降级）', () => {
  it('kbId 不符 → 抛错', async () => {
    const dir = tmp();
    await expect(run({ docMapPath: writeLedger(dir, 'other-kb') })).rejects.toThrow(/kbId/);
  });

  it('语料指纹 ≠ 当前夹具 → 抛错', async () => {
    const dir = tmp();
    const docMapPath = writeLedger(dir, 'kb', () => DOC_A, [LOGICAL_A]);
    await expect(run({ docMapPath })).rejects.toThrow(/corpusFingerprint/);
  });

  it('账本文件不存在 → 抛错（不是当无账本）', async () => {
    const dir = tmp();
    await expect(run({ docMapPath: path.join(dir, 'missing.json') })).rejects.toThrow(
      /cannot read corpus ledger/,
    );
  });

  it('非 JSON → 抛错', async () => {
    const dir = tmp();
    const p = path.join(dir, 'bad.json');
    writeFileSync(p, '{not json', 'utf8');
    await expect(run({ docMapPath: p })).rejects.toThrow(/invalid corpus ledger JSON/);
  });

  it('形状非法（version 不符）→ 抛错', async () => {
    const dir = tmp();
    const p = path.join(dir, 'shape.json');
    writeFileSync(p, JSON.stringify({ version: 999 }), 'utf8');
    await expect(run({ docMapPath: p })).rejects.toThrow(/invalid corpus ledger in/);
  });
});
