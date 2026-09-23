/**
 * 目标：api L2 报告必须落 PRD §8 可复现区块 —— 剧本集哈希取真值（本跑实际题面集），两个版本键如实 null；区块既不与 rewrite 指纹合并，也不进任何判定。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §8 可复现字段 · 裁定 02（三、§8 的 L2 侧字段）与工单 05
 * 被测：runL2Golden · formatL2ReportMd · buildL2EvalRunInsert
 * 简介：注入 execute + 临时 gold；哈希 = 本跑 case id 集合（重排不变、改一个 id 即变、截断即变）；
 *       两个版本键恒 null 且 md 渲染成「—」；`l2Fingerprint` 仍只进 reportJson（不合并）。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { emptyL2Repro, l2GoldSetHash } from '@strict-rag/contracts/eval-repro-l2';

import { buildL2EvalRunInsert, runL2Golden } from '../../src/scripts/run-l2-golden.js';
import type { ExecuteAskResult } from '../../src/services/ask/index.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmpDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l2-repro-'));
  tmpDirs.push(d);
  return d;
}

function caseRow(id: string): Record<string, unknown> {
  return {
    id,
    type: 'near_coref',
    turns: [
      { role: 'user', text: `${id}-1`, session: 'same' },
      { role: 'user', text: `${id}-2`, session: 'same' },
    ],
    expected: { themePersist: true, historyInEvidence: false, rewriteUsed: false, accept: ['answered'] },
    rubric: 'r',
  };
}

function goldFile(dir: string, caseIds: readonly string[]): string {
  const p = path.join(dir, 'gold.yaml');
  writeFileSync(
    p,
    JSON.stringify({
      version: 1,
      run_type: 'session_multiturn',
      description: 'l2 repro fields test gold',
      signoffEligible: false,
      cases: caseIds.map(caseRow),
    }),
    'utf8',
  );
  return p;
}

function askResult(): ExecuteAskResult {
  const graph: ExecuteAskResult['graph'] = {
    requestId: 'r',
    status: 'answered',
    answer: 'ok',
    answerKind: 'knowledge',
    citations: [],
    reason: 'verified',
    userMessage: 'ok',
    suggestedActions: [],
    mode: 'balanced',
    sessionId: null,
    rewriteUsed: false,
    sessionDeepened: false,
    evidence_snapshot: [],
  };
  return {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status: 'answered',
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [],
      reason: 'verified',
      userMessage: 'ok',
      suggestedActions: [],
      latencyMs: 1,
      mode: 'balanced',
      sessionId: null,
    },
    graph,
  };
}

async function run(dir: string, caseIds: readonly string[], maxCases?: number) {
  return runL2Golden({
    goldPath: goldFile(dir, caseIds),
    outDir: path.join(dir, 'out'),
    kbId: 'kb',
    persistEval: false,
    execute: async () => askResult(),
    ...(maxCases ? { maxCases } : {}),
  });
}

const IDS = ['l2-near-coref-001', 'l2-budget-001', 'l2-adversarial-001'];

describe('runL2Golden · §8 可复现区块', () => {
  it('l2GoldSetHash = 本跑题面 id 集合（口径 = l1QuestionIdsHash）；两个版本键恒 null', async () => {
    const dir = tmpDir();
    const report = await run(dir, IDS);

    expect(report.repro.l2GoldSetHash).toBe(l2GoldSetHash(IDS));
    expect(report.repro.l2GoldSetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.repro.sessionStrategyVersion).toBeNull();
    expect(report.repro.rewritePromptVersion).toBeNull();
    // 区块形状 = contracts 同形状，且不含 L1Repro 的通用字段（本图不扩）
    expect(Object.keys(report.repro).sort()).toEqual(Object.keys(emptyL2Repro()).sort());
    for (const key of ['models', 'retrieveK', 'tauClaim', 'questionIdsHash']) {
      expect(report.repro).not.toHaveProperty(key);
    }
  });

  it('反证：题面集重排 → 哈希不变（集合语义，不是文件 / 顺序哈希）', async () => {
    const dirA = tmpDir();
    const dirB = tmpDir();
    const forward = await run(dirA, IDS);
    const reversed = await run(dirB, [...IDS].reverse());

    expect(reversed.caseCount).toBe(forward.caseCount);
    expect(reversed.repro.l2GoldSetHash).toBe(forward.repro.l2GoldSetHash);

    const dirC = tmpDir();
    const mutated = await run(dirC, ['l2-near-coref-001', 'l2-budget-002', 'l2-adversarial-001']);
    expect(mutated.repro.l2GoldSetHash).not.toBe(forward.repro.l2GoldSetHash);
  });

  it('算的是本跑实际用的题面集：maxCases 截断 → 哈希随之变', async () => {
    const dirFull = tmpDir();
    const full = await run(dirFull, IDS);
    const dirCut = tmpDir();
    const cut = await run(dirCut, IDS, 2);

    expect(cut.caseCount).toBe(2);
    expect(cut.repro.l2GoldSetHash).toBe(l2GoldSetHash(IDS.slice(0, 2)));
    expect(cut.repro.l2GoldSetHash).not.toBe(full.repro.l2GoldSetHash);
  });

  it('区块不进任何判定：报告本体没有 l2Fingerprint（与 l2RewriteFingerprint 并存不合并）', async () => {
    const dir = tmpDir();
    const report = await run(dir, IDS);

    expect(report).not.toHaveProperty('l2Fingerprint');
    expect(report.repro).not.toHaveProperty('l2Fingerprint');
    // 指纹照旧只进 DB insert 的 reportJson（本图不动它的语义与位置）
    const row = buildL2EvalRunInsert(report, {});
    const json = row.reportJson as Record<string, unknown>;
    expect(typeof json.l2Fingerprint).toBe('string');
    expect(json.repro).toEqual(report.repro);
    // 报告本体整对象直落：新增区块自动带上，不需要在 insert 里再抄一遍
    expect(json.l2GoldSetHash).toBeUndefined();
    expect((json.repro as { l2GoldSetHash: string }).l2GoldSetHash).toBe(
      report.repro.l2GoldSetHash,
    );
  });

  it('json 与 md 都落该区块；取不到的渲染成「—」（不渲染 null / undefined）', async () => {
    const dir = tmpDir();
    const report = await run(dir, IDS);

    const json = JSON.parse(readFileSync(path.join(dir, 'out', 'l2-last-run.json'), 'utf8')) as {
      repro: typeof report.repro;
    };
    expect(json.repro).toEqual(report.repro);

    const md = readFileSync(path.join(dir, 'out', 'l2-last-run.md'), 'utf8');
    expect(md).toContain('## 可复现（PRD §8）');
    expect(md).toContain(`| l2GoldSetHash | ${report.repro.l2GoldSetHash} |`);
    expect(md).toContain('| sessionStrategyVersion | — |');
    expect(md).toContain('| rewritePromptVersion | — |');
    expect(md).not.toContain('| sessionStrategyVersion | null |');
    expect(md).not.toContain('undefined');
    expect(md).not.toContain('NaN');
  });
});
