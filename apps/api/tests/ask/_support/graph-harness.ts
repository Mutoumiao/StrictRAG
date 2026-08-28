/** runAskGraph 测例共享工厂；非测例。 */
import { runAskGraph, type GraphChat, type GraphDeps } from '../../../src/graph/run.js';
import type { AskGraphInput } from '../../../src/graph/state.js';

export { GatewayError } from '../../../src/services/gateway/index.js';
export { budgetForMode, tryChargeLlm, tryChargeRetrieve } from '../../../src/graph/budget.js';
export { ruleRoute } from '../../../src/graph/route-rules.js';
export { parseRewriteOutput } from '../../../src/graph/parse.js';
export { runAskGraph };
export type { AskGraphInput, GraphChat, GraphDeps };

export const CHUNK = '11111111-1111-7111-8111-111111111111';
export const DOC = '22222222-2222-7222-8222-222222222222';
export const SID = '33333333-3333-7333-8333-333333333333';
export const SID_B = '44444444-4444-7444-8444-444444444444';
export const STANDALONE = '差旅餐补标准是什么？';
export const HIST_A = 'A会话里的餐补机密原文XYZ';

export const baseInput = (over: Partial<AskGraphInput> = {}): AskGraphInput => ({
  requestId: 'req-1',
  question: '年假有多少天？',
  tenantId: 'tenant-1',
  kbId: 'kb-1',
  membership: 'member',
  tauClaim: 0.5,
  mode: 'balanced',
  ...over,
});

export const evidenceOk = [
  {
    chunkId: CHUNK,
    docId: DOC,
    title: '休假制度',
    text: '员工年假为15天，须提前申请。',
    preview: '员工年假为15天',
    lifecycle: 'active',
    score: 0.9,
  },
];

export function scriptedChat(map: Partial<Record<string, string | (() => string)>>): GraphChat {
  return async (purpose) => {
    const v = map[purpose];
    if (typeof v === 'function') return v();
    if (typeof v === 'string') return v;
    throw new Error(`unexpected purpose ${purpose}`);
  };
}

export function deps(over: Partial<GraphDeps> & { chat: GraphChat }): GraphDeps {
  return {
    retrieve: async () => ({
      ok: true,
      evidence: evidenceOk,
      meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
    }),
    ...over,
  };
}

export const happyChat = scriptedChat({
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

export const rewriteHappyChat = scriptedChat({
  rewrite: JSON.stringify({ standalone: STANDALONE, resolved: true }),
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
