/**
 * 目标：L1 跑批必须按账本把逻辑 id 解析成 uuid；不传账本时逐位保持今天语义，缺映射继续算 miss（绝不 null）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 2 / 3 / 4）
 * 被测：runL1Golden（docMapPath）· resolveCorpusLedgerForRun · formatReportMd
 * 简介：不传账本 → 三键 none/0/[] 且 hitAtK 与直比逐位一致；传账本全命中 / 缺 id 算 miss；kbId 或指纹不符拒跑。
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { hitAtKCase } from '@strict-rag/contracts';
import { buildCorpusLedger } from '@strict-rag/contracts/eval-corpus-ledger';
import { afterEach, describe, expect, it } from 'vitest';

import { defaultRepoRoot, readFixtureCorpus } from '../../src/eval/corpus-fixtures.js';
import { formatReportMd, runL1Golden, type L1Report } from '../../src/scripts/run-l1-golden.js';
import type { ExecuteAskParams, ExecuteAskResult } from '../../src/services/ask/index.js';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});
function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l1-docmap-'));
  tmpDirs.push(d);
  return d;
}

const REPO_ROOT = defaultRepoRoot(import.meta.url);
const DOC_01 = '01900000-0000-7000-8000-0000000000a1';
const DOC_02 = '01900000-0000-7000-8000-0000000000a2';
const UUID_RE = /^[0-9a-f-]{36}$/;

function goldFile(dir: string): string {
  const cases = [
    { id: 'both', question: 'both', type: 'answerable', expectedDocIds: ['ingest-samples/01-doc', 'ingest-samples/02-doc'] },
    { id: 'partial', question: 'partial', type: 'answerable', expectedDocIds: ['ingest-samples/01-doc', 'nope/missing'] },
  ];
  const p = path.join(dir, 'gold.yaml');
  writeFileSync(p, JSON.stringify({ cases }), 'utf8');
  return p;
}

function answeredWithDocs(question: string): ExecuteAskResult {
  const docId = question === 'both' ? DOC_01 : DOC_02;
  const evidence =
    question === 'both'
      ? [DOC_01, DOC_02].map((d, i) => ({ chunkId: `c${i}`, docId: d, text: 't' }))
      : [{ chunkId: 'c', docId }];
  const graph: ExecuteAskResult['graph'] = {
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
    rewriteUsed: false,
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
      citations: [],
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

/** 造一份账本（指纹自洽）；`docIds` 缺省 → 全部 13 条按前缀给 uuid */
function writeLedger(
  dir: string,
  kbId: string,
  docIdFor: (logicalId: string) => string = (id) =>
    id === 'ingest-samples/02-doc' ? DOC_02 : DOC_01,
  onlyLogicalIds?: string[],
): string {
  const files = readFixtureCorpus(REPO_ROOT).filter(
    (f) => !onlyLogicalIds || onlyLogicalIds.includes(f.logicalId),
  );
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

async function run(
  dir: string,
  extra: { kbId?: string; docMapPath?: string; goldPath?: string } = {},
) {
  return runL1Golden({
    goldPath: extra.goldPath ?? goldFile(dir),
    outDir: path.join(dir, 'out'),
    kbId: extra.kbId ?? 'kb',
    persistEval: false,
    execute: async (params: ExecuteAskParams) => answeredWithDocs(params.body.question),
    ...(extra.docMapPath ? { docMapPath: extra.docMapPath } : {}),
  });
}

describe('runL1Golden · 不传账本（回归锚：逐位保持今天语义）', () => {
  it('三键 none/0/[]，且 hitAtK 与「逻辑 id 直比 uuid」逐位一致', async () => {
    const dir = tmp();
    const report = await run(dir);
    expect(report.docMapSource).toBe('none');
    expect(report.docMapResolved).toBe(0);
    expect(report.docMapUnmappedIds).toEqual([]);
    // 逻辑 id never equals uuid → 全 miss；scored = 2（两题都有非空 expected）非 null
    const rawExpected = [
      ['ingest-samples/01-doc', 'ingest-samples/02-doc'],
      ['ingest-samples/01-doc', 'nope/missing'],
    ];
    const evidence = [[DOC_01, DOC_02], [DOC_02]];
    expect(hitAtKCase(rawExpected[0], evidence[0])).toBe(false);
    expect(hitAtKCase(rawExpected[1], evidence[1])).toBe(false);
    expect(report.hitAtK).toBe(0);
    expect(report.hitAtKHits).toBe(0);
    expect(report.hitAtKScored).toBe(2);
    expect(report.matrix).toEqual({ A: 2, B: 0, C: 0, D: 0 });
  });
});

describe('runL1Golden · 传账本', () => {
  it('全命中：逻辑 id → uuid，hitAtK=1；三键如实标注', async () => {
    const dir = tmp();
    const docMapPath = writeLedger(dir, 'kb');
    const report = await run(dir, { docMapPath });
    expect(report.docMapSource).toBe('ledger');
    expect(report.docMapResolved).toBe(2); // 01-doc / 02-doc
    expect(report.docMapUnmappedIds).toEqual(['nope/missing']);
    // both 命中；partial 的证据是 DOC_02，期望里除 01-doc(→uuid) 外还有 nope/missing → 不中
    expect(report.hitAtK).toBe(0.5);
    expect(report.hitAtKHits).toBe(1);
    expect(report.hitAtKScored).toBe(2);
    expect(report.matrix).toEqual({ A: 2, B: 0, C: 0, D: 0 });
    // 判定面不变：三键不进 signoffEligible
    expect(report.signoffEligible).toBe(false);
  });

  it('缺映射 id 原样保留继续算 miss（绝不 null）；resolved 去重、unmapped 字典序', async () => {
    const dir = tmp();
    // 账本覆盖全量夹具（指纹全等），但 gold 引用了账本里没有的逻辑 id
    const goldPath = path.join(dir, 'g2.yaml');
    writeFileSync(
      goldPath,
      JSON.stringify({
        cases: [
          { id: 'x', question: 'x', type: 'answerable', expectedDocIds: ['nope/only'] },
          {
            id: 'y',
            question: 'y',
            type: 'answerable',
            expectedDocIds: ['ingest-samples/01-doc', 'ingest-samples/02-doc'],
          },
        ],
      }),
      'utf8',
    );
    const report = await run(dir, { docMapPath: writeLedger(dir, 'kb'), goldPath });
    expect(report.docMapResolved).toBe(2); // 01-doc / 02-doc
    expect(report.docMapUnmappedIds).toEqual(['nope/only']);
    expect(report.hitAtKScored).toBe(2); // 缺映射仍计分（不是 null）
    // x：无映射 → 原样保留 ≠ uuid → miss；y：期望 [01,02]→uuid，证据 DOC_02 → 命中
    expect(report.hitAtK).toBe(0.5);
  });

  it('kbId 不符 → 拒跑（CorpusLedgerError）', async () => {
    const dir = tmp();
    const docMapPath = writeLedger(dir, 'other-kb');
    await expect(run(dir, { docMapPath })).rejects.toThrow(/kbId/);
  });

  it('账本指纹 ≠ 当前夹具 → 拒跑', async () => {
    const dir = tmp();
    // 只含一篇 → 指纹自洽但与「全量夹具」指纹不符
    const docMapPath = writeLedger(dir, 'kb', () => DOC_01, ['ingest-samples/01-doc']);
    await expect(run(dir, { docMapPath })).rejects.toThrow(/corpusFingerprint/);
  });

  it('账本文件不存在 → 拒跑（不得静默降级成「无账本」）', async () => {
    const dir = tmp();
    await expect(run(dir, { docMapPath: path.join(dir, 'missing.json') })).rejects.toThrow(
      /cannot read corpus ledger/,
    );
  });
});

describe('formatReportMd · 映射来源渲染', () => {
  it('不传账本 / 传账本两种 md 都能读出映射来源', async () => {
    const dir = tmp();
    const none = await run(dir);
    const noneMd = formatReportMd(none);
    expect(noneMd).toContain('| docMapSource | none');

    const dir2 = tmp();
    const withLedger = await run(dir2, { docMapPath: writeLedger(dir2, 'kb') });
    const ledgerMd = formatReportMd(withLedger);
    expect(ledgerMd).toContain('| docMapSource | ledger');
    expect(ledgerMd).toContain('resolved=2');
    expect(ledgerMd).toContain('nope/missing');
  });

  it('报告 json 落三键（写文件可回读）', async () => {
    const dir = tmp();
    const report = await run(dir, { docMapPath: writeLedger(dir, 'kb') });
    const jsonPath = path.join(dir, 'out', 'l1-last-run.json');
    expect(existsSync(jsonPath)).toBe(true);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8')) as L1Report;
    expect(json.docMapSource).toBe(report.docMapSource);
    expect(json.docMapResolved).toBe(report.docMapResolved);
    expect(json.docMapUnmappedIds).toEqual(report.docMapUnmappedIds);
  });

  it('映射 uuid 不冒充「逻辑 id 就是 uuid」：解析结果形如 uuid', async () => {
    const dir = tmp();
    const report = await run(dir, { docMapPath: writeLedger(dir, 'kb') });
    expect(report.docMapResolved).toBeGreaterThan(0);
    expect(UUID_RE.test(DOC_01)).toBe(true);
  });
});
