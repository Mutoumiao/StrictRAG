/**
 * 目标：两份 gold 出现的每一个逻辑 id 都要能被入库入口产出，且与两份 README 表格机械一致。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 1）
 * 被测：readFixtureCorpus · deriveLogicalId · fixtures/l1|fixtures/l2 的 gold.yaml 与 README.md
 * 简介：gold 逻辑 id ⊆ 夹具派生 id；README 表（含区间）与派生 id 一致；同一逻辑 id 不重复、文件存在。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { defaultRepoRoot, readFixtureCorpus } from '../../src/eval/corpus-fixtures.js';

const REPO_ROOT = defaultRepoRoot(import.meta.url);
const derived = readFixtureCorpus(REPO_ROOT);
const derivedIds = derived.map((f) => f.logicalId);
const derivedSet = new Set(derivedIds);

function readText(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, ...rel.split('/')), 'utf8');
}

/** 从 gold（JSON 形）取全部 expectedDocIds（case 顶层字段） */
function goldLogicalIds(rel: string): string[] {
  const data = JSON.parse(readText(rel)) as { cases?: Array<{ expectedDocIds?: unknown }> };
  const ids: string[] = [];
  for (const c of data.cases ?? []) {
    if (!Array.isArray(c.expectedDocIds)) continue;
    for (const id of c.expectedDocIds) if (typeof id === 'string') ids.push(id.trim());
  }
  return ids;
}

/**
 * 从 README 表格提取逻辑 id（含区间展开）：
 * `ingest-samples/01-doc` … `10-doc` → 01..10；`l2-corpus/travel-stay` 等逐条。
 */
function readmeLogicalIds(md: string): Set<string> {
  const ids = new Set<string>();
  for (const m of md.matchAll(/`((?:ingest-samples|l2-corpus)\/[A-Za-z0-9-]+)`/g)) {
    ids.add(m[1]);
  }
  const rangeRe = /`((ingest-samples|l2-corpus)\/(\d+)(-[a-z][a-z0-9-]*))`\s*…\s*`(\d+)/g;
  for (const m of md.matchAll(rangeRe)) {
    const [, , prefix, start, suffix, end] = m;
    for (let i = Number(start); i <= Number(end); i += 1) {
      ids.add(`${prefix}/${String(i).padStart(String(start).length, '0')}${suffix}`);
    }
  }
  return ids;
}

describe('夹具派生 id · 基本形状', () => {
  it('覆盖两份语料目录（10 + 3），逻辑 id 唯一、文件存在', () => {
    expect(derivedIds).toHaveLength(13);
    expect(new Set(derivedIds).size).toBe(13);
    expect(derivedIds.filter((id) => id.startsWith('ingest-samples/'))).toHaveLength(10);
    expect(derivedIds.filter((id) => id.startsWith('l2-corpus/'))).toHaveLength(3);
    for (const f of derived) {
      expect(f.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(f.sourceFile.endsWith('.txt')).toBe(true);
    }
  });
});

describe('两份 gold 的每一个逻辑 id 都能被入库入口产出', () => {
  it('L1 gold：全部逻辑 id ⊆ 派生 id（去重 10 个）', () => {
    const ids = goldLogicalIds('fixtures/l1/gold.yaml');
    const distinct = [...new Set(ids)];
    expect(distinct.length).toBeGreaterThan(0);
    const missing = distinct.filter((id) => !derivedSet.has(id));
    expect(missing).toEqual([]);
  });

  it('L2 gold：全部逻辑 id ⊆ 派生 id（去重 6 个）', () => {
    const ids = goldLogicalIds('fixtures/l2/gold.yaml');
    const distinct = [...new Set(ids)];
    expect(distinct.length).toBeGreaterThan(0);
    const missing = distinct.filter((id) => !derivedSet.has(id));
    expect(missing).toEqual([]);
  });
});

describe('README 表格 ↔ 派生结果对账', () => {
  it('L1 README 表（含区间）全部 ⊆ 派生 id', () => {
    const ids = readmeLogicalIds(readText('fixtures/l1/README.md'));
    expect(ids.size).toBe(10);
    expect([...ids].filter((id) => !derivedSet.has(id))).toEqual([]);
  });

  it('L2 README 表（含区间 + 3 条 l2-corpus）覆盖全部 13 个派生 id', () => {
    const ids = readmeLogicalIds(readText('fixtures/l2/README.md'));
    expect(ids.size).toBe(13);
    expect([...ids].sort()).toEqual([...derivedIds].sort());
  });
});
