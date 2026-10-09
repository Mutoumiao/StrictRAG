/**
 * 目标：文档页须从已加载的入库报告里列出跨文档待审冲突（pending_review + heldChunkId），有 doc.editor 可二选一处置；
 *      无 doc.editor 只读并说明不可处置；处置后报告不改写、该行停用，保留本块须提示自行 Reindex。
 * 需求：功能表 §4.3 · prds/04-pipelines/01-offline-ingest.md §5.1 · 剧本 E4
 * 被测：DocumentsWorkspace · pendingReviewConflicts · dedupeWinnerLabel · resolvePendingConflict
 * 简介：数据来自页面已拉取的入库报告（不新增读端点）；失败文案来自 mapBizError；HTTP 真值在 api。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IngestReportItem } from '@strict-rag/contracts';

import { render, screen, userEvent } from '@/test/test-utils';
import {
  dedupeWinnerLabel,
  pendingReviewConflicts,
  resolvePendingConflict,
} from '@/app/(ops)/documents/dedupe-review.services';
import { ApiHttpError } from '@/lib/http';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadDocumentList = vi.fn();
const loadDocumentDetail = vi.fn();
const loadIngestReports = vi.fn();
const resolveDedupeConflict = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/documents/list.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/list.services')>();
  return { ...actual, loadDocumentList: (...args: unknown[]) => loadDocumentList(...args) };
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
  return { ...actual, loadIngestReports: (...args: unknown[]) => loadIngestReports(...args) };
});

vi.mock('@/app/(ops)/documents/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/api')>();
  return {
    ...actual,
    resolveDedupeConflict: (...args: unknown[]) => resolveDedupeConflict(...args),
  };
});

vi.mock('@/app/(ops)/documents/reindex.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/reindex.services')>();
  return { ...actual, planReindexChunkStrategy: async () => ({ ok: false, message: 'skip' }) };
});

vi.mock('@/app/(ops)/documents/upload.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/upload.services')>();
  return { ...actual, uploadAdminDocument: async () => ({ ok: false, message: 'skip' }) };
});

import { DocumentsWorkspace } from '@/app/(ops)/documents/_components/documents-workspace';

const DOC_ID = '018f0000-0000-7000-8000-0000000000d1';
const OTHER_ID = '018f0000-0000-7000-8000-0000000000d2';
const OTHER_ID_B = '018f0000-0000-7000-8000-0000000000d3';
const KB_ID = '018f0000-0000-7000-8000-0000000000k1';
const HELD = '018f0000-0000-7000-8000-0000000000c1';
const OTHER_CHUNK = '018f0000-0000-7000-8000-0000000000c2';

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

const detailDoc = { ...listDoc, tenantId: '018f0000-0000-7000-8000-0000000000t1', kbId: KB_ID };

function reportWith(pairs: IngestReportItem['conflictPairs']): IngestReportItem {
  return {
    id: '01900000-0000-7000-8000-0000000000a1',
    kbId: KB_ID,
    docId: DOC_ID,
    indexVersion: 1,
    chunkCount: 3,
    internalDropped: 0,
    crossDocDropped: 1,
    dedupeCrossDocRate: 0.25,
    contextSource: 'l0' as const,
    contextualizeL1Ok: 3,
    contextualizeL0Fallback: 0,
    conflictPairs: pairs,
    dualReady: true,
    embedReady: true,
    esReady: true,
    reconcile: { ok: true, missingCount: 0, orphanCount: 0 },
    createdAt: '2026-08-30 12:00:00',
  };
}

const pendingPair = {
  otherDocId: OTHER_ID,
  otherChunkId: OTHER_CHUNK,
  action: 'pending_review' as const,
  heldChunkId: HELD,
};

const skipPair = {
  otherDocId: OTHER_ID_B,
  otherChunkId: '018f0000-0000-7000-8000-0000000000c3',
  action: 'skip_index' as const,
};

/** 契约允许 `heldChunkId` 出现在任何 pair 上；这里刻意给 `skip_index` 也带上，钉住「只有 pending_review 才可处置」。 */
const skipPairWithHeld = {
  otherDocId: OTHER_ID_B,
  otherChunkId: '018f0000-0000-7000-8000-0000000000c4',
  action: 'skip_index' as const,
  heldChunkId: '018f0000-0000-7000-8000-0000000000c5',
};

async function openRow() {
  render(<DocumentsWorkspace />);
  const user = userEvent.setup();
  await user.click(await screen.findByText('请假制度'));
  return user;
}

describe('pendingReviewConflicts / dedupeWinnerLabel', () => {
  it('只挑 pending_review 且带 heldChunkId 的项；skip_index 与缺 heldChunkId 都不进', () => {
    const reports = [
      reportWith([
        pendingPair,
        skipPair,
        skipPairWithHeld,
        { otherDocId: OTHER_ID, otherChunkId: OTHER_CHUNK, action: 'pending_review', heldChunkId: '' },
      ]),
    ];
    expect(pendingReviewConflicts(reports)).toEqual([
      { heldChunkId: HELD, otherDocId: OTHER_ID, otherChunkId: OTHER_CHUNK },
    ]);
    expect(pendingReviewConflicts([reportWith([skipPair])])).toEqual([]);
    expect(pendingReviewConflicts([reportWith([skipPairWithHeld])])).toEqual([]);
  });

  it('同一 heldChunkId 跨版本只列一次', () => {
    const reports = [reportWith([pendingPair]), reportWith([pendingPair])];
    expect(pendingReviewConflicts(reports)).toHaveLength(1);
  });

  it('两选项文案固定', () => {
    expect(dedupeWinnerLabel('this')).toBe('保留本块');
    expect(dedupeWinnerLabel('other')).toBe('保留对方块');
  });
});

describe('resolvePendingConflict', () => {
  beforeEach(() => {
    resolveDedupeConflict.mockReset();
  });

  it('winner=this：回 reindexRequired 并给「须自行 Reindex」文案', async () => {
    resolveDedupeConflict.mockResolvedValue({
      docId: DOC_ID,
      chunkId: HELD,
      winner: 'this',
      reindexRequired: true,
    });
    const res = await resolvePendingConflict({ docId: DOC_ID, heldChunkId: HELD, winner: 'this' });
    expect(resolveDedupeConflict).toHaveBeenCalledWith(DOC_ID, HELD, { winner: 'this' });
    expect(res).toMatchObject({ ok: true, reindexRequired: true });
    expect((res as { message: string }).message).toContain('Reindex');
  });

  it('winner=other：无需 reindex', async () => {
    resolveDedupeConflict.mockResolvedValue({
      docId: DOC_ID,
      chunkId: HELD,
      winner: 'other',
      reindexRequired: false,
    });
    const res = await resolvePendingConflict({ docId: DOC_ID, heldChunkId: HELD, winner: 'other' });
    expect(res).toMatchObject({ ok: true, reindexRequired: false });
  });

  it('非待审（400）判终态；网络类错误不判终态', async () => {
    resolveDedupeConflict.mockRejectedValue(
      new ApiHttpError('VALIDATION_ERROR', 'chunk is not pending_review', false),
    );
    const terminal = await resolvePendingConflict({
      docId: DOC_ID,
      heldChunkId: HELD,
      winner: 'this',
    });
    expect(terminal).toMatchObject({ ok: false, terminal: true });

    resolveDedupeConflict.mockRejectedValue(new Error('network down'));
    const retryable = await resolvePendingConflict({
      docId: DOC_ID,
      heldChunkId: HELD,
      winner: 'this',
    });
    expect(retryable).toMatchObject({ ok: false, terminal: false });
  });
});

describe('DocumentsWorkspace 待审冲突', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor'];
    loadDocumentList.mockReset();
    loadDocumentDetail.mockReset();
    loadIngestReports.mockReset();
    resolveDedupeConflict.mockReset();
    localStorage.clear();
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
  });

  it('有 doc.editor：列出待审块并可选两个选项', async () => {
    loadIngestReports.mockResolvedValue({ ok: true, reports: [reportWith([pendingPair, skipPairWithHeld])] });
    await openRow();
    expect(await screen.findByText(/待审冲突（跨文档近重复 · 人工二选一）/)).toBeInTheDocument();
    expect(screen.getByText('保留本块')).toBeInTheDocument();
    expect(screen.getByText('保留对方块')).toBeInTheDocument();
    // `skip_index`（即便带 heldChunkId）不进处置面 —— 只剩一条待审
    expect(screen.getAllByText('保留本块')).toHaveLength(1);
    expect(screen.getByText(new RegExp(`本块 ${HELD}`))).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`本块 ${skipPairWithHeld.heldChunkId}`))).not.toBeInTheDocument();
  });

  it('点「保留本块」：按 heldChunkId 发请求、提示自行 Reindex、该行停用', async () => {
    loadIngestReports.mockResolvedValue({ ok: true, reports: [reportWith([pendingPair])] });
    resolveDedupeConflict.mockResolvedValue({
      docId: DOC_ID,
      chunkId: HELD,
      winner: 'this',
      reindexRequired: true,
    });
    const user = await openRow();
    await user.click(await screen.findByText('保留本块'));
    expect(resolveDedupeConflict).toHaveBeenCalledWith(DOC_ID, HELD, { winner: 'this' });
    expect(await screen.findByText(/已保留本块：须对本文档重新入库（Reindex）/)).toBeInTheDocument();
    expect(screen.getByText(/已处置/)).toBeInTheDocument();
    expect(screen.queryByText('保留本块')).not.toBeInTheDocument();
  });

  it('终态失败（非待审）也停用该行，避免反复点', async () => {
    loadIngestReports.mockResolvedValue({ ok: true, reports: [reportWith([pendingPair])] });
    resolveDedupeConflict.mockRejectedValue(
      new ApiHttpError('VALIDATION_ERROR', 'chunk is not pending_review', false),
    );
    const user = await openRow();
    await user.click(await screen.findByText('保留本块'));
    expect(await screen.findByText(/VALIDATION_ERROR: chunk is not pending_review/)).toBeInTheDocument();
    expect(screen.getByText(/已处置/)).toBeInTheDocument();
  });

  it('无 doc.editor：列出待审块但说明不可处置、不给按钮', async () => {
    me.permissions = ['admin.shell', 'doc.view'];
    loadIngestReports.mockResolvedValue({ ok: true, reports: [reportWith([pendingPair])] });
    await openRow();
    expect(await screen.findByText(/待审冲突（跨文档近重复 · 人工二选一）/)).toBeInTheDocument();
    expect(screen.getByText(/无 doc.editor，不可处置/)).toBeInTheDocument();
    expect(screen.queryByText('保留本块')).not.toBeInTheDocument();
    expect(resolveDedupeConflict).not.toHaveBeenCalled();
  });

  it('报告里只有 skip_index 时不出现待审区', async () => {
    loadIngestReports.mockResolvedValue({ ok: true, reports: [reportWith([skipPair])] });
    await openRow();
    expect(await screen.findByText('入库报告')).toBeInTheDocument();
    expect(
      screen.queryByText(/待审冲突（跨文档近重复 · 人工二选一）/),
    ).not.toBeInTheDocument();
  });
});
