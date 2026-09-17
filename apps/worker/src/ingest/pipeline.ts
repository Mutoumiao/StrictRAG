import {
  DEFAULT_CHUNK_STRATEGY,
  isImplementedChunkStrategy,
  l0ContextPrefix,
  parseContextMode,
  resolveContextSource,
  type ContextSource,
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
import { embedTextsHttp, mockEmbedVector } from './embed-http.js';
import { decodeUtf8Text, hasUtf8TextLayer } from './extract-text.js';
import { extractPdfTextLayer, isPdfObject } from './pdf-text.js';
import {
  findCrossDocConflict,
  loadCrossDocSearchableChunks,
} from './cross-doc-dedupe.js';
import {
  CONTEXTUALIZE_DOC_EXCERPT_MAX,
  contextualizeChunk,
} from './contextualize-http.js';
import { persistIngestReport } from './ingest-report.js';
import { recordStageEnd, recordStageStart, type StageLedgerContext } from './job-ledger.js';
import {
  deleteBodiesForDoc,
  localMongoDocId,
  upsertChunkBodies,
  upsertDocumentBody,
} from './mongo-body.js';
import { deleteObject, readObjectBytes, storeConfigFromEnv } from './object-store.js';
import { pipelineRequiresApproval, runDocumentPurge } from './purge.js';

/** 阶段结果：errorCode 供 worker 接 BullMQ retry / Unrecoverable */
export type IngestStageResult = {
  next?: IngestJobData;
  done?: boolean;
  /** 业务失败码；无码的 done = 成功终态（如 dual-ready） */
  errorCode?: string;
};

export type OcrExtractResult = { text: string; confidence: number };
export type OcrExtractFn = (
  buf: Buffer,
  meta: { contentType: string | null; objectKey: string | null },
) => Promise<OcrExtractResult | null>;

export type IngestStageDeps = {
  /** P5 开闸后注入；缺省无引擎 */
  ocrExtract?: OcrExtractFn;
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

export async function runIngestStage(
  data: IngestJobData,
  deps: IngestStageDeps = {},
): Promise<IngestStageResult> {
  const log = logger.child({ docId: data.docId, stage: data.stage });
  const doc = await getDoc(data.docId);
  if (!doc) {
    // 无 tenant/kb：跳过账本（prd：无 doc 上下文可不写行）
    log.error('document not found');
    return failStage('DOC_NOT_FOUND');
  }

  const ledgerCtx: StageLedgerContext = {
    tenantId: doc.tenantId,
    kbId: doc.kbId,
    docId: doc.id,
    stage: data.stage,
    indexVersion: data.indexVersion ?? doc.indexVersion,
  };

  // ADR-048：入库正向阶段再确认；purge 删除路径不要求已审批
  if (pipelineRequiresApproval(data.stage) && doc.approvalStatus !== 'approved') {
    await setDoc(data.docId, {
      status: 'failed',
      errorCode: 'NOT_APPROVED',
      errorMessage: 'scan/pipeline blocked: not approved',
    });
    const denied = failStage('NOT_APPROVED');
    const deniedJobId = await recordStageStart(getDb(), ledgerCtx);
    await recordStageEnd(getDb(), deniedJobId, ledgerCtx, denied, data.indexVersion);
    return denied;
  }

  const jobId = await recordStageStart(getDb(), ledgerCtx);

  try {
    const result = await runIngestStageCore(data, doc, log, deps);
    await recordStageEnd(
      getDb(),
      jobId,
      ledgerCtx,
      result,
      resolveLedgerIndexVersion(data, doc, result),
    );
    return result;
  } catch (err) {
    await recordStageEnd(
      getDb(),
      jobId,
      ledgerCtx,
      { done: true, errorCode: 'PIPELINE_THROW' },
      data.indexVersion ?? doc.indexVersion,
    );
    throw err;
  }
}

/** 状态机本体；账本由 runIngestStage 外层统一写 */
async function persistExtractedText(
  data: IngestJobData,
  text: string,
  extractMethod: string,
  log: StageLog,
): Promise<IngestStageResult> {
  const mongoDocId = await upsertDocumentBody({
    url: env.MONGODB_URL,
    docId: data.docId,
    kbId: data.kbId,
    text,
  });
  await setDoc(data.docId, {
    status: 'parsing',
    parsedText: text,
    extractMethod,
    mongoDocId: env.MONGODB_URL.trim() ? mongoDocId : localMongoDocId(data.docId),
    errorCode: null,
    errorMessage: null,
  });
  log.info({ chars: text.length, extractMethod }, 'text ready');
  return { next: enqueueNext(data, 'chunk') };
}

async function markNeedsOcr(
  data: IngestJobData,
  message: string,
  extra: { parsedText?: string | null; extractMethod?: string },
  log: StageLog,
  handoffToOcr: boolean,
): Promise<IngestStageResult> {
  await setDoc(data.docId, {
    status: 'needs_ocr',
    errorCode: 'NO_TEXT_LAYER',
    errorMessage: message,
    parsedText: extra.parsedText ?? null,
    extractMethod: extra.extractMethod ?? 'none',
  });
  log.warn(message);
  if (handoffToOcr && env.INGEST_OCR_ENABLED) {
    return { next: enqueueNext(data, 'ocr') };
  }
  return failStage('NO_TEXT_LAYER');
}

async function runIngestStageCore(
  data: IngestJobData,
  doc: DocRow,
  log: StageLog,
  deps: IngestStageDeps,
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
      const buf = await loadObjectBytes(doc.objectKey);
      let text = '';
      let extractMethod: 'text' | 'pdf_text' | 'none' = 'text';
      if (hasUtf8TextLayer(doc.contentType, doc.objectKey)) {
        text = decodeUtf8Text(buf).trim();
      } else if (isPdfObject(doc.contentType, doc.objectKey)) {
        const pdfText = extractPdfTextLayer(buf);
        if (!pdfText) {
          return markNeedsOcr(
            data,
            'pdf has no text layer',
            { parsedText: null, extractMethod: 'none' },
            log,
            true,
          );
        }
        text = pdfText.trim();
        extractMethod = 'pdf_text';
      } else {
        return markNeedsOcr(
          data,
          `no utf8 text layer for ${doc.contentType ?? doc.objectKey ?? 'object'}`,
          { parsedText: null, extractMethod: 'none' },
          log,
          true,
        );
      }
      if (text.length < env.INGEST_MIN_EXTRACTED_CHARS) {
        return markNeedsOcr(
          data,
          `extracted chars ${text.length} < ${env.INGEST_MIN_EXTRACTED_CHARS}`,
          { parsedText: text || null, extractMethod },
          log,
          false,
        );
      }
      return persistExtractedText(data, text, extractMethod, log);
    }

    case 'ocr': {
      if (!env.INGEST_OCR_ENABLED) {
        return markNeedsOcr(
          data,
          'ocr stage reached while INGEST_OCR_ENABLED=false',
          { parsedText: null, extractMethod: 'none' },
          log,
          false,
        );
      }
      if (hasUtf8TextLayer(doc.contentType, doc.objectKey)) {
        return markNeedsOcr(
          data,
          'ocr refused for utf8 text-layer objects',
          { parsedText: null, extractMethod: 'text' },
          log,
          false,
        );
      }
      const buf = await loadObjectBytes(doc.objectKey);
      const extract = deps.ocrExtract;
      if (!extract) {
        await setDoc(data.docId, {
          status: 'needs_ocr',
          errorCode: 'OCR_UNAVAILABLE',
          errorMessage: 'INGEST_OCR_ENABLED=true but no OCR engine is wired',
          parsedText: null,
          extractMethod: 'none',
        });
        log.warn('OCR_UNAVAILABLE');
        return failStage('OCR_UNAVAILABLE');
      }
      let out: OcrExtractResult | null;
      try {
        out = await extract(buf, {
          contentType: doc.contentType,
          objectKey: doc.objectKey,
        });
      } catch (err) {
        await setDoc(data.docId, {
          status: 'needs_ocr',
          errorCode: 'OCR_UNAVAILABLE',
          errorMessage: err instanceof Error ? err.message : 'OCR engine threw',
          parsedText: null,
          extractMethod: 'none',
        });
        log.warn({ err }, 'OCR_UNAVAILABLE');
        return failStage('OCR_UNAVAILABLE');
      }
      if (!out || !out.text.trim()) {
        await setDoc(data.docId, {
          status: 'needs_ocr',
          errorCode: 'OCR_EMPTY',
          errorMessage: 'OCR returned empty text',
          parsedText: null,
          extractMethod: 'none',
        });
        log.warn('OCR_EMPTY');
        return failStage('OCR_EMPTY');
      }
      if (!Number.isFinite(out.confidence) || out.confidence < env.INGEST_OCR_MIN_CONFIDENCE) {
        await setDoc(data.docId, {
          status: 'needs_review',
          errorCode: 'OCR_LOW_CONFIDENCE',
          errorMessage: `OCR confidence ${String(out.confidence)} < ${env.INGEST_OCR_MIN_CONFIDENCE}`,
          parsedText: null,
          extractMethod: 'none',
        });
        log.warn({ confidence: out.confidence }, 'OCR_LOW_CONFIDENCE');
        return failStage('OCR_LOW_CONFIDENCE');
      }
      const ocrText = out.text.trim();
      if (ocrText.length < env.INGEST_MIN_EXTRACTED_CHARS) {
        await setDoc(data.docId, {
          status: 'needs_ocr',
          errorCode: 'OCR_TOO_SHORT',
          errorMessage: `ocr chars ${ocrText.length} < ${env.INGEST_MIN_EXTRACTED_CHARS}`,
          parsedText: null,
          extractMethod: 'none',
        });
        log.warn('OCR_TOO_SHORT');
        return failStage('OCR_TOO_SHORT');
      }
      return persistExtractedText(data, ocrText, 'ocr', log);
    }

    case 'chunk': {
      if (doc.status === 'needs_review' || doc.status === 'needs_ocr') {
        log.warn({ status: doc.status, errorCode: doc.errorCode }, 'chunk blocked: OCR/parse not ready');
        return failStage(doc.errorCode ?? 'NO_TEXT_LAYER');
      }
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

      // doc 内精确去重；同 KB 跨文档近重复 skip_index（不进 manifest）
      const seen = new Set<string>();
      const chunkBodyRows: Array<{
        chunkId: string;
        tenantId: string;
        kbId: string;
        docId: string;
        indexVersion: number;
        contextPrefix: string | null;
        text: string;
        tokenCount: number | null;
      }> = [];
      let ordinal = 0;
      let internalDropped = 0;
      let crossDocDropped = 0;
      const conflictPairs: Array<{
        otherDocId: string;
        otherChunkId: string;
        action: 'skip_index';
      }> = [];
      const corpus = await loadCrossDocSearchableChunks(db, {
        kbId: doc.kbId,
        excludeDocId: doc.id,
      });
      const contextMode = parseContextMode(doc.chunkStrategyParams?.contextMode);
      const l0Prefix = l0ContextPrefix(doc.title ?? '');
      // L1 只在 http 模式真调；默认 off 保持「回退 L0」的历史行为（不写假 l1_llm）
      const l1 =
        contextMode === 'l1_llm' && env.INGEST_CONTEXTUALIZE_MODE === 'http'
          ? {
              baseUrl: env.GATEWAY_BASE_URL,
              apiKey: env.GATEWAY_API_KEY,
              model: env.GATEWAY_CHAT_MODEL,
              title: doc.title ?? '',
              docExcerpt: (doc.parsedText ?? '').slice(0, CONTEXTUALIZE_DOC_EXCERPT_MAX),
            }
          : null;
      let l1Ok = 0;
      let l1Fallback = 0;
      for (const body of pieces) {
        const norm = body.toLowerCase();
        if (seen.has(norm)) {
          internalDropped += 1;
          continue;
        }
        seen.add(norm);
        const conflict = findCrossDocConflict(body, corpus);
        if (conflict) {
          crossDocDropped += 1;
          conflictPairs.push(conflict);
          continue;
        }
        const id = uuidv7();
        // L1 情境前缀：逐块调用；失败只影响该块的 prefix（回退 L0），不阻断入库
        let prefix = l0Prefix;
        if (l1) {
          try {
            prefix = await contextualizeChunk({ ...l1, chunk: body });
            l1Ok += 1;
          } catch (err) {
            l1Fallback += 1;
            log.warn({ err, docId: doc.id, ordinal }, 'contextualize L1 failed; 回退 L0 prefix');
          }
        }
        chunkIds.push(id);
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
          mongoBodyId: env.MONGODB_URL.trim() ? id : localMongoDocId(id),
        });
        chunkBodyRows.push({
          chunkId: id,
          tenantId: doc.tenantId,
          kbId: doc.kbId,
          docId: doc.id,
          indexVersion,
          contextPrefix: prefix,
          text: body,
          tokenCount: Math.ceil(body.length / 4),
        });
        ordinal += 1;
      }
      if (env.MONGODB_URL.trim()) {
        await upsertChunkBodies({ url: env.MONGODB_URL, rows: chunkBodyRows });
      }

      // 只要有一块没走上 L1，就不声称本轮 l1_llm（块自身 prefix 已各自回退 L0）
      const contextSource: ContextSource =
        l1 && l1Ok > 0 && l1Fallback === 0 ? 'l1_llm' : resolveContextSource(contextMode);
      // 报告计数与 contextSource 同口径（PRD 04 §5.2）：文档请求了 L1 而本轮未实际调用
      // （worker `INGEST_CONTEXTUALIZE_MODE≠http`）时整轮按回退计，不得出现「情境 l0_fallback · L0 回退 0」。
      const contextualizeL1Ok = l1 ? l1Ok : 0;
      const contextualizeL0Fallback = l1
        ? l1Fallback
        : contextSource === 'l0_fallback'
          ? chunkIds.length
          : 0;
      log.info(
        {
          event: 'contextualize_summary',
          docId: doc.id,
          contextualize_l1_ok: contextualizeL1Ok,
          contextualize_l0_fallback: contextualizeL0Fallback,
          contextSource,
        },
        'contextualize summary',
      );

      if (chunkIds.length === 0) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'EMPTY_CHUNKS',
          errorMessage: 'all chunks deduped away',
        });
        await persistIngestReport(db, {
          tenantId: doc.tenantId,
          kbId: doc.kbId,
          docId: doc.id,
          indexVersion,
          chunkCount: 0,
          internalDropped,
          crossDocDropped,
          conflictPairs,
          contextSource,
          contextualizeL1Ok,
          contextualizeL0Fallback,
          dualReady: false,
          embedReady: false,
          esReady: false,
          reconcile: null,
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
      await persistIngestReport(db, {
        tenantId: doc.tenantId,
        kbId: doc.kbId,
        docId: doc.id,
        indexVersion,
        chunkCount: chunkIds.length,
        internalDropped,
        crossDocDropped,
        conflictPairs,
        contextSource,
        contextualizeL1Ok,
        contextualizeL0Fallback,
        dualReady: false,
        embedReady: false,
        esReady: false,
        reconcile: null,
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
      let vectors: number[][] = [];
      let modelName = 'mock-embed';
      if (env.INGEST_EMBED_MODE === 'http') {
        const rows = await db
          .select({ id: chunks.id, bodyText: chunks.bodyText })
          .from(chunks)
          .where(inArray(chunks.id, toEmbed));
        const byId = new Map(rows.map((r) => [r.id, r.bodyText ?? '']));
        const texts = toEmbed.map((id) => byId.get(id) ?? '');
        try {
          vectors = await embedTextsHttp({
            baseUrl: `${env.GATEWAY_BASE_URL.replace(/\/$/, '')}/v1`,
            apiKey: env.GATEWAY_API_KEY,
            model: env.GATEWAY_EMBED_MODEL,
            texts,
          });
          modelName = env.GATEWAY_EMBED_MODEL;
        } catch (err) {
          await setDoc(data.docId, {
            status: 'failed',
            errorCode: 'EMBED_FAILED',
            errorMessage: err instanceof Error ? err.message : 'embed http failed',
            embedReady: 0,
          });
          return failStage('EMBED_FAILED');
        }
      } else {
        vectors = toEmbed.map((id) => mockEmbedVector(id, dims));
      }
      for (let i = 0; i < toEmbed.length; i++) {
        const chunkId = toEmbed[i]!;
        const vector = vectors[i] ?? mockEmbedVector(chunkId, dims);
        await db.insert(chunkEmbeddings).values({
          id: uuidv7(),
          tenantId: doc.tenantId,
          kbId: doc.kbId,
          docId: doc.id,
          chunkId,
          indexVersion,
          model: modelName,
          dims: vector.length || dims,
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
              tenantId: doc.tenantId,
              kbId: doc.kbId,
              docId: doc.id,
              sparseText: sparseTextForChunk(row.contextPrefix, row.bodyText),
              ownerDeptId: doc.ownerDeptId,
              aclPrincipals: doc.aclPrincipals,
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
        await persistIngestReport(db, {
          tenantId: doc.tenantId,
          kbId: doc.kbId,
          docId: doc.id,
          indexVersion,
          chunkCount: manifest.chunkIds.length,
          internalDropped: 0,
          crossDocDropped: 0,
          conflictPairs: [],
          dualReady: false,
          embedReady: doc.embedReady === 1,
          esReady: false,
          reconcile: report,
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
      await persistIngestReport(db, {
        tenantId: doc.tenantId,
        kbId: doc.kbId,
        docId: doc.id,
        indexVersion,
        chunkCount: manifest.chunkIds.length,
        internalDropped: 0,
        crossDocDropped: 0,
        conflictPairs: [],
        dualReady: true,
        embedReady: true,
        esReady: true,
        reconcile: report,
      });
      log.info(
        {
          indexVersion,
          chunkCount: manifest.chunkIds.length,
          ingestReport: {
            docId: doc.id,
            kbId: doc.kbId,
            indexVersion,
            chunkCount: manifest.chunkIds.length,
            embedReady: true,
            esReady: true,
            dualReady: true,
            reconcile: {
              ok: report.ok,
              missingCount: report.missing.length,
              orphanCount: report.orphan.length,
            },
          },
        },
        'dual-ready → status=ready lifecycle=draft',
      );
      return { done: true };
    }

    case 'purge': {
      await runDocumentPurge(doc, {
        deleteObject: (objectKey) => deleteObject(storeConfigFromEnv(env), objectKey),
        dropSparse: (docId) => mockEsStore.dropDoc(docId),
        deleteMongoBodies: (docId) => deleteBodiesForDoc({ url: env.MONGODB_URL, docId }),
        patchDoc: (patch) => setDoc(data.docId, patch),
      });
      log.info('purged object and sparse index; pg row archived');
      return { done: true };
    }

    default:
      log.error('unknown stage');
      return failStage('UNKNOWN_STAGE');
  }
}
