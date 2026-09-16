import {
  AskAuditResponseSchema,
  AskGraphTraceSchema,
  AskReasonSchema,
  AskResponseSchema,
  EVIDENCE_SNAPSHOT_PREVIEW_MAX,
  type AskAuditResponse,
  type AskCitation,
  type AskFinalResponse,
  type AskGraphTrace,
} from '@strict-rag/contracts';
import { askTraces, type EvidenceSnapshotItem } from '@strict-rag/db';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { reasonPresentation } from '../../graph/index.js';
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
  /** 当轮 citations；拒答轮传 `[]`（不是 undefined，区分「零引用」与「未记录」） */
  citations?: AskCitation[];
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
    citations: input.citations ?? null,
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

/** 终态回读源：ask_traces 行里与终态有关的列 */
export type AskFinalSource = {
  requestId: string;
  kbId: string;
  status: string;
  reason: string;
  minSupport?: number | null;
  latencyMs?: number | null;
  mode?: string | null;
  sessionId?: string | null;
  answer?: string | null;
  /** null / undefined = 该轮未记录 citations（迁移 0017 之前的历史轮） */
  citations?: AskCitation[] | null;
};

/** 不可同形回读时的统一表达；禁止用审计 preview 或空引用冒充 answered */
function notReady(requestId: string, message: string): AskFinalResponse {
  return { requestId, ready: false, message };
}

/**
 * 断线重拉终态：把落库行重建为与在线 `data-ask-final` **同形**的 AskResponse。
 *
 * `userMessage` / `suggestedActions` 由 reason 经 `reasonPresentation()` 确定性重建
 * （图中无节点改写二者，见 `graph/state.ts`：`suggestedActions` 恒为 `[]`），不是编造。
 *
 * `ready=false` 的三种情形（均不得编造 answered）：
 * 1. `status` 不是 answered / abstained —— 该轮没有终态；
 * 2. `reason` 不是已知取值 —— 无法重建用户话术；
 * 3. answered 且 `verified`，但该轮 citations 未落库 —— 无法同形回读引用。
 */
export function toAskFinal(row: AskFinalSource): AskFinalResponse {
  if (row.status !== 'answered' && row.status !== 'abstained') {
    return notReady(row.requestId, '该轮没有落库终态，暂无法回读');
  }
  const reason = AskReasonSchema.safeParse(row.reason);
  if (!reason.success) {
    return notReady(row.requestId, '该轮末态原因不在已知取值内，暂无法回读');
  }

  // 拒答与 chitchat 当时必然零引用（run.ts finalize），可从 status/reason 推出，不算编造；
  // 只有 verified 通过轮的引用取自落库列，未落库就不冒充。
  const citationsDerivableEmpty = row.status === 'abstained' || reason.data === 'chitchat';
  if (!citationsDerivableEmpty && row.citations == null) {
    return notReady(row.requestId, '该轮引用未落库（早于引用落库的历史轮次），暂无法回读终态');
  }

  const pres = reasonPresentation(reason.data);
  const answer = row.answer ?? '';
  const mode =
    row.mode === 'fast' || row.mode === 'balanced' || row.mode === 'strict' ? row.mode : undefined;
  const candidate = {
    requestId: row.requestId,
    status: row.status,
    answer,
    ...(reason.data === 'chitchat'
      ? { answerKind: 'chitchat' as const }
      : row.status === 'answered'
        ? { answerKind: 'knowledge' as const }
        : {}),
    citations: citationsDerivableEmpty ? [] : (row.citations ?? []),
    ...(typeof row.minSupport === 'number' ? { minSupport: row.minSupport } : {}),
    reason: reason.data,
    // 通过轮在线 userMessage 即 answer（finalize 的 `userMessage || answer`）
    userMessage: row.status === 'answered' ? pres.userMessage || answer : pres.userMessage,
    suggestedActions: pres.suggestedActions,
    ...(typeof row.latencyMs === 'number' ? { latencyMs: row.latencyMs } : {}),
    ...(mode ? { mode } : {}),
    sessionId: row.sessionId ?? null,
  };

  const parsed = AskResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    return notReady(row.requestId, '该轮终态记录不完整，暂无法回读');
  }
  return { requestId: row.requestId, ready: true, response: parsed.data };
}
