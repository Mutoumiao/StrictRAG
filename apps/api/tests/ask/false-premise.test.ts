/**
 * 目标：库外「假前提」问句必须拒答，不得被当成寒暄 answered，也不得拿不对题证据硬答。
 * 需求：剧本 D3 · P2必签 · prds/08-quality
 * 被测：runAskGraph（route + retrieve + generate 拒答边）· ruleRoute
 * 简介：假前提无证据 → low_retrieval 拒答；仅有不对题邻居证据 → model_abstained 拒答，均非 chitchat。
 */

import { describe, expect, it } from 'vitest';

import {
  baseInput,
  CHUNK,
  deps,
  evidenceOk,
  happyChat,
  ruleRoute,
  runAskGraph,
  scriptedChat,
} from './_support/graph-harness.js';

/** 库外假前提：条号与「星际差旅」都不在知识库语料内 */
const FALSE_PREMISE = '《2024 星际差旅补贴条例》第 7 条规定的月度补贴是多少？';

describe('库外假前提（D3）', () => {
  it('假前提问句走 single 而非 chitchat', () => {
    expect(ruleRoute(FALSE_PREMISE).routeLabel).toBe('single');
    expect(ruleRoute(FALSE_PREMISE).routeLabel).not.toBe('chitchat');
  });

  it('假前提无库内证据 → abstained low_retrieval（不检索反而答）', async () => {
    let retrieved = false;
    const r = await runAskGraph(
      baseInput({ question: FALSE_PREMISE }),
      deps({
        chat: happyChat,
        retrieve: async () => {
          retrieved = true;
          return { ok: false, reason: 'low_retrieval' };
        },
      }),
    );

    expect(retrieved).toBe(true);
    expect(r.status).toBe('abstained');
    expect(r.reason).toBe('low_retrieval');
    expect(r.answer).toBe('');
    expect(r.answerKind).not.toBe('chitchat');
    expect(r.answerKind).not.toBe('knowledge');
    expect(r.citations).toEqual([]);
    expect(r.suggestedActions.length).toBeGreaterThan(0);
  });

  it('仅有不对题邻居证据 → generate 判 insufficient → abstained model_abstained', async () => {
    const r = await runAskGraph(
      baseInput({ question: FALSE_PREMISE }),
      deps({
        retrieve: async () => ({
          ok: true,
          evidence: evidenceOk,
          meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
        }),
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '库内没有该条例，无法回答。',
            citations: [CHUNK],
            insufficient: true,
          }),
        }),
      }),
    );

    expect(r.status).toBe('abstained');
    expect(r.reason).toBe('model_abstained');
    expect(r.answer).toBe('');
    expect(r.answerKind).not.toBe('knowledge');
    expect(r.citations).toEqual([]);
  });
});
