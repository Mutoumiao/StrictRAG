/**
 * 目标：ask 请求的 scope 必须在顶层，不得进入 options。
 * 需求：ADR-050
 * 被测：buildAskRequestBody · parseScopeDocTypesInput
 * 简介：客户端 body 形状。
 */

import { describe, expect, it } from 'vitest';

import { buildAskRequestBody, parseScopeDocTypesInput } from '@/api/ask';

describe('parseScopeDocTypesInput', () => {
  it('空 / 仅空白 → undefined（不收窄）', () => {
    expect(parseScopeDocTypesInput('')).toBeUndefined();
    expect(parseScopeDocTypesInput('   ')).toBeUndefined();
    expect(parseScopeDocTypesInput(',，')).toBeUndefined();
  });

  it('逗号与中文逗号拆分，trim 去重', () => {
    expect(parseScopeDocTypesInput('hr, legal')).toEqual(['hr', 'legal']);
    expect(parseScopeDocTypesInput('hr，legal, hr')).toEqual(['hr', 'legal']);
    expect(parseScopeDocTypesInput('  it  ')).toEqual(['it']);
  });
});

describe('buildAskRequestBody', () => {
  it('无 scope / 空 docTypes → body 不含 scope', () => {
    const a = buildAskRequestBody({
      question: 'q',
      sessionId: null,
    });
    expect(a).toEqual({
      question: 'q',
      sessionId: null,
      options: { stream: true },
    });
    expect(a.options?.mode).toBeUndefined();
    expect(a.scope).toBeUndefined();

    const b = buildAskRequestBody({
      question: 'q',
      sessionId: 's1',
      scope: { docTypes: [] },
    });
    expect(b.scope).toBeUndefined();
    expect(b.sessionId).toBe('s1');
  });

  it('非空 docTypes → 顶层 scope（不进 options）', () => {
    const body = buildAskRequestBody({
      question: '工资政策',
      sessionId: null,
      scope: { docTypes: ['hr', 'legal'] },
    });
    expect(body.scope).toEqual({ docTypes: ['hr', 'legal'] });
    expect(body.options).toEqual({ stream: true });
    expect((body.options as { scope?: unknown }).scope).toBeUndefined();
  });

  it('与 parse 串联：输入串 → body.scope', () => {
    const docTypes = parseScopeDocTypesInput('hr, finance');
    const body = buildAskRequestBody({
      question: 'x',
      sessionId: null,
      scope: docTypes ? { docTypes } : undefined,
    });
    expect(body.scope?.docTypes).toEqual(['hr', 'finance']);
  });

  it('有 mode → options.mode，仍不进 scope', () => {
    const body = buildAskRequestBody({
      question: 'q',
      sessionId: null,
      mode: 'fast',
    });
    expect(body.options).toEqual({ stream: true, mode: 'fast' });
    expect(body.scope).toBeUndefined();
  });
});
