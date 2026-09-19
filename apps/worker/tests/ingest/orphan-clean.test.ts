/**
 * 目标：孤儿清理只动非激活、非在飞的单边残留；激活版与在飞版永不删。
 * 需求：剧本 L7 · prds/01-architecture/03-storage-boundaries.md §2.4 · ADR-038
 * 被测：planOrphanClean / cleanOrphans
 * 简介：三条护栏反例（激活版 · 在飞版 · 无激活表示）+ 正例（清 v1 双侧）+ 完整版不清 + ES 侧不可用直接跳过。
 */

import { describe, expect, it, vi } from 'vitest';

import {
  cleanOrphans,
  planOrphanClean,
  type OrphanCleanDeps,
  type OrphanDocRow,
  type VersionPresence,
} from '../../src/ingest/orphan-clean.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const TENANT = '01900000-0000-7000-8000-000000000001';
const KB = '01900000-0000-7000-8000-0000000000aa';

function doc(over: Partial<OrphanDocRow> = {}): OrphanDocRow {
  return {
    id: DOC,
    tenantId: TENANT,
    kbId: KB,
    status: 'failed',
    indexVersion: 2,
    activeIndexVersion: 1,
    ...over,
  };
}

function presence(rows: Array<[number, number, number]>): VersionPresence[] {
  return rows.map(([indexVersion, pgVectorCount, esCount]) => ({
    indexVersion,
    pgVectorCount,
    esCount,
  }));
}

function fakeDeps(docRow: OrphanDocRow | null, rows: VersionPresence[]) {
  const deletedPg: number[] = [];
  const deletedEs: number[] = [];
  const deps: OrphanCleanDeps = {
    loadDoc: vi.fn(async () => docRow),
    loadPresence: vi.fn(async () => rows),
    deletePgVectors: vi.fn(async (_docId: string, indexVersion: number) => {
      deletedPg.push(indexVersion);
      return 3;
    }),
    deleteEsVersion: vi.fn(async (_docId: string, indexVersion: number) => {
      deletedEs.push(indexVersion);
    }),
  };
  return { deps, deletedPg, deletedEs };
}

describe('孤儿清理判定（剧本 L7）', () => {
  it('反例 A：激活版永不删 —— 只清单边残留，不碰 active', () => {
    const plan = planOrphanClean(
      doc({ activeIndexVersion: 1, indexVersion: 1, status: 'failed' }),
      presence([
        [1, 5, 0],
        [2, 0, 4],
      ]),
    );
    expect(plan).toEqual({ action: 'clean', versions: [2] });
  });

  it('反例 B：重索引中途失败 —— 激活版与在飞版都不删', () => {
    const plan = planOrphanClean(
      doc({ activeIndexVersion: 1, indexVersion: 2, status: 'failed' }),
      presence([
        [1, 5, 0],
        [2, 4, 0],
      ]),
    );
    expect(plan).toEqual({ action: 'skip', reason: 'no_orphan' });
  });

  it('反例 C：无激活表示（NULL）→ 一律不动手', () => {
    const plan = planOrphanClean(
      doc({ activeIndexVersion: null, indexVersion: 2, status: 'failed' }),
      presence([[1, 5, 0]]),
    );
    expect(plan).toEqual({ action: 'skip', reason: 'no_active_version' });
  });

  it('prd 对象定义：status=ready 的文档不进清理范围', () => {
    const plan = planOrphanClean(
      doc({ activeIndexVersion: 2, indexVersion: 2, status: 'ready' }),
      presence([[1, 5, 0]]),
    );
    expect(plan).toEqual({ action: 'skip', reason: 'doc_ready' });
  });

  it('两侧都有的完整旧版不属「半套」，不清', () => {
    const plan = planOrphanClean(
      doc({ activeIndexVersion: 2, indexVersion: 2, status: 'failed' }),
      presence([[1, 5, 5]]),
    );
    expect(plan).toEqual({ action: 'skip', reason: 'no_orphan' });
  });
});

describe('孤儿清理编排（剧本 L7）', () => {
  it('正例：清 v1 双侧（PG 向量 + mock ES）', async () => {
    const { deps, deletedPg, deletedEs } = fakeDeps(
      doc({ activeIndexVersion: 2, indexVersion: 2, status: 'failed' }),
      presence([
        [1, 3, 0],
        [2, 4, 4],
      ]),
    );

    const outcome = await cleanOrphans(DOC, deps, true);

    expect(outcome).toEqual({ status: 'cleaned', versions: [1], pgVectorsDeleted: 3 });
    expect(deletedPg).toEqual([1]);
    expect(deletedEs).toEqual([1]);
  });

  it('反例 C 编排面：无激活表示时不得调用任何删除', async () => {
    const { deps } = fakeDeps(
      doc({ activeIndexVersion: null, indexVersion: 2, status: 'failed' }),
      presence([[1, 3, 0]]),
    );

    const outcome = await cleanOrphans(DOC, deps, true);

    expect(outcome).toEqual({ status: 'skipped', reason: 'no_active_version' });
    expect(deps.deletePgVectors).not.toHaveBeenCalled();
    expect(deps.deleteEsVersion).not.toHaveBeenCalled();
  });

  it('ES 侧不可用（真 ES 属 B8）→ 整体跳过，连库都不查', async () => {
    const { deps } = fakeDeps(doc(), presence([[1, 3, 0]]));

    const outcome = await cleanOrphans(DOC, deps, false);

    expect(outcome).toEqual({ status: 'skipped', reason: 'es_side_unavailable' });
    expect(deps.loadDoc).not.toHaveBeenCalled();
    expect(deps.loadPresence).not.toHaveBeenCalled();
  });

  it('文档不存在 → 跳过', async () => {
    const { deps } = fakeDeps(null, []);
    expect(await cleanOrphans(DOC, deps, true)).toEqual({
      status: 'skipped',
      reason: 'doc_not_found',
    });
  });
});
