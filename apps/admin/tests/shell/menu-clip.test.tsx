/**
 * 目标：菜单必须按权限码裁剪，失败则无码用户仍看到落地路由。
 * 需求：ADR-056 clip
 * 被测：AdminShell
 * 简介：非完整运营台。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

const me = {
  userId: 'u-admin',
  email: 'admin@example.com',
  permissions: [] as string[],
};

vi.mock('next/navigation', () => ({
  usePathname: () => '/documents',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-admin', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/auth/services', () => ({
  logoutLocal: vi.fn(),
}));

const listKnowledgeBases = vi.fn(async () => [
  { id: 'kb-listed', tenantId: 't', name: '演示库' },
]);
vi.mock('@/lib/kb-api', () => ({
  listKnowledgeBases: () => listKnowledgeBases(),
}));

import { AdminShell } from '@/components/admin-shell';

describe('AdminShell', () => {
  beforeEach(() => {
    me.permissions = [];
    localStorage.clear();
    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([{ id: 'kb-listed', tenantId: 't', name: '演示库' }]);
  });

  it('按码裁剪菜单；无码无审批/数据面板；有 dashboard.view 出现「数据面板」', () => {
    me.permissions = ['admin.shell', 'doc.view'];
    const { rerender } = render(
      <AdminShell>
        <div>child</div>
      </AdminShell>,
    );
    expect(screen.getByRole('link', { name: '文档' })).toHaveAttribute('href', '/documents');
    expect(screen.queryByRole('link', { name: '审批中心' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '数据面板' })).not.toBeInTheDocument();

    me.permissions = [
      'admin.shell',
      'doc.view',
      'approval.view',
      'member.manage',
      'chunk.view',
      'kb.config.write',
    ];
    rerender(
      <AdminShell>
        <div>child</div>
      </AdminShell>,
    );
    expect(screen.getByRole('link', { name: '审批中心' })).toHaveAttribute('href', '/approvals');
    expect(screen.getByRole('link', { name: '成员' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '数据面板' })).not.toBeInTheDocument();

    me.permissions = ['admin.shell', 'dashboard.view'];
    rerender(
      <AdminShell>
        <div>child</div>
      </AdminShell>,
    );
    expect(screen.getByRole('link', { name: '数据面板' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
