/**
 * 文档页：点行展开详情；无 doc.editor 不露保存；保存走 saveDocumentMeta。
 */

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

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('../list.services', () => ({
  loadDocumentList: (...args: unknown[]) => loadDocumentList(...args),
}));

vi.mock('../meta.services', () => ({
  loadDocumentDetail: (...args: unknown[]) => loadDocumentDetail(...args),
  saveDocumentMeta: (...args: unknown[]) => saveDocumentMeta(...args),
}));

import { DocumentsWorkspace } from './documents-workspace';

const DOC_ID = '018f0000-0000-7000-8000-0000000000d1';
const DEPT_ID = '01900000-0000-7000-8000-0000000000de';

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
};

const detailDoc = {
  ...listDoc,
  tenantId: '018f0000-0000-7000-8000-0000000000t1',
  kbId: '018f0000-0000-7000-8000-0000000000k1',
  ownerDeptId: null,
  visibilityLevel: 20 as const,
};

describe('DocumentsWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadDocumentList.mockReset();
    loadDocumentDetail.mockReset();
    saveDocumentMeta.mockReset();
    localStorage.clear();
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
    expect(screen.getByLabelText('可见级')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    expect(loadDocumentDetail).toHaveBeenCalledWith(DOC_ID);
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
    expect(screen.getByLabelText('可见级')).toBeInTheDocument();
    expect(screen.getByLabelText('归属部门')).toBeDisabled();
    expect(screen.getByLabelText('可见级')).toBeDisabled();
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
    await user.selectOptions(screen.getByLabelText('可见级'), '30');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveDocumentMeta).toHaveBeenCalledWith(DOC_ID, {
        ownerDeptId: DEPT_ID,
        visibilityLevel: 30,
      });
    });
    expect(screen.getByLabelText('归属部门')).toHaveValue(DEPT_ID);
    expect(screen.getByLabelText('可见级')).toHaveValue('30');
    expect(screen.getByText('已保存')).toBeInTheDocument();
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
});
