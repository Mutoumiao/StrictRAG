/**
 * 目标：设置服务必须把类型分区草稿编成 catalog，失败则 PATCH 写出错误 docTypeItems。
 * 需求：功能表 §4.2 文档类型 · ADR-054 · 工单「类型分区 CRUD 最小闭环」
 * 被测：draftsFromSettings / draftsToCatalog / catalogsEqual
 * 简介：不写 URL；不再把逗号串当主路径。
 */

import { describe, expect, it } from 'vitest';

import {
  catalogsEqual,
  draftsFromSettings,
  draftsToCatalog,
} from '@/app/(ops)/kb/settings/services';

describe('类型分区草稿', () => {
  it('有 catalog 用全量；否则用启用码合成', () => {
    expect(
      draftsFromSettings({
        docTypes: ['hr'],
        docTypeItems: [
          { code: 'legal', label: '法务', sort: 1, enabled: false },
          { code: 'hr', label: '人事', sort: 0, enabled: true },
        ],
      }),
    ).toEqual([
      { code: 'hr', label: '人事', enabled: true },
      { code: 'legal', label: '法务', enabled: false },
    ]);
    expect(draftsFromSettings({ docTypes: ['hr', 'it'], docTypeItems: [] })).toEqual([
      { code: 'hr', label: 'hr', enabled: true },
      { code: 'it', label: 'it', enabled: true },
    ]);
  });

  it('空草稿编成空 catalog；跳过空码并按行序写 sort', () => {
    expect(draftsToCatalog([])).toEqual([]);
    expect(
      draftsToCatalog([
        { code: '  ', label: 'x', enabled: true },
        { code: 'hr', label: '人事', enabled: true },
        { code: 'legal', label: '', enabled: false },
      ]),
    ).toEqual([
      { code: 'hr', label: '人事', sort: 0, enabled: true },
      { code: 'legal', label: 'legal', sort: 1, enabled: false },
    ]);
  });

  it('catalogsEqual 只比规范化后的 JSON', () => {
    const a = draftsToCatalog([{ code: 'hr', label: '人事', enabled: true }]);
    const b = draftsToCatalog([{ code: 'hr', label: '人事', enabled: true }]);
    const c = draftsToCatalog([{ code: 'hr', label: '人事', enabled: false }]);
    expect(catalogsEqual(a, b)).toBe(true);
    expect(catalogsEqual(a, c)).toBe(false);
  });
});
