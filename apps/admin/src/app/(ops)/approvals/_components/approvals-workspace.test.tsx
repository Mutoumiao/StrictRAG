/**
 * 审批中心：无 decide 码不露按钮；无 KB 不请求；列表分栏。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadApprovalsList = vi.fn();
const applyApprovalAction = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('../services', () => ({
  loadApprovalsList: (...args: unknown[]) => loadApprovalsList(...args),
  applyApprovalAction: (...args: unknown[]) => applyApprovalAction(...args),
}));

import { ApprovalsWorkspace } from './approvals-workspace';

const pendingDoc = {
  id: '018f0000-0000-7000-8000-0000000000f1',
  title: '待审文档',
  status: 'uploaded',
  approvalStatus: 'pending',
  lifecycle: 'active',
  byteSize: 100,
  indexVersion: 1,
  errorCode: null,
  embedReady: false,
  esReady: false,
};

const approvedDoc = {
  id: '018f0000-0000-7000-8000-0000000000f2',
  title: '已通过文档',
  status: 'approved',
  approvalStatus: 'approved',
  lifecycle: 'active',
  byteSize: 100,
  indexVersion: 1,
  errorCode: null,
  embedReady: true,
  esReady: true,
};

describe('ApprovalsWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadApprovalsList.mockReset();
    applyApprovalAction.mockReset();
    localStorage.clear();
  });

  it('无 view 码 → 无权限文案且不请求', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell'];
    render(<ApprovalsWorkspace />);
    expect(await screen.findByText(/无审批\/文档查看权限/)).toBeInTheDocument();
    expect(loadApprovalsList).not.toHaveBeenCalled();
  });

  it('有 view 无 decide → 无通过/驳回；有 decide → 可点通过', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'approval.view'];
    loadApprovalsList.mockResolvedValue({ ok: true, rows: [pendingDoc, approvedDoc] });

    const { rerender } = render(<ApprovalsWorkspace />);
    expect(await screen.findByText('待审文档')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '通过' })).not.toBeInTheDocument();

    me.permissions = ['admin.shell', 'approval.view', 'approval.decide'];
    applyApprovalAction.mockResolvedValueOnce({
      ok: true,
      text: '已通过（尚未 scan；未批不可 scan）',
      rows: [{ ...pendingDoc, approvalStatus: 'approved' as const }],
    });
    rerender(<ApprovalsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '通过' }));
    await waitFor(() => {
      expect(applyApprovalAction).toHaveBeenCalledWith('kb-1', pendingDoc.id, 'approve');
    });
  });

  it('有 doc.upload 时已通过文档显示入队 scan', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'approval.view', 'doc.upload'];
    loadApprovalsList.mockResolvedValueOnce({ ok: true, rows: [approvedDoc] });
    render(<ApprovalsWorkspace />);
    expect(await screen.findByRole('button', { name: '入队 scan' })).toBeInTheDocument();
  });
});
