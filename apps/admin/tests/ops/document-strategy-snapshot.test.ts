/**
 * 目标：文档详情必须能只读看到当时绑定的分片策略与参数快照，未记录时如实说「未记录」。
 * 需求：功能表 §4.5 文档绑定「参数快照只读审计」· prds/05-api 文档元数据只读展示 · ADR-053
 * 被测：DocumentsWorkspace · strategySnapshotLabel
 * 简介：不新增写路径；HTTP 真值在 api（列表项带出两字段）。
 */

import { describe, expect, it } from 'vitest';

import { strategySnapshotLabel } from '@/app/(ops)/documents/list.services';

describe('strategySnapshotLabel', () => {
  it('有码有快照 → 码 + 快照 JSON', () => {
    expect(
      strategySnapshotLabel('structure_paragraph', { contextMode: 'l0_template', chunkTokens: 256 }),
    ).toBe('structure_paragraph · {"contextMode":"l0_template","chunkTokens":256}');
  });

  it('有码无快照 → 说明未记录快照，不用默认值冒充', () => {
    expect(strategySnapshotLabel('structure_paragraph', null)).toBe(
      'structure_paragraph · 未记录快照',
    );
    expect(strategySnapshotLabel('structure_paragraph', {})).toBe(
      'structure_paragraph · 未记录快照',
    );
  });

  it('无码（历史文 / 未记录）→ 未记录分片策略', () => {
    expect(strategySnapshotLabel(null, null)).toBe('未记录分片策略');
    expect(strategySnapshotLabel(undefined, { chunkTokens: 1 })).toBe('未记录分片策略');
    expect(strategySnapshotLabel('   ', null)).toBe('未记录分片策略');
  });
});
