/**
 * 目标：文档行展开须展示入库报告；无报告须出「暂无入库报告」。
 * 需求：功能表 §4.3 入库报告入口
 * 被测：DocumentsWorkspace · reportsForDoc
 * 简介：库级 GET 后按本行 doc 过滤；HTTP 真值在 api。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent } from '@/test/test-utils';
import { reportsForDoc } from '@/app/(ops)/documents/report.services';
import type { IngestReportItem } from '@strict-rag/contracts';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadDocumentList = vi.fn();
const loadDocumentDetail = vi.fn();
const loadIngestReports = vi.fn();

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
  saveDocumentMeta: async () => ({ ok: true }),
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
    loadIngestReports: (...args: unknown[]) => loadIngestReports(...args),
  };
});

vi.mock('@/app/(ops)/documents/reindex.services', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/(ops)/documents/reindex.services')>();
  return {
    ...actual,
    planReindexChunkStrategy: async () => ({ ok: false, message: 'skip' }),
  };
});

vi.mock('@/app/(ops)/documents/upload.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/upload.services')>();
  return {
    ...actual,
    uploadAdminDocument: async () => ({ ok: false, message: 'skip' }),
  };
});

import { DocumentsWorkspace } from '@/app/(ops)/documents/_components/documents-workspace';

const DOC_ID = '018f0000-0000-7000-8000-0000000000d1';
const OTHER_ID = '018f0000-0000-7000-8000-0000000000d2';
const KB_ID = '018f0000-0000-7000-8000-0000000000k1';

const listDoc = {
  id: DOC_ID,
  title: '请假制度',
  status: 'ready',
  approvalStatus: 'approved',
  lifecycle: 'active',
  byteSize: 100,
  indexVersion: 1,
  errorCode: null,
  embedReady: true,
  esReady: true,
  ownerDeptId: null as string | null,
  visibilityLevel: 20 as const,
  docType: null as string | null,
  aclPrincipals: null as string[] | null,
};

const detailDoc = {
  ...listDoc,
  tenantId: '018f0000-0000-7000-8000-0000000000t1',
  kbId: KB_ID,
};

const mine: IngestReportItem = {
  id: '01900000-0000-7000-8000-0000000000a1',
  kbId: KB_ID,
  docId: DOC_ID,
  indexVersion: 1,
  chunkCount: 3,
  internalDropped: 1,
  crossDocDropped: 1,
  conflictPairs: [
    {
      otherDocId: OTHER_ID,
      otherChunkId: '018f0000-0000-7000-8000-0000000000c2',
      action: 'skip_index' as const,
    },
  ],
  dualReady: true,
  embedReady: true,
  esReady: true,
  reconcile: { ok: true, missingCount: 0, orphanCount: 0 },
  createdAt: '2026-08-30 12:00:00',
};

const other: IngestReportItem = { ...mine, id: '01900000-0000-7000-8000-0000000000a2', docId: OTHER_ID };

describe('reportsForDoc', () => {
  it('只留下本行文档', () => {
    expect(reportsForDoc([mine, other], DOC_ID)).toEqual([mine]);
  });
});

describe('DocumentsWorkspace 入库报告', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockReset();
    loadDocumentDetail.mockReset();
    loadIngestReports.mockReset();
    localStorage.clear();
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
  });

  it('无报告显示暂无入库报告', async () => {
    loadIngestReports.mockResolvedValue({ ok: true, reports: [] });
    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));
    expect(await screen.findByText('入库报告')).toBeInTheDocument();
    expect(screen.getByText('暂无入库报告')).toBeInTheDocument();
    expect(loadIngestReports).toHaveBeenCalledWith(KB_ID);
  });

  it('只展示本行报告，不展示他文档', async () => {
    loadIngestReports.mockResolvedValue({ ok: true, reports: [mine, other] });
    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));
    expect(
      await screen.findByText(/v1 · 分片 3 · 文档内去重 1 · 跨文档去重 1/),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`冲突 ${OTHER_ID}`))).toBeInTheDocument();
    expect(screen.getByText(/双就绪/)).toBeInTheDocument();
    expect(screen.queryByText('暂无入库报告')).not.toBeInTheDocument();
  });
});
