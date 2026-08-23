/**
 * 目标：入库任务列表项映射保持查询契约。
 * 需求：prds/06-async
 * 被测：toIngestJobListItem
 * 简介：入队在 api，消费在 worker。
 */

import { describe, expect, it } from 'vitest';

import { toIngestJobListItem } from '../../src/services/ingest-jobs.js';

describe('toIngestJobListItem', () => {
  it('maps ledger row without rewriting status', () => {
    const item = toIngestJobListItem({
      id: '01900000-0000-7000-8000-0000000000j1',
      docId: '01900000-0000-7000-8000-0000000000d1',
      jobName: 'parse',
      status: 'failed',
      errorMessage: 'NO_TEXT_LAYER',
      indexVersion: 1,
      createdAt: '2026-08-21 00:00:00',
    });
    expect(item.jobName).toBe('parse');
    expect(item.status).toBe('failed');
    expect(item.errorMessage).toBe('NO_TEXT_LAYER');
  });
});
