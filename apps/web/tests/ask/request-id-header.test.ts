/**
 * 目标：本轮请求号必须随 `x-request-id` 下发 —— 服务端据此把它当成本轮 requestId，断线重拉的前提。
 * 需求：prds/05-api §2.7 连接中断重拉 · 功能表 §3 流式回答
 * 被测：withRequestId · newAskRequestId
 * 简介：有号才加头发；不覆盖已有头；每轮新号非空且不重复。
 */

import { describe, expect, it } from 'vitest';

import { newAskRequestId, withRequestId } from '@/api/ask';

describe('withRequestId', () => {
  it('带请求号时加 x-request-id，并保留原头', () => {
    const headers = withRequestId({ authorization: 'Bearer t' }, 'req-1');
    expect(headers['x-request-id']).toBe('req-1');
    expect(headers.authorization).toBe('Bearer t');
  });

  it('无请求号时不下发该头（不得发空值）', () => {
    const headers = withRequestId({ authorization: 'Bearer t' }, undefined);
    expect('x-request-id' in headers).toBe(false);
    expect(withRequestId({}, '')).toEqual({});
  });
});

describe('newAskRequestId', () => {
  it('每次非空且不重复', () => {
    const a = newAskRequestId();
    const b = newAskRequestId();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
