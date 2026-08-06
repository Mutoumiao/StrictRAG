import { describe, expect, it } from 'vitest';

import {
  ChunkDetailSchema,
  ChunkListItemSchema,
  ChunkListQuerySchema,
  ChunkListResponseSchema,
} from './chunk.contract.js';

describe('ChunkListQuerySchema', () => {
  it('defaults limit 20', () => {
    const r = ChunkListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(20);
  });

  it('rejects limit > 100', () => {
    expect(ChunkListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('ChunkListItemSchema / Detail', () => {
  it('list item has no body key in schema shape', () => {
    const keys = Object.keys(ChunkListItemSchema.shape);
    expect(keys).not.toContain('body');
    expect(keys).toContain('preview');
  });

  it('detail requires body + bodyTruncated', () => {
    const ok = ChunkDetailSchema.safeParse({
      chunkId: '01900000-0000-7000-8000-000000000001',
      ordinal: 0,
      preview: 'hi',
      previewTruncated: false,
      indexVersion: 1,
      body: 'full',
      bodyTruncated: false,
    });
    expect(ok.success).toBe(true);

    const missing = ChunkDetailSchema.safeParse({
      chunkId: '01900000-0000-7000-8000-000000000001',
      ordinal: 0,
      preview: 'hi',
      previewTruncated: false,
      indexVersion: 1,
    });
    expect(missing.success).toBe(false);
  });

  it('list response nextCursor nullable', () => {
    const r = ChunkListResponseSchema.safeParse({
      docId: '01900000-0000-7000-8000-0000000000aa',
      indexVersion: 1,
      items: [],
      nextCursor: null,
    });
    expect(r.success).toBe(true);
  });
});
