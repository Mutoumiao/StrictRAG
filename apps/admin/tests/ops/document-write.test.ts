/**
 * 目标：在线编写提交必须带非空标题与正文，并走 write HTTP。
 * 需求：功能表 §4.3 在线编写 · 工单「在线编写最小闭环」
 * 被测：canSubmitWrite · writeAdminDocument
 * 简介：HTTP 真值在 api。无 BlockNote。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const writeDocument = vi.fn();

vi.mock('@/app/(ops)/documents/api', () => ({
  writeDocument: (...a: unknown[]) => writeDocument(...a),
  getChunkStrategiesForUpload: vi.fn(),
}));

import { canSubmitWrite, writeAdminDocument } from '@/app/(ops)/documents/write.services';

describe('canSubmitWrite', () => {
  it('标题与正文都非空才可提交', () => {
    expect(canSubmitWrite('差旅', '# 正文')).toBe(true);
    expect(canSubmitWrite('  ', '# 正文')).toBe(false);
    expect(canSubmitWrite('差旅', '  \n')).toBe(false);
  });
});

describe('writeAdminDocument', () => {
  beforeEach(() => {
    writeDocument.mockReset();
  });

  it('trim 后 POST title/markdown/chunkStrategy', async () => {
    writeDocument.mockResolvedValue({
      docId: 'd1',
      sourceType: 'write',
      approvalStatus: 'pending',
      status: 'uploaded',
    });
    const r = await writeAdminDocument('kb1', ' 差旅 ', ' # 正文\n', 'structure_paragraph');
    expect(r).toEqual({ ok: true, docId: 'd1' });
    expect(writeDocument).toHaveBeenCalledWith('kb1', {
      title: '差旅',
      markdown: '# 正文',
      chunkStrategy: 'structure_paragraph',
    });
  });

  it('空正文不打 HTTP', async () => {
    const r = await writeAdminDocument('kb1', '差旅', '  ', 'structure_paragraph');
    expect(r.ok).toBe(false);
    expect(writeDocument).not.toHaveBeenCalled();
  });
});
