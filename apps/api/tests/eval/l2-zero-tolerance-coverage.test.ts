/**
 * 目标：api L2 报告必须落零容忍处置档位区块，且 mechanical 处的命中数与既有 zeroToleranceHits 同源。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 · 裁定 02（二、零容忍四项 / 裁定 4 · 5 · 6）
 * 被测：runL2Golden · formatL2ReportMd · buildL2EvalRunInsert
 * 简介：注入 execute + 临时 gold；泄漏题 → 区块命中数 === 整批 zeroToleranceHits（两题泄漏即 2）；
 *       无泄漏 → 0 且其余四处仍如实记债；记债不进判定（live 全绿仍可 signoffEligible）；
 *       区块整对象直落 reportJson 并在 md 逐条渲染。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { L2_ZERO_TOLERANCE_PLACE_KEYS, type L2ZeroTolerancePlace } from '@strict-rag/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { defaultL2GoldPath } from '../../src/eval/l2-gold.js';
import { buildL2EvalRunInsert, runL2Golden } from '../../src/scripts/run-l2-golden.js';
import type { ExecuteAskResult } from '../../src/services/ask/index.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmpDir(prefix: string): string {
  const d = mkdtempSync(path.join(tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

const UUID_A = '01900000-0000-7000-8000-0000000000a1';

function leakCase(id: string): Record<string, unknown> {
  return {
    id,
    type: 'near_coref',
    turns: [
      { role: 'user', text: `${id}-1`, session: 'same' },
      { role: 'user', text: `${id}-2`, session: 'same' },
    ],
    expected: {
      themePersist: true,
      historyInEvidence: false,
      rewriteUsed: false,
      accept: ['answered'],
    },
    rubric: 'r',
  };
}

function goldFile(rows: Array<Record<string, unknown>>, dir: string): string {
  const p = path.join(dir, 'gold.yaml');
  writeFileSync(
    p,
    JSON.stringify({
      version: 1,
      run_type: 'session_multiturn',
      description: 'l2 zero tolerance coverage test gold',
      signoffEligible: false,
      cases: rows,
    }),
    'utf8',
  );
  return p;
}

/** 末轮 evidence 正文塞进本 case 的首轮问句原文 → historyLeaked 命中 */
function askResult(evidenceTexts: string[]): ExecuteAskResult {
  const evidence = evidenceTexts.map((text, i) => ({ chunkId: `c${i}`, docId: UUID_A, text }));
  const graph: ExecuteAskResult['graph'] = {
    requestId: 'r',
    status: 'answered',
    answer: 'ok',
    answerKind: 'knowledge',
    citations: [{ chunkId: 'c0', docId: UUID_A }],
    reason: 'verified',
    userMessage: 'ok',
    suggestedActions: [],
    mode: 'balanced',
    sessionId: null,
    rewriteUsed: true,
    sessionDeepened: false,
    evidence_snapshot: evidence,
  };
  return {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status: 'answered',
      answer: 'ok',
      answerKind: 'knowledge',
      citations: graph.citations,
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

function places(report: { zeroToleranceCoverage: readonly { places: L2ZeroTolerancePlace[] }[] }) {
  return report.zeroToleranceCoverage.flatMap((item) => item.places);
}

describe('runL2Golden 零容忍处置区块', () => {
  it('两题泄漏 → 区块命中数 = 整批 zeroToleranceHits = 2（同源，不许另算一份）', async () => {
    const dir = tmpDir('l2-zt-');
    const goldPath = goldFile(
      [leakCase('l2-zt-a'), leakCase('l2-zt-b'), leakCase('l2-zt-c')],
      dir,
    );
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async (params) => {
        const q = params.body.question;
        // 前两题末轮 evidence 里出现首轮问句原文；第三题干净
        if (q.endsWith('-2') && !q.startsWith('l2-zt-c')) return askResult([`引用：${q.slice(0, -2)}-1`]);
        return askResult(['条款']);
      },
    });

    expect(report.zeroToleranceHits).toBe(2);
    const hit = places(report).find((p) => p.key === 'historyInEvidence');
    expect(hit?.judged).toBe('mechanical');
    expect(hit?.hits).toBe(report.zeroToleranceHits);
    expect(hit?.hits).toBe(2);
    // 其余四处一律 debt 且 hits 为 null（不许拿 0 冒充「已判且满足」）
    for (const p of places(report)) {
      if (p.key === 'historyInEvidence') continue;
      expect(p.judged).toBe('debt');
      expect(p.hits).toBeNull();
    }
    expect(places(report).map((p) => p.key)).toEqual([...L2_ZERO_TOLERANCE_PLACE_KEYS]);
  });

  it('无泄漏 → 命中数 0 且四项仍逐条如实；记债不进判定（真 gold 全绿仍 signoffEligible）', async () => {
    const dir = tmpDir('l2-zt-');
    const report = await runL2Golden({
      goldPath: defaultL2GoldPath(),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      esMode: 'http',
      execute: async () => askResult(['条款']),
    });

    expect(report.zeroToleranceHits).toBe(0);
    expect(report.zeroToleranceCoverage.map((i) => i.judged)).toEqual(['debt', 'debt', 'debt', 'debt']);
    expect(places(report).find((p) => p.key === 'historyInEvidence')?.hits).toBe(0);
    expect(places(report).filter((p) => p.judged === 'debt')).toHaveLength(4);
    // 四处记债不构成新闸：live 全绿仍按工程公式 signoffEligible
    expect(report.caseCount).toBeGreaterThanOrEqual(15);
    expect(report.signoffEligible).toBe(true);
  });

  it('区块整对象直落 reportJson，且 md 逐条渲染 itemprop/place/judged/hits', async () => {
    const dir = tmpDir('l2-zt-');
    const goldPath = goldFile([leakCase('l2-zt-md')], dir);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      persistEval: false,
      execute: async (params) =>
        params.body.question.endsWith('-2')
          ? askResult(['引用：l2-zt-md-1'])
          : askResult(['条款']),
    });
    expect(report.zeroToleranceHits).toBe(1);

    const row = buildL2EvalRunInsert(report, {});
    const json = row.reportJson as Record<string, unknown>;
    expect(json.zeroToleranceCoverage).toEqual(report.zeroToleranceCoverage);
    expect(json.zeroToleranceCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'historyText',
          places: expect.arrayContaining([
            expect.objectContaining({ key: 'historyInEvidence', hits: 1 }),
          ]),
        }),
      ]),
    );

    const md = readFileSync(path.join(dir, 'out', 'l2-last-run.md'), 'utf8');
    expect(md).toContain('zeroToleranceCoverage');
    expect(md).toContain('| item | judged | place | judged | hits | note |');
    expect(md).toContain('| historyText | debt | historyInEvidence | mechanical | 1 |');
    expect(md).toContain('| historyText | debt | historyInMinSupport | debt | — |');
    expect(md).toContain('| skipVerify | debt | skipVerify | debt | — |');
  });
});
