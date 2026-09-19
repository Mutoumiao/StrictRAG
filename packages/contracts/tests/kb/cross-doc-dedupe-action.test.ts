/**
 * 目标：KB 设置 PATCH 只收 skip_index / pending_review；PRD 的 downrank 必须被拒（不留静默通道）。
 * 需求：剧本 E4 · prds/04-pipelines/01-offline-ingest.md §5.1
 * 被测：PatchKbSettingsBodySchema / parseCrossDocDedupeAction
 * 简介：两个合法值通过；downrank 与未知值 400；config 读取缺省/脏值一律回落 skip_index。
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CROSS_DOC_DEDUPE_ACTION,
  PatchKbSettingsBodySchema,
  parseCrossDocDedupeAction,
} from '../../src/index.js';

describe('KB 跨 doc 去重动作白名单（剧本 E4）', () => {
  it('合法值：skip_index / pending_review 通过', () => {
    expect(
      PatchKbSettingsBodySchema.safeParse({ crossDocDedupeAction: 'skip_index' }).success,
    ).toBe(true);
    expect(
      PatchKbSettingsBodySchema.safeParse({ crossDocDedupeAction: 'pending_review' }).success,
    ).toBe(true);
  });

  it('PRD 的 downrank 未实现 → 明确拒绝，不静默接受', () => {
    expect(
      PatchKbSettingsBodySchema.safeParse({ crossDocDedupeAction: 'downrank' }).success,
    ).toBe(false);
    expect(
      PatchKbSettingsBodySchema.safeParse({ crossDocDedupeAction: 'delete_everything' }).success,
    ).toBe(false);
  });

  it('读取口径：缺省 / 脏值一律回落 skip_index（不放大脏数据）', () => {
    expect(DEFAULT_CROSS_DOC_DEDUPE_ACTION).toBe('skip_index');
    expect(parseCrossDocDedupeAction(null)).toBe('skip_index');
    expect(parseCrossDocDedupeAction({})).toBe('skip_index');
    expect(parseCrossDocDedupeAction({ crossDocDedupeAction: 'downrank' })).toBe('skip_index');
    expect(parseCrossDocDedupeAction({ crossDocDedupeAction: 'pending_review' })).toBe(
      'pending_review',
    );
  });
});
