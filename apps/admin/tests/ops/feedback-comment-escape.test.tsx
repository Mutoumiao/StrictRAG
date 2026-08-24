/**
 * 目标：反馈 comment 含 `<script>alert(1)</script>` 必须当文本展示，不得当 HTML 解析执行。
 * 需求：剧本 K6 · prds/10-delivery/03-acceptance-scenarios.md
 * 被测：FeedbackWorkspace
 * 简介：队列 comment 走 React 文本节点原样可见。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

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

const XSS_COMMENT = '<script>alert(1)</script>';

const xssItem = {
  feedbackId: '018f0000-0000-7000-8000-0000000000c1',
  requestId: 'req-xss-1',
  kbId: '018f0000-0000-7000-8000-0000000000b1',
  userId: '018f0000-0000-7000-8000-0000000000a1',
  rating: 'down' as const,
  category: null,
  comment: XSS_COMMENT,
  status: 'open' as const,
  handlerId: null,
  resolvedAt: null,
  createdAt: null,
};

describe('FeedbackWorkspace', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'feedback.queue'];
    loadFeedbackQueue.mockReset();
    resolveFeedback.mockReset();
    localStorage.clear();
  });

  it('K6: comment 含 script 标签按文本展示', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    loadFeedbackQueue.mockResolvedValue({ ok: true, items: [xssItem] });

    render(<FeedbackWorkspace />);

    const node = await screen.findByText(XSS_COMMENT);
    expect(node).toBeInTheDocument();
    expect(node.tagName.toLowerCase()).not.toBe('script');
  });
});
