/**
 * 同 KB 跨文档近重复（最小闭环）。
 * 字 3-gram Jaccard ≥ 0.9 → skip_index。不是生产 MinHash LSH。
 */

import { chunks, documents, type Db } from '@strict-rag/db';
import { eq } from 'drizzle-orm';

export const CROSS_DOC_SHINGLE_N = 3;
export const CROSS_DOC_JACCARD_MIN = 0.9;

export type CrossDocChunk = {
  chunkId: string;
  docId: string;
  bodyText: string;
};

export type CrossDocConflict = {
  otherDocId: string;
  otherChunkId: string;
  action: 'skip_index';
};

const SEARCHABLE_LIFECYCLES = new Set(['draft', 'active']);

export function normalizeForShingles(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

export function charShingles(text: string, n = CROSS_DOC_SHINGLE_N): Set<string> {
  const t = normalizeForShingles(text);
  if (t.length === 0) return new Set();
  if (t.length <= n) return new Set([t]);
  const out = new Set<string>();
  for (let i = 0; i <= t.length - n; i += 1) {
    out.add(t.slice(i, i + n));
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  return inter / (a.size + b.size - inter);
}

export function isCrossDocNearDup(left: string, right: string): boolean {
  return jaccard(charShingles(left), charShingles(right)) >= CROSS_DOC_JACCARD_MIN;
}

export function findCrossDocConflict(
  body: string,
  corpus: readonly CrossDocChunk[],
): CrossDocConflict | null {
  for (const other of corpus) {
    if (isCrossDocNearDup(body, other.bodyText)) {
      return {
        otherDocId: other.docId,
        otherChunkId: other.chunkId,
        action: 'skip_index',
      };
    }
  }
  return null;
}

export async function loadCrossDocSearchableChunks(
  db: Db,
  input: { kbId: string; excludeDocId: string },
): Promise<CrossDocChunk[]> {
  const docs = await db
    .select({
      id: documents.id,
      kbId: documents.kbId,
      status: documents.status,
      lifecycle: documents.lifecycle,
      indexVersion: documents.indexVersion,
    })
    .from(documents)
    .where(eq(documents.kbId, input.kbId));

  const eligible = new Map<string, number>();
  for (const d of docs) {
    if (d.id === input.excludeDocId) continue;
    if (d.kbId !== input.kbId) continue;
    if (d.status !== 'ready') continue;
    if (!SEARCHABLE_LIFECYCLES.has(d.lifecycle)) continue;
    if (d.indexVersion <= 0) continue;
    eligible.set(d.id, d.indexVersion);
  }
  if (eligible.size === 0) return [];

  const rows = await db
    .select({
      id: chunks.id,
      kbId: chunks.kbId,
      docId: chunks.docId,
      bodyText: chunks.bodyText,
      indexVersion: chunks.indexVersion,
    })
    .from(chunks)
    .where(eq(chunks.kbId, input.kbId));

  const out: CrossDocChunk[] = [];
  for (const r of rows) {
    if (r.kbId !== input.kbId) continue;
    if (eligible.get(r.docId) !== r.indexVersion) continue;
    const body = r.bodyText ?? '';
    if (body.length === 0) continue;
    out.push({ chunkId: r.id, docId: r.docId, bodyText: body });
  }
  return out;
}
