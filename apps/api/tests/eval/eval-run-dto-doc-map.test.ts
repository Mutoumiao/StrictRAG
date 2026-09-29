/**
 * 目标：eval run DTO 必须透出映射来源三键，且历史行缺键时容错为 none/0/[]（不抛）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 6）
 * 被测：toEvalRunDto · extraStatsFromReport · EvalRunSchema（可选三键）
 * 简介：`EvalRunSchema` 是 .strict()，契约与 DTO 必须同改；此处钉「透出真值 + 缺键容错 + 过 schema」。
 */

import { EvalRunSchema } from '@strict-rag/contracts';
import { describe, expect, it } from 'vitest';

import {
  extraStatsFromReport,
  toEvalRunDto,
  type EvalRunRow,
} from '../../src/services/eval-runs.js';

const base: EvalRunRow = {
  id: '01900000-0000-7000-8000-0000000000aa',
  kbId: '01900000-0000-7000-8000-0000000000bb',
  tenantId: null,
  status: 'succeeded',
  runType: 'golden_2x2',
  retrieveMode: 'mock',
  signoffEligible: false,
  caseCount: 2,
  matrix: { A: 1, B: 0, C: 0, D: 1 },
  coverage: 1,
  errorCount: 0,
  ranAt: '2026-09-29 10:00:00',
  jobId: null,
  errorMessage: null,
  notes: null,
};

describe('eval run DTO · 映射来源三键', () => {
  it('透出真值（ledger / 非 0 / 名单），且过 EvalRunSchema', () => {
    const dto = toEvalRunDto(
      { ...base, docMapSource: 'ledger', docMapResolved: 2, docMapUnmappedIds: ['nope/x'] },
      true,
    );
    expect(dto.docMapSource).toBe('ledger');
    expect(dto.docMapResolved).toBe(2);
    expect(dto.docMapUnmappedIds).toEqual(['nope/x']);
    const parsed = EvalRunSchema.parse(dto);
    expect(parsed.docMapSource).toBe('ledger');
    expect(parsed.docMapUnmappedIds).toEqual(['nope/x']);
  });

  it('历史行缺键 → 容错为 none/0/[]（不抛，且过 schema）', () => {
    const dto = toEvalRunDto(base, false);
    expect(dto.docMapSource).toBe('none');
    expect(dto.docMapResolved).toBe(0);
    expect(dto.docMapUnmappedIds).toEqual([]);
    expect(EvalRunSchema.parse(dto).docMapSource).toBe('none');
  });

  it('extraStatsFromReport 只认合法三键（脏值省略）', () => {
    expect(
      extraStatsFromReport({ docMapSource: 'ledger', docMapResolved: 1, docMapUnmappedIds: ['a'] }),
    ).toMatchObject({ docMapSource: 'ledger', docMapResolved: 1, docMapUnmappedIds: ['a'] });
    expect(extraStatsFromReport({})).not.toHaveProperty('docMapSource');
    expect(extraStatsFromReport({ docMapSource: 'bogus' })).not.toHaveProperty('docMapSource');
    expect(extraStatsFromReport({ docMapResolved: -1 })).not.toHaveProperty('docMapResolved');
    expect(extraStatsFromReport({ docMapUnmappedIds: [1] })).not.toHaveProperty('docMapUnmappedIds');
  });
});
