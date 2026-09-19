/**
 * 目标：卡在 OCR 闸的文档必须在 admin 文档列表可见（需 OCR + 原始串），且不得被当成可上架。
 * 需求：剧本 Q1 · prds/10-delivery/03-acceptance-scenarios.md · ADR-043
 * 被测：DocumentsWorkspace 列表运营列与生命周期入口
 * 简介：mock services；status=needs_ocr 行显示「需 OCR」与 needs_ocr · draft、向量/稀疏未就绪；
 *       有 doc.lifecycle 时该行不得出现「上架 active」。HTTP 真值在 api。
 */

import { within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadDocumentList = vi.fn();
const loadDocumentDetail = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/documents/list.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/list.services')>();
  return {
    ...actual,
    loadDocumentList: (...args: unknown[]) => loadDocumentList(...args),
  };
});

vi.mock('@/app/(ops)/documents/meta.services', () => ({
  loadDocumentDetail: (...args: unknown[]) => loadDocumentDetail(...args),
  saveDocumentMeta: async () => ({ ok: false, message: '本测例不写' }),
  loadDepartmentOptions: async () => ({ ok: true, departments: [] }),
  loadKbDocTypes: async () => ({ ok: true, docTypes: [] }),
}));

vi.mock('@/app/(ops)/documents/jobs.services', () => ({
  loadIngestJobs: async () => ({ ok: true, jobs: [] }),
}));

vi.mock('@/app/(ops)/documents/report.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/report.services')>();
  return {
    ...actual,
    loadIngestReports: async () => ({ ok: true, reports: [] }),
  };
});

import { DocumentsWorkspace } from '@/app/(ops)/documents/_components/documents-workspace';

const DOC_ID = '018f0000-0000-7000-8000-0000000000d9';

const needsOcrRow = {
  id: DOC_ID,
  title: '扫描件制度',
  status: 'needs_ocr',
  approvalStatus: 'approved',
  lifecycle: 'draft',
  byteSize: 100,
  indexVersion: 0,
  errorCode: 'NO_TEXT_LAYER',
  embedReady: false,
  esReady: false,
  ownerDeptId: null,
  visibilityLevel: 20 as const,
  docType: null,
  aclPrincipals: null,
};

beforeEach(() => {
  me.permissions = ['admin.shell', 'doc.view'];
  loadDocumentList.mockReset();
  loadDocumentDetail.mockReset();
  localStorage.clear();
});

describe('剧本 Q1 · admin 列表可见 needs_ocr', () => {
  it('运营列显示「需 OCR」与原始串，向量/稀疏列仍未就绪', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    loadDocumentList.mockResolvedValue({ ok: true, rows: [needsOcrRow] });

    render(<DocumentsWorkspace />);

    expect(await screen.findByText('扫描件制度')).toBeInTheDocument();
    const row = screen.getByText('扫描件制度').closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row!).getAllByRole('cell');
    const operators = cells.find((cell) => cell.textContent?.includes('需 OCR'));
    expect(operators).toBeTruthy();
    expect(operators).toHaveTextContent('needs_ocr · draft');
    expect(cells.filter((cell) => cell.textContent === '未就绪')).toHaveLength(2);
    expect(loadDocumentList).toHaveBeenCalledWith('kb-1');
  });

  it('有 doc.lifecycle：needs_ocr 行可归档但不得出现「上架 active」', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.lifecycle'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [needsOcrRow] });
    loadDocumentDetail.mockResolvedValue({
      ok: true,
      detail: { ...needsOcrRow, tenantId: 't-1', kbId: 'kb-1' },
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('扫描件制度'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '归档 archived' })).toBeInTheDocument();
    });
    // 非 ready 不得上架：入口本身不出现（不是禁用后仍可点）
    expect(screen.queryByRole('button', { name: '上架 active' })).not.toBeInTheDocument();
  });
});
