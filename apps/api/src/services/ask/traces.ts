import { askTraces, type EvidenceSnapshotItem } from '@strict-rag/db';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from '../db.js';

export type SaveAskTraceInput = {
  tenantId: string;
  kbId: string;
  userId: string;
  sessionId?: string | null;
  requestId: string;
  status: string;
  reason: string;
  minSupport?: number;
  latencyMs?: number;
  mode?: string;
  rawQuestion: string;
  standaloneQuestion?: string | null;
  rewriteUsed?: boolean;
  sessionDeepened?: boolean;
  answer?: string;
  evidenceSnapshot: EvidenceSnapshotItem[];
  graphTrace?: Record<string, unknown>;
  configSnap?: Record<string, unknown>;
};

/** 写入 ask_traces；evidence_snapshot 禁止含会话原文 */
export async function saveAskTrace(input: SaveAskTraceInput): Promise<{ id: string }> {
  const id = uuidv7();
  await getDb().insert(askTraces).values({
    id,
    tenantId: input.tenantId,
    kbId: input.kbId,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    requestId: input.requestId,
    status: input.status,
    reason: input.reason,
    minSupport: input.minSupport ?? null,
    latencyMs: input.latencyMs ?? null,
    mode: input.mode ?? null,
    rawQuestion: input.rawQuestion,
    standaloneQuestion: input.standaloneQuestion ?? null,
    rewriteUsed: input.rewriteUsed ? 1 : 0,
    sessionDeepened: input.sessionDeepened ? 1 : 0,
    answer: input.answer ?? null,
    evidenceSnapshot: input.evidenceSnapshot,
    graphTrace: input.graphTrace ?? null,
    configSnap: input.configSnap ?? null,
  });
  return { id };
}

export async function getAskTraceByRequestId(requestId: string) {
  const [row] = await getDb()
    .select()
    .from(askTraces)
    .where(eq(askTraces.requestId, requestId))
    .limit(1);
  return row ?? null;
}
