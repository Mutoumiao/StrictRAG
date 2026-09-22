/**
 * 目标：worker L1 批跑须与 api CLI 同构地落人工抽检（条数 / 错数 / 来源），且落库白名单不得把它静默丢弃。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6（人工抽检 ≥20 条，错 ≤1）· ADR-046
 * 被测：runL1Batch · evalPersist.saveReport（reportJson 白名单）
 * 简介：注入 execute + 账本路径；缺测为 null；账本坏了抛错；捕获 set 载荷证明白名单逐键保留报告键。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** saveReport 写入的 set 载荷（不连真 PG） */
const captured: { values?: Record<string, unknown> } = {};

vi.mock('../../src/env.js', () => ({ env: { EVAL_L2_GOLD_PATH: '' } }));
vi.mock('../../src/db.js', () => ({
  getDb: () => ({
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          captured.values = values;
        },
      }),
    }),
  }),
}));

const { runL1Batch } = await import('../../src/eval/run-l1-batch.js');
const { HumanSpotLoadError } = await import('../../src/eval/human-spot.js');
const { evalPersist } = await import('../../src/eval/persist.js');

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function writeLedger(raw: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'worker-human-spot-'));
  tmpDirs.push(dir);
  const p = path.join(dir, 'ledger.json');
  writeFileSync(p, JSON.stringify(raw), 'utf8');
  return p;
}

const LEGAL_LEDGER = {
  evalRunId: 'eval-1',
  sampledBy: '业务抽检人',
  sampledAt: '2026-09-23T09:00:00.000Z',
  checked: 20,
  errors: 1,
};

function batch(humanSpotPath?: string) {
  return runL1Batch({
    kbId: 'kb-1',
    retrieveMode: 'mock',
    cases: [
      { caseKey: 'a1', question: '可答题', type: 'answerable' },
      { caseKey: 'u1', question: '不可答题', type: 'unanswerable' },
    ],
    execute: async ({ caseKey }) =>
      caseKey === 'a1' ? { outcome: 'answered' } : { outcome: 'abstained' },
    ...(humanSpotPath ? { humanSpotPath } : {}),
  });
}

describe('runL1Batch · 人工抽检字段', () => {
  it('传账本 → 报告落条数 / 错数 / 来源（与 api 侧同形状）', async () => {
    const ledgerPath = writeLedger(LEGAL_LEDGER);
    const report = await batch(ledgerPath);
    expect(report.humanSpot).toEqual({ checked: 20, errors: 1, source: ledgerPath });
    expect(Object.keys(report.humanSpot ?? {})).toEqual(['checked', 'errors', 'source']);
  });

  it('不传账本 → null（缺测，不得写成 0 条）', async () => {
    const report = await batch();
    expect(report.humanSpot).toBeNull();
  });

  it('账本违约（errors > checked）→ 抛错，不得静默变缺测', async () => {
    const ledgerPath = writeLedger({ ...LEGAL_LEDGER, checked: 1, errors: 3 });
    await expect(batch(ledgerPath)).rejects.toThrow(HumanSpotLoadError);
  });
});

describe('saveReport · reportJson 白名单不得静默丢键', () => {
  it('落库 JSON 保留 humanSpot，且报告上的每个键都在白名单里', async () => {
    const ledgerPath = writeLedger({ ...LEGAL_LEDGER, checked: 21, errors: 2 });
    const report = await batch(ledgerPath);
    captured.values = undefined;

    await evalPersist.saveReport('01900000-0000-7000-8000-0000000000aa', report);

    const reportJson = captured.values?.reportJson as Record<string, unknown> | undefined;
    expect(reportJson).toBeDefined();
    expect(reportJson?.humanSpot).toEqual({ checked: 21, errors: 2, source: ledgerPath });

    // 逐键白名单漏一个键 → 该键在库内静默消失；本断言钉住「报告有的，库内也能看到」
    const missing = Object.keys(report).filter(
      (key) => key !== 'retrieveMode' && !(key in (reportJson ?? {})),
    );
    expect(missing).toEqual([]);
    // 白名单不带明细：抽检明细（items）不进库，只留条数 / 错数 / 来源
    expect(Object.keys(reportJson?.humanSpot as object)).toEqual(['checked', 'errors', 'source']);
  });
});
