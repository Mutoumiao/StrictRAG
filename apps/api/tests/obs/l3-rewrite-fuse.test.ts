/**
 * 目标：L3 护栏闩后本进程后续 ask 强制关掉 rewrite，dogfood 闩不熔断。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §0 L3 · prds/10-delivery/02-ops-runbook.md §2.5
 * 被测：isL3RewriteFused / executeAsk
 * 简介：coref_fail_rate / topic_complaint / l2_stale 闩后即使 env 为 true 也 rewriteUsed=false；会话壳仍落 transcript；rewrite_dogfood 不熔；复位后恢复。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { env } from '../../src/env.js';
import { logger } from '../../src/logger.js';
import {
  evaluateL2Stale,
  isL3RewriteFused,
  L3_CORE_FAIL_RATE_MIN_SESSION,
  L3_CORE_FAIL_RATE_THRESHOLD,
  L3_TOPIC_COMPLAINT_THRESHOLD,
  metricGet,
  metricsReset,
  recordL3Ask,
  recordL3TopicComplaint,
} from '../../src/obs/index.js';
import { executeAsk } from '../../src/services/ask/execute.js';
import {
  evidenceOk,
  rewriteHappyChat,
  SID,
  STANDALONE,
} from '../ask/_support/graph-harness.js';
import { installObsReset } from './_support/reset.js';

installObsReset();

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const WINDOW = [
  { role: 'user' as const, content: '差旅住宿标准是什么？' },
  { role: 'assistant' as const, content: '住宿上限 500 元。' },
];

const rewriteEnvOriginal = env.SESSION_REWRITE_ENABLED;

function latchCorefFailRate(): void {
  const failN = Math.ceil(L3_CORE_FAIL_RATE_MIN_SESSION * L3_CORE_FAIL_RATE_THRESHOLD);
  const okN = L3_CORE_FAIL_RATE_MIN_SESSION - failN;
  for (let i = 0; i < okN; i += 1) {
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
  }
  for (let i = 0; i < failN; i += 1) {
    recordL3Ask({ rewriteUsed: false, reason: 'coref_unresolved', hasSession: true });
  }
}

async function askWithRewriteEnv(opts?: { rewriteEnabled?: boolean }): Promise<{
  rewriteUsed: boolean;
  retrieveQ: string;
  saved: { sessionId?: string | null; rewriteUsed: boolean; sessionRewriteEnabledDefault?: boolean }[];
  rewritePurposes: string[];
}> {
  const saved: {
    sessionId?: string | null;
    rewriteUsed: boolean;
    sessionRewriteEnabledDefault?: boolean;
  }[] = [];
  let retrieveQ = '';
  const rewritePurposes: string[] = [];
  const result = await executeAsk(
    {
      requestId: uuidv7(),
      kbId: KB,
      tenantId: TENANT,
      userId: uuidv7(),
      membership: 'member',
      body: {
        question: '那餐补呢？',
        sessionId: SID,
        options: { mode: 'balanced', debug: true },
      },
    },
    {
      graphDeps: {
        ...(opts?.rewriteEnabled !== undefined ? { rewriteEnabled: opts.rewriteEnabled } : {}),
        loadSessionWindow: async () => WINDOW,
        retrieve: async ({ question }) => {
          retrieveQ = question;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: async (purpose, messages) => {
          if (purpose === 'rewrite') rewritePurposes.push(purpose);
          return rewriteHappyChat(purpose, messages);
        },
      },
      saveTrace: async (input) => {
        const defaultOn = input.configSnap?.sessionRewriteEnabledDefault;
        saved.push({
          sessionId: input.sessionId,
          rewriteUsed: input.rewriteUsed === true,
          sessionRewriteEnabledDefault: typeof defaultOn === 'boolean' ? defaultOn : undefined,
        });
        return { id: 't-fuse' };
      },
    },
  );
  return {
    rewriteUsed: result.response.debug?.rewriteUsed === true,
    retrieveQ,
    saved,
    rewritePurposes,
  };
}

describe('L3 rewrite 进程内熔断', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    env.SESSION_REWRITE_ENABLED = true;
  });

  afterEach(() => {
    warn.mockRestore();
    env.SESSION_REWRITE_ENABLED = rewriteEnvOriginal;
  });

  it('coref_fail_rate / topic_complaint / l2_stale 闩后 fused；rewrite_dogfood 不熔', () => {
    expect(isL3RewriteFused()).toBe(false);

    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: false,
      rewriteEnvOn: true,
    });
    expect(metricGet('l3_guard_alert_total', { kind: 'rewrite_dogfood' })).toBe(1);
    expect(isL3RewriteFused()).toBe(false);

    latchCorefFailRate();
    expect(metricGet('l3_guard_alert_total', { kind: 'coref_fail_rate' })).toBe(1);
    expect(isL3RewriteFused()).toBe(true);

    metricsReset();
    expect(isL3RewriteFused()).toBe(false);
    for (let i = 0; i < L3_TOPIC_COMPLAINT_THRESHOLD; i += 1) {
      recordL3TopicComplaint({ hasSession: true });
    }
    expect(metricGet('l3_guard_alert_total', { kind: 'topic_complaint' })).toBe(1);
    expect(isL3RewriteFused()).toBe(true);

    metricsReset();
    evaluateL2Stale({ rewriteEnvOn: true, current: 'now', last: 'old' });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(1);
    expect(isL3RewriteFused()).toBe(true);
  });

  it('闩后即使 env 为 true 也 rewriteUsed=false；transcript 仍落；不写 env', async () => {
    latchCorefFailRate();
    expect(isL3RewriteFused()).toBe(true);
    expect(env.SESSION_REWRITE_ENABLED).toBe(true);

    const r = await askWithRewriteEnv();
    expect(r.rewritePurposes).toEqual([]);
    expect(r.rewriteUsed).toBe(false);
    expect(r.retrieveQ).toBe('那餐补呢？');
    expect(r.retrieveQ).not.toBe(STANDALONE);
    expect(r.saved).toHaveLength(1);
    expect(r.saved[0]?.sessionId).toBe(SID);
    expect(r.saved[0]?.rewriteUsed).toBe(false);
    expect(r.saved[0]?.sessionRewriteEnabledDefault).toBe(true);
    expect(env.SESSION_REWRITE_ENABLED).toBe(true);
  });

  it('显式 graphDeps.rewriteEnabled=true 也被熔断', async () => {
    latchCorefFailRate();
    const r = await askWithRewriteEnv({ rewriteEnabled: true });
    expect(r.rewriteUsed).toBe(false);
    expect(r.rewritePurposes).toEqual([]);
  });

  it('仅 rewrite_dogfood 闩不熔断，env true 仍可 rewriteUsed=true', async () => {
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: false,
      rewriteEnvOn: true,
    });
    expect(isL3RewriteFused()).toBe(false);

    const r = await askWithRewriteEnv();
    expect(r.rewritePurposes).toEqual(['rewrite']);
    expect(r.rewriteUsed).toBe(true);
    expect(r.retrieveQ).toBe(STANDALONE);
    expect(r.saved[0]?.sessionId).toBe(SID);
    expect(r.saved[0]?.sessionRewriteEnabledDefault).toBe(true);
  });

  it('metricsReset 后恢复：env true 可再 rewriteUsed=true', async () => {
    latchCorefFailRate();
    const fused = await askWithRewriteEnv();
    expect(fused.rewriteUsed).toBe(false);

    metricsReset();
    expect(isL3RewriteFused()).toBe(false);

    const restored = await askWithRewriteEnv();
    expect(restored.rewriteUsed).toBe(true);
    expect(restored.rewritePurposes).toEqual(['rewrite']);
    expect(restored.saved[0]?.sessionId).toBe(SID);
  });
});
