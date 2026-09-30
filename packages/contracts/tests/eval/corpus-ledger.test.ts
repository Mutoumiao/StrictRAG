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
  diffLedgerAgainstDocs,
  formatLedgerReconcileError,
  parseCorpusLedger,
  resolveExpectedDocIds,
  sortLedgerEntries,
  summarizeDocMap,
  type CorpusLedgerEntry,
  type LedgerDocRef,
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

describe('diffLedgerAgainstDocs · 账本 ↔ 库内文档对账', () => {
  /** 库内行（`ready ∧ active`、kbId = 本次 run）；逐字段可覆盖以构造三类失配。 */
  function refOf(docId: string, title: string, over: Partial<LedgerDocRef> = {}): LedgerDocRef {
    return { docId, kbId: 'kb-1', title, status: 'ready', lifecycle: 'active', ...over };
  }

  const ledger = ledgerOf([
    entry('ingest-samples/01-doc', DOC_A, SHA_A, '01-doc'),
    entry('l2-corpus/leave-policy', DOC_B, SHA_B, 'leave-policy'),
  ]);
  const green = [refOf(DOC_A, '01-doc'), refOf(DOC_B, 'leave-policy')];

  it('全绿：三类皆空，ok=true', () => {
    expect(diffLedgerAgainstDocs(ledger, green)).toEqual({
      ok: true,
      missing: [],
      notRetrievable: [],
      titleMismatch: [],
    });
  });

  it('missing：账本点名的 docId 查不到行', () => {
    const diff = diffLedgerAgainstDocs(ledger, [refOf(DOC_A, '01-doc')]);
    expect(diff.ok).toBe(false);
    expect(diff.missing).toEqual([
      { logicalId: 'l2-corpus/leave-policy', docId: DOC_B, reason: 'missing' },
    ]);
    expect(diff.notRetrievable).toEqual([]);
    expect(diff.titleMismatch).toEqual([]);
  });

  it('missing：行在但 kbId ≠ 本次 run 的 kbId', () => {
    const diff = diffLedgerAgainstDocs(ledger, [
      refOf(DOC_A, '01-doc'),
      refOf(DOC_B, 'leave-policy', { kbId: 'other-kb' }),
    ]);
    expect(diff.missing).toHaveLength(1);
    expect(diff.missing[0]).toMatchObject({
      logicalId: 'l2-corpus/leave-policy',
      docId: DOC_B,
      reason: 'missing',
      observed: { kbId: 'other-kb' },
    });
  });

  it('not_retrievable：行在但 status ≠ ready', () => {
    const diff = diffLedgerAgainstDocs(ledger, [
      refOf(DOC_A, '01-doc'),
      refOf(DOC_B, 'leave-policy', { status: 'uploaded' }),
    ]);
    expect(diff.missing).toEqual([]);
    expect(diff.notRetrievable).toHaveLength(1);
    expect(diff.notRetrievable[0]).toMatchObject({
      logicalId: 'l2-corpus/leave-policy',
      docId: DOC_B,
      reason: 'not_retrievable',
      observed: { status: 'uploaded' },
    });
  });

  it('not_retrievable：行在但 lifecycle ≠ active（重跑入库后旧行落 superseded）', () => {
    const diff = diffLedgerAgainstDocs(ledger, [
      refOf(DOC_A, '01-doc'),
      refOf(DOC_B, 'leave-policy', { lifecycle: 'superseded' }),
    ]);
    expect(diff.notRetrievable).toHaveLength(1);
    expect(diff.notRetrievable[0]?.observed?.lifecycle).toBe('superseded');
    expect(diff.titleMismatch).toEqual([]);
  });

  it('title_mismatch：行在且可检索，但 title 与账本不逐字相等', () => {
    const diff = diffLedgerAgainstDocs(ledger, [
      refOf(DOC_A, '01-doc'),
      refOf(DOC_B, 'renamed', { status: 'uploaded', lifecycle: 'superseded' }),
    ]);
    // 命中第一类 not_retrievable 后不再往下判（title 同为错也不进 title_mismatch）
    expect(diff.notRetrievable).toHaveLength(1);
    expect(diff.titleMismatch).toEqual([]);

    const onlyTitle = diffLedgerAgainstDocs(ledger, [
      refOf(DOC_A, '01-doc'),
      refOf(DOC_B, 'renamed'),
    ]);
    expect(onlyTitle.notRetrievable).toEqual([]);
    expect(onlyTitle.titleMismatch).toHaveLength(1);
    expect(onlyTitle.titleMismatch[0]).toMatchObject({
      logicalId: 'l2-corpus/leave-policy',
      docId: DOC_B,
      reason: 'title_mismatch',
      observed: { title: 'renamed' },
    });
  });

  it('三类混合：计数各自可分辨，且三类互斥（不重复计）', () => {
    const three = ledgerOf([
      entry('a', DOC_A, SHA_A, 'a'),
      entry('b', DOC_B, SHA_B, 'b'),
      entry('c', 'doc-c', SHA_A, 'c'),
      entry('d', 'doc-d', SHA_B, 'd'),
    ]);
    const diff = diffLedgerAgainstDocs(three, [
      refOf(DOC_A, 'wrong'), // title_mismatch
      refOf(DOC_B, 'b', { status: 'uploaded' }), // not_retrievable（不再判 title）
      // doc-c 缺失 → missing
      refOf('doc-d', 'd'), // 绿
    ]);
    expect(diff.ok).toBe(false);
    expect(diff.missing.map((i) => i.logicalId)).toEqual(['c']);
    expect(diff.notRetrievable.map((i) => i.logicalId)).toEqual(['b']);
    expect(diff.titleMismatch.map((i) => i.logicalId)).toEqual(['a']);
  });

  it('输出顺序 = 账本 entries 顺序（账本已按 logicalId 升序）', () => {
    const shuffled = ledgerOf([
      entry('zeta', DOC_B, SHA_B, 'zeta'),
      entry('alpha', DOC_A, SHA_A, 'alpha'),
    ]);
    // 两条都不返回 → 全 missing；顺序应跟账本（alpha 在 zeta 前）
    const diff = diffLedgerAgainstDocs(shuffled, []);
    expect(diff.missing.map((i) => i.logicalId)).toEqual(['alpha', 'zeta']);
  });
});

describe('formatLedgerReconcileError · 错误消息', () => {
  function refOf(docId: string, title: string, over: Partial<LedgerDocRef> = {}): LedgerDocRef {
    return { docId, kbId: 'kb-1', title, status: 'ready', lifecycle: 'active', ...over };
  }

  it('单条消息：含三类计数 + 逐条明细（logicalId / docId / 实测字段）', () => {
    const ledger = ledgerOf([entry('ingest-samples/01-doc', DOC_A, SHA_A, '01-doc')]);
    const diff = diffLedgerAgainstDocs(ledger, [
      refOf(DOC_A, 'renamed', { status: 'uploaded', lifecycle: 'superseded' }),
    ]);
    const msg = formatLedgerReconcileError(diff, 'kb-1');
    expect(msg).toContain('账本与库内文档对不上');
    expect(msg).toContain('missing=0');
    expect(msg).toContain('not_retrievable=1');
    expect(msg).toContain('title_mismatch=0');
    expect(msg).toContain('ingest-samples/01-doc');
    expect(msg).toContain(DOC_A);
    expect(msg).toContain('status=uploaded');
    expect(msg).toContain('lifecycle=superseded');
  });

  it('明细最多列前 5 条，其余以「…共 N 条」收口', () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      entry(`logical/${i}`, `doc-${i}`, i % 2 === 0 ? SHA_A : SHA_B, `t-${i}`),
    );
    const diff = diffLedgerAgainstDocs(ledgerOf(entries), []);
    const msg = formatLedgerReconcileError(diff, 'kb-1');
    expect(diff.missing).toHaveLength(7);
    expect(msg).toContain('missing=7');
    expect(msg).toContain('…共 7 条');
    expect(msg.match(/\[/g)).toHaveLength(5);
  });
});
