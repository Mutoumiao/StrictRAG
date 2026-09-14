/**
 * 目标：入库只接受矩阵内 MIME/扩展名，未知与 octet-stream 必须拒绝。
 * 需求：ADR-039 · 功能表 §5.2 · prds/09-security §7
 * 被测：isAllowedIngestMedia · resolveIngestContentType
 * 简介：白名单 SSOT；不嗅魔数。
 */

import { describe, expect, it } from 'vitest';

import {
  isAllowedIngestMedia,
  resolveIngestContentType,
} from '../../src/ingest/upload-media.js';

describe('isAllowedIngestMedia', () => {
  it('允许 pdf / markdown / plain / docx', () => {
    expect(isAllowedIngestMedia({ contentType: 'application/pdf', fileName: 'a.pdf' })).toBe(true);
    expect(isAllowedIngestMedia({ contentType: 'text/markdown', fileName: 'a.md' })).toBe(true);
    expect(isAllowedIngestMedia({ contentType: 'text/plain', fileName: 'a.txt' })).toBe(true);
    expect(
      isAllowedIngestMedia({
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: 'a.docx',
      }),
    ).toBe(true);
  });

  it('拒绝 octet-stream、空类型与可执行扩展名', () => {
    expect(
      isAllowedIngestMedia({ contentType: 'application/octet-stream', fileName: 'a.bin' }),
    ).toBe(false);
    expect(isAllowedIngestMedia({ contentType: '', fileName: 'a.txt' })).toBe(false);
    expect(isAllowedIngestMedia({ contentType: 'text/plain', fileName: 'malware.exe' })).toBe(
      false,
    );
  });
});

describe('resolveIngestContentType', () => {
  it('声明类型合法则用声明；空类型可按扩展名推断', () => {
    expect(
      resolveIngestContentType({ contentType: 'text/plain; charset=utf-8', fileName: 'a.txt' }),
    ).toBe('text/plain');
    expect(resolveIngestContentType({ contentType: '', fileName: 'note.md' })).toBe('text/markdown');
  });

  it('未知类型且无合法扩展名不得推断为 text/plain', () => {
    expect(resolveIngestContentType({ contentType: 'application/octet-stream' })).toBeNull();
    expect(resolveIngestContentType({ contentType: '', fileName: 'payload.exe' })).toBeNull();
  });
});
