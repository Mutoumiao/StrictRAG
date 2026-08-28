/**
 * 目标：建库用例成功后必须把新库写成当前 KB。
 * 需求：prds/05-api/01-http-api-hono.md §2.1
 * 被测：createKbAndSelect
 * 简介：不写 URL；HTTP 真值在 api。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const createKnowledgeBase = vi.fn();
vi.mock('@/lib/kb-api', () => ({
  createKnowledgeBase: (...args: unknown[]) => createKnowledgeBase(...args),
}));

import { createKbAndSelect } from '@/lib/kb-create.services';

const ADMIN_USER = '01900000-0000-7000-8000-0000000000a1';
const CREATED_ID = '01900000-0000-7000-8000-0000000000cc';

describe('createKbAndSelect', () => {
  beforeEach(() => {
    localStorage.clear();
    createKnowledgeBase.mockReset();
  });

  it('成功后写入当前 KB', async () => {
    createKnowledgeBase.mockResolvedValue({
      id: CREATED_ID,
      tenantId: '01900000-0000-7000-8000-000000000001',
      name: '新库',
    });
    const result = await createKbAndSelect({
      name: '新库',
      initialAdminUserId: ADMIN_USER,
    });
    expect(result).toEqual({
      ok: true,
      kb: { id: CREATED_ID, tenantId: '01900000-0000-7000-8000-000000000001', name: '新库' },
    });
    expect(localStorage.getItem('strict-rag:admin:last-kb-id')).toBe(CREATED_ID);
  });
});
