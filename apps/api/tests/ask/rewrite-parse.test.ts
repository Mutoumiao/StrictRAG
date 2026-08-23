/**
 * 目标：改写输出必须是合法独立问句；resolved=false / 非法 JSON / 空白须抛错。
 * 需求：prds/04-pipelines rewrite
 * 被测：parseRewriteOutput
 * 简介：standalone 合法才通过；resolved=false、非法 JSON、空白 standalone 抛错。
 */
import { describe, expect, it } from 'vitest';

import { parseRewriteOutput, STANDALONE } from './_support/graph-harness.js';

describe('parseRewriteOutput', () => {
  it('success', () => {
    expect(parseRewriteOutput(JSON.stringify({ standalone: STANDALONE, resolved: true }))).toEqual({
      standalone: STANDALONE,
    });
  });
  it('resolved=false throws', () => {
    expect(() => parseRewriteOutput(JSON.stringify({ standalone: 'x', resolved: false }))).toThrow();
  });
  it('illegal JSON throws', () => {
    expect(() => parseRewriteOutput('not-json')).toThrow();
  });
  it('blank standalone throws', () => {
    expect(() => parseRewriteOutput(JSON.stringify({ standalone: '  ', resolved: true }))).toThrow();
  });
});
