import {
  chunkEmbeddings,
  chunks,
  documents,
  isDefaultRetrievable,
} from '@strict-rag/db';
import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '../db.js';
import {
  parseDeptInheritDownFromConfig,
  resolveDeptInheritDown,
  kbSettingsRepo,
} from '../kb-settings.js';
import {
  filterDocsForDeptAcl,
  isDeptAclEnforced,
  loadDeptAssignments,
  loadDeptGrants,
  loadDeptNodes,
} from './dept-acl.js';
import type { CorpusChunk, CorpusLoader, RetrieveScope } from './types.js';

/** 文档侧双闸门 + 可选 docTypes（loadCorpusFromDb / hasRetrievableDocs 共用） */
export type DocForRetrieve = {
  status: string;
  lifecycle: string;
  docType?: string | null;
};

/**
 * 仅 ready∧active 可进语料；scope.docTypes 再滤一层。
 * 抽成纯函数便于单测护栏（P0：防 loadCorpus 漏滤 draft）。
 */
export function filterDocsForRetrieve<T extends DocForRetrieve>(
  docs: readonly T[],
  scope?: RetrieveScope,
): T[] {
  return docs.filter((d) => {
    if (!isDefaultRetrievable(d)) return false;
    if (scope?.docTypes?.length) {
      const dt = d.docType ?? '';
      if (!scope.docTypes.includes(dt)) return false;
    }
    return true;
  });
}

/**
 * 从 PG 拉 KB 下可检索 chunk（双闸门 + 可选 docTypes）。
 * draft / superseded / 非 ready 不进。
 * sparse mock 用 body_text/preview；dense 用 chunk_embeddings。
 */
export const loadCorpusFromDb: CorpusLoader = async ({
  kbId,
  scope,
  userId,
  bypassDeptAcl,
}) => {
  const db = getDb();
  const docs = await db.select().from(documents).where(eq(documents.kbId, kbId));

  const dual = filterDocsForRetrieve(docs, scope);
  const enforce = isDeptAclEnforced();
  const tenantId = dual[0]?.tenantId;
  const skipDeptIo = !enforce || bypassDeptAcl === true;
  const [assignments, depts, grants, kb] = skipDeptIo
    ? [[], [], [], null]
    : await Promise.all([
        loadDeptAssignments(tenantId, userId),
        loadDeptNodes(tenantId),
        loadDeptGrants(tenantId, userId),
        kbSettingsRepo.get(kbId),
      ]);
  const allowed = filterDocsForDeptAcl(dual, {
    assignments,
    enforce,
    depts,
    grants,
    bypass: bypassDeptAcl,
    inheritDown: skipDeptIo
      ? undefined
      : resolveDeptInheritDown(parseDeptInheritDownFromConfig(kb?.configJson ?? null)),
  });

  if (allowed.length === 0) return [];

  const docById = new Map(allowed.map((d) => [d.id, d]));
  const docIds = allowed.map((d) => d.id);

  const chunkRows = await db.select().from(chunks).where(inArray(chunks.docId, docIds));

  // 仅当前 indexVersion（与文档对账一致）
  const gated = chunkRows.filter((c) => {
    const doc = docById.get(c.docId);
    return doc != null && c.indexVersion === doc.indexVersion && c.kbId === kbId;
  });

  if (gated.length === 0) return [];

  const chunkIds = gated.map((c) => c.id);
  const embRows = await db
    .select()
    .from(chunkEmbeddings)
    .where(and(inArray(chunkEmbeddings.chunkId, chunkIds), eq(chunkEmbeddings.kbId, kbId)));

  const embByChunk = new Map(embRows.map((e) => [e.chunkId, e]));

  return gated.map((c) => {
    const doc = docById.get(c.docId)!;
    const emb = embByChunk.get(c.id);
    // 仅当 embedding 的 indexVersion 与文档一致才用
    const embedding =
      emb && emb.indexVersion === doc.indexVersion && emb.docId === doc.id
        ? emb.embedding
        : undefined;
    const text = (c.bodyText ?? c.preview ?? '').trim();
    return {
      chunkId: c.id,
      docId: c.docId,
      title: doc.title,
      text,
      preview: c.preview ?? text.slice(0, 200),
      lifecycle: doc.lifecycle,
      docType: doc.docType,
      embedding,
    } satisfies CorpusChunk;
  });
};

/** 空库/无可检索文档判定用：是否存在 ready∧active（含 scope + 同一部门滤） */
export async function hasRetrievableDocs(
  kbId: string,
  scope?: RetrieveScope,
  userId?: string,
  bypassDeptAcl?: boolean,
): Promise<boolean> {
  const db = getDb();
  const docs = await db.select().from(documents).where(eq(documents.kbId, kbId));
  const dual = filterDocsForRetrieve(docs, scope);
  const enforce = isDeptAclEnforced();
  const tenantId = dual[0]?.tenantId;
  const skipDeptIo = !enforce || bypassDeptAcl === true;
  const [assignments, depts, grants, kb] = skipDeptIo
    ? [[], [], [], null]
    : await Promise.all([
        loadDeptAssignments(tenantId, userId),
        loadDeptNodes(tenantId),
        loadDeptGrants(tenantId, userId),
        kbSettingsRepo.get(kbId),
      ]);
  return (
    filterDocsForDeptAcl(dual, {
      assignments,
      enforce,
      depts,
      grants,
      bypass: bypassDeptAcl,
      inheritDown: skipDeptIo
        ? undefined
        : resolveDeptInheritDown(parseDeptInheritDownFromConfig(kb?.configJson ?? null)),
    }).length > 0
  );
}
