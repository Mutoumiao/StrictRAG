/**
 * 目标：入库任务 DTO 必须覆盖全阶段，拒绝空 docId 与非法 stage；逻辑 stage 之间隔离（物理队列 interim 折叠）。
 * 需求：prds/06-async · 剧本 Q5
 * 被测：IngestJobDataSchema · INGEST_STAGES · INGEST_JOB_DEFAULT_ATTEMPTS · QUEUE_NAMES
 * 简介：含逻辑 stage ocr / purge；物理队列仍单条 sr-ingest。错误码分码（MALWARE vs OCR_*）在 worker 侧断言。
 */

import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES } from '../../src/async/queues.js';
import {
  INGEST_JOB_DEFAULT_ATTEMPTS,
  INGEST_STAGES,
  IngestJobDataSchema,
} from '../../src/async/ingest-job.js';

describe('IngestJobDataSchema · X-04 payload SSOT', () => {
  it('accepts scan without indexVersion', () => {
    const r = IngestJobDataSchema.safeParse({
      docId: 'd1',
      kbId: 'k1',
      tenantId: 't1',
      stage: 'scan',
    });
    expect(r.success).toBe(true);
  });

  it('accepts purge without indexVersion', () => {
    const r = IngestJobDataSchema.safeParse({
      docId: 'd1',
      kbId: 'k1',
      tenantId: 't1',
      stage: 'purge',
    });
    expect(r.success).toBe(true);
  });

  it('accepts embed with indexVersion', () => {
    const r = IngestJobDataSchema.safeParse({
      docId: 'd1',
      kbId: 'k1',
      tenantId: 't1',
      stage: 'embed',
      indexVersion: 2,
      requestId: 'r1',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty docId and bad stage', () => {
    expect(
      IngestJobDataSchema.safeParse({
        docId: '',
        kbId: 'k',
        tenantId: 't',
        stage: 'scan',
      }).success,
    ).toBe(false);
    expect(
      IngestJobDataSchema.safeParse({
        docId: 'd',
        kbId: 'k',
        tenantId: 't',
        stage: 'nope',
      }).success,
    ).toBe(false);
  });

  it('stages cover full pipeline', () => {
    expect(INGEST_STAGES).toEqual(['scan', 'parse', 'ocr', 'chunk', 'embed', 'es_index', 'purge']);
    expect(INGEST_JOB_DEFAULT_ATTEMPTS).toBeGreaterThanOrEqual(1);
  });

  it('Q5：逻辑 stage 互不重复、各自是合法 job 载荷，物理队列仍折叠为单条 sr-ingest', () => {
    // stage 隔离：不得有重复 stage / 用 "ingest.ocr" 之类点号当独立 stage
    expect(new Set(INGEST_STAGES).size).toBe(INGEST_STAGES.length);
    expect(INGEST_STAGES.some((stage) => stage.includes('.'))).toBe(false);
    expect(INGEST_STAGES.indexOf('scan')).toBeLessThan(INGEST_STAGES.indexOf('ocr'));

    // 物理队列 SSOT：interim 单队列，不与任何逻辑 stage 重名
    expect(QUEUE_NAMES.INGEST).toBe('sr-ingest');
    const queueNames: string[] = Object.values(QUEUE_NAMES);
    expect(INGEST_STAGES.filter((stage) => queueNames.includes(stage))).toEqual([]);

    // 每个逻辑 stage 都能作为独立 job 载荷解析（同队列内按 stage 分流，不混 stage）
    for (const stage of INGEST_STAGES) {
      const parsed = IngestJobDataSchema.safeParse({
        docId: 'd1',
        kbId: 'k1',
        tenantId: 't1',
        stage,
      });
      expect(parsed.success, `stage=${stage}`).toBe(true);
    }
  });
});
