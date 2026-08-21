import {
  DEFAULT_CHUNK_STRATEGY,
  isImplementedChunkStrategy,
} from '@strict-rag/contracts';
import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
} from '@strict-rag/db';
import { and, eq, inArray } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from '../db.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import type { IngestJobData, IngestStage } from '../queues.js';
import { isScanModeRuntimeBlocked } from '../scan-mode-policy.js';
import {
  decideChunkPath,
  missingEmbeddingChunkIds,
  resolveIndexVersion,
  withStageAndVersion,
} from './idempotency.js';
import {
  bulkIndexSparse,
  ensureSparseIndex,
  esHttpConfigFromEnv,
  listIndexedChunkIds,
  reconcileIndexed,
  sparseTextForChunk,
} from './es-http.js';
import { mockEsStore } from './es-store.js';
import { decodeUtf8Text, hasUtf8TextLayer } from './extract-text.js';
import { recordStageEnd, recordStageStart } from './job-ledger.js';
import { localMongoDocId, upsertDocumentBody } from './mongo-body.js';
import { deleteObject, readObjectBytes, storeConfigFromEnv } from './object-store.js';

/** 阶段结果：errorCode 供 worker 接 BullMQ retry / Unrecoverable */
export type IngestStageResult = {
  next?: IngestJobData;
  done?: boolean;
  /** 业务失败码；无码的 done = 成功终态（如 dual-ready） */
  errorCode?: string;
};

function failStage(errorCode: string): IngestStageResult {
  return { done: true, errorCode };
}

type DocRow = typeof documents.$inferSelect;
/** pino child logger — 避免 child 泛型与 root Logger 不兼容 */
type StageLog = {
  info: typeof logger.info;
  warn: typeof logger.warn;
  error: typeof logger.error;
};

function resolveLedgerIndexVersion(
  data: IngestJobData,
  doc: DocRow,
  result: IngestStageResult,
): number | null {
  return result.next?.indexVersion ?? data.indexVersion ?? doc.indexVersion ?? null;
}

async function loadObjectBytes(objectKey: string | null): Promise<Buffer> {
  return readObjectBytes(storeConfigFromEnv(env), objectKey);
}

async function setDoc(
  docId: string,
  patch: Partial<typeof documents.$inferInsert>,
): Promise<void> {
  const db = getDb();
  await db.update(documents).set(patch).where(eq(documents.id, docId));
}

async function getDoc(docId: string) {
  const db = getDb();
  const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  return doc ?? null;
}

function enqueueNext(
  data: IngestJobData,
  stage: IngestStage,
  indexVersion?: number,
): IngestJobData {
  return withStageAndVersion(data, stage, indexVersion);
}

/** 简单段落分块（structure_paragraph 最低实现） */
export function splitParagraphs(text: string, minChars: number): string[] {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= minChars);
  return parts;
}

/**
 * 按策略切分正文。未实现码 **不得** 静默回落段落切（X-03）。
 * @returns pieces 或 errorCode
 */
export function splitByChunkStrategy(
  strategy: string,
  text: string,
  minChars: number,
): { ok: true; pieces: string[] } | { ok: false; errorCode: string; message: string } {
  const code = strategy.trim() || DEFAULT_CHUNK_STRATEGY;
  if (!isImplementedChunkStrategy(code)) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_CHUNK_STRATEGY',
      message: `chunkStrategy not implemented: ${code} (only structure_paragraph)`,
    };
  }
  if (code === 'structure_paragraph') {
    return { ok: true, pieces: splitParagraphs(text, minChars) };
  }
  // 防御：implemented 集合扩了但未接 switch
  return {
    ok: false,
    errorCode: 'UNSUPPORTED_CHUNK_STRATEGY',
    message: `chunkStrategy registered as implemented but no splitter: ${code}`,
  };
}

export async function runIngestStage(data: IngestJobData): Promise<IngestStageResult> {
  const log = logger.child({ docId: data.docId, stage: data.stage });
  const doc = await getDoc(data.docId);
  if (!doc) {
    // 无 tenant/kb：跳过账本（prd：无 doc 上下文可不写行）
    log.error('document not found');
    return failStage('DOC_NOT_FOUND');
  }

  // ADR-048：任意阶段再确认
  if (doc.approvalStatus !== 'approved') {
    await setDoc(data.docId, {
      status: 'failed',
      errorCode: 'NOT_APPROVED',
      errorMessage: 'scan/pipeline blocked: not approved',
    });
    const denied = failStage('NOT_APPROVED');
    const deniedJobId = await recordStageStart(getDb(), {
      tenantId: doc.tenantId,
      kbId: doc.kbId,
      docId: doc.id,
      stage: data.stage,
      indexVersion: data.indexVersion ?? doc.indexVersion,
    });
    await recordStageEnd(getDb(), deniedJobId, data.stage, denied, data.indexVersion);
    return denied;
  }

  const jobId = await recordStageStart(getDb(), {
    tenantId: doc.tenantId,
    kbId: doc.kbId,
    docId: doc.id,
    stage: data.stage,
    indexVersion: data.indexVersion ?? doc.indexVersion,
  });

  try {
    const result = await runIngestStageCore(data, doc, log);
    await recordStageEnd(
      getDb(),
      jobId,
      data.stage,
      result,
      resolveLedgerIndexVersion(data, doc, result),
    );
    return result;
  } catch (err) {
    await recordStageEnd(
      getDb(),
      jobId,
      data.stage,
      { done: true, errorCode: 'PIPELINE_THROW' },
      data.indexVersion ?? doc.indexVersion,
    );
    throw err;
  }
}

/** 状态机本体；账本由 runIngestStage 外层统一写 */
async function runIngestStageCore(
  data: IngestJobData,
  doc: DocRow,
  log: StageLog,
): Promise<IngestStageResult> {
  switch (data.stage) {
    case 'scan': {
      await setDoc(data.docId, { status: 'scanning', errorCode: null, errorMessage: null });
      // X-02 防御：env 闸应已拒 on；若绕过配置仍不得当 clean
      if (isScanModeRuntimeBlocked(env.INGEST_SCAN_MODE)) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'SCAN_ENGINE_UNAVAILABLE',
          errorMessage:
            'INGEST_SCAN_MODE=on but real scan engine is not wired (QUAL-2); refuse clean pass',
        });
        log.error('scan blocked: mode=on without engine');
        return failStage('SCAN_ENGINE_UNAVAILABLE');
      }
      if (env.INGEST_SCAN_MODE === 'mock_infected') {
        // infected：删对象 + failed
        if (doc.objectKey) {
          await deleteObject(storeConfigFromEnv(env), doc.objectKey);
        }
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'MALWARE',
          errorMessage: 'mock infected — object deleted',
        });
        log.warn('scan infected');
        return failStage('MALWARE');
      }
      // mock_clean | off（仅 non-prod 可启动）
      if (env.INGEST_SCAN_MODE === 'off') {
        log.info('scan skipped (INGEST_SCAN_MODE=off, non-prod only)');
      } else {
        log.info('scan clean (mock_clean)');
      }
      return { next: enqueueNext(data, 'parse') };
    }

    case 'parse': {
      await setDoc(data.docId, { status: 'parsing' });
      // 非 txt/md 先拒，避免把 PDF 等二进制读成 UTF-8
      if (!hasUtf8TextLayer(doc.contentType, doc.objectKey)) {
        await setDoc(data.docId, {
          status: 'needs_ocr',
          errorCode: 'NO_TEXT_LAYER',
          errorMessage: `no utf8 text layer for ${doc.contentType ?? doc.objectKey ?? 'object'}`,
          parsedText: null,
          extractMethod: 'none',
        });
        log.warn('needs_ocr — not txt/md');
        return failStage('NO_TEXT_LAYER');
      }
      const text = decodeUtf8Text(await loadObjectBytes(doc.objectKey)).trim();
      if (text.length < env.INGEST_MIN_EXTRACTED_CHARS) {
        await setDoc(data.docId, {
          status: 'needs_ocr',
          errorCode: 'NO_TEXT_LAYER',
          errorMessage: `extracted chars ${text.length} < ${env.INGEST_MIN_EXTRACTED_CHARS}`,
          parsedText: text || null,
          extractMethod: 'text',
        });
        log.warn('needs_ocr — no text layer');
        return failStage('NO_TEXT_LAYER');
      }
      const mongoDocId = await upsertDocumentBody({
        url: env.MONGODB_URL,
        docId: data.docId,
        kbId: doc.kbId,
        text,
      });
      await setDoc(data.docId, {
        parsedText: text,
        extractMethod: 'text',
        mongoDocId: env.MONGODB_URL.trim() ? mongoDocId : localMongoDocId(data.docId),
      });
      log.info({ chars: text.length }, 'parse done');
      return { next: enqueueNext(data, 'chunk') };
    }

    case 'chunk': {
      await setDoc(data.docId, { status: 'chunking' });
      const db = getDb();

      // X-04：带 indexVersion 的 job = 恢复路径，禁止重分块
      if (data.indexVersion != null) {
        const [existingManifest] = await db
          .select()
          .from(chunkManifests)
          .where(
            and(
              eq(chunkManifests.docId, doc.id),
              eq(chunkManifests.indexVersion, data.indexVersion),
            ),
          )
          .limit(1);
        const decision = decideChunkPath(data.indexVersion, !!existingManifest);
        if (decision.action === 'resume_embed') {
          log.info(
            { indexVersion: decision.indexVersion },
            'chunk idempotent resume → embed (no re-split)',
          );
          return {
            next: enqueueNext(data, 'embed', decision.indexVersion),
          };
        }
        if (decision.action === 'fail') {
          await setDoc(data.docId, {
            status: 'failed',
            errorCode: decision.errorCode,
            errorMessage: decision.message,
          });
          log.warn({ indexVersion: data.indexVersion }, decision.message);
          return failStage(decision.errorCode);
        }
        // materialize 仅无 version 时出现；带 version 不会落到此
      }

      const text = doc.parsedText ?? '';
      const strategyCode = doc.chunkStrategy?.trim() || DEFAULT_CHUNK_STRATEGY;
      const split = splitByChunkStrategy(
        strategyCode,
        text,
        env.INGEST_MIN_EXTRACTED_CHARS,
      );
      if (!split.ok) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: split.errorCode,
          errorMessage: split.message,
        });
        log.warn({ strategyCode }, 'chunk strategy unsupported');
        return failStage(split.errorCode);
      }
      const pieces = split.pieces;
      if (pieces.length === 0) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'EMPTY_CHUNKS',
          errorMessage: 'no chunks after split',
        });
        return failStage('EMPTY_CHUNKS');
      }

      // 首跑 / reindex：新建 indexVersion 并冻结 manifest
      const indexVersion = (doc.indexVersion || 0) + 1;
      const chunkIds: string[] = [];

      // doc 内简单去重：相同 body 跳过
      const seen = new Set<string>();
      let ordinal = 0;
      for (const body of pieces) {
        const norm = body.toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        const id = uuidv7();
        chunkIds.push(id);
        const prefix = `${doc.title} / section`;
        await db.insert(chunks).values({
          id,
          tenantId: doc.tenantId,
          kbId: doc.kbId,
          docId: doc.id,
          indexVersion,
          ordinal,
          preview: body.slice(0, 200),
          bodyText: body,
          contextPrefix: prefix,
          tokenCount: Math.ceil(body.length / 4),
        });
        ordinal += 1;
      }

      if (chunkIds.length === 0) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'EMPTY_CHUNKS',
          errorMessage: 'all chunks deduped away',
        });
        return failStage('EMPTY_CHUNKS');
      }

      await db.insert(chunkManifests).values({
        id: uuidv7(),
        tenantId: doc.tenantId,
        kbId: doc.kbId,
        docId: doc.id,
        indexVersion,
        chunkIds,
        frozen: 1,
        strategy: strategyCode,
      });

      await setDoc(data.docId, {
        indexVersion,
        embedReady: 0,
        esReady: 0,
      });
      log.info({ indexVersion, chunkCount: chunkIds.length }, 'manifest frozen');
      return { next: enqueueNext(data, 'embed', indexVersion) };
    }

    case 'embed': {
      await setDoc(data.docId, { status: 'embedding' });
      if (env.INGEST_EMBED_MODE === 'fail') {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'EMBED_FAILED',
          errorMessage: 'mock embed failure',
          embedReady: 0,
        });
        return failStage('EMBED_FAILED');
      }

      const indexVersion = resolveIndexVersion(data.indexVersion, doc.indexVersion);
      if (indexVersion == null) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'MISSING_INDEX_VERSION',
          errorMessage: 'embed requires indexVersion (job or document)',
        });
        return failStage('MISSING_INDEX_VERSION');
      }

      const db = getDb();
      const [manifest] = await db
        .select()
        .from(chunkManifests)
        .where(
          and(
            eq(chunkManifests.docId, doc.id),
            eq(chunkManifests.indexVersion, indexVersion),
          ),
        )
        .limit(1);

      if (!manifest) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'NO_MANIFEST',
          errorMessage: 'missing frozen manifest',
        });
        return failStage('NO_MANIFEST');
      }

      const existingRows = await db
        .select({ chunkId: chunkEmbeddings.chunkId })
        .from(chunkEmbeddings)
        .where(
          and(
            eq(chunkEmbeddings.docId, doc.id),
            eq(chunkEmbeddings.indexVersion, indexVersion),
          ),
        );
      const toEmbed = missingEmbeddingChunkIds(
        manifest.chunkIds,
        existingRows.map((r) => r.chunkId),
      );

      const dims = 8;
      for (const chunkId of toEmbed) {
        const vector = Array.from({ length: dims }, (_, i) => ((chunkId.charCodeAt(i % chunkId.length) ?? 1) % 97) / 97);
        await db.insert(chunkEmbeddings).values({
          id: uuidv7(),
          tenantId: doc.tenantId,
          kbId: doc.kbId,
          docId: doc.id,
          chunkId,
          indexVersion,
          model: 'mock-embed',
          dims,
          embedding: vector,
        });
      }

      await setDoc(data.docId, { indexVersion, embedReady: 1 });
      log.info(
        {
          indexVersion,
          chunkCount: manifest.chunkIds.length,
          inserted: toEmbed.length,
          skipped: manifest.chunkIds.length - toEmbed.length,
        },
        'embed done (idempotent skip existing)',
      );
      // 串行：仅 embed 成功后 es_index；透传 indexVersion
      return { next: enqueueNext(data, 'es_index', indexVersion) };
    }

    case 'es_index': {
      await setDoc(data.docId, { status: 'indexing_es' });

      // 硬约束：未 embed 不得 es / ready
      if (doc.embedReady !== 1) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'EMBED_NOT_READY',
          errorMessage: 'es_index requires embed_ready',
        });
        return failStage('EMBED_NOT_READY');
      }

      const indexVersion = resolveIndexVersion(data.indexVersion, doc.indexVersion);
      if (indexVersion == null) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'MISSING_INDEX_VERSION',
          errorMessage: 'es_index requires indexVersion (job or document)',
        });
        return failStage('MISSING_INDEX_VERSION');
      }

      if (env.INGEST_ES_MODE === 'fail') {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'ES_INDEX_FAILED',
          errorMessage: 'mock ES failure — not ready',
          esReady: 0,
        });
        log.warn('es mock fail — document not ready');
        return failStage('ES_INDEX_FAILED');
      }

      const db = getDb();
      const [manifest] = await db
        .select()
        .from(chunkManifests)
        .where(
          and(
            eq(chunkManifests.docId, doc.id),
            eq(chunkManifests.indexVersion, indexVersion),
          ),
        )
        .limit(1);

      if (!manifest) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'NO_MANIFEST',
          errorMessage: 'missing frozen manifest for es',
        });
        return failStage('NO_MANIFEST');
      }

      let report: { ok: boolean; missing: string[]; orphan: string[] };

      if (env.INGEST_ES_MODE === 'http') {
        const cfg = esHttpConfigFromEnv(env);
        if (!cfg) {
          await setDoc(data.docId, {
            status: 'failed',
            errorCode: 'ES_INDEX_FAILED',
            errorMessage: 'INGEST_ES_MODE=http requires ELASTICSEARCH_URL',
            esReady: 0,
          });
          return failStage('ES_INDEX_FAILED');
        }
        try {
          const chunkRows = await db
            .select({
              id: chunks.id,
              bodyText: chunks.bodyText,
              contextPrefix: chunks.contextPrefix,
            })
            .from(chunks)
            .where(inArray(chunks.id, manifest.chunkIds));
          await ensureSparseIndex(cfg);
          await bulkIndexSparse(
            cfg,
            chunkRows.map((row) => ({
              chunkId: row.id,
              kbId: doc.kbId,
              docId: doc.id,
              sparseText: sparseTextForChunk(row.contextPrefix, row.bodyText),
            })),
          );
          const indexed = await listIndexedChunkIds(cfg, doc.id);
          report = reconcileIndexed(indexed, manifest.chunkIds);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await setDoc(data.docId, {
            status: 'failed',
            errorCode: 'ES_INDEX_FAILED',
            errorMessage: msg.slice(0, 500),
            esReady: 0,
          });
          log.warn({ err }, 'es http index failed');
          return failStage('ES_INDEX_FAILED');
        }
      } else {
        // 按 doc 维度索引/对账；bulkIndex 为 set 合并 → 同 version 重跑幂等
        mockEsStore.bulkIndex(doc.id, indexVersion, manifest.chunkIds);
        report = mockEsStore.reconcile(doc.id, indexVersion, manifest.chunkIds);
      }

      if (!report.ok) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'ES_RECONCILE_FAILED',
          errorMessage: JSON.stringify(report),
          esReady: 0,
        });
        return failStage('ES_RECONCILE_FAILED');
      }

      // 双就绪 → ready；lifecycle 仍 draft
      await setDoc(data.docId, {
        indexVersion,
        esReady: 1,
        status: 'ready',
        lifecycle: 'draft',
        errorCode: null,
        errorMessage: null,
      });
      log.info(
        {
          indexVersion,
          chunkCount: manifest.chunkIds.length,
          ingestReport: {
            docId: doc.id,
            kbId: doc.kbId,
            indexVersion,
            chunkIds: manifest.chunkIds,
            embedReady: true,
            esReady: true,
            reconcile: report,
          },
        },
        'dual-ready → status=ready lifecycle=draft',
      );
      return { done: true };
    }

    default:
      log.error('unknown stage');
      return failStage('UNKNOWN_STAGE');
  }
}
