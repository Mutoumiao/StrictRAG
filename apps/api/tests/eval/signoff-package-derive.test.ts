/**
 * 目标：签字包 ID / 生效时刻必须从 eval_runs 读时派生，无合格 run 时保持 null（不得臆造）。
 * 需求：ADR-046 四要素之四「KB 配置快照绑定 eval_runs」· ADR-061 L1 双轨 · 05-api §2.1
 * 被测：isSignoffPackageRow / latestSignoffPackage
 * 简介：合格=golden_2x2 ∧ succeeded ∧ live ∧ signoff_eligible；任一不满足即 null；有则取最近一条。
 *       SQL 侧写死同一条件（`latestSignoffPackage`），本测例钉纯函数口径防两边漂移。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

const KB = '01900000-0000-7000-8000-0000000000ab';

const state = vi.hoisted(() => ({
  runs: [] as Array<{ id: string; createdAt: string | null }>,
}));

vi.mock('../../src/services/db.js', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: async (n: number) => state.runs.slice(0, n) }),
        }),
      }),
    }),
  }),
}));

const { evalRunRepo, isSignoffPackageRow } = await import('../../src/services/eval-runs.js');

function row(over: Record<string, string> = {}) {
  return {
    runType: 'golden_2x2',
    status: 'succeeded',
    retrieveMode: 'live',
    signoffEligible: '1',
    ...over,
  };
}

describe('签字包取数口径（ADR-046 / ADR-061）', () => {
  afterEach(() => {
    state.runs.length = 0;
  });

  it('合格：golden_2x2 ∧ succeeded ∧ live ∧ signoff_eligible', () => {
    expect(isSignoffPackageRow(row())).toBe(true);
    expect(isSignoffPackageRow(row({ signoffEligible: 'true' }))).toBe(true);
  });

  it('任一条不满足即不合格（mock / unknown / 未合格 / 非 succeeded / 非 L1 账本）', () => {
    expect(isSignoffPackageRow(row({ retrieveMode: 'mock' }))).toBe(false);
    expect(isSignoffPackageRow(row({ retrieveMode: 'unknown' }))).toBe(false);
    expect(isSignoffPackageRow(row({ signoffEligible: '0' }))).toBe(false);
    expect(isSignoffPackageRow(row({ status: 'failed' }))).toBe(false);
    expect(isSignoffPackageRow(row({ status: 'running' }))).toBe(false);
    expect(isSignoffPackageRow(row({ runType: 'session_multiturn' }))).toBe(false);
  });

  it('无合格 run → 保持 null（不臆造 id、不代签）', async () => {
    state.runs = [];
    expect(await evalRunRepo.latestSignoffPackage(KB)).toBeNull();
  });

  it('有合格 run → 回该条 id 与已记录的创建时间；多条取最近一条', async () => {
    const newer = { id: uuidv7(), createdAt: '2026-09-19 08:00:00' };
    const older = { id: uuidv7(), createdAt: '2026-09-17 08:00:00' };
    state.runs = [newer, older];

    expect(await evalRunRepo.latestSignoffPackage(KB)).toEqual({
      id: newer.id,
      effectiveAt: '2026-09-19 08:00:00',
    });
  });

  it('创建时间缺失 → effectiveAt 为 null（不补造时刻）', async () => {
    state.runs = [{ id: uuidv7(), createdAt: null }];
    expect(await evalRunRepo.latestSignoffPackage(KB)).toEqual({
      id: state.runs[0]?.id,
      effectiveAt: null,
    });
  });
});
