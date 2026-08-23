/**
 * 目标：ask_sessions / traces / feedback / eval_runs 必须可导出且含会话与证据快照列。
 * 需求：prds/03-data
 * 被测：users · kbMembers · askSessions · askTraces · askFeedback · evalRuns
 * 简介：核对 Phase 2 ask 表导出与关键列。
 */

import { describe, expect, it } from 'vitest';

import {
  askFeedback,
  askSessions,
  askTraces,
  evalRuns,
  kbMembers,
  users,
} from '../../src/schema/index.js';

describe('phase2 ask schema exports', () => {
  it('exposes users / members / sessions / traces / feedback tables', () => {
    expect(users).toBeDefined();
    expect(kbMembers).toBeDefined();
    expect(askSessions).toBeDefined();
    expect(askTraces).toBeDefined();
    expect(askFeedback).toBeDefined();
  });

  it('ask_traces has session_id and evidence_snapshot columns', () => {
    expect(askTraces.sessionId).toBeDefined();
    expect(askTraces.evidenceSnapshot).toBeDefined();
    expect(askTraces.requestId).toBeDefined();
  });

  it('eval_runs has retrieve_mode and matrix columns', () => {
    expect(evalRuns).toBeDefined();
    expect(evalRuns.retrieveMode).toBeDefined();
    expect(evalRuns.matrixA).toBeDefined();
    expect(evalRuns.reportJson).toBeDefined();
  });
});
