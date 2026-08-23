/**
 * 目标：入库任务 DTO 必须覆盖全阶段，拒绝空 docId 与非法 stage。
 * 需求：prds/06-async
 * 被测：IngestJobDataSchema · INGEST_STAGES · INGEST_JOB_DEFAULT_ATTEMPTS
 * 简介：入库任务载荷形状与阶段枚举的单一来源。
 */

import { describe, expect, it } from 'vitest';

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
    expect(INGEST_STAGES).toEqual(['scan', 'parse', 'chunk', 'embed', 'es_index']);
    expect(INGEST_JOB_DEFAULT_ATTEMPTS).toBeGreaterThanOrEqual(1);
  });
});
