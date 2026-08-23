/**
 * 目标：L2 题面加载拒绝非法文件，且不得当作准出。
 * 需求：P2.5-L2
 * 被测：loadL2Gold / l2TypeCoverage / defaultL2GoldPath
 * 简介：≠ 准出。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  defaultL2GoldPath,
  L2_TYPES,
  L2GoldLoadError,
  l2TypeCoverage,
  loadL2Gold,
  type L2Case,
  type L2GoldFile,
} from '../../src/eval/l2-gold.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l2-'));
  tmpDirs.push(d);
  return d;
}

function baseCase(overrides: Partial<L2Case> = {}): L2Case {
  return {
    id: 'l2-near-coref-001',
    type: 'near_coref',
    turns: [
      { role: 'user', text: '差旅住宿标准是多少？', session: 'same' },
      { role: 'user', text: '那餐补呢？', session: 'same' },
    ],
    expected: {
      themePersist: true,
      historyInEvidence: false,
      rewriteUsed: true,
      accept: ['answered'],
    },
    rubric: '近指代应落到餐补；历史不得进 evidence',
    ...overrides,
  };
}

function baseRoot(overrides: Partial<L2GoldFile> = {}): L2GoldFile {
  return {
    version: 1,
    run_type: 'session_multiturn',
    description: '单元测夹具',
    signoffEligible: false,
    cases: [baseCase()],
    ...overrides,
  };
}

function writeGold(root: unknown, name = 'gold.yaml'): string {
  const p = path.join(tmp(), name);
  writeFileSync(p, typeof root === 'string' ? root : JSON.stringify(root), 'utf8');
  return p;
}

describe('loadL2Gold', () => {
  it('非法 JSON → L2GoldLoadError', () => {
    const p = writeGold('not: [valid json');
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/JSON/);
  });

  it('错 run_type → L2GoldLoadError', () => {
    const p = writeGold({ ...baseRoot(), run_type: 'golden_2x2' });
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/run_type/);
  });

  it('重复 id → L2GoldLoadError', () => {
    const p = writeGold(
      baseRoot({
        cases: [baseCase(), baseCase({ id: 'l2-near-coref-001', type: 'topic_switch' })],
      }),
    );
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/duplicate/);
  });

  it('no_session 却 session=same → L2GoldLoadError', () => {
    const p = writeGold(
      baseRoot({
        cases: [
          baseCase({
            id: 'l2-no-session-001',
            type: 'no_session',
            turns: [{ role: 'user', text: '住宿标准？', session: 'same' }],
            expected: {
              themePersist: false,
              historyInEvidence: false,
              rewriteUsed: false,
              accept: ['answered'],
            },
          }),
        ],
      }),
    );
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/no_session/);
  });

  it('缺 type → L2GoldLoadError', () => {
    const row = { ...baseCase() } as Record<string, unknown>;
    delete row.type;
    const p = writeGold(baseRoot({ cases: [row as unknown as L2Case] }));
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/type/);
  });

  it('空 turns → L2GoldLoadError', () => {
    const p = writeGold(baseRoot({ cases: [baseCase({ turns: [] })] }));
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/turns/);
  });

  it('非 no_session 且 turns<2 → L2GoldLoadError', () => {
    const p = writeGold(
      baseRoot({
        cases: [
          baseCase({
            turns: [{ role: 'user', text: '住宿标准？', session: 'same' }],
          }),
        ],
      }),
    );
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/turns/);
  });

  it('session_isolation 无 session=new → L2GoldLoadError', () => {
    const p = writeGold(
      baseRoot({
        cases: [
          baseCase({
            id: 'l2-session-isolation-001',
            type: 'session_isolation',
            turns: [
              { role: 'user', text: '住宿标准？', session: 'same' },
              { role: 'user', text: '那餐补呢？', session: 'same' },
            ],
          }),
        ],
      }),
    );
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/session_isolation/);
  });

  it('historyInEvidence 非 false → L2GoldLoadError', () => {
    const p = writeGold(
      baseRoot({
        cases: [
          baseCase({
            expected: {
              themePersist: true,
              historyInEvidence: true as unknown as false,
              rewriteUsed: true,
              accept: ['answered'],
            },
          }),
        ],
      }),
    );
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/historyInEvidence/);
  });

  it('signoffEligible 非 false → L2GoldLoadError', () => {
    const p = writeGold(baseRoot({ signoffEligible: true as unknown as false }));
    expect(() => loadL2Gold(p)).toThrow(L2GoldLoadError);
    expect(() => loadL2Gold(p)).toThrow(/signoffEligible/);
  });

  it('不可读路径 → L2GoldLoadError', () => {
    expect(() => loadL2Gold(path.join(tmp(), 'missing.yaml'))).toThrow(L2GoldLoadError);
  });

  it('合法夹具可加载', () => {
    const p = writeGold(baseRoot());
    const gold = loadL2Gold(p);
    expect(gold.version).toBe(1);
    expect(gold.run_type).toBe('session_multiturn');
    expect(gold.signoffEligible).toBe(false);
    expect(gold.cases).toHaveLength(1);
    expect(gold.cases[0]?.id).toBe('l2-near-coref-001');
  });
});

describe('l2TypeCoverage', () => {
  it('缺类型列入 missing', () => {
    const { present, missing } = l2TypeCoverage([{ type: 'near_coref' }]);
    expect(present.has('near_coref')).toBe(true);
    expect(missing).toContain('weak_coref');
    expect(missing).not.toContain('near_coref');
    expect(missing).toHaveLength(L2_TYPES.length - 1);
  });
});

describe('fixtures/l2/gold.yaml', () => {
  it('真实 gold 可 JSON 加载且覆盖 9 类 ≥15', () => {
    const gold = loadL2Gold(defaultL2GoldPath());
    expect(gold.version).toBe(1);
    expect(gold.run_type).toBe('session_multiturn');
    expect(gold.signoffEligible).toBe(false);
    expect(gold.cases.length).toBeGreaterThanOrEqual(15);
    const { missing } = l2TypeCoverage(gold.cases);
    expect(missing).toEqual([]);

    const ids = gold.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    const jSet = new Set(gold.cases.map((c) => c.jScenario).filter(Boolean));
    for (const j of ['J2', 'J2x', 'J3', 'J4', 'J5', 'J6', 'J8'] as const) {
      expect(jSet.has(j)).toBe(true);
    }

    for (const c of gold.cases) {
      expect(c.expected.historyInEvidence).toBe(false);
      if (c.type === 'no_session') {
        expect(c.expected.rewriteUsed).toBe(false);
        expect(c.turns.every((t) => t.session === 'none')).toBe(true);
      } else {
        expect(c.turns.length).toBeGreaterThanOrEqual(2);
      }
      if (c.type === 'session_isolation') {
        expect(c.turns.some((t) => t.session === 'new')).toBe(true);
      }
    }
  });

  it('defaultL2GoldPath 指向仓根 fixtures/l2/gold.yaml', () => {
    expect(defaultL2GoldPath().replaceAll('\\', '/')).toMatch(/fixtures\/l2\/gold\.yaml$/);
  });
});
