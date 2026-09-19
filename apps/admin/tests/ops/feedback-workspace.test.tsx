/**
 * 目标：反馈队列必须能按审核口径关单：open 单可点「已关联文档」走 linked_doc，关单后不再显示该按钮。
 * 需求：剧本 G2 · prds/10-delivery/03-acceptance-scenarios.md · ADR-019 · 功能表 §4.1
 * 被测：FeedbackWorkspace
 * 简介：HTTP 真值在 api（feedback/http.test.ts）；本页只断言关单入口与状态文案。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadFeedbackQueue = vi.fn();
const resolveFeedback = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/feedback/services', () => ({
  loadFeedbackQueue: (...args: unknown[]) => loadFeedbackQueue(...args),
  resolveFeedback: (...args: unknown[]) => resolveFeedback(...args),
}));

import { FeedbackWorkspace } from '@/app/(ops)/feedback/_components/feedback-workspace';

const openItem = {
  feedbackId: '018f0000-0000-7000-8000-0000000000c1',
  requestId: 'req-linked-1',
  kbId: '018f0000-0000-7000-8000-0000000000b1',
  userId: '018f0000-0000-7000-8000-0000000000a1',
  rating: 'down' as const,
  category: 'missing_doc',
  comment: '缺制度',
  status: 'open' as const,
  handlerId: null,
  resolvedAt: null,
  createdAt: null,
};

describe('FeedbackWorkspace 关单（G2）', () => {
  beforeEach(() => {
    me.permissions = [];
    loadFeedbackQueue.mockReset();
    resolveFeedback.mockReset();
    localStorage.clear();
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    loadFeedbackQueue.mockResolvedValue({ ok: true, items: [openItem] });
    resolveFeedback.mockResolvedValue({ ok: true });
  });

  it('open 单点「已关联文档」→ 用例传 linked_doc 并回显状态', async () => {
    me.permissions = ['admin.shell', 'feedback.queue'];
    render(<FeedbackWorkspace />);
    const user = userEvent.setup();

    const link = await screen.findByRole('button', { name: '已关联文档' });
    await user.click(link);

    await waitFor(() => {
      expect(resolveFeedback).toHaveBeenCalledWith(openItem.feedbackId, 'linked_doc', undefined);
    });
    expect(await screen.findByText(/已更新为 linked_doc/)).toBeInTheDocument();
  });

  it('已关单（linked_doc）行不再出现关单按钮', async () => {
    me.permissions = ['admin.shell', 'feedback.queue'];
    loadFeedbackQueue.mockResolvedValue({
      ok: true,
      items: [{ ...openItem, status: 'linked_doc' as const, resolvedAt: '2026-09-20 10:00:00' }],
    });
    render(<FeedbackWorkspace />);

    expect(await screen.findByText(/linked_doc/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '已关联文档' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '忽略' })).not.toBeInTheDocument();
  });

  it('无 feedback.queue → 只提示无权限，不展示任何关单按钮', async () => {
    me.permissions = ['admin.shell'];
    render(<FeedbackWorkspace />);

    expect(await screen.findByText(/无 feedback\.queue 权限/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '已关联文档' })).not.toBeInTheDocument();
    expect(loadFeedbackQueue).not.toHaveBeenCalled();
  });
});
