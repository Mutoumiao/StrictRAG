/**
 * 目标：入库阶段失败须按可选 URL 发一次 Webhook；空 URL 不发；失败不得阻断账本。
 * 需求：功能表 §10.3
 * 被测：notifyIngestFailure · recordStageEnd
 * 简介：POST JSON 只试一次；无正文/密钥；非 2xx 只 warn。
 */
import { formatLocalDateTime } from '@strict-rag/db';
import { describe, expect, it } from 'vitest';

import {
  notifyIngestFailure,
  type IngestFailureNotifyInput,
} from '../../src/ingest/failure-webhook.js';
import { recordStageEnd } from '../../src/ingest/job-ledger.js';

const WEBHOOK_URL = 'http://webhook.test/ingest-failed';
const FAIL: IngestFailureNotifyInput = {
  tenantId: 't1',
  kbId: 'k1',
  docId: 'd1',
  stage: 'embed',
  errorCode: 'EMBED_FAILED',
  jobId: 'job-1',
};

const ALLOWED_BODY_KEYS = [
  'at',
  'docId',
  'errorCode',
  'event',
  'jobId',
  'kbId',
  'stage',
  'tenantId',
];

function ledgerDb(onUpdate?: (patch: unknown) => void) {
  const updates: unknown[] = [];
  return {
    updates,
    db: {
      update: () => ({
        set: (patch: unknown) => ({
          where: async () => {
            updates.push(patch);
            onUpdate?.(patch);
          },
        }),
      }),
    },
  };
}

describe('notifyIngestFailure', () => {
  it('URL 空或仅空白不 fetch', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await notifyIngestFailure(FAIL, { url: '', fetchImpl });
    await notifyIngestFailure(FAIL, { url: '  \n', fetchImpl });
    expect(calls).toBe(0);
  });

  it('失败阶段 fetch 一次，断言 method/url/JSON', async () => {
    const frozen = new Date(2026, 8, 7, 15, 4, 5);
    const calls: Array<{ url: unknown; init?: RequestInit }> = [];
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await notifyIngestFailure(FAIL, {
      url: WEBHOOK_URL,
      fetchImpl,
      now: () => frozen,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(WEBHOOK_URL);
    expect(calls[0]?.init?.method).toBe('POST');
    const headers = calls[0]?.init?.headers as Record<string, string> | undefined;
    expect(headers?.['Content-Type'] ?? headers?.['content-type']).toBe('application/json');
    const json = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(json).toEqual({
      event: 'ingest.failed',
      tenantId: 't1',
      kbId: 'k1',
      docId: 'd1',
      stage: 'embed',
      errorCode: 'EMBED_FAILED',
      at: formatLocalDateTime(frozen),
      jobId: 'job-1',
    });
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('fetch 抛错或 500 不抛给调用方', async () => {
    await expect(
      notifyIngestFailure(FAIL, {
        url: WEBHOOK_URL,
        fetchImpl: (async () => {
          throw new Error('network down');
        }) as typeof fetch,
      }),
    ).resolves.toBeUndefined();

    await expect(
      notifyIngestFailure(FAIL, {
        url: WEBHOOK_URL,
        fetchImpl: (async () => new Response('nope', { status: 500 })) as typeof fetch,
      }),
    ).resolves.toBeUndefined();
  });

  it('载荷无敏感键、无正文', async () => {
    let body = '';
    await notifyIngestFailure(
      { ...FAIL, jobId: undefined },
      {
        url: WEBHOOK_URL,
        fetchImpl: (async (_url, init) => {
          body = String(init?.body);
          return new Response(null, { status: 204 });
        }) as typeof fetch,
        now: () => new Date(2026, 8, 7, 12, 0, 0),
      },
    );
    const json = JSON.parse(body) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(ALLOWED_BODY_KEYS.filter((k) => k !== 'jobId'));
    expect(json).not.toHaveProperty('jobId');
    expect(body).not.toMatch(/secret|password|authorization|apiKey|token|objectKey|parsedText/i);
    expect(json).not.toHaveProperty('body');
    expect(json).not.toHaveProperty('objectPath');
  });
});

describe('recordStageEnd 接线', () => {
  it('失败结果会调用 notify；成功不调用', async () => {
    const notified: IngestFailureNotifyInput[] = [];
    const notifyFailure = async (payload: IngestFailureNotifyInput) => {
      notified.push(payload);
    };
    const { db, updates } = ledgerDb();
    const ctx = { tenantId: 't1', kbId: 'k1', docId: 'd1', stage: 'embed' };

    await recordStageEnd(db as never, 'job-1', ctx, { next: { stage: 'es_index' } }, 2, {
      notifyFailure,
    });
    expect(updates).toHaveLength(1);
    expect(notified).toHaveLength(0);

    await recordStageEnd(
      db as never,
      'job-1',
      ctx,
      { done: true, errorCode: 'EMBED_FAILED' },
      2,
      { notifyFailure },
    );
    expect(notified).toEqual([
      {
        tenantId: 't1',
        kbId: 'k1',
        docId: 'd1',
        stage: 'embed',
        errorCode: 'EMBED_FAILED',
        jobId: 'job-1',
      },
    ]);
  });

  it('先写账本再 notify；notify 抛错不阻断', async () => {
    const order: string[] = [];
    const { db, updates } = ledgerDb(() => {
      order.push('ledger');
    });
    await expect(
      recordStageEnd(
        db as never,
        'job-1',
        { tenantId: 't1', kbId: 'k1', docId: 'd1', stage: 'scan' },
        { done: true, errorCode: 'MALWARE' },
        null,
        {
          notifyFailure: async () => {
            order.push('notify');
            throw new Error('webhook boom');
          },
        },
      ),
    ).resolves.toBeUndefined();
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'failed' });
    expect(order).toEqual(['ledger', 'notify']);
  });

  it('jobId 空仍在失败时 notify，且不写库', async () => {
    const notified: IngestFailureNotifyInput[] = [];
    const { db, updates } = ledgerDb();
    await recordStageEnd(
      db as never,
      null,
      { tenantId: 't1', kbId: 'k1', docId: 'd1', stage: 'parse' },
      { done: true, errorCode: 'NO_TEXT_LAYER' },
      null,
      {
        notifyFailure: async (payload) => {
          notified.push(payload);
        },
      },
    );
    expect(updates).toHaveLength(0);
    expect(notified).toEqual([
      {
        tenantId: 't1',
        kbId: 'k1',
        docId: 'd1',
        stage: 'parse',
        errorCode: 'NO_TEXT_LAYER',
      },
    ]);
  });
});

describe('pipeline 触发点', () => {
  it('pipeline 不直接调 webhook，只经 job-ledger', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(path.join(process.cwd(), 'src/ingest/pipeline.ts'), 'utf8');
    expect(src).not.toMatch(/failure-webhook/);
    expect(src).not.toMatch(/notifyIngestFailure/);
    expect(src).toMatch(/recordStageEnd/);
  });
});
