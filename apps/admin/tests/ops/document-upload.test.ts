/**
 * 目标：上传服务必须按 upload-url → PUT → complete 调用，未知类型不得改写成 text/plain。
 * 需求：上传入口 · ADR-039
 * 被测：uploadAdminDocument · resolveUploadContentType
 * 简介：未知类型不调 upload-url；complete 带 checksum。体积闸真值在 api。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestUploadUrl = vi.fn();
const putUploadedObject = vi.fn();
const completeUpload = vi.fn();
const getChunkStrategiesForUpload = vi.fn();

vi.mock('@/app/(ops)/documents/api', () => ({
  requestUploadUrl: (...a: unknown[]) => requestUploadUrl(...a),
  putUploadedObject: (...a: unknown[]) => putUploadedObject(...a),
  completeUpload: (...a: unknown[]) => completeUpload(...a),
  getChunkStrategiesForUpload: (...a: unknown[]) => getChunkStrategiesForUpload(...a),
}));

import { resolveUploadContentType, uploadAdminDocument } from '@/app/(ops)/documents/upload.services';

describe('uploadAdminDocument', () => {
  beforeEach(() => {
    requestUploadUrl.mockReset();
    putUploadedObject.mockReset();
    completeUpload.mockReset();
  });

  it('upload-url then PUT then complete with implemented strategy', async () => {
    requestUploadUrl.mockResolvedValue({
      docId: 'd1',
      uploadUrl: '/api/v1/internal/objects?key=k',
      method: 'PUT',
      objectKey: 'k',
      maxBytes: 1000,
    });
    const checksumSha256 = 'a'.repeat(64);
    putUploadedObject.mockResolvedValue({ key: 'k', byteSize: 3, checksumSha256 });
    completeUpload.mockResolvedValue({ docId: 'd1' });
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });
    const r = await uploadAdminDocument('kb1', file, 'structure_paragraph');
    expect(r).toEqual({ ok: true, docId: 'd1' });
    expect(requestUploadUrl).toHaveBeenCalledWith('kb1', {
      title: 'a.txt',
      contentType: 'text/plain',
      declaredByteSize: 3,
    });
    expect(putUploadedObject).toHaveBeenCalled();
    expect(completeUpload).toHaveBeenCalledWith(
      'kb1',
      'd1',
      expect.objectContaining({ chunkStrategy: 'structure_paragraph', checksumSha256 }),
    );
  });

  it('empty type + .exe does not call upload-url', async () => {
    const file = new File(['abc'], 'payload.exe', { type: '' });
    const r = await uploadAdminDocument('kb1', file, 'structure_paragraph');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected reject');
    expect(r.message).toContain('UNSUPPORTED_MEDIA_TYPE');
    expect(requestUploadUrl).not.toHaveBeenCalled();
  });

  it('resolveUploadContentType infers markdown from filename when type empty', () => {
    const file = new File(['# t'], 'note.md', { type: '' });
    expect(resolveUploadContentType(file)).toEqual({ ok: true, contentType: 'text/markdown' });
  });
});
