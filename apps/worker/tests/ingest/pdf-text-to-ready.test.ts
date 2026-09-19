/**
 * 目标：有文本层的制度 PDF 必须抽文本层后跑到双就绪 ready，且未上架（draft）仍不可检索。
 * 需求：剧本 Q2 · prds/10-delivery/03-acceptance-scenarios.md · prds/04-pipelines/01-offline-ingest.md
 * 被测：runIngestStage scan → parse → chunk → embed → es_index + 双闸谓词
 * 简介：默认 mock 栈（mock embed / mock ES，≠ 生产 ES）。断言 extractMethod=pdf_text、
 *       chunk 集 ≡ 向量集 ≡ mock ES 集、ready 但仍 draft；active 后双闸才放行（ask 的 HTTP 真值在 apps/api）。
 */

import { isDefaultRetrievable } from '@strict-rag/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import { createHarness, doc, idsOf, miniPdf, objectStoreMock } from './_support/ingest-harness.js';

const PDF_TEXT =
  'Annual leave policy: 15 days per year; submit the written request one working day ahead.';

const h = createHarness();

vi.mock('../../src/env.js', () => ({ env: h.env }));
vi.mock('../../src/db.js', () => ({ getDb: () => h.db }));
vi.mock('../../src/ingest/object-store.js', () => objectStoreMock(h));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');
const { mockEsStore } = await import('../../src/ingest/es-store.js');

function stage(stageName: IngestJobData['stage']): IngestJobData {
  const current = doc(h.state!);
  return { docId: current.id, kbId: current.kbId, tenantId: current.tenantId, stage: stageName };
}

beforeEach(() => {
  h.reset();
  h.env.INGEST_ES_MODE = 'mock';
  h.env.INGEST_EMBED_MODE = 'mock';
  mockEsStore.reset();
});

afterEach(() => {
  mockEsStore.reset();
});

describe('剧本 Q2 · 有文本层 PDF 到 ready', () => {
  it('抽文本层（pdf_text）后双就绪 ready，且 draft 阶段双闸仍不放行', async () => {
    const state = h.boot(
      {
        title: '年假制度',
        objectKey: 'kb/x/leave.pdf',
        contentType: 'application/pdf',
        status: 'uploaded',
      },
      miniPdf(PDF_TEXT),
    );

    for (const name of ['scan', 'parse', 'chunk', 'embed', 'es_index'] as const) {
      const result = await runIngestStage(stage(name));
      expect(result.errorCode, `${name} 不得报错`).toBeUndefined();
    }

    const current = doc(state);
    expect(current.extractMethod).toBe('pdf_text');
    expect(current.parsedText).toContain('Annual leave policy');
    expect(current.status).toBe('ready');
    expect(current.embedReady).toBe(1);
    expect(current.esReady).toBe(1);

    const manifest = state.manifests.find((m) => m.indexVersion === current.indexVersion);
    const manifestIds = [...(manifest!.chunkIds as string[])].sort();
    expect(idsOf(state.chunks, current.indexVersion, 'id')).toEqual(manifestIds);
    expect(idsOf(state.embeddings, current.indexVersion, 'chunkId')).toEqual(manifestIds);
    expect(mockEsStore.listChunkIds(current.id, current.indexVersion)).toEqual(manifestIds);

    // 双就绪只是入库侧；上架（active）仍须单独动作，ask 的 HTTP 真值在 apps/api
    expect(current.lifecycle).toBe('draft');
    expect(isDefaultRetrievable({ status: current.status, lifecycle: current.lifecycle })).toBe(
      false,
    );
    expect(isDefaultRetrievable({ status: current.status, lifecycle: 'active' })).toBe(true);
  });
});
