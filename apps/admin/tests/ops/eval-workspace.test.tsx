/**
 * 目标：评测薄页无码须 403；有码才列出题目并入队。
 * 需求：功能表 §4.1 · prds/05-api §2.8
 * 被测：EvalWorkspace
 * 简介：HTTP 真值在 api；本页不跑 L1。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadEvalBoard = vi.fn();
const addGoldQuestion = vi.fn();
const removeGoldQuestion = vi.fn();
const startEvalRun = vi.fn();
const loadEvalRunDetail = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/eval/services', () => ({
  loadEvalBoard: (...args: unknown[]) => loadEvalBoard(...args),
  addGoldQuestion: (...args: unknown[]) => addGoldQuestion(...args),
  removeGoldQuestion: (...args: unknown[]) => removeGoldQuestion(...args),
  startEvalRun: (...args: unknown[]) => startEvalRun(...args),
  loadEvalRunDetail: (...args: unknown[]) => loadEvalRunDetail(...args),
}));

import { EvalWorkspace } from '@/app/(ops)/eval/_components/eval-workspace';

const KB = '01900000-0000-7000-8000-0000000000aa';

describe('EvalWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadEvalBoard.mockReset();
    addGoldQuestion.mockReset();
    removeGoldQuestion.mockReset();
    startEvalRun.mockReset();
    loadEvalRunDetail.mockReset();
    localStorage.clear();
  });

  it('无 eval.run 显示 403，不请求板面', async () => {
    me.permissions = ['admin.shell'];
    localStorage.setItem('strict-rag:admin:last-kb-id', KB);
    render(<EvalWorkspace />);
    expect(await screen.findByText(/无 eval.run 权限/)).toBeInTheDocument();
    expect(loadEvalBoard).not.toHaveBeenCalled();
  });

  it('有码列出题目；点跑一批会入队', async () => {
    me.permissions = ['admin.shell', 'eval.run'];
    localStorage.setItem('strict-rag:admin:last-kb-id', KB);
    loadEvalBoard.mockResolvedValue({
      ok: true,
      questions: [
        {
          id: '01900000-0000-7000-8000-0000000000a1',
          kbId: KB,
          caseKey: 'g1',
          question: '住宿标准？',
          type: 'answerable',
        },
      ],
      runs: [],
    });
    startEvalRun.mockResolvedValue({
      ok: true,
      queued: { runId: '01900000-0000-7000-8000-0000000000ee', jobId: 'j1', status: 'queued' },
    });
    loadEvalBoard.mockResolvedValueOnce({
      ok: true,
      questions: [
        {
          id: '01900000-0000-7000-8000-0000000000a1',
          kbId: KB,
          caseKey: 'g1',
          question: '住宿标准？',
          type: 'answerable',
        },
      ],
      runs: [],
    });

    const user = userEvent.setup();
    render(<EvalWorkspace />);
    expect(await screen.findByText('住宿标准？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '跑一批' }));
    expect(startEvalRun).toHaveBeenCalledWith(KB, 'golden_2x2');

    await user.click(screen.getByRole('button', { name: '跑 L2' }));
    expect(startEvalRun).toHaveBeenCalledWith(KB, 'session_multiturn');
  });

  it('L1 run 有 scored 时展示 Hit@k', async () => {
    me.permissions = ['admin.shell', 'eval.run'];
    localStorage.setItem('strict-rag:admin:last-kb-id', KB);
    loadEvalBoard.mockResolvedValue({
      ok: true,
      questions: [],
      runs: [
        {
          runId: '01900000-0000-7000-8000-0000000000c1',
          kbId: KB,
          status: 'succeeded',
          runType: 'golden_2x2',
          retrieveMode: 'mock',
          signoffEligible: false,
          caseCount: 2,
          matrix: { A: 1, B: 0, C: 0, D: 1 },
          coverage: 1,
          hitAtK: 0.5,
          hitAtKHits: 1,
          hitAtKScored: 2,
          errorCount: 0,
          ranAt: '2026-09-08 12:00:00',
        },
      ],
    });
    render(<EvalWorkspace />);
    expect(await screen.findByText(/Hit@k 50%/)).toBeInTheDocument();
  });

  it('L1 run 有 tauStar 时展示该阈值', async () => {
    me.permissions = ['admin.shell', 'eval.run'];
    localStorage.setItem('strict-rag:admin:last-kb-id', KB);
    loadEvalBoard.mockResolvedValue({
      ok: true,
      questions: [],
      runs: [
        {
          runId: '01900000-0000-7000-8000-0000000000c2',
          kbId: KB,
          status: 'succeeded',
          runType: 'golden_2x2',
          retrieveMode: 'mock',
          signoffEligible: false,
          caseCount: 4,
          matrix: { A: 1, B: 1, C: 0, D: 2 },
          coverage: 0.5,
          tauStar: 0.55,
          errorCount: 0,
          ranAt: '2026-09-08 12:00:00',
        },
      ],
    });
    render(<EvalWorkspace />);
    expect(await screen.findByText(/tau\* 0\.55/)).toBeInTheDocument();
  });

  it('L1 run tauStar 为 null 时展示无', async () => {
    me.permissions = ['admin.shell', 'eval.run'];
    localStorage.setItem('strict-rag:admin:last-kb-id', KB);
    loadEvalBoard.mockResolvedValue({
      ok: true,
      questions: [],
      runs: [
        {
          runId: '01900000-0000-7000-8000-0000000000c3',
          kbId: KB,
          status: 'succeeded',
          runType: 'golden_2x2',
          retrieveMode: 'mock',
          signoffEligible: false,
          caseCount: 2,
          matrix: { A: 1, B: 0, C: 0, D: 1 },
          coverage: 1,
          tauStar: null,
          errorCount: 0,
          ranAt: '2026-09-08 12:00:00',
        },
      ],
    });
    render(<EvalWorkspace />);
    expect(await screen.findByText(/tau\* 无/)).toBeInTheDocument();
  });
});
