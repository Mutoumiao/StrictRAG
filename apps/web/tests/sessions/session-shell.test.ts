/**
 * 目标：会话壳服务调用形状正确，失败可映射且历史不得当 evidence。
 * 需求：sessions API
 * 被测：loadSessionList · refreshAfterAskFinal
 * 简介：非 evidence。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError } from '@/lib/http';

vi.mock('@/api/sessions', () => ({
  listSessions: vi.fn(),
  getSessionDetail: vi.fn(),
  createSession: vi.fn(),
}));

import { getSessionDetail, listSessions } from '@/api/sessions';
import { loadSessionList, refreshAfterAskFinal } from '@/services/sessions.services';

const listSessionsMock = vi.mocked(listSessions);
const getSessionDetailMock = vi.mocked(getSessionDetail);

describe('sessions.services', () => {
  beforeEach(() => {
    listSessionsMock.mockReset();
    getSessionDetailMock.mockReset();
  });

  it('列表失败映射业务错误', async () => {
    listSessionsMock.mockRejectedValueOnce(new ApiHttpError('FORBIDDEN', 'no access'));
    expect(await loadSessionList('kb-1')).toEqual({
      ok: false,
      message: 'FORBIDDEN: no access',
    });
  });

  it('refresh 部分失败仍返回数据并带 error', async () => {
    const sid = '018f0000-0000-7000-8000-0000000000dd';
    getSessionDetailMock.mockRejectedValueOnce(new ApiHttpError('INTERNAL', 'hist fail'));
    listSessionsMock.mockResolvedValueOnce([
      { sessionId: sid, title: 'ok', status: 'open', updatedAt: 't' },
    ]);
    const r = await refreshAfterAskFinal({
      kbId: 'kb-1',
      finalSessionId: sid,
      activeSessionId: null,
    });
    expect(r.history).toEqual([]);
    expect(r.sessions).toHaveLength(1);
    expect(r.error).toContain('INTERNAL: hist fail');
  });
});
