/**
 * 目标：合法 draft 必须完整 verify；拆句失败或网关错不得 answered。
 * 需求：P0 R9 · prds/08-quality
 * 被测：runAskGraph（verify / claim_split）
 * 简介：happy 必经 generate+claim_split+judge；拆句失败或网关错不得 answered。
 */
import { describe, expect, it } from 'vitest';

import {
  baseInput,
  CHUNK,
  deps,
  GatewayError,
  happyChat,
  runAskGraph,
  scriptedChat,
} from './_support/graph-harness.js';

describe('runAskGraph M3 verify+min+budget', () => {
  it('R9: in-kb happy path → answered verified（必经 verify）', async () => {
    const r = await runAskGraph(baseInput(), deps({ chat: happyChat }));
    expect(r.status).toBe('answered');
    expect(r.reason).toBe('verified');
    expect(r.answer).toContain('15');
    expect(r.citations[0]?.chunkId).toBe(CHUNK);
    expect(r.minSupport).toBeGreaterThanOrEqual(0.5);
    // 合法 draft 必走 generate + claim_split + judge（3 次 LLM），禁止跳过 verify
    expect(r.debug?.llmCalls).toBe(3);
  });

  it('R9: claim_split parse fail → 未完整 verify 不得 answered', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假为15天。',
            citations: [CHUNK],
            insufficient: false,
          }),
          claim_split: 'not-json-at-all',
        }),
      }),
    );
    expect(r.status).not.toBe('answered');
    expect(r).toMatchObject({ status: 'abstained', reason: 'claim_split_failed' });
  });

  it('claim_split gateway error → claim_split_failed', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: async (purpose) => {
          if (purpose === 'generate') {
            return JSON.stringify({
              answer: '年假为15天。',
              citations: [CHUNK],
              insufficient: false,
            });
          }
          throw new GatewayError('timeout', 'split down', 'chat');
        },
      }),
    );
    expect(r.reason).toBe('claim_split_failed');
  });
});
