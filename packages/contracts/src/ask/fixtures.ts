import type { AskResponse } from './ask.contract.js';

/** 合法 answered final（UUID 合法，便于 schema 校验）。 */
export function makeAnsweredFinal(overrides: Partial<AskResponse> = {}): AskResponse {
  return {
    requestId: 'req-test-1',
    status: 'answered',
    answer: '依据文档：答案正文',
    answerKind: 'knowledge',
    reason: 'verified',
    citations: [
      {
        chunkId: '018f0000-0000-7000-8000-000000000001',
        docId: '018f0000-0000-7000-8000-000000000002',
        title: '示例文档',
        preview: '片段预览',
      },
    ],
    suggestedActions: [],
    latencyMs: 120,
    ...overrides,
  };
}

/** 合法 abstained final。 */
export function makeAbstainedFinal(overrides: Partial<AskResponse> = {}): AskResponse {
  return {
    requestId: 'req-test-2',
    status: 'abstained',
    answer: '',
    reason: 'low_retrieval',
    userMessage: '证据不足，无法给出有依据的答案。',
    citations: [],
    suggestedActions: [{ type: 'rephrase', label: '换一种问法' }],
    ...overrides,
  };
}
