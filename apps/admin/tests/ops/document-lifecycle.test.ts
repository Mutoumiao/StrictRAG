/**
 * 目标：文档生命周期入口闸必须按状态判断，失败则未就绪也可发布。
 * 需求：complete/reindex 入口
 * 被测：canPublish / canRevertDraft
 * 简介：不测策略执行。
 */

import { describe, expect, it } from 'vitest';

import { canPublish, canRevertDraft } from '@/app/(ops)/documents/lifecycle.services';

describe('lifecycle gates', () => {
  it('publish only ready and not already active', () => {
    expect(canPublish('ready', 'draft')).toBe(true);
    expect(canPublish('ready', 'active')).toBe(false);
    expect(canPublish('parsing', 'draft')).toBe(false);
  });

  it('revert only from active', () => {
    expect(canRevertDraft('active')).toBe(true);
    expect(canRevertDraft('draft')).toBe(false);
  });
});
