/**
 * 文档页：点行展开详情；无 doc.editor 不露保存；保存走 saveDocumentMeta。
 * 有 dept.manage 才下拉选部门；无该码仍 uuid 粘贴，不整页 403。
 * 列表按已加载行本地筛部门/可见级；不改 GET query。
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

vi.mock('../list.services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../list.services')>();
  return {
    ...actual,
    loadDocumentList: (...args: unknown[]) => loadDocumentList(...args),
  };
});

vi.mock('../meta.services', () => ({
  loadDocumentDetail: (...args: unknown[]) => loadDocumentDetail(...args),
  saveDocumentMeta: (...args: unknown[]) => saveDocumentMeta(...args),
  loadDepartmentOptions: (...args: unknown[]) => loadDepartmentOptions(...args),
}));

import { DocumentsWorkspace } from './documents-workspace';

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
    localStorage.clear();
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
    expect(screen.getByRole('cell', { name: '30' })).toBeInTheDocument();
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
    expect(detailVisibility()).toBeInTheDocument();
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
    expect(detailVisibility()).toBeInTheDocument();
    expect(screen.getByLabelText('归属部门')).toBeDisabled();
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
      });
    });
    expect(screen.getByLabelText('归属部门')).toHaveValue(DEPT_ID);
    expect(detailVisibility()).toHaveValue('30');
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
      });
    });
    expect(screen.getByText('已保存')).toBeInTheDocument();
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

    expect(await screen.findByText('FORBIDDEN: 需要 dept.manage')).toBeInTheDocument();
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
    expect(screen.getByLabelText('可见级', { selector: '#doc-filter-visibility' })).toHaveValue(
      'all',
    );
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
});
