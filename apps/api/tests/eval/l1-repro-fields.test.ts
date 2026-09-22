/**
 * 目标：L1 报告必须落 PRD §8 可复现区块 —— 能取到的取真值，取不到的一律 null（禁止占位串）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §8 可复现字段
 * 被测：runL1Golden · formatReportMd · writeL1Report
 * 简介：两条哈希 / 档位预算 / τ / env 模型进报告；记债字段逐条 null；md 渲染含全 null 极端情形；既有 mode 语义未变。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { emptyL1Repro, l1CalibSetHash, l1QuestionIdsHash } from '@strict-rag/contracts/eval-repro';

import { env } from '../../src/env.js';
import {
  defaultJudgeCalibPath,
  formatReportMd,
  resolveEvalMode,
  runL1Golden,
  writeL1Report,
} from '../../src/scripts/run-l1-golden.js';
import type { ExecuteAskParams, ExecuteAskResult } from '../../src/services/ask/index.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l1-repro-'));
  tmpDirs.push(d);
  return d;
}

function goldFile(
  dir: string,
  cases: Array<{ id: string; question: string; type: string }>,
): string {
  const p = path.join(dir, 'gold.yaml');
  writeFileSync(p, JSON.stringify({ cases }), 'utf8');
  return p;
}

/** 图上回包：档位固定 balanced（= executeAsk 的默认档位），故预算应为 150 / 20 */
function answered(mode: 'fast' | 'balanced' | 'strict' = 'balanced'): ExecuteAskResult {
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
      mode,
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
      mode,
      sessionId: null,
      rewriteUsed: false,
      sessionDeepened: false,
      evidence_snapshot: [],
    },
  };
}

function abstained(): ExecuteAskResult {
  const base = answered();
  return {
    ...base,
    response: { ...base.response, status: 'abstained', answer: '', reason: 'unsupported_claims' },
    graph: {
      ...base.graph,
      status: 'abstained',
      answer: '',
      reason: 'unsupported_claims',
      minSupport: undefined,
    },
  };
}

async function runOn(
  dir: string,
  opts: {
    ids?: string[];
    execute?: (params: ExecuteAskParams) => Promise<ExecuteAskResult>;
    extra?: Record<string, unknown>;
    out?: string;
  } = {},
) {
  const goldPath = goldFile(
    dir,
    (opts.ids ?? ['a1', 'u1']).map((id, i) => ({
      id,
      question: `q${i}`,
      type: i === 0 ? 'answerable' : 'unanswerable',
    })),
  );
  return runL1Golden({
    goldPath,
    outDir: path.join(dir, opts.out ?? 'out'),
    kbId: 'kb',
    persistEval: false,
    execute: opts.execute ?? (async () => abstained()),
    ...(opts.extra ?? {}),
  });
}

describe('runL1Golden · §8 区块能取到的取真值', () => {
  it('models.env / 档位预算 / τ / 题面哈希 / 校准集哈希都进报告（json + md）', async () => {
    const dir = tmp();
    const report = await runOn(dir);

    expect(report.repro.questionIdsHash).toBe(l1QuestionIdsHash(['a1', 'u1']));
    expect(report.repro.questionIdsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.repro.calibrationHash).toBe(
      l1CalibSetHash(readFileSync(defaultJudgeCalibPath(), 'utf8')),
    );
    // 图上实际档位 balanced → 冻结预算表 150 / 20
    expect(report.repro.retrieveK).toBe(150);
    expect(report.repro.rerankTopN).toBe(20);
    expect(report.repro.models.env.chat).toBe(env.GATEWAY_CHAT_MODEL || null);
    expect(report.repro.models.env.embed).toBe(env.GATEWAY_EMBED_MODEL || null);
    expect(report.repro.models.env.rerank).toBe(env.GATEWAY_RERANK_MODEL || null);
    // τ 与快照同源（不出现两个 τ）
    expect(report.repro.tauClaim).toBe(report.gateSnapshot?.tauClaim);

    const json = JSON.parse(readFileSync(path.join(dir, 'out', 'l1-last-run.json'), 'utf8')) as {
      repro: typeof report.repro;
    };
    expect(json.repro).toEqual(report.repro);

    const md = readFileSync(path.join(dir, 'out', 'l1-last-run.md'), 'utf8');
    expect(md).toContain('## 可复现（PRD §8）');
    expect(md).toContain(`| questionIdsHash | ${report.repro.questionIdsHash} |`);
    expect(md).toContain(`| calibrationHash | ${report.repro.calibrationHash} |`);
    expect(md).toContain('| retrieveK | 150 |');
  });

  it('档位随图上回包变：fast → 60 / 10；整批 error（无回包）→ null（不猜默认档位）', async () => {
    const dirFast = tmp();
    const fast = await runOn(dirFast, { execute: async () => answered('fast') });
    expect(fast.repro.retrieveK).toBe(60);
    expect(fast.repro.rerankTopN).toBe(10);
    // 既有顶层 mode 仍是 retrieve_mode 的历史别名，不随 ask 档位走
    expect(fast.mode).toBe(fast.retrieve_mode);

    const dirErr = tmp();
    const errored = await runOn(dirErr, {
      execute: async () => {
        throw new Error('boom');
      },
    });
    expect(errored.errorCount).toBe(2);
    expect(errored.repro.retrieveK).toBeNull();
    expect(errored.repro.rerankTopN).toBeNull();
  });

  it('KB model_bindings：注入读取器 → 落进 models.kbBindings；读取器抛错 → null 且报告照出', async () => {
    const dir = tmp();
    const bindings = [
      { purpose: 'judge', primaryRef: 'ollama/judge-a', fallbackRefs: ['openai/judge-b'] },
    ];
    const withBindings = await runOn(dir, { extra: { readKbBindings: async () => bindings } });
    expect(withBindings.repro.models.kbBindings).toEqual(bindings);

    const dirThrow = tmp();
    const onThrow = await runOn(dirThrow, {
      extra: {
        readKbBindings: async () => {
          throw new Error('pg down');
        },
      },
    });
    expect(onThrow.repro.models.kbBindings).toBeNull();
    expect(onThrow.repro.questionIdsHash).not.toBeNull();
  });
});

describe('runL1Golden · §8 取不到的一律 null（禁止伪值）', () => {
  it('记债字段逐条为 null，且报告里没有任何占位串', async () => {
    const dir = tmp();
    // 注入校准题 → 没有校准集文件内容 → 校准集哈希也取不到
    const report = await runOn(dir, {
      extra: {
        judgeCalibCases: [
          { id: 'p', claim: 'c1', evidence: 'e1', label: 1 },
          { id: 'n', claim: 'c2', evidence: 'e2', label: 0 },
        ],
      },
    });

    expect(report.repro.seed).toBeNull();
    expect(report.repro.fallbackChainsVersion).toBeNull();
    expect(report.repro.crag).toBeNull();
    expect(report.repro.contextMode).toBeNull();
    expect(report.repro.promptVersions).toBeNull();
    expect(report.repro.lifecycleFilterVersion).toBeNull();
    expect(report.repro.sessionStrategyVersion).toBeNull();
    expect(report.repro.l2GoldSetHash).toBeNull();
    expect(report.repro.models.kbBindings).toBeNull();
    expect(report.repro.calibrationHash).toBeNull();

    const serialized = JSON.stringify(report.repro);
    for (const fake of ['"unknown"', '"-"', '""', '"n/a"', '"none"']) {
      expect(serialized).not.toContain(fake);
    }
  });

  it('§8 区块不进任何判定：记债字段不改变 businessPass / signoffEligible', async () => {
    const dir = tmp();
    const report = await runOn(dir);
    expect(report.gateVerdict?.businessPass).toBe(false);
    expect(report.signoffEligible).toBe(false);
    // 区块里没有能被当成判据的数字字段
    expect(Object.keys(report.repro).sort()).not.toContain('mode');
  });
});

describe('formatReportMd · 可复现区块渲染', () => {
  it('取不到的渲染成「—」；全 null 区块也不炸、不出现 undefined / NaN', async () => {
    const dir = tmp();
    const report = await runOn(dir);

    const md = formatReportMd(report);
    expect(md).toContain('| seed | — |');
    expect(md).toContain('| crag | — |');
    expect(md).toContain('| contextMode | — |');
    expect(md).toContain('| models.kbBindings | — |');

    const allNullMd = formatReportMd({ ...report, repro: emptyL1Repro() });
    const section = allNullMd.slice(allNullMd.indexOf('## 可复现（PRD §8）'));
    expect(section).toContain('| models.env.chat | — |');
    expect(section).toContain('| l2GoldSetHash | — |');
    expect(section).not.toContain('undefined');
    expect(section).not.toContain('NaN');

    const { mdPath } = writeL1Report(path.join(dir, 'out-null'), {
      ...report,
      repro: emptyL1Repro(),
    });
    expect(readFileSync(mdPath, 'utf8')).toContain('## 可复现（PRD §8）');
  });
});

describe('既有 mode 字段语义未变', () => {
  it('顶层 mode ≡ retrieve_mode ≡ resolveEvalMode；§8 区块内没有 mode / retrieve_mode', async () => {
    const dir = tmp();
    const report = await runOn(dir, { extra: { esMode: 'mock' } });
    expect(report.mode).toBe('mock');
    expect(report.retrieve_mode).toBe(report.mode);
    expect(resolveEvalMode('http')).toBe('live');
    expect(report.repro).not.toHaveProperty('mode');
    expect(report.repro).not.toHaveProperty('retrieve_mode');
  });
});
