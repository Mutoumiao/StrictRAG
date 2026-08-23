/**
 * 目标：executeAsk 落 trace 时历史文不得进入 evidence。
 * 需求：prds/05-api · 历史≠evidence
 * 被测：executeAsk
 * 简介：落库 trace 时只记录本轮 evidence，不把历史文写进快照。
 */

import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { executeAsk } from '../../src/services/ask/execute.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '22222222-2222-7222-8222-222222222222';

describe('executeAsk trace + graph wiring', () => {
  it('saves evidence_snapshot without session history text', async () => {
    const saved: { evidenceSnapshot: { preview?: string; chunkId: string }[]; rawQuestion: string }[] =
      [];
    const CHUNK_ID = CHUNK;
    const result = await executeAsk(
      {
        requestId: 'req-trace-1',
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId: uuidv7(),
        membership: 'member',
        body: {
          question: '年假有多少天？',
          sessionId: null,
          options: { mode: 'balanced' },
        },
      },
      {
        graphDeps: {
          chat: async (purpose) => {
            if (purpose === 'generate') {
              return JSON.stringify({
                answer: '年假为15天。',
                citations: [CHUNK_ID],
                insufficient: false,
              });
            }
            if (purpose === 'claim_split') {
              return JSON.stringify({
                claims: [{ text: '年假为15天', chunkIds: [CHUNK_ID] }],
              });
            }
            return JSON.stringify({ scores: [0.95] });
          },
          retrieve: async () => ({
            ok: true,
            evidence: [
              {
                chunkId: CHUNK_ID,
                docId: DOC,
                title: '休假',
                text: '员工年假为15天，须提前申请。',
                preview: '员工年假为15天',
                lifecycle: 'active',
                score: 0.9,
              },
            ],
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          }),
        },
        saveTrace: async (input) => {
          saved.push({
            evidenceSnapshot: input.evidenceSnapshot,
            rawQuestion: input.rawQuestion,
          });
          return { id: 't1' };
        },
      },
    );

    expect(result.httpStatus).toBe(200);
    expect(result.response.reason).toBe('verified');
    expect(saved).toHaveLength(1);
    expect(saved[0]!.rawQuestion).toBe('年假有多少天？');
    expect(saved[0]!.evidenceSnapshot[0]?.chunkId).toBe(CHUNK_ID);
    // 快照不含会话闲聊/历史
    const blob = JSON.stringify(saved[0]!.evidenceSnapshot);
    expect(blob).not.toMatch(/刚才|历史会话|session history/i);
  });

  it('带 sessionId 落 trace 时 rewriteUsed=false，历史文不进 evidence', async () => {
    const SID = '33333333-3333-7333-8333-333333333333';
    const HISTORY_LEAK = '上一轮会话里的 Vue 秘密答案';
    const saved: {
      sessionId?: string | null;
      evidenceSnapshot: unknown[];
      configSnap?: Record<string, unknown>;
      rewriteUsedField?: number;
    }[] = [];

    const result = await executeAsk(
      {
        requestId: 'req-sess-1',
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId: uuidv7(),
        membership: 'member',
        body: {
          question: '年假几天',
          sessionId: SID,
          options: { mode: 'balanced', debug: true },
        },
      },
      {
        graphDeps: {
          chat: async (purpose) => {
            if (purpose === 'generate') {
              return JSON.stringify({
                answer: '15天',
                citations: [CHUNK],
                insufficient: false,
              });
            }
            if (purpose === 'claim_split') {
              return JSON.stringify({ claims: [{ text: '15天', chunkIds: [CHUNK] }] });
            }
            return JSON.stringify({ scores: [0.95] });
          },
          retrieve: async () => ({
            ok: true,
            evidence: [
              {
                chunkId: CHUNK,
                docId: DOC,
                title: '休假',
                text: '员工年假为15天',
                preview: '15天',
                lifecycle: 'active',
                score: 0.9,
              },
            ],
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          }),
        },
        saveTrace: async (input) => {
          saved.push({
            sessionId: input.sessionId,
            evidenceSnapshot: input.evidenceSnapshot,
            configSnap: input.configSnap,
          });
          // 模拟「若错误地把历史塞进 evidence」的检测：保证我们没塞
          expect(JSON.stringify(input.evidenceSnapshot)).not.toContain(HISTORY_LEAK);
          return { id: 't2' };
        },
      },
    );

    expect(result.httpStatus).toBe(200);
    expect(result.response.sessionId).toBe(SID);
    expect(result.response.debug?.rewriteUsed).toBe(false);
    expect(saved[0]?.sessionId).toBe(SID);
    expect(saved[0]?.configSnap?.sessionRewriteEnabledDefault).toBe(false);
    // 历史原文不得出现在 evidence 或 citations
    const evidenceBlob = JSON.stringify(saved[0]?.evidenceSnapshot);
    expect(evidenceBlob).not.toContain(HISTORY_LEAK);
    expect(JSON.stringify(result.response.citations)).not.toContain(HISTORY_LEAK);
  });
});
