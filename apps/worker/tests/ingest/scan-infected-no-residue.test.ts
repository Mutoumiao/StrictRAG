/**
 * 目标：mock infected 处置后既不得有对象残留（已删且不再存在），也不得有任何隔离区落点。
 * 需求：剧本 M8 · prds/10-delivery/03-acceptance-scenarios.md · prds/09-security/01-auth-acl-compliance.md（infected 处置：立即删对象 + 无隔离区）
 * 被测：runIngestStage scan（INGEST_SCAN_MODE=mock_infected）+ src 源码护栏（object-store 变更面）
 * 简介：注入 mock 感染（≠ 真杀毒，QUAL-2 未接）：专断言 deleteObject 恰一次且键即原对象键、删后对象不再存在、
 *       无第二落点；静态守卫钉 worker 源码无 quarantine 落点、object-store 变更面只有 deleteObject。
 *       「审计含 hash + uploaderId + timestamp」在仓内无落点，不在本测例范围。
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import { createHarness, doc, miniPdf, objectStoreMock } from './_support/ingest-harness.js';

const OBJECT_KEY = 'kb/x/eicar-sample.pdf';

const h = createHarness();
const baseObjectStore = objectStoreMock(h);
/** 存活对象键：删除后键须消失（「对象不存在」判据），且全程不得出现第二个键（无隔离区等第二落点） */
const liveKeys = new Set<string>();

vi.mock('../../src/env.js', () => ({ env: h.env }));
vi.mock('../../src/db.js', () => ({ getDb: () => h.db }));
vi.mock('../../src/ingest/object-store.js', () => ({
  ...baseObjectStore,
  deleteObject: async (cfg: unknown, key: string | null) => {
    await baseObjectStore.deleteObject(cfg, key);
    liveKeys.delete(key ?? '');
  },
}));
vi.mock('../../src/ingest/mongo-body.js', () => ({
  localMongoDocId: (docId: string) => `local:${docId}`,
  upsertDocumentBody: async () => 'mongo-doc-1',
  upsertChunkBodies: async () => undefined,
  deleteBodiesForDoc: async () => undefined,
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');

const SAMPLE_BYTES = miniPdf('EICAR mock sample: not a real scan engine result.');

function scanJob(): IngestJobData {
  const current = doc(h.state!);
  return { docId: current.id, kbId: current.kbId, tenantId: current.tenantId, stage: 'scan' };
}

/** 对象写入 / 搬运面：infected 处置只允许删，不得出现隔离区或转存标识符 */
const OBJECT_MUTATION_TOKENS = /quarantine|putObject|copyObject|moveObject|storeObject/i;

async function listSrcFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true });
  return entries.map((e) => String(e)).filter((e) => e.endsWith('.ts'));
}

beforeEach(() => {
  h.reset();
  liveKeys.clear();
  liveKeys.add(OBJECT_KEY);
  h.env.INGEST_SCAN_MODE = 'mock_infected';
  h.boot(
    { objectKey: OBJECT_KEY, contentType: 'application/pdf', status: 'uploaded' },
    SAMPLE_BYTES,
  );
});

afterEach(() => {
  h.env.INGEST_SCAN_MODE = 'mock_clean';
});

describe('剧本 M8 · infected 处置后无对象残留、无隔离区', () => {
  it('M8：infected 处置后对象已删且不再存在，且无第二落点（无隔离区键）', async () => {
    expect(liveKeys.has(OBJECT_KEY)).toBe(true);

    const result = await runIngestStage(scanJob());

    expect(result.errorCode).toBe('MALWARE');
    expect(doc(h.state!).status).toBe('failed');
    // deleteObject 恰一次，且键即原对象键
    expect(h.deletedKeys).toEqual([OBJECT_KEY]);
    // 对象已不存在；且没有被搬到任何第二个键（隔离区 / 副本）
    expect(liveKeys.has(OBJECT_KEY)).toBe(false);
    expect([...liveKeys]).toEqual([]);
  });

  it('M8 静态守卫：worker 源码无 quarantine 隔离区落点，object-store 变更面只有 deleteObject', async () => {
    const srcDir = path.join(process.cwd(), 'src');
    const files = await listSrcFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const withMutationToken: string[] = [];
    for (const file of files) {
      const text = await readFile(path.join(srcDir, file), 'utf8');
      if (OBJECT_MUTATION_TOKENS.test(text)) withMutationToken.push(file);
    }
    expect(withMutationToken).toEqual([]);

    const store = await readFile(path.join(srcDir, 'ingest/object-store.ts'), 'utf8');
    const exported = [...store.matchAll(/export (?:async )?function (\w+)/g)]
      .map((m) => m[1])
      .sort();
    // 变更面只有删除：不得新出隔离区 / 转存入口
    expect(exported).toEqual([
      'deleteObject',
      'readObjectBytes',
      'readObjectText',
      'storeConfigFromEnv',
    ]);
  });
});
