/**
 * 目标：终态回读必须与在线终态逐字段同形；不可同形时必须给 ready=false 而不是假 answered。
 * 需求：功能表 §3 流式回答「断线可按 requestId 重拉终态」· prds/05-api §2.7 契约铁律 5
 * 被测：toAskFinal
 * 简介：verified / 拒答轮重建结果与 executeAsk 在线响应深等；citations 未落库的通过轮、未知 status/reason、坏引用形状一律 ready=false。
 */

import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { executeAsk } from '../../src/services/ask/execute.js';
import { toAskFinal, type AskFinalSource, type SaveAskTraceInput } from '../../src/services/ask/index.js';

const TENANT = '01900000-0000-7000-8000-000000000001';
const KB = '01900000-0000-7000-8000-0000000000aa';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '22222222-2222-7222-8222-222222222222';

/** 把落库入参还原成一行 ask_traces（与路由默认 getFinal 的取值一致） */
function rowFromSaved(saved: SaveAskTraceInput): AskFinalSource {
  return {
    requestId: saved.requestId,
    kbId: saved.kbId,
    status: saved.status,
    reason: saved.reason,
    minSupport: saved.minSupport ?? null,
    latencyMs: saved.latencyMs ?? null,
    mode: saved.mode ?? null,
    sessionId: saved.sessionId ?? null,
    answer: saved.answer ?? null,
    citations: saved.citations ?? null,
  };
}

function verifiedDeps() {
  return {
    retrieve: async () => ({
      ok: true as const,
      evidence: [
        {
          chunkId: CHUNK,
          docId: DOC,
          title: '休假',
          text: '员工年假为15天。',
          preview: '员工年假为15天',
          lifecycle: 'active' as const,
          score: 0.9,
        },
      ],
      meta: { esMode: 'mock' as const, candidateCount: 1, denseHits: 1, sparseHits: 1 },
    }),
    chat: async (purpose: string) => {
      if (purpose === 'generate') {
        return JSON.stringify({ answer: '年假为15天。', citations: [CHUNK], insufficient: false });
      }
      if (purpose === 'claim_split') {
        return JSON.stringify({ claims: [{ text: '年假为15天', chunkIds: [CHUNK] }] });
      }
      return JSON.stringify({ scores: [0.95] });
    },
  };
}

describe('toAskFinal 终态重建', () => {
  it('verified 轮：重建结果与在线 AskResponse 深等（不是"近似"）', async () => {
    const saved: SaveAskTraceInput[] = [];
    const result = await executeAsk(
      {
        requestId: 'req-final-verified',
        kbId: KB,
        tenantId: TENANT,
        userId: uuidv7(),
        membership: 'member',
        body: { question: '年假有多少天？', sessionId: null, options: { mode: 'balanced' } },
      },
      { graphDeps: verifiedDeps(), saveTrace: async (input) => (saved.push(input), { id: 't1' }) },
    );
    expect(result.response.status).toBe('answered');
    expect(saved).toHaveLength(1);
    // 前置：该轮 citations 必须已随终态落库
    expect(saved[0]!.citations?.map((c) => c.chunkId)).toEqual([CHUNK]);

    const final = toAskFinal(rowFromSaved(saved[0]!));
    expect(final.ready).toBe(true);
    if (!final.ready) throw new Error('unreachable');
    expect(final.response).toEqual(result.response);
  });

  it('拒答轮（kb_not_ready）：重建结果与在线一致，且零引用', async () => {
    const saved: SaveAskTraceInput[] = [];
    const result = await executeAsk(
      {
        requestId: 'req-final-abstain',
        kbId: KB,
        tenantId: TENANT,
        userId: uuidv7(),
        membership: 'member',
        body: { question: '年假有多少天？', sessionId: null, options: { mode: 'balanced' } },
      },
      {
        graphDeps: {
          retrieve: async () => ({
            ok: false as const,
            reason: 'kb_not_ready' as const,
            message: 'no ready∧active documents in kb',
          }),
          chat: async () => {
            throw new Error('should not call llm when kb_not_ready');
          },
        },
        saveTrace: async (input) => (saved.push(input), { id: 't2' }),
      },
    );
    expect(result.response.status).toBe('abstained');
    // 拒答轮写 `[]`（不是 null）：与「未记录」区分
    expect(saved[0]!.citations).toEqual([]);

    const final = toAskFinal(rowFromSaved(saved[0]!));
    expect(final.ready).toBe(true);
    if (!final.ready) throw new Error('unreachable');
    expect(final.response).toEqual(result.response);
    expect(final.response.citations).toEqual([]);
  });

  it('通过轮 citations 未落库（迁移前旧文）→ ready=false，不得冒充 answered', () => {
    const final = toAskFinal({
      requestId: 'req-legacy',
      kbId: KB,
      status: 'answered',
      reason: 'verified',
      answer: '年假为15天。',
      citations: null,
      minSupport: 0.9,
      sessionId: null,
    });
    expect(final.ready).toBe(false);
    if (final.ready) throw new Error('unreachable');
    expect(final.message).toContain('引用未落库');
    expect(JSON.stringify(final)).not.toContain('年假为15天');
  });

  it('chitchat 与拒答旧轮：零引用可由 status/reason 推出，仍可回读', () => {
    const chitchat = toAskFinal({
      requestId: 'req-chitchat',
      kbId: KB,
      status: 'answered',
      reason: 'chitchat',
      answer: '我是企业知识库助手。',
      citations: null,
      sessionId: null,
    });
    expect(chitchat.ready).toBe(true);
    if (!chitchat.ready) throw new Error('unreachable');
    expect(chitchat.response.answerKind).toBe('chitchat');
    expect(chitchat.response.citations).toEqual([]);

    const legacyAbstain = toAskFinal({
      requestId: 'req-legacy-abstain',
      kbId: KB,
      status: 'abstained',
      reason: 'low_retrieval',
      answer: '',
      citations: null,
      sessionId: null,
    });
    expect(legacyAbstain.ready).toBe(true);
    if (!legacyAbstain.ready) throw new Error('unreachable');
    expect(legacyAbstain.response.userMessage).toBe('未找到足够相关资料。');
  });

  it('status 非终态 / reason 未知 / 引用形状坏 → 一律 ready=false', () => {
    const running = toAskFinal({
      requestId: 'req-running',
      kbId: KB,
      status: 'running',
      reason: 'verified',
      citations: [],
      sessionId: null,
    });
    expect(running.ready).toBe(false);

    const weirdReason = toAskFinal({
      requestId: 'req-weird',
      kbId: KB,
      status: 'answered',
      reason: 'not_a_reason',
      citations: [],
      sessionId: null,
    });
    expect(weirdReason.ready).toBe(false);

    const brokenCitation = toAskFinal({
      requestId: 'req-broken',
      kbId: KB,
      status: 'answered',
      reason: 'verified',
      answer: '年假为15天。',
      citations: [{ chunkId: 'not-a-uuid', docId: DOC }],
      sessionId: null,
    });
    expect(brokenCitation.ready).toBe(false);
  });
});
