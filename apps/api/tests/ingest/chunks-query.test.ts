/**
 * 目标：分片只读查询返回 preview/body 契约。
 * 需求：ADR-052 · B1
 * 被测：buildPreview / buildBody
 * 简介：分片只读查询。
 */

import { describe, expect, it } from 'vitest';

import {
  buildBody,
  buildPreview,
  CHUNK_BODY_MAX_BYTES,
  CHUNK_PREVIEW_MAX,
  truncateUtf8ByBytes,
  type ChunkRow,
} from '../../src/services/chunks.js';

function row(partial: Partial<ChunkRow> & Pick<ChunkRow, 'id'>): ChunkRow {
  return {
    docId: 'd',
    indexVersion: 1,
    ordinal: 0,
    preview: null,
    bodyText: null,
    tokenCount: null,
    ...partial,
  };
}

describe('buildPreview / buildBody', () => {
  it('preview 来自列；body 更长则 truncated', () => {
    const r = row({
      id: 'a',
      preview: 'short',
      bodyText: 'short and longer body',
    });
    const p = buildPreview(r);
    expect(p.preview).toBe('short');
    expect(p.previewTruncated).toBe(true);
  });

  it('无 preview 列时从 body 截断', () => {
    const body = 'y'.repeat(CHUNK_PREVIEW_MAX + 50);
    const p = buildPreview(row({ id: 'b', bodyText: body }));
    expect(p.preview.length).toBe(CHUNK_PREVIEW_MAX);
    expect(p.previewTruncated).toBe(true);
  });

  it('body 软上限 64KiB（按 UTF-8 字节）', () => {
    const raw = 'z'.repeat(CHUNK_BODY_MAX_BYTES + 1);
    const b = buildBody(row({ id: 'c', bodyText: raw }));
    expect(Buffer.byteLength(b.body, 'utf8')).toBe(CHUNK_BODY_MAX_BYTES);
    expect(b.bodyTruncated).toBe(true);
  });

  it('中文按字节截断，不按 char 数', () => {
    // 每个「测」= 3 bytes；21 字 = 63 bytes；再加一字会超 64
    const raw = '测'.repeat(30);
    const { text, truncated } = truncateUtf8ByBytes(raw, 64);
    expect(truncated).toBe(true);
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(64);
    expect(Buffer.byteLength(text, 'utf8')).toBeGreaterThan(0);
    // 若误用 char 截断 64，中文 30 字不会 truncated
    expect(raw.length).toBeLessThan(64);
  });
});
