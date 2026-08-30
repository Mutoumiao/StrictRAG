/**
 * 目标：admin 顶栏当前 KB 只能选本次可见库，禁止粘贴 uuid；失败不得回退输入。
 * 需求：功能表 §4 当前 KB 选择器 · 工单「admin 顶栏当前 KB 选择器」
 * 被测：AdminShell 关闭列表
 * 简介：只能选 GET 返回的 id；脏缓存不打运营 API；空态 / 失败 / 未选中文案可区分；建库成功后当前 KB 为新建 id。
 */

import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readStoredKbId } from '@/lib/kb-context';
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

const listKnowledgeBases = vi.fn();
vi.mock('@/lib/kb-api', () => ({
  listKnowledgeBases: () => listKnowledgeBases(),
}));

const createKbAndSelect = vi.fn();
vi.mock('@/lib/kb-create.services', () => ({
  createKbAndSelect: (...args: unknown[]) => createKbAndSelect(...args),
}));

import { AdminShell } from '@/components/admin-shell';

const KB_A = { id: 'kb-listed', tenantId: 't', name: '演示库' };
const KB_B = { id: 'kb-other', tenantId: 't', name: '另一库' };
const GHOST_ID = 'kb-ghost';
const CREATED_ID = 'kb-created';
const KB_STORAGE = 'strict-rag:admin:last-kb-id';

const fetchKb = vi.fn();

function OpsProbe() {
  useEffect(() => {
    const id = readStoredKbId();
    if (id) fetchKb(id);
  }, []);
  const id = readStoredKbId();
  return <p>{id ? `已选 ${id}` : '请在顶栏选择知识库'}</p>;
}

describe('AdminShell 当前 KB 关闭列表', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'doc.view'];
    localStorage.clear();
    fetchKb.mockReset();
    listKnowledgeBases.mockReset();
    createKbAndSelect.mockReset();
  });

  it('空态无输入；有 kb.create 仍可建库；不说开通成员', async () => {
    me.permissions = ['admin.shell', 'kb.create'];
    listKnowledgeBases.mockResolvedValue([]);
    render(
      <AdminShell>
        <OpsProbe />
      </AdminShell>,
    );
    await waitFor(() => {
      expect(screen.getByText('当前身份没有可见知识库')).toBeInTheDocument();
    });
    expect(screen.queryByText(/开通成员/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '当前知识库' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/uuid/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建知识库' })).toBeInTheDocument();
    expect(screen.getByText('请在顶栏选择知识库')).toBeInTheDocument();
  });

  it('列表失败无输入且可重试，文案不说开通成员', async () => {
    const user = userEvent.setup();
    listKnowledgeBases.mockRejectedValueOnce(new Error('forbidden'));
    render(
      <AdminShell>
        <OpsProbe />
      </AdminShell>,
    );
    await waitFor(() => {
      expect(screen.getByText('知识库列表加载失败')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/无法获取可见知识库/);
    expect(screen.queryByText(/开通成员/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '当前知识库' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/uuid/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('请在顶栏选择知识库')).not.toBeInTheDocument();
    expect(fetchKb).not.toHaveBeenCalled();

    listKnowledgeBases.mockResolvedValue([KB_A]);
    await user.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '当前知识库' })).toBeInTheDocument();
    });
    expect(screen.queryByText('知识库列表加载失败')).not.toBeInTheDocument();
  });

  it('只能选本次列表返回的 id，无自由输入', async () => {
    const user = userEvent.setup();
    listKnowledgeBases.mockResolvedValue([KB_A, KB_B]);
    render(
      <AdminShell>
        <OpsProbe />
      </AdminShell>,
    );
    const trigger = await screen.findByRole('button', { name: '当前知识库' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/uuid/i)).not.toBeInTheDocument();
    expect(document.querySelector('select')).toBeNull();

    await user.click(trigger);
    expect(screen.getByRole('option', { name: '演示库' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '另一库' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: GHOST_ID })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: '另一库' }));
    expect(localStorage.getItem(KB_STORAGE)).toBe(KB_B.id);
    expect(screen.getByRole('button', { name: '当前知识库' })).toHaveTextContent('另一库');
  });

  it('脏缓存 id 不在本次列表中则不采用，不自动选第一项，不拿去打运营 API', async () => {
    localStorage.setItem(KB_STORAGE, GHOST_ID);
    listKnowledgeBases.mockResolvedValue([KB_A, KB_B]);
    render(
      <AdminShell>
        <OpsProbe />
      </AdminShell>,
    );
    const trigger = await screen.findByRole('button', { name: '当前知识库' });
    expect(trigger).toHaveTextContent('选择知识库');
    expect(trigger).not.toHaveTextContent('演示库');
    expect(screen.getByText('请在顶栏选择知识库')).toBeInTheDocument();
    expect(fetchKb).not.toHaveBeenCalled();
    expect(fetchKb).not.toHaveBeenCalledWith(GHOST_ID);
    expect(localStorage.getItem(KB_STORAGE)).toBe('');
  });

  it('失败 / 空态 / 未选中文案可区分', async () => {
    listKnowledgeBases.mockRejectedValue(new Error('network'));
    const { unmount } = render(
      <AdminShell>
        <OpsProbe />
      </AdminShell>,
    );
    await waitFor(() => {
      expect(screen.getByText('知识库列表加载失败')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.queryByText('当前身份没有可见知识库')).not.toBeInTheDocument();
    expect(screen.queryByText('请在顶栏选择知识库')).not.toBeInTheDocument();
    unmount();

    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([]);
    const emptyView = render(
      <AdminShell>
        <OpsProbe />
      </AdminShell>,
    );
    await waitFor(() => {
      expect(screen.getByText('当前身份没有可见知识库')).toBeInTheDocument();
    });
    expect(screen.queryByText('知识库列表加载失败')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
    expect(screen.getByText('请在顶栏选择知识库')).toBeInTheDocument();
    emptyView.unmount();

    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([KB_A]);
    render(
      <AdminShell>
        <OpsProbe />
      </AdminShell>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '当前知识库' })).toHaveTextContent('选择知识库');
    });
    expect(screen.getByText('请在顶栏选择知识库')).toBeInTheDocument();
    expect(screen.queryByText('当前身份没有可见知识库')).not.toBeInTheDocument();
    expect(screen.queryByText('知识库列表加载失败')).not.toBeInTheDocument();
  });

  it('建库成功后当前 KB 为新建 id，选项含这一行', async () => {
    me.permissions = ['admin.shell', 'kb.create'];
    listKnowledgeBases.mockResolvedValue([KB_A]);
    createKbAndSelect.mockResolvedValue({
      ok: true,
      kb: { id: CREATED_ID, tenantId: 't', name: '新库' },
    });
    const user = userEvent.setup();
    render(
      <AdminShell>
        <OpsProbe />
      </AdminShell>,
    );
    await screen.findByRole('button', { name: '当前知识库' });
    await user.click(screen.getByRole('button', { name: '创建知识库' }));
    await user.type(screen.getByLabelText('名称'), '新库');
    await user.click(screen.getByRole('button', { name: '确认创建' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '当前知识库' })).toHaveTextContent('新库');
    });
    expect(localStorage.getItem(KB_STORAGE)).toBe(CREATED_ID);
    await user.click(screen.getByRole('button', { name: '当前知识库' }));
    expect(screen.getByRole('option', { name: '新库' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '演示库' })).toBeInTheDocument();
  });
});
