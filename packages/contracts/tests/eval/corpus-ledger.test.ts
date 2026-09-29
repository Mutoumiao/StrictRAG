/**
 * 目标：评测语料映射账本的形状、指纹与解析必须确定性可核对，未映射逻辑 id 继续算 miss（绝不变成 null）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 1 / 3 / 4）
 * 被测：buildCorpusLedger · parseCorpusLedger · corpusFingerprint · sortLedgerEntries · resolveExpectedDocIds · summarizeDocMap
 * 简介：同输入同输出（硬编码指纹跨进程钉住）；换序同值、改一字节即变；脏形状 / 版号 / 指纹不自洽抛错；缺映射原样保留。
 */

import { describe, expect, it } from 'vitest';

import {
  buildCorpusLedger,
  corpusFingerprint,
  parseCorpusLedger,
  resolveExpectedDocIds,
  sortLedgerEntries,
  summarizeDocMap,
  type CorpusLedgerEntry,
} from '../../src/eval/corpus-ledger.js';

const SHA_A = 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
const SHA_B = '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d';
/** 独立算出的指纹：换实现 / 加盐 / 升序规则改动都会翻红 */
const FP_TWO = '74dfbd32475b4d95d8c5152f25505207b9fa4f0c8a362d80be6e7a7799e4c95f';

function entry(
  logicalId: string,
  docId: string,
  sourceSha256: string,
  title = logicalId,
  sourceFile = `fixtures/${logicalId}.txt`,
): CorpusLedgerEntry {
  return { logicalId, docId, title, sourceFile, sourceSha256 };
}

function ledgerOf(entries: CorpusLedgerEntry[]) {
  return buildCorpusLedger({
    kbId: 'kb-1',
    tenantId: '01900000-0000-7000-8000-000000000001',
    generatedAt: '2026-09-29 10:00:00',
    entries,
  });
}

const DOC_A = '01900000-0000-7000-8000-0000000000a1';
const DOC_B = '01900000-0000-7000-8000-0000000000b2';

describe('corpusFingerprint · 语料指纹', () => {
  it('同输入同值，且是 64 位十六进制（跨进程由硬编码摘要钉住）', () => {
    const rows = [
      { logicalId: 'ingest-samples/01-doc', sourceSha256: SHA_A },
      { logicalId: 'l2-corpus/leave-policy', sourceSha256: SHA_B },
    ];
    const fp = corpusFingerprint(rows);
    expect(fp).toBe(corpusFingerprint(rows));
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(fp).toBe(FP_TWO);
  });

  it('逻辑 id 升序，换序同值；改一个文件字节（sha 变）即变值', () => {
    const ab = corpusFingerprint([
      { logicalId: 'ingest-samples/01-doc', sourceSha256: SHA_A },
      { logicalId: 'l2-corpus/leave-policy', sourceSha256: SHA_B },
    ]);
    const ba = corpusFingerprint([
      { logicalId: 'l2-corpus/leave-policy', sourceSha256: SHA_B },
      { logicalId: 'ingest-samples/01-doc', sourceSha256: SHA_A },
    ]);
    expect(ba).toBe(ab);
    expect(corpusFingerprint([{ logicalId: 'ingest-samples/01-doc', sourceSha256: SHA_B }])).not.toBe(
      corpusFingerprint([{ logicalId: 'ingest-samples/01-doc', sourceSha256: SHA_A }]),
    );
  });
});

describe('buildCorpusLedger · 造账本', () => {
  it('entries 按 logicalId 升序，且带 version / kbId / tenantId / generatedAt / 指纹', () => {
    const ledger = ledgerOf([
      entry('l2-corpus/leave-policy', DOC_B, SHA_B),
      entry('ingest-samples/01-doc', DOC_A, SHA_A),
    ]);
    expect(ledger.version).toBe(1);
    expect(ledger.kbId).toBe('kb-1');
    expect(ledger.tenantId).toBe('01900000-0000-7000-8000-000000000001');
    expect(ledger.generatedAt).toBe('2026-09-29 10:00:00');
    expect(ledger.entries.map((e) => e.logicalId)).toEqual([
      'ingest-samples/01-doc',
      'l2-corpus/leave-policy',
    ]);
    expect(ledger.corpusFingerprint).toBe(FP_TWO);
  });

  it('同输入两次造 → 逐字段等价（排序确定性）；重复逻辑 id 抛错', () => {
    const a = ledgerOf([entry('b', DOC_A, SHA_A), entry('a', DOC_B, SHA_B)]);
    const b = ledgerOf([entry('a', DOC_B, SHA_B), entry('b', DOC_A, SHA_A)]);
    expect(a).toEqual(b);
    expect(() => ledgerOf([entry('a', DOC_A, SHA_A), entry('a', DOC_B, SHA_B)])).toThrow(
      /duplicate logicalId/,
    );
  });

  it('坏 sha / 空逻辑 id 抛错（禁止造出「可解析但不自洽」的账本）', () => {
    expect(() => ledgerOf([entry('a', DOC_A, 'not-a-sha')])).toThrow(/sha256/);
    expect(() => ledgerOf([entry('   ', DOC_A, SHA_A)])).toThrow(/logicalId/);
  });
});

describe('parseCorpusLedger · 解析校验', () => {
  it('往返：build → JSON → parse 逐字段等价，且 entries 归一为升序', () => {
    const ledger = ledgerOf([
      entry('ingest-samples/01-doc', DOC_A, SHA_A),
      entry('l2-corpus/travel-stay', DOC_B, SHA_B),
    ]);
    const parsed = parseCorpusLedger(JSON.parse(JSON.stringify(ledger)));
    expect(parsed).toEqual(ledger);
    // 手工写乱序 → 解析后仍升序（确定性由解析兜底）
    const shuffled = { ...ledger, entries: [...ledger.entries].reverse() };
    expect(parseCorpusLedger(shuffled).entries).toEqual(ledger.entries);
  });

  it('版号不符 / entries 空 / 指纹与条目不自洽 → 抛错', () => {
    const ledger = ledgerOf([entry('a', DOC_A, SHA_A)]);
    expect(() => parseCorpusLedger({ ...ledger, version: 2 })).toThrow(/version/);
    expect(() => parseCorpusLedger({ ...ledger, entries: [] })).toThrow(/non-empty/);
    expect(() =>
      parseCorpusLedger({ ...ledger, entries: [{ ...ledger.entries[0], docId: 'tampered' }] }),
    ).not.toThrow(); // docId 不参与指纹：改 docId 不触发自洽红
    expect(() =>
      parseCorpusLedger({ ...ledger, entries: [{ ...ledger.entries[0], sourceSha256: SHA_B }] }),
    ).toThrow(/does not match/);
  });

  it('非对象 / 缺 kbId → 抛错', () => {
    expect(() => parseCorpusLedger(null)).toThrow(/object/);
    expect(() => parseCorpusLedger({ ...ledgerOf([entry('a', DOC_A, SHA_A)]), kbId: '' })).toThrow(
      /kbId/,
    );
  });
});

describe('resolveExpectedDocIds · 未映射原样保留（绝不 null）', () => {
  const ledger = ledgerOf([
    entry('ingest-samples/01-doc', DOC_A, SHA_A),
    entry('l2-corpus/leave-policy', DOC_B, SHA_B),
  ]);

  it('命中换成 uuid；缺映射原样保留逻辑 id', () => {
    expect(resolveExpectedDocIds(['ingest-samples/01-doc', 'l2-corpus/missing'], ledger)).toEqual([
      DOC_A,
      'l2-corpus/missing',
    ]);
  });

  it('trim / 去空项；无名单 → []（不是 null）', () => {
    expect(resolveExpectedDocIds(['  l2-corpus/leave-policy '], ledger)).toEqual([DOC_B]);
    expect(resolveExpectedDocIds(null, ledger)).toEqual([]);
    expect(resolveExpectedDocIds([], ledger)).toEqual([]);
    expect(resolveExpectedDocIds(['', '   '], ledger)).toEqual([]);
  });

  it('未映射 id 与 uuid 比对必然不中（记 miss 的机械前提）', () => {
    const resolved = resolveExpectedDocIds(['l2-corpus/missing'], ledger);
    expect(resolved).toEqual(['l2-corpus/missing']);
    expect(resolved).not.toContain(DOC_A);
  });
});

describe('summarizeDocMap · 报告三键', () => {
  const ledger = ledgerOf([
    entry('ingest-samples/01-doc', DOC_A, SHA_A),
    entry('l2-corpus/leave-policy', DOC_B, SHA_B),
  ]);

  it('未传账本 → source=none / resolved=0 / unmapped=[]（逐位保持今天语义）', () => {
    expect(summarizeDocMap([['ingest-samples/01-doc'], undefined], null)).toEqual({
      docMapSource: 'none',
      docMapResolved: 0,
      docMapUnmappedIds: [],
    });
  });

  it('传账本 → resolved 去重、unmapped 字典序去重', () => {
    const summary = summarizeDocMap(
      [
        ['ingest-samples/01-doc', 'l2-corpus/missing'],
        ['ingest-samples/01-doc', 'l2-corpus/another-missing'],
        null,
        undefined,
      ],
      ledger,
    );
    expect(summary.docMapSource).toBe('ledger');
    expect(summary.docMapResolved).toBe(1);
    expect(summary.docMapUnmappedIds).toEqual([
      'l2-corpus/another-missing',
      'l2-corpus/missing',
    ]);
  });

  it('账本无该 id 时 resolved=0 且列出全部未映射（仍算 miss）', () => {
    const summary = summarizeDocMap([['tenant-b/only']], ledger);
    expect(summary.docMapResolved).toBe(0);
    expect(summary.docMapUnmappedIds).toEqual(['tenant-b/only']);
  });
});

describe('sortLedgerEntries · 排序确定性', () => {
  it('不改入参、按 logicalId 升序返回新数组', () => {
    const input = [entry('b', DOC_A, SHA_A), entry('a', DOC_B, SHA_B)];
    const sorted = sortLedgerEntries(input);
    expect(sorted.map((e) => e.logicalId)).toEqual(['a', 'b']);
    expect(input.map((e) => e.logicalId)).toEqual(['b', 'a']);
    expect(sorted[0]).not.toBe(input[0]);
  });
});
