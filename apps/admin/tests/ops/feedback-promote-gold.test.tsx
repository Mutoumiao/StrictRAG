/**
 * 目标：有 feedback.queue 与 eval.run 才能纳入黄金集；无 eval.run 不得展示按钮。
 * 需求：ADR-019 · 功能表 §4.1 · prds/05-api §2.6
 * 被测：FeedbackWorkspace
 * 简介：HTTP 真值在 api；本页只断言纳入编排。不是 gold.yaml。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { within } from '@testing-library/react';
import { render, screen, userEvent } from '@/test/test-utils';

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
  requestId: 'req-promote-1',
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

describe('FeedbackWorkspace 纳入黄金集', () => {
  beforeEach(() => {
    me.permissions = [];
    loadFeedbackQueue.mockReset();
    resolveFeedback.mockReset();
    localStorage.clear();
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    loadFeedbackQueue.mockResolvedValue({ ok: true, items: [openItem] });
    resolveFeedback.mockResolvedValue({ ok: true });
  });

  it('无 eval.run 不见纳入按钮', async () => {
    me.permissions = ['admin.shell', 'feedback.queue'];
    render(<FeedbackWorkspace />);
    expect(await screen.findByRole('button', { name: '忽略' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '纳入黄金集' })).not.toBeInTheDocument();
  });

  it('有两码可选题型并纳入', async () => {
    me.permissions = ['admin.shell', 'feedback.queue', 'eval.run'];
    render(<FeedbackWorkspace />);
    const user = userEvent.setup();
    expect(await screen.findByRole('button', { name: '纳入黄金集' })).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: '黄金集题型 req-promote-1' });
    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: '可答' }));
    await user.click(screen.getByRole('button', { name: '纳入黄金集' }));
    expect(resolveFeedback).toHaveBeenCalledWith(
      openItem.feedbackId,
      'promoted_to_gold',
      'answerable',
    );
  });
});
