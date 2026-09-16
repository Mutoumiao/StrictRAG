/**
 * 目标：断线重拉终态 DTO 必须二态可辨（ready=false 不带 response），且 running 状态可带出本轮 requestId。
 * 需求：功能表 §3 流式回答「断线可按 requestId 重拉终态」· prds/05-api §2.7 契约铁律 5
 * 被测：AskFinalResponseSchema · AskSseStatusSchema
 * 简介：ready=true 才允许 response；ready=false 必须带 message 且不得夹带 response/审计字段。
 */

import { describe, expect, it } from 'vitest';

import {
  AskFinalResponseSchema,
  AskSseStatusSchema,
} from '../../src/ask/ask.contract.js';

const CHUNK = '018f0000-0000-7000-8000-000000000001';
const DOC = '018f0000-0000-7000-8000-000000000002';

function answeredResponse() {
  return {
    requestId: 'req-final-1',
    status: 'answered',
    answer: '年假为15天。',
    answerKind: 'knowledge',
    citations: [{ chunkId: CHUNK, docId: DOC, title: '休假' }],
    minSupport: 0.9,
    reason: 'verified',
    userMessage: '年假为15天。',
    suggestedActions: [{ type: 'view_citations', label: '查看引用' }],
    latencyMs: 12,
    mode: 'balanced',
    sessionId: null,
  };
}

describe('AskFinalResponseSchema', () => {
  it('ready=true 携带与在线同形的 AskResponse', () => {
    const r = AskFinalResponseSchema.safeParse({
      requestId: 'req-final-1',
      ready: true,
      response: answeredResponse(),
    });
    expect(r.success).toBe(true);
  });

  it('ready=true 缺 response 必须失败（不得只回一个空壳）', () => {
    expect(
      AskFinalResponseSchema.safeParse({ requestId: 'req-final-1', ready: true }).success,
    ).toBe(false);
  });

  it('ready=false 带 message，且拒绝夹带 response / 审计字段', () => {
    const ok = AskFinalResponseSchema.safeParse({
      requestId: 'req-final-1',
      ready: false,
      message: '该轮引用未落库（早于引用落库的历史轮次），暂无法回读终态',
    });
    expect(ok.success).toBe(true);

    expect(
      AskFinalResponseSchema.safeParse({
        requestId: 'req-final-1',
        ready: false,
        message: '未就绪',
        response: answeredResponse(),
      }).success,
    ).toBe(false);

    expect(
      AskFinalResponseSchema.safeParse({
        requestId: 'req-final-1',
        ready: false,
        message: '未就绪',
        evidenceSnapshot: [],
      }).success,
    ).toBe(false);
  });

  it('ready=false 缺 message 必须失败（不得只回一个 false）', () => {
    expect(
      AskFinalResponseSchema.safeParse({ requestId: 'req-final-1', ready: false }).success,
    ).toBe(false);
  });
});

describe('AskSseStatusSchema', () => {
  it('running part 可带本轮 requestId', () => {
    const r = AskSseStatusSchema.safeParse({ phase: 'running', requestId: 'req-final-1' });
    expect(r.success).toBe(true);
    if (!r.success) throw new Error('unreachable');
    expect(r.data.requestId).toBe('req-final-1');
  });

  it('不带 requestId 仍然合法（旧客户端 / 其它 phase）', () => {
    expect(AskSseStatusSchema.safeParse({ phase: 'finalize', status: 'answered' }).success).toBe(
      true,
    );
  });
});
