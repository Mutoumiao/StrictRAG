/**
 * 目标：同 KB 跨文档近重复须按字 3-gram Jaccard≥0.9 命中；跨 KB / archived 不比。
 * 需求：prds/04-pipelines/01-offline-ingest.md §5 · 功能表 §6
 * 被测：isCrossDocNearDup · findCrossDocConflict · loadCrossDocSearchableChunks
 * 简介：无新依赖；不是生产 MinHash LSH；不是 pending_review。
 */

import { chunks, documents } from '@strict-rag/db';
import { describe, expect, it } from 'vitest';

import {
  findCrossDocConflict,
  isCrossDocNearDup,
  loadCrossDocSearchableChunks,
} from '../../src/ingest/cross-doc-dedupe.js';

const DUP =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理。';
const NEAR =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理！';
const FAR =
  '差旅报销须在返程后五个工作日内提交发票与行程单，逾期不予受理。本条与请假无关。';

const OTHER_DOC = '01900000-0000-7000-8000-0000000000d2';
const OTHER_CHUNK = '01900000-0000-7000-8000-0000000000c2';
const CURRENT = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const OTHER_KB = '01900000-0000-7000-8000-0000000000ab';

describe('isCrossDocNearDup', () => {
  it('精确重复与近重复命中，远文不命中', () => {
    expect(isCrossDocNearDup(DUP, DUP)).toBe(true);
    expect(isCrossDocNearDup(DUP, NEAR)).toBe(true);
    expect(isCrossDocNearDup(DUP, FAR)).toBe(false);
    expect(isCrossDocNearDup('', '')).toBe(false);
  });
});

describe('findCrossDocConflict', () => {
  it('返回第一篇命中的 skip_index 冲突对', () => {
    const hit = findCrossDocConflict(NEAR, [
      { chunkId: OTHER_CHUNK, docId: OTHER_DOC, bodyText: DUP },
    ]);
    expect(hit).toEqual({
      otherDocId: OTHER_DOC,
      otherChunkId: OTHER_CHUNK,
      action: 'skip_index',
    });
    expect(findCrossDocConflict(FAR, [{ chunkId: OTHER_CHUNK, docId: OTHER_DOC, bodyText: DUP }])).toBeNull();
  });
});

describe('loadCrossDocSearchableChunks', () => {
  function fakeDb(docRows: unknown[], chunkRows: unknown[]) {
    return {
      select: () => ({
        from: (table: unknown) => ({
          where: async () => {
            if (table === documents) return docRows;
            if (table === chunks) return chunkRows;
            return [];
          },
        }),
      }),
    };
  }

  const readyActive = {
    id: OTHER_DOC,
    kbId: KB,
    status: 'ready',
    lifecycle: 'active',
    indexVersion: 1,
  };
  const chunkRow = {
    id: OTHER_CHUNK,
    kbId: KB,
    docId: OTHER_DOC,
    bodyText: DUP,
    indexVersion: 1,
  };

  it('只收同库 ready 且 draft/active 的当前 version', async () => {
    const rows = await loadCrossDocSearchableChunks(fakeDb([readyActive], [chunkRow]) as never, {
      kbId: KB,
      excludeDocId: CURRENT,
    });
    expect(rows).toEqual([{ chunkId: OTHER_CHUNK, docId: OTHER_DOC, bodyText: DUP }]);
  });

  it('跨 KB、archived、自身文档不进语料', async () => {
    const crossKb = await loadCrossDocSearchableChunks(
      fakeDb([{ ...readyActive, kbId: OTHER_KB }], [{ ...chunkRow, kbId: OTHER_KB }]) as never,
      { kbId: KB, excludeDocId: CURRENT },
    );
    expect(crossKb).toEqual([]);

    const archived = await loadCrossDocSearchableChunks(
      fakeDb([{ ...readyActive, lifecycle: 'archived' }], [chunkRow]) as never,
      { kbId: KB, excludeDocId: CURRENT },
    );
    expect(archived).toEqual([]);

    const self = await loadCrossDocSearchableChunks(
      fakeDb([{ ...readyActive, id: CURRENT }], [{ ...chunkRow, docId: CURRENT }]) as never,
      { kbId: KB, excludeDocId: CURRENT },
    );
    expect(self).toEqual([]);
  });
});
