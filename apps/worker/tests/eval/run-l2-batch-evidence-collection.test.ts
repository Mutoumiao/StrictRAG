/**
 * 目标：worker L2 批跑必须与 api CLI 同构地落 evidence docId / 命中期望文档 / 合法 citation，落库白名单不得静默丢新键。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 · 裁定 02（一、采集面）与工单 03
 * 被测：runL2Batch · createEvalHttpL2Execute · evalPersist.saveL2Report（reportJson 白名单）
 * 简介：注入 executeTurn 与假 fetch；docHit 复用 hitAtKCase 口径（未映射恒 0，不进判定）；
 *       citationOk 三态不判词；白名单逐键保留新采集面，键集与 api 共用一个 contracts 锚点。
 */

import { describe, expect, it, vi } from 'vitest';

import {
  L2_EVIDENCE_REPORT_KEYS,
  L2_EVIDENCE_ROW_KEYS,
  L2_TYPES,
  type L2Case,
  type L2Type,
} from '@strict-rag/contracts';

/** saveL2Report 写入的 set 载荷（不连真 PG） */
const captured: { values?: Record<string, unknown> } = {};

vi.mock('../../src/env.js', () => ({ env: { EVAL_L2_GOLD_PATH: '' } }));
vi.mock('../../src/db.js', () => ({
  getDb: () => ({
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          captured.values = values;
        },
      }),
    }),
  }),
}));

const { runL2Batch } = await import('../../src/eval/run-l2-batch.js');
const { createEvalHttpL2Execute } = await import('../../src/eval/execute-ask-http.js');
const { evalPersist } = await import('../../src/eval/persist.js');

const UUID_A = '01900000-0000-7000-8000-0000000000a1';
const UUID_B = '01900000-0000-7000-8000-0000000000b1';
const LOGICAL_ID = 'l2-corpus/travel-stay';

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

/** 九类必含 + 补齐到 15 题（工程公式的规模门） */
function casesFor(docIds: string[]): L2Case[] {
  const cases = L2_TYPES.map((type, i) =>
    l2Case(`l2-t-${String(i).padStart(3, '0')}`, type, docIds),
  );
  let fill = 0;
  while (cases.length < 15) {
    cases.push(l2Case(`l2-f-${String(fill++).padStart(3, '0')}`, 'budget', docIds));
  }
  return cases;
}

const okTurn = (extra?: Partial<{ answerKind: 'knowledge' | 'chitchat'; citationCount: number }>) => ({
  outcome: 'answered' as const,
  rewriteUsed: false,
  evidenceTexts: ['条款'],
  evidenceDocIds: [UUID_A],
  answer: 'ok',
  ...extra,
});

/** 只取采集面那几键（照 L2_EVIDENCE_ROW_KEYS 过滤），用于两侧同构断言 */
function evidenceKeysOf(row: object): string[] {
  return Object.keys(row).filter((k) => (L2_EVIDENCE_ROW_KEYS as readonly string[]).includes(k));
}

function fakeFetch(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
}

function httpL2Execute(payload: unknown) {
  return createEvalHttpL2Execute({
    baseUrl: 'http://api.test',
    token: 'tok',
    kbId: '01900000-0000-7000-8000-0000000000aa',
    tenantId: '01900000-0000-7000-8000-000000000001',
    userId: '01900000-0000-7000-8000-0000000000e1',
    fetchImpl: fakeFetch(payload),
  });
}

describe('createEvalHttpL2Execute 采集面', () => {
  it('回包 evidenceDocIds / citationCount / answerKind 原样带回，且不读 minSupport', async () => {
    const r = await httpL2Execute({
      ok: true,
      data: {
        status: 'answered',
        reason: 'verified',
        rewriteUsed: false,
        evidenceTexts: ['条款'],
        evidenceDocIds: ['doc-a', 'doc-b'],
        answerKind: 'knowledge',
        citationCount: 2,
        minSupport: 0.9,
      },
    })({ question: '那餐补呢', sessionWindow: [] });

    expect(r).toEqual({
      outcome: 'answered',
      reason: 'verified',
      rewriteUsed: false,
      evidenceTexts: ['条款'],
      evidenceDocIds: ['doc-a', 'doc-b'],
      answer: '',
      answerKind: 'knowledge',
      citationCount: 2,
    });
    // 裁定 4：L2 不采集 minSupport（采它会把不可判的假象带进报告）
    expect(r).not.toHaveProperty('minSupport');
  });

  it('回包未下发 answerKind / citationCount → 键缺省（不冒充 knowledge，也不算无引用）', async () => {
    const r = await httpL2Execute({
      ok: true,
      data: { status: 'abstained', reason: 'low_retrieval' },
    })({ question: 'q', sessionWindow: [] });

    expect(r).toEqual({
      outcome: 'abstained',
      reason: 'low_retrieval',
      rewriteUsed: false,
      evidenceTexts: [],
      evidenceDocIds: [],
      answer: '',
    });
    expect('answerKind' in r).toBe(false);
    expect('citationCount' in r).toBe(false);
  });
});

describe('runL2Batch 采集面', () => {
  it('落 evidenceDocIds / docHit（复用 hitAtKCase 口径）与整批率', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [
        l2Case('l2-ev-hit', 'near_coref', [UUID_A, LOGICAL_ID]),
        l2Case('l2-ev-miss', 'near_coref', [UUID_B]),
        l2Case('l2-ev-none', 'near_coref'),
      ],
      executeTurn: async () => okTurn({ answerKind: 'knowledge', citationCount: 1 }),
    });

    expect(report.cases.map((c) => c.docHit)).toEqual([true, false, null]);
    expect(report.cases[0]?.evidenceDocIds).toEqual([UUID_A]);
    expect(report.docHitHits).toBe(1);
    expect(report.docHitScored).toBe(2);
    expect(report.docHitRate).toBe(0.5);
    expect(report.citationComplete).toBe(1);
    expect(report.citationCompleteDen).toBe(3);
    expect(report.cases.map((c) => c.citationOk)).toEqual([true, true, true]);
    expect(report.cases.every((c) => c.verdict === 'pass')).toBe(true);
  });

  it('未映射（夹具逻辑 id vs KB uuid）→ 全 false、率恒 0，且不把工程公式拉红', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: casesFor([LOGICAL_ID, 'l2-corpus/meal-allowance']),
      executeTurn: async () => okTurn({ answerKind: 'knowledge', citationCount: 1 }),
    });

    expect(report.docHitScored).toBe(15);
    expect(report.docHitHits).toBe(0);
    expect(report.docHitRate).toBe(0);
    expect(report.zeroToleranceHits).toBe(0);
    expect(report.signoffEligible).toBe(true);
  });

  it('citationOk 三态：未下发 → null；下发 ∧ 0 引用 → false 但判词不变', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [l2Case('l2-cited', 'near_coref'), l2Case('l2-null-kind', 'near_coref')],
      executeTurn: async ({ question }) =>
        question.includes('l2-null-kind')
          ? { outcome: 'answered', rewriteUsed: false, evidenceTexts: ['条款'], answer: 'ok' }
          : okTurn({ answerKind: 'knowledge', citationCount: 0 }),
    });

    expect(report.cases.map((c) => c.citationOk)).toEqual([false, null]);
    expect('answerKind' in (report.cases[1] ?? {})).toBe(false);
    // 未下发 → 键缺省（不是 null / 不是 0）
    expect(evidenceKeysOf(report.cases[1] ?? {})).toEqual([
      'expectedDocIds',
      'evidenceDocIds',
      'docHit',
      'citationOk',
    ]);
    // 判词逐位不变：citationOk === false 不进 failReasons
    expect(report.cases.every((c) => c.failReasons.length === 0)).toBe(true);
    expect(report.cases.every((c) => c.verdict === 'pass')).toBe(true);
    expect(report.citationCompleteDen).toBe(1);
    expect(report.citationComplete).toBe(0);
  });

  it('分母 0（回包无 answerKind）→ 引用完整率 null，不得写成 0', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [l2Case('l2-no-face', 'near_coref')],
      executeTurn: async () => ({
        outcome: 'answered',
        rewriteUsed: false,
        evidenceTexts: ['条款'],
        answer: 'ok',
      }),
    });

    expect(report.citationCompleteDen).toBe(0);
    expect(report.citationComplete).toBeNull();
    expect(report.cases[0]?.citationOk).toBeNull();
  });
});

describe('两侧同构 · 键集 = contracts 名单', () => {
  it('报告 5 键与行 6 键逐字等于 api 侧同一锚点', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [l2Case('l2-key-1', 'near_coref', [UUID_A])],
      executeTurn: async () => okTurn({ answerKind: 'knowledge', citationCount: 1 }),
    });

    for (const key of L2_EVIDENCE_REPORT_KEYS) expect(report).toHaveProperty(key);
    expect(evidenceKeysOf(report.cases[0] ?? {})).toEqual([...L2_EVIDENCE_ROW_KEYS]);
  });
});

describe('saveL2Report · reportJson 白名单不得静默丢新键', () => {
  it('落库 JSON 保留新采集面字段与行键，报告上的每个键都在白名单里', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [l2Case('l2-persist-1', 'near_coref', [UUID_A])],
      executeTurn: async () => okTurn({ answerKind: 'knowledge', citationCount: 1 }),
    });
    captured.values = undefined;

    await evalPersist.saveL2Report('01900000-0000-7000-8000-0000000000aa', report);

    const reportJson = captured.values?.reportJson as Record<string, unknown> | undefined;
    expect(reportJson).toBeDefined();
    for (const key of L2_EVIDENCE_REPORT_KEYS) {
      expect(reportJson).toHaveProperty(key);
      expect(reportJson?.[key]).toEqual(report[key]);
    }
    const cases = reportJson?.cases as Array<Record<string, unknown>> | undefined;
    expect(evidenceKeysOf(cases?.[0] ?? {})).toEqual([...L2_EVIDENCE_ROW_KEYS]);

    // 逐键白名单漏一个键 → 该键在库内静默消失；本断言钉住「报告有的，库内也能看到」
    const missing = Object.keys(report).filter(
      (key) => key !== 'retrieveMode' && !(key in (reportJson ?? {})),
    );
    expect(missing).toEqual([]);
  });
});
