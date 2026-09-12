/**
 * 目标：默认检索必须按生效窗口过滤，缺界不限，已到期不得进检索集。
 * 需求：功能表 §5.4 默认检索谓词
 * 被测：isWithinEffectiveWindow · isEffectiveWindowOrdered
 * 简介：纯函数；生产装载路径在 api corpus。
 */

import { describe, expect, it } from 'vitest';

import {
  isEffectiveWindowOrdered,
  isWithinEffectiveWindow,
} from '../../src/query/effective-window.js';

const NOW = '2026-09-12 12:00:00';

describe('isWithinEffectiveWindow', () => {
  it('两界皆空 → 放行', () => {
    expect(isWithinEffectiveWindow({}, NOW)).toBe(true);
    expect(isWithinEffectiveWindow({ effectiveFrom: null, effectiveTo: null }, NOW)).toBe(true);
  });

  it('未到 from → 拒', () => {
    expect(isWithinEffectiveWindow({ effectiveFrom: '2026-09-12 12:00:01' }, NOW)).toBe(false);
  });

  it('from == now → 放行', () => {
    expect(isWithinEffectiveWindow({ effectiveFrom: NOW }, NOW)).toBe(true);
  });

  it('to == now → 拒', () => {
    expect(isWithinEffectiveWindow({ effectiveTo: NOW }, NOW)).toBe(false);
  });

  it('已过 to → 拒', () => {
    expect(isWithinEffectiveWindow({ effectiveTo: '2026-09-12 11:59:59' }, NOW)).toBe(false);
  });

  it('窗内 → 放行', () => {
    expect(
      isWithinEffectiveWindow(
        { effectiveFrom: '2026-09-01 00:00:00', effectiveTo: '2026-09-30 00:00:00' },
        NOW,
      ),
    ).toBe(true);
  });
});

describe('isEffectiveWindowOrdered', () => {
  it('缺一界视为有序', () => {
    expect(isEffectiveWindowOrdered('2026-09-12 12:00:00', null)).toBe(true);
    expect(isEffectiveWindowOrdered(null, '2026-09-12 12:00:00')).toBe(true);
  });

  it('from > to → 无序', () => {
    expect(isEffectiveWindowOrdered('2026-09-13 00:00:00', '2026-09-12 00:00:00')).toBe(false);
  });

  it('from == to → 有序', () => {
    expect(isEffectiveWindowOrdered(NOW, NOW)).toBe(true);
  });
});
