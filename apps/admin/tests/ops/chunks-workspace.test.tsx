/**
 * 目标：分片薄页未点开详情时不得预拉分片正文，失败则一次文档选中就打满全文接口。
 * 需求：剧本 Z3 · ADR-052
 * 被测：ChunksWorkspace
 * 简介：选文档只走 preview 列表；loadChunkBody 仅点击某块时触发一次且只拉该块。HTTP 真值在 api。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { within } from '@testing-library/react';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-admin',
  email: 'admin@example.com',
  permissions: [] as string[],
};

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-admin', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

const loadChunkDocs = vi.fn();
const loadChunkList = vi.fn();
const loadChunkBody = vi.fn();

vi.mock('@/app/(ops)/chunks/services', () => ({
  loadChunkDocs: (...args: unknown[]) => loadChunkDocs(...args),
  loadChunkList: (...args: unknown[]) => loadChunkList(...args),
  loadChunkBody: (...args: unknown[]) => loadChunkBody(...args),
}));

import { ChunksWorkspace } from '@/app/(ops)/chunks/_components/chunks-workspace';

const KB_STORAGE = 'strict-rag:admin:last-kb-id';
const DOC_A = '01900000-0000-7000-8000-0000000000d1';
const DOC_B = '01900000-0000-7000-8000-0000000000d2';
const CHUNK_1 = '01900000-0000-7000-8000-0000000000c1';
const CHUNK_2 = '01900000-0000-7000-8000-0000000000c2';
const CHUNK_3 = '01900000-0000-7000-8000-0000000000c3';

const docRow = {
  id: DOC_A,
  title: '差旅制度',
  status: 'ready',
  lifecycle: 'active',
  indexVersion: 3,
};

function chunkRow(chunkId: string, ordinal: number, preview: string) {
  return {
    chunkId,
    ordinal,
    preview,
    previewTruncated: false,
    indexVersion: 3,
    tokenCount: 12,
  };
}

describe('ChunksWorkspace', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'chunk.view'];
    localStorage.setItem(KB_STORAGE, 'kb-1');
    loadChunkDocs.mockReset();
    loadChunkList.mockReset();
    loadChunkBody.mockReset();
    loadChunkDocs.mockResolvedValue({ ok: true, rows: [docRow] });
    loadChunkList.mockResolvedValue({
      ok: true,
      items: [
        chunkRow(CHUNK_1, 0, '第一块 preview'),
        chunkRow(CHUNK_2, 1, '第二块 preview'),
        chunkRow(CHUNK_3, 2, '第三块 preview'),
      ],
      indexVersion: 3,
      status: 'ready',
      lifecycle: 'active',
      nextCursor: null,
    });
  });

  it('选文档只拉 preview 列表，未点详情时一次正文都不拉', async () => {
    const user = userEvent.setup();
    render(<ChunksWorkspace />);

    await user.selectOptions(await screen.findByLabelText('文档'), DOC_A);

    expect(await screen.findByText('第一块 preview')).toBeInTheDocument();
    expect(await screen.findByText('第三块 preview')).toBeInTheDocument();
    expect(loadChunkList).toHaveBeenCalledWith(DOC_A, { limit: 50 });
    expect(loadChunkBody).not.toHaveBeenCalled();
  });

  it('点击某块才拉该块正文一次，不连带拉其它块', async () => {
    const user = userEvent.setup();
    loadChunkBody.mockResolvedValue({
      ok: true,
      detail: {
        ...chunkRow(CHUNK_1, 0, '第一块 preview'),
        body: '第一块完整正文',
        bodyTruncated: false,
      },
    });
    render(<ChunksWorkspace />);

    await user.selectOptions(await screen.findByLabelText('文档'), DOC_A);
    await screen.findByText('第二块 preview');
    expect(loadChunkBody).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '第一块 preview' }));

    await waitFor(() => {
      expect(loadChunkBody).toHaveBeenCalledTimes(1);
    });
    expect(loadChunkBody).toHaveBeenCalledWith(DOC_A, CHUNK_1);
    expect(await screen.findByText('第一块完整正文')).toBeInTheDocument();
    expect(loadChunkBody).not.toHaveBeenCalledWith(DOC_A, CHUNK_2);
    expect(loadChunkBody).not.toHaveBeenCalledWith(DOC_A, CHUNK_3);
  });

  it('Z4：详情带 body；bodyTruncated 为 true 时明示已截断', async () => {
    const user = userEvent.setup();
    loadChunkBody.mockResolvedValue({
      ok: true,
      detail: {
        ...chunkRow(CHUNK_1, 0, '第一块 preview'),
        body: '第一块完整正文',
        bodyTruncated: true,
      },
    });
    render(<ChunksWorkspace />);

    await user.selectOptions(await screen.findByLabelText('文档'), DOC_A);
    await screen.findByText('第一块 preview');
    await user.click(screen.getByRole('button', { name: '第一块 preview' }));

    expect(await screen.findByText('第一块完整正文')).toBeInTheDocument();
    expect(screen.getByText(/已截断/)).toBeInTheDocument();
  });

  it('Z8：独立二级「分片」页可选文档并列块（薄 UI 可达）', async () => {
    const user = userEvent.setup();
    loadChunkDocs.mockResolvedValue({
      ok: true,
      rows: [docRow, { ...docRow, id: DOC_B, title: '考勤制度' }],
    });
    render(<ChunksWorkspace />);

    const select = await screen.findByLabelText('文档');
    expect(within(select).getByRole('option', { name: /差旅制度/ })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /考勤制度/ })).toBeInTheDocument();

    await user.selectOptions(select, DOC_A);

    expect(await screen.findByRole('columnheader', { name: '#' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'preview' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'tokens' })).toBeInTheDocument();
    expect(screen.getByText('第一块 preview')).toBeInTheDocument();
    expect(screen.getByText('indexVersion=3 · status=ready · lifecycle=active')).toBeInTheDocument();
  });
});
