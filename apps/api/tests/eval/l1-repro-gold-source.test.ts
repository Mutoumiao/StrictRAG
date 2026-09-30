/**
 * 目标：L1 报告 §8 必须给题源两键真值 —— `goldSource='file'`，且本次题面集合与仓内 `fixtures/l1/gold.yaml`
 *       能否逐位对上（仓内文件读不到 → `null`，不得当 true / false）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §8 可复现字段 · 裁定 03（R3）
 * 被测：runL1Golden（repro.goldSource / repro.goldSetMatchesRepoFile）· formatReportMd
 * 简介：默认仓内 gold → true；L1_GOLD_PATH 指向改过一个 id 的副本 → false；错 repoRoot → null（未知）；md 如实渲染。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { defaultGoldPath, formatReportMd, runL1Golden } from '../../src/scripts/run-l1-golden.js';
import type { ExecuteAskResult } from '../../src/services/ask/index.js';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});
function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l1-repro-gold-'));
  tmpDirs.push(d);
  return d;
}

/** 图上回包：批量注入用，题面不参与本测断言。 */
function answered(): ExecuteAskResult {
  return {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status: 'answered',
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [],
      minSupport: 0.9,
      reason: 'verified',
      userMessage: 'ok',
      suggestedActions: [],
      latencyMs: 1,
      mode: 'balanced',
      sessionId: null,
    },
    graph: {
      requestId: 'r',
      status: 'answered',
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [],
      minSupport: 0.9,
      reason: 'verified',
      userMessage: 'ok',
      suggestedActions: [],
      mode: 'balanced',
      sessionId: null,
      rewriteUsed: false,
      sessionDeepened: false,
      evidence_snapshot: [],
    },
  };
}

async function run(dir: string, goldPath: string, extra: Record<string, unknown> = {}) {
  return runL1Golden({
    goldPath,
    outDir: path.join(dir, 'out'),
    kbId: 'kb',
    persistEval: false,
    execute: async () => answered(),
    ...extra,
  });
}

describe('runL1Golden · §8 题源两键', () => {
  it('默认仓内 gold → goldSource=file 且 goldSetMatchesRepoFile=true', async () => {
    const dir = tmp();
    const report = await run(dir, defaultGoldPath());
    expect(report.repro.goldSource).toBe('file');
    expect(report.repro.goldSetMatchesRepoFile).toBe(true);
    // md 如实渲染
    const md = formatReportMd(report);
    expect(md).toContain('| goldSource | file |');
    expect(md).toContain('| goldSetMatchesRepoFile | true |');
  });

  it('L1_GOLD_PATH 指向改过一个 id 的副本 → goldSource=file 且 goldSetMatchesRepoFile=false', async () => {
    const dir = tmp();
    const raw = JSON.parse(readFileSync(defaultGoldPath(), 'utf8')) as {
      cases: Array<{ id: string }>;
    };
    raw.cases[0]!.id = 'l1-tampered-000';
    const tampered = path.join(dir, 'gold.yaml');
    writeFileSync(tampered, JSON.stringify(raw), 'utf8');

    const report = await run(dir, tampered);
    expect(report.repro.goldSource).toBe('file');
    // 集合身份变了一个 id → false（逐位比对，不是「数量相同」）
    expect(report.repro.goldSetMatchesRepoFile).toBe(false);
  });

  it('repoRoot 指向无 gold 的目录 → goldSetMatchesRepoFile=null（未知，不得当 true / false）', async () => {
    const dir = tmp();
    const report = await run(dir, defaultGoldPath(), { repoRoot: path.join(dir, 'empty') });
    expect(report.repro.goldSource).toBe('file');
    expect(report.repro.goldSetMatchesRepoFile).toBeNull();
    expect(formatReportMd(report)).toContain('| goldSetMatchesRepoFile | — |');
  });

  it('maxCases 截断只影响「跑了哪些题」：题集身份两键仍按全量算', async () => {
    const dir = tmp();
    const full = await run(dir, defaultGoldPath());
    const truncated = await run(dir, defaultGoldPath(), { maxCases: 1 });
    expect(truncated.cases).toHaveLength(1);
    expect(full.cases.length).toBeGreaterThan(1);
    // 截断后仍与仓内基线逐位相同，且题面哈希与全量跑一致（不许把截断后的子集当题集身份）
    expect(truncated.repro.goldSetMatchesRepoFile).toBe(true);
    expect(truncated.repro.questionIdsHash).toBe(full.repro.questionIdsHash);
  });
});
