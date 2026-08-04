import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
} from '@strict-rag/db';
import { and, eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { uuidv7 } from 'uuidv7';

import { getDb } from '../db.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import type { IngestJobData, IngestStage } from '../queues.js';
import { mockEsStore } from './es-store.js';

async function loadObjectText(objectKey: string | null): Promise<string> {
  if (!objectKey) return '';
  const full = path.join(env.STORAGE_LOCAL_DIR, env.S3_BUCKET, objectKey);
  try {
    return await readFile(full, 'utf8');
  } catch {
    return '';
  }
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

function enqueueNext(data: IngestJobData, stage: IngestStage): IngestJobData {
  return { ...data, stage };
}

/** 简单段落分块（structure_paragraph 最低实现） */
export function splitParagraphs(text: string, minChars: number): string[] {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= minChars);
  return parts;
}

export async function runIngestStage(
  data: IngestJobData,
): Promise<{ next?: IngestJobData; done?: boolean }> {
  const log = logger.child({ docId: data.docId, stage: data.stage });
  const doc = await getDoc(data.docId);
  if (!doc) {
    log.error('document not found');
    return { done: true };
  }

  // ADR-048：任意阶段再确认
  if (doc.approvalStatus !== 'approved') {
    await setDoc(data.docId, {
      status: 'failed',
      errorCode: 'NOT_APPROVED',
      errorMessage: 'scan/pipeline blocked: not approved',
    });
    return { done: true };
  }

  switch (data.stage) {
    case 'scan': {
      await setDoc(data.docId, { status: 'scanning', errorCode: null, errorMessage: null });
      if (env.INGEST_SCAN_MODE === 'mock_infected') {
        // infected：删对象 + failed
        if (doc.objectKey) {
          try {
            const { unlink } = await import('node:fs/promises');
            await unlink(path.join(env.STORAGE_LOCAL_DIR, env.S3_BUCKET, doc.objectKey));
          } catch {
            /* ignore */
          }
        }
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'MALWARE',
          errorMessage: 'mock infected — object deleted',
        });
        log.warn('scan infected');
        return { done: true };
      }
      log.info('scan clean');
      return { next: enqueueNext(data, 'parse') };
    }

    case 'parse': {
      await setDoc(data.docId, { status: 'parsing' });
      const text = (await loadObjectText(doc.objectKey)).trim();
      if (text.length < env.INGEST_MIN_EXTRACTED_CHARS) {
        await setDoc(data.docId, {
          status: 'needs_ocr',
          errorCode: 'NO_TEXT_LAYER',
          errorMessage: `extracted chars ${text.length} < ${env.INGEST_MIN_EXTRACTED_CHARS}`,
          parsedText: text || null,
          extractMethod: 'text',
        });
        log.warn('needs_ocr — no text layer');
        return { done: true };
      }
      await setDoc(data.docId, {
        parsedText: text,
        extractMethod: 'text',
        mongoDocId: `local:${data.docId}`,
      });
      log.info({ chars: text.length }, 'parse done');
      return { next: enqueueNext(data, 'chunk') };
    }

    case 'chunk': {
      await setDoc(data.docId, { status: 'chunking' });
      const text = doc.parsedText ?? '';
      const pieces = splitParagraphs(text, env.INGEST_MIN_EXTRACTED_CHARS);
      if (pieces.length === 0) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'EMPTY_CHUNKS',
          errorMessage: 'no chunks after split',
        });
        return { done: true };
      }

      const indexVersion = (doc.indexVersion || 0) + 1;
      const db = getDb();
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
        return { done: true };
      }

      await db.insert(chunkManifests).values({
        id: uuidv7(),
        tenantId: doc.tenantId,
        kbId: doc.kbId,
        docId: doc.id,
        indexVersion,
        chunkIds,
        frozen: 1,
        strategy: doc.chunkStrategy ?? 'structure_paragraph',
      });

      await setDoc(data.docId, {
        indexVersion,
        embedReady: 0,
        esReady: 0,
      });
      log.info({ indexVersion, chunkCount: chunkIds.length }, 'manifest frozen');
      return { next: enqueueNext(data, 'embed') };
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
        return { done: true };
      }

      const db = getDb();
      const [manifest] = await db
        .select()
        .from(chunkManifests)
        .where(
          and(
            eq(chunkManifests.docId, doc.id),
            eq(chunkManifests.indexVersion, doc.indexVersion),
          ),
        )
        .limit(1);

      if (!manifest) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'NO_MANIFEST',
          errorMessage: 'missing frozen manifest',
        });
        return { done: true };
      }

      const dims = 8;
      for (const chunkId of manifest.chunkIds) {
        const vector = Array.from({ length: dims }, (_, i) => ((chunkId.charCodeAt(i % chunkId.length) ?? 1) % 97) / 97);
        await db.insert(chunkEmbeddings).values({
          id: uuidv7(),
          tenantId: doc.tenantId,
          kbId: doc.kbId,
          docId: doc.id,
          chunkId,
          indexVersion: doc.indexVersion,
          model: 'mock-embed',
          dims,
          embedding: vector,
        });
      }

      await setDoc(data.docId, { embedReady: 1 });
      log.info({ chunkCount: manifest.chunkIds.length }, 'embed done');
      // 串行：仅 embed 成功后 es_index
      return { next: enqueueNext(data, 'es_index') };
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
        return { done: true };
      }

      if (env.INGEST_ES_MODE === 'fail') {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'ES_INDEX_FAILED',
          errorMessage: 'mock ES failure — not ready',
          esReady: 0,
        });
        log.warn('es mock fail — document not ready');
        return { done: true };
      }

      const db = getDb();
      const [manifest] = await db
        .select()
        .from(chunkManifests)
        .where(
          and(
            eq(chunkManifests.docId, doc.id),
            eq(chunkManifests.indexVersion, doc.indexVersion),
          ),
        )
        .limit(1);

      if (!manifest) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'NO_MANIFEST',
          errorMessage: 'missing frozen manifest for es',
        });
        return { done: true };
      }

      // 按 doc 维度索引/对账（同 KB 多文档不得互相污染 orphan 判定）
      mockEsStore.bulkIndex(doc.id, doc.indexVersion, manifest.chunkIds);
      const report = mockEsStore.reconcile(doc.id, doc.indexVersion, manifest.chunkIds);
      if (!report.ok) {
        await setDoc(data.docId, {
          status: 'failed',
          errorCode: 'ES_RECONCILE_FAILED',
          errorMessage: JSON.stringify(report),
          esReady: 0,
        });
        return { done: true };
      }

      // 双就绪 → ready；lifecycle 仍 draft
      await setDoc(data.docId, {
        esReady: 1,
        status: 'ready',
        lifecycle: 'draft',
        errorCode: null,
        errorMessage: null,
      });
      log.info(
        {
          indexVersion: doc.indexVersion,
          chunkCount: manifest.chunkIds.length,
          ingestReport: {
            docId: doc.id,
            kbId: doc.kbId,
            indexVersion: doc.indexVersion,
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
      return { done: true };
  }
}
