/**
 * 目标：本次跑的题面 id 集合必须能与「仓内基线 fixtures/l1/gold.yaml」逐位比对；读不到基线时读作未知（null），
 *       不得把未知当 `true`（假绿）或当 `false`（假红）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §8 可复现字段 · 裁定 03（R3）
 * 被测：readRepoGoldCaseIds · goldSetMatchesRepoFile
 * 简介：真仓基线 60 条升序 id；错 repoRoot / 空目录 → null；集合相同 → true，改一个 id → false。
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  defaultRepoRoot,
  goldSetMatchesRepoFile,
  readRepoGoldCaseIds,
} from '../../src/eval/corpus-ledger-file.js';

const REPO_ROOT = defaultRepoRoot(import.meta.url);

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});
function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'repo-gold-'));
  tmpDirs.push(d);
  return d;
}

/** 在临时 repoRoot 下写一份内容为 JSON 的 `fixtures/l1/gold.yaml`。 */
function writeRepoTmp(root: string, data: unknown): void {
  const dir = path.join(root, 'fixtures', 'l1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'gold.yaml'), JSON.stringify(data), 'utf8');
}

describe('readRepoGoldCaseIds · 仓内基线题集 id', () => {
  it('真仓 fixtures/l1/gold.yaml → 60 条 id，升序且非空', () => {
    const ids = readRepoGoldCaseIds(REPO_ROOT);
    expect(ids).not.toBeNull();
    expect(ids).toHaveLength(60);
    expect(ids?.every((id) => typeof id === 'string' && id.trim().length > 0)).toBe(true);
    const sorted = [...(ids ?? [])].sort();
    expect(ids).toEqual(sorted);
    // 与直接读文件对照（同一 ids 集合）
    const raw = JSON.parse(readFileSync(path.join(REPO_ROOT, 'fixtures/l1/gold.yaml'), 'utf8')) as {
      cases: Array<{ id: string }>;
    };
    expect(new Set(ids)).toEqual(new Set(raw.cases.map((c) => c.id)));
  });

  it('错 repoRoot（读不到）/ 空目录 → null（信号，绝不抛错）', () => {
    expect(readRepoGoldCaseIds(path.join(tmp(), 'nope'))).toBeNull();
    expect(readRepoGoldCaseIds(tmp())).toBeNull();
  });

  it('非 JSON / 无 cases / id 不合形 / 空集合 → null', () => {
    const root = tmp();
    const dir = path.join(root, 'fixtures', 'l1');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'gold.yaml'), '{not json', 'utf8');
    expect(readRepoGoldCaseIds(root)).toBeNull();

    writeRepoTmp(root, { cases: 'nope' });
    expect(readRepoGoldCaseIds(root)).toBeNull();

    writeRepoTmp(root, { cases: [{ id: '' }] });
    expect(readRepoGoldCaseIds(root)).toBeNull();

    writeRepoTmp(root, { cases: [{ id: 'a' }, { question: 'q' }] });
    expect(readRepoGoldCaseIds(root)).toBeNull();

    writeRepoTmp(root, { cases: [] });
    expect(readRepoGoldCaseIds(root)).toBeNull();
  });
});

describe('goldSetMatchesRepoFile · 题集身份比对', () => {
  it('与仓内真 id 集逐个相同 → true（换序同值）', () => {
    const ids = readRepoGoldCaseIds(REPO_ROOT);
    expect(ids).not.toBeNull();
    expect(goldSetMatchesRepoFile(REPO_ROOT, ids ?? [])).toBe(true);
    expect(goldSetMatchesRepoFile(REPO_ROOT, [...(ids ?? [])].reverse())).toBe(true);
  });

  it('改动一个 id → false', () => {
    const ids = readRepoGoldCaseIds(REPO_ROOT) ?? [];
    expect(goldSetMatchesRepoFile(REPO_ROOT, [...ids.slice(1), 'l1-not-in-repo'])).toBe(false);
  });

  it('错 repoRoot / 空目录 → null（未知，不得当 true / false）', () => {
    expect(goldSetMatchesRepoFile(path.join(tmp(), 'nope'), ['a'])).toBeNull();
    expect(goldSetMatchesRepoFile(tmp(), ['a'])).toBeNull();
  });
});
