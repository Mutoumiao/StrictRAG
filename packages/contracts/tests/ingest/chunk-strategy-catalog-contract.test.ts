/**
 * 目标：分片策略三层 HTTP 契约必须带 for-upload query 与库启用 PATCH，缺字段或非法族应拒绝。
 * 需求：功能表 §4.5 · ADR-053
 * 被测：ForUploadQuerySchema · PatchKbChunkStrategiesBodySchema · docFamilyFromContentType
 * 简介：最小闭环 DTO；不含平台 CRUD 页。
 */

import { describe, expect, it } from 'vitest';

import {
  ForUploadQuerySchema,
  PatchKbChunkStrategiesBodySchema,
} from '../../src/ingest/chunk-strategy.contract.js';
import { docFamilyFromContentType } from '../../src/ingest/chunk-strategy.js';

describe('chunk strategy catalog contract', () => {
  it('for-upload query 必须有 contentType', () => {
    expect(ForUploadQuerySchema.safeParse({ contentType: 'text/plain' }).success).toBe(true);
    expect(ForUploadQuerySchema.safeParse({}).success).toBe(false);
  });

  it('PATCH 至少一条启用项；未知族拒绝', () => {
    expect(
      PatchKbChunkStrategiesBodySchema.safeParse({
        items: [{ code: 'structure_paragraph', enabled: true, recommendedFamilies: ['txt'] }],
      }).success,
    ).toBe(true);
    expect(PatchKbChunkStrategiesBodySchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      PatchKbChunkStrategiesBodySchema.safeParse({
        items: [{ code: 'structure_paragraph', enabled: true, recommendedFamilies: ['pdf_scan'] }],
      }).success,
    ).toBe(false);
  });

  it('contentType 映射到文档族', () => {
    expect(docFamilyFromContentType('text/plain')).toBe('txt');
    expect(docFamilyFromContentType('text/markdown')).toBe('md');
    expect(docFamilyFromContentType('application/pdf')).toBe('pdf_text');
    expect(
      docFamilyFromContentType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('docx');
  });
});
