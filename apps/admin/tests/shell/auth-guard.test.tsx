/**
 * 目标：无会话或无 admin.shell 必须跳转登录，失败则壳内页对无权限用户可见；进壳只认 admin.shell，与会话角色锚点无关。
 * 需求：admin.shell（ADR-051）
 * 被测：AdminAuthGuard
 * 简介：mock 须持续 resolve。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanup, render, screen, waitFor } from '@/test/test-utils';

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

  it('S1/Y6：web_consumer 空码 → 清会话 + /login，不进壳子树', async () => {
    readClientSession.mockReturnValue({
      accessToken: 'x',
      refreshToken: 'y',
      session: { sessionId: 's', userId: 'u', roles: ['web_consumer'], expiresAt: '' },
    });
    // web_consumer 模板码为空（packages/admin-catalog/src/role-templates.ts:57-65）
    fetchAuthMe.mockResolvedValueOnce({
      userId: 'u',
      email: 'x@y.com',
      roles: ['web_consumer'],
      permissions: [],
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

  it('S4：进壳只认 admin.shell，KB 角色（read / write）不参与判定', async () => {
    // 会话角色锚点形如「KB-A read + KB-B write」；放行只认 /auth/me 的 admin.shell
    const kbRoles = ['kb-a:read', 'kb-b:write'];
    const stored = {
      accessToken: 'x',
      refreshToken: 'y',
      session: { sessionId: 's', userId: 'u', roles: kbRoles, expiresAt: '' },
    };
    const me = { userId: 'u', email: 'v@y.com', roles: kbRoles };

    // ① 带 KB 写角色锚点但有效码无壳码 → 不进壳
    readClientSession.mockReturnValue(stored);
    fetchAuthMe.mockResolvedValueOnce({ ...me, permissions: ['doc.view'] });
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

    // ② 同一 KB 角色锚点 + 有效码含 admin.shell → 可进壳
    cleanup();
    replace.mockClear();
    clearClientSession.mockClear();
    fetchAuthMe.mockReset();
    readClientSession.mockReset();
    readClientSession.mockReturnValue(stored);
    fetchAuthMe.mockResolvedValue({ ...me, permissions: ['admin.shell', 'doc.view'] });
    render(
      <AdminAuthGuard>
        <div>secret</div>
      </AdminAuthGuard>,
    );
    expect(await screen.findByText('secret')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(clearClientSession).not.toHaveBeenCalled();
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
