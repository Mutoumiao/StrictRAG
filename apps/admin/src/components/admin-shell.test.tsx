/**
 * AdminShell：菜单按 permissions + clipMenuForShell 裁剪；无码不展示落地路由。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

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

  it('KB 输入写 admin last-kb-id', async () => {
    me.permissions = ['admin.shell', 'doc.view'];
    const user = userEvent.setup();
    render(
      <AdminShell>
        <div>child</div>
      </AdminShell>,
    );
    await user.type(screen.getByPlaceholderText(/knowledge-base uuid/i), 'kb-abc');
    expect(localStorage.getItem('strict-rag:admin:last-kb-id')).toBe('kb-abc');
  });

  it('知识库 datalist 有可见库，仍可粘贴 uuid', async () => {
    me.permissions = ['admin.shell', 'doc.view'];
    render(
      <AdminShell>
        <div>child</div>
      </AdminShell>,
    );
    await waitFor(() => {
      expect(document.querySelector('#admin-kb-list option')?.getAttribute('value')).toBe(
        'kb-listed',
      );
    });
    expect(screen.getByPlaceholderText(/knowledge-base uuid/i)).toBeInTheDocument();
  });

  it('列表失败仍可粘贴 uuid', async () => {
    listKnowledgeBases.mockRejectedValue(new Error('forbidden'));
    me.permissions = ['admin.shell', 'doc.view'];
    const user = userEvent.setup();
    render(
      <AdminShell>
        <div>child</div>
      </AdminShell>,
    );
    await waitFor(() => expect(listKnowledgeBases).toHaveBeenCalled());
    expect(document.getElementById('admin-kb-list')?.querySelectorAll('option')).toHaveLength(0);
    await user.type(screen.getByPlaceholderText(/knowledge-base uuid/i), 'kb-paste');
    expect(localStorage.getItem('strict-rag:admin:last-kb-id')).toBe('kb-paste');
  });
});
