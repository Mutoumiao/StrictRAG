import { describe, expect, it } from 'vitest';

import { askFeedback, askSessions, askTraces, kbMembers, users } from '../index.js';

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
});
