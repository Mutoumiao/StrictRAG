/**
 * AdminAuthGuard：无会话 / 无 admin.shell 必须拦到登录。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@/test/test-utils';

const replace = vi.fn();
const fetchAuthMe = vi.fn();
const readClientSession = vi.fn();
const clearClientSession = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock('@/auth/api', () => ({
  fetchAuthMe: () => fetchAuthMe(),
}));

vi.mock('@/auth/client-session', () => ({
  readClientSession: () => readClientSession(),
  clearClientSession: () => clearClientSession(),
  sessionChangedEventName: 'strict-rag-admin-client-session-changed',
}));

import { AdminAuthGuard } from '@/components/auth-guard';

describe('AdminAuthGuard', () => {
  beforeEach(() => {
    replace.mockReset();
    fetchAuthMe.mockReset();
    readClientSession.mockReset();
    clearClientSession.mockReset();
  });

  it('无本地会话 → /login', async () => {
    readClientSession.mockReturnValue(null);
    render(
      <AdminAuthGuard>
        <div>secret</div>
      </AdminAuthGuard>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('无 admin.shell → 清会话并 /login', async () => {
    readClientSession.mockReturnValue({
      accessToken: 'x',
      refreshToken: 'y',
      session: { sessionId: 's', userId: 'u', roles: [], expiresAt: '' },
    });
    fetchAuthMe.mockResolvedValueOnce({
      userId: 'u',
      email: 'x@y.com',
      permissions: ['doc.view'],
    });

    render(
      <AdminAuthGuard>
        <div>secret</div>
      </AdminAuthGuard>,
    );

    await waitFor(() => {
      expect(clearClientSession).toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('有 admin.shell 渲染子树', async () => {
    const stored = {
      accessToken: 'x',
      refreshToken: 'y',
      session: { sessionId: 's', userId: 'u', roles: [], expiresAt: '' },
    };
    // Strict Mode / 会话事件可能多次 load；持续 resolve，避免 once 耗尽误跳登录
    readClientSession.mockReturnValue(stored);
    fetchAuthMe.mockResolvedValue({
      userId: 'u',
      email: 'admin@example.com',
      permissions: ['admin.shell', 'doc.view'],
    });

    render(
      <AdminAuthGuard>
        <div>secret</div>
      </AdminAuthGuard>,
    );

    expect(await screen.findByText('secret')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
