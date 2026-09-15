/**
 * 目标：文档列表薄页必须按码控制详情/保存/部门列，失败则运营交互与权限不符。
 * 需求：文档运营 UI
 * 被测：DocumentsWorkspace · deptLabel / readyColLabel / visibilityLabel
 * 简介：部门列展示；行展开可编辑 aclPrincipals 名单；创建面可标新文档部门。
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
const saveDocumentMeta = vi.fn();
const loadDepartmentOptions = vi.fn();

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
  saveDocumentMeta: (...args: unknown[]) => saveDocumentMeta(...args),
  loadDepartmentOptions: (...args: unknown[]) => loadDepartmentOptions(...args),
  loadKbDocTypes: async () => ({ ok: true, docTypes: ['policy', 'hr'] }),
}));

const planReindexChunkStrategy = vi.fn();
const reindexAdminDocument = vi.fn();
vi.mock('@/app/(ops)/documents/reindex.services', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/(ops)/documents/reindex.services')>();
  return {
    ...actual,
    planReindexChunkStrategy: (...args: unknown[]) => planReindexChunkStrategy(...args),
    reindexAdminDocument: (...args: unknown[]) => reindexAdminDocument(...args),
  };
});

const uploadAdminDocument = vi.fn();
const planUploadChunkStrategy = vi.fn();
vi.mock('@/app/(ops)/documents/upload.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/upload.services')>();
  return {
    ...actual,
    uploadAdminDocument: (...args: unknown[]) => uploadAdminDocument(...args),
    planUploadChunkStrategy: (...args: unknown[]) => planUploadChunkStrategy(...args),
  };
});

const writeAdminDocument = vi.fn();
const planWriteChunkStrategy = vi.fn();
vi.mock('@/app/(ops)/documents/write.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/write.services')>();
  return {
    ...actual,
    writeAdminDocument: (...args: unknown[]) => writeAdminDocument(...args),
    planWriteChunkStrategy: (...args: unknown[]) => planWriteChunkStrategy(...args),
  };
});

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

const setDocumentLifecycle = vi.fn(
  async (_docId: string, lifecycle: 'active' | 'draft' | 'archived' | 'superseded') => ({
    ok: true as const,
    lifecycle,
  }),
);
const supersedeAdminDocument = vi.fn(
  async (oldDocId: string, successorDocId: string) => ({
    ok: true as const,
    data: {
      oldDocId,
      successorDocId,
      oldLifecycle: 'superseded' as const,
      successorLifecycle: 'active' as const,
    },
  }),
);
const deleteAdminDocument = vi.fn(async (docId: string) => ({
  ok: true as const,
  data: {
    docId,
    lifecycle: 'archived' as const,
    purgeEnqueued: true as const,
  },
}));
vi.mock('@/app/(ops)/documents/lifecycle.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/documents/lifecycle.services')>();
  return {
    ...actual,
    setDocumentLifecycle: (...args: unknown[]) =>
      setDocumentLifecycle(...(args as [string, 'active' | 'draft' | 'archived' | 'superseded'])),
    supersedeAdminDocument: (...args: unknown[]) =>
      supersedeAdminDocument(...(args as [string, string])),
    deleteAdminDocument: (...args: unknown[]) => deleteAdminDocument(...(args as [string])),
  };
});

import { deptLabel, readyColLabel, visibilityLabel } from '@/app/(ops)/documents/list.services';
import { DocumentsWorkspace } from '@/app/(ops)/documents/_components/documents-workspace';

const DOC_ID = '018f0000-0000-7000-8000-0000000000d1';
const DOC_ID_2 = '018f0000-0000-7000-8000-0000000000d2';
const DEPT_ID = '01900000-0000-7000-8000-0000000000de';

function detailVisibility() {
  return screen.getByLabelText('可见级', { selector: '#doc-visibility' });
}

function assertListCalledWithKbOnly() {
  expect(loadDocumentList).toHaveBeenCalled();
  expect(loadDocumentList.mock.calls.every((c) => c.length === 1 && c[0] === 'kb-1')).toBe(true);
}

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
  kbId: '018f0000-0000-7000-8000-0000000000k1',
  ownerDeptId: null,
  visibilityLevel: 20 as const,
};

const deptOption = {
  id: DEPT_ID,
  parentId: null,
  name: '人事部',
  code: 'hr',
  sort: 0,
  status: 'active' as const,
};

describe('DocumentsWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadDocumentList.mockReset();
    loadDocumentDetail.mockReset();
    saveDocumentMeta.mockReset();
    loadDepartmentOptions.mockReset();
    uploadAdminDocument.mockReset();
    planUploadChunkStrategy.mockReset();
    writeAdminDocument.mockReset();
    planWriteChunkStrategy.mockReset();
    planReindexChunkStrategy.mockReset();
    reindexAdminDocument.mockReset();
    setDocumentLifecycle.mockClear();
    supersedeAdminDocument.mockClear();
    deleteAdminDocument.mockClear();
    localStorage.clear();
  });

  it('列表展示向量/稀疏列；稀疏就绪 ≠ 生产 ES；list 仍只带 kbId', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({
      ok: true,
      rows: [{ ...listDoc, embedReady: true, esReady: false }],
    });

    render(<DocumentsWorkspace />);

    expect(await screen.findByRole('columnheader', { name: '向量' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '稀疏' })).toBeInTheDocument();
    expect(screen.getByText(/≠\s*生产 ES/)).toBeInTheDocument();

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    const vectorIdx = headers.indexOf('向量');
    const sparseIdx = headers.indexOf('稀疏');
    const row = (await screen.findByText('请假制度')).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row!).getAllByRole('cell');
    expect(cells[vectorIdx]).toHaveTextContent('就绪');
    expect(cells[sparseIdx]).toHaveTextContent('未就绪');
    assertListCalledWithKbOnly();
  });

  it('列表能看到部门与可见级', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({
      ok: true,
      rows: [{ ...listDoc, ownerDeptId: DEPT_ID, visibilityLevel: 30 }],
    });

    render(<DocumentsWorkspace />);

    expect(await screen.findByRole('columnheader', { name: '部门' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '可见级' })).toBeInTheDocument();
    expect(screen.getByText(DEPT_ID)).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '30 负责人' })).toBeInTheDocument();
    expect(loadDepartmentOptions).not.toHaveBeenCalled();
  });

  it('有 dept.manage 且部门树已加载：部门列显示名称，title 仍为 uuid', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'dept.manage'];
    loadDocumentList.mockResolvedValue({
      ok: true,
      rows: [{ ...listDoc, ownerDeptId: DEPT_ID, visibilityLevel: 30 }],
    });
    loadDepartmentOptions.mockResolvedValue({ ok: true, departments: [deptOption] });

    render(<DocumentsWorkspace />);

    const cell = await screen.findByRole('cell', { name: '人事部' });
    expect(within(cell).getByTitle(DEPT_ID)).toHaveTextContent('人事部');
    expect(screen.queryByRole('cell', { name: DEPT_ID })).not.toBeInTheDocument();
    assertListCalledWithKbOnly();
  });

  it('库级行部门列仍是 —；未知部门 id 仍显示 uuid', async () => {
    const unknownId = '01900000-0000-7000-8000-0000000000xx';
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'dept.manage'];
    loadDocumentList.mockResolvedValue({
      ok: true,
      rows: [
        { ...listDoc, ownerDeptId: null, visibilityLevel: 20 },
        {
          ...listDoc,
          id: DOC_ID_2,
          title: '报销制度',
          ownerDeptId: unknownId,
          visibilityLevel: 30,
        },
      ],
    });
    loadDepartmentOptions.mockResolvedValue({ ok: true, departments: [deptOption] });

    render(<DocumentsWorkspace />);

    expect(await screen.findByText('请假制度')).toBeInTheDocument();
    await waitFor(() => {
      expect(loadDepartmentOptions).toHaveBeenCalled();
    });
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: unknownId })).toBeInTheDocument();
    assertListCalledWithKbOnly();
  });

  it('有 doc.editor：点行后能看到两字段 + 保存按钮', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    expect(await screen.findByLabelText('归属部门')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '仅名单可见' })).toBeInTheDocument();
    expect(screen.getByLabelText('可见用户 uuid')).toBeInTheDocument();
    expect(detailVisibility()).toBeInTheDocument();
    expect(within(detailVisibility()).getByRole('option', { name: '20 部门成员' })).toBeInTheDocument();
    expect(within(detailVisibility()).getByRole('option', { name: '30 负责人' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    expect(screen.getByLabelText('生效自')).toBeInTheDocument();
    expect(screen.getByLabelText('生效至')).toBeInTheDocument();
    expect(loadDocumentDetail).toHaveBeenCalledWith(DOC_ID);
    expect(screen.getByText(/空归属=库级/).closest('td')).toHaveAttribute('colspan', '7');
  });

  it('无 doc.editor：能看详情、无保存按钮', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    expect(await screen.findByLabelText('归属部门')).toBeInTheDocument();
    expect(detailVisibility()).toBeInTheDocument();
    expect(screen.getByLabelText('归属部门')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '仅名单可见' })).toBeDisabled();
    expect(screen.getByLabelText('可见用户 uuid')).toBeDisabled();
    expect(screen.getByLabelText('生效自')).toBeDisabled();
    expect(screen.getByLabelText('生效至')).toBeDisabled();
    expect(detailVisibility()).toBeDisabled();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });

  it('保存走 saveDocumentMeta', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
    saveDocumentMeta.mockResolvedValue({
      ok: true,
      detail: { ...detailDoc, ownerDeptId: DEPT_ID, visibilityLevel: 30 },
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));
    await screen.findByLabelText('归属部门');
    await user.type(screen.getByLabelText('归属部门'), DEPT_ID);
    await user.selectOptions(detailVisibility(), '30');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveDocumentMeta).toHaveBeenCalledWith(DOC_ID, {
        ownerDeptId: DEPT_ID,
        visibilityLevel: 30,
        docType: null,
        aclPrincipals: null,
        effectiveFrom: null,
        effectiveTo: null,
      });
    });
    expect(screen.getByLabelText('归属部门')).toHaveValue(DEPT_ID);
    expect(detailVisibility()).toHaveValue('30');
    expect(screen.getByText('已保存')).toBeInTheDocument();
  });

  it('保存生效区间走本地时间串', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
    saveDocumentMeta.mockResolvedValue({
      ok: true,
      detail: {
        ...detailDoc,
        effectiveFrom: '2026-09-01 00:00:00',
        effectiveTo: '2026-09-30 00:00:00',
      },
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));
    await user.type(await screen.findByLabelText('生效自'), '2026-09-01 00:00:00');
    await user.type(screen.getByLabelText('生效至'), '2026-09-30 00:00:00');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveDocumentMeta).toHaveBeenCalledWith(DOC_ID, {
        ownerDeptId: null,
        visibilityLevel: 20,
        docType: null,
        aclPrincipals: null,
        effectiveFrom: '2026-09-01 00:00:00',
        effectiveTo: '2026-09-30 00:00:00',
      });
    });
  });

  it('保存失败时展示 API 文案，不本地发明码', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
    saveDocumentMeta.mockResolvedValue({
      ok: false,
      message: 'VALIDATION_ERROR: ownerDeptId must be uuid',
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));
    await screen.findByLabelText('归属部门');
    await user.type(screen.getByLabelText('归属部门'), 'not-a-uuid');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('VALIDATION_ERROR: ownerDeptId must be uuid')).toBeInTheDocument();
    expect(screen.queryByText('已保存')).not.toBeInTheDocument();
  });

  it('无 dept.manage：归属部门仍是文本框，不请求部门接口，不整页 403', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    const field = await screen.findByLabelText('归属部门');
    expect(field.tagName).toBe('INPUT');
    expect(screen.getByRole('textbox', { name: '归属部门' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '归属部门' })).not.toBeInTheDocument();
    expect(loadDepartmentOptions).not.toHaveBeenCalled();
    expect(screen.queryByText(/403/)).not.toBeInTheDocument();
    expect(screen.queryByText(/无 dept.manage/)).not.toBeInTheDocument();
  });

  it('有 dept.manage + doc.editor：下拉含库级，选部门后保存带 uuid', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor', 'dept.manage'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
    loadDepartmentOptions.mockResolvedValue({ ok: true, departments: [deptOption] });
    saveDocumentMeta.mockResolvedValue({
      ok: true,
      detail: { ...detailDoc, ownerDeptId: DEPT_ID, visibilityLevel: 20 },
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    const field = await screen.findByLabelText('归属部门');
    expect(field.tagName).toBe('SELECT');
    expect(screen.getByRole('combobox', { name: '归属部门' })).toBeInTheDocument();
    expect(within(field).getByRole('option', { name: '库级' })).toBeInTheDocument();
    expect(within(field).getByRole('option', { name: '人事部' })).toBeInTheDocument();
    expect(loadDepartmentOptions).toHaveBeenCalledTimes(1);

    await user.selectOptions(field, DEPT_ID);
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveDocumentMeta).toHaveBeenCalledWith(DOC_ID, {
        ownerDeptId: DEPT_ID,
        visibilityLevel: 20,
        docType: null,
        aclPrincipals: null,
        effectiveFrom: null,
        effectiveTo: null,
      });
    });
    expect(screen.getByText('已保存')).toBeInTheDocument();
  });

  it('勾选仅名单可见且名单空 → PATCH []', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
    saveDocumentMeta.mockResolvedValue({
      ok: true,
      detail: { ...detailDoc, aclPrincipals: [] },
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));
    await screen.findByLabelText('可见用户 uuid');
    await user.click(screen.getByRole('checkbox', { name: '仅名单可见' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveDocumentMeta).toHaveBeenCalledWith(DOC_ID, {
        ownerDeptId: null,
        visibilityLevel: 20,
        docType: null,
        aclPrincipals: [],
        effectiveFrom: null,
        effectiveTo: null,
      });
    });
  });

  it('有 dept.manage 无 doc.editor：下拉只读、无保存', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'dept.manage'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
    loadDepartmentOptions.mockResolvedValue({ ok: true, departments: [deptOption] });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    const field = await screen.findByLabelText('归属部门');
    expect(field.tagName).toBe('SELECT');
    expect(field).toBeDisabled();
    expect(detailVisibility()).toBeDisabled();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });

  it('部门列表失败：展示错误，不假装已保存', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor', 'dept.manage'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
    loadDepartmentOptions.mockResolvedValue({
      ok: false,
      message: 'FORBIDDEN: 需要 dept.manage',
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    expect((await screen.findAllByText('FORBIDDEN: 需要 dept.manage')).length).toBeGreaterThan(0);
    expect(screen.queryByText('已保存')).not.toBeInTheDocument();
    expect((await screen.findByLabelText('归属部门')).tagName).toBe('INPUT');
  });

  const libRow = { ...listDoc, ownerDeptId: null, visibilityLevel: 20 as const };
  const deptRow = {
    ...listDoc,
    id: DOC_ID_2,
    title: '报销制度',
    ownerDeptId: DEPT_ID,
    visibilityLevel: 30 as const,
  };

  it('默认不筛：库级行与部门行都在，且 list 只带 kbId', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [libRow, deptRow] });

    render(<DocumentsWorkspace />);

    expect(await screen.findByText('请假制度')).toBeInTheDocument();
    expect(screen.getByText('报销制度')).toBeInTheDocument();
    expect(screen.getByLabelText('部门')).toHaveValue('all');
    const visFilter = screen.getByLabelText('可见级', { selector: '#doc-filter-visibility' });
    expect(visFilter).toHaveValue('all');
    expect(within(visFilter).getByRole('option', { name: '10 部门全员' })).toBeInTheDocument();
    expect(within(visFilter).getByRole('option', { name: '20 部门成员' })).toBeInTheDocument();
    expect(within(visFilter).getByRole('option', { name: '30 负责人' })).toBeInTheDocument();
    expect(within(visFilter).getByRole('option', { name: '40 受限' })).toBeInTheDocument();
    assertListCalledWithKbOnly();
  });

  it('选库级：只留 ownerDeptId 为空的行', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [libRow, deptRow] });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await screen.findByText('请假制度');
    await user.selectOptions(screen.getByLabelText('部门'), 'lib');

    expect(screen.getByText('请假制度')).toBeInTheDocument();
    expect(screen.queryByText('报销制度')).not.toBeInTheDocument();
    assertListCalledWithKbOnly();
  });

  it('选可见级 30：只留 level 30', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [libRow, deptRow] });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await screen.findByText('请假制度');
    await user.selectOptions(
      screen.getByLabelText('可见级', { selector: '#doc-filter-visibility' }),
      '30',
    );

    expect(screen.getByText('报销制度')).toBeInTheDocument();
    expect(screen.queryByText('请假制度')).not.toBeInTheDocument();
    assertListCalledWithKbOnly();
  });

  it('部门+可见级 AND', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'dept.manage'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [libRow, deptRow] });
    loadDepartmentOptions.mockResolvedValue({ ok: true, departments: [deptOption] });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await screen.findByText('请假制度');
    const deptFilter = screen.getByLabelText('部门');
    await waitFor(() => {
      expect(within(deptFilter).getByRole('option', { name: '人事部' })).toBeInTheDocument();
    });

    await user.selectOptions(deptFilter, DEPT_ID);
    expect(screen.getByText('报销制度')).toBeInTheDocument();
    expect(screen.queryByText('请假制度')).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('可见级', { selector: '#doc-filter-visibility' }),
      '20',
    );
    expect(screen.queryByText('报销制度')).not.toBeInTheDocument();
    expect(screen.queryByText('请假制度')).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('可见级', { selector: '#doc-filter-visibility' }),
      '30',
    );
    expect(screen.getByText('报销制度')).toBeInTheDocument();
    expect(screen.queryByText('请假制度')).not.toBeInTheDocument();
    assertListCalledWithKbOnly();
  });

  it('列表有类型列与运营标签 现行可问；原串作次要信息', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({
      ok: true,
      rows: [{ ...listDoc, docType: 'policy' }],
    });

    render(<DocumentsWorkspace />);

    expect(await screen.findByRole('columnheader', { name: '类型' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '运营' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'policy' })).toBeInTheDocument();
    expect(screen.getByText('现行可问')).toBeInTheDocument();
    expect(screen.getByText('ready · active')).toBeInTheDocument();
  });

  it('有 doc.lifecycle：ready+draft 可上架/废止/归档', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.lifecycle'];
    loadDocumentList.mockResolvedValue({
      ok: true,
      rows: [{ ...listDoc, lifecycle: 'draft' }],
    });
    loadDocumentDetail.mockResolvedValue({
      ok: true,
      detail: { ...detailDoc, lifecycle: 'draft' },
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    expect(await screen.findByRole('button', { name: '上架 active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '废止 superseded' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '归档 archived' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '归档 archived' }));
    await waitFor(() => {
      expect(setDocumentLifecycle).toHaveBeenCalledWith(DOC_ID, 'archived');
    });
    expect(screen.getAllByText('已归档').length).toBeGreaterThan(0);
  });

  it('有 doc.lifecycle：未选后继不可替代；选后走 supersede 不走 PATCH lifecycle', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.lifecycle'];
    loadDocumentList.mockResolvedValue({
      ok: true,
      rows: [
        { ...listDoc, lifecycle: 'active' },
        { ...listDoc, id: DOC_ID_2, title: '报销制度', lifecycle: 'draft' },
      ],
    });
    loadDocumentDetail.mockResolvedValue({
      ok: true,
      detail: { ...detailDoc, lifecycle: 'active' },
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    const replaceBtn = await screen.findByRole('button', { name: '替代为后继' });
    expect(replaceBtn).toBeDisabled();
    await user.click(screen.getByLabelText('后继文档'));
    await user.click(await screen.findByRole('option', { name: '报销制度' }));
    expect(replaceBtn).toBeEnabled();
    await user.click(replaceBtn);
    await waitFor(() => {
      expect(supersedeAdminDocument).toHaveBeenCalledWith(DOC_ID, DOC_ID_2);
    });
    expect(setDocumentLifecycle).not.toHaveBeenCalled();
    expect(screen.getAllByText('已替代为后继').length).toBeGreaterThan(0);
  });

  it('有 doc.lifecycle：删除走 DELETE 不走 PATCH lifecycle', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.lifecycle'];
    loadDocumentList.mockResolvedValue({
      ok: true,
      rows: [{ ...listDoc, lifecycle: 'active' }],
    });
    loadDocumentDetail.mockResolvedValue({
      ok: true,
      detail: { ...detailDoc, lifecycle: 'active' },
    });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));
    await user.click(await screen.findByRole('button', { name: '删除' }));
    await waitFor(() => {
      expect(deleteAdminDocument).toHaveBeenCalledWith(DOC_ID);
    });
    expect(setDocumentLifecycle).not.toHaveBeenCalled();
    expect(screen.getAllByText('已删除').length).toBeGreaterThan(0);
  });

  it('无 doc.lifecycle 无后继选择', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));
    await screen.findByText('现行可问');
    expect(screen.queryByLabelText('后继文档')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '替代为后继' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
  });

  it('有 doc.reindex 且 ≥2 未选：Reindex 按钮不可提交', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.reindex'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDocumentDetail.mockResolvedValue({ ok: true, detail: detailDoc });
    planReindexChunkStrategy.mockResolvedValue({
      ok: true,
      plan: {
        contentType: 'text/plain',
        family: 'txt',
        available: [
          { code: 'structure_paragraph', name: '结构段落', implemented: true, recommended: true },
          { code: 'fixed_window', name: '固定窗口', implemented: true, recommended: false },
        ],
        recommendedCode: 'structure_paragraph',
        requireExplicit: true,
        autoCode: null,
      },
    });

    reindexAdminDocument.mockResolvedValue({
      ok: true,
      data: { docId: DOC_ID, enqueued: true, jobId: 'j1', stage: 'chunk', chunkStrategy: 'fixed_window', strategyChanged: true },
    });
    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('请假制度'));

    expect(await screen.findByLabelText('分片策略')).toBeInTheDocument();
    expect(screen.getByText('分片策略（历史，只读）')).toBeInTheDocument();
    expect(screen.getByText('未记录分片策略')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Reindex' });
    expect(btn).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('分片策略'), 'fixed_window');
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    await waitFor(() => {
      expect(reindexAdminDocument).toHaveBeenCalledWith(DOC_ID, 'fixed_window');
    });
  });
});

describe('deptLabel', () => {
  const options = [{ id: DEPT_ID, name: '人事部' }];

  it('null / undefined 为 —', () => {
    expect(deptLabel(null, options)).toBe('—');
    expect(deptLabel(undefined, options)).toBe('—');
  });

  it('命中选项为名称', () => {
    expect(deptLabel(DEPT_ID, options)).toBe('人事部');
  });

  it('无选项或未知 id 为 uuid', () => {
    expect(deptLabel(DEPT_ID, null)).toBe(DEPT_ID);
    expect(deptLabel(DEPT_ID, [])).toBe(DEPT_ID);
    expect(deptLabel('unknown-id', options)).toBe('unknown-id');
  });
});

describe('readyColLabel', () => {
  it('true 就绪；false 未就绪', () => {
    expect(readyColLabel(true)).toBe('就绪');
    expect(readyColLabel(false)).toBe('未就绪');
  });

  it('有 doc.upload 才显示文件选择', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    const { rerender } = render(<DocumentsWorkspace />);
    await screen.findByText('请假制度');
    expect(screen.queryByLabelText('上传文档')).not.toBeInTheDocument();
    me.permissions = ['admin.shell', 'doc.view', 'doc.upload'];
    rerender(<DocumentsWorkspace />);
    expect(screen.getByLabelText('上传文档')).toBeInTheDocument();
  });
});

describe('DocumentsWorkspace 在线编写', () => {
  beforeEach(() => {
    me.permissions = [];
    loadDocumentList.mockReset();
    writeAdminDocument.mockReset();
    planWriteChunkStrategy.mockReset();
    localStorage.clear();
  });

  it('无 doc.editor 不显示在线编写', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    render(<DocumentsWorkspace />);
    await screen.findByText('请假制度');
    expect(screen.queryByRole('button', { name: '在线编写' })).not.toBeInTheDocument();
  });

  it('有 doc.editor 可打开编写区；空正文提交按钮不可点', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    planWriteChunkStrategy.mockResolvedValue({
      ok: true,
      plan: {
        contentType: 'text/markdown',
        family: 'md',
        available: [{ code: 'structure_paragraph', name: '结构段落', implemented: true, recommended: true }],
        recommendedCode: 'structure_paragraph',
        requireExplicit: false,
        autoCode: 'structure_paragraph',
      },
    });
    render(<DocumentsWorkspace />);
    await screen.findByText('请假制度');
    await userEvent.click(screen.getByRole('button', { name: '在线编写' }));
    await screen.findByLabelText('编写标题');
    expect(screen.getByLabelText('编写正文')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交审批' })).toBeDisabled();
  });
});

const AUTO_PLAN = {
  contentType: 'text/plain',
  family: 'txt' as const,
  available: [
    { code: 'structure_paragraph', name: '结构段落', implemented: true, recommended: true },
  ],
  recommendedCode: 'structure_paragraph',
  requireExplicit: false,
  autoCode: 'structure_paragraph',
};

describe('DocumentsWorkspace 上传标部门', () => {
  beforeEach(() => {
    me.permissions = [];
    loadDocumentList.mockReset();
    loadDepartmentOptions.mockReset();
    uploadAdminDocument.mockReset();
    planUploadChunkStrategy.mockReset();
    writeAdminDocument.mockReset();
    planWriteChunkStrategy.mockReset();
    localStorage.clear();
  });

  it('无上传也无编写不显示新文档部门控件', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    render(<DocumentsWorkspace />);
    await screen.findByText('请假制度');
    expect(screen.queryByLabelText('新文档归属部门')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('新文档可见级')).not.toBeInTheDocument();
  });

  it('有 doc.upload + dept.manage：选部门后上传带 uuid', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.upload', 'dept.manage'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDepartmentOptions.mockResolvedValue({ ok: true, departments: [deptOption] });
    planUploadChunkStrategy.mockResolvedValue({ ok: true, plan: AUTO_PLAN });
    uploadAdminDocument.mockResolvedValue({ ok: true, docId: 'd-new' });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await screen.findByText('请假制度');
    await waitFor(() => expect(loadDepartmentOptions).toHaveBeenCalled());
    const deptTrigger = await screen.findByLabelText('新文档归属部门');
    expect(deptTrigger.tagName).toBe('BUTTON');
    expect(screen.queryByRole('combobox', { name: '新文档归属部门' })).not.toBeInTheDocument();
    await user.click(deptTrigger);
    const uploadListbox = await screen.findByRole('listbox');
    await user.click(within(uploadListbox).getByRole('option', { name: '人事部' }));

    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText('上传文档'), file);

    await waitFor(() => {
      expect(uploadAdminDocument).toHaveBeenCalledWith(
        'kb-1',
        expect.any(File),
        'structure_paragraph',
        { ownerDeptId: DEPT_ID, visibilityLevel: 20 },
      );
    });
  });

  it('有 doc.editor：编写提交带创建面部门字段', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', 'kb-1');
    me.permissions = ['admin.shell', 'doc.view', 'doc.editor', 'dept.manage'];
    loadDocumentList.mockResolvedValue({ ok: true, rows: [listDoc] });
    loadDepartmentOptions.mockResolvedValue({ ok: true, departments: [deptOption] });
    planWriteChunkStrategy.mockResolvedValue({
      ok: true,
      plan: { ...AUTO_PLAN, contentType: 'text/markdown', family: 'md' },
    });
    writeAdminDocument.mockResolvedValue({ ok: true, docId: 'd-write' });

    render(<DocumentsWorkspace />);
    const user = userEvent.setup();
    await screen.findByText('请假制度');
    await waitFor(() => expect(loadDepartmentOptions).toHaveBeenCalled());
    await user.click(screen.getByLabelText('新文档归属部门'));
    const writeListbox = await screen.findByRole('listbox');
    await user.click(within(writeListbox).getByRole('option', { name: '人事部' }));
    await user.click(screen.getByRole('button', { name: '在线编写' }));
    await screen.findByLabelText('编写标题');
    await user.type(screen.getByLabelText('编写标题'), '差旅');
    await user.type(screen.getByLabelText('编写正文'), '# 正文');
    await user.click(screen.getByRole('button', { name: '提交审批' }));

    await waitFor(() => {
      expect(writeAdminDocument).toHaveBeenCalledWith(
        'kb-1',
        '差旅',
        '# 正文',
        'structure_paragraph',
        { ownerDeptId: DEPT_ID, visibilityLevel: 20 },
      );
    });
  });
});

describe('visibilityLabel', () => {
  it('默认档为带数字的中文', () => {
    expect(visibilityLabel(10)).toBe('10 部门全员');
    expect(visibilityLabel(20)).toBe('20 部门成员');
    expect(visibilityLabel(30)).toBe('30 负责人');
    expect(visibilityLabel(40)).toBe('40 受限');
  });

  it('未知数字回退原值', () => {
    expect(visibilityLabel(15)).toBe('15');
    expect(visibilityLabel(41)).toBe('41');
  });
});
