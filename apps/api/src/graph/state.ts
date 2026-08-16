import type { AskReason, AskCitation } from '@strict-rag/contracts';

import type { MembershipSlot, RetrieveScope } from '../services/retrieve/types.js';

export type AskMode = 'fast' | 'balanced' | 'strict';
export type RouteLabel = 'chitchat' | 'single';

export type SessionWindowTurn = {
  role: 'user' | 'assistant';
  content: string;
};

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
  /** 文档回溯加码；闸后才采用 */
  preferredDocIds?: readonly string[];
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

  /** 用户原文；init = input.question */
  rawQuestion: string;
  /** 改写结果；未改写则缺省 */
  standaloneQuestion?: string;
  /** 本轮是否真正调用了 rewrite 且采用 standalone */
  rewriteUsed: boolean;
  /** 开路径 ∧ 窗有 user ∧ 显式会话回溯；关/空窗保持 false */
  sessionDeepened: boolean;
  /** 命中文档回溯 ∧ 闸后采用 ≥1 preferred；不翻聊天窗 */
  documentBackref: boolean;
  preferredDocIds?: readonly string[];

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
  standaloneQuestion?: string;
  rewriteUsed: boolean;
  sessionDeepened: boolean;
  documentBackref?: boolean;
  /** 命中库外文档回溯正则；默认 false；≠ 新拒答 */
  externalBackref?: boolean;
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
    rawQuestion: input.question,
    rewriteUsed: false,
    sessionDeepened: false,
    documentBackref: false,
    preferredDocIds: input.preferredDocIds,
    evidence: [],
    citations: [],
    claims: [],
    claimScores: [],
    suggestedActions: [],
    llmCalls: 0,
    retrieveCalls: 0,
  };
}
