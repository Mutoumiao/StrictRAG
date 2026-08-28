/**
 * 目标：有 kb.create 才显示建库入口；表单预填当前用户并可改。
 * 需求：prds/05-api/01-http-api-hono.md §2.1
 * 被测：AdminShell · CreateKbControls
 * 简介：挂 KB 选择器，不单开二级菜单。真值在 api 建库写入。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const ADMIN_USER = '01900000-0000-7000-8000-0000000000a1';
const OTHER_ADMIN = '01900000-0000-7000-8000-0000000000a3';
const CREATED_ID = '01900000-0000-7000-8000-0000000000cc';

const me = {
  userId: ADMIN_USER,
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
    session: { sessionId: 's', userId: ADMIN_USER, roles: [], expiresAt: '' },
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

const createKbAndSelect = vi.fn();
vi.mock('@/lib/kb-create.services', () => ({
  createKbAndSelect: (...args: unknown[]) => createKbAndSelect(...args),
}));

import { AdminShell } from '@/components/admin-shell';

describe('建库入口', () => {
  beforeEach(() => {
    me.permissions = [];
    localStorage.clear();
    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([{ id: 'kb-listed', tenantId: 't', name: '演示库' }]);
    createKbAndSelect.mockReset();
  });

  it('无 kb.create 不显示创建入口', () => {
    me.permissions = ['admin.shell', 'doc.view'];
    render(
      <AdminShell>
        <div>child</div>
      </AdminShell>,
    );
    expect(screen.queryByRole('button', { name: '创建知识库' })).not.toBeInTheDocument();
  });

  it('有 kb.create 才显示；首位库管预填当前用户，提交走建库用例', async () => {
    me.permissions = ['admin.shell', 'kb.create'];
    createKbAndSelect.mockResolvedValue({
      ok: true,
      kb: { id: CREATED_ID, tenantId: 't', name: '新库' },
    });
    const user = userEvent.setup();
    render(
      <AdminShell>
        <div>child</div>
      </AdminShell>,
    );
    await user.click(screen.getByRole('button', { name: '创建知识库' }));
    expect(screen.getByLabelText('首位库管')).toHaveValue(ADMIN_USER);

    await user.clear(screen.getByLabelText('首位库管'));
    await user.type(screen.getByLabelText('首位库管'), OTHER_ADMIN);
    await user.type(screen.getByLabelText('名称'), '新库');
    await user.click(screen.getByRole('button', { name: '确认创建' }));

    await waitFor(() => {
      expect(createKbAndSelect).toHaveBeenCalledWith({
        name: '新库',
        initialAdminUserId: OTHER_ADMIN,
      });
    });
    expect(screen.getByPlaceholderText(/knowledge-base uuid/i)).toHaveValue(CREATED_ID);
  });
});
