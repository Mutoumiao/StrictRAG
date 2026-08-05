import type { AskReason, AskCitation } from '@strict-rag/contracts';

import type { MembershipSlot, RetrieveScope } from '../services/retrieve/types.js';

export type AskMode = 'fast' | 'balanced' | 'strict';
export type RouteLabel = 'chitchat' | 'single';

export type GraphEvidence = {
  chunkId: string;
  docId: string;
  title?: string;
  text: string;
  preview?: string;
  lifecycle?: string;
  score?: number;
};

export type GraphClaim = {
  text: string;
  /** 对齐的 evidence chunkId */
  chunkIds: string[];
};

export type AskGraphInput = {
  requestId: string;
  question: string;
  kbId: string;
  membership: MembershipSlot;
  userId?: string;
  sessionId?: string | null;
  mode?: AskMode;
  locale?: string;
  scope?: RetrieveScope;
  /** 仅服务端 env TAU_CLAIM */
  tauClaim: number;
};

export type AskGraphState = {
  requestId: string;
  question: string;
  kbId: string;
  membership: MembershipSlot;
  userId?: string;
  sessionId?: string | null;
  mode: AskMode;
  locale: string;
  scope?: RetrieveScope;
  tauClaim: number;

  routeLabel?: RouteLabel;
  route_source?: string;
  route_llm_conf?: number | null;
  route_post_block?: boolean;
  route_llm_skipped?: boolean;

  evidence: GraphEvidence[];
  draft?: string;
  citations: AskCitation[];
  claims: GraphClaim[];
  claimScores: number[];
  minSupport?: number;

  status?: 'answered' | 'abstained';
  reason?: AskReason;
  answer?: string;
  answerKind?: 'knowledge' | 'chitchat';
  userMessage?: string;
  suggestedActions: { type: string; label: string }[];

  llmCalls: number;
  retrieveCalls: number;

  /** 本轮 evidence 快照（与 trace 同源；永不含会话历史） */
  evidence_snapshot?: GraphEvidence[];
};

export type AskGraphResult = {
  requestId: string;
  status: 'answered' | 'abstained';
  answer: string;
  answerKind?: 'knowledge' | 'chitchat';
  citations: AskCitation[];
  minSupport?: number;
  reason: AskReason;
  userMessage?: string;
  suggestedActions: { type: string; label: string }[];
  sessionId?: string | null;
  mode: AskMode;
  /** 与 finalize 同源；仅本轮 KB chunk，禁止会话历史 */
  evidence_snapshot: GraphEvidence[];
  debug?: {
    llmCalls: number;
    retrieveCalls: number;
    route_source?: string;
    routeLabel?: RouteLabel;
    evidenceCount: number;
  };
};

export function initState(input: AskGraphInput): AskGraphState {
  return {
    requestId: input.requestId,
    question: input.question,
    kbId: input.kbId,
    membership: input.membership,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    mode: input.mode ?? 'balanced',
    locale: input.locale ?? 'zh-CN',
    scope: input.scope,
    tauClaim: input.tauClaim,
    evidence: [],
    citations: [],
    claims: [],
    claimScores: [],
    suggestedActions: [],
    llmCalls: 0,
    retrieveCalls: 0,
  };
}
