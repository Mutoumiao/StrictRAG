/**
 * 目标：ingest_jobs 阶段账本须记录开始/结束与失败码。
 * 需求：X-04
 * 被测：buildStageStartRow · buildStageEndPatch · recordStageStart · recordStageEnd
 * 简介：最小账本行、成功链、失败码、pipeline 接线。
 */
import { describe, expect, it } from 'vitest';

import {
  buildStageEndPatch,
  buildStageStartRow,
  ledgerJobName,
  ledgerStatusFromResult,
  recordStageEnd,
  recordStageStart,
} from '../../src/ingest/job-ledger.js';

describe('ledgerJobName / ledgerStatusFromResult', () => {
  it('jobName equals stage', () => {
    expect(ledgerJobName('scan')).toBe('scan');
    expect(ledgerJobName('es_index')).toBe('es_index');
  });

  it('succeeded when no errorCode', () => {
    expect(ledgerStatusFromResult({ next: { stage: 'parse' } })).toBe('succeeded');
    expect(ledgerStatusFromResult({ done: true })).toBe('succeeded');
  });

  it('failed when errorCode set', () => {
    expect(ledgerStatusFromResult({ done: true, errorCode: 'MALWARE' })).toBe('failed');
  });
});

describe('buildStageStartRow', () => {
  it('builds running row with queue default and stage payload', () => {
    const row = buildStageStartRow({
      tenantId: 't1',
      kbId: 'k1',
      docId: 'd1',
      stage: 'embed',
      indexVersion: 3,
    });
    expect(row.status).toBe('running');
    expect(row.jobName).toBe('embed');
    expect(row.queue).toBe('sr-ingest');
    expect(row.indexVersion).toBe(3);
    expect(row.payload).toEqual({ stage: 'embed' });
    expect(row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe('buildStageEndPatch', () => {
  it('success chain records nextStage', () => {
    const patch = buildStageEndPatch('scan', { next: { stage: 'parse' } });
    expect(patch.status).toBe('succeeded');
    expect(patch.errorMessage).toBeNull();
    expect(patch.payload).toEqual({ stage: 'scan', nextStage: 'parse' });
  });

  it('terminal dual-ready marks terminal', () => {
    const patch = buildStageEndPatch('es_index', { done: true }, 2);
    expect(patch.status).toBe('succeeded');
    expect(patch.indexVersion).toBe(2);
    expect(patch.payload).toEqual({ stage: 'es_index', terminal: true });
  });

  it('failure records errorCode in payload and message', () => {
    const patch = buildStageEndPatch('embed', { done: true, errorCode: 'EMBED_FAILED' });
    expect(patch.status).toBe('failed');
    expect(patch.errorMessage).toBe('EMBED_FAILED');
    expect(patch.payload).toEqual({ stage: 'embed', errorCode: 'EMBED_FAILED' });
  });
});

describe('recordStageStart / recordStageEnd (shipped writers)', () => {
  it('recordStageStart inserts built row and returns id', async () => {
    const inserted: unknown[] = [];
    const db = {
      insert: (table: unknown) => ({
        values: async (row: unknown) => {
          inserted.push({ table, row });
        },
      }),
    };
    const id = await recordStageStart(db as never, {
      tenantId: 't',
      kbId: 'k',
      docId: 'd',
      stage: 'chunk',
      indexVersion: 1,
    });
    expect(id).toBeTruthy();
    expect(inserted).toHaveLength(1);
    const row = (inserted[0] as { row: { id: string; status: string; jobName: string } }).row;
    expect(row.id).toBe(id);
    expect(row.status).toBe('running');
    expect(row.jobName).toBe('chunk');
  });

  it('recordStageStart returns null on insert throw (non-blocking)', async () => {
    const db = {
      insert: () => ({
        values: async () => {
          throw new Error('db down');
        },
      }),
    };
    const id = await recordStageStart(db as never, {
      tenantId: 't',
      kbId: 'k',
      docId: 'd',
      stage: 'scan',
    });
    expect(id).toBeNull();
  });

  it('recordStageEnd updates by id; no-op when jobId null', async () => {
    const updates: unknown[] = [];
    const db = {
      update: () => ({
        set: (patch: unknown) => ({
          where: async () => {
            updates.push(patch);
          },
        }),
      }),
    };
    await recordStageEnd(db as never, null, 'scan', { next: { stage: 'parse' } });
    expect(updates).toHaveLength(0);

    await recordStageEnd(db as never, 'job-1', 'scan', { next: { stage: 'parse' } });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'succeeded' });
  });

  it('recordStageEnd swallows update errors', async () => {
    const db = {
      update: () => ({
        set: () => ({
          where: async () => {
            throw new Error('update fail');
          },
        }),
      }),
    };
    await expect(
      recordStageEnd(db as never, 'job-1', 'embed', { done: true, errorCode: 'EMBED_FAILED' }),
    ).resolves.toBeUndefined();
  });
});

describe('pipeline wiring contract (static)', () => {
  it('pipeline imports recordStageStart/End from job-ledger', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(
      path.join(process.cwd(), 'src/ingest/pipeline.ts'),
      'utf8',
    );
    expect(src).toMatch(/recordStageStart/);
    expect(src).toMatch(/recordStageEnd/);
    expect(src).toMatch(/from ['"]\.\/job-ledger\.js['"]/);
  });
});
