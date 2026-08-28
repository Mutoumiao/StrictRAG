/**
 * 目标：文档列表运营标签必须按 status × lifecycle 映射八态，失败则合成一个模糊状态。
 * 需求：功能表 §4.3 状态双轴
 * 被测：opsLabel
 * 简介：原串作次要信息，不在本测。
 */

import { describe, expect, it } from 'vitest';

import { opsLabel } from '@/app/(ops)/documents/list.services';

describe('opsLabel', () => {
  it('lifecycle 终态优先', () => {
    expect(opsLabel('ready', 'archived', 'approved')).toBe('已归档');
    expect(opsLabel('ready', 'superseded', 'approved')).toBe('已替代');
    expect(opsLabel('failed', 'archived')).toBe('已归档');
  });

  it('现行可问 / 就绪未发布', () => {
    expect(opsLabel('ready', 'active', 'approved')).toBe('现行可问');
    expect(opsLabel('ready', 'draft', 'approved')).toBe('就绪未发布');
  });

  it('失败 / 需 OCR / 待审 / 处理中', () => {
    expect(opsLabel('failed', 'draft')).toBe('失败');
    expect(opsLabel('needs_ocr', 'draft')).toBe('需 OCR');
    expect(opsLabel('uploaded', 'draft', 'pending')).toBe('待审');
    expect(opsLabel('needs_review', 'draft', 'approved')).toBe('待审');
    expect(opsLabel('chunking', 'draft', 'approved')).toBe('处理中');
    expect(opsLabel('uploaded', 'draft', 'approved')).toBe('处理中');
  });
});
