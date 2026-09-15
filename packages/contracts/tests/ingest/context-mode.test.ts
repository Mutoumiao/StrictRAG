/**
 * 目标：L0 模板必须用标题（有路径才拼接）；非法 contextMode 不得当已实现 L1。
 * 需求：prds/04-pipelines/01-offline-ingest.md §4 · 功能表 §4.5 / §6
 * 被测：parseContextMode · l0ContextPrefix · resolveContextSource · invalidContextModeOverride
 * 简介：本轮无 Gateway；l1_llm 只表示回退 L0。不是动态表单引擎。
 */

import { describe, expect, it } from 'vitest';

import {
  invalidContextModeOverride,
  l0ContextPrefix,
  parseContextMode,
  resolveContextSource,
} from '../../src/ingest/chunk-strategy.js';

describe('contextMode / L0 模板', () => {
  it('无小节路径只用标题，有路径才拼接', () => {
    expect(l0ContextPrefix('考勤制度')).toBe('考勤制度');
    expect(l0ContextPrefix(' 考勤制度 ', '  ')).toBe('考勤制度');
    expect(l0ContextPrefix('考勤制度', '3.2 请假')).toBe('考勤制度 / 3.2 请假');
    expect(l0ContextPrefix('考勤制度', 'section')).toBe('考勤制度 / section');
  });

  it('缺省与非法值按 l1_llm，显式 l0_template 保留', () => {
    expect(parseContextMode(undefined)).toBe('l1_llm');
    expect(parseContextMode('nope')).toBe('l1_llm');
    expect(parseContextMode('l0_template')).toBe('l0_template');
    expect(parseContextMode('l1_llm')).toBe('l1_llm');
  });

  it('l0_template 记 l0；l1_llm 本轮记 l0_fallback', () => {
    expect(resolveContextSource('l0_template')).toBe('l0');
    expect(resolveContextSource('l1_llm')).toBe('l0_fallback');
  });

  it('overrides 缺键合法；非法 contextMode 给出错误', () => {
    expect(invalidContextModeOverride(null)).toBeNull();
    expect(invalidContextModeOverride({})).toBeNull();
    expect(invalidContextModeOverride({ contextMode: 'l0_template' })).toBeNull();
    expect(invalidContextModeOverride({ contextMode: 'l2' })).toMatch(/invalid contextMode/);
  });
});
