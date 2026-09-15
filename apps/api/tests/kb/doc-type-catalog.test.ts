/**
 * 目标：知识库类型分区必须从 config 解析 catalog，停用码不得进入启用列表。
 * 需求：功能表 §4.2 文档类型 · ADR-054 · 工单「类型分区 CRUD 最小闭环」
 * 被测：parseDocTypeCatalogFromConfig / parseDocTypesFromConfig / mergeKbSettingsPatch / toMemberDocTypeItems
 * 简介：旧 string[] 合成全启用；简写 PATCH 写成 catalog。
 */

import { describe, expect, it } from 'vitest';

import {
  mergeKbSettingsPatch,
  parseDocTypeCatalogFromConfig,
  parseDocTypesFromConfig,
  toMemberDocTypeItems,
} from '../../src/services/kb-settings.js';

const ROW = {
  id: '01900000-0000-7000-8000-000000000099',
  name: 'KB',
  description: null,
  configJson: {} as Record<string, unknown>,
};

describe('类型分区 catalog', () => {
  it('旧 docTypes 合成全启用；有 catalog 时停用码不进派生列表', () => {
    expect(parseDocTypesFromConfig({ docTypes: ['hr', 'it'] })).toEqual(['hr', 'it']);
    expect(parseDocTypesFromConfig({})).toEqual([]);
    const catalog = parseDocTypeCatalogFromConfig({
      docTypeItems: [
        { code: 'legal', label: '法务', sort: 1, enabled: false },
        { code: 'hr', label: '人事', sort: 0, enabled: true },
      ],
    });
    expect(catalog.map((i) => i.code)).toEqual(['hr', 'legal']);
    expect(parseDocTypesFromConfig({ docTypeItems: catalog })).toEqual(['hr']);
    expect(toMemberDocTypeItems({ docTypeItems: catalog })).toEqual([
      { code: 'hr', label: '人事' },
    ]);
  });

  it('简写 PATCH docTypes 写成全启用 catalog', () => {
    const merged = mergeKbSettingsPatch(ROW, { docTypes: ['hr', 'legal'] });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.configJson.docTypes).toEqual(['hr', 'legal']);
    expect(merged.configJson.docTypeItems).toEqual([
      { code: 'hr', label: 'hr', sort: 0, enabled: true },
      { code: 'legal', label: 'legal', sort: 1, enabled: true },
    ]);
  });

  it('PATCH catalog 重复码 400 语义（merge 拒绝）', () => {
    const merged = mergeKbSettingsPatch(ROW, {
      docTypeItems: [
        { code: 'hr', label: '人事', sort: 0, enabled: true },
        { code: 'hr', label: '重复', sort: 1, enabled: false },
      ],
    });
    expect(merged.ok).toBe(false);
  });

  it('只改显示名也进 diff.docTypeItems', () => {
    const row = {
      ...ROW,
      configJson: {
        docTypeItems: [{ code: 'hr', label: 'hr', sort: 0, enabled: true }],
        docTypes: ['hr'],
      },
    };
    const merged = mergeKbSettingsPatch(row, {
      docTypeItems: [{ code: 'hr', label: '人事', sort: 0, enabled: true }],
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.diff.docTypeItems).toBeDefined();
    expect(merged.diff.docTypes).toBeUndefined();
  });
});
