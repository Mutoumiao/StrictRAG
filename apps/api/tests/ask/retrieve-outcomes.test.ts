/**
 * 目标：检索阶段失败或闲聊短路时不得用假 evidence 洗成 answered。
 * 需求：prds/04-pipelines · prds/08-quality
 * 被测：runAskGraph（route+retrieve）
 * 简介：闲聊不检索；空证据/rerank/kb 未就绪须拒答，userId 透传到 retrieve。
 */
import { describe, expect, it } from 'vitest';

import { baseInput, deps, evidenceOk, happyChat, runAskGraph } from './_support/graph-harness.js';

describe('runAskGraph M1 route+retrieve', () => {
  it('chitchat answered without retrieve', async () => {
    let retrieved = false;
    const r = await runAskGraph(baseInput({ question: '你好' }), {
      chat: happyChat,
      retrieve: async () => {
        retrieved = true;
        return {
          ok: true,
          evidence: evidenceOk,
          meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
        };
      },
    });
    expect(retrieved).toBe(false);
    expect(r).toMatchObject({ status: 'answered', reason: 'chitchat', answerKind: 'chitchat' });
    expect(r.citations).toEqual([]);
  });

  it('retrieve 透传 userId（P3b-DEPT 缝）', async () => {
    let seen: string | undefined;
    const r = await runAskGraph(
      baseInput({ userId: 'u-dept' }),
      deps({
        chat: happyChat,
        retrieve: async (input) => {
          seen = input.userId;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
      }),
    );
    expect(r.status).toBe('answered');
    expect(seen).toBe('u-dept');
  });

  it('empty evidence → low_retrieval abstained', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        retrieve: async () => ({ ok: false, reason: 'low_retrieval' }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'low_retrieval' });
    expect(r.answer).toBe('');
  });

  it('rerank failure → rerank_unavailable, no answered', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        retrieve: async () => ({ ok: false, reason: 'rerank_unavailable' }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'rerank_unavailable' });
  });

  it('kb_not_ready path', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        retrieve: async () => ({ ok: false, reason: 'kb_not_ready' }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'kb_not_ready' });
  });
});
