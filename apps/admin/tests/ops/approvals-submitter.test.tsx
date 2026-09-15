/**
 * 目标：审批中心必须回显提交人，认不出提交人时显「—」；失败则运营看不出是谁提交的单（四眼无从执行）。
 * 需求：功能表 §4.3 · prds/05-api/01-http-api-hono.md §approve（ADR-048 四眼）· 剧本 V3
 * 被测：ApprovalsWorkspace · submitterLabel
 * 简介：HTTP 真值在 api（403 闸在 no-self-approve）；本页只断言提交人列渲染与缺省占位。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadApprovalsList = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/approvals/services', () => ({
  loadApprovalsList: (...args: unknown[]) => loadApprovalsList(...args),
  applyApprovalAction: vi.fn(),
}));

import {
  ApprovalsWorkspace,
  submitterLabel,
} from '@/app/(ops)/approvals/_components/approvals-workspace';

const SUBMITTER = '018f0000-0000-7000-8000-0000000000b1';

const docWithSubmitter = {
  id: '018f0000-0000-7000-8000-0000000000f1',
  title: '待审文档',
  status: 'uploaded',
  approvalStatus: 'pending',
  lifecycle: 'draft',
  byteSize: 100,
  indexVersion: 1,
  errorCode: null,
  embedReady: false,
  esReady: false,
  submittedBy: SUBMITTER,
};

const docWithoutSubmitter = {
  ...docWithSubmitter,
  id: '018f0000-0000-7000-8000-0000000000f2',
  title: '历史待审文档',
  submittedBy: null,
};

describe('ApprovalsWorkspace · 提交人', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'approval.view'];
    loadApprovalsList.mockReset();
    localStorage.clear();
  });

  it('有提交人 → 显示 userId；无提交人 → 显示「—」', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    loadApprovalsList.mockResolvedValue({
      ok: true,
      rows: [docWithSubmitter, docWithoutSubmitter],
    });
    render(<ApprovalsWorkspace />);

    expect(await screen.findByText(`提交人：${SUBMITTER}`)).toBeInTheDocument();
    expect(screen.getByText('提交人：—')).toBeInTheDocument();
  });

  it('submitterLabel 对空串 / 空白一律给「—」，不假装有值', () => {
    expect(submitterLabel(SUBMITTER)).toBe(SUBMITTER);
    expect(submitterLabel(null)).toBe('—');
    expect(submitterLabel(undefined)).toBe('—');
    expect(submitterLabel('   ')).toBe('—');
  });
});
