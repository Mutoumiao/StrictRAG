import { z } from 'zod';

/**
 * ask finalize reason 全集（PRD §3）。
 * 默认路径不可达项仍须枚举存在，禁止裸字符串。
 */
export const AskReasonSchema = z.enum([
  'verified',
  'chitchat',
  'model_abstained',
  'low_retrieval',
  'max_hops_exceeded',
  'invalid_citations',
  'unsupported_claims',
  'kb_not_ready',
  'budget_exhausted',
  'coref_unresolved',
  'rerank_unavailable',
  'claim_split_failed',
  'not_member',
  'acl_filter_too_large',
  'internal_guard',
]);

export type AskReason = z.infer<typeof AskReasonSchema>;
