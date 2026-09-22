/**
 * 目标：人工抽检账本契约必须挡住自相矛盾的登记（errors ≤ checked；给了 items 就要与两个整数对得上）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6（人工抽检 ≥20 条，错 ≤1）
 * 被测：HumanSpotLedgerSchema · toHumanSpotReport
 * 简介：三条不变式逐条拒绝并指到出错字段；形状严格（多余键 / 非整数 / 负值拒绝）；报告落点只带条数错数来源。
 */

import { describe, expect, it } from 'vitest';

import {
  HumanSpotLedgerSchema,
  toHumanSpotReport,
  type HumanSpotLedger,
} from '../../src/eval/human-spot.contract.js';

/** 合法账本：20 条 / 错 1（恰好在 §6 硬门边界上） */
const LEGAL = {
  evalRunId: 'eval-1',
  sampledBy: '业务抽检人',
  sampledAt: '2026-09-23T09:00:00.000Z',
  checked: 20,
  errors: 1,
};

function issuePaths(raw: unknown): string[] {
  const parsed = HumanSpotLedgerSchema.safeParse(raw);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => i.path.join('.'));
}

describe('HumanSpotLedgerSchema · 不变式与形状', () => {
  it('20 条 / 错 1 且不给明细 → 通过（items 可省）', () => {
    const parsed = HumanSpotLedgerSchema.parse(LEGAL);
    expect(parsed.checked).toBe(20);
    expect(parsed.errors).toBe(1);
    expect(parsed.items).toBeUndefined();
  });

  it('给了 items 且长度 = checked、wrong 条数 = errors → 通过', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      caseId: `q-${i + 1}`,
      wrong: i === 11,
    }));
    const parsed = HumanSpotLedgerSchema.parse({ ...LEGAL, items });
    expect(parsed.items).toHaveLength(20);
    expect(parsed.items?.filter((i) => i.wrong)).toHaveLength(1);
  });

  it('errors > checked → 拒绝，且指到 errors', () => {
    const paths = issuePaths({ ...LEGAL, checked: 1, errors: 2 });
    expect(paths).toContain('errors');
  });

  it('items.length ≠ checked → 拒绝，且指到 items', () => {
    const items = Array.from({ length: 19 }, (_, i) => ({
      caseId: `q-${i + 1}`,
      wrong: i === 0,
    }));
    const paths = issuePaths({ ...LEGAL, items });
    expect(paths).toContain('items');
  });

  it('items 里 wrong 条数 ≠ errors → 拒绝，且指到 items', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      caseId: `q-${i + 1}`,
      wrong: i < 2,
    }));
    const paths = issuePaths({ ...LEGAL, items });
    expect(paths).toContain('items');
  });

  it('非整数 / 负数条数 → 拒绝', () => {
    expect(issuePaths({ ...LEGAL, checked: 20.5 }).length).toBeGreaterThan(0);
    expect(issuePaths({ ...LEGAL, errors: -1 }).length).toBeGreaterThan(0);
  });

  it('多余键 / 缺抽检人 / 空 caseId → 拒绝（严格形状）', () => {
    expect(issuePaths({ ...LEGAL, sampleRate: 0.2 }).length).toBeGreaterThan(0);
    expect(issuePaths({ ...LEGAL, sampledBy: '' }).length).toBeGreaterThan(0);
    expect(
      issuePaths({ ...LEGAL, items: [{ caseId: '', wrong: true }], checked: 1, errors: 1 }).length,
    ).toBeGreaterThan(0);
  });
});

describe('toHumanSpotReport · 报告落点', () => {
  it('只落条数 / 错数 / 来源，不带 items 明细', () => {
    const ledger: HumanSpotLedger = {
      ...LEGAL,
      items: [{ caseId: 'q-1', wrong: true, note: '引用不对题' }],
      checked: 1,
    };
    const report = toHumanSpotReport(ledger, 'fixtures/l1/human-spot.example.json');
    expect(report).toEqual({
      checked: 1,
      errors: 1,
      source: 'fixtures/l1/human-spot.example.json',
    });
    expect(Object.keys(report)).toEqual(['checked', 'errors', 'source']);
  });
});
