/**
 * 目标：worker 批跑落库白名单必须带上映射来源三键，使库内形状与 api CLI 不分叉（漏键即静默丢失）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 2 / 6）
 * 被测：evalPersist.saveReport · evalPersist.saveL2Report（reportJson 逐键白名单）
 * 简介：worker 无账本解析 → 三键如实为 none/0/[]；捕获 set 载荷证明三键俱在。
 */

import { describe, expect, it, vi } from 'vitest';

/** saveReport / saveL2Report 写入的 set 载荷（不连真 PG） */
const captured: Array<Record<string, unknown>> = [];

vi.mock('../../src/env.js', () => ({ env: { EVAL_L2_GOLD_PATH: '', JUDGE_CALIB_SCORER: 'off' } }));
vi.mock('../../src/db.js', () => ({
  getDb: () => ({
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          captured.push(values);
        },
      }),
    }),
  }),
}));

const { runL1Batch } = await import('../../src/eval/run-l1-batch.js');
const { runL2Batch } = await import('../../src/eval/run-l2-batch.js');
const { evalPersist } = await import('../../src/eval/persist.js');

const RUN_ID = '01900000-0000-7000-8000-0000000000aa';

function reportJsonOfLast(): Record<string, unknown> | undefined {
  return captured.at(-1)?.reportJson as Record<string, unknown> | undefined;
}

describe('persist · 映射来源三键白名单（两侧同构）', () => {
  it('saveReport（L1）reportJson 带三键且取值 none/0/[]', async () => {
    const report = await runL1Batch({
      kbId: 'kb-1',
      retrieveMode: 'mock',
      cases: [{ caseKey: 'a1', question: '可答题', type: 'answerable' }],
      execute: async () => ({ outcome: 'answered' }),
    });
    captured.length = 0;
    await evalPersist.saveReport(RUN_ID, report);

    const reportJson = reportJsonOfLast();
    expect(reportJson?.docMapSource).toBe('none');
    expect(reportJson?.docMapResolved).toBe(0);
    expect(reportJson?.docMapUnmappedIds).toEqual([]);
  });

  it('saveL2Report（L2）reportJson 带三键且取值 none/0/[]', async () => {
    const report = await runL2Batch({
      kbId: 'kb-1',
      retrieveMode: 'mock',
      cases: [],
      executeTurn: async () => ({ outcome: 'answered' }),
    });
    captured.length = 0;
    await evalPersist.saveL2Report(RUN_ID, report);

    const reportJson = reportJsonOfLast();
    expect(reportJson?.docMapSource).toBe('none');
    expect(reportJson?.docMapResolved).toBe(0);
    expect(reportJson?.docMapUnmappedIds).toEqual([]);
  });
});
