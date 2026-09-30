/**
 * 目标：worker L1 批跑必须能按「语料映射账本」把夹具逻辑 id 解析成数据库 uuid —— 与 api CLI 同口径，
 *       且不传账本时逐位保持今天语义；账本设置但不可用时**响亮失败**（不得静默降级成「未设置」）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 2 / 3 / 6）
 * 被测：runL1Batch（docMapPath / lookupDocs / repoRoot）
 * 简介：不传账本 → 三键 none/0/[] 且逻辑 id 直比 uuid 必 miss；传自洽账本 → 命中变真；
 *       kbId 不符 / 语料指纹不符 / 缺文件 / 非 JSON / 形状非法一律抛错（不是静默当无账本）；
 *       库内对账（docId 不存在 / 不可检索 / title 不符）抛错；§8 题源两键 goldSource=db 且与仓内基线逐位可比。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  buildCorpusLedger,
  type CorpusLedger,
  type LedgerDocRef,
} from '@strict-rag/contracts/eval-corpus-ledger';
import {
  defaultRepoRoot,
  readFixtureCorpus,
  readRepoGoldCaseIds,
} from '@strict-rag/contracts/eval-corpus-ledger-file';
import { afterEach, describe, expect, it } from 'vitest';

import { runL1Batch, type EvalGoldCase } from '../../src/eval/run-l1-batch.js';

const REPO_ROOT = defaultRepoRoot(import.meta.url);
const LOGICAL_A = 'ingest-samples/01-doc';
const DOC_A = '01900000-0000-7000-8000-0000000000a1';

/** 未被引用的条目给唯一 docId（真实账本一篇一 id，桩靠 docId 反查 title 逐条对账）。 */
function uniqueDocId(logicalId: string): string {
  const seg = logicalId.split('/').pop() ?? logicalId;
  const hex = Buffer.from(seg, 'utf8').toString('hex').slice(0, 12).padEnd(12, '0');
  return `01900000-0000-7000-8000-${hex}`;
}

/** 账本对账库读桩：账本每条 docId 都当成库内 ready ∧ active ∧ title 相符（不连真库）。 */
function stubLookupDocs(ledgerPath: string) {
  return async (ids: readonly string[]): Promise<LedgerDocRef[]> => {
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as CorpusLedger;
    const byDocId = new Map(ledger.entries.map((e) => [e.docId, e]));
    return ids.map((id) => ({
      docId: id,
      kbId: ledger.kbId,
      title: byDocId.get(id)?.title ?? '',
      status: 'ready',
      lifecycle: 'active',
    }));
  };
}

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

/** 造一份指纹自洽的账本（缺省把 LOGICAL_A 映到 DOC_A、其余给唯一 uuid）。 */
function writeLedger(
  dir: string,
  kbId: string,
  docIdFor: (logicalId: string) => string = (id) => (id === LOGICAL_A ? DOC_A : uniqueDocId(id)),
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
function run(opts: {
  docMapPath?: string;
  evidence?: string[];
  kbId?: string;
  lookupDocs?: (ids: readonly string[]) => Promise<readonly LedgerDocRef[]>;
}) {
  return runL1Batch({
    kbId: opts.kbId ?? 'kb',
    retrieveMode: 'mock',
    cases: [{ caseKey: 'a1', question: '住宿？', type: 'answerable', expectedDocIds: [LOGICAL_A] }],
    execute: async () => ({ outcome: 'answered', evidenceDocIds: opts.evidence ?? [DOC_A] }),
    repoRoot: REPO_ROOT,
    ...(opts.docMapPath
      ? {
          docMapPath: opts.docMapPath,
          lookupDocs: opts.lookupDocs ?? stubLookupDocs(opts.docMapPath),
        }
      : {}),
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
    const docMapPath = writeLedger(dir, 'kb');
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
      docMapPath,
      lookupDocs: stubLookupDocs(docMapPath),
      repoRoot: REPO_ROOT,
    });
    expect(report.docMapResolved).toBe(1);
    expect(report.docMapUnmappedIds).toEqual(['nope/only']);
    expect(report.hitAtKScored).toBe(2);
    expect(report.hitAtKHits).toBe(1);
  });
});

describe('runL1Batch · 库内对账（账本 ↔ 库内文档）', () => {
  it('账本点名的 docId 库内不存在 → 抛错，点名 logicalId + docId', async () => {
    const dir = tmp();
    const docMapPath = writeLedger(dir, 'kb');
    await expect(
      run({ docMapPath, lookupDocs: async () => [] }),
    ).rejects.toThrow(/账本与库内文档对不上[\s\S]*ingest-samples\/01-doc[\s\S]*01900000-0000-7000-8000-0000000000a1/);
  });

  it("库内行 status ≠ ready / lifecycle='superseded' → 抛错", async () => {
    const dir = tmp();
    const docMapPath = writeLedger(dir, 'kb');
    await expect(
      run({
        docMapPath,
        lookupDocs: async (ids) =>
          (await stubLookupDocs(docMapPath)(ids)).map((r) => ({
            ...r,
            lifecycle: 'superseded',
          })),
      }),
    ).rejects.toThrow(/not_retrievable=[\s\S]*lifecycle=superseded/);
  });

  it('库内 title 与账本不逐字相等 → 抛错', async () => {
    const dir = tmp();
    const docMapPath = writeLedger(dir, 'kb');
    await expect(
      run({
        docMapPath,
        lookupDocs: async (ids) =>
          (await stubLookupDocs(docMapPath)(ids)).map((r) => ({ ...r, title: 'renamed' })),
      }),
    ).rejects.toThrow(/title_mismatch=[\s\S]*title=renamed/);
  });
});

describe('runL1Batch · §8 题源两键', () => {
  function twoCases(caseKeys: string[]): EvalGoldCase[] {
    return caseKeys.map((caseKey) => ({
      caseKey,
      question: caseKey,
      type: 'answerable' as const,
    }));
  }

  it("goldSource=db；DB 题集 = 仓内 60 条 → true", async () => {
    const ids = readRepoGoldCaseIds(REPO_ROOT);
    expect(ids).toHaveLength(60);
    const report = await runL1Batch({
      kbId: 'kb',
      retrieveMode: 'mock',
      cases: twoCases(ids ?? []),
      execute: async () => ({ outcome: 'abstained' }),
      repoRoot: REPO_ROOT,
    });
    expect(report.repro.goldSource).toBe('db');
    expect(report.repro.goldSetMatchesRepoFile).toBe(true);
  });

  it('只有 1 条 → false', async () => {
    const one = (readRepoGoldCaseIds(REPO_ROOT) ?? [])[0] ?? 'x';
    const report = await runL1Batch({
      kbId: 'kb',
      retrieveMode: 'mock',
      cases: twoCases([one]),
      execute: async () => ({ outcome: 'abstained' }),
      repoRoot: REPO_ROOT,
    });
    expect(report.repro.goldSource).toBe('db');
    expect(report.repro.goldSetMatchesRepoFile).toBe(false);
  });

  it('repoRoot 指向空目录 → null（未知，不得当 true / false）', async () => {
    const report = await runL1Batch({
      kbId: 'kb',
      retrieveMode: 'mock',
      cases: twoCases([]),
      execute: async () => ({ outcome: 'abstained' }),
      repoRoot: path.join(tmp(), 'empty'),
    });
    expect(report.repro.goldSource).toBe('db');
    expect(report.repro.goldSetMatchesRepoFile).toBeNull();
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
