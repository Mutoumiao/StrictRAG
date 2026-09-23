/**
 * 目标：api L2 CLI 必须把末轮 evidence docId / citations / answerKind 采成可核对原料，落 docHit 与引用完整率，且两者都不进判定。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 · 裁定 02（一、采集面）
 * 被测：runL2Golden · formatL2ReportMd
 * 简介：注入 execute + 临时 gold；docHit 复用 hitAtKCase 口径（未映射恒 0，不得当成绩）；
 *       citationOk 三态（未下发 ≠ 无引用）且不进 failReasons；signoffEligible 逐位不变。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  L2_EVIDENCE_REPORT_KEYS,
  L2_EVIDENCE_ROW_KEYS,
  L2_TYPES,
  type L2Type,
} from '@strict-rag/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { defaultL2GoldPath } from '../../src/eval/l2-gold.js';
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

const UUID_A = '01900000-0000-7000-8000-0000000000a1';
const LOGICAL_ID = 'l2-corpus/travel-stay';

type Turn = { text: string; session: 'same' | 'new' | 'none' };

function pair(id: string): Turn[] {
  return [
    { text: `${id}-1`, session: 'same' },
    { text: `${id}-2`, session: 'same' },
  ];
}

function caseRow(
  id: string,
  type: L2Type,
  turns: Turn[],
  expectedDocIds?: string[],
  accept: string[] = ['answered'],
): Record<string, unknown> {
  return {
    id,
    type,
    turns: turns.map((t) => ({ role: 'user', text: t.text, session: t.session })),
    expected: {
      themePersist: true,
      historyInEvidence: false,
      rewriteUsed: false,
      accept,
    },
    ...(expectedDocIds ? { expectedDocIds } : {}),
    rubric: 'r',
  };
}

/** 九类必含 + 补齐 15 题；`docIdsFor(i)` 决定该题有没有 expectedDocIds（undefined = 无标注） */
function goldRows(docIdsFor?: (i: number) => string[] | undefined): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  L2_TYPES.forEach((t, i) => {
    const id = `l2-${t.replace(/_/g, '-')}-001`;
    const turns =
      t === 'no_session'
        ? [{ text: `${id}-1`, session: 'none' } as Turn]
        : t === 'session_isolation'
          ? [
              { text: `${id}-1`, session: 'same' } as Turn,
              { text: `${id}-2`, session: 'new' } as Turn,
            ]
          : pair(id);
    rows.push(caseRow(id, t, turns, docIdsFor?.(i)));
  });
  for (let i = 0; rows.length < 15; i++) {
    const id = `l2-fill-${String(i).padStart(3, '0')}`;
    rows.push(caseRow(id, 'budget', pair(id), docIdsFor?.(rows.length)));
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
      description: 'l2 evidence collection test gold',
      signoffEligible: false,
      cases: rows,
    }),
    'utf8',
  );
  return p;
}

function askResult(over: {
  status: 'answered' | 'abstained';
  docIds?: string[];
  citationCount?: number;
  answerKind?: 'knowledge' | 'chitchat';
  rewriteUsed?: boolean;
}): ExecuteAskResult {
  const evidence = (over.docIds ?? []).map((docId, i) => ({
    chunkId: `c${i}`,
    docId,
    text: `证据${i}`,
  }));
  const citations = Array.from({ length: over.citationCount ?? 0 }, (_, i) => ({
    chunkId: `c${i}`,
    docId: evidence[i]?.docId ?? UUID_A,
  }));
  const answer = over.status === 'answered' ? 'ok' : '';
  const reason = over.status === 'answered' ? 'verified' : 'low_retrieval';
  const graph: ExecuteAskResult['graph'] = {
    requestId: 'r',
    status: over.status,
    answer,
    ...(over.answerKind ? { answerKind: over.answerKind } : {}),
    citations,
    reason,
    userMessage: answer || '拒答',
    suggestedActions: [],
    mode: 'balanced',
    sessionId: null,
    rewriteUsed: over.rewriteUsed ?? false,
    sessionDeepened: false,
    evidence_snapshot: evidence,
  };
  return {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status: over.status,
      answer,
      ...(over.answerKind ? { answerKind: over.answerKind } : {}),
      citations,
      reason,
      userMessage: answer || '拒答',
      suggestedActions: [],
      latencyMs: 1,
      mode: 'balanced',
      sessionId: null,
    },
    graph,
  };
}

/** 只取采集面那几键（照 L2_EVIDENCE_ROW_KEYS 过滤），用于两侧同构断言 */
function evidenceKeysOf(row: object): string[] {
  return Object.keys(row).filter((k) => (L2_EVIDENCE_ROW_KEYS as readonly string[]).includes(k));
}

describe('runL2Golden 采集面（docId / citations / answerKind）', () => {
  it('末轮 evidence_snapshot[].docId 与 citations / answerKind 落进行与整批', async () => {
    const dir = tmpDir('l2-ev-');
    const goldPath = goldFile(
      [caseRow('l2-ev-hit', 'near_coref', pair('l2-ev-hit'), [UUID_A, LOGICAL_ID])],
      dir,
    );
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async () =>
        askResult({
          status: 'answered',
          docIds: [UUID_A],
          citationCount: 2,
          answerKind: 'knowledge',
        }),
    });

    const row = report.cases[0];
    expect(row?.expectedDocIds).toEqual([UUID_A, LOGICAL_ID]);
    expect(row?.evidenceDocIds).toEqual([UUID_A]);
    expect(row?.docHit).toBe(true);
    expect(row?.answerKind).toBe('knowledge');
    expect(row?.citationCount).toBe(2);
    expect(row?.citationOk).toBe(true);
    expect(row?.verdict).toBe('pass');
    expect(row?.failReasons).toEqual([]);

    expect(report.docHitHits).toBe(1);
    expect(report.docHitScored).toBe(1);
    expect(report.docHitRate).toBe(1);
    expect(report.citationComplete).toBe(1);
    expect(report.citationCompleteDen).toBe(1);

    // 行键集 = contracts 名单（下发齐全时 6 键俱在，顺序即名单顺序）
    expect(evidenceKeysOf(row ?? {})).toEqual([...L2_EVIDENCE_ROW_KEYS]);
    for (const key of L2_EVIDENCE_REPORT_KEYS) expect(report).toHaveProperty(key);
  });

  it('未映射（夹具逻辑 id vs KB uuid）→ 全 false、docHitRate 恒 0，且不把工程公式拉红', async () => {
    const dir = tmpDir('l2-ev-');
    const report = await runL2Golden({
      goldPath: defaultL2GoldPath(),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      execute: async () =>
        askResult({
          status: 'answered',
          docIds: [UUID_A],
          citationCount: 1,
          answerKind: 'knowledge',
          rewriteUsed: true,
        }),
    });

    const scored = report.cases.filter((c) => (c.expectedDocIds ?? []).length > 0);
    expect(scored.length).toBeGreaterThan(0);
    expect(scored.every((c) => c.docHit === false)).toBe(true);
    expect(report.docHitHits).toBe(0);
    expect(report.docHitScored).toBe(scored.length);
    expect(report.docHitRate).toBe(0);
    // 恒 0 是今天的正确取值：既不抛错，也不进判定（PRD §6.2 没有「命中期望文档」这道门）
    expect(report.caseCount).toBeGreaterThanOrEqual(15);
    expect(report.signoffEligible).toBe(true);
  });

  it('无标注题 → docHit null 且不计分（不 fail-open、也不拉低率）', async () => {
    const dir = tmpDir('l2-ev-');
    const goldPath = goldFile(
      [
        caseRow('l2-ev-a', 'near_coref', pair('l2-ev-a'), [UUID_A]),
        caseRow('l2-ev-b', 'near_coref', pair('l2-ev-b')),
      ],
      dir,
    );
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async () => askResult({ status: 'answered', docIds: [UUID_A] }),
    });

    expect(report.cases.map((c) => c.docHit)).toEqual([true, null]);
    expect(report.docHitScored).toBe(1);
    expect(report.docHitRate).toBe(1);
    expect(report.cases.every((c) => c.verdict === 'pass')).toBe(true);
  });

  it('docHitRate 分母 0（全题无标注）→ null，不放行也不当 0', async () => {
    const dir = tmpDir('l2-ev-');
    const goldPath = goldFile(goldRows(), dir);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async () => askResult({ status: 'answered', docIds: [UUID_A] }),
    });

    expect(report.docHitScored).toBe(0);
    expect(report.docHitHits).toBe(0);
    expect(report.docHitRate).toBeNull();
  });

  it('error 题按「未命中」计（与 L1 批跑同款），无名单题仍不计分', async () => {
    const dir = tmpDir('l2-ev-');
    const goldPath = goldFile(
      [
        caseRow('l2-ev-err', 'near_coref', pair('l2-ev-err'), [UUID_A]),
        caseRow('l2-ev-err2', 'near_coref', pair('l2-ev-err2')),
      ],
      dir,
    );
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async (params: ExecuteAskParams) => {
        if (params.body.question.includes('l2-ev-err-1')) throw new Error('gateway down');
        return askResult({ status: 'answered', docIds: [UUID_A] });
      },
    });

    expect(report.errorCount).toBe(1);
    expect(report.cases[0]?.docHit).toBe(false);
    expect(report.cases[0]?.citationOk).toBeNull();
    expect(report.docHitScored).toBe(1);
    expect(report.docHitRate).toBe(0);
  });
});

describe('runL2Golden 合法 citation 三态', () => {
  it('未下发（无 answerKind）→ citationOk null 且不进分母；knowledge ∧ 0 引用 → false 但判词不变', async () => {
    const dir = tmpDir('l2-ev-');
    const goldPath = goldFile(
      [
        caseRow('l2-ev-k', 'near_coref', pair('l2-ev-k')),
        caseRow('l2-ev-no-kind', 'near_coref', pair('l2-ev-no-kind')),
        caseRow('l2-ev-abstain', 'near_coref', pair('l2-ev-abstain'), undefined, ['abstained']),
      ],
      dir,
    );
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async (params: ExecuteAskParams) => {
        const q = params.body.question;
        if (q.includes('l2-ev-abstain')) {
          return askResult({ status: 'abstained', citationCount: 0 });
        }
        if (q.includes('l2-ev-no-kind')) {
          // 下发面缺 answerKind：不得冒充 knowledge（也不得当成无引用拉红）
          return { ...askResult({ status: 'answered', docIds: [UUID_A], citationCount: 0 }) };
        }
        return askResult({
          status: 'answered',
          docIds: [UUID_A],
          citationCount: 0,
          answerKind: 'knowledge',
        });
      },
    });

    const [k, noKind, abstain] = report.cases;
    expect(k?.citationOk).toBe(false);
    expect(noKind?.citationOk).toBeNull();
    expect(abstain?.citationOk).toBeNull();
    // 未下发 → 键缺省（不是 null / 不是 0）
    expect('answerKind' in (noKind ?? {})).toBe(false);
    expect(evidenceKeysOf(noKind ?? {})).toEqual([
      'expectedDocIds',
      'evidenceDocIds',
      'docHit',
      'citationCount',
      'citationOk',
    ]);
    // 判词逐位不变：citationOk === false 不进 failReasons
    expect(report.cases.every((c) => c.failReasons.length === 0)).toBe(true);
    expect(report.cases.every((c) => c.verdict === 'pass')).toBe(true);
    // 分母只取 knowledge ∧ answered
    expect(report.citationCompleteDen).toBe(1);
    expect(report.citationComplete).toBe(0);
  });

  it('分母 0（全拒答 / 全 error）→ 率 null，不得写成 0', async () => {
    const dir = tmpDir('l2-ev-');
    const goldPath = goldFile([caseRow('l2-ev-ab', 'near_coref', pair('l2-ev-ab'))], dir);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async () => askResult({ status: 'abstained' }),
    });

    expect(report.citationCompleteDen).toBe(0);
    expect(report.citationComplete).toBeNull();
  });
});

describe('formatL2ReportMd 渲染新采集面', () => {
  it('md 渲染 docHitRate（写明「未映射时恒 0，不得当成绩」）与 citationComplete', async () => {
    const dir = tmpDir('l2-ev-');
    const goldPath = goldFile(
      [caseRow('l2-ev-md', 'near_coref', pair('l2-ev-md'), [LOGICAL_ID])],
      dir,
    );
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async () =>
        askResult({
          status: 'answered',
          docIds: [UUID_A],
          citationCount: 0,
          answerKind: 'knowledge',
        }),
    });
    expect(report.docHitRate).toBe(0);

    const md = readFileSync(path.join(dir, 'out', 'l2-last-run.md'), 'utf8');
    expect(md).toContain('docHitRate');
    expect(md).toContain('未映射时恒 0，不得当成绩');
    expect(md).toContain('citationComplete');
    expect(md).toMatch(/\| docHitRate \| 0 \(0\/1\)/);
    // cases 表带行级两列
    expect(md).toContain('| docHit | citationOk |');
  });
});
