import {
  AskAuditResponseSchema,
  AskGraphTraceSchema,
  EVIDENCE_SNAPSHOT_PREVIEW_MAX,
  type AskAuditResponse,
  type AskGraphTrace,
} from '@strict-rag/contracts';
import { askTraces, type EvidenceSnapshotItem } from '@strict-rag/db';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from '../db.js';

export { EVIDENCE_SNAPSHOT_PREVIEW_MAX };

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

export type AskTraceAuditSource = {
  requestId: string;
  kbId: string;
  status: string;
  reason: string;
  mode?: string | null;
  latencyMs?: number | null;
  sessionId?: string | null;
  evidenceSnapshot: EvidenceSnapshotItem[];
  graphTrace?: Record<string, unknown> | null;
};

export function clipEvidencePreview(preview: string | undefined): string | undefined {
  if (preview == null || preview.length === 0) return undefined;
  return preview.length > EVIDENCE_SNAPSHOT_PREVIEW_MAX
    ? preview.slice(0, EVIDENCE_SNAPSHOT_PREVIEW_MAX)
    : preview;
}

function pickGraphTrace(raw: Record<string, unknown> | null | undefined): AskGraphTrace | null {
  if (!raw) return null;
  const picked = {
    ...(typeof raw.llmCalls === 'number' ? { llmCalls: raw.llmCalls } : {}),
    ...(typeof raw.retrieveCalls === 'number' ? { retrieveCalls: raw.retrieveCalls } : {}),
    ...(typeof raw.route_source === 'string' ? { route_source: raw.route_source } : {}),
    ...(typeof raw.routeLabel === 'string' ? { routeLabel: raw.routeLabel } : {}),
  };
  const parsed = AskGraphTraceSchema.safeParse(picked);
  return parsed.success ? parsed.data : null;
}

/**
 * 审计 DTO：只暴露当时 snapshot 元数据 + graph_trace。
 * 不含 answer / rawQuestion / userId，也不得带 text/body。
 */
export function toAskAudit(row: AskTraceAuditSource): AskAuditResponse {
  const modeParsed =
    row.mode === 'fast' || row.mode === 'balanced' || row.mode === 'strict' ? row.mode : undefined;

  return AskAuditResponseSchema.parse({
    requestId: row.requestId,
    kbId: row.kbId,
    status: row.status,
    reason: row.reason,
    ...(modeParsed ? { mode: modeParsed } : {}),
    ...(typeof row.latencyMs === 'number' ? { latencyMs: row.latencyMs } : {}),
    sessionId: row.sessionId ?? null,
    evidenceSnapshot: (row.evidenceSnapshot ?? []).map((item) => {
      const preview = clipEvidencePreview(item.preview);
      return {
        chunkId: item.chunkId,
        docId: item.docId,
        ...(item.lifecycle ? { lifecycle: item.lifecycle } : {}),
        ...(preview ? { preview } : {}),
        ...(item.title ? { title: item.title } : {}),
      };
    }),
    graphTrace: pickGraphTrace(row.graphTrace),
  });
}
