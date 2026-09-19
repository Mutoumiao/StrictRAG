/**
 * 剧本 L7：孤儿清理（`prds/01-architecture/03-storage-boundaries.md` §2.4 · ADR-038）。
 *
 * 对象：**单边**有向量或 ES 文档、且 `status != ready`、且非活跃重试窗口。
 * 护栏：`index_version != 当前激活`；**激活版永不删**；在飞版（`documents.index_version`）不删；
 *       无激活表示（`active_index_version IS NULL`）→ **一律不动手**（宁可不清理）。
 * 动作：PG 向量 + ES **双侧**。
 *
 * **未落地**：周期触发（本仓无调度基建）与真 ES 侧清理（B8 延期）。
 * 故本模块在 `INGEST_ES_MODE != mock` 时**整体跳过**——判定依赖两侧计数，缺一侧就不该动手。
 * 调用方负责决定对哪些文档跑（例如按 `status = failed` 筛出的集合）。
 */

import { chunkEmbeddings, documents, type Db } from '@strict-rag/db';
import { and, eq } from 'drizzle-orm';

import { env } from '../env.js';
import { mockEsStore } from './es-store.js';

export type OrphanDocRow = {
  id: string;
  tenantId: string;
  kbId: string;
  status: string;
  /** 在飞（本轮）version */
  indexVersion: number;
  /** 当前激活 version；NULL = 从未成功激活 */
  activeIndexVersion: number | null;
};

export type VersionPresence = {
  indexVersion: number;
  /** PG 向量行数 */
  pgVectorCount: number;
  /** mock ES 该 version 的 chunk 数 */
  esCount: number;
};

export type OrphanCleanDecision =
  | { action: 'skip'; reason: 'no_active_version' | 'doc_ready' | 'no_orphan' }
  | { action: 'clean'; versions: number[] };

/** 单边 = 一侧有、另一侧为空（两侧都有的完整版不属「半套」，不动）。 */
function isSingleSided(p: VersionPresence): boolean {
  if (p.pgVectorCount > 0 && p.esCount === 0) return true;
  if (p.esCount > 0 && p.pgVectorCount === 0) return true;
  return false;
}

/** 纯函数：给定文档行与各 version 的两侧存在性，判定本轮该清哪些 version。 */
export function planOrphanClean(
  doc: OrphanDocRow,
  presence: readonly VersionPresence[],
): OrphanCleanDecision {
  if (doc.activeIndexVersion == null) return { action: 'skip', reason: 'no_active_version' };
  // PRD §2.4 对象定义：status != ready
  if (doc.status === 'ready') return { action: 'skip', reason: 'doc_ready' };

  const protectedVersions = new Set<number>([doc.activeIndexVersion, doc.indexVersion]);
  const versions = presence
    .filter((p) => !protectedVersions.has(p.indexVersion) && isSingleSided(p))
    .map((p) => p.indexVersion)
    .sort((a, b) => a - b);

  if (versions.length === 0) return { action: 'skip', reason: 'no_orphan' };
  return { action: 'clean', versions };
}

export type OrphanSkipReason =
  | 'es_side_unavailable'
  | 'doc_not_found'
  | 'no_active_version'
  | 'doc_ready'
  | 'no_orphan';

export type OrphanCleanOutcome =
  | { status: 'skipped'; reason: OrphanSkipReason }
  | { status: 'cleaned'; versions: number[]; pgVectorsDeleted: number };

export type OrphanCleanDeps = {
  loadDoc(docId: string): Promise<OrphanDocRow | null>;
  loadPresence(doc: OrphanDocRow): Promise<VersionPresence[]>;
  deletePgVectors(docId: string, indexVersion: number): Promise<number>;
  deleteEsVersion(docId: string, indexVersion: number): Promise<void>;
};

/** 编排：先判定，再双侧清理。跳过时不产生任何写。 */
export async function cleanOrphans(
  docId: string,
  deps: OrphanCleanDeps,
  esSideAvailable: boolean = orphanCleanEsSideAvailable(),
): Promise<OrphanCleanOutcome> {
  // 判定依赖两侧计数；缺 ES 侧就不该动手（真 ES 清理属 B8）
  if (!esSideAvailable) return { status: 'skipped', reason: 'es_side_unavailable' };

  const doc = await deps.loadDoc(docId);
  if (!doc) return { status: 'skipped', reason: 'doc_not_found' };

  const decision = planOrphanClean(doc, await deps.loadPresence(doc));
  if (decision.action === 'skip') return { status: 'skipped', reason: decision.reason };

  let pgVectorsDeleted = 0;
  for (const version of decision.versions) {
    pgVectorsDeleted += await deps.deletePgVectors(docId, version);
    await deps.deleteEsVersion(docId, version);
  }
  return { status: 'cleaned', versions: decision.versions, pgVectorsDeleted };
}

/** 生产接线：PG 向量侧直接落 `chunk_embeddings`；ES 侧仅 mock（真 ES 属 B8）。 */
export function defaultOrphanCleanDeps(db: Db): OrphanCleanDeps {
  return {
    async loadDoc(docId) {
      const rows = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        tenantId: row.tenantId,
        kbId: row.kbId,
        status: row.status,
        indexVersion: row.indexVersion,
        activeIndexVersion: row.activeIndexVersion ?? null,
      };
    },

    async loadPresence(doc) {
      const rows = await db
        .select({ indexVersion: chunkEmbeddings.indexVersion })
        .from(chunkEmbeddings)
        .where(eq(chunkEmbeddings.docId, doc.id));
      const pgCounts = new Map<number, number>();
      for (const r of rows) pgCounts.set(r.indexVersion, (pgCounts.get(r.indexVersion) ?? 0) + 1);

      const versions = new Set<number>(pgCounts.keys());
      for (const v of mockEsStore.listVersions(doc.id)) versions.add(v);

      return [...versions]
        .sort((a, b) => a - b)
        .map((indexVersion) => ({
          indexVersion,
          pgVectorCount: pgCounts.get(indexVersion) ?? 0,
          esCount: mockEsStore.listChunkIds(doc.id, indexVersion).length,
        }));
    },

    async deletePgVectors(docId, indexVersion) {
      const deleted = await db
        .delete(chunkEmbeddings)
        .where(
          and(
            eq(chunkEmbeddings.docId, docId),
            eq(chunkEmbeddings.indexVersion, indexVersion),
          ),
        )
        .returning({ id: chunkEmbeddings.id });
      return deleted.length;
    },

    async deleteEsVersion(docId, indexVersion) {
      mockEsStore.dropVersion(docId, indexVersion);
    },
  };
}

/** mock ES 侧是否可用（真 ES 侧清理属 B8 延期）。 */
export function orphanCleanEsSideAvailable(): boolean {
  return env.INGEST_ES_MODE === 'mock';
}
