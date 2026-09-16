/**
 * 目标：当轮 citations 必须真的落进 ask_traces 列 —— 这是「断线按 requestId 重拉终态」的前提。
 * 需求：功能表 §3 断线重拉终态 · prds/03-data §3.4 ask_traces
 * 被测：saveAskTrace
 * 简介：写入含 citations 即落列；拒答传 [] 落 `[]`（当时确实零引用）；未传落 null（= 未记录，重拉时不冒充 answered）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const inserted: Record<string, unknown>[] = [];

vi.mock('../../src/services/db.js', () => ({
  getDb: () => ({
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        inserted.push(row);
        return Promise.resolve();
      },
    }),
  }),
}));

const { saveAskTrace } = await import('../../src/services/ask/traces.js');

const TENANT = '01900000-0000-7000-8000-000000000001';
const KB = '01900000-0000-7000-8000-0000000000aa';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '22222222-2222-7222-8222-222222222222';

function baseInput() {
  return {
    tenantId: TENANT,
    kbId: KB,
    userId: '01900000-0000-7000-8000-0000000000bb',
    requestId: 'req-trace-col',
    status: 'answered',
    reason: 'verified',
    rawQuestion: '年假有多少天？',
    evidenceSnapshot: [{ chunkId: CHUNK, docId: DOC }],
  };
}

describe('saveAskTrace citations 列', () => {
  beforeEach(() => {
    inserted.length = 0;
  });

  it('传入 citations 时落列（含 chunkId / docId）', async () => {
    await saveAskTrace({
      ...baseInput(),
      answer: '年假为15天。',
      citations: [{ chunkId: CHUNK, docId: DOC, title: '休假', preview: '15天' }],
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.citations).toEqual([
      { chunkId: CHUNK, docId: DOC, title: '休假', preview: '15天' },
    ]);
  });

  it('拒答轮传 [] 落空数组（≠ 未记录）', async () => {
    await saveAskTrace({ ...baseInput(), status: 'abstained', reason: 'low_retrieval', citations: [] });
    expect(inserted[0]!.citations).toEqual([]);
  });

  it('未传 citations 落 null（迁移前旧文同义：引用未记录）', async () => {
    await saveAskTrace(baseInput());
    expect(inserted[0]!.citations).toBeNull();
  });
});
