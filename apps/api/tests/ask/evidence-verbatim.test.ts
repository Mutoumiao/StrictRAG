/**
 * 目标：当轮 evidence.text 进入 generate/verify 与 citation 必须逐字一致，不得改写。
 * 需求：剧本 K4 · prds/10-delivery/03-acceptance-scenarios.md · ADR-037
 * 被测：runAskGraph（generateUserPrompt / claim_split / citation.preview）
 * 简介：现权威为 evidence.text / PG body，≠ Mongo。chat generate 与 claim_split 的 user 消息含原文，citation 不改写。
 */

import { describe, expect, it } from 'vitest';

import {
  baseInput,
  CHUNK,
  DOC,
  deps,
  runAskGraph,
  scriptedChat,
  type GraphChat,
} from './_support/graph-harness.js';

const VERBATIM = '员工年假为15天，工号A1001须提前申请。';

const evidence = [
  {
    chunkId: CHUNK,
    docId: DOC,
    title: '休假制度',
    text: VERBATIM,
    preview: VERBATIM,
    lifecycle: 'active',
    score: 0.9,
  },
];

function capturingChat(
  sink: Partial<Record<string, string>>,
): GraphChat {
  const inner = scriptedChat({
    generate: JSON.stringify({
      answer: '年假为15天。',
      citations: [CHUNK],
      insufficient: false,
    }),
    claim_split: JSON.stringify({
      claims: [{ text: '年假为15天', chunkIds: [CHUNK] }],
    }),
    judge: JSON.stringify({ scores: [0.9] }),
  });
  return async (purpose, messages) => {
    sink[purpose] = messages.find((m) => m.role === 'user')?.content ?? '';
    return inner(purpose, messages);
  };
}

describe('evidence verbatim on this-turn slice', () => {
  it('generate / claim_split / citation keep evidence.text unchanged', async () => {
    const seen: Partial<Record<string, string>> = {};
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: capturingChat(seen),
        retrieve: async () => ({
          ok: true,
          evidence,
          meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
        }),
      }),
    );
    expect(r.status).toBe('answered');
    expect(seen.generate).toContain(VERBATIM);
    expect(seen.claim_split).toContain(VERBATIM);
    expect(seen.judge).toContain(VERBATIM);
    expect(r.citations[0]?.chunkId).toBe(CHUNK);
    expect(r.citations[0]?.preview).toBe(VERBATIM);
    expect(r.evidence_snapshot[0]?.text).toBe(VERBATIM);
  });
});
