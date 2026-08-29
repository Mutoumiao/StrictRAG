/**
 * 目标：worker 调 api 内口必须带口令；失败不得假装 answered。
 * 需求：prds/06-async eval.run
 * 被测：createEvalHttpExecute
 * 简介：mock fetch；空 token 记 error。
 */

import { describe, expect, it } from 'vitest';

import { createEvalHttpExecute, createEvalHttpL2Execute } from '../../src/eval/execute-ask-http.js';

describe('createEvalHttpExecute', () => {
  it('空 token 不发请求', async () => {
    const fetchImpl = (async () => {
      throw new Error('should not fetch');
    }) as typeof fetch;
    const execute = createEvalHttpExecute({
      baseUrl: 'http://127.0.0.1:4000',
      token: '',
      kbId: '01900000-0000-7000-8000-0000000000aa',
      tenantId: '01900000-0000-7000-8000-000000000001',
      userId: '01900000-0000-7000-8000-0000000000e1',
      fetchImpl,
    });
    const r = await execute({ caseKey: 'g1', question: 'q' });
    expect(r.outcome).toBe('error');
  });

  it('200 abstained 映射 outcome', async () => {
    const execute = createEvalHttpExecute({
      baseUrl: 'http://api.test',
      token: 'tok',
      kbId: '01900000-0000-7000-8000-0000000000aa',
      tenantId: '01900000-0000-7000-8000-000000000001',
      userId: '01900000-0000-7000-8000-0000000000e1',
      fetchImpl: (async () =>
        new Response(JSON.stringify({ ok: true, data: { status: 'abstained', reason: 'low_retrieval' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })) as typeof fetch,
    });
    const r = await execute({ caseKey: 'g1', question: 'q' });
    expect(r).toEqual({ outcome: 'abstained', reason: 'low_retrieval' });
  });

  it('L2 执行器带 sessionId 与窗', async () => {
    let body: unknown;
    const execute = createEvalHttpL2Execute({
      baseUrl: 'http://api.test',
      token: 'tok',
      kbId: '01900000-0000-7000-8000-0000000000aa',
      tenantId: '01900000-0000-7000-8000-000000000001',
      userId: '01900000-0000-7000-8000-0000000000e1',
      fetchImpl: (async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              status: 'answered',
              reason: 'verified',
              rewriteUsed: false,
              evidenceTexts: ['条款'],
              answer: '按制度',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as typeof fetch,
    });
    const r = await execute({
      question: '那餐补呢',
      sessionId: '01900000-0000-7000-8000-0000000000cc',
      sessionWindow: [{ role: 'user', content: '住宿？' }],
    });
    expect(r.outcome).toBe('answered');
    expect(body).toMatchObject({
      question: '那餐补呢',
      sessionId: '01900000-0000-7000-8000-0000000000cc',
    });
  });
});
