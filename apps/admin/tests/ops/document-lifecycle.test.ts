/**
 * 目标：文档生命周期入口闸必须按状态判断，失败则未就绪也可发布。
 * 需求：complete/reindex 入口
 * 被测：canPublish / canRevertDraft / canArchive / canSupersede
 * 简介：不测策略执行。
 */

import { describe, expect, it } from 'vitest';

import {
  canArchive,
  canPublish,
  canRevertDraft,
  canSupersede,
} from '@/app/(ops)/documents/lifecycle.services';

describe('lifecycle gates', () => {
  it('publish only ready and draft', () => {
    expect(canPublish('ready', 'draft')).toBe(true);
    expect(canPublish('ready', 'active')).toBe(false);
    expect(canPublish('parsing', 'draft')).toBe(false);
    expect(canPublish('ready', 'archived')).toBe(false);
    expect(canPublish('ready', 'superseded')).toBe(false);
  });

  it('revert only from active', () => {
    expect(canRevertDraft('active')).toBe(true);
    expect(canRevertDraft('draft')).toBe(false);
  });

  it('archive / supersede from draft or active', () => {
    expect(canArchive('draft')).toBe(true);
    expect(canArchive('active')).toBe(true);
    expect(canArchive('archived')).toBe(false);
    expect(canSupersede('draft')).toBe(true);
    expect(canSupersede('active')).toBe(true);
    expect(canSupersede('superseded')).toBe(false);
  });
});
