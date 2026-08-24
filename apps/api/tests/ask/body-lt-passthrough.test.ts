/**
 * 目标：制度正文中的 `<` 必须原样进入 generate，不得被 HTML escape 成 `&lt;`。
 * 需求：剧本 K6 · prds/10-delivery/03-acceptance-scenarios.md · ADR-037
 * 被测：runAskGraph（generate / claim_split user 消息）
 * 简介：evidence.text 含 `薪资<5000` / `a < b` 时 prompt 保留原字符。feedback 脚本消毒不在本包。
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

const BODY = '薪资<5000 不得申请高管津贴；比较式 a < b。';

const evidence = [
  {
    chunkId: CHUNK,
    docId: DOC,
    title: '薪酬制度',
    text: BODY,
    preview: BODY,
    lifecycle: 'active',
    score: 0.9,
  },
];

function capturingChat(sink: Partial<Record<string, string>>): GraphChat {
  const inner = scriptedChat({
    generate: JSON.stringify({
      answer: '低于阈值不得申请。',
      citations: [CHUNK],
      insufficient: false,
    }),
    claim_split: JSON.stringify({
      claims: [{ text: '低于阈值不得申请', chunkIds: [CHUNK] }],
    }),
    judge: JSON.stringify({ scores: [0.9] }),
  });
  return async (purpose, messages) => {
    sink[purpose] = messages.find((m) => m.role === 'user')?.content ?? '';
    return inner(purpose, messages);
  };
}

describe('policy body < passthrough', () => {
  it('generate prompt keeps raw < from evidence.text', async () => {
    const seen: Partial<Record<string, string>> = {};
    const r = await runAskGraph(
      baseInput({ question: '薪资低于五千能否申请高管津贴？' }),
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
    expect(seen.generate).toContain('薪资<5000');
    expect(seen.generate).toContain('a < b');
    expect(seen.generate).not.toContain('&lt;');
    expect(seen.claim_split).toContain('薪资<5000');
    expect(seen.claim_split).not.toContain('&lt;');
  });
});
