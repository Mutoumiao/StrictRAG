/**
 * 目标：上传服务必须按 upload-url → PUT → complete 调用，失败则入口顺序错乱。
 * 需求：上传入口
 * 被测：uploadAdminDocument
 * 简介：体积闸真值在 api。
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

import { uploadAdminDocument } from '@/app/(ops)/documents/upload.services';

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
    putUploadedObject.mockResolvedValue({ key: 'k', byteSize: 3, checksumSha256: 'x' });
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
      expect.objectContaining({ chunkStrategy: 'structure_paragraph' }),
    );
  });
});
