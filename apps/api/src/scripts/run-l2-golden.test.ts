import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { defaultL2GoldPath } from '../eval/l2-gold.js';
import type { ExecuteAskDeps, ExecuteAskParams, ExecuteAskResult } from '../services/ask/index.js';
import {
  acceptHit,
  historyLeaked,
  nextSessionId,
  parseL2CliEnv,
  runL2Golden,
  type L2Report,
} from './run-l2-golden.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'l2-run-'));
  tmpDirs.push(d);
  return d;
}

function goldFile(
  dir: string,
  cases: Array<Record<string, unknown>>,
): string {
  const p = path.join(dir, 'gold.yaml');
  writeFileSync(
    p,
    JSON.stringify({
      version: 1,
      run_type: 'session_multiturn',
      description: 'l2 runner test gold',
      signoffEligible: false,
      cases,
    }),
    'utf8',
  );
  return p;
}

function caseRow(
  id: string,
  turns: Array<{ text: string; session: 'same' | 'new' | 'none' }>,
  extra?: {
    type?: string;
    rewriteUsed?: boolean;
    accept?: string[];
    themePersist?: boolean;
  },
): Record<string, unknown> {
  const type = extra?.type ?? (turns.every((t) => t.session === 'none') ? 'no_session' : 'near_coref');
  return {
    id,
    type,
    turns: turns.map((t) => ({ role: 'user', text: t.text, session: t.session })),
    expected: {
      themePersist: extra?.themePersist ?? true,
      historyInEvidence: false,
      rewriteUsed: extra?.rewriteUsed ?? false,
      accept: extra?.accept ?? ['answered'],
    },
    rubric: 'test rubric',
  };
}

function answered(patch?: {
  status?: ExecuteAskResult['graph']['status'];
  reason?: string;
  rewriteUsed?: boolean;
  evidenceText?: string;
}): ExecuteAskResult {
  const status = patch?.status ?? 'answered';
  const reason = patch?.reason ?? 'verified';
  return {
    httpStatus: 200,
    response: {
      requestId: 'r',
      status,
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [],
      minSupport: 0.9,
      reason: reason as ExecuteAskResult['response']['reason'],
      userMessage: 'ok',
      suggestedActions: [],
      latencyMs: 1,
      mode: 'balanced',
      sessionId: null,
    },
    graph: {
      requestId: 'r',
      status,
      answer: 'ok',
      answerKind: 'knowledge',
      citations: [],
      minSupport: 0.9,
      reason: reason as ExecuteAskResult['graph']['reason'],
      userMessage: 'ok',
      suggestedActions: [],
      mode: 'balanced',
      sessionId: null,
      rewriteUsed: patch?.rewriteUsed ?? false,
      evidence_snapshot: patch?.evidenceText
        ? [{ chunkId: 'c1', docId: 'd1', text: patch.evidenceText }]
        : [],
    },
  };
}

describe('nextSessionId / acceptHit / historyLeaked', () => {
  it('same reuses; new mints; none omits; first same mints', () => {
    let n = 0;
    const mint = () => `s${++n}`;
    expect(nextSessionId('none', 'prev', mint)).toBeUndefined();
    expect(nextSessionId('new', 'prev', mint)).toBe('s1');
    expect(nextSessionId('same', 'prev', mint)).toBe('prev');
    expect(nextSessionId('same', null, mint)).toBe('s2');
  });

  it('acceptHit matches status or reason', () => {
    expect(acceptHit(['answered'], 'answered', 'verified')).toBe(true);
    expect(acceptHit(['coref_unresolved'], 'abstained', 'coref_unresolved')).toBe(true);
    expect(acceptHit(['budget_exhausted'], 'abstained', 'budget_exhausted')).toBe(true);
    expect(acceptHit(['answered'], 'abstained', 'unsupported_claims')).toBe(false);
  });

  it('historyLeaked is substring of prior user full text', () => {
    expect(historyLeaked(['制度：差旅住宿标准是多少？细则'], ['差旅住宿标准是多少？'])).toBe(true);
    expect(historyLeaked(['餐补 80 元'], ['差旅住宿标准是多少？'])).toBe(false);
    expect(historyLeaked(['x'], [''])).toBe(false);
  });
});

describe('parseL2CliEnv', () => {
  it('missing L2_KB_ID → exit 2', () => {
    const r = parseL2CliEnv({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.exitCode).toBe(2);
      expect(r.message).toMatch(/L2_KB_ID/);
    }
  });

  it('illegal L2_MAX_CASES → exit 2', () => {
    expect(parseL2CliEnv({ L2_KB_ID: 'kb', L2_MAX_CASES: '0' }).ok).toBe(false);
    expect(parseL2CliEnv({ L2_KB_ID: 'kb', L2_MAX_CASES: '-1' }).ok).toBe(false);
    expect(parseL2CliEnv({ L2_KB_ID: 'kb', L2_MAX_CASES: 'x' }).ok).toBe(false);
  });

  it('valid kb + optional max', () => {
    expect(parseL2CliEnv({ L2_KB_ID: 'kb' })).toEqual({ ok: true, kbId: 'kb' });
    expect(parseL2CliEnv({ L2_KB_ID: 'kb', L2_MAX_CASES: '3' })).toEqual({
      ok: true,
      kbId: 'kb',
      maxCases: 3,
    });
  });
});

describe('runL2Golden (injected execute)', () => {
  it('1 two turns same → same sessionId', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      caseRow('l2-same-001', [
        { text: 'q1', session: 'same' },
        { text: 'q2', session: 'same' },
      ]),
    ]);
    const seen: Array<string | undefined> = [];
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      execute: async (params, deps) => {
        expect(deps?.skipTrace).toBe(true);
        seen.push(params.body.sessionId ?? undefined);
        return answered();
      },
    });
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBeTruthy();
    expect(seen[1]).toBe(seen[0]);
    expect(report.cases[0]?.verdict).toBe('pass');
  });

  it('same session turn 2 window contains turn 1 user text', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      caseRow('l2-win-001', [
        { text: '第一轮住宿', session: 'same' },
        { text: '那餐补呢？', session: 'same' },
      ]),
    ]);
    const windows: string[][] = [];
    await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      execute: async (params, deps) => {
        const sid = params.body.sessionId;
        const loader = deps?.graphDeps?.loadSessionWindow;
        const w = sid && loader ? await loader({ sessionId: sid, kbId: 'kb' }) : [];
        windows.push(w.map((t) => t.content));
        return answered();
      },
    });
    expect(windows[0]).toEqual([]);
    expect(windows[1]?.some((t) => t.includes('第一轮住宿'))).toBe(true);
  });

  it('2 turn session=new → different sessionId', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      caseRow(
        'l2-new-001',
        [
          { text: 'q1', session: 'same' },
          { text: 'q2', session: 'new' },
        ],
        { type: 'session_isolation' },
      ),
    ]);
    const seen: Array<string | undefined> = [];
    await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      execute: async (params) => {
        seen.push(params.body.sessionId ?? undefined);
        return answered();
      },
    });
    expect(seen[0]).toBeTruthy();
    expect(seen[1]).toBeTruthy();
    expect(seen[1]).not.toBe(seen[0]);
  });

  it('3 session=none → sessionId omitted', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      caseRow(
        'l2-none-001',
        [{ text: 'standalone', session: 'none' }],
        { type: 'no_session', rewriteUsed: false },
      ),
    ]);
    const seen: ExecuteAskParams[] = [];
    await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      execute: async (params) => {
        seen.push(params);
        return answered();
      },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.body.sessionId).toBeUndefined();
    expect('sessionId' in (seen[0]?.body ?? {})).toBe(false);
  });

  it('4 cross-case session ids do not leak', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      caseRow('l2-iso-a', [
        { text: 'a1', session: 'same' },
        { text: 'a2', session: 'same' },
      ]),
      caseRow('l2-iso-b', [
        { text: 'b1', session: 'same' },
        { text: 'b2', session: 'same' },
      ]),
    ]);
    const firstOfCase: string[] = [];
    let prevCase: string | undefined;
    await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      execute: async (params) => {
        const q = params.body.question;
        if (q === 'a1' || q === 'b1') {
          firstOfCase.push(params.body.sessionId as string);
          prevCase = q;
        }
        expect(prevCase === 'b1' ? q.startsWith('b') : true).toBe(true);
        return answered();
      },
    });
    expect(firstOfCase).toHaveLength(2);
    expect(firstOfCase[0]).toBeTruthy();
    expect(firstOfCase[1]).toBeTruthy();
    expect(firstOfCase[1]).not.toBe(firstOfCase[0]);
  });

  it('5 evidence contains prior user text → fail + leak', async () => {
    const dir = tmp();
    const prior = '差旅住宿标准是多少？';
    const goldPath = goldFile(dir, [
      caseRow('l2-leak-001', [
        { text: prior, session: 'same' },
        { text: '那餐补呢？', session: 'same' },
      ]),
    ]);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      execute: async (params) => {
        if (params.body.question === prior) return answered();
        return answered({ evidenceText: `引用：${prior}` });
      },
    });
    const row = report.cases[0];
    expect(row?.verdict).toBe('fail');
    expect(row?.historyInEvidence).toBe(true);
    expect(row?.failReasons).toContain('history_in_evidence');
    expect(report.zeroToleranceHits).toBe(1);
    expect(report.failCount).toBe(1);
  });

  it('6 status in accept + rewrite aligned → pass; themePersist not judged', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      caseRow(
        'l2-pass-001',
        [
          { text: 'q1', session: 'same' },
          { text: 'q2', session: 'same' },
        ],
        { rewriteUsed: true, themePersist: false },
      ),
    ]);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      rewriteEnabled: true,
      execute: async () => answered({ rewriteUsed: true }),
    });
    expect(report.cases[0]?.verdict).toBe('pass');
    expect(report.cases[0]?.expectedThemePersist).toBe(false);
    expect(report.passCount).toBe(1);
    expect(report.signoffEligible).toBe(false);
  });

  it('7 rewriteEnabled=false + expected.rewriteUsed=true → fail', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      caseRow(
        'l2-rw-001',
        [
          { text: 'q1', session: 'same' },
          { text: 'q2', session: 'same' },
        ],
        { rewriteUsed: true },
      ),
    ]);
    const deps: ExecuteAskDeps[] = [];
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      rewriteEnabled: false,
      execute: async (_params, d) => {
        deps.push(d ?? {});
        return answered({ rewriteUsed: false });
      },
    });
    expect(report.rewriteEnabled).toBe(false);
    expect(deps.every((d) => d.graphDeps?.rewriteEnabled === false)).toBe(true);
    expect(report.cases[0]?.verdict).toBe('fail');
    expect(report.cases[0]?.failReasons).toContain('rewriteUsed');
  });

  it('8 real gold + stub → caseCount≥15; signoffEligible false even if live', async () => {
    const dir = tmp();
    const report = await runL2Golden({
      goldPath: defaultL2GoldPath(),
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      esMode: 'http',
      execute: async () => answered({ rewriteUsed: true }),
    });
    expect(report.caseCount).toBeGreaterThanOrEqual(15);
    expect(report.run_type).toBe('session_multiturn');
    expect(report.retrieve_mode).toBe('live');
    expect(report.signoffEligible).toBe(false);
    expect(report).not.toHaveProperty('businessPass');
    expect(report).not.toHaveProperty('signedPackage');

    const json = JSON.parse(
      readFileSync(path.join(dir, 'out', 'l2-last-run.json'), 'utf8'),
    ) as L2Report;
    expect(json.signoffEligible).toBe(false);
    expect(json.caseCount).toBe(report.caseCount);
    const md = readFileSync(path.join(dir, 'out', 'l2-last-run.md'), 'utf8');
    expect(md).toContain('session_multiturn');
    expect(md).toContain('signoffEligible');
  });

  it('9 execute throw → that case error, run continues', async () => {
    const dir = tmp();
    const goldPath = goldFile(dir, [
      caseRow('l2-err-001', [
        { text: 'boom', session: 'same' },
        { text: 'after', session: 'same' },
      ]),
      caseRow('l2-ok-001', [
        { text: 'ok1', session: 'same' },
        { text: 'ok2', session: 'same' },
      ]),
    ]);
    const report = await runL2Golden({
      goldPath,
      outDir: path.join(dir, 'out'),
      kbId: 'kb',
      execute: async (params) => {
        if (params.body.question === 'boom') throw new Error('gateway down');
        return answered();
      },
    });
    expect(report.caseCount).toBe(2);
    expect(report.errorCount).toBe(1);
    expect(report.passCount).toBe(1);
    expect(report.cases[0]?.verdict).toBe('error');
    expect(report.cases[0]?.errorMessage).toMatch(/gateway down/);
    expect(report.cases[1]?.verdict).toBe('pass');
  });
});
