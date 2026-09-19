/**
 * 目标：入库顺序必须全仓一致为 embed → es_index，且不得出现文档间混序（未 embed 就进 ES / 文档互相带跑）。
 * 需求：剧本 L9 · prds/10-delivery/03-acceptance-scenarios.md · ADR-038
 * 被测：runIngestStage 阶段链（chunk.next.stage / embed.next.stage）+ src/ingest 源码顺序守卫
 * 简介：两份文档串行：chunk→embed→es_index；embed 之前跑 es_index 必失败 EMBED_NOT_READY；
 *       A 的 es_index 不得让 B ready；静态守卫钉「'es_index' 字面量与入队点唯一」。
 *       默认 mock 栈（≠ 生产 ES）。
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { INGEST_STAGES } from '@strict-rag/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import { addDoc, createHarness, objectStoreMock } from './_support/ingest-harness.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DOC_A = '01900000-0000-7000-8000-0000000000a1';
const DOC_B = '01900000-0000-7000-8000-0000000000b1';

/** 正文须长于 INGEST_MIN_EXTRACTED_CHARS（40），否则整段被切分丢掉 */
const BODY_A =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理。';
const BODY_B =
  '报销单据须在费用发生后三十日内提交财务部审批入账，逾期未提交的将计入下一财年预算周期，跨年不予补报。';

const h = createHarness();

vi.mock('../../src/env.js', () => ({ env: h.env }));
vi.mock('../../src/db.js', () => ({ getDb: () => h.db }));
vi.mock('../../src/ingest/object-store.js', () => objectStoreMock(h));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');
const { mockEsStore } = await import('../../src/ingest/es-store.js');

function stage(docId: string, stageName: IngestJobData['stage']): IngestJobData {
  return { docId, kbId: KB, tenantId: TENANT, stage: stageName };
}

function byId(docId: string) {
  return h.state!.docs.find((d) => d.id === docId)!;
}

beforeEach(() => {
  h.reset();
  h.env.INGEST_ES_MODE = 'mock';
  h.env.INGEST_EMBED_MODE = 'mock';
  mockEsStore.reset();
  const state = h.boot({
    id: DOC_A,
    kbId: KB,
    tenantId: TENANT,
    parsedText: BODY_A,
    status: 'parsed',
    extractMethod: 'text',
  });
  addDoc(state, {
    id: DOC_B,
    kbId: KB,
    tenantId: TENANT,
    title: '报销制度',
    objectKey: 'kb/x/reimburse.txt',
    parsedText: BODY_B,
    status: 'parsed',
    extractMethod: 'text',
  });
});

afterEach(() => {
  mockEsStore.reset();
});

describe('剧本 L9 · embed → es_index 顺序一致', () => {
  it('两份文档串行：阶段链恒为 embed→es_index，且未 embed 不得进 ES', async () => {
    const chunkA = await runIngestStage(stage(DOC_A, 'chunk'));
    const chunkB = await runIngestStage(stage(DOC_B, 'chunk'));
    expect(chunkA.next?.stage).toBe('embed');
    expect(chunkB.next?.stage).toBe('embed');

    // 顺序硬闸：尚未 embed 就 es_index 必失败，不得先写 ES
    const tooEarly = await runIngestStage(stage(DOC_B, 'es_index'));
    expect(tooEarly.errorCode).toBe('EMBED_NOT_READY');
    expect(mockEsStore.listVersions(DOC_B)).toEqual([]);

    const embedA = await runIngestStage(chunkA.next!);
    const embedB = await runIngestStage(chunkB.next!);
    expect(embedA.next?.stage).toBe('es_index');
    expect(embedB.next?.stage).toBe('es_index');
    expect(byId(DOC_A).embedReady).toBe(1);
    expect(byId(DOC_B).embedReady).toBe(1);
    expect(mockEsStore.listVersions(DOC_A)).toEqual([]);
    expect(mockEsStore.listVersions(DOC_B)).toEqual([]);

    // A 的 es_index 不得把 B 带成 ready（文档间无混序）
    const esA = await runIngestStage(embedA.next!);
    expect(esA.errorCode).toBeUndefined();
    expect(byId(DOC_A).status).toBe('ready');
    expect(byId(DOC_B).status).not.toBe('ready');
    expect(mockEsStore.listVersions(DOC_B)).toEqual([]);

    const esB = await runIngestStage(embedB.next!);
    expect(esB.errorCode).toBeUndefined();
    expect(byId(DOC_B).status).toBe('ready');
    expect(h.state!.statusSeq.filter((s) => s === 'ready')).toHaveLength(2);
  });

  it('静态守卫：es_index 入队点唯一，且 es_index 要求 embedReady=1', async () => {
    const srcDir = path.join(process.cwd(), 'src/ingest');
    const files = (await readdir(srcDir)).filter((f) => f.endsWith('.ts'));
    const withStageLiteral: string[] = [];
    for (const file of files) {
      const text = await readFile(path.join(srcDir, file), 'utf8');
      if (text.includes("'es_index'")) withStageLiteral.push(file);
    }
    expect(withStageLiteral).toEqual(['pipeline.ts']);

    const pipeline = await readFile(path.join(srcDir, 'pipeline.ts'), 'utf8');
    expect(pipeline.match(/enqueueNext\([^)]*'es_index'/g) ?? []).toHaveLength(1);
    expect(pipeline).toMatch(/doc\.embedReady !== 1[\s\S]{0,160}EMBED_NOT_READY/);
    expect(INGEST_STAGES.indexOf('embed')).toBeLessThan(INGEST_STAGES.indexOf('es_index'));
  });
});
