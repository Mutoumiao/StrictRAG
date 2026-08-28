/**
 * 目标：档位检索预算必须由服务端按 mode 注入，客户端不得透传 retrieveK / rerankTopN。
 * 需求：功能表 §5.4 · ADR-032 · prds/04-pipelines
 * 被测：retrieveBudgetForMode · runAskGraph 档位传参
 * 简介：fast 60/10；balanced/strict 150/20。仅服务端。
 */

import { describe, expect, it } from 'vitest';

import { retrieveBudgetForMode } from '../../src/graph/budget.js';
import {
  baseInput,
  evidenceOk,
  runAskGraph,
  scriptedChat,
} from './_support/graph-harness.js';

describe('retrieveBudgetForMode', () => {
  it('fast 60/10，balanced/strict 150/20', () => {
    expect(retrieveBudgetForMode('fast')).toEqual({ retrieveK: 60, rerankTopN: 10 });
    expect(retrieveBudgetForMode('balanced')).toEqual({ retrieveK: 150, rerankTopN: 20 });
    expect(retrieveBudgetForMode('strict')).toEqual({ retrieveK: 150, rerankTopN: 20 });
  });
});

describe('runAskGraph 档位 retrieve 预算', () => {
  it('fast 模式把 60/10 传给 retrieve', async () => {
    let seen: { retrieveK?: number; rerankTopN?: number } | undefined;
    const r = await runAskGraph(baseInput({ mode: 'fast' }), {
      chat: scriptedChat({
        generate: JSON.stringify({ answer: '年假为15天。', citations: [evidenceOk[0]!.chunkId], insufficient: false }),
        claim_split: JSON.stringify({ claims: [{ text: '年假为15天', chunkIds: [evidenceOk[0]!.chunkId] }] }),
        judge: JSON.stringify({ scores: [0.9] }),
      }),
      retrieve: async (input) => {
        seen = { retrieveK: input.retrieveK, rerankTopN: input.rerankTopN };
        return {
          ok: true,
          evidence: evidenceOk,
          meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
        };
      },
    });
    expect(r.status).toBe('answered');
    expect(seen).toEqual({ retrieveK: 60, rerankTopN: 10 });
  });
});
