/**
 * OPS-1 探针：确保索引 → 从 PG 拉 ready chunks bulk → 抽样 search。
 *
 *   ELASTICSEARCH_URL=http://127.0.0.1:9200 L1_KB_ID=<kb> \
 *     pnpm --filter @strict-rag/api exec tsx src/scripts/seed-es-sparse-probe.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { documents } from '@strict-rag/db';
import { eq } from 'drizzle-orm';

import { getDb } from '../services/db.js';
import { loadCorpusFromDb } from '../services/retrieve/corpus.js';
import {
  bulkIndexSparse,
  ensureSparseIndex,
  esConfigFromEnv,
  searchSparseEs,
} from '../services/retrieve/es-sparse.js';
import { env } from '../env.js';

/** 仅认 L1_KB_ID（turbo 已登记）；勿另引未声明 env */
export function requireProbeKbId(envMap: NodeJS.ProcessEnv = process.env): string {
  const kbId = envMap.L1_KB_ID?.trim();
  if (!kbId) {
    throw new Error('L1_KB_ID required');
  }
  return kbId;
}

async function main(): Promise<void> {
  let kbId: string;
  try {
    kbId = requireProbeKbId();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
  const cfg = esConfigFromEnv(env);
  if (!cfg) {
    console.error('ELASTICSEARCH_URL required');
    process.exit(2);
  }

  await ensureSparseIndex(cfg);
  const corpus = await loadCorpusFromDb({ kbId });
  if (corpus.length === 0) {
    console.error(JSON.stringify({ ok: false, reason: 'empty_corpus', kbId }));
    process.exit(1);
  }

  const [firstDoc] = await getDb()
    .select({ tenantId: documents.tenantId })
    .from(documents)
    .where(eq(documents.kbId, kbId))
    .limit(1);
  if (!firstDoc) {
    console.error(JSON.stringify({ ok: false, reason: 'no_document_tenant', kbId }));
    process.exit(1);
  }
  const tenantId = firstDoc.tenantId;

  const docs = corpus
    .filter((c) => c.text.length > 0)
    .map((c) => ({
      chunkId: c.chunkId,
      tenantId,
      kbId,
      docId: c.docId,
      sparseText: c.text,
    }));
  const { indexed } = await bulkIndexSparse(cfg, docs);

  // refresh so search sees docs
  await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(cfg.index)}/_refresh`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  });

  const sampleQ = docs[0]!.sparseText.slice(0, 80) || 'test';
  const hits = await searchSparseEs(cfg, { tenantId, kbId, question: sampleQ, size: 5 });

  console.log(
    JSON.stringify(
      {
        ok: hits.length > 0,
        retrieve_mode: 'live',
        index: cfg.index,
        baseUrl: cfg.baseUrl,
        kbId,
        indexed,
        sampleHits: hits.length,
        topChunkIds: hits.slice(0, 3),
      },
      null,
      2,
    ),
  );
  process.exit(hits.length > 0 ? 0 : 1);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
